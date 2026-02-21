"""
AI Document Processing Pipeline
Mock implementation - pluggable for real Google Document AI / Vision API

This module simulates:
1. Document AI extraction
2. Vision API fallback OCR
3. Document date extraction with confidence scoring
4. Supplier auto-matching
"""

import random
import re
from datetime import datetime, timedelta, timezone
from typing import Optional


# --- Mock Document AI / Vision API ---

SAMPLE_SUPPLIERS = [
    {"name": "Metro Cash & Carry", "gst_id": "27AABCU9603R1ZM"},
    {"name": "Reliance Fresh Direct", "gst_id": "27AABCR1718E1ZL"},
    {"name": "BigBasket Wholesale", "gst_id": "29AADCB2230M1ZV"},
    {"name": "Swiggy Settlements", "gst_id": "29AADCS4567P1ZQ"},
    {"name": "Zomato Payments", "gst_id": "27AADCZ8901K1ZR"},
    {"name": "Amazon Business", "gst_id": "29AABCA4321L1ZS"},
    {"name": "Sysco Foods India", "gst_id": "27AABCS6789T1ZP"},
    {"name": "ITC Foods Ltd", "gst_id": "36AABCI1234M1ZK"},
]

SAMPLE_LINE_ITEMS = [
    {"item": "Basmati Rice 25kg", "qty": 4, "unit_price": 1250.0, "category": "Grains"},
    {"item": "Cooking Oil 15L", "qty": 2, "unit_price": 2100.0, "category": "Oils"},
    {"item": "Fresh Chicken 10kg", "qty": 3, "unit_price": 180.0, "category": "Meat"},
    {"item": "Onions 50kg", "qty": 1, "unit_price": 1500.0, "category": "Vegetables"},
    {"item": "Tomatoes 25kg", "qty": 2, "unit_price": 800.0, "category": "Vegetables"},
    {"item": "Paneer 5kg", "qty": 2, "unit_price": 350.0, "category": "Dairy"},
    {"item": "Masala Pack Assorted", "qty": 1, "unit_price": 450.0, "category": "Spices"},
    {"item": "Flour Maida 25kg", "qty": 2, "unit_price": 850.0, "category": "Grains"},
    {"item": "Gas Cylinder", "qty": 1, "unit_price": 1100.0, "category": "Utilities"},
    {"item": "Napkins & Tissue Box", "qty": 5, "unit_price": 120.0, "category": "Supplies"},
    {"item": "Aggregator Commission", "qty": 1, "unit_price": 3500.0, "category": "Commissions"},
    {"item": "Daily Revenue Collection", "qty": 1, "unit_price": 25000.0, "category": "Revenue"},
]

DOC_TYPES = ["purchase_invoice", "sales_receipt", "aggregator_statement", "expense_bill", "utility_bill"]


def extract_document_data(filename: str, file_size: int) -> dict:
    """
    Mock Document AI extraction.
    In production: Replace with Google Document AI API call.
    Falls back to Vision API if confidence is low.
    """
    # Simulate processing quality based on file characteristics
    is_pdf = filename.lower().endswith('.pdf')
    is_image = any(filename.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.heic'])

    # Base confidence - PDFs generally have cleaner text
    base_confidence = 0.85 if is_pdf else 0.72

    # Simulate extraction variability
    confidence_jitter = random.uniform(-0.15, 0.15)
    extraction_confidence = max(0.3, min(0.99, base_confidence + confidence_jitter))

    # Simulate blurry/rotated detection
    needs_vision_fallback = extraction_confidence < 0.6
    if needs_vision_fallback:
        # Vision API fallback improves confidence slightly
        extraction_confidence = min(0.99, extraction_confidence + random.uniform(0.05, 0.15))

    # Pick random document type
    doc_type = random.choice(DOC_TYPES)

    # Generate mock extracted data
    supplier = random.choice(SAMPLE_SUPPLIERS)
    num_items = random.randint(1, 5)
    items = random.sample(SAMPLE_LINE_ITEMS, min(num_items, len(SAMPLE_LINE_ITEMS)))

    line_items = []
    subtotal = 0.0
    for item in items:
        qty = random.randint(1, item["qty"])
        amount = qty * item["unit_price"]
        subtotal += amount
        line_items.append({
            "description": item["item"],
            "quantity": qty,
            "unit_price": item["unit_price"],
            "amount": round(amount, 2),
            "category": item["category"],
        })

    tax_rate = random.choice([0.05, 0.12, 0.18])
    tax_amount = round(subtotal * tax_rate, 2)
    total = round(subtotal + tax_amount, 2)

    # Extract document date with confidence
    doc_date_result = extract_document_date(extraction_confidence)

    # Determine currency
    currency = random.choice(["INR", "INR", "INR", "USD", "AED"])  # Weighted towards INR

    extracted_data = {
        "document_type": doc_type,
        "supplier_name": supplier["name"],
        "supplier_gst": supplier["gst_id"],
        "invoice_number": f"INV-{random.randint(10000, 99999)}",
        "document_date": doc_date_result["date"],
        "document_date_confidence": doc_date_result["confidence"],
        "line_items": line_items,
        "subtotal": round(subtotal, 2),
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total_amount": total,
        "currency": currency,
        "extraction_confidence": round(extraction_confidence, 3),
        "extraction_method": "vision_api_fallback" if needs_vision_fallback else "document_ai",
        "raw_text_snippet": f"Invoice from {supplier['name']}... Total: {currency} {total}",
    }

    return extracted_data


def extract_document_date(extraction_confidence: float) -> dict:
    """
    Extract business date from document.
    Rules:
    - If confidence < 0.5 → date is None (needs review)
    - If multiple dates detected → pick invoice/bill date
    - Returns date and confidence score
    """
    if extraction_confidence < 0.5:
        return {"date": None, "confidence": 0.0}

    # Generate a document date within last 30 days
    days_ago = random.randint(0, 30)
    doc_date = datetime.now(timezone.utc) - timedelta(days=days_ago)

    date_confidence = min(0.99, extraction_confidence + random.uniform(-0.1, 0.1))

    return {
        "date": doc_date.strftime("%Y-%m-%d"),
        "confidence": round(max(0.3, date_confidence), 3),
    }


def match_supplier(supplier_name: str, supplier_gst: Optional[str], existing_suppliers: list) -> dict:
    """
    Match extracted supplier against known suppliers.
    Priority: GST match > Name similarity > Historical mapping
    """
    # Try GST match first (highest confidence)
    if supplier_gst:
        for s in existing_suppliers:
            if s.get("gst_id") == supplier_gst:
                return {"matched_id": s["id"], "confidence": 0.98, "method": "gst_match"}

    # Try name similarity
    if supplier_name:
        name_lower = supplier_name.lower().strip()
        for s in existing_suppliers:
            existing_name = s.get("name", "").lower().strip()
            if name_lower == existing_name:
                return {"matched_id": s["id"], "confidence": 0.95, "method": "exact_name"}
            if name_lower in existing_name or existing_name in name_lower:
                return {"matched_id": s["id"], "confidence": 0.75, "method": "partial_name"}

    return {"matched_id": None, "confidence": 0.0, "method": "no_match"}


def calculate_exchange_rate(currency: str, date_str: str) -> dict:
    """
    Mock exchange rate lookup.
    In production: Replace with Cloud Scheduler job fetching real rates.
    """
    rates = {
        "INR": 1.0,
        "USD": 83.50 + random.uniform(-1, 1),
        "AED": 22.70 + random.uniform(-0.5, 0.5),
        "GBP": 106.20 + random.uniform(-2, 2),
        "EUR": 91.30 + random.uniform(-1.5, 1.5),
    }

    rate = rates.get(currency, 1.0)
    return {
        "original_currency": currency,
        "exchange_rate": round(rate, 4),
        "target_currency": "INR",
        "rate_timestamp": datetime.now(timezone.utc).isoformat(),
    }
