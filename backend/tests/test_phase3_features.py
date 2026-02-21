"""
Phase 3 Feature Testing: Document Processor Adapter, Offline Queue, Version History, Notification Preferences
Tests all Phase 3 backend endpoints and data structures.
"""
import pytest
import requests
import os
import json

class TestDocumentProcessor:
    """Pluggable document processor - GET /api/processor/info"""
    
    def test_processor_info(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing Document Processor Info ===")
        response = api_client.get(f"{base_url}/api/processor/info", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "active_processor" in data
        assert "available_processors" in data
        assert "config" in data
        
        # Phase 3: Should be gpt4o
        assert data["active_processor"] == "gpt4o"
        print(f"✓ Active processor: {data['active_processor']}")
        
        # Check EMERGENT_LLM_KEY configuration
        assert "has_api_key" in data["config"]
        assert data["config"]["has_api_key"] == True
        print(f"✓ EMERGENT_LLM_KEY configured: {data['config']['has_api_key']}")
        
        # Check available processors
        assert "gpt4o" in data["available_processors"]
        assert "mock" in data["available_processors"]
        print(f"✓ Available processors: {data['available_processors']}")


class TestDocumentVersionHistory:
    """Immutable version history - document updates create snapshots"""
    
    def test_document_update_creates_version(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing Document Update Creates Version Snapshot ===")
        
        # Get a document to update
        docs_response = api_client.get(f"{base_url}/api/documents?limit=1", headers=auth_headers_owner)
        assert docs_response.status_code == 200
        docs = docs_response.json()["documents"]
        
        if not docs:
            pytest.skip("No documents available for testing")
        
        doc_id = docs[0]["id"]
        original_version = docs[0].get("version_number", 1)
        print(f"Testing with document: {doc_id}, current version: {original_version}")
        
        # Get initial version count
        versions_before = api_client.get(f"{base_url}/api/documents/{doc_id}/versions", headers=auth_headers_owner)
        assert versions_before.status_code == 200
        versions_before_count = len(versions_before.json()["versions"])
        print(f"Versions before update: {versions_before_count}")
        
        # Update document
        update_data = {
            "supplier_name": "TEST_Updated Supplier",
            "status": "processed"
        }
        update_response = api_client.put(
            f"{base_url}/api/documents/{doc_id}",
            headers=auth_headers_owner,
            json=update_data
        )
        print(f"Update status: {update_response.status_code}")
        assert update_response.status_code == 200
        
        updated_doc = update_response.json()
        # Verify version incremented
        assert updated_doc["version_number"] == original_version + 1
        print(f"✓ Version incremented: {original_version} → {updated_doc['version_number']}")
        
        # Verify version snapshot created
        versions_after = api_client.get(f"{base_url}/api/documents/{doc_id}/versions", headers=auth_headers_owner)
        assert versions_after.status_code == 200
        versions_data = versions_after.json()["versions"]
        assert len(versions_data) == versions_before_count + 1
        print(f"✓ Version snapshot created: {versions_before_count} → {len(versions_data)}")
        
        # Verify latest version snapshot structure
        latest_version = versions_data[0]
        assert "id" in latest_version
        assert "document_id" in latest_version
        assert latest_version["document_id"] == doc_id
        assert "version" in latest_version
        assert latest_version["version"] == original_version
        assert "snapshot" in latest_version
        assert "changed_fields" in latest_version
        assert "changed_by" in latest_version
        assert "changed_by_name" in latest_version
        assert "created_at" in latest_version
        
        # Verify changed fields recorded
        assert "supplier_name" in latest_version["changed_fields"]
        assert "status" in latest_version["changed_fields"]
        print(f"✓ Version snapshot has all required fields: changed_fields={latest_version['changed_fields']}, changed_by={latest_version['changed_by_name']}")
    
    def test_get_document_versions(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing GET /api/documents/{id}/versions ===")
        
        # Get a document
        docs_response = api_client.get(f"{base_url}/api/documents?limit=1", headers=auth_headers_owner)
        assert docs_response.status_code == 200
        docs = docs_response.json()["documents"]
        
        if not docs:
            pytest.skip("No documents available")
        
        doc_id = docs[0]["id"]
        print(f"Fetching versions for document: {doc_id}")
        
        response = api_client.get(f"{base_url}/api/documents/{doc_id}/versions", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "versions" in data
        versions = data["versions"]
        print(f"✓ Found {len(versions)} version(s)")
        
        # Verify structure if versions exist
        if versions:
            v = versions[0]
            assert "version" in v
            assert "changed_fields" in v
            assert "changed_by_name" in v
            assert "created_at" in v
            assert "snapshot" in v
            assert "_id" not in v  # MongoDB _id should be excluded
            print(f"✓ Version structure valid: version={v['version']}, changed_by={v['changed_by_name']}")


class TestNotificationPreferences:
    """User notification preferences - Phase 3 enhancement"""
    
    def test_get_default_preferences(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing GET /api/notifications/preferences (Default) ===")
        response = api_client.get(f"{base_url}/api/notifications/preferences", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        # Default preferences should be returned
        assert "missing_reports" in data
        assert "anomaly_alerts" in data
        assert "low_confidence" in data
        assert "weekly_summary" in data
        assert "push_enabled" in data
        
        # All should default to True
        assert data["missing_reports"] == True
        assert data["anomaly_alerts"] == True
        assert data["low_confidence"] == True
        assert data["weekly_summary"] == True
        assert data["push_enabled"] == True
        
        print(f"✓ Default preferences: missing_reports={data['missing_reports']}, anomaly_alerts={data['anomaly_alerts']}, low_confidence={data['low_confidence']}")
    
    def test_update_preferences(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing PUT /api/notifications/preferences ===")
        
        # Update preferences
        new_prefs = {
            "missing_reports": False,
            "anomaly_alerts": True,
            "low_confidence": False,
            "weekly_summary": True,
            "push_enabled": False
        }
        
        update_response = api_client.put(
            f"{base_url}/api/notifications/preferences",
            headers=auth_headers_owner,
            json=new_prefs
        )
        print(f"Update status: {update_response.status_code}")
        assert update_response.status_code == 200
        
        update_data = update_response.json()
        assert "message" in update_data
        print(f"✓ Update response: {update_data['message']}")
        
        # Verify persistence with GET
        get_response = api_client.get(f"{base_url}/api/notifications/preferences", headers=auth_headers_owner)
        assert get_response.status_code == 200
        
        persisted_prefs = get_response.json()
        assert persisted_prefs["missing_reports"] == False
        assert persisted_prefs["anomaly_alerts"] == True
        assert persisted_prefs["low_confidence"] == False
        assert persisted_prefs["weekly_summary"] == True
        assert persisted_prefs["push_enabled"] == False
        
        print(f"✓ Preferences persisted correctly: {persisted_prefs}")
        
        # Reset to defaults for other tests
        reset_prefs = {
            "missing_reports": True,
            "anomaly_alerts": True,
            "low_confidence": True,
            "weekly_summary": True,
            "push_enabled": True
        }
        api_client.put(
            f"{base_url}/api/notifications/preferences",
            headers=auth_headers_owner,
            json=reset_prefs
        )
        print("✓ Preferences reset to defaults")


class TestDocumentUploadPhase3:
    """Document upload with Phase 3 enhancements: content_hash, version_number, ai_provider_used"""
    
    def test_upload_includes_phase3_fields(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing Document Upload Phase 3 Fields ===")
        
        # Get an outlet for upload
        outlets_response = api_client.get(f"{base_url}/api/outlets", headers=auth_headers_owner)
        assert outlets_response.status_code == 200
        outlets = outlets_response.json()["outlets"]
        
        if not outlets:
            pytest.skip("No outlets available")
        
        outlet_id = outlets[0]["id"]
        print(f"Testing upload to outlet: {outlet_id}")
        
        # Create a test file (simulated)
        import io
        test_file_content = b"TEST_PHASE3_INVOICE_CONTENT"
        files = {'file': ('test_phase3_invoice.jpg', io.BytesIO(test_file_content), 'image/jpeg')}
        data = {'outlet_id': outlet_id}
        
        # Upload (multipart form data requires removing Content-Type header)
        upload_headers = {'Authorization': auth_headers_owner['Authorization']}
        response = api_client.post(
            f"{base_url}/api/documents/upload",
            headers=upload_headers,
            files=files,
            data=data
        )
        print(f"Upload status: {response.status_code}")
        if response.status_code != 200:
            print(f"Upload error: {response.text}")
        assert response.status_code == 200
        
        result = response.json()
        assert "document" in result
        assert "ai_summary" in result
        
        doc = result["document"]
        ai_summary = result["ai_summary"]
        
        # Phase 3 fields in document
        assert "ai_provider_used" in doc
        assert "extraction_method" in doc
        assert "content_hash" in doc
        assert "version_number" in doc
        
        # Verify values
        assert doc["ai_provider_used"] in ["gpt4o", "mock"]  # Could be either depending on config
        assert doc["extraction_method"] in ["gpt4o_vision", "mock"]
        assert doc["content_hash"] is not None and len(doc["content_hash"]) > 0
        assert doc["version_number"] == 1  # New document starts at version 1
        
        print(f"✓ AI Provider: {doc['ai_provider_used']}")
        print(f"✓ Extraction Method: {doc['extraction_method']}")
        print(f"✓ Content Hash: {doc['content_hash'][:16]}...")
        print(f"✓ Version: {doc['version_number']}")
        
        # Phase 3 fields in ai_summary
        assert "provider" in ai_summary
        assert "method" in ai_summary
        assert ai_summary["provider"] in ["gpt4o", "mock"]
        print(f"✓ AI Summary Provider: {ai_summary['provider']}")
        
        # Store document ID for duplicate test
        return doc["id"], doc["content_hash"]
    
    def test_duplicate_upload_protection(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing Duplicate Upload Protection ===")
        
        # Get an outlet
        outlets_response = api_client.get(f"{base_url}/api/outlets", headers=auth_headers_owner)
        assert outlets_response.status_code == 200
        outlets = outlets_response.json()["outlets"]
        
        if not outlets:
            pytest.skip("No outlets available")
        
        outlet_id = outlets[0]["id"]
        
        # Upload first document
        import io
        test_content = b"DUPLICATE_TEST_CONTENT_UNIQUE_12345"
        files1 = {'file': ('duplicate_test.jpg', io.BytesIO(test_content), 'image/jpeg')}
        data1 = {'outlet_id': outlet_id}
        
        upload_headers = {'Authorization': auth_headers_owner['Authorization']}
        response1 = api_client.post(
            f"{base_url}/api/documents/upload",
            headers=upload_headers,
            files=files1,
            data=data1
        )
        print(f"First upload status: {response1.status_code}")
        if response1.status_code != 200:
            print(f"Upload error: {response1.text}")
        assert response1.status_code == 200
        
        result1 = response1.json()
        assert result1.get("duplicate") == False
        first_doc_id = result1["document"]["id"]
        first_hash = result1["document"]["content_hash"]
        print(f"✓ First upload successful: doc_id={first_doc_id}, hash={first_hash[:16]}...")
        
        # Upload same content to same outlet (should be duplicate)
        # Note: Hash is computed on server, so we need to upload same exact bytes
        files2 = {'file': ('duplicate_test.jpg', io.BytesIO(test_content), 'image/jpeg')}
        data2 = {'outlet_id': outlet_id, 'file_hash': first_hash}  # Pass hash for duplicate detection
        
        response2 = api_client.post(
            f"{base_url}/api/documents/upload",
            headers=upload_headers,
            files=files2,
            data=data2
        )
        print(f"Duplicate upload status: {response2.status_code}")
        assert response2.status_code == 200
        
        result2 = response2.json()
        assert "duplicate" in result2
        assert result2["duplicate"] == True
        assert "existing_id" in result2
        assert result2["existing_id"] == first_doc_id
        
        print(f"✓ Duplicate detected correctly: existing_id={result2['existing_id']}")
        print(f"✓ Duplicate protection working as expected")


class TestStatsPhase3:
    """Stats endpoint should include unread_notifications (Phase 2/3)"""
    
    def test_stats_includes_unread_notifications(self, api_client, base_url, auth_headers_owner):
        print("\n=== Testing Stats Includes Unread Notifications ===")
        response = api_client.get(f"{base_url}/api/stats", headers=auth_headers_owner)
        print(f"Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "unread_notifications" in data
        assert isinstance(data["unread_notifications"], int)
        assert data["unread_notifications"] >= 0
        
        print(f"✓ Stats include unread_notifications: {data['unread_notifications']}")
