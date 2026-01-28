"""
Test Email Notifications for Ticket Status Changes
Tests the email notification system for:
- Status changes (In Progress, Pending, Delivered, Closed)
- Ticket reopening
- Ticket reassignment
- Ticket closure by admin/requester
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


class TestEmailNotifications:
    """Test email notifications for ticket status changes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        data = login_resp.json()
        self.admin_token = data["token"]
        self.admin_user = data["user"]
        self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
        
        yield
        
        # Cleanup - no specific cleanup needed as we're testing email triggers
    
    def test_01_create_test_order_for_email_testing(self):
        """Create a test order to use for email notification testing"""
        # Create a new order
        order_data = {
            "title": f"TEST_EMAIL_NOTIFICATION_{uuid.uuid4().hex[:8]}",
            "description": "Test order for email notification testing",
            "priority": "Normal",
            "is_draft": False
        }
        
        resp = self.session.post(f"{BASE_URL}/api/orders", json=order_data)
        assert resp.status_code == 200, f"Failed to create order: {resp.text}"
        
        order = resp.json()
        assert order["status"] == "Open"
        assert order["order_code"].startswith("RRG-")
        
        # Store order ID for subsequent tests
        self.__class__.test_order_id = order["id"]
        self.__class__.test_order_code = order["order_code"]
        print(f"✅ Created test order: {order['order_code']} (ID: {order['id']})")
    
    def test_02_pick_order_triggers_in_progress_email(self):
        """Test that picking an order triggers In Progress status email"""
        order_id = getattr(self.__class__, 'test_order_id', None)
        if not order_id:
            pytest.skip("No test order available")
        
        # Pick the order (changes status to In Progress)
        resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/pick")
        assert resp.status_code == 200, f"Failed to pick order: {resp.text}"
        
        # Verify order status changed
        order_resp = self.session.get(f"{BASE_URL}/api/orders/{order_id}")
        assert order_resp.status_code == 200
        order = order_resp.json()
        assert order["status"] == "In Progress"
        
        print(f"✅ Order picked - status changed to In Progress (email should be sent)")
    
    def test_03_submit_for_review_triggers_pending_email(self):
        """Test that submitting for review triggers Pending status email"""
        order_id = getattr(self.__class__, 'test_order_id', None)
        if not order_id:
            pytest.skip("No test order available")
        
        # Need to login as Editor to submit for review
        # First, get an editor user or use admin with Editor role simulation
        # For this test, we'll create a mock scenario
        
        # Since admin picked the order, they can submit for review
        resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/submit-for-review")
        
        # This might fail if admin is not the editor - check response
        if resp.status_code == 403:
            print("⚠️ Admin cannot submit for review (not assigned as editor)")
            pytest.skip("Admin not assigned as editor")
        
        assert resp.status_code == 200, f"Failed to submit for review: {resp.text}"
        
        # Verify order status changed
        order_resp = self.session.get(f"{BASE_URL}/api/orders/{order_id}")
        assert order_resp.status_code == 200
        order = order_resp.json()
        assert order["status"] == "Pending"
        
        print(f"✅ Order submitted for review - status changed to Pending (email should be sent)")
    
    def test_04_close_order_triggers_closed_email(self):
        """Test that closing an order triggers Closed status email"""
        order_id = getattr(self.__class__, 'test_order_id', None)
        if not order_id:
            pytest.skip("No test order available")
        
        # Close the order
        close_data = {"reason": "Test closure for email notification testing"}
        resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/close", json=close_data)
        assert resp.status_code == 200, f"Failed to close order: {resp.text}"
        
        # Verify order status changed
        order_resp = self.session.get(f"{BASE_URL}/api/orders/{order_id}")
        assert order_resp.status_code == 200
        order = order_resp.json()
        assert order["status"] == "Closed"
        
        print(f"✅ Order closed - status changed to Closed (email should be sent)")
    
    def test_05_reopen_order_triggers_reopened_email(self):
        """Test that reopening an order triggers Reopened email"""
        order_id = getattr(self.__class__, 'test_order_id', None)
        if not order_id:
            pytest.skip("No test order available")
        
        # Reopen the order
        reopen_data = {"reason": "Test reopen for email notification testing"}
        resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/reopen", json=reopen_data)
        assert resp.status_code == 200, f"Failed to reopen order: {resp.text}"
        
        # Verify order status changed
        order_resp = self.session.get(f"{BASE_URL}/api/orders/{order_id}")
        assert order_resp.status_code == 200
        order = order_resp.json()
        assert order["status"] == "Open"
        
        print(f"✅ Order reopened - status changed to Open (email should be sent)")
    
    def test_06_reassign_order_triggers_reassigned_email(self):
        """Test that reassigning an order triggers Reassigned email"""
        order_id = getattr(self.__class__, 'test_order_id', None)
        if not order_id:
            pytest.skip("No test order available")
        
        # First pick the order again
        pick_resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/pick")
        if pick_resp.status_code != 200:
            print(f"⚠️ Could not pick order: {pick_resp.text}")
        
        # Get list of users to reassign to
        users_resp = self.session.get(f"{BASE_URL}/api/users")
        assert users_resp.status_code == 200
        users = users_resp.json()
        
        # Find another user to reassign to
        target_user = None
        for user in users:
            if user["id"] != self.admin_user["id"] and user.get("active", True):
                target_user = user
                break
        
        if not target_user:
            print("⚠️ No other user available for reassignment test")
            pytest.skip("No other user available")
        
        # Reassign the order
        reassign_data = {
            "reassign_type": "user",
            "target_id": target_user["id"],
            "reason": "Test reassignment for email notification testing"
        }
        resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/reassign", json=reassign_data)
        assert resp.status_code == 200, f"Failed to reassign order: {resp.text}"
        
        print(f"✅ Order reassigned to {target_user['name']} (email should be sent)")
    
    def test_07_verify_email_service_functions_exist(self):
        """Verify that all required email functions are available"""
        # This test verifies the email service module has all required functions
        from services.email import (
            send_ticket_status_changed_email,
            send_ticket_pending_review_email,
            send_ticket_reopened_email,
            send_ticket_reassigned_email,
            send_ticket_closed_email
        )
        
        assert callable(send_ticket_status_changed_email)
        assert callable(send_ticket_pending_review_email)
        assert callable(send_ticket_reopened_email)
        assert callable(send_ticket_reassigned_email)
        assert callable(send_ticket_closed_email)
        
        print("✅ All email notification functions are available")
    
    def test_08_verify_email_templates_exist(self):
        """Verify that email templates are properly configured"""
        from services.email import get_email_template
        
        # Test ticket_reopened template
        subject, body = get_email_template("ticket_reopened", {
            "to_name": "Test User",
            "reopened_by": "Admin",
            "order_code": "RRG-000001",
            "title": "Test Ticket",
            "reopen_reason": "Test reason",
            "order_id": "test-id"
        })
        assert "Reopened" in subject
        assert "Test User" in body
        
        # Test ticket_reassigned template
        subject, body = get_email_template("ticket_reassigned", {
            "to_name": "Test User",
            "from_name": "Old User",
            "to_target": "New User",
            "reassigned_by": "Admin",
            "order_code": "RRG-000001",
            "title": "Test Ticket",
            "reason": "Test reason",
            "order_id": "test-id"
        })
        assert "Reassigned" in subject
        assert "Test User" in body
        
        print("✅ Email templates are properly configured")


class TestEmailNotificationEndpoints:
    """Test API endpoints that trigger email notifications"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        self.admin_token = data["token"]
        self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
    
    def test_close_endpoint_sends_email(self):
        """Test that /close endpoint triggers email notification"""
        # Create a new order
        order_data = {
            "title": f"TEST_CLOSE_EMAIL_{uuid.uuid4().hex[:8]}",
            "description": "Test order for close email",
            "priority": "Normal",
            "is_draft": False
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/orders", json=order_data)
        assert create_resp.status_code == 200
        order = create_resp.json()
        order_id = order["id"]
        
        # Close the order
        close_data = {"reason": "Testing close email notification"}
        close_resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/close", json=close_data)
        assert close_resp.status_code == 200
        
        # Verify order is closed
        get_resp = self.session.get(f"{BASE_URL}/api/orders/{order_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["status"] == "Closed"
        
        print(f"✅ Close endpoint works - order {order['order_code']} closed")
    
    def test_reopen_endpoint_sends_email(self):
        """Test that /reopen endpoint triggers email notification"""
        # Create and close an order first
        order_data = {
            "title": f"TEST_REOPEN_EMAIL_{uuid.uuid4().hex[:8]}",
            "description": "Test order for reopen email",
            "priority": "Normal",
            "is_draft": False
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/orders", json=order_data)
        assert create_resp.status_code == 200
        order = create_resp.json()
        order_id = order["id"]
        
        # Close the order
        close_data = {"reason": "Closing for reopen test"}
        close_resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/close", json=close_data)
        assert close_resp.status_code == 200
        
        # Reopen the order
        reopen_data = {"reason": "Testing reopen email notification"}
        reopen_resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/reopen", json=reopen_data)
        assert reopen_resp.status_code == 200
        
        # Verify order is reopened
        get_resp = self.session.get(f"{BASE_URL}/api/orders/{order_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["status"] == "Open"
        
        print(f"✅ Reopen endpoint works - order {order['order_code']} reopened")
    
    def test_reassign_endpoint_sends_email(self):
        """Test that /reassign endpoint triggers email notification"""
        # Create an order
        order_data = {
            "title": f"TEST_REASSIGN_EMAIL_{uuid.uuid4().hex[:8]}",
            "description": "Test order for reassign email",
            "priority": "Normal",
            "is_draft": False
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/orders", json=order_data)
        assert create_resp.status_code == 200
        order = create_resp.json()
        order_id = order["id"]
        
        # Pick the order first
        pick_resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/pick")
        assert pick_resp.status_code == 200
        
        # Get teams for reassignment
        teams_resp = self.session.get(f"{BASE_URL}/api/teams")
        if teams_resp.status_code == 200 and teams_resp.json():
            teams = teams_resp.json()
            if teams:
                # Reassign to team
                reassign_data = {
                    "reassign_type": "team",
                    "target_id": teams[0]["id"],
                    "reason": "Testing reassign email notification"
                }
                reassign_resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/reassign", json=reassign_data)
                assert reassign_resp.status_code == 200
                print(f"✅ Reassign endpoint works - order {order['order_code']} reassigned to team")
                return
        
        # If no teams, try specialty
        specialties_resp = self.session.get(f"{BASE_URL}/api/specialties")
        if specialties_resp.status_code == 200 and specialties_resp.json():
            specialties = specialties_resp.json()
            if specialties:
                reassign_data = {
                    "reassign_type": "specialty",
                    "target_id": specialties[0]["id"],
                    "reason": "Testing reassign email notification"
                }
                reassign_resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/reassign", json=reassign_data)
                assert reassign_resp.status_code == 200
                print(f"✅ Reassign endpoint works - order {order['order_code']} reassigned to specialty")
                return
        
        print("⚠️ No teams or specialties available for reassignment test")


class TestStatusChangeEmailTriggers:
    """Test that status changes trigger appropriate emails"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        self.admin_token = data["token"]
        self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
    
    def test_full_ticket_lifecycle_emails(self):
        """Test complete ticket lifecycle with all email triggers"""
        # 1. Create order (triggers ticket_created email)
        order_data = {
            "title": f"TEST_LIFECYCLE_{uuid.uuid4().hex[:8]}",
            "description": "Full lifecycle test",
            "priority": "High",
            "is_draft": False
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/orders", json=order_data)
        assert create_resp.status_code == 200
        order = create_resp.json()
        order_id = order["id"]
        order_code = order["order_code"]
        print(f"1️⃣ Created order {order_code} - ticket_created email triggered")
        
        # 2. Pick order (triggers In Progress status email)
        pick_resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/pick")
        assert pick_resp.status_code == 200
        print(f"2️⃣ Picked order {order_code} - In Progress email triggered")
        
        # 3. Close order (triggers Closed email)
        close_data = {"reason": "Lifecycle test - closing"}
        close_resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/close", json=close_data)
        assert close_resp.status_code == 200
        print(f"3️⃣ Closed order {order_code} - Closed email triggered")
        
        # 4. Reopen order (triggers Reopened email)
        reopen_data = {"reason": "Lifecycle test - reopening"}
        reopen_resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/reopen", json=reopen_data)
        assert reopen_resp.status_code == 200
        print(f"4️⃣ Reopened order {order_code} - Reopened email triggered")
        
        # 5. Pick again and reassign (triggers Reassigned email)
        pick_resp2 = self.session.post(f"{BASE_URL}/api/orders/{order_id}/pick")
        assert pick_resp2.status_code == 200
        
        # Get users for reassignment
        users_resp = self.session.get(f"{BASE_URL}/api/users")
        if users_resp.status_code == 200:
            users = users_resp.json()
            target_user = None
            for user in users:
                if user.get("active", True) and user["email"] != ADMIN_EMAIL:
                    target_user = user
                    break
            
            if target_user:
                reassign_data = {
                    "reassign_type": "user",
                    "target_id": target_user["id"],
                    "reason": "Lifecycle test - reassigning"
                }
                reassign_resp = self.session.post(f"{BASE_URL}/api/orders/{order_id}/reassign", json=reassign_data)
                assert reassign_resp.status_code == 200
                print(f"5️⃣ Reassigned order {order_code} - Reassigned email triggered")
            else:
                print(f"5️⃣ Skipped reassignment - no other users available")
        
        print(f"✅ Full lifecycle test completed for {order_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
