"""
Phase 2 Features Testing: Multi-Currency, Intelligence Engine, Notifications, Export, Bulk Operations
Tests: Currency sync, Insights generation, Notifications, Export reports, Bulk document actions
"""
import pytest
import requests
import os
import time

class TestCurrencyEngine:
    """Multi-Currency Engine - Exchange rate sync and conversion"""
    
    def test_sync_exchange_rates(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing POST /api/currency/sync ===")
        response = api_client.post(f"{base_url}/api/currency/sync", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "snapshot" in data
        assert "date" in data["snapshot"]
        assert "rates" in data["snapshot"]
        assert "base" in data["snapshot"]
        
        # Verify rates have INR
        assert "INR" in data["snapshot"]["rates"]
        assert data["snapshot"]["base"] == "USD"
        print(f"✓ Synced rates for {data['snapshot']['date']}, {len(data['snapshot']['rates'])} currencies")
        print(f"  Sample rates: USD->INR = {data['snapshot']['rates'].get('INR', 'N/A')}")
    
    def test_get_current_rates(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing GET /api/currency/rates ===")
        response = api_client.get(f"{base_url}/api/currency/rates", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "base" in data
        assert "rates" in data
        assert isinstance(data["rates"], dict)
        
        # Check for supported currencies
        supported = ["USD", "INR", "AED", "GBP", "EUR"]
        for curr in supported:
            assert curr in data["rates"], f"{curr} not in rates"
        
        print(f"✓ Current rates fetched: {len(data['rates'])} currencies")
        print(f"  Rates: INR={data['rates']['INR']}, EUR={data['rates']['EUR']}, AED={data['rates']['AED']}")
    
    def test_get_rate_history(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing GET /api/currency/history ===")
        response = api_client.get(f"{base_url}/api/currency/history?days=7", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "snapshots" in data
        assert "count" in data
        assert isinstance(data["snapshots"], list)
        
        print(f"✓ Rate history: {data['count']} snapshots")
        if data["snapshots"]:
            latest = data["snapshots"][0]
            print(f"  Latest snapshot date: {latest.get('date', 'N/A')}")
    
    def test_currency_convert(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing POST /api/currency/convert ===")
        # First sync to ensure rates exist
        api_client.post(f"{base_url}/api/currency/sync", headers=auth_headers_owner)
        time.sleep(0.5)
        
        response = api_client.post(
            f"{base_url}/api/currency/convert?amount=100&currency=USD&date_str=2026-01-15",
            headers=auth_headers_owner
        )
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "original_amount" in data
        assert "original_currency" in data
        assert "exchange_rate_used" in data
        assert "converted_inr_amount" in data
        assert "rate_source" in data
        
        assert data["original_amount"] == 100
        assert data["original_currency"] == "USD"
        assert data["converted_inr_amount"] > 0
        
        print(f"✓ Conversion: {data['original_amount']} {data['original_currency']} = ₹{data['converted_inr_amount']}")
        print(f"  Rate used: {data['exchange_rate_used']}, Source: {data['rate_source']}")


class TestIntelligenceEngine:
    """Owner Intelligence Engine - KPI computation and insight cards"""
    
    def test_generate_insights(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing POST /api/insights/generate ===")
        response = api_client.post(f"{base_url}/api/insights/generate", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "insights_generated" in data
        assert "notifications_created" in data
        
        print(f"✓ Insights generated: {data['insights_generated']} insights, {data['notifications_created']} notifications")
    
    def test_get_insights(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing GET /api/insights ===")
        # First generate insights
        api_client.post(f"{base_url}/api/insights/generate", headers=auth_headers_owner)
        time.sleep(0.5)
        
        response = api_client.get(f"{base_url}/api/insights?days=7", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "insights" in data
        assert "count" in data
        assert isinstance(data["insights"], list)
        
        print(f"✓ Found {data['count']} insights")
        
        # Verify insight structure
        if data["insights"]:
            insight = data["insights"][0]
            assert "id" in insight
            assert "severity" in insight
            assert "title" in insight
            assert "description" in insight
            assert "color" in insight
            assert "metric_type" in insight
            assert "outlet_name" in insight
            assert "_id" not in insight
            
            print(f"  Sample: [{insight['severity']}] {insight['title']}")
            print(f"  Color: {insight['color']}, Metric: {insight['metric_type']}")
    
    def test_get_insights_by_severity(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing GET /api/insights?severity=critical ===")
        response = api_client.get(f"{base_url}/api/insights?days=7&severity=critical", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "insights" in data
        
        # All returned insights should be critical
        for insight in data["insights"]:
            assert insight["severity"] == "critical"
        
        print(f"✓ Critical insights: {len(data['insights'])} found")
    
    def test_mark_insight_read(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing PUT /api/insights/{id}/read ===")
        # Get insights first
        list_response = api_client.get(f"{base_url}/api/insights?days=7", headers=auth_headers_owner)
        assert list_response.status_code == 200
        insights = list_response.json()["insights"]
        
        if not insights:
            pytest.skip("No insights available")
        
        insight_id = insights[0]["id"]
        print(f"Marking insight {insight_id} as read")
        
        response = api_client.put(f"{base_url}/api/insights/{insight_id}/read", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✓ Insight marked as read")
    
    def test_insights_manager_forbidden(self, api_client, base_url, auth_headers_manager):
        print("\n=== Testing Insights Access (Manager - Should Fail) ===")
        response = api_client.get(f"{base_url}/api/insights", headers=auth_headers_manager)
        print(f"Status: {response.status_code}")
        assert response.status_code == 403
        print("✓ Manager correctly denied access to insights")


class TestNotifications:
    """Notification system - in-app notifications"""
    
    def test_get_notifications(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing GET /api/notifications ===")
        response = api_client.get(f"{base_url}/api/notifications", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        assert isinstance(data["notifications"], list)
        assert isinstance(data["unread_count"], int)
        
        print(f"✓ Notifications: {len(data['notifications'])} total, {data['unread_count']} unread")
        
        # Verify notification structure
        if data["notifications"]:
            notif = data["notifications"][0]
            assert "id" in notif
            assert "title" in notif
            assert "body" in notif
            assert "type" in notif
            assert "is_read" in notif
            assert "created_at" in notif
            assert "_id" not in notif
            print(f"  Sample: [{notif['type']}] {notif['title']}")
    
    def test_get_unread_notifications(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing GET /api/notifications?unread_only=true ===")
        response = api_client.get(f"{base_url}/api/notifications?unread_only=true", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        # All returned should be unread
        for notif in data["notifications"]:
            assert notif["is_read"] == False
        
        print(f"✓ Unread notifications: {len(data['notifications'])} found")
    
    def test_mark_notification_read(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing PUT /api/notifications/{id}/read ===")
        # Trigger notification check to ensure we have notifications
        api_client.post(f"{base_url}/api/notifications/trigger-check", headers=auth_headers_owner)
        time.sleep(0.5)
        
        list_response = api_client.get(f"{base_url}/api/notifications", headers=auth_headers_owner)
        assert list_response.status_code == 200
        notifications = list_response.json()["notifications"]
        
        if not notifications:
            pytest.skip("No notifications available")
        
        notif_id = notifications[0]["id"]
        print(f"Marking notification {notif_id} as read")
        
        response = api_client.put(f"{base_url}/api/notifications/{notif_id}/read", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✓ Notification marked as read")
    
    def test_mark_all_notifications_read(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing PUT /api/notifications/read-all ===")
        response = api_client.put(f"{base_url}/api/notifications/read-all", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✓ All notifications marked as read")
        
        # Verify unread count is now 0
        list_response = api_client.get(f"{base_url}/api/notifications", headers=auth_headers_owner)
        assert list_response.status_code == 200
        unread = list_response.json()["unread_count"]
        assert unread == 0
        print(f"  Verified: unread_count = {unread}")
    
    def test_trigger_notification_check(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing POST /api/notifications/trigger-check ===")
        response = api_client.post(f"{base_url}/api/notifications/trigger-check", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✓ Notification check complete: {data['message']}")


class TestExportReports:
    """Export / CA Reports - Excel and CSV generation"""
    
    def test_export_pnl_csv(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing GET /api/export/pnl?format=csv ===")
        response = api_client.get(f"{base_url}/api/export/pnl?format=csv", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        # Verify content type
        assert "text/csv" in response.headers.get("Content-Type", "")
        assert "Content-Disposition" in response.headers
        
        # Verify CSV content
        csv_content = response.text
        assert len(csv_content) > 0
        assert "Date" in csv_content or "Outlet" in csv_content
        
        print(f"✓ P&L CSV generated, size: {len(csv_content)} bytes")
        print(f"  Headers: {csv_content.split(chr(10))[0][:100]}...")
    
    def test_export_expense_ledger_xlsx(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing GET /api/export/expense_ledger?format=xlsx ===")
        response = api_client.get(f"{base_url}/api/export/expense_ledger?format=xlsx", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        # Verify content type
        assert "spreadsheet" in response.headers.get("Content-Type", "")
        assert "Content-Disposition" in response.headers
        
        # Verify XLSX file (starts with PK magic bytes)
        content = response.content
        assert len(content) > 0
        assert content[:2] == b'PK'  # XLSX is a ZIP file
        
        print(f"✓ Expense Ledger XLSX generated, size: {len(content)} bytes")
    
    def test_export_gst_summary_csv(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing GET /api/export/gst_summary?format=csv ===")
        response = api_client.get(f"{base_url}/api/export/gst_summary?format=csv", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        assert "text/csv" in response.headers.get("Content-Type", "")
        csv_content = response.text
        assert len(csv_content) > 0
        
        print(f"✓ GST Summary CSV generated, size: {len(csv_content)} bytes")
    
    def test_export_multi_currency_xlsx(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing GET /api/export/multi_currency?format=xlsx ===")
        response = api_client.get(f"{base_url}/api/export/multi_currency?format=xlsx", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        assert "spreadsheet" in response.headers.get("Content-Type", "")
        content = response.content
        assert len(content) > 0
        assert content[:2] == b'PK'
        
        print(f"✓ Multi-Currency Report XLSX generated, size: {len(content)} bytes")
    
    def test_export_invalid_type(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing Export with Invalid Report Type ===")
        response = api_client.get(f"{base_url}/api/export/invalid_report?format=csv", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 400
        print("✓ Invalid report type rejected correctly")
    
    def test_export_manager_forbidden(self, api_client, base_url, auth_headers_manager):
        print("\n=== Testing Export Access (Manager - Should Fail) ===")
        response = api_client.get(f"{base_url}/api/export/pnl?format=csv", headers=auth_headers_manager)
        print(f"Status: {response.status_code}")
        assert response.status_code == 403
        print("✓ Manager correctly denied access to exports")


class TestBulkDocumentActions:
    """Document Vault Enhancements - Bulk operations"""
    
    def test_bulk_approve(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing POST /api/documents/bulk-action (approve) ===")
        # Get documents that need review
        docs_response = api_client.get(f"{base_url}/api/documents?status=needs_review&limit=2", headers=auth_headers_owner)
        assert docs_response.status_code == 200
        docs = docs_response.json()["documents"]
        
        if len(docs) < 1:
            pytest.skip("No documents to bulk approve")
        
        doc_ids = [d["id"] for d in docs[:2]]
        print(f"Approving {len(doc_ids)} documents")
        
        # Prepare form data - need to remove Content-Type header for multipart
        import json
        form_data = {
            'action': 'approve',
            'document_ids': json.dumps(doc_ids)
        }
        
        # Create new session without Content-Type header for form data
        headers_no_content_type = {"Authorization": auth_headers_owner["Authorization"]}
        response = api_client.post(
            f"{base_url}/api/documents/bulk-action",
            headers=headers_no_content_type,
            data=form_data
        )
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✓ {data['message']}")
        
        # Verify documents are now processed
        for doc_id in doc_ids:
            check = api_client.get(f"{base_url}/api/documents/{doc_id}", headers=auth_headers_owner)
            if check.status_code == 200:
                doc = check.json()
                assert doc["status"] == "processed"
        print(f"  Verified: All documents now have status='processed'")
    
    def test_bulk_flag_review(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing POST /api/documents/bulk-action (flag_review) ===")
        # Get some processed documents
        docs_response = api_client.get(f"{base_url}/api/documents?status=processed&limit=2", headers=auth_headers_owner)
        assert docs_response.status_code == 200
        docs = docs_response.json()["documents"]
        
        if len(docs) < 1:
            pytest.skip("No processed documents to flag")
        
        doc_ids = [d["id"] for d in docs[:2]]
        print(f"Flagging {len(doc_ids)} documents for review")
        
        import json
        form_data = {
            'action': 'flag_review',
            'document_ids': json.dumps(doc_ids)
        }
        
        headers_no_content_type = {"Authorization": auth_headers_owner["Authorization"]}
        response = api_client.post(
            f"{base_url}/api/documents/bulk-action",
            headers=headers_no_content_type,
            data=form_data
        )
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✓ {data['message']}")
    
    def test_bulk_action_staff_forbidden(self, api_client, base_url, auth_headers_staff):
        print("\n=== Testing Bulk Actions (Staff - Should Fail) ===")
        import json
        form_data = {
            'action': 'approve',
            'document_ids': json.dumps(["test-id"])
        }
        
        headers_no_content_type = {"Authorization": auth_headers_staff["Authorization"]}
        response = api_client.post(
            f"{base_url}/api/documents/bulk-action",
            headers=headers_no_content_type,
            data=form_data
        )
        print(f"Status: {response.status_code}")
        assert response.status_code == 403
        print("✓ Staff correctly denied access to bulk actions")


class TestStatsPhase2:
    """Stats endpoint should now include unread_notifications"""
    
    def test_stats_includes_notifications(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing /api/stats (Phase 2 - with notifications) ===")
        response = api_client.get(f"{base_url}/api/stats", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "unread_notifications" in data
        assert isinstance(data["unread_notifications"], int)
        
        print(f"✓ Stats includes unread_notifications: {data['unread_notifications']}")
