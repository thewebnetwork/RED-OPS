"""
P0 Feature Tests - Message Notifications
Tests for:
- P0-1: Notifications on inbound messages
  - When requester sends message, resolver gets notified
  - If no resolver assigned, admins get notified
  - Notification contains ticket reference and message preview
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"
REQUESTER_EMAIL = "testrequester@test.com"
REQUESTER_PASSWORD = "Test123!"
EDITOR_EMAIL = "editor@test.com"
EDITOR_PASSWORD = "Test123!"


class TestMessageNotifications:
    """Test notifications when messages are sent on tickets"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.admin_token = None
        self.requester_token = None
        self.editor_token = None
        self.admin_user = None
        self.requester_user = None
        self.editor_user = None
        self.test_order_id = None
        
    def get_admin_token(self):
        """Login as admin and get token"""
        if self.admin_token:
            return self.admin_token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        self.admin_token = data["token"]
        self.admin_user = data["user"]
        return self.admin_token
    
    def get_editor_token(self):
        """Login as editor and get token"""
        if self.editor_token:
            return self.editor_token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EDITOR_EMAIL,
            "password": EDITOR_PASSWORD
        })
        if response.status_code != 200:
            # Create editor if doesn't exist
            admin_token = self.get_admin_token()
            create_resp = requests.post(
                f"{BASE_URL}/api/users",
                json={
                    "name": "Test Editor",
                    "email": EDITOR_EMAIL,
                    "password": EDITOR_PASSWORD,
                    "role": "Editor"
                },
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            if create_resp.status_code not in [200, 201, 400]:
                pytest.fail(f"Failed to create editor: {create_resp.text}")
            
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": EDITOR_EMAIL,
                "password": EDITOR_PASSWORD
            })
        
        assert response.status_code == 200, f"Editor login failed: {response.text}"
        data = response.json()
        self.editor_token = data["token"]
        self.editor_user = data["user"]
        return self.editor_token
    
    def get_requester_token(self):
        """Login as requester and get token"""
        if self.requester_token:
            return self.requester_token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": REQUESTER_EMAIL,
            "password": REQUESTER_PASSWORD
        })
        if response.status_code != 200:
            # Create requester if doesn't exist
            admin_token = self.get_admin_token()
            create_resp = requests.post(
                f"{BASE_URL}/api/users",
                json={
                    "name": "Test Requester",
                    "email": REQUESTER_EMAIL,
                    "password": REQUESTER_PASSWORD,
                    "role": "Requester"
                },
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            if create_resp.status_code not in [200, 201, 400]:  # 400 = already exists
                pytest.fail(f"Failed to create requester: {create_resp.text}")
            
            # Try login again
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": REQUESTER_EMAIL,
                "password": REQUESTER_PASSWORD
            })
        
        assert response.status_code == 200, f"Requester login failed: {response.text}"
        data = response.json()
        self.requester_token = data["token"]
        self.requester_user = data["user"]
        return self.requester_token
    
    def create_test_order(self, requester_token):
        """Create a test order as requester"""
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json={
                "title": "TEST_P0_Notification_Order",
                "description": "Test order for notification testing",
                "priority": "Normal"
            },
            headers={"Authorization": f"Bearer {requester_token}"}
        )
        assert response.status_code in [200, 201], f"Failed to create order: {response.text}"
        return response.json()
    
    def get_notifications(self, token):
        """Get notifications for current user"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed to get notifications: {response.text}"
        return response.json()
    
    def get_unread_count(self, token):
        """Get unread notification count"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed to get unread count: {response.text}"
        return response.json()["count"]
    
    def test_01_admin_login(self):
        """Test admin can login"""
        token = self.get_admin_token()
        assert token is not None
        print(f"SUCCESS: Admin logged in, user: {self.admin_user['name']}")
    
    def test_02_requester_login(self):
        """Test requester can login"""
        token = self.get_requester_token()
        assert token is not None
        print(f"SUCCESS: Requester logged in, user: {self.requester_user['name']}")
    
    def test_03_requester_message_notifies_admin_when_no_resolver(self):
        """P0-1: When requester sends message on unassigned ticket, admins get notified"""
        requester_token = self.get_requester_token()
        admin_token = self.get_admin_token()
        
        # Get admin's initial notification count
        initial_count = self.get_unread_count(admin_token)
        print(f"Admin initial unread count: {initial_count}")
        
        # Create a new order (unassigned)
        order = self.create_test_order(requester_token)
        order_id = order["id"]
        order_code = order["order_code"]
        print(f"Created test order: {order_code}")
        
        # Requester sends a message
        message_text = "TEST_P0_Message: Hello, I need help with this request!"
        response = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/messages",
            json={"message_body": message_text},
            headers={"Authorization": f"Bearer {requester_token}"}
        )
        assert response.status_code in [200, 201], f"Failed to send message: {response.text}"
        print(f"Requester sent message on unassigned ticket")
        
        # Check admin got notification
        time.sleep(0.5)  # Small delay for notification to be created
        new_count = self.get_unread_count(admin_token)
        print(f"Admin new unread count: {new_count}")
        
        # Get notifications and check content
        notifications = self.get_notifications(admin_token)
        
        # Find the notification for this order
        order_notifications = [n for n in notifications if n.get("related_order_id") == order_id]
        assert len(order_notifications) > 0, "Admin should have received notification for unassigned ticket message"
        
        latest_notif = order_notifications[0]
        assert "new_message" in latest_notif["type"], f"Notification type should be new_message, got: {latest_notif['type']}"
        assert order_code in latest_notif["message"], f"Notification should contain order code {order_code}"
        print(f"SUCCESS: Admin received notification: {latest_notif['title']}")
        print(f"Notification message: {latest_notif['message']}")
    
    def test_04_requester_message_notifies_resolver_when_assigned(self):
        """P0-1: When requester sends message on assigned ticket, resolver gets notified"""
        requester_token = self.get_requester_token()
        editor_token = self.get_editor_token()
        
        # Create a new order
        order = self.create_test_order(requester_token)
        order_id = order["id"]
        order_code = order["order_code"]
        print(f"Created test order: {order_code}")
        
        # Editor picks the order (becomes resolver)
        pick_response = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/pick",
            headers={"Authorization": f"Bearer {editor_token}"}
        )
        assert pick_response.status_code == 200, f"Failed to pick order: {pick_response.text}"
        print(f"Editor picked the order (now resolver)")
        
        # Get editor's notification count before message
        initial_count = self.get_unread_count(editor_token)
        print(f"Resolver initial unread count: {initial_count}")
        
        # Requester sends a message
        message_text = "TEST_P0_Message: Thanks for picking up my request!"
        response = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/messages",
            json={"message_body": message_text},
            headers={"Authorization": f"Bearer {requester_token}"}
        )
        assert response.status_code in [200, 201], f"Failed to send message: {response.text}"
        print(f"Requester sent message on assigned ticket")
        
        # Check resolver (editor) got notification
        time.sleep(0.5)
        new_count = self.get_unread_count(editor_token)
        print(f"Resolver new unread count: {new_count}")
        
        # Get notifications and verify
        notifications = self.get_notifications(editor_token)
        order_notifications = [n for n in notifications if n.get("related_order_id") == order_id and n["type"] == "new_message"]
        
        assert len(order_notifications) > 0, "Resolver should have received notification for message"
        
        latest_notif = order_notifications[0]
        assert order_code in latest_notif["message"], f"Notification should contain order code {order_code}"
        # Check message preview is included
        assert "TEST_P0_Message" in latest_notif["message"] or "Thanks" in latest_notif["message"], \
            "Notification should contain message preview"
        print(f"SUCCESS: Resolver received notification: {latest_notif['title']}")
        print(f"Notification message: {latest_notif['message']}")
    
    def test_05_resolver_message_notifies_requester(self):
        """P0-1: When resolver sends message, requester gets notified"""
        requester_token = self.get_requester_token()
        editor_token = self.get_editor_token()
        
        # Create a new order
        order = self.create_test_order(requester_token)
        order_id = order["id"]
        order_code = order["order_code"]
        print(f"Created test order: {order_code}")
        
        # Editor picks the order
        pick_response = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/pick",
            headers={"Authorization": f"Bearer {editor_token}"}
        )
        assert pick_response.status_code == 200, f"Failed to pick order: {pick_response.text}"
        print(f"Editor picked the order")
        
        # Get requester's notification count before message
        initial_count = self.get_unread_count(requester_token)
        print(f"Requester initial unread count: {initial_count}")
        
        # Resolver (editor) sends a message
        message_text = "TEST_P0_Message: I'm working on your request now!"
        response = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/messages",
            json={"message_body": message_text},
            headers={"Authorization": f"Bearer {editor_token}"}
        )
        assert response.status_code in [200, 201], f"Failed to send message: {response.text}"
        print(f"Resolver sent message to requester")
        
        # Check requester got notification
        time.sleep(0.5)
        new_count = self.get_unread_count(requester_token)
        print(f"Requester new unread count: {new_count}")
        
        # Get notifications and verify
        notifications = self.get_notifications(requester_token)
        order_notifications = [n for n in notifications if n.get("related_order_id") == order_id and n["type"] == "new_message"]
        
        assert len(order_notifications) > 0, "Requester should have received notification for resolver message"
        
        latest_notif = order_notifications[0]
        assert order_code in latest_notif["message"], f"Notification should contain order code {order_code}"
        print(f"SUCCESS: Requester received notification: {latest_notif['title']}")
        print(f"Notification message: {latest_notif['message']}")
    
    def test_06_notification_contains_ticket_reference(self):
        """P0-1: Verify notification contains ticket reference"""
        requester_token = self.get_requester_token()
        admin_token = self.get_admin_token()
        
        # Create order
        order = self.create_test_order(requester_token)
        order_id = order["id"]
        order_code = order["order_code"]
        
        # Send message
        requests.post(
            f"{BASE_URL}/api/orders/{order_id}/messages",
            json={"message_body": "Test message for ticket reference check"},
            headers={"Authorization": f"Bearer {requester_token}"}
        )
        
        time.sleep(0.5)
        notifications = self.get_notifications(admin_token)
        order_notifications = [n for n in notifications if n.get("related_order_id") == order_id]
        
        assert len(order_notifications) > 0, "Should have notification"
        notif = order_notifications[0]
        
        # Verify ticket reference
        assert notif["related_order_id"] == order_id, "Notification should have related_order_id"
        assert order_code in notif["message"], f"Notification message should contain order code {order_code}"
        print(f"SUCCESS: Notification contains ticket reference: {order_code}")
    
    def test_07_notification_contains_message_preview(self):
        """P0-1: Verify notification contains message preview"""
        requester_token = self.get_requester_token()
        admin_token = self.get_admin_token()
        
        # Create order
        order = self.create_test_order(requester_token)
        order_id = order["id"]
        
        # Send message with specific content
        test_message = "This is a unique test message for preview verification XYZ123"
        requests.post(
            f"{BASE_URL}/api/orders/{order_id}/messages",
            json={"message_body": test_message},
            headers={"Authorization": f"Bearer {requester_token}"}
        )
        
        time.sleep(0.5)
        notifications = self.get_notifications(admin_token)
        order_notifications = [n for n in notifications if n.get("related_order_id") == order_id]
        
        assert len(order_notifications) > 0, "Should have notification"
        notif = order_notifications[0]
        
        # Verify message preview (first 50 chars)
        assert "unique test message" in notif["message"] or "XYZ123" in notif["message"], \
            f"Notification should contain message preview. Got: {notif['message']}"
        print(f"SUCCESS: Notification contains message preview")
        print(f"Full notification message: {notif['message']}")
    
    def test_08_long_message_truncated_in_notification(self):
        """P0-1: Verify long messages are truncated in notification preview"""
        requester_token = self.get_requester_token()
        admin_token = self.get_admin_token()
        
        # Create order
        order = self.create_test_order(requester_token)
        order_id = order["id"]
        
        # Send a long message (>50 chars)
        long_message = "A" * 100 + " END_MARKER"  # 100 A's followed by END_MARKER
        requests.post(
            f"{BASE_URL}/api/orders/{order_id}/messages",
            json={"message_body": long_message},
            headers={"Authorization": f"Bearer {requester_token}"}
        )
        
        time.sleep(0.5)
        notifications = self.get_notifications(admin_token)
        order_notifications = [n for n in notifications if n.get("related_order_id") == order_id]
        
        assert len(order_notifications) > 0, "Should have notification"
        notif = order_notifications[0]
        
        # Verify message is truncated (should have ... and not contain END_MARKER)
        assert "END_MARKER" not in notif["message"], "Long message should be truncated"
        assert "..." in notif["message"], "Truncated message should have ellipsis"
        print(f"SUCCESS: Long message properly truncated in notification")


class TestNotificationEndpoints:
    """Test notification API endpoints"""
    
    def get_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_01_get_notifications(self):
        """Test GET /api/notifications endpoint"""
        token = self.get_admin_token()
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: GET /api/notifications returned {len(data)} notifications")
    
    def test_02_get_unread_count(self):
        """Test GET /api/notifications/unread-count endpoint"""
        token = self.get_admin_token()
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"SUCCESS: Unread count: {data['count']}")
    
    def test_03_mark_notification_read(self):
        """Test PATCH /api/notifications/{id}/read endpoint"""
        token = self.get_admin_token()
        
        # Get notifications
        notifs = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {token}"}
        ).json()
        
        if len(notifs) == 0:
            pytest.skip("No notifications to mark as read")
        
        notif_id = notifs[0]["id"]
        response = requests.patch(
            f"{BASE_URL}/api/notifications/{notif_id}/read",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        print(f"SUCCESS: Marked notification {notif_id} as read")
    
    def test_04_mark_all_read(self):
        """Test PATCH /api/notifications/read-all endpoint"""
        token = self.get_admin_token()
        response = requests.patch(
            f"{BASE_URL}/api/notifications/read-all",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        # Verify count is 0
        count_resp = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert count_resp.json()["count"] == 0
        print(f"SUCCESS: All notifications marked as read")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
