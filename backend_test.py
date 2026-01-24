import requests
import sys
import json
from datetime import datetime

class RedRibbonOpsAPITester:
    def __init__(self, base_url="https://request-hub-23.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.editor_token = None
        self.requester_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_users = []
        self.created_orders = []

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.json()}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_seed_data(self):
        """Test seeding initial admin user"""
        success, response = self.run_test(
            "Seed Data",
            "POST",
            "seed",
            200
        )
        return success

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@redribbonops.com", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   Admin token obtained")
            return True
        return False

    def test_create_editor_user(self):
        """Test creating an editor user"""
        success, response = self.run_test(
            "Create Editor User",
            "POST",
            "users",
            200,
            data={
                "name": "Test Editor",
                "email": "editor@test.com",
                "password": "editor123",
                "role": "Editor"
            },
            token=self.admin_token
        )
        if success:
            self.created_users.append(response['id'])
        return success

    def test_create_requester_user(self):
        """Test creating a requester user"""
        success, response = self.run_test(
            "Create Requester User",
            "POST",
            "users",
            200,
            data={
                "name": "Test Requester",
                "email": "requester@test.com",
                "password": "requester123",
                "role": "Requester"
            },
            token=self.admin_token
        )
        if success:
            self.created_users.append(response['id'])
        return success

    def test_editor_login(self):
        """Test editor login"""
        success, response = self.run_test(
            "Editor Login",
            "POST",
            "auth/login",
            200,
            data={"email": "editor@test.com", "password": "editor123"}
        )
        if success and 'token' in response:
            self.editor_token = response['token']
            print(f"   Editor token obtained")
            return True
        return False

    def test_requester_login(self):
        """Test requester login"""
        success, response = self.run_test(
            "Requester Login",
            "POST",
            "auth/login",
            200,
            data={"email": "requester@test.com", "password": "requester123"}
        )
        if success and 'token' in response:
            self.requester_token = response['token']
            print(f"   Requester token obtained")
            return True
        return False

    def test_create_order(self):
        """Test creating an order as requester"""
        success, response = self.run_test(
            "Create Order",
            "POST",
            "orders",
            200,
            data={
                "title": "Test Video Editing Order",
                "category": "Video Editing",
                "priority": "Normal",
                "description": "Test order for video editing workflow",
                "video_script": "Test script content",
                "reference_links": "https://example.com/reference",
                "footage_links": "https://example.com/footage",
                "music_preference": "Upbeat",
                "delivery_format": "1080p MP4",
                "special_instructions": "Please make it engaging"
            },
            token=self.requester_token
        )
        if success:
            self.created_orders.append(response['id'])
            return response['id']
        return None

    def test_get_order_pool(self):
        """Test getting order pool as editor"""
        success, response = self.run_test(
            "Get Order Pool",
            "GET",
            "orders/pool",
            200,
            token=self.editor_token
        )
        return success, response

    def test_pick_order(self, order_id):
        """Test picking an order as editor"""
        success, response = self.run_test(
            "Pick Order",
            "POST",
            f"orders/{order_id}/pick",
            200,
            token=self.editor_token
        )
        return success

    def test_submit_for_review(self, order_id):
        """Test submitting order for review"""
        success, response = self.run_test(
            "Submit for Review",
            "POST",
            f"orders/{order_id}/submit-for-review",
            200,
            token=self.editor_token
        )
        return success

    def test_respond_to_order(self, order_id):
        """Test requester responding to order"""
        success, response = self.run_test(
            "Respond to Order",
            "POST",
            f"orders/{order_id}/respond",
            200,
            token=self.requester_token
        )
        return success

    def test_add_file(self, order_id):
        """Test adding a file to order"""
        success, response = self.run_test(
            "Add File",
            "POST",
            f"orders/{order_id}/files",
            200,
            data={
                "file_type": "Final Delivery",
                "label": "Final Video Export",
                "url": "https://example.com/final-video.mp4"
            },
            token=self.editor_token
        )
        if success:
            return response['id']
        return None

    def test_mark_file_final(self, order_id, file_id):
        """Test marking file as final delivery"""
        success, response = self.run_test(
            "Mark File as Final",
            "PATCH",
            f"orders/{order_id}/files/{file_id}/mark-final",
            200,
            token=self.editor_token
        )
        return success

    def test_deliver_order(self, order_id):
        """Test delivering an order"""
        success, response = self.run_test(
            "Deliver Order",
            "POST",
            f"orders/{order_id}/deliver",
            200,
            token=self.editor_token
        )
        return success

    def test_send_message(self, order_id):
        """Test sending a message"""
        success, response = self.run_test(
            "Send Message",
            "POST",
            f"orders/{order_id}/messages",
            200,
            data={"message_body": "Test message from editor"},
            token=self.editor_token
        )
        return success

    def test_get_messages(self, order_id):
        """Test getting messages"""
        success, response = self.run_test(
            "Get Messages",
            "GET",
            f"orders/{order_id}/messages",
            200,
            token=self.editor_token
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats for different roles"""
        # Admin dashboard
        success1, _ = self.run_test(
            "Admin Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            token=self.admin_token
        )
        
        # Editor dashboard
        success2, _ = self.run_test(
            "Editor Dashboard",
            "GET",
            "dashboard/editor",
            200,
            token=self.editor_token
        )
        
        # Requester dashboard
        success3, _ = self.run_test(
            "Requester Dashboard",
            "GET",
            "dashboard/requester",
            200,
            token=self.requester_token
        )
        
        return success1 and success2 and success3

    def test_notifications(self):
        """Test notifications API"""
        success, response = self.run_test(
            "Get Notifications",
            "GET",
            "notifications",
            200,
            token=self.requester_token
        )
        return success

def main():
    print("🚀 Starting RED RIBBON OPS PORTAL API Tests")
    print("=" * 50)
    
    tester = RedRibbonOpsAPITester()
    
    # Test sequence
    if not tester.test_seed_data():
        print("❌ Seed data failed, stopping tests")
        return 1
    
    if not tester.test_admin_login():
        print("❌ Admin login failed, stopping tests")
        return 1
    
    if not tester.test_create_editor_user():
        print("❌ Editor user creation failed, stopping tests")
        return 1
    
    if not tester.test_create_requester_user():
        print("❌ Requester user creation failed, stopping tests")
        return 1
    
    if not tester.test_editor_login():
        print("❌ Editor login failed, stopping tests")
        return 1
    
    if not tester.test_requester_login():
        print("❌ Requester login failed, stopping tests")
        return 1
    
    # Test order workflow
    order_id = tester.test_create_order()
    if not order_id:
        print("❌ Order creation failed, stopping tests")
        return 1
    
    # Test order pool and picking
    success, pool_data = tester.test_get_order_pool()
    if not success:
        print("❌ Get order pool failed")
        return 1
    
    if not tester.test_pick_order(order_id):
        print("❌ Pick order failed")
        return 1
    
    # Test messaging
    if not tester.test_send_message(order_id):
        print("❌ Send message failed")
        return 1
    
    if not tester.test_get_messages(order_id):
        print("❌ Get messages failed")
        return 1
    
    # Test file management
    file_id = tester.test_add_file(order_id)
    if not file_id:
        print("❌ Add file failed")
        return 1
    
    if not tester.test_mark_file_final(order_id, file_id):
        print("❌ Mark file as final failed")
        return 1
    
    # Test workflow transitions
    if not tester.test_submit_for_review(order_id):
        print("❌ Submit for review failed")
        return 1
    
    if not tester.test_respond_to_order(order_id):
        print("❌ Respond to order failed")
        return 1
    
    if not tester.test_deliver_order(order_id):
        print("❌ Deliver order failed")
        return 1
    
    # Test dashboards
    if not tester.test_dashboard_stats():
        print("❌ Dashboard stats failed")
        return 1
    
    # Test notifications
    if not tester.test_notifications():
        print("❌ Notifications failed")
        return 1
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run}")
    print(f"✅ Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())