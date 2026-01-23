#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta

class RedRibbonOpsAPITester:
    def __init__(self, base_url="https://ops-portal-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.admin_user = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'clients': [],
            'users': [],
            'orders': [],
            'tickets': []
        }

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    self.log(f"   Error: {error_detail}")
                except:
                    self.log(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            return False, {}

    def test_seed_data(self):
        """Test seed endpoint to create admin user"""
        self.log("\n=== TESTING SEED DATA ===")
        success, response = self.run_test(
            "Seed Data",
            "POST",
            "seed",
            200
        )
        return success

    def test_admin_login(self):
        """Test admin login"""
        self.log("\n=== TESTING AUTHENTICATION ===")
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "info@redribbonrealty.ca", "password": "admin123"}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.admin_user = response['user']
            self.log(f"✅ Logged in as: {self.admin_user['name']} ({self.admin_user['role']})")
            return True
        return False

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats"""
        self.log("\n=== TESTING DASHBOARD ===")
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        if success:
            expected_keys = ['new_count', 'in_progress_count', 'needs_review_count', 'revision_requested_count', 'delivered_last_7_days']
            for key in expected_keys:
                if key not in response:
                    self.log(f"❌ Missing key in dashboard stats: {key}")
                    return False
            self.log(f"✅ Dashboard stats: {response}")
        
        return success

    def test_client_operations(self):
        """Test client CRUD operations"""
        self.log("\n=== TESTING CLIENT OPERATIONS ===")
        
        # Create client
        client_data = {
            "name": "Test Client Corp",
            "email": "testclient@example.com",
            "phone": "+1-555-0123",
            "notes": "Test client for API testing"
        }
        
        success, response = self.run_test(
            "Create Client",
            "POST",
            "clients",
            200,
            data=client_data
        )
        
        if not success:
            return False
            
        client_id = response.get('id')
        if client_id:
            self.created_resources['clients'].append(client_id)
        
        # List clients
        success, response = self.run_test(
            "List Clients",
            "GET",
            "clients",
            200
        )
        
        if not success:
            return False
        
        # Get specific client
        if client_id:
            success, response = self.run_test(
                "Get Client",
                "GET",
                f"clients/{client_id}",
                200
            )
            
            if not success:
                return False
        
        return True

    def test_user_operations(self):
        """Test user CRUD operations"""
        self.log("\n=== TESTING USER OPERATIONS ===")
        
        # Create editor user
        editor_data = {
            "name": "Test Editor",
            "email": "testeditor@example.com",
            "password": "testpass123",
            "role": "Editor"
        }
        
        success, response = self.run_test(
            "Create Editor User",
            "POST",
            "users",
            200,
            data=editor_data
        )
        
        if not success:
            return False
            
        editor_id = response.get('id')
        if editor_id:
            self.created_resources['users'].append(editor_id)
        
        # List users
        success, response = self.run_test(
            "List Users",
            "GET",
            "users",
            200
        )
        
        if not success:
            return False
        
        # List editors specifically
        success, response = self.run_test(
            "List Editors",
            "GET",
            "users/role/editors",
            200
        )
        
        return success

    def test_order_operations(self):
        """Test order CRUD operations"""
        self.log("\n=== TESTING ORDER OPERATIONS ===")
        
        # Need client and editor for order creation
        if not self.created_resources['clients'] or not self.created_resources['users']:
            self.log("❌ Cannot test orders without client and editor")
            return False
        
        client_id = self.created_resources['clients'][0]
        editor_id = self.created_resources['users'][0]
        
        # Create order
        order_data = {
            "client_id": client_id,
            "title": "Test Video Edit Project",
            "type": "Video Edit",
            "priority": "Normal",
            "due_date": (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d'),
            "assigned_editor_id": editor_id,
            "source": "Manual",
            "intake_required": True,
            "notes": "This is a test order for API testing"
        }
        
        success, response = self.run_test(
            "Create Order",
            "POST",
            "orders",
            200,
            data=order_data
        )
        
        if not success:
            return False
            
        order_id = response.get('id')
        if order_id:
            self.created_resources['orders'].append(order_id)
        
        # List orders
        success, response = self.run_test(
            "List Orders",
            "GET",
            "orders",
            200
        )
        
        if not success:
            return False
        
        # Get specific order
        if order_id:
            success, response = self.run_test(
                "Get Order",
                "GET",
                f"orders/{order_id}",
                200
            )
            
            if not success:
                return False
        
        return True

    def test_order_messages(self):
        """Test order message operations"""
        self.log("\n=== TESTING ORDER MESSAGES ===")
        
        if not self.created_resources['orders']:
            self.log("❌ Cannot test messages without order")
            return False
        
        order_id = self.created_resources['orders'][0]
        
        # Create message
        message_data = {
            "message_body": "This is a test message for the order."
        }
        
        success, response = self.run_test(
            "Create Order Message",
            "POST",
            f"orders/{order_id}/messages",
            200,
            data=message_data
        )
        
        if not success:
            return False
        
        # List messages
        success, response = self.run_test(
            "List Order Messages",
            "GET",
            f"orders/{order_id}/messages",
            200
        )
        
        return success

    def test_order_files(self):
        """Test order file operations"""
        self.log("\n=== TESTING ORDER FILES ===")
        
        if not self.created_resources['orders']:
            self.log("❌ Cannot test files without order")
            return False
        
        order_id = self.created_resources['orders'][0]
        
        # Create file
        file_data = {
            "file_type": "Export",
            "label": "Test Export V1",
            "url_or_upload": "https://example.com/test-file.mp4",
            "version": "V1"
        }
        
        success, response = self.run_test(
            "Create Order File",
            "POST",
            f"orders/{order_id}/files",
            200,
            data=file_data
        )
        
        if not success:
            return False
        
        file_id = response.get('id')
        
        # List files
        success, response = self.run_test(
            "List Order Files",
            "GET",
            f"orders/{order_id}/files",
            200
        )
        
        if not success:
            return False
        
        # Pin file as final
        if file_id:
            success, response = self.run_test(
                "Pin File as Final",
                "PATCH",
                f"orders/{order_id}/files/{file_id}/pin",
                200
            )
            
            if not success:
                return False
        
        return True

    def test_order_checklist(self):
        """Test order checklist operations"""
        self.log("\n=== TESTING ORDER CHECKLIST ===")
        
        if not self.created_resources['orders']:
            self.log("❌ Cannot test checklist without order")
            return False
        
        order_id = self.created_resources['orders'][0]
        
        # Get checklist
        success, response = self.run_test(
            "Get Order Checklist",
            "GET",
            f"orders/{order_id}/checklist",
            200
        )
        
        if not success:
            return False
        
        # Update checklist
        checklist_data = {
            "intake_complete": True,
            "assets_received": True
        }
        
        success, response = self.run_test(
            "Update Order Checklist",
            "PATCH",
            f"orders/{order_id}/checklist",
            200,
            data=checklist_data
        )
        
        return success

    def test_order_status_transitions(self):
        """Test order status transitions"""
        self.log("\n=== TESTING ORDER STATUS TRANSITIONS ===")
        
        if not self.created_resources['orders']:
            self.log("❌ Cannot test status transitions without order")
            return False
        
        order_id = self.created_resources['orders'][0]
        
        # Update status to In Progress
        success, response = self.run_test(
            "Update Order Status to In Progress",
            "PATCH",
            f"orders/{order_id}",
            200,
            data={"status": "In Progress"}
        )
        
        if not success:
            return False
        
        # Update status to Needs Client Review
        success, response = self.run_test(
            "Update Order Status to Needs Client Review",
            "PATCH",
            f"orders/{order_id}",
            200,
            data={"status": "Needs Client Review"}
        )
        
        return success

    def test_ticket_operations(self):
        """Test ticket operations"""
        self.log("\n=== TESTING TICKET OPERATIONS ===")
        
        # Create ticket
        ticket_data = {
            "subject": "Test Support Ticket",
            "message_body": "This is a test ticket for API testing."
        }
        
        if self.created_resources['clients']:
            ticket_data["client_id"] = self.created_resources['clients'][0]
        
        if self.created_resources['orders']:
            ticket_data["related_order_id"] = self.created_resources['orders'][0]
        
        success, response = self.run_test(
            "Create Ticket",
            "POST",
            "tickets",
            200,
            data=ticket_data
        )
        
        if not success:
            return False
            
        ticket_id = response.get('id')
        if ticket_id:
            self.created_resources['tickets'].append(ticket_id)
        
        # List tickets
        success, response = self.run_test(
            "List Tickets",
            "GET",
            "tickets",
            200
        )
        
        if not success:
            return False
        
        # Get specific ticket
        if ticket_id:
            success, response = self.run_test(
                "Get Ticket",
                "GET",
                f"tickets/{ticket_id}",
                200
            )
            
            if not success:
                return False
        
        return True

    def test_notifications(self):
        """Test notification operations"""
        self.log("\n=== TESTING NOTIFICATIONS ===")
        
        # List notifications
        success, response = self.run_test(
            "List Notifications",
            "GET",
            "notifications",
            200
        )
        
        if not success:
            return False
        
        # Get unread count
        success, response = self.run_test(
            "Get Unread Notification Count",
            "GET",
            "notifications/unread-count",
            200
        )
        
        return success

    def run_all_tests(self):
        """Run all API tests"""
        self.log("🚀 Starting RED RIBBON OPS PORTAL API Tests")
        self.log(f"🌐 Testing against: {self.base_url}")
        
        # Test sequence
        test_methods = [
            self.test_seed_data,
            self.test_admin_login,
            self.test_get_me,
            self.test_dashboard_stats,
            self.test_client_operations,
            self.test_user_operations,
            self.test_order_operations,
            self.test_order_messages,
            self.test_order_files,
            self.test_order_checklist,
            self.test_order_status_transitions,
            self.test_ticket_operations,
            self.test_notifications
        ]
        
        for test_method in test_methods:
            try:
                if not test_method():
                    self.log(f"❌ Test failed: {test_method.__name__}")
                    break
            except Exception as e:
                self.log(f"❌ Test error in {test_method.__name__}: {str(e)}")
                break
        
        # Print final results
        self.log(f"\n📊 FINAL RESULTS:")
        self.log(f"Tests passed: {self.tests_passed}/{self.tests_run}")
        self.log(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "No tests run")
        
        if self.created_resources['clients']:
            self.log(f"✅ Created {len(self.created_resources['clients'])} test clients")
        if self.created_resources['users']:
            self.log(f"✅ Created {len(self.created_resources['users'])} test users")
        if self.created_resources['orders']:
            self.log(f"✅ Created {len(self.created_resources['orders'])} test orders")
        if self.created_resources['tickets']:
            self.log(f"✅ Created {len(self.created_resources['tickets'])} test tickets")
        
        return self.tests_passed == self.tests_run

def main():
    tester = RedRibbonOpsAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())