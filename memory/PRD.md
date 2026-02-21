# FinSight - AI-Powered Financial Intelligence Platform

## Product Requirements Document (PRD)

### Overview
FinSight is a mobile-first AI-powered financial intelligence platform for multi-outlet businesses. It enables camera-first document upload, AI-powered data extraction with confidence scoring, and intelligent dashboards organized by document_date (business date).

### Architecture
- **Frontend**: Expo React Native (SDK 54) with file-based routing
- **Backend**: FastAPI with MongoDB (simulating Firebase Firestore pattern)
- **Auth**: JWT-based invite-only authentication (simulating Firebase Auth)
- **Storage**: Local file storage (simulating Firebase Storage)
- **AI Pipeline**: Pluggable mock layer ready for Google Document AI / Vision API

### User Roles
| Role | Access | Description |
|------|--------|-------------|
| Owner | Global | Full access, max 4 per org, intelligence dashboard |
| Manager | Outlet-scoped | Upload, outlet dashboard, review |
| Staff | Upload only | Ultra-simple camera-first interface |
| Accounts | Cross-outlet | Review queue, fix dates/suppliers, export |

### Demo Accounts (Password: demo123)
- Owner: owner@spicekitchen.com
- Manager: manager@spicekitchen.com
- Staff: staff@spicekitchen.com
- Accounts: accounts@spicekitchen.com

### Phase 1 Features (MVP - Implemented)
- [x] Organization & outlet structure
- [x] Invite-only user onboarding with role management
- [x] Role-based access control (RBAC)
- [x] Camera-first document upload (images + PDFs)
- [x] Ultra-simple staff upload experience
- [x] AI document processing pipeline with confidence scoring (MOCK)
- [x] document_date extraction (business date, not upload date)
- [x] Review queue for low-confidence extractions
- [x] Supplier auto-matching (basic - GST/name)
- [x] Global Dashboard (owner view)
- [x] Outlet Dashboard (manager view)
- [x] Calendar compliance based on document_date
- [x] Document vault with searchable metadata
- [x] Profile/settings with org & outlet info
- [x] Dark theme "Tactical Finance" design system

### Phase 2 Features (Implemented)
- [x] Multi-Currency Engine with live ExchangeRate-API (10 currencies, historical snapshots, document_date-based rates)
- [x] Owner Intelligence Engine (KPI computation, benchmark comparison, anomaly detection, color-coded insight cards)
- [x] In-app Notification Center (missing reports, anomaly alerts, read/unread, mark all read)
- [x] Export / CA Reports (P&L, Expense Ledger, GST Summary India, Multi-Currency — Excel and CSV)
- [x] Document Vault bulk operations (approve, delete, flag review)
- [x] Advanced Document Vault (currency badges, AI confidence %, long-press bulk select)

### Phase 3 Features (Implemented)
- [x] Pluggable Document Processor Adapter Pattern (GPT4oProcessor active, DocumentAI stub, MockProcessor)
- [x] Real GPT-4o document analysis via Emergent LLM key (OCR + structured extraction from images)
- [x] Offline Upload Queue (AsyncStorage persistence, exponential retry, duplicate protection via SHA256 content hash, network-aware sync)
- [x] Immutable Document Version History (version_number, changed_fields, changed_by, soft replacement only)
- [x] User Notification Preferences (5 toggles: missing reports, anomaly, low confidence, weekly summary, push)
- [x] Enhanced Upload Screen (GPT-4o badge, queue status indicators, retry controls)
- [x] Enhanced Document Detail (version badge, AI provider chip, version timeline, raw OCR text)
- [x] Enhanced Settings (AI processor info, notification preference toggles)

### Phase 4 Features (Implemented)
- [x] Outlet Configuration Screen (country mode, currency, timezone, GST settings, required reports)
- [x] Country Mode Toggle (India vs International with auto-configured defaults)
- [x] Multi-currency regional support (INR, AED, SGD, USD, GBP, EUR, etc.)
- [x] Timezone configuration per outlet
- [x] Required daily reports configuration (compliance calendar customization)
- [x] Business hours and contact info per outlet
- [x] Supplier Detail Screen (full supplier profile, document history, spend analytics)
- [x] GST/Tax ID Validation (Indian GST format validation, UAE TRN, Singapore GST)
- [x] Supplier Duplicate Detection (fuzzy name matching with warnings)
- [x] Supplier Category Management
- [x] Monthly spend trend visualization per supplier
- [x] Low-literacy friendly UI with strong validation feedback
- [x] Outlet-level data isolation (documents scoped to outlets)
- [x] document_date-based storage paths and reporting

### Future Enhancements (Planned)
- [ ] Real Google Document AI integration (stub ready)
- [ ] Real Firebase Cloud Messaging (FCM) push delivery
- [ ] BigQuery integration for advanced analytics
- [ ] Predictive analytics / forecasting
- [ ] Industry benchmarking comparison

### Critical Business Rule
All financial reporting, analytics, calendar compliance, and storage grouping MUST be based on `document_date` (business date extracted from document), NOT `upload_date` or `processing_date`.

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/auth/login | POST | User login |
| /api/auth/me | GET | Current user profile |
| /api/users/invite | POST | Invite new user |
| /api/users | GET | List org users |
| /api/outlets | GET | List outlets |
| /api/documents/upload | POST | Upload & process document |
| /api/documents | GET | List/search documents |
| /api/documents/review-queue | GET | Review queue |
| /api/documents/{id} | GET/PUT | Document detail/update |
| /api/suppliers | GET | List suppliers |
| /api/dashboard/global | GET | Owner global dashboard |
| /api/dashboard/outlet/{id} | GET | Manager outlet dashboard |
| /api/calendar/{outlet_id}/{year}/{month} | GET | Calendar compliance |
| /api/stats | GET | Quick stats |

### MOCKED Integrations
- AI Document extraction (Google Document AI) → generates realistic mock data
- Vision API OCR fallback → simulated in ai_pipeline.py
- Exchange rates → static rates with small jitter
- Firebase Auth → JWT with bcrypt
- Firestore → MongoDB (document DB)
- Firebase Storage → local file storage

### Tech Notes
- MongoDB indexes on: email (unique), org_id, outlet_id, document_date, status
- _id excluded from all API responses
- Password hash excluded from user listings
- All dates in ISO format with UTC timezone
- File uploads stored at /app/backend/uploads/
