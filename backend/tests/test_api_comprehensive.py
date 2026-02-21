"""
Comprehensive API Testing for Financial Intelligence Platform
Tests: Auth, Users, Outlets, Documents, Upload, Suppliers, Dashboard, Calendar, Stats
"""
import pytest
import requests
import os

class TestHealthCheck:
    """Health check and root endpoint"""
    
    def test_api_root(self, api_client, base_url):
        print("\n=== Testing API Root ===")
        response = api_client.get(f"{base_url}/api/")
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        print(f"Response: {data}")
        assert "message" in data
        assert "version" in data
        print("✓ API root endpoint working")


class TestAuthentication:
    """Authentication endpoints - login, get me"""
    
    def test_login_owner_success(self, api_client, base_url):
        print("\n=== Testing Owner Login ===")
        response = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": "owner@spicekitchen.com", "password": "demo123"}
        )
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "owner@spicekitchen.com"
        assert data["user"]["role"] == "owner"
        print(f"✓ Owner login successful, role: {data['user']['role']}")
    
    def test_login_manager_success(self, api_client, base_url):
        print("\n=== Testing Manager Login ===")
        response = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": "manager@spicekitchen.com", "password": "demo123"}
        )
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "manager"
        print(f"✓ Manager login successful")
    
    def test_login_staff_success(self, api_client, base_url):
        print("\n=== Testing Staff Login ===")
        response = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": "staff@spicekitchen.com", "password": "demo123"}
        )
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "staff"
        print(f"✓ Staff login successful")
    
    def test_login_accounts_success(self, api_client, base_url):
        print("\n=== Testing Accounts Login ===")
        response = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": "accounts@spicekitchen.com", "password": "demo123"}
        )
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "accounts"
        print(f"✓ Accounts login successful")
    
    def test_login_invalid_credentials(self, api_client, base_url):
        print("\n=== Testing Invalid Login ===")
        response = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": "wrong@email.com", "password": "wrongpass"}
        )
        print(f"Status: {response.status_code}")
        assert response.status_code == 401
        print("✓ Invalid credentials rejected correctly")
    
    def test_get_me(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing /auth/me Endpoint ===")
        response = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "user" in data
        assert "organization" in data
        assert "outlets" in data
        assert data["user"]["email"] == "owner@spicekitchen.com"
        print(f"✓ Get me successful, org: {data['organization'].get('name', 'N/A')}")


class TestDashboardGlobal:
    """Global dashboard endpoint - owner only"""
    
    def test_global_dashboard_owner(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing Global Dashboard (Owner) ===")
        response = api_client.get(f"{base_url}/api/dashboard/global?days=30", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        # Verify all expected fields
        assert "total_revenue" in data
        assert "total_food_cost" in data
        assert "total_profit" in data
        assert "outlet_metrics" in data
        assert "review_queue_count" in data
        assert "documents_processed" in data
        assert "expense_by_type" in data
        assert "daily_trend" in data
        
        print(f"✓ Revenue: ₹{data['total_revenue']}, Outlets: {len(data['outlet_metrics'])}, Review Queue: {data['review_queue_count']}")
        assert isinstance(data["outlet_metrics"], list)
        assert data["total_revenue"] >= 0
    
    def test_global_dashboard_manager_forbidden(self, api_client, base_url, auth_headers_manager):
        print("\n=== Testing Global Dashboard Access (Manager - Should Fail) ===")
        response = api_client.get(f"{base_url}/api/dashboard/global", headers=auth_headers_manager)
        print(f"Status: {response.status_code}")
        assert response.status_code == 403
        print("✓ Manager correctly denied access to global dashboard")


class TestDashboardOutlet:
    """Outlet dashboard endpoint"""
    
    def test_outlet_dashboard_manager(self, api_client, base_url, auth_headers_manager):
        print("\n=== Testing Outlet Dashboard (Manager) ===")
        # Get manager's outlet first
        me_response = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers_manager)
        assert me_response.status_code == 200
        me_data = me_response.json()
        outlet_ids = me_data["user"]["outlet_ids"]
        
        if not outlet_ids:
            pytest.skip("Manager has no outlets assigned")
        
        outlet_id = outlet_ids[0]
        print(f"Testing outlet: {outlet_id}")
        
        response = api_client.get(f"{base_url}/api/dashboard/outlet/{outlet_id}?days=30", headers=auth_headers_manager)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "outlet" in data
        assert "total_revenue" in data
        assert "food_cost_pct" in data
        assert "daily_breakdown" in data
        assert "recent_documents" in data
        print(f"✓ Outlet revenue: ₹{data['total_revenue']}, Food cost: {data['food_cost_pct']}%")


class TestDocuments:
    """Document listing, get, review queue endpoints"""
    
    def test_list_documents(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing List Documents ===")
        response = api_client.get(f"{base_url}/api/documents?limit=20", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "documents" in data
        assert "total" in data
        assert "page" in data
        print(f"✓ Found {data['total']} total documents, showing {len(data['documents'])} on page {data['page']}")
        
        # Verify document structure
        if data["documents"]:
            doc = data["documents"][0]
            assert "id" in doc
            assert "supplier_name" in doc
            assert "document_type" in doc
            assert "status" in doc
            # Verify _id is not present
            assert "_id" not in doc
            print(f"✓ Document structure valid, no _id field present")
    
    def test_get_document_by_id(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing Get Document by ID ===")
        # First get a document list
        list_response = api_client.get(f"{base_url}/api/documents?limit=1", headers=auth_headers_owner)
        assert list_response.status_code == 200
        docs = list_response.json()["documents"]
        
        if not docs:
            pytest.skip("No documents available")
        
        doc_id = docs[0]["id"]
        print(f"Fetching document: {doc_id}")
        
        response = api_client.get(f"{base_url}/api/documents/{doc_id}", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == doc_id
        assert "supplier_name" in data
        assert "extracted_data" in data
        assert "_id" not in data
        print(f"✓ Document fetched: {data['supplier_name']}, Type: {data['document_type']}")
    
    def test_review_queue_owner(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing Review Queue (Owner) ===")
        response = api_client.get(f"{base_url}/api/documents/review-queue", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "documents" in data
        assert "count" in data
        print(f"✓ Review queue has {data['count']} documents")
        
        # Verify all documents need review
        for doc in data["documents"]:
            assert doc["status"] == "needs_review"
            assert "_id" not in doc
    
    def test_review_queue_staff_forbidden(self, api_client, base_url, auth_headers_staff):
        print("\n=== Testing Review Queue Access (Staff - Should Fail) ===")
        response = api_client.get(f"{base_url}/api/documents/review-queue", headers=auth_headers_staff)
        print(f"Status: {response.status_code}")
        assert response.status_code == 403
        print("✓ Staff correctly denied access to review queue")
    
    def test_update_document(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing Update Document ===")
        # Get a document to update
        list_response = api_client.get(f"{base_url}/api/documents?limit=1&status=needs_review", headers=auth_headers_owner)
        assert list_response.status_code == 200
        docs = list_response.json()["documents"]
        
        if not docs:
            print("⚠ No documents in needs_review status, skipping update test")
            pytest.skip("No documents need review")
        
        doc_id = docs[0]["id"]
        print(f"Updating document: {doc_id}")
        
        # Update status
        update_response = api_client.put(
            f"{base_url}/api/documents/{doc_id}",
            headers=auth_headers_owner,
            json={"status": "processed"}
        )
        print(f"Update status: {update_response.status_code}")
        assert update_response.status_code == 200
        
        updated_doc = update_response.json()
        assert updated_doc["status"] == "processed"
        assert updated_doc["requires_review"] == False
        
        # Verify persistence with GET
        get_response = api_client.get(f"{base_url}/api/documents/{doc_id}", headers=auth_headers_owner)
        assert get_response.status_code == 200
        verified_doc = get_response.json()
        assert verified_doc["status"] == "processed"
        print(f"✓ Document updated and verified: status={verified_doc['status']}")


class TestSuppliers:
    """Supplier listing endpoint"""
    
    def test_list_suppliers(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing List Suppliers ===")
        response = api_client.get(f"{base_url}/api/suppliers", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "suppliers" in data
        print(f"✓ Found {len(data['suppliers'])} suppliers")
        
        if data["suppliers"]:
            supplier = data["suppliers"][0]
            assert "id" in supplier
            assert "name" in supplier
            assert "_id" not in supplier
            print(f"✓ Supplier structure valid: {supplier['name']}")


class TestOutlets:
    """Outlet listing endpoint"""
    
    def test_list_outlets_owner(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing List Outlets (Owner) ===")
        response = api_client.get(f"{base_url}/api/outlets", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "outlets" in data
        print(f"✓ Owner sees {len(data['outlets'])} outlets")
        
        if data["outlets"]:
            outlet = data["outlets"][0]
            assert "id" in outlet
            assert "name" in outlet
            assert "city" in outlet
            assert "_id" not in outlet
            print(f"✓ Outlet: {outlet['name']}, {outlet['city']}")
    
    def test_list_outlets_manager_scoped(self, api_client, base_url, auth_headers_manager):
        print("\n=== Testing List Outlets (Manager - Scoped) ===")
        response = api_client.get(f"{base_url}/api/outlets", headers=auth_headers_manager)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "outlets" in data
        print(f"✓ Manager sees {len(data['outlets'])} outlet(s) (scoped to their access)")


class TestCalendar:
    """Calendar compliance endpoint"""
    
    def test_calendar_compliance(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing Calendar Compliance ===")
        # Get an outlet first
        outlets_response = api_client.get(f"{base_url}/api/outlets", headers=auth_headers_owner)
        assert outlets_response.status_code == 200
        outlets = outlets_response.json()["outlets"]
        
        if not outlets:
            pytest.skip("No outlets available")
        
        outlet_id = outlets[0]["id"]
        print(f"Testing calendar for outlet: {outlet_id}, month: 2026-02")
        
        response = api_client.get(f"{base_url}/api/calendar/{outlet_id}/2026/2", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "outlet_id" in data
        assert "year" in data
        assert "month" in data
        assert "days" in data
        assert "summary" in data
        
        assert data["year"] == 2026
        assert data["month"] == 2
        assert len(data["days"]) > 0
        
        print(f"✓ Calendar: {data['summary']['complete']} complete, {data['summary']['missing']} missing, {data['summary']['partial']} partial")


class TestStats:
    """Stats endpoint"""
    
    def test_stats(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing Stats Endpoint ===")
        response = api_client.get(f"{base_url}/api/stats", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_documents" in data
        assert "needs_review" in data
        assert "outlets" in data
        assert "suppliers" in data
        assert "users" in data
        
        print(f"✓ Stats - Docs: {data['total_documents']}, Review: {data['needs_review']}, Outlets: {data['outlets']}, Suppliers: {data['suppliers']}, Users: {data['users']}")
        assert data["total_documents"] >= 0
        assert data["outlets"] >= 0


class TestUsers:
    """User management endpoints"""
    
    def test_list_users_owner(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing List Users (Owner) ===")
        response = api_client.get(f"{base_url}/api/users", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "users" in data
        print(f"✓ Found {len(data['users'])} users")
        
        if data["users"]:
            user = data["users"][0]
            assert "id" in user
            assert "email" in user
            assert "role" in user
            # Verify password_hash is not returned
            assert "password_hash" not in user
            assert "_id" not in user
            print(f"✓ User structure valid, password_hash excluded")
    
    def test_list_users_staff_forbidden(self, api_client, base_url, auth_headers_staff):
        print("\n=== Testing List Users (Staff - Should Fail) ===")
        response = api_client.get(f"{base_url}/api/users", headers=auth_headers_staff)
        print(f"Status: {response.status_code}")
        assert response.status_code == 403
        print("✓ Staff correctly denied access to user list")


class TestOrganization:
    """Organization endpoint"""
    
    def test_get_organization(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing Get Organization ===")
        response = api_client.get(f"{base_url}/api/organizations/me", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        if data:
            assert "name" in data
            assert "id" in data
            assert "_id" not in data
            print(f"✓ Organization: {data.get('name', 'N/A')}")
        else:
            print("⚠ No organization data returned")
