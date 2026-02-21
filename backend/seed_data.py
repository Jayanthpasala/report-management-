"""
Seed data for Financial Intelligence Platform
Creates demo organization, outlets, users, suppliers, and sample documents
"""

import asyncio
import os
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import uuid
import bcrypt
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


async def seed():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Clear existing data
    for col in ['organizations', 'outlets', 'users', 'suppliers', 'documents', 'daily_metrics', 'insights']:
        await db[col].drop()

    # --- Organization ---
    org_id = str(uuid.uuid4())
    await db.organizations.insert_one({
        "id": org_id,
        "name": "Spice Kitchen Group",
        "industry": "restaurant",
        "base_currency": "INR",
        "settings": {
            "food_cost_benchmark": 0.32,
            "labor_cost_benchmark": 0.25,
            "required_daily_reports": ["sales_receipt", "purchase_invoice"],
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # --- Outlets ---
    outlets = [
        {"id": str(uuid.uuid4()), "org_id": org_id, "name": "Spice Kitchen - Koramangala", "city": "Bangalore", "country": "India", "currency": "INR"},
        {"id": str(uuid.uuid4()), "org_id": org_id, "name": "Spice Kitchen - Indiranagar", "city": "Bangalore", "country": "India", "currency": "INR"},
        {"id": str(uuid.uuid4()), "org_id": org_id, "name": "Spice Kitchen - Dubai Mall", "city": "Dubai", "country": "UAE", "currency": "AED"},
    ]
    for o in outlets:
        o["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.outlets.insert_many(outlets)

    # --- Users ---
    password_hash = hash_password("demo123")
    users = [
        {
            "id": str(uuid.uuid4()), "org_id": org_id, "email": "owner@spicekitchen.com",
            "name": "Rajesh Kumar", "role": "owner", "outlet_ids": [o["id"] for o in outlets],
            "password_hash": password_hash, "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": str(uuid.uuid4()), "org_id": org_id, "email": "manager@spicekitchen.com",
            "name": "Priya Sharma", "role": "manager", "outlet_ids": [outlets[0]["id"]],
            "password_hash": password_hash, "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": str(uuid.uuid4()), "org_id": org_id, "email": "staff@spicekitchen.com",
            "name": "Ravi", "role": "staff", "outlet_ids": [outlets[0]["id"]],
            "password_hash": password_hash, "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": str(uuid.uuid4()), "org_id": org_id, "email": "accounts@spicekitchen.com",
            "name": "Meera Patel", "role": "accounts", "outlet_ids": [o["id"] for o in outlets],
            "password_hash": password_hash, "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]
    await db.users.insert_many(users)

    # --- Suppliers ---
    suppliers = [
        {"id": str(uuid.uuid4()), "org_id": org_id, "name": "Metro Cash & Carry", "gst_id": "27AABCU9603R1ZM", "category": "Wholesale", "is_verified": True},
        {"id": str(uuid.uuid4()), "org_id": org_id, "name": "Reliance Fresh Direct", "gst_id": "27AABCR1718E1ZL", "category": "Produce", "is_verified": True},
        {"id": str(uuid.uuid4()), "org_id": org_id, "name": "Swiggy Settlements", "gst_id": "29AADCS4567P1ZQ", "category": "Aggregator", "is_verified": True},
        {"id": str(uuid.uuid4()), "org_id": org_id, "name": "Zomato Payments", "gst_id": "27AADCZ8901K1ZR", "category": "Aggregator", "is_verified": True},
        {"id": str(uuid.uuid4()), "org_id": org_id, "name": "ITC Foods Ltd", "gst_id": "36AABCI1234M1ZK", "category": "FMCG", "is_verified": True},
    ]
    for s in suppliers:
        s["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.suppliers.insert_many(suppliers)

    # --- Sample Documents (last 30 days) ---
    doc_types = ["purchase_invoice", "sales_receipt", "aggregator_statement", "expense_bill"]
    statuses = ["processed", "processed", "processed", "needs_review"]

    documents = []
    for day_offset in range(30):
        doc_date = datetime.now(timezone.utc) - timedelta(days=day_offset)
        date_str = doc_date.strftime("%Y-%m-%d")

        for outlet in outlets[:2]:  # Only Indian outlets for seed
            num_docs = random.randint(1, 3)
            for _ in range(num_docs):
                doc_type = random.choice(doc_types)
                confidence = round(random.uniform(0.4, 0.98), 3)
                status = "needs_review" if confidence < 0.6 else "processed"
                supplier = random.choice(suppliers)
                total = round(random.uniform(500, 50000), 2)
                tax = round(total * random.choice([0.05, 0.12, 0.18]), 2)

                documents.append({
                    "id": str(uuid.uuid4()),
                    "org_id": org_id,
                    "outlet_id": outlet["id"],
                    "document_type": doc_type,
                    "document_date": date_str,
                    "upload_timestamp": (doc_date + timedelta(hours=random.randint(1, 12))).isoformat(),
                    "processing_timestamp": (doc_date + timedelta(hours=random.randint(1, 12), minutes=5)).isoformat(),
                    "extraction_confidence": confidence,
                    "requires_review": status == "needs_review",
                    "status": status,
                    "supplier_id": supplier["id"],
                    "supplier_name": supplier["name"],
                    "file_path": f"/{org_id}/{outlet['id']}/{doc_date.year}/{doc_date.month:02d}/{doc_date.day:02d}/{uuid.uuid4()}.jpg",
                    "original_filename": f"bill_{date_str}_{random.randint(1,99)}.jpg",
                    "file_size": random.randint(50000, 5000000),
                    "uploader_id": users[2]["id"],
                    "uploader_name": users[2]["name"],
                    "extracted_data": {
                        "total_amount": total,
                        "tax_amount": tax,
                        "subtotal": round(total - tax, 2),
                        "currency": outlet["currency"],
                        "invoice_number": f"INV-{random.randint(10000, 99999)}",
                        "line_items": [
                            {"description": "Sample Item", "quantity": random.randint(1, 10), "amount": round(total * 0.6, 2)},
                            {"description": "Other Items", "quantity": 1, "amount": round(total * 0.4, 2)},
                        ],
                    },
                    "exchange_rate": 1.0 if outlet["currency"] == "INR" else 22.70,
                    "converted_inr_amount": total if outlet["currency"] == "INR" else round(total * 22.70, 2),
                })

    if documents:
        await db.documents.insert_many(documents)

    # --- Daily Metrics ---
    metrics = []
    for day_offset in range(30):
        doc_date = datetime.now(timezone.utc) - timedelta(days=day_offset)
        date_str = doc_date.strftime("%Y-%m-%d")

        for outlet in outlets[:2]:
            revenue = round(random.uniform(15000, 65000), 2)
            food_cost = round(revenue * random.uniform(0.28, 0.38), 2)
            labor_cost = round(revenue * random.uniform(0.2, 0.3), 2)
            other_expenses = round(revenue * random.uniform(0.05, 0.12), 2)
            aggregator_revenue = round(revenue * random.uniform(0.15, 0.45), 2)
            dine_in_revenue = round(revenue - aggregator_revenue, 2)

            metrics.append({
                "id": str(uuid.uuid4()),
                "org_id": org_id,
                "outlet_id": outlet["id"],
                "document_date": date_str,
                "revenue": revenue,
                "food_cost": food_cost,
                "labor_cost": labor_cost,
                "other_expenses": other_expenses,
                "aggregator_revenue": aggregator_revenue,
                "dine_in_revenue": dine_in_revenue,
                "profit_estimate": round(revenue - food_cost - labor_cost - other_expenses, 2),
                "food_cost_pct": round(food_cost / revenue * 100, 1),
                "order_count": random.randint(50, 200),
                "avg_order_value": round(revenue / random.randint(50, 200), 2),
            })
    if metrics:
        await db.daily_metrics.insert_many(metrics)

    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("org_id")
    await db.documents.create_index("org_id")
    await db.documents.create_index("outlet_id")
    await db.documents.create_index("document_date")
    await db.documents.create_index("status")
    await db.daily_metrics.create_index([("outlet_id", 1), ("document_date", -1)])
    await db.suppliers.create_index("org_id")

    print(f"Seeded: 1 org, {len(outlets)} outlets, {len(users)} users, {len(suppliers)} suppliers, {len(documents)} documents, {len(metrics)} daily metrics")
    print("\nDemo Accounts (password: demo123):")
    print("  Owner:    owner@spicekitchen.com")
    print("  Manager:  manager@spicekitchen.com")
    print("  Staff:    staff@spicekitchen.com")
    print("  Accounts: accounts@spicekitchen.com")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
