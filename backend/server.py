from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone
import jwt
import bcrypt
import base64
import json

from ai_pipeline import extract_document_data, match_supplier, calculate_exchange_rate
from document_processor import get_processor, ExtractionResult
from currency_engine import sync_daily_rates, get_rate_for_date, convert_to_inr, fetch_live_rates
from intelligence_engine import compute_daily_kpis, store_insights, get_insights, run_daily_intelligence
from export_engine import generate_excel_report, generate_csv_report
import hashlib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'fintech-platform-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 72

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


# --- Auth Helpers ---
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str, org_id: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "org_id": org_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# --- Pydantic Models ---
class LoginRequest(BaseModel):
    email: str
    password: str

class InviteRequest(BaseModel):
    email: str
    name: str
    role: str
    outlet_ids: List[str] = []

class DocumentUpdate(BaseModel):
    document_date: Optional[str] = None
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    status: Optional[str] = None
    document_type: Optional[str] = None


# --- AUTH ---
@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account deactivated")
    token = create_token(user["id"], user["role"], user["org_id"])
    return {
        "token": token,
        "user": {
            "id": user["id"], "email": user["email"], "name": user["name"],
            "role": user["role"], "org_id": user["org_id"], "outlet_ids": user.get("outlet_ids", []),
        }
    }

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    outlets = await db.outlets.find({"id": {"$in": user.get("outlet_ids", [])}}, {"_id": 0}).to_list(100)
    return {
        "user": {
            "id": user["id"], "email": user["email"], "name": user["name"],
            "role": user["role"], "org_id": user["org_id"], "outlet_ids": user.get("outlet_ids", []),
        },
        "organization": org,
        "outlets": outlets,
    }


# --- USERS / INVITES ---
@api_router.post("/users/invite")
async def invite_user(req: InviteRequest, user=Depends(get_current_user)):
    if user["role"] not in ["owner", "accounts"]:
        raise HTTPException(status_code=403, detail="Only owners and accounts can invite users")
    if req.role == "owner":
        owner_count = await db.users.count_documents({"org_id": user["org_id"], "role": "owner"})
        if owner_count >= 4:
            raise HTTPException(status_code=400, detail="Maximum 4 owners per organization")
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    new_user = {
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "email": req.email,
        "name": req.name,
        "role": req.role,
        "outlet_ids": req.outlet_ids if req.outlet_ids else user.get("outlet_ids", []),
        "password_hash": hash_password("welcome123"),
        "is_active": True,
        "invited_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(new_user)
    return {"message": "User invited", "id": new_user["id"], "temp_password": "welcome123"}

@api_router.get("/users")
async def list_users(user=Depends(get_current_user)):
    if user["role"] not in ["owner", "accounts"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    users = await db.users.find({"org_id": user["org_id"]}, {"_id": 0, "password_hash": 0}).to_list(100)
    return {"users": users}


# --- ORGANIZATIONS ---
@api_router.get("/organizations/me")
async def get_my_org(user=Depends(get_current_user)):
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    return org or {}


# --- OUTLETS ---
@api_router.get("/outlets")
async def list_outlets(user=Depends(get_current_user)):
    if user["role"] in ["owner", "accounts"]:
        outlets = await db.outlets.find({"org_id": user["org_id"]}, {"_id": 0}).to_list(100)
    else:
        outlets = await db.outlets.find({"id": {"$in": user.get("outlet_ids", [])}}, {"_id": 0}).to_list(100)
    return {"outlets": outlets}


# --- DOCUMENT UPLOAD (Phase 3: Pluggable AI Processor) ---
@api_router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    outlet_id: str = Form(...),
    file_hash: Optional[str] = Form(None),
    user=Depends(get_current_user)
):
    # Validate outlet access
    if user["role"] not in ["owner", "accounts"] and outlet_id not in user.get("outlet_ids", []):
        raise HTTPException(status_code=403, detail="No access to this outlet")

    # Read file
    content = await file.read()
    file_size = len(content)
    filename = file.filename or "unknown.jpg"
    mime_type = file.content_type or "image/jpeg"

    # Duplicate protection via content hash
    content_hash = file_hash or hashlib.sha256(content).hexdigest()
    existing_dup = await db.documents.find_one(
        {"org_id": user["org_id"], "content_hash": content_hash, "outlet_id": outlet_id},
        {"_id": 0, "id": 1}
    )
    if existing_dup:
        return {"message": "Duplicate detected", "duplicate": True, "existing_id": existing_dup["id"]}

    # Save file locally (simulating Firebase Storage)
    doc_id = str(uuid.uuid4())
    file_ext = Path(filename).suffix or ".jpg"
    save_dir = UPLOAD_DIR / user["org_id"] / outlet_id
    save_dir.mkdir(parents=True, exist_ok=True)
    save_path = save_dir / f"{doc_id}{file_ext}"
    with open(save_path, "wb") as f:
        f.write(content)

    # AI Pipeline - Use pluggable processor
    processor = get_processor()
    try:
        result = await processor.extract(content, filename, mime_type)
    except Exception as e:
        logger.error(f"AI extraction failed, falling back to mock: {e}")
        from document_processor import MockProcessor
        result = await MockProcessor().extract(content, filename, mime_type)

    # Extract fields from result
    doc_date = result.document_date
    date_confidence = result.document_date_confidence
    confidence = result.extraction_confidence
    requires_review = date_confidence < 0.6 or doc_date is None or confidence < 0.6

    # Supplier matching
    existing_suppliers = await db.suppliers.find({"org_id": user["org_id"]}, {"_id": 0}).to_list(100)
    supplier_match = match_supplier(result.supplier_name, result.supplier_gst, existing_suppliers)

    # Exchange rate using currency engine
    currency = result.currency or "INR"
    rate_date = doc_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rate_info = await convert_to_inr(db, result.total_amount, currency, rate_date)

    # Storage path by document date
    if doc_date:
        parts = doc_date.split("-")
        storage_path = f"/{user['org_id']}/{outlet_id}/{parts[0]}/{parts[1]}/{parts[2]}/{doc_id}{file_ext}"
    else:
        storage_path = f"/{user['org_id']}/{outlet_id}/unclassified/{doc_id}{file_ext}"

    file_base64 = base64.b64encode(content).decode('utf-8') if file_size < 2_000_000 else None

    document = {
        "id": doc_id,
        "org_id": user["org_id"],
        "outlet_id": outlet_id,
        "document_type": result.document_type,
        "document_date": doc_date,
        "upload_timestamp": datetime.now(timezone.utc).isoformat(),
        "processing_timestamp": datetime.now(timezone.utc).isoformat(),
        "extraction_confidence": confidence,
        "requires_review": requires_review,
        "status": "needs_review" if requires_review else "processed",
        "supplier_id": supplier_match.get("matched_id"),
        "supplier_name": result.supplier_name or "Unknown",
        "supplier_match_confidence": supplier_match.get("confidence", 0),
        "file_path": storage_path,
        "original_filename": filename,
        "file_size": file_size,
        "file_base64": file_base64,
        "content_hash": content_hash,
        "uploader_id": user["id"],
        "uploader_name": user["name"],
        "ai_provider_used": result.ai_provider_used,
        "extraction_method": result.extraction_method,
        "raw_ocr_text": result.raw_ocr_text[:3000] if result.raw_ocr_text else "",
        "extracted_data": {
            "total_amount": result.total_amount,
            "tax_amount": result.tax_amount,
            "subtotal": result.subtotal,
            "currency": currency,
            "invoice_number": result.invoice_number,
            "line_items": result.line_items,
        },
        "exchange_rate": rate_info["exchange_rate_used"],
        "original_currency": currency,
        "converted_inr_amount": rate_info["converted_inr_amount"],
        "rate_timestamp": rate_info["rate_timestamp"],
        "rate_source": rate_info["rate_source"],
        "version_number": 1,
    }
    await db.documents.insert_one(document)

    # Create low-confidence notification
    if requires_review:
        notif = {
            "id": str(uuid.uuid4()),
            "org_id": user["org_id"],
            "user_role": "accounts",
            "type": "low_confidence",
            "title": f"Low confidence: {filename}",
            "body": f"AI confidence {confidence*100:.0f}% for {result.supplier_name}. Review needed.",
            "severity": "warning",
            "color": "#fbbf24",
            "related_id": doc_id,
            "related_type": "document",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.notifications.insert_one(notif)

    document.pop("_id", None)
    document.pop("file_base64", None)

    return {
        "message": "Document uploaded and processed",
        "document": document,
        "duplicate": False,
        "ai_summary": {
            "confidence": confidence,
            "method": result.extraction_method,
            "provider": result.ai_provider_used,
            "requires_review": requires_review,
            "supplier_matched": supplier_match.get("matched_id") is not None,
            "retries_used": result.retries_used,
        }
    }


# --- DOCUMENTS ---
@api_router.get("/documents")
async def list_documents(
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    document_type: Optional[str] = None,
    supplier_name: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    user=Depends(get_current_user)
):
    query = {"org_id": user["org_id"]}

    # Role-based filtering
    if user["role"] not in ["owner", "accounts"]:
        query["outlet_id"] = {"$in": user.get("outlet_ids", [])}

    if outlet_id:
        query["outlet_id"] = outlet_id
    if status:
        query["status"] = status
    if document_type:
        query["document_type"] = document_type
    if supplier_name:
        query["supplier_name"] = {"$regex": supplier_name, "$options": "i"}
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        query["document_date"] = date_filter
    if search:
        query["$or"] = [
            {"supplier_name": {"$regex": search, "$options": "i"}},
            {"original_filename": {"$regex": search, "$options": "i"}},
            {"document_type": {"$regex": search, "$options": "i"}},
        ]

    skip = (page - 1) * limit
    total = await db.documents.count_documents(query)
    docs = await db.documents.find(query, {"_id": 0, "file_base64": 0}).sort("document_date", -1).skip(skip).limit(limit).to_list(limit)

    return {"documents": docs, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@api_router.get("/documents/review-queue")
async def review_queue(user=Depends(get_current_user)):
    if user["role"] not in ["owner", "accounts"]:
        raise HTTPException(status_code=403, detail="Only owners and accounts can access review queue")
    query = {"org_id": user["org_id"], "status": "needs_review"}
    docs = await db.documents.find(query, {"_id": 0, "file_base64": 0}).sort("upload_timestamp", -1).to_list(100)
    return {"documents": docs, "count": len(docs)}


@api_router.get("/documents/{doc_id}")
async def get_document(doc_id: str, user=Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id, "org_id": user["org_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@api_router.put("/documents/{doc_id}")
async def update_document(doc_id: str, update: DocumentUpdate, user=Depends(get_current_user)):
    """Update document with version history (immutable financial records)."""
    if user["role"] not in ["owner", "accounts"]:
        raise HTTPException(status_code=403, detail="Not authorized to update documents")

    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Get current document for version snapshot
    current = await db.documents.find_one({"id": doc_id, "org_id": user["org_id"]}, {"_id": 0, "file_base64": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Document not found")

    # Create version snapshot (immutable record)
    version_num = current.get("version_number", 1)
    version_entry = {
        "id": str(uuid.uuid4()),
        "document_id": doc_id,
        "org_id": user["org_id"],
        "version": version_num,
        "snapshot": {k: v for k, v in current.items() if k not in ["file_base64", "raw_ocr_text"]},
        "changed_fields": list(update_dict.keys()),
        "change_reason": update_dict.pop("change_reason", "Manual correction"),
        "changed_by": user["id"],
        "changed_by_name": user["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.document_versions.insert_one(version_entry)

    # Update document
    if "status" in update_dict and update_dict["status"] == "processed":
        update_dict["requires_review"] = False
    update_dict["version_number"] = version_num + 1

    await db.documents.update_one(
        {"id": doc_id, "org_id": user["org_id"]},
        {"$set": update_dict}
    )
    updated = await db.documents.find_one({"id": doc_id}, {"_id": 0, "file_base64": 0})
    return updated


# --- SUPPLIERS ---
@api_router.get("/suppliers")
async def list_suppliers(user=Depends(get_current_user)):
    suppliers = await db.suppliers.find({"org_id": user["org_id"]}, {"_id": 0}).to_list(200)

    # Enrich with document counts and total spend
    for s in suppliers:
        doc_stats = await db.documents.aggregate([
            {"$match": {"org_id": user["org_id"], "supplier_id": s["id"], "status": "processed"}},
            {"$group": {
                "_id": None,
                "total_spend": {"$sum": "$converted_inr_amount"},
                "doc_count": {"$sum": 1},
                "avg_amount": {"$avg": "$converted_inr_amount"},
                "last_date": {"$max": "$document_date"},
            }}
        ]).to_list(1)
        stats = doc_stats[0] if doc_stats else {}
        s["total_spend"] = round(stats.get("total_spend", 0), 2)
        s["document_count"] = stats.get("doc_count", 0)
        s["avg_invoice"] = round(stats.get("avg_amount", 0), 2)
        s["last_document_date"] = stats.get("last_date")

    return {"suppliers": suppliers}


@api_router.get("/suppliers/{supplier_id}")
async def get_supplier(supplier_id: str, user=Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": supplier_id, "org_id": user["org_id"]}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Get stats
    doc_stats = await db.documents.aggregate([
        {"$match": {"org_id": user["org_id"], "supplier_id": supplier_id, "status": "processed"}},
        {"$group": {
            "_id": None,
            "total_spend": {"$sum": "$converted_inr_amount"},
            "doc_count": {"$sum": 1},
            "avg_amount": {"$avg": "$converted_inr_amount"},
        }}
    ]).to_list(1)
    stats = doc_stats[0] if doc_stats else {}
    supplier["total_spend"] = round(stats.get("total_spend", 0), 2)
    supplier["document_count"] = stats.get("doc_count", 0)
    supplier["avg_invoice"] = round(stats.get("avg_amount", 0), 2)

    # Monthly spend trend (last 6 months)
    monthly = await db.documents.aggregate([
        {"$match": {"org_id": user["org_id"], "supplier_id": supplier_id, "status": "processed"}},
        {"$group": {
            "_id": {"$substr": ["$document_date", 0, 7]},
            "spend": {"$sum": "$converted_inr_amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": -1}},
        {"$limit": 6},
    ]).to_list(6)
    supplier["monthly_trend"] = [{"month": m["_id"], "spend": round(m["spend"], 2), "count": m["count"]} for m in monthly]

    return supplier


@api_router.get("/suppliers/{supplier_id}/documents")
async def get_supplier_documents(supplier_id: str, page: int = 1, limit: int = 20, user=Depends(get_current_user)):
    query = {"org_id": user["org_id"], "supplier_id": supplier_id}
    total = await db.documents.count_documents(query)
    skip = (page - 1) * limit
    docs = await db.documents.find(query, {"_id": 0, "file_base64": 0}).sort("document_date", -1).skip(skip).limit(limit).to_list(limit)
    return {"documents": docs, "total": total, "page": page}


# --- Supplier Validation Helpers ---
def validate_indian_gst(gst_id: str) -> dict:
    """Validate Indian GST number format and structure."""
    import re
    if not gst_id:
        return {"valid": False, "error": "GST number required", "formatted": ""}
    
    gst_id = gst_id.strip().upper()
    
    # Indian GSTIN format: 2 digits state code + 10 char PAN + 1 entity code + Z + 1 check digit
    # Example: 27AABCU9603R1ZM
    pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$'
    
    if not re.match(pattern, gst_id):
        return {"valid": False, "error": "Invalid GST format. Expected: 27AABCU9603R1ZM", "formatted": gst_id}
    
    state_code = int(gst_id[:2])
    if state_code < 1 or state_code > 38:
        return {"valid": False, "error": f"Invalid state code: {state_code}", "formatted": gst_id}
    
    return {"valid": True, "error": None, "formatted": gst_id, "state_code": state_code}


def validate_international_tax_id(tax_id: str, country: str) -> dict:
    """Validate tax ID for international countries."""
    import re
    if not tax_id:
        return {"valid": True, "error": None, "formatted": ""}  # Optional for international
    
    tax_id = tax_id.strip().upper()
    
    # UAE TRN: 15 digits
    if country.lower() in ["uae", "united arab emirates"]:
        if re.match(r'^\d{15}$', tax_id):
            return {"valid": True, "error": None, "formatted": tax_id}
        return {"valid": False, "error": "UAE TRN must be 15 digits", "formatted": tax_id}
    
    # Singapore GST: 10 characters
    if country.lower() in ["singapore", "sg"]:
        if re.match(r'^[A-Z0-9]{10}$', tax_id):
            return {"valid": True, "error": None, "formatted": tax_id}
        return {"valid": False, "error": "Singapore GST must be 10 alphanumeric characters", "formatted": tax_id}
    
    # Generic: accept any non-empty string
    return {"valid": True, "error": None, "formatted": tax_id}


def fuzzy_name_match(name1: str, name2: str, threshold: float = 0.75) -> float:
    """Simple fuzzy matching for supplier names."""
    if not name1 or not name2:
        return 0.0
    
    # Normalize
    n1 = name1.lower().strip()
    n2 = name2.lower().strip()
    
    if n1 == n2:
        return 1.0
    
    # Simple word overlap matching
    words1 = set(n1.split())
    words2 = set(n2.split())
    
    if not words1 or not words2:
        return 0.0
    
    intersection = words1 & words2
    union = words1 | words2
    
    jaccard = len(intersection) / len(union)
    return jaccard


@api_router.post("/suppliers")
async def create_supplier(
    name: str = Form(...),
    gst_id: str = Form(""),
    category: str = Form("General"),
    outlet_id: str = Form(None),
    country: str = Form("India"),
    user=Depends(get_current_user)
):
    """Create supplier with validation, duplicate detection, and fuzzy name warnings."""
    if user["role"] not in ["owner", "accounts"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    name = name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Supplier name must be at least 2 characters")
    
    # Validate GST/Tax ID based on country
    validation_result = None
    if country.lower() == "india":
        if gst_id:
            validation_result = validate_indian_gst(gst_id)
            if not validation_result["valid"]:
                raise HTTPException(status_code=400, detail=validation_result["error"])
            gst_id = validation_result["formatted"]
    else:
        if gst_id:
            validation_result = validate_international_tax_id(gst_id, country)
            if not validation_result["valid"]:
                raise HTTPException(status_code=400, detail=validation_result["error"])
            gst_id = validation_result["formatted"]
    
    # Check for exact GST duplicate (if GST provided)
    if gst_id:
        existing_gst = await db.suppliers.find_one(
            {"org_id": user["org_id"], "gst_id": gst_id},
            {"_id": 0, "id": 1, "name": 1}
        )
        if existing_gst:
            raise HTTPException(
                status_code=400,
                detail=f"GST/Tax ID already exists for supplier: {existing_gst['name']}"
            )
    
    # Check for fuzzy name duplicates
    existing_suppliers = await db.suppliers.find(
        {"org_id": user["org_id"]},
        {"_id": 0, "id": 1, "name": 1, "gst_id": 1}
    ).to_list(500)
    
    warnings = []
    for s in existing_suppliers:
        similarity = fuzzy_name_match(name, s["name"])
        if similarity >= 0.75:
            warnings.append({
                "type": "similar_name",
                "existing_id": s["id"],
                "existing_name": s["name"],
                "existing_gst": s.get("gst_id", ""),
                "similarity": round(similarity * 100, 1),
                "message": f"Similar to existing supplier: {s['name']} ({round(similarity * 100)}% match)"
            })
    
    supplier = {
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "name": name,
        "gst_id": gst_id,
        "category": category,
        "country": country,
        "outlet_id": outlet_id,  # Optional: for outlet-specific suppliers
        "is_verified": bool(gst_id and validation_result and validation_result.get("valid")),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"],
    }
    await db.suppliers.insert_one(supplier)
    supplier.pop("_id", None)
    
    return {
        "supplier": supplier,
        "warnings": warnings,
        "validation": validation_result,
    }


@api_router.put("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: str,
    name: str = Form(None),
    gst_id: str = Form(None),
    category: str = Form(None),
    country: str = Form(None),
    is_verified: bool = Form(None),
    user=Depends(get_current_user)
):
    """Update supplier with validation."""
    if user["role"] not in ["owner", "accounts"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    supplier = await db.suppliers.find_one(
        {"id": supplier_id, "org_id": user["org_id"]}, {"_id": 0}
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    update_dict = {}
    warnings = []
    
    if name is not None:
        name = name.strip()
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Supplier name must be at least 2 characters")
        update_dict["name"] = name
        
        # Check for fuzzy duplicates
        existing_suppliers = await db.suppliers.find(
            {"org_id": user["org_id"], "id": {"$ne": supplier_id}},
            {"_id": 0, "id": 1, "name": 1}
        ).to_list(500)
        for s in existing_suppliers:
            similarity = fuzzy_name_match(name, s["name"])
            if similarity >= 0.75:
                warnings.append({
                    "type": "similar_name",
                    "existing_name": s["name"],
                    "similarity": round(similarity * 100, 1),
                })
    
    if gst_id is not None:
        current_country = country or supplier.get("country", "India")
        if current_country.lower() == "india":
            if gst_id:
                validation = validate_indian_gst(gst_id)
                if not validation["valid"]:
                    raise HTTPException(status_code=400, detail=validation["error"])
                gst_id = validation["formatted"]
        else:
            if gst_id:
                validation = validate_international_tax_id(gst_id, current_country)
                if not validation["valid"]:
                    raise HTTPException(status_code=400, detail=validation["error"])
                gst_id = validation["formatted"]
        
        # Check for duplicate GST
        if gst_id:
            existing_gst = await db.suppliers.find_one(
                {"org_id": user["org_id"], "gst_id": gst_id, "id": {"$ne": supplier_id}},
                {"_id": 0, "name": 1}
            )
            if existing_gst:
                raise HTTPException(
                    status_code=400,
                    detail=f"GST/Tax ID already exists for: {existing_gst['name']}"
                )
        
        update_dict["gst_id"] = gst_id
    
    if category is not None:
        update_dict["category"] = category
    if country is not None:
        update_dict["country"] = country
    if is_verified is not None:
        update_dict["is_verified"] = is_verified
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.suppliers.update_one(
        {"id": supplier_id, "org_id": user["org_id"]},
        {"$set": update_dict}
    )
    
    updated = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    return {"supplier": updated, "warnings": warnings}


@api_router.post("/suppliers/validate-gst")
async def validate_gst_endpoint(gst_id: str = Form(...), country: str = Form("India"), user=Depends(get_current_user)):
    """Validate a GST/Tax ID without creating a supplier."""
    if country.lower() == "india":
        result = validate_indian_gst(gst_id)
    else:
        result = validate_international_tax_id(gst_id, country)
    
    # Check for existing supplier with this GST
    if result["formatted"]:
        existing = await db.suppliers.find_one(
            {"org_id": user["org_id"], "gst_id": result["formatted"]},
            {"_id": 0, "id": 1, "name": 1}
        )
        if existing:
            result["existing_supplier"] = existing
    
    return result


@api_router.post("/suppliers/check-duplicate")
async def check_supplier_duplicate(name: str = Form(...), user=Depends(get_current_user)):
    """Check for potential duplicate suppliers by name."""
    name = name.strip()
    existing_suppliers = await db.suppliers.find(
        {"org_id": user["org_id"]},
        {"_id": 0, "id": 1, "name": 1, "gst_id": 1, "category": 1}
    ).to_list(500)
    
    matches = []
    for s in existing_suppliers:
        similarity = fuzzy_name_match(name, s["name"])
        if similarity >= 0.5:  # Lower threshold for checking
            matches.append({
                **s,
                "similarity": round(similarity * 100, 1),
            })
    
    matches.sort(key=lambda x: x["similarity"], reverse=True)
    return {"potential_duplicates": matches[:10]}


# --- OUTLETS MANAGEMENT ---
@api_router.get("/outlets/{outlet_id}")
async def get_outlet_detail(outlet_id: str, user=Depends(get_current_user)):
    if user["role"] not in ["owner", "accounts"] and outlet_id not in user.get("outlet_ids", []):
        raise HTTPException(status_code=403, detail="No access")
    outlet = await db.outlets.find_one({"id": outlet_id}, {"_id": 0})
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")

    # Stats
    doc_count = await db.documents.count_documents({"outlet_id": outlet_id})
    review_count = await db.documents.count_documents({"outlet_id": outlet_id, "status": "needs_review"})
    supplier_ids = await db.documents.distinct("supplier_id", {"outlet_id": outlet_id})

    # Recent metrics
    from datetime import timedelta
    date_from = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    metrics = await db.daily_metrics.find(
        {"outlet_id": outlet_id, "document_date": {"$gte": date_from}}, {"_id": 0}
    ).to_list(100)
    total_rev = sum(m.get("revenue", 0) for m in metrics)
    total_fc = sum(m.get("food_cost", 0) for m in metrics)

    outlet["stats"] = {
        "total_documents": doc_count,
        "needs_review": review_count,
        "active_suppliers": len([s for s in supplier_ids if s]),
        "monthly_revenue": round(total_rev, 2),
        "monthly_food_cost_pct": round(total_fc / total_rev * 100, 1) if total_rev > 0 else 0,
    }
    return outlet


class OutletConfigUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    country_mode: Optional[str] = None  # "india" or "international"
    gst_enabled: Optional[bool] = None
    gst_rate: Optional[float] = None
    required_daily_reports: Optional[List[str]] = None
    business_hours_start: Optional[str] = None
    business_hours_end: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None


# Country configuration defaults
COUNTRY_CONFIGS = {
    "india": {
        "currency": "INR",
        "timezone": "Asia/Kolkata",
        "gst_enabled": True,
        "gst_rate": 0.18,
        "required_daily_reports": ["sales_receipt", "purchase_invoice"],
    },
    "uae": {
        "currency": "AED",
        "timezone": "Asia/Dubai",
        "gst_enabled": True,
        "gst_rate": 0.05,
        "required_daily_reports": ["sales_receipt", "purchase_invoice"],
    },
    "singapore": {
        "currency": "SGD",
        "timezone": "Asia/Singapore",
        "gst_enabled": True,
        "gst_rate": 0.08,
        "required_daily_reports": ["sales_receipt", "purchase_invoice"],
    },
    "usa": {
        "currency": "USD",
        "timezone": "America/New_York",
        "gst_enabled": False,
        "gst_rate": 0.0,
        "required_daily_reports": ["sales_receipt", "purchase_invoice", "expense_bill"],
    },
    "uk": {
        "currency": "GBP",
        "timezone": "Europe/London",
        "gst_enabled": True,
        "gst_rate": 0.20,
        "required_daily_reports": ["sales_receipt", "purchase_invoice"],
    },
}


@api_router.get("/outlets/{outlet_id}/config")
async def get_outlet_config(outlet_id: str, user=Depends(get_current_user)):
    """Get full outlet configuration including regional settings."""
    if user["role"] not in ["owner", "accounts", "manager"] and outlet_id not in user.get("outlet_ids", []):
        raise HTTPException(status_code=403, detail="No access to this outlet")
    
    outlet = await db.outlets.find_one({"id": outlet_id, "org_id": user["org_id"]}, {"_id": 0})
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    
    # Calculate stats
    doc_count = await db.documents.count_documents({"outlet_id": outlet_id})
    review_count = await db.documents.count_documents({"outlet_id": outlet_id, "status": "needs_review"})
    
    # Compute unique suppliers for this outlet
    supplier_ids = await db.documents.distinct("supplier_id", {"outlet_id": outlet_id, "supplier_id": {"$ne": None}})
    
    # Get recent month total spend
    from datetime import timedelta
    date_from = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    monthly_docs = await db.documents.find(
        {"outlet_id": outlet_id, "document_date": {"$gte": date_from}, "status": "processed"},
        {"_id": 0, "converted_inr_amount": 1}
    ).to_list(1000)
    monthly_spend = sum(d.get("converted_inr_amount", 0) for d in monthly_docs)
    
    # Determine country mode
    country = outlet.get("country", "India").lower()
    country_mode = "india" if country == "india" else "international"
    
    # Merge with defaults
    config_defaults = COUNTRY_CONFIGS.get(country.lower().replace(" ", "_"), COUNTRY_CONFIGS["india"])
    
    outlet_config = {
        **outlet,
        "country_mode": outlet.get("country_mode", country_mode),
        "timezone": outlet.get("timezone", config_defaults["timezone"]),
        "gst_enabled": outlet.get("gst_enabled", config_defaults["gst_enabled"]),
        "gst_rate": outlet.get("gst_rate", config_defaults["gst_rate"]),
        "required_daily_reports": outlet.get("required_daily_reports", config_defaults["required_daily_reports"]),
        "business_hours_start": outlet.get("business_hours_start", "09:00"),
        "business_hours_end": outlet.get("business_hours_end", "22:00"),
        "contact_phone": outlet.get("contact_phone", ""),
        "address": outlet.get("address", ""),
        "stats": {
            "total_documents": doc_count,
            "needs_review": review_count,
            "active_suppliers": len(supplier_ids),
            "monthly_spend": round(monthly_spend, 2),
        },
        "available_currencies": ["INR", "USD", "AED", "SGD", "GBP", "EUR", "SAR", "MYR", "THB", "CAD"],
        "available_timezones": ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "America/New_York", "Europe/London", "America/Los_Angeles"],
    }
    
    return outlet_config


@api_router.put("/outlets/{outlet_id}/config")
async def update_outlet_config(outlet_id: str, update: OutletConfigUpdate, user=Depends(get_current_user)):
    """Update outlet configuration with validation."""
    if user["role"] != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    
    outlet = await db.outlets.find_one({"id": outlet_id, "org_id": user["org_id"]}, {"_id": 0})
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Apply country mode defaults if changing country mode
    if "country_mode" in update_dict:
        mode = update_dict["country_mode"]
        if mode == "india":
            defaults = COUNTRY_CONFIGS["india"]
        else:
            # Use the existing country or default to UAE for international
            country = update_dict.get("country", outlet.get("country", "UAE")).lower().replace(" ", "_")
            defaults = COUNTRY_CONFIGS.get(country, COUNTRY_CONFIGS["uae"])
        
        # Apply defaults for unspecified fields
        if "currency" not in update_dict:
            update_dict["currency"] = defaults["currency"]
        if "timezone" not in update_dict:
            update_dict["timezone"] = defaults["timezone"]
        if "gst_enabled" not in update_dict:
            update_dict["gst_enabled"] = defaults["gst_enabled"]
        if "gst_rate" not in update_dict:
            update_dict["gst_rate"] = defaults["gst_rate"]
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.outlets.update_one(
        {"id": outlet_id, "org_id": user["org_id"]},
        {"$set": update_dict}
    )
    
    # Fetch updated outlet with full config
    return await get_outlet_config(outlet_id, user)


@api_router.put("/outlets/{outlet_id}")
async def update_outlet(outlet_id: str, update: OutletConfigUpdate, user=Depends(get_current_user)):
    """Update outlet (backward compatible alias for config update)."""
    return await update_outlet_config(outlet_id, update, user)


# --- DASHBOARD ---
@api_router.get("/dashboard/global")
async def global_dashboard(days: int = 30, user=Depends(get_current_user)):
    if user["role"] not in ["owner"]:
        raise HTTPException(status_code=403, detail="Owner access required")

    date_from = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    outlets = await db.outlets.find({"org_id": user["org_id"]}, {"_id": 0}).to_list(100)

    # Aggregate metrics by outlet
    outlet_metrics = []
    total_revenue = 0
    total_food_cost = 0
    total_expenses = 0
    total_profit = 0

    for outlet in outlets:
        metrics = await db.daily_metrics.find(
            {"outlet_id": outlet["id"], "document_date": {"$gte": date_from}},
            {"_id": 0}
        ).to_list(100)

        rev = sum(m.get("revenue", 0) for m in metrics)
        fc = sum(m.get("food_cost", 0) for m in metrics)
        exp = sum(m.get("other_expenses", 0) + m.get("labor_cost", 0) for m in metrics)
        profit = sum(m.get("profit_estimate", 0) for m in metrics)

        total_revenue += rev
        total_food_cost += fc
        total_expenses += exp
        total_profit += profit

        outlet_metrics.append({
            "outlet_id": outlet["id"],
            "outlet_name": outlet["name"],
            "city": outlet.get("city", ""),
            "revenue": round(rev, 2),
            "food_cost": round(fc, 2),
            "expenses": round(exp, 2),
            "profit": round(profit, 2),
            "food_cost_pct": round(fc / rev * 100, 1) if rev > 0 else 0,
            "days_with_data": len(metrics),
        })

    # Review queue count
    review_count = await db.documents.count_documents({"org_id": user["org_id"], "status": "needs_review"})

    # Recent documents count
    recent_docs = await db.documents.count_documents({
        "org_id": user["org_id"],
        "document_date": {"$gte": date_from}
    })

    # Expense breakdown by type
    expense_docs = await db.documents.find(
        {"org_id": user["org_id"], "document_date": {"$gte": date_from}, "status": "processed"},
        {"_id": 0, "document_type": 1, "converted_inr_amount": 1}
    ).to_list(1000)

    expense_by_type = {}
    for d in expense_docs:
        dt = d.get("document_type", "other")
        expense_by_type[dt] = expense_by_type.get(dt, 0) + d.get("converted_inr_amount", 0)

    # Daily revenue trend (last 7 days)
    daily_trend = []
    for i in range(7):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        day_metrics = await db.daily_metrics.find(
            {"org_id": user["org_id"], "document_date": day}, {"_id": 0}
        ).to_list(100)
        day_rev = sum(m.get("revenue", 0) for m in day_metrics)
        daily_trend.append({"date": day, "revenue": round(day_rev, 2)})

    return {
        "period_days": days,
        "total_revenue": round(total_revenue, 2),
        "total_food_cost": round(total_food_cost, 2),
        "total_expenses": round(total_expenses, 2),
        "total_profit": round(total_profit, 2),
        "food_cost_pct": round(total_food_cost / total_revenue * 100, 1) if total_revenue > 0 else 0,
        "outlet_metrics": outlet_metrics,
        "review_queue_count": review_count,
        "documents_processed": recent_docs,
        "expense_by_type": {k: round(v, 2) for k, v in expense_by_type.items()},
        "daily_trend": list(reversed(daily_trend)),
    }


@api_router.get("/dashboard/outlet/{outlet_id}")
async def outlet_dashboard(outlet_id: str, days: int = 30, user=Depends(get_current_user)):
    if user["role"] not in ["owner", "accounts"] and outlet_id not in user.get("outlet_ids", []):
        raise HTTPException(status_code=403, detail="No access to this outlet")

    outlet = await db.outlets.find_one({"id": outlet_id}, {"_id": 0})
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")

    date_from = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    metrics = await db.daily_metrics.find(
        {"outlet_id": outlet_id, "document_date": {"$gte": date_from}},
        {"_id": 0}
    ).sort("document_date", -1).to_list(100)

    total_rev = sum(m.get("revenue", 0) for m in metrics)
    total_fc = sum(m.get("food_cost", 0) for m in metrics)
    total_labor = sum(m.get("labor_cost", 0) for m in metrics)
    total_other = sum(m.get("other_expenses", 0) for m in metrics)
    total_profit = sum(m.get("profit_estimate", 0) for m in metrics)
    total_agg = sum(m.get("aggregator_revenue", 0) for m in metrics)
    total_dine = sum(m.get("dine_in_revenue", 0) for m in metrics)

    # Recent documents
    recent_docs = await db.documents.find(
        {"outlet_id": outlet_id, "document_date": {"$gte": date_from}},
        {"_id": 0, "file_base64": 0}
    ).sort("document_date", -1).limit(10).to_list(10)

    # Daily breakdown
    daily = []
    for m in metrics[:14]:
        daily.append({
            "date": m["document_date"],
            "revenue": m.get("revenue", 0),
            "food_cost": m.get("food_cost", 0),
            "profit": m.get("profit_estimate", 0),
            "orders": m.get("order_count", 0),
        })

    return {
        "outlet": outlet,
        "period_days": days,
        "total_revenue": round(total_rev, 2),
        "total_food_cost": round(total_fc, 2),
        "food_cost_pct": round(total_fc / total_rev * 100, 1) if total_rev > 0 else 0,
        "total_labor_cost": round(total_labor, 2),
        "total_other_expenses": round(total_other, 2),
        "total_profit": round(total_profit, 2),
        "aggregator_revenue": round(total_agg, 2),
        "dine_in_revenue": round(total_dine, 2),
        "aggregator_pct": round(total_agg / total_rev * 100, 1) if total_rev > 0 else 0,
        "avg_daily_revenue": round(total_rev / max(len(metrics), 1), 2),
        "order_count": sum(m.get("order_count", 0) for m in metrics),
        "daily_breakdown": daily,
        "recent_documents": recent_docs,
    }


# --- CALENDAR COMPLIANCE ---
@api_router.get("/calendar/{outlet_id}/{year}/{month}")
async def calendar_compliance(outlet_id: str, year: int, month: int, user=Depends(get_current_user)):
    if user["role"] not in ["owner", "accounts", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get required report types from org settings
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    required = (org or {}).get("settings", {}).get("required_daily_reports", ["sales_receipt", "purchase_invoice"])

    # Get all documents for this outlet in the month
    date_prefix = f"{year}-{month:02d}"
    docs = await db.documents.find(
        {"outlet_id": outlet_id, "document_date": {"$regex": f"^{date_prefix}"}},
        {"_id": 0, "document_date": 1, "document_type": 1, "status": 1}
    ).to_list(500)

    # Build day-by-day compliance
    import calendar
    num_days = calendar.monthrange(year, month)[1]
    days = []

    for day in range(1, num_days + 1):
        date_str = f"{year}-{month:02d}-{day:02d}"
        day_docs = [d for d in docs if d.get("document_date") == date_str]
        types_present = set(d.get("document_type") for d in day_docs)
        types_needed = set(required)

        if types_needed.issubset(types_present):
            status = "complete"
        elif types_present:
            status = "partial"
        else:
            # Future days are not missing
            day_date = datetime(year, month, day, tzinfo=timezone.utc)
            if day_date > datetime.now(timezone.utc):
                status = "future"
            else:
                status = "missing"

        days.append({
            "date": date_str,
            "day": day,
            "status": status,
            "documents_count": len(day_docs),
            "types_present": list(types_present),
            "types_missing": list(types_needed - types_present) if status != "future" else [],
        })

    return {
        "outlet_id": outlet_id,
        "year": year,
        "month": month,
        "days": days,
        "summary": {
            "complete": sum(1 for d in days if d["status"] == "complete"),
            "partial": sum(1 for d in days if d["status"] == "partial"),
            "missing": sum(1 for d in days if d["status"] == "missing"),
            "future": sum(1 for d in days if d["status"] == "future"),
        }
    }


# --- STATS ---
@api_router.get("/stats")
async def get_stats(user=Depends(get_current_user)):
    org_id = user["org_id"]
    total_docs = await db.documents.count_documents({"org_id": org_id})
    review_count = await db.documents.count_documents({"org_id": org_id, "status": "needs_review"})
    outlet_count = await db.outlets.count_documents({"org_id": org_id})
    supplier_count = await db.suppliers.count_documents({"org_id": org_id})
    user_count = await db.users.count_documents({"org_id": org_id})
    notif_count = await db.notifications.count_documents({"org_id": org_id, "is_read": False})

    return {
        "total_documents": total_docs,
        "needs_review": review_count,
        "outlets": outlet_count,
        "suppliers": supplier_count,
        "users": user_count,
        "unread_notifications": notif_count,
    }


# =============================================
# PHASE 2: MULTI-CURRENCY ENGINE
# =============================================

@api_router.post("/currency/sync")
async def sync_exchange_rates(user=Depends(get_current_user)):
    """Manually trigger exchange rate sync (simulates Cloud Scheduler)."""
    if user["role"] != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    result = await sync_daily_rates(db)
    return {"message": "Exchange rates synced", "snapshot": result}

@api_router.get("/currency/rates")
async def get_current_rates(user=Depends(get_current_user)):
    """Get current exchange rates."""
    rates = await fetch_live_rates("USD")
    return rates

@api_router.get("/currency/rates/{date_str}")
async def get_historical_rate(date_str: str, currency: str = "USD", user=Depends(get_current_user)):
    """Get exchange rate for a specific date (document_date based)."""
    rate_info = await get_rate_for_date(db, currency, date_str)
    return rate_info

@api_router.get("/currency/history")
async def get_rate_history(days: int = 30, user=Depends(get_current_user)):
    """Get historical rate snapshots."""
    date_from = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    snapshots = await db.exchange_rates.find(
        {"date": {"$gte": date_from}}, {"_id": 0}
    ).sort("date", -1).to_list(days)
    return {"snapshots": snapshots, "count": len(snapshots)}

@api_router.post("/currency/convert")
async def convert_currency(
    amount: float = Query(...), currency: str = Query(...),
    date_str: str = Query(...), user=Depends(get_current_user)
):
    """Convert an amount to INR using document_date rate."""
    result = await convert_to_inr(db, amount, currency, date_str)
    return result


# =============================================
# PHASE 2: INTELLIGENCE ENGINE
# =============================================

@api_router.get("/insights")
async def list_insights(days: int = 7, severity: str = None, user=Depends(get_current_user)):
    """Get AI-generated insight cards."""
    if user["role"] not in ["owner"]:
        raise HTTPException(status_code=403, detail="Owner access required")
    insights = await get_insights(db, user["org_id"], days, severity)
    return {"insights": insights, "count": len(insights)}

@api_router.post("/insights/generate")
async def generate_insights(date_str: str = None, user=Depends(get_current_user)):
    """Manually trigger intelligence engine (simulates Cloud Scheduler)."""
    if user["role"] != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    result = await run_daily_intelligence(db, user["org_id"])
    return {"message": "Intelligence pipeline complete", **result}

@api_router.put("/insights/{insight_id}/read")
async def mark_insight_read(insight_id: str, user=Depends(get_current_user)):
    """Mark an insight card as read."""
    await db.insights.update_one(
        {"id": insight_id, "org_id": user["org_id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Marked as read"}


# =============================================
# PHASE 2: NOTIFICATIONS
# =============================================

@api_router.get("/notifications")
async def list_notifications(
    unread_only: bool = False, limit: int = 50,
    user=Depends(get_current_user)
):
    """Get notifications for current user."""
    query = {"org_id": user["org_id"]}
    # Filter by role scope
    if user["role"] not in ["owner"]:
        query["$or"] = [
            {"user_role": user["role"]},
            {"user_role": "all"},
            {"user_id": user["id"]},
        ]
    if unread_only:
        query["is_read"] = False
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    unread_count = await db.notifications.count_documents({**query, "is_read": False})
    return {"notifications": notifications, "unread_count": unread_count}

@api_router.put("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user=Depends(get_current_user)):
    """Mark a notification as read."""
    await db.notifications.update_one(
        {"id": notif_id, "org_id": user["org_id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    """Mark all notifications as read."""
    await db.notifications.update_many(
        {"org_id": user["org_id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

@api_router.post("/notifications/trigger-check")
async def trigger_notification_check(user=Depends(get_current_user)):
    """Trigger missing report check (simulates Cloud Scheduler)."""
    if user["role"] != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    org_id = user["org_id"]
    outlets = await db.outlets.find({"org_id": org_id}, {"_id": 0}).to_list(100)
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    required_types = (org or {}).get("settings", {}).get("required_daily_reports", ["sales_receipt", "purchase_invoice"])

    notifications_created = 0
    for outlet in outlets:
        docs = await db.documents.find(
            {"outlet_id": outlet["id"], "document_date": today},
            {"_id": 0, "document_type": 1}
        ).to_list(100)
        types_present = set(d.get("document_type") for d in docs)
        missing = set(required_types) - types_present

        if missing:
            notif = {
                "id": str(uuid.uuid4()),
                "org_id": org_id,
                "user_role": "owner",
                "type": "missing_report",
                "title": f"Missing reports: {outlet['name']}",
                "body": f"Missing {', '.join(missing)} for {today}",
                "severity": "warning",
                "color": "#fbbf24",
                "related_id": outlet["id"],
                "related_type": "outlet",
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.notifications.insert_one(notif)
            notifications_created += 1

    return {"message": f"Check complete. {notifications_created} notifications created."}


# --- Notification Preferences ---
@api_router.get("/notifications/preferences")
async def get_notification_prefs(user=Depends(get_current_user)):
    """Get user notification preferences."""
    prefs = await db.notification_preferences.find_one(
        {"user_id": user["id"]}, {"_id": 0}
    )
    if not prefs:
        prefs = {
            "user_id": user["id"],
            "missing_reports": True,
            "anomaly_alerts": True,
            "low_confidence": True,
            "weekly_summary": True,
            "push_enabled": True,
        }
    return prefs

@api_router.put("/notifications/preferences")
async def update_notification_prefs(prefs: dict, user=Depends(get_current_user)):
    """Update user notification preferences."""
    allowed = {"missing_reports", "anomaly_alerts", "low_confidence", "weekly_summary", "push_enabled"}
    update_dict = {k: v for k, v in prefs.items() if k in allowed}
    update_dict["user_id"] = user["id"]
    await db.notification_preferences.update_one(
        {"user_id": user["id"]},
        {"$set": update_dict},
        upsert=True
    )
    return {"message": "Preferences updated"}

# --- Document Processor Info ---
@api_router.get("/processor/info")
async def get_processor_info(user=Depends(get_current_user)):
    """Get current document processor configuration."""
    processor = get_processor()
    return {
        "active_processor": processor.name(),
        "available_processors": ["gpt4o", "document_ai", "mock"],
        "config": {
            "has_api_key": bool(os.environ.get("EMERGENT_LLM_KEY")),
            "processor_env": os.environ.get("DOCUMENT_PROCESSOR", "gpt4o"),
        }
    }


# =============================================
# PHASE 2: EXPORT / CA REPORTS
# =============================================

@api_router.get("/export/{report_type}")
async def export_report(
    report_type: str,
    format: str = Query("xlsx", regex="^(xlsx|csv)$"),
    outlet_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Export financial reports. Types: pnl, expense_ledger, gst_summary, multi_currency."""
    if user["role"] not in ["owner", "accounts"]:
        raise HTTPException(status_code=403, detail="Owner or accounts access required")

    if report_type not in ["pnl", "expense_ledger", "gst_summary", "multi_currency"]:
        raise HTTPException(status_code=400, detail="Invalid report type")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")

    if format == "csv":
        content = await generate_csv_report(db, user["org_id"], report_type, outlet_id, date_from, date_to)
        return StreamingResponse(
            io.StringIO(content),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={report_type}_{timestamp}.csv"}
        )
    else:
        content = await generate_excel_report(db, user["org_id"], report_type, outlet_id, date_from, date_to)
        return StreamingResponse(
            io.BytesIO(content),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={report_type}_{timestamp}.xlsx"}
        )


# =============================================
# PHASE 2: DOCUMENT VAULT ENHANCEMENTS
# =============================================

@api_router.post("/documents/bulk-action")
async def bulk_document_action(
    action: str = Form(...),
    document_ids: str = Form(...),
    user=Depends(get_current_user)
):
    """Bulk operations on documents: approve, delete, re-process."""
    if user["role"] not in ["owner", "accounts"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    ids = json.loads(document_ids)
    if not ids:
        raise HTTPException(status_code=400, detail="No document IDs provided")

    if action == "approve":
        result = await db.documents.update_many(
            {"id": {"$in": ids}, "org_id": user["org_id"]},
            {"$set": {"status": "processed", "requires_review": False}}
        )
        return {"message": f"Approved {result.modified_count} documents"}
    elif action == "delete":
        result = await db.documents.delete_many(
            {"id": {"$in": ids}, "org_id": user["org_id"]}
        )
        return {"message": f"Deleted {result.deleted_count} documents"}
    elif action == "flag_review":
        result = await db.documents.update_many(
            {"id": {"$in": ids}, "org_id": user["org_id"]},
            {"$set": {"status": "needs_review", "requires_review": True}}
        )
        return {"message": f"Flagged {result.modified_count} documents for review"}
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use: approve, delete, flag_review")

@api_router.get("/documents/{doc_id}/versions")
async def get_document_versions(doc_id: str, user=Depends(get_current_user)):
    """Get version history for a document."""
    versions = await db.document_versions.find(
        {"document_id": doc_id, "org_id": user["org_id"]},
        {"_id": 0}
    ).sort("version", -1).to_list(50)
    return {"versions": versions}


# --- Health ---
@api_router.get("/")
async def root():
    return {"message": "Financial Intelligence Platform API", "version": "2.0.0"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
