"""
Owner Intelligence Engine
- Daily KPI computation
- Benchmark comparison
- Anomaly detection  
- Color-coded insight card generation
"""

import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import List
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


# Industry benchmarks (configurable per org)
DEFAULT_BENCHMARKS = {
    "food_cost_pct": {"target": 32, "warning": 35, "critical": 40, "unit": "%"},
    "labor_cost_pct": {"target": 25, "warning": 28, "critical": 33, "unit": "%"},
    "daily_revenue_min": {"target": 25000, "warning": 18000, "critical": 12000, "unit": "₹"},
    "profit_margin_pct": {"target": 15, "warning": 10, "critical": 5, "unit": "%"},
    "aggregator_pct": {"target": 30, "warning": 40, "critical": 50, "unit": "%"},
    "order_count_daily": {"target": 100, "warning": 70, "critical": 40, "unit": "orders"},
}

SEVERITY_COLORS = {
    "critical": "#f43f5e",  # Red
    "warning": "#fbbf24",   # Amber
    "good": "#10b981",      # Green
    "info": "#3b82f6",      # Blue
}


async def compute_daily_kpis(db: AsyncIOMotorDatabase, org_id: str, date_str: str = None) -> List[dict]:
    """Compute KPIs for all outlets for a given date."""
    if not date_str:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    outlets = await db.outlets.find({"org_id": org_id}, {"_id": 0}).to_list(100)
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    benchmarks = (org or {}).get("settings", {}).get("benchmarks", DEFAULT_BENCHMARKS)

    all_insights = []

    for outlet in outlets:
        # Get today's metrics
        metric = await db.daily_metrics.find_one(
            {"outlet_id": outlet["id"], "document_date": date_str}, {"_id": 0}
        )
        if not metric:
            all_insights.append(_missing_data_insight(org_id, outlet, date_str))
            continue

        # Get 7-day average for comparison
        week_ago = (datetime.strptime(date_str, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")
        week_metrics = await db.daily_metrics.find(
            {"outlet_id": outlet["id"], "document_date": {"$gte": week_ago, "$lt": date_str}},
            {"_id": 0}
        ).to_list(7)
        avg_revenue = sum(m.get("revenue", 0) for m in week_metrics) / max(len(week_metrics), 1)
        avg_food_cost_pct = sum(m.get("food_cost_pct", 0) for m in week_metrics) / max(len(week_metrics), 1)

        revenue = metric.get("revenue", 0)
        food_cost = metric.get("food_cost", 0)
        food_cost_pct = metric.get("food_cost_pct", 0)
        profit = metric.get("profit_estimate", 0)
        orders = metric.get("order_count", 0)
        agg_rev = metric.get("aggregator_revenue", 0)
        agg_pct = round(agg_rev / revenue * 100, 1) if revenue > 0 else 0
        profit_margin = round(profit / revenue * 100, 1) if revenue > 0 else 0

        # --- Generate Insight Cards ---

        # 1. Food Cost Analysis
        fc_bench = benchmarks.get("food_cost_pct", DEFAULT_BENCHMARKS["food_cost_pct"])
        if food_cost_pct >= fc_bench["critical"]:
            all_insights.append(_make_insight(
                org_id, outlet, date_str, "critical",
                f"Food cost at {food_cost_pct}%",
                f"{outlet['name']} food cost hit {food_cost_pct}% — {food_cost_pct - fc_bench['target']}% above target. Check supplier pricing or portion control.",
                "food_cost", food_cost_pct, fc_bench["target"]
            ))
        elif food_cost_pct >= fc_bench["warning"]:
            all_insights.append(_make_insight(
                org_id, outlet, date_str, "warning",
                f"Food cost rising: {food_cost_pct}%",
                f"{outlet['name']} food cost at {food_cost_pct}%, approaching critical threshold of {fc_bench['critical']}%.",
                "food_cost", food_cost_pct, fc_bench["target"]
            ))
        elif food_cost_pct <= fc_bench["target"]:
            all_insights.append(_make_insight(
                org_id, outlet, date_str, "good",
                f"Food cost healthy at {food_cost_pct}%",
                f"{outlet['name']} food cost well within target ({fc_bench['target']}%).",
                "food_cost", food_cost_pct, fc_bench["target"]
            ))

        # 2. Revenue Anomaly
        if avg_revenue > 0:
            rev_change = round((revenue - avg_revenue) / avg_revenue * 100, 1)
            if rev_change < -20:
                all_insights.append(_make_insight(
                    org_id, outlet, date_str, "critical",
                    f"Revenue drop: {rev_change}%",
                    f"{outlet['name']} revenue ₹{revenue:,.0f} is {abs(rev_change)}% below 7-day average (₹{avg_revenue:,.0f}).",
                    "revenue_anomaly", revenue, avg_revenue
                ))
            elif rev_change > 20:
                all_insights.append(_make_insight(
                    org_id, outlet, date_str, "good",
                    f"Revenue surge: +{rev_change}%",
                    f"{outlet['name']} revenue ₹{revenue:,.0f} is {rev_change}% above 7-day average!",
                    "revenue_anomaly", revenue, avg_revenue
                ))

        # 3. Profit Margin
        pm_bench = benchmarks.get("profit_margin_pct", DEFAULT_BENCHMARKS["profit_margin_pct"])
        if profit_margin < pm_bench["critical"]:
            all_insights.append(_make_insight(
                org_id, outlet, date_str, "critical",
                f"Profit margin critically low: {profit_margin}%",
                f"{outlet['name']} only making {profit_margin}% margin. Target is {pm_bench['target']}%.",
                "profit_margin", profit_margin, pm_bench["target"]
            ))

        # 4. Aggregator Dependency
        agg_bench = benchmarks.get("aggregator_pct", DEFAULT_BENCHMARKS["aggregator_pct"])
        if agg_pct >= agg_bench["critical"]:
            all_insights.append(_make_insight(
                org_id, outlet, date_str, "warning",
                f"High aggregator dependency: {agg_pct}%",
                f"{outlet['name']} gets {agg_pct}% revenue via aggregators. High commission exposure.",
                "aggregator_dependency", agg_pct, agg_bench["target"]
            ))

        # 5. Order Volume
        ord_bench = benchmarks.get("order_count_daily", DEFAULT_BENCHMARKS["order_count_daily"])
        if orders < ord_bench["critical"]:
            all_insights.append(_make_insight(
                org_id, outlet, date_str, "critical",
                f"Low order volume: {orders} orders",
                f"{outlet['name']} only had {orders} orders. Usually expects {ord_bench['target']}+.",
                "order_volume", orders, ord_bench["target"]
            ))

    return all_insights


def _make_insight(org_id, outlet, date_str, severity, title, description, metric_type, value, benchmark) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "outlet_id": outlet["id"],
        "outlet_name": outlet["name"],
        "document_date": date_str,
        "severity": severity,
        "color": SEVERITY_COLORS.get(severity, SEVERITY_COLORS["info"]),
        "title": title,
        "description": description,
        "metric_type": metric_type,
        "current_value": value,
        "benchmark_value": benchmark,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_read": False,
    }


def _missing_data_insight(org_id, outlet, date_str) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "outlet_id": outlet["id"],
        "outlet_name": outlet["name"],
        "document_date": date_str,
        "severity": "warning",
        "color": SEVERITY_COLORS["warning"],
        "title": "No data for today",
        "description": f"{outlet['name']} has no metrics for {date_str}. Upload daily reports.",
        "metric_type": "missing_data",
        "current_value": 0,
        "benchmark_value": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_read": False,
    }


async def store_insights(db: AsyncIOMotorDatabase, insights: List[dict]):
    """Store computed insights in the database."""
    if not insights:
        return
    # Remove old insights for the same date/org
    if insights:
        org_id = insights[0]["org_id"]
        date_str = insights[0]["document_date"]
        await db.insights.delete_many({"org_id": org_id, "document_date": date_str})
    await db.insights.insert_many(insights)
    logger.info(f"Stored {len(insights)} insights")


async def get_insights(db: AsyncIOMotorDatabase, org_id: str, days: int = 7, severity: str = None) -> List[dict]:
    """Get recent insights for an organization."""
    date_from = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    query: dict = {"org_id": org_id, "document_date": {"$gte": date_from}}
    if severity:
        query["severity"] = severity
    insights = await db.insights.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return insights


async def run_daily_intelligence(db: AsyncIOMotorDatabase, org_id: str):
    """Run full daily intelligence pipeline. Called by scheduler."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    insights = await compute_daily_kpis(db, org_id, today)
    await store_insights(db, insights)

    # Also generate notifications for critical insights
    notifications = []
    for insight in insights:
        if insight["severity"] == "critical":
            notifications.append({
                "id": str(uuid.uuid4()),
                "org_id": org_id,
                "user_role": "owner",
                "type": "anomaly_alert",
                "title": insight["title"],
                "body": insight["description"],
                "severity": "critical",
                "color": insight["color"],
                "related_id": insight["id"],
                "related_type": "insight",
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    if notifications:
        await db.notifications.insert_many(notifications)

    return {"insights_generated": len(insights), "notifications_created": len(notifications)}
