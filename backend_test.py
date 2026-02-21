#!/usr/bin/env python3
"""
FinSight Phase 4 Backend API Testing Suite
Tests outlet configuration and supplier management APIs
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://finops-hub-7.preview.emergentagent.com/api"
TEST_EMAIL = "owner@spicekitchen.com"
TEST_PASSWORD = "demo123"

class FinSightAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_data = None
        self.outlet_id = None
        self.supplier_id = None
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def login(self):
        """Authenticate and get access token"""
        self.log("Attempting login...")
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data["token"]
                self.user_data = data["user"]
                self.session.headers.update({"Authorization": f"Bearer {self.token}"})
                self.log(f"Login successful for user: {self.user_data['name']} ({self.user_data['role']})")
                return True
            else:
                self.log(f"Login failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Login error: {str(e)}", "ERROR")
            return False
    
    def get_outlets(self):
        """Get available outlets for testing"""
        self.log("Fetching outlets...")
        try:
            response = self.session.get(f"{BASE_URL}/outlets")
            if response.status_code == 200:
                outlets = response.json()["outlets"]
                if outlets:
                    self.outlet_id = outlets[0]["id"]
                    self.log(f"Using outlet: {outlets[0]['name']} (ID: {self.outlet_id})")
                    return True
                else:
                    self.log("No outlets found", "ERROR")
                    return False
            else:
                self.log(f"Failed to fetch outlets: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error fetching outlets: {str(e)}", "ERROR")
            return False
    
    def test_outlet_config_get(self):
        """Test GET /api/outlets/{id}/config"""
        self.log("Testing GET outlet configuration...")
        try:
            response = self.session.get(f"{BASE_URL}/outlets/{self.outlet_id}/config")
            
            if response.status_code == 200:
                config = response.json()
                
                # Verify required fields
                required_fields = [
                    "country_mode", "timezone", "currency", "gst_enabled", "gst_rate",
                    "required_daily_reports", "business_hours_start", "business_hours_end",
                    "stats", "available_currencies", "available_timezones"
                ]
                
                missing_fields = [field for field in required_fields if field not in config]
                if missing_fields:
                    self.log(f"Missing required fields: {missing_fields}", "ERROR")
                    return False
                
                # Verify stats structure
                stats = config.get("stats", {})
                required_stats = ["total_documents", "needs_review", "active_suppliers", "monthly_spend"]
                missing_stats = [stat for stat in required_stats if stat not in stats]
                if missing_stats:
                    self.log(f"Missing required stats: {missing_stats}", "ERROR")
                    return False
                
                self.log(f"✓ Outlet config retrieved successfully")
                self.log(f"  Country mode: {config.get('country_mode')}")
                self.log(f"  Currency: {config.get('currency')}")
                self.log(f"  GST enabled: {config.get('gst_enabled')}")
                self.log(f"  Total documents: {stats.get('total_documents')}")
                return True
            else:
                self.log(f"Failed to get outlet config: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error testing outlet config GET: {str(e)}", "ERROR")
            return False
    
    def test_outlet_config_update(self):
        """Test PUT /api/outlets/{id}/config"""
        self.log("Testing PUT outlet configuration...")
        try:
            # Test changing country mode from india to international
            update_data = {
                "country_mode": "international",
                "country": "UAE"
            }
            
            response = self.session.put(f"{BASE_URL}/outlets/{self.outlet_id}/config", json=update_data)
            
            if response.status_code == 200:
                config = response.json()
                
                # Verify auto-defaults were applied
                if config.get("country_mode") != "international":
                    self.log("Country mode not updated correctly", "ERROR")
                    return False
                
                # Should auto-set UAE defaults
                expected_currency = "AED"
                expected_timezone = "Asia/Dubai"
                
                if config.get("currency") != expected_currency:
                    self.log(f"Currency not auto-set to {expected_currency}, got: {config.get('currency')}", "ERROR")
                    return False
                
                if config.get("timezone") != expected_timezone:
                    self.log(f"Timezone not auto-set to {expected_timezone}, got: {config.get('timezone')}", "ERROR")
                    return False
                
                self.log("✓ Outlet config updated successfully with auto-defaults")
                self.log(f"  New currency: {config.get('currency')}")
                self.log(f"  New timezone: {config.get('timezone')}")
                
                # Revert back to India mode
                revert_data = {"country_mode": "india"}
                revert_response = self.session.put(f"{BASE_URL}/outlets/{self.outlet_id}/config", json=revert_data)
                if revert_response.status_code == 200:
                    self.log("✓ Reverted to India mode successfully")
                
                return True
            else:
                self.log(f"Failed to update outlet config: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error testing outlet config PUT: {str(e)}", "ERROR")
            return False
    
    def test_suppliers_list(self):
        """Test GET /api/suppliers"""
        self.log("Testing GET suppliers list...")
        try:
            response = self.session.get(f"{BASE_URL}/suppliers")
            
            if response.status_code == 200:
                data = response.json()
                suppliers = data.get("suppliers", [])
                
                if suppliers:
                    self.supplier_id = suppliers[0]["id"]
                    supplier = suppliers[0]
                    
                    # Verify spend metrics are included
                    required_fields = ["total_spend", "document_count", "avg_invoice"]
                    missing_fields = [field for field in required_fields if field not in supplier]
                    if missing_fields:
                        self.log(f"Missing spend metrics: {missing_fields}", "ERROR")
                        return False
                    
                    self.log(f"✓ Suppliers list retrieved successfully ({len(suppliers)} suppliers)")
                    self.log(f"  First supplier: {supplier.get('name')}")
                    self.log(f"  Total spend: {supplier.get('total_spend')}")
                    return True
                else:
                    self.log("No suppliers found - creating test supplier for further tests")
                    return self.create_test_supplier()
            else:
                self.log(f"Failed to get suppliers: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error testing suppliers list: {str(e)}", "ERROR")
            return False
    
    def create_test_supplier(self):
        """Create a test supplier for testing"""
        self.log("Creating test supplier...")
        try:
            supplier_data = {
                "name": "Metro Cash & Carry",
                "gst_id": "27AABCU9603R1ZM",
                "category": "Wholesale",
                "country": "India"
            }
            
            response = self.session.post(f"{BASE_URL}/suppliers", data=supplier_data)
            
            if response.status_code == 200:
                data = response.json()
                self.supplier_id = data["supplier"]["id"]
                self.log(f"✓ Test supplier created: {data['supplier']['name']}")
                return True
            else:
                self.log(f"Failed to create test supplier: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error creating test supplier: {str(e)}", "ERROR")
            return False
    
    def test_supplier_detail(self):
        """Test GET /api/suppliers/{id}"""
        if not self.supplier_id:
            self.log("No supplier ID available for testing", "ERROR")
            return False
            
        self.log("Testing GET supplier detail...")
        try:
            response = self.session.get(f"{BASE_URL}/suppliers/{self.supplier_id}")
            
            if response.status_code == 200:
                supplier = response.json()
                
                # Verify required fields including monthly_trend
                required_fields = ["total_spend", "document_count", "avg_invoice", "monthly_trend"]
                missing_fields = [field for field in required_fields if field not in supplier]
                if missing_fields:
                    self.log(f"Missing required fields: {missing_fields}", "ERROR")
                    return False
                
                # Verify monthly_trend structure
                monthly_trend = supplier.get("monthly_trend", [])
                if monthly_trend:
                    trend_item = monthly_trend[0]
                    required_trend_fields = ["month", "spend", "count"]
                    missing_trend_fields = [field for field in required_trend_fields if field not in trend_item]
                    if missing_trend_fields:
                        self.log(f"Missing monthly trend fields: {missing_trend_fields}", "ERROR")
                        return False
                
                self.log(f"✓ Supplier detail retrieved successfully")
                self.log(f"  Name: {supplier.get('name')}")
                self.log(f"  Total spend: {supplier.get('total_spend')}")
                self.log(f"  Monthly trend entries: {len(monthly_trend)}")
                return True
            else:
                self.log(f"Failed to get supplier detail: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error testing supplier detail: {str(e)}", "ERROR")
            return False
    
    def test_supplier_documents(self):
        """Test GET /api/suppliers/{id}/documents"""
        if not self.supplier_id:
            self.log("No supplier ID available for testing", "ERROR")
            return False
            
        self.log("Testing GET supplier documents...")
        try:
            response = self.session.get(f"{BASE_URL}/suppliers/{self.supplier_id}/documents")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ["documents", "total", "page"]
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    self.log(f"Missing response fields: {missing_fields}", "ERROR")
                    return False
                
                documents = data.get("documents", [])
                self.log(f"✓ Supplier documents retrieved successfully ({len(documents)} documents)")
                return True
            else:
                self.log(f"Failed to get supplier documents: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error testing supplier documents: {str(e)}", "ERROR")
            return False
    
    def test_gst_validation(self):
        """Test POST /api/suppliers/validate-gst"""
        self.log("Testing GST validation...")
        
        # Test valid Indian GST
        try:
            valid_gst_data = {
                "gst_id": "27AABCU9603R1ZM",
                "country": "India"
            }
            
            response = self.session.post(f"{BASE_URL}/suppliers/validate-gst", data=valid_gst_data)
            
            if response.status_code == 200:
                result = response.json()
                
                if not result.get("valid"):
                    self.log(f"Valid GST marked as invalid: {result.get('error')}", "ERROR")
                    return False
                
                self.log("✓ Valid Indian GST validation passed")
            else:
                self.log(f"GST validation failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error testing valid GST: {str(e)}", "ERROR")
            return False
        
        # Test invalid GST
        try:
            invalid_gst_data = {
                "gst_id": "INVALID123",
                "country": "India"
            }
            
            response = self.session.post(f"{BASE_URL}/suppliers/validate-gst", data=invalid_gst_data)
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get("valid"):
                    self.log("Invalid GST marked as valid", "ERROR")
                    return False
                
                self.log("✓ Invalid GST validation correctly failed")
            else:
                self.log(f"Invalid GST validation request failed: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error testing invalid GST: {str(e)}", "ERROR")
            return False
        
        # Test existing supplier check
        try:
            existing_gst_data = {
                "gst_id": "27AABCU9603R1ZM",  # Should find existing supplier
                "country": "India"
            }
            
            response = self.session.post(f"{BASE_URL}/suppliers/validate-gst", data=existing_gst_data)
            
            if response.status_code == 200:
                result = response.json()
                
                if "existing_supplier" in result:
                    self.log("✓ Existing supplier detection working")
                else:
                    self.log("Existing supplier not detected (may be expected if no duplicate exists)")
                
                return True
            else:
                self.log(f"Existing GST check failed: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error testing existing GST: {str(e)}", "ERROR")
            return False
    
    def test_duplicate_check(self):
        """Test POST /api/suppliers/check-duplicate"""
        self.log("Testing supplier duplicate check...")
        try:
            # Test fuzzy matching with "Metro Cash Carry" (should find "Metro Cash & Carry")
            duplicate_data = {
                "name": "Metro Cash Carry"
            }
            
            response = self.session.post(f"{BASE_URL}/suppliers/check-duplicate", data=duplicate_data)
            
            if response.status_code == 200:
                result = response.json()
                
                # Verify response structure
                if "potential_duplicates" not in result:
                    self.log("Missing potential_duplicates in response", "ERROR")
                    return False
                
                duplicates = result["potential_duplicates"]
                
                # Check if similarity percentage is returned
                if duplicates:
                    duplicate = duplicates[0]
                    if "similarity" not in duplicate:
                        self.log("Missing similarity percentage in duplicate result", "ERROR")
                        return False
                    
                    self.log(f"✓ Duplicate check working - found {len(duplicates)} potential matches")
                    self.log(f"  Best match: {duplicate.get('name')} ({duplicate.get('similarity')}% similarity)")
                else:
                    self.log("✓ Duplicate check working - no matches found")
                
                return True
            else:
                self.log(f"Duplicate check failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error testing duplicate check: {str(e)}", "ERROR")
            return False
    
    def test_supplier_create_with_validation(self):
        """Test POST /api/suppliers with validation"""
        self.log("Testing supplier creation with validation...")
        try:
            # Test creating supplier with valid GST
            supplier_data = {
                "name": "Test Supplier Ltd",
                "gst_id": "29AABCU9603R1ZX",  # Different valid GST
                "category": "Services",
                "country": "India"
            }
            
            response = self.session.post(f"{BASE_URL}/suppliers", data=supplier_data)
            
            if response.status_code == 200:
                result = response.json()
                
                # Verify response structure
                required_fields = ["supplier", "warnings", "validation"]
                missing_fields = [field for field in required_fields if field not in result]
                if missing_fields:
                    self.log(f"Missing response fields: {missing_fields}", "ERROR")
                    return False
                
                supplier = result["supplier"]
                validation = result["validation"]
                
                if not validation.get("valid"):
                    self.log(f"Valid supplier creation failed validation: {validation.get('error')}", "ERROR")
                    return False
                
                self.log("✓ Supplier creation with validation successful")
                self.log(f"  Created: {supplier.get('name')}")
                self.log(f"  Warnings: {len(result.get('warnings', []))}")
                
                # Clean up - delete the test supplier
                # Note: We don't have a delete endpoint, so we'll leave it
                
                return True
            else:
                self.log(f"Supplier creation failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error testing supplier creation: {str(e)}", "ERROR")
            return False
    
    def test_supplier_update(self):
        """Test PUT /api/suppliers/{id}"""
        if not self.supplier_id:
            self.log("No supplier ID available for testing", "ERROR")
            return False
            
        self.log("Testing supplier update...")
        try:
            # Test updating name and checking for duplicate warnings
            update_data = {
                "name": "Metro Cash and Carry Updated",
                "category": "Retail"
            }
            
            response = self.session.put(f"{BASE_URL}/suppliers/{self.supplier_id}", data=update_data)
            
            if response.status_code == 200:
                result = response.json()
                
                # Verify response structure
                required_fields = ["supplier", "warnings"]
                missing_fields = [field for field in required_fields if field not in result]
                if missing_fields:
                    self.log(f"Missing response fields: {missing_fields}", "ERROR")
                    return False
                
                supplier = result["supplier"]
                
                if supplier.get("name") != update_data["name"]:
                    self.log("Supplier name not updated correctly", "ERROR")
                    return False
                
                self.log("✓ Supplier update successful")
                self.log(f"  Updated name: {supplier.get('name')}")
                self.log(f"  Warnings: {len(result.get('warnings', []))}")
                return True
            else:
                self.log(f"Supplier update failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error testing supplier update: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all Phase 4 backend API tests"""
        self.log("=== FinSight Phase 4 Backend API Testing ===")
        
        # Authentication
        if not self.login():
            return False
        
        # Get outlets for testing
        if not self.get_outlets():
            return False
        
        # Test results tracking
        tests = [
            ("Outlet Config GET", self.test_outlet_config_get),
            ("Outlet Config PUT", self.test_outlet_config_update),
            ("Suppliers List", self.test_suppliers_list),
            ("Supplier Detail", self.test_supplier_detail),
            ("Supplier Documents", self.test_supplier_documents),
            ("GST Validation", self.test_gst_validation),
            ("Duplicate Check", self.test_duplicate_check),
            ("Supplier Create", self.test_supplier_create_with_validation),
            ("Supplier Update", self.test_supplier_update),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            self.log(f"\n--- Testing {test_name} ---")
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
                    self.log(f"❌ {test_name} FAILED", "ERROR")
            except Exception as e:
                failed += 1
                self.log(f"❌ {test_name} FAILED with exception: {str(e)}", "ERROR")
        
        # Summary
        self.log(f"\n=== Test Summary ===")
        self.log(f"Total tests: {len(tests)}")
        self.log(f"Passed: {passed}")
        self.log(f"Failed: {failed}")
        
        if failed == 0:
            self.log("🎉 All tests passed!")
            return True
        else:
            self.log(f"⚠️  {failed} test(s) failed")
            return False

if __name__ == "__main__":
    tester = FinSightAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)