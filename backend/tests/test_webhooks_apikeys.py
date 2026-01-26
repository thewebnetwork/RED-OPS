"""
Test suite for Webhooks and API Keys functionality (P2-3)
Tests:
- Webhook CRUD operations
- Webhook test functionality
- Webhook triggers on order.created event
- Webhook logs
- API Keys CRUD
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"

class TestWebhooksAndApiKeys:
    """Test suite for Webhooks and API Keys"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json()["token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        # Cleanup - delete test webhooks and API keys
        self._cleanup_test_data()
    
    def _cleanup_test_data(self):
        """Clean up test data created during tests"""
        try:
            # Get all webhooks and delete TEST_ prefixed ones
            webhooks_res = self.session.get(f"{BASE_URL}/api/webhooks")
            if webhooks_res.status_code == 200:
                for webhook in webhooks_res.json():
                    if webhook.get("name", "").startswith("TEST_"):
                        self.session.delete(f"{BASE_URL}/api/webhooks/{webhook['id']}")
            
            # Get all API keys and delete TEST_ prefixed ones
            keys_res = self.session.get(f"{BASE_URL}/api/api-keys")
            if keys_res.status_code == 200:
                for key in keys_res.json():
                    if key.get("name", "").startswith("TEST_"):
                        self.session.delete(f"{BASE_URL}/api/api-keys/{key['id']}")
        except Exception as e:
            print(f"Cleanup error: {e}")
    
    # ============== API KEYS TESTS ==============
    
    def test_list_api_keys(self):
        """Test listing API keys"""
        response = self.session.get(f"{BASE_URL}/api/api-keys")
        assert response.status_code == 200, f"Failed to list API keys: {response.text}"
        assert isinstance(response.json(), list), "Response should be a list"
        print(f"✓ List API keys: Found {len(response.json())} keys")
    
    def test_create_api_key_read_only(self):
        """Test creating a read-only API key"""
        response = self.session.post(f"{BASE_URL}/api/api-keys", json={
            "name": "TEST_ReadOnlyKey",
            "permissions": "read"
        })
        assert response.status_code == 200, f"Failed to create API key: {response.text}"
        data = response.json()
        assert "key" in data, "Response should contain the generated key"
        assert "id" in data, "Response should contain the key ID"
        assert data["key"].startswith("rr_read_"), f"Read-only key should start with rr_read_, got: {data['key'][:15]}"
        print(f"✓ Create read-only API key: {data['key'][:20]}...")
        
        # Verify key appears in list
        list_response = self.session.get(f"{BASE_URL}/api/api-keys")
        assert list_response.status_code == 200
        keys = list_response.json()
        created_key = next((k for k in keys if k["id"] == data["id"]), None)
        assert created_key is not None, "Created key should appear in list"
        assert created_key["permissions"] == "read", "Key should have read permissions"
        print(f"✓ Verified key in list with correct permissions")
    
    def test_create_api_key_read_write(self):
        """Test creating a read-write API key"""
        response = self.session.post(f"{BASE_URL}/api/api-keys", json={
            "name": "TEST_ReadWriteKey",
            "permissions": "read_write"
        })
        assert response.status_code == 200, f"Failed to create API key: {response.text}"
        data = response.json()
        assert data["key"].startswith("rr_live_"), f"Read-write key should start with rr_live_, got: {data['key'][:15]}"
        print(f"✓ Create read-write API key: {data['key'][:20]}...")
    
    def test_delete_api_key(self):
        """Test deleting an API key"""
        # First create a key
        create_response = self.session.post(f"{BASE_URL}/api/api-keys", json={
            "name": "TEST_ToDeleteKey",
            "permissions": "read"
        })
        assert create_response.status_code == 200
        key_id = create_response.json()["id"]
        
        # Delete the key
        delete_response = self.session.delete(f"{BASE_URL}/api/api-keys/{key_id}")
        assert delete_response.status_code == 200, f"Failed to delete API key: {delete_response.text}"
        print(f"✓ Delete API key: {key_id}")
        
        # Verify key is removed from list
        list_response = self.session.get(f"{BASE_URL}/api/api-keys")
        keys = list_response.json()
        deleted_key = next((k for k in keys if k["id"] == key_id), None)
        assert deleted_key is None, "Deleted key should not appear in list"
        print(f"✓ Verified key removed from list")
    
    def test_delete_nonexistent_api_key(self):
        """Test deleting a non-existent API key returns 404"""
        response = self.session.delete(f"{BASE_URL}/api/api-keys/nonexistent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Delete non-existent API key returns 404")
    
    # ============== WEBHOOKS TESTS ==============
    
    def test_list_webhooks(self):
        """Test listing webhooks"""
        response = self.session.get(f"{BASE_URL}/api/webhooks")
        assert response.status_code == 200, f"Failed to list webhooks: {response.text}"
        assert isinstance(response.json(), list), "Response should be a list"
        print(f"✓ List webhooks: Found {len(response.json())} webhooks")
    
    def test_create_webhook_outgoing(self):
        """Test creating an outgoing webhook"""
        response = self.session.post(f"{BASE_URL}/api/webhooks", json={
            "name": "TEST_OutgoingWebhook",
            "url": "https://httpbin.org/post",
            "direction": "outgoing",
            "events": ["order.created", "order.updated"],
            "is_active": True
        })
        assert response.status_code == 200, f"Failed to create webhook: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_OutgoingWebhook"
        assert data["url"] == "https://httpbin.org/post"
        assert data["direction"] == "outgoing"
        assert "order.created" in data["events"]
        assert "order.updated" in data["events"]
        assert data["is_active"] == True
        assert "id" in data
        assert "created_at" in data
        print(f"✓ Create outgoing webhook: {data['id']}")
        return data["id"]
    
    def test_create_webhook_incoming(self):
        """Test creating an incoming webhook"""
        response = self.session.post(f"{BASE_URL}/api/webhooks", json={
            "name": "TEST_IncomingWebhook",
            "url": "https://example.com/incoming",
            "direction": "incoming",
            "events": ["external.event"],
            "is_active": False
        })
        assert response.status_code == 200, f"Failed to create webhook: {response.text}"
        data = response.json()
        assert data["direction"] == "incoming"
        assert data["is_active"] == False
        print(f"✓ Create incoming webhook: {data['id']}")
    
    def test_update_webhook_toggle_active(self):
        """Test toggling webhook active status"""
        # Create a webhook first
        create_response = self.session.post(f"{BASE_URL}/api/webhooks", json={
            "name": "TEST_ToggleWebhook",
            "url": "https://httpbin.org/post",
            "direction": "outgoing",
            "events": ["order.created"],
            "is_active": True
        })
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        
        # Toggle to inactive
        update_response = self.session.patch(f"{BASE_URL}/api/webhooks/{webhook_id}", json={
            "is_active": False
        })
        assert update_response.status_code == 200, f"Failed to update webhook: {update_response.text}"
        print(f"✓ Toggle webhook to inactive")
        
        # Verify the change
        list_response = self.session.get(f"{BASE_URL}/api/webhooks")
        webhooks = list_response.json()
        updated_webhook = next((w for w in webhooks if w["id"] == webhook_id), None)
        assert updated_webhook is not None
        assert updated_webhook["is_active"] == False, "Webhook should be inactive"
        print(f"✓ Verified webhook is inactive")
        
        # Toggle back to active
        update_response2 = self.session.patch(f"{BASE_URL}/api/webhooks/{webhook_id}", json={
            "is_active": True
        })
        assert update_response2.status_code == 200
        print(f"✓ Toggle webhook back to active")
    
    def test_delete_webhook(self):
        """Test deleting a webhook"""
        # Create a webhook first
        create_response = self.session.post(f"{BASE_URL}/api/webhooks", json={
            "name": "TEST_ToDeleteWebhook",
            "url": "https://httpbin.org/post",
            "direction": "outgoing",
            "events": [],
            "is_active": True
        })
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        
        # Delete the webhook
        delete_response = self.session.delete(f"{BASE_URL}/api/webhooks/{webhook_id}")
        assert delete_response.status_code == 200, f"Failed to delete webhook: {delete_response.text}"
        print(f"✓ Delete webhook: {webhook_id}")
        
        # Verify webhook is removed
        list_response = self.session.get(f"{BASE_URL}/api/webhooks")
        webhooks = list_response.json()
        deleted_webhook = next((w for w in webhooks if w["id"] == webhook_id), None)
        assert deleted_webhook is None, "Deleted webhook should not appear in list"
        print(f"✓ Verified webhook removed from list")
    
    def test_delete_nonexistent_webhook(self):
        """Test deleting a non-existent webhook returns 404"""
        response = self.session.delete(f"{BASE_URL}/api/webhooks/nonexistent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Delete non-existent webhook returns 404")
    
    # ============== WEBHOOK TEST FUNCTIONALITY ==============
    
    def test_send_test_webhook_success(self):
        """Test sending a test webhook to httpbin.org (should succeed)"""
        # Create a webhook pointing to httpbin.org
        create_response = self.session.post(f"{BASE_URL}/api/webhooks", json={
            "name": "TEST_HttpbinWebhook",
            "url": "https://httpbin.org/post",
            "direction": "outgoing",
            "events": ["order.created"],
            "is_active": True
        })
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        
        # Send test webhook
        test_response = self.session.post(f"{BASE_URL}/api/webhooks/{webhook_id}/test")
        assert test_response.status_code == 200, f"Failed to send test webhook: {test_response.text}"
        data = test_response.json()
        assert data["success"] == True, f"Test webhook should succeed, got: {data}"
        assert data["status_code"] == 200, f"Expected status 200, got: {data['status_code']}"
        print(f"✓ Test webhook sent successfully (status: {data['status_code']})")
    
    def test_send_test_webhook_failure(self):
        """Test sending a test webhook to invalid URL (should fail gracefully)"""
        # Create a webhook pointing to invalid URL
        create_response = self.session.post(f"{BASE_URL}/api/webhooks", json={
            "name": "TEST_InvalidUrlWebhook",
            "url": "https://invalid-url-that-does-not-exist-12345.com/webhook",
            "direction": "outgoing",
            "events": ["order.created"],
            "is_active": True
        })
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        
        # Send test webhook - should fail but not crash
        test_response = self.session.post(f"{BASE_URL}/api/webhooks/{webhook_id}/test")
        assert test_response.status_code == 200, f"Test endpoint should return 200 even on failure: {test_response.text}"
        data = test_response.json()
        assert data["success"] == False, "Test webhook should fail for invalid URL"
        assert "error" in data, "Response should contain error message"
        print(f"✓ Test webhook failed gracefully: {data.get('error', 'Unknown error')[:50]}...")
    
    def test_test_nonexistent_webhook(self):
        """Test sending test to non-existent webhook returns 404"""
        response = self.session.post(f"{BASE_URL}/api/webhooks/nonexistent-id-12345/test")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Test non-existent webhook returns 404")
    
    # ============== WEBHOOK LOGS TESTS ==============
    
    def test_get_webhook_logs(self):
        """Test getting webhook logs for a specific webhook"""
        # Create a webhook and send a test
        create_response = self.session.post(f"{BASE_URL}/api/webhooks", json={
            "name": "TEST_LogsWebhook",
            "url": "https://httpbin.org/post",
            "direction": "outgoing",
            "events": ["order.created"],
            "is_active": True
        })
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        
        # Send test webhook to generate a log
        self.session.post(f"{BASE_URL}/api/webhooks/{webhook_id}/test")
        
        # Get logs for this webhook
        logs_response = self.session.get(f"{BASE_URL}/api/webhooks/{webhook_id}/logs")
        assert logs_response.status_code == 200, f"Failed to get webhook logs: {logs_response.text}"
        logs = logs_response.json()
        assert isinstance(logs, list), "Logs should be a list"
        assert len(logs) >= 1, "Should have at least one log entry"
        
        # Verify log structure
        log = logs[0]
        assert "id" in log
        assert "webhook_id" in log
        assert "webhook_name" in log
        assert "event" in log
        assert "url" in log
        assert "status_code" in log
        assert "success" in log
        assert "timestamp" in log
        print(f"✓ Get webhook logs: Found {len(logs)} log entries")
    
    def test_list_all_webhook_logs(self):
        """Test listing all webhook logs"""
        response = self.session.get(f"{BASE_URL}/api/webhook-logs")
        assert response.status_code == 200, f"Failed to list webhook logs: {response.text}"
        logs = response.json()
        assert isinstance(logs, list), "Logs should be a list"
        print(f"✓ List all webhook logs: Found {len(logs)} log entries")
    
    # ============== WEBHOOK TRIGGER ON ORDER CREATED ==============
    
    def test_webhook_triggers_on_order_created(self):
        """Test that webhooks fire when an order is created"""
        # Create a webhook listening for order.created
        create_webhook_response = self.session.post(f"{BASE_URL}/api/webhooks", json={
            "name": "TEST_OrderCreatedWebhook",
            "url": "https://httpbin.org/post",
            "direction": "outgoing",
            "events": ["order.created"],
            "is_active": True
        })
        assert create_webhook_response.status_code == 200
        webhook_id = create_webhook_response.json()["id"]
        
        # Get initial log count for this webhook
        initial_logs_response = self.session.get(f"{BASE_URL}/api/webhooks/{webhook_id}/logs")
        initial_log_count = len(initial_logs_response.json())
        
        # Create an order to trigger the webhook
        order_response = self.session.post(f"{BASE_URL}/api/orders", json={
            "title": "TEST_WebhookTriggerOrder",
            "description": "Test order to trigger webhook",
            "priority": "Normal"
        })
        assert order_response.status_code == 200, f"Failed to create order: {order_response.text}"
        order_code = order_response.json()["order_code"]
        print(f"✓ Created order: {order_code}")
        
        # Wait for webhook to be triggered (background task)
        time.sleep(3)
        
        # Check if webhook was triggered by looking at logs
        logs_response = self.session.get(f"{BASE_URL}/api/webhooks/{webhook_id}/logs")
        assert logs_response.status_code == 200
        logs = logs_response.json()
        new_log_count = len(logs)
        
        # Verify a new log was created
        assert new_log_count > initial_log_count, f"Expected new log entry after order creation. Initial: {initial_log_count}, Current: {new_log_count}"
        
        # Find the order.created log
        order_created_log = next((log for log in logs if log["event"] == "order.created"), None)
        assert order_created_log is not None, "Should have an order.created log entry"
        assert order_created_log["success"] == True, f"Webhook should have succeeded: {order_created_log}"
        print(f"✓ Webhook triggered on order.created event (status: {order_created_log['status_code']})")


class TestWebhooksUnauthorized:
    """Test that webhook endpoints require authentication"""
    
    def test_list_webhooks_unauthorized(self):
        """Test that listing webhooks requires auth"""
        response = requests.get(f"{BASE_URL}/api/webhooks")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ List webhooks requires authentication")
    
    def test_create_webhook_unauthorized(self):
        """Test that creating webhooks requires auth"""
        response = requests.post(f"{BASE_URL}/api/webhooks", json={
            "name": "Unauthorized",
            "url": "https://example.com",
            "direction": "outgoing",
            "events": []
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Create webhook requires authentication")
    
    def test_list_api_keys_unauthorized(self):
        """Test that listing API keys requires auth"""
        response = requests.get(f"{BASE_URL}/api/api-keys")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ List API keys requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
