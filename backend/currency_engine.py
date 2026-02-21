"""
Multi-Currency Engine
- Fetches live exchange rates from ExchangeRate-API (free tier)
- Stores historical rate snapshots in MongoDB
- Applies rates based on document_date (business date)
"""

import httpx
import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

EXCHANGE_RATE_API_BASE = "https://open.er-api.com/v6/latest"
SUPPORTED_CURRENCIES = ["USD", "INR", "AED", "GBP", "EUR", "SGD", "THB", "MYR", "SAR", "QAR"]


async def fetch_live_rates(base_currency: str = "USD") -> dict:
    """Fetch live exchange rates from ExchangeRate-API (free, no key needed)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{EXCHANGE_RATE_API_BASE}/{base_currency}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("result") == "success":
                    return {
                        "base": base_currency,
                        "rates": {k: v for k, v in data["rates"].items() if k in SUPPORTED_CURRENCIES},
                        "timestamp": data.get("time_last_update_utc", datetime.now(timezone.utc).isoformat()),
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                    }
        logger.warning(f"Exchange rate API returned non-success: {resp.status_code}")
    except Exception as e:
        logger.error(f"Failed to fetch exchange rates: {e}")

    # Fallback rates
    return {
        "base": "USD",
        "rates": {
            "USD": 1.0, "INR": 83.50, "AED": 3.67, "GBP": 0.79,
            "EUR": 0.92, "SGD": 1.34, "THB": 35.20, "MYR": 4.72,
            "SAR": 3.75, "QAR": 3.64,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "is_fallback": True,
    }


async def sync_daily_rates(db: AsyncIOMotorDatabase) -> dict:
    """Fetch and store daily rate snapshot. Called by scheduler."""
    rates_data = await fetch_live_rates("USD")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    snapshot = {
        "date": today,
        "base": rates_data["base"],
        "rates": rates_data["rates"],
        "fetched_at": rates_data["fetched_at"],
        "is_fallback": rates_data.get("is_fallback", False),
    }

    await db.exchange_rates.update_one(
        {"date": today},
        {"$set": snapshot},
        upsert=True
    )
    logger.info(f"Exchange rates synced for {today}: {len(rates_data['rates'])} currencies")
    return snapshot


async def get_rate_for_date(db: AsyncIOMotorDatabase, currency: str, date_str: str) -> dict:
    """Get exchange rate for a specific document_date. Uses historical snapshot if available."""
    if currency == "INR":
        return {"rate": 1.0, "source": "base_currency", "date": date_str}

    # Try exact date snapshot
    snapshot = await db.exchange_rates.find_one({"date": date_str}, {"_id": 0})
    if snapshot and currency in snapshot.get("rates", {}):
        usd_to_currency = snapshot["rates"][currency]
        usd_to_inr = snapshot["rates"].get("INR", 83.50)
        rate = usd_to_inr / usd_to_currency
        return {"rate": round(rate, 4), "source": "historical_snapshot", "date": date_str}

    # Try nearest available snapshot
    snapshot = await db.exchange_rates.find_one(
        {"date": {"$lte": date_str}},
        {"_id": 0},
        sort=[("date", -1)]
    )
    if snapshot and currency in snapshot.get("rates", {}):
        usd_to_currency = snapshot["rates"][currency]
        usd_to_inr = snapshot["rates"].get("INR", 83.50)
        rate = usd_to_inr / usd_to_currency
        return {"rate": round(rate, 4), "source": "nearest_snapshot", "date": snapshot["date"]}

    # Fetch live as last resort
    live = await fetch_live_rates("USD")
    if currency in live.get("rates", {}):
        usd_to_currency = live["rates"][currency]
        usd_to_inr = live["rates"].get("INR", 83.50)
        rate = usd_to_inr / usd_to_currency
        return {"rate": round(rate, 4), "source": "live_fetch", "date": date_str}

    return {"rate": 1.0, "source": "fallback", "date": date_str}


async def convert_to_inr(db: AsyncIOMotorDatabase, amount: float, currency: str, date_str: str) -> dict:
    """Convert amount to INR using document_date rate."""
    rate_info = await get_rate_for_date(db, currency, date_str)
    converted = round(amount * rate_info["rate"], 2)
    return {
        "original_amount": amount,
        "original_currency": currency,
        "exchange_rate_used": rate_info["rate"],
        "converted_inr_amount": converted,
        "rate_source": rate_info["source"],
        "rate_date": rate_info["date"],
        "rate_timestamp": datetime.now(timezone.utc).isoformat(),
    }
