"""
Test suite for Escalation Policy CRUD and related endpoints
Tests: /api/escalation/policies, /api/escalation/orders, /api/escalation/stats, /api/escalation/check
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


class TestEscalationSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get authenticated headers"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestEscalationStats(TestEscalationSetup):
    """Test escalation statistics endpoint"""
    
    def test_get_escalation_stats(self, headers):
        """GET /api/escalation/stats - should return stats object"""
        response = requests.get(f"{BASE_URL}/api/escalation/stats", headers=headers)
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        
        data = response.json()
        # Verify expected fields
        assert "escalations_today" in data
        assert "escalations_this_week" in data
        assert "unacknowledged" in data
        assert "by_trigger" in data
        assert "active_policies" in data
        assert "currently_escalated_orders" in data
        
        # Verify data types
        assert isinstance(data["escalations_today"], int)
        assert isinstance(data["escalations_this_week"], int)
        assert isinstance(data["active_policies"], int)
        print(f"Stats: {data}")


class TestEscalationPolicyCRUD(TestEscalationSetup):
    """Test escalation policy CRUD operations"""
    
    def test_list_policies_empty_or_existing(self, headers):
        """GET /api/escalation/policies - should return list"""
        response = requests.get(f"{BASE_URL}/api/escalation/policies", headers=headers)
        assert response.status_code == 200, f"Failed to list policies: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} existing policies")
    
    def test_create_policy_minimal(self, headers):
        """POST /api/escalation/policies - create with minimal data"""
        unique_name = f"TEST_Policy_{uuid.uuid4().hex[:8]}"
        policy_data = {
            "name": unique_name,
            "description": "Test policy for automated testing",
            "trigger": "both",
            "category_l1_ids": [],
            "category_l2_ids": [],
            "priorities": [],
            "levels": [
                {
                    "level": 1,
                    "name": "Initial Alert",
                    "time_threshold_minutes": 0,
                    "actions": [],
                    "notify_message": "Order {order_code} requires attention"
                }
            ],
            "cooldown_minutes": 30,
            "is_active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/escalation/policies", headers=headers, json=policy_data)
        assert response.status_code == 200, f"Failed to create policy: {response.text}"
        
        data = response.json()
        assert data["name"] == unique_name
        assert data["trigger"] == "both"
        assert len(data["levels"]) == 1
        assert "id" in data
        
        # Store for cleanup
        self.__class__.created_policy_id = data["id"]
        self.__class__.created_policy_name = unique_name
        print(f"Created policy: {data['id']}")
        return data["id"]
    
    def test_create_policy_with_actions(self, headers):
        """POST /api/escalation/policies - create with actions"""
        unique_name = f"TEST_Policy_Actions_{uuid.uuid4().hex[:8]}"
        policy_data = {
            "name": unique_name,
            "description": "Test policy with multiple levels and actions",
            "trigger": "sla_breach",
            "category_l1_ids": [],
            "category_l2_ids": [],
            "priorities": ["High", "Urgent"],
            "levels": [
                {
                    "level": 1,
                    "name": "Initial Alert",
                    "time_threshold_minutes": 0,
                    "actions": [
                        {"type": "notify_role", "target_role_id": "", "target_role_name": "Admin"}
                    ],
                    "notify_message": "Order {order_code} escalated to Level 1"
                },
                {
                    "level": 2,
                    "name": "Manager Escalation",
                    "time_threshold_minutes": 60,
                    "actions": [
                        {"type": "change_priority", "new_priority": "Urgent"}
                    ],
                    "notify_message": "Order {order_code} escalated to Level 2"
                }
            ],
            "cooldown_minutes": 15,
            "is_active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/escalation/policies", headers=headers, json=policy_data)
        assert response.status_code == 200, f"Failed to create policy with actions: {response.text}"
        
        data = response.json()
        assert data["name"] == unique_name
        assert data["trigger"] == "sla_breach"
        assert len(data["levels"]) == 2
        assert data["priorities"] == ["High", "Urgent"]
        
        self.__class__.created_policy_with_actions_id = data["id"]
        print(f"Created policy with actions: {data['id']}")
    
    def test_create_policy_duplicate_name_fails(self, headers):
        """POST /api/escalation/policies - duplicate name should fail"""
        # First create a policy
        unique_name = f"TEST_Duplicate_{uuid.uuid4().hex[:8]}"
        policy_data = {
            "name": unique_name,
            "trigger": "both",
            "levels": [{"level": 1, "name": "Alert", "time_threshold_minutes": 0, "actions": []}],
            "cooldown_minutes": 30,
            "is_active": True
        }
        
        response1 = requests.post(f"{BASE_URL}/api/escalation/policies", headers=headers, json=policy_data)
        assert response1.status_code == 200
        first_id = response1.json()["id"]
        
        # Try to create another with same name
        response2 = requests.post(f"{BASE_URL}/api/escalation/policies", headers=headers, json=policy_data)
        assert response2.status_code == 400, "Should fail with duplicate name"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/escalation/policies/{first_id}", headers=headers)
        print("Duplicate name validation works correctly")
    
    def test_get_policy_by_id(self, headers):
        """GET /api/escalation/policies/{id} - get specific policy"""
        # First create a policy
        unique_name = f"TEST_GetById_{uuid.uuid4().hex[:8]}"
        policy_data = {
            "name": unique_name,
            "trigger": "sla_warning",
            "levels": [{"level": 1, "name": "Alert", "time_threshold_minutes": 0, "actions": []}],
            "cooldown_minutes": 30,
            "is_active": True
        }
        
        create_response = requests.post(f"{BASE_URL}/api/escalation/policies", headers=headers, json=policy_data)
        assert create_response.status_code == 200
        policy_id = create_response.json()["id"]
        
        # Get by ID
        get_response = requests.get(f"{BASE_URL}/api/escalation/policies/{policy_id}", headers=headers)
        assert get_response.status_code == 200, f"Failed to get policy: {get_response.text}"
        
        data = get_response.json()
        assert data["id"] == policy_id
        assert data["name"] == unique_name
        assert data["trigger"] == "sla_warning"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/escalation/policies/{policy_id}", headers=headers)
        print(f"Get by ID works correctly")
    
    def test_get_policy_not_found(self, headers):
        """GET /api/escalation/policies/{id} - non-existent ID should return 404"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/escalation/policies/{fake_id}", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("404 for non-existent policy works correctly")
    
    def test_update_policy(self, headers):
        """PUT /api/escalation/policies/{id} - update policy"""
        # First create a policy
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        policy_data = {
            "name": unique_name,
            "description": "Original description",
            "trigger": "both",
            "levels": [{"level": 1, "name": "Alert", "time_threshold_minutes": 0, "actions": []}],
            "cooldown_minutes": 30,
            "is_active": True
        }
        
        create_response = requests.post(f"{BASE_URL}/api/escalation/policies", headers=headers, json=policy_data)
        assert create_response.status_code == 200
        policy_id = create_response.json()["id"]
        
        # Update the policy
        update_data = {
            "description": "Updated description",
            "cooldown_minutes": 45,
            "is_active": False
        }
        
        update_response = requests.put(f"{BASE_URL}/api/escalation/policies/{policy_id}", headers=headers, json=update_data)
        assert update_response.status_code == 200, f"Failed to update policy: {update_response.text}"
        
        updated = update_response.json()
        assert updated["description"] == "Updated description"
        assert updated["cooldown_minutes"] == 45
        assert updated["is_active"] == False
        assert updated["name"] == unique_name  # Name unchanged
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/escalation/policies/{policy_id}?active_only=false", headers=headers)
        # Note: inactive policies may not be returned with active_only=true
        
        # Cleanup - reactivate first then delete
        requests.put(f"{BASE_URL}/api/escalation/policies/{policy_id}", headers=headers, json={"is_active": True})
        requests.delete(f"{BASE_URL}/api/escalation/policies/{policy_id}", headers=headers)
        print("Update policy works correctly")
    
    def test_delete_policy(self, headers):
        """DELETE /api/escalation/policies/{id} - soft delete policy"""
        # First create a policy
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:8]}"
        policy_data = {
            "name": unique_name,
            "trigger": "both",
            "levels": [{"level": 1, "name": "Alert", "time_threshold_minutes": 0, "actions": []}],
            "cooldown_minutes": 30,
            "is_active": True
        }
        
        create_response = requests.post(f"{BASE_URL}/api/escalation/policies", headers=headers, json=policy_data)
        assert create_response.status_code == 200
        policy_id = create_response.json()["id"]
        
        # Delete the policy
        delete_response = requests.delete(f"{BASE_URL}/api/escalation/policies/{policy_id}", headers=headers)
        assert delete_response.status_code == 200, f"Failed to delete policy: {delete_response.text}"
        
        data = delete_response.json()
        assert data["message"] == "Policy deleted"
        
        # Verify it's not in active list
        list_response = requests.get(f"{BASE_URL}/api/escalation/policies", headers=headers)
        policies = list_response.json()
        policy_ids = [p["id"] for p in policies]
        assert policy_id not in policy_ids, "Deleted policy should not appear in active list"
        
        print("Delete policy works correctly (soft delete)")


class TestEscalatedOrders(TestEscalationSetup):
    """Test escalated orders endpoints"""
    
    def test_get_escalated_orders(self, headers):
        """GET /api/escalation/orders - should return list"""
        response = requests.get(f"{BASE_URL}/api/escalation/orders", headers=headers)
        assert response.status_code == 200, f"Failed to get escalated orders: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} escalated orders")
        
        # If there are escalated orders, verify structure
        if len(data) > 0:
            order = data[0]
            assert "order_id" in order
            assert "order_code" in order
            assert "current_escalation_level" in order
    
    def test_get_escalated_orders_count(self, headers):
        """GET /api/escalation/orders/count - should return count object"""
        response = requests.get(f"{BASE_URL}/api/escalation/orders/count", headers=headers)
        assert response.status_code == 200, f"Failed to get count: {response.text}"
        
        data = response.json()
        assert "total" in data
        assert "by_level" in data
        assert isinstance(data["total"], int)
        assert isinstance(data["by_level"], dict)
        print(f"Escalated orders count: {data}")
    
    def test_get_escalated_orders_by_level(self, headers):
        """GET /api/escalation/orders?level=1 - filter by level"""
        response = requests.get(f"{BASE_URL}/api/escalation/orders?level=1", headers=headers)
        assert response.status_code == 200, f"Failed to filter by level: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        # All returned orders should be level 1
        for order in data:
            assert order["current_escalation_level"] == 1
        print(f"Found {len(data)} level 1 escalated orders")


class TestEscalationCheck(TestEscalationSetup):
    """Test manual escalation check trigger"""
    
    def test_trigger_escalation_check(self, headers):
        """POST /api/escalation/check - trigger manual check"""
        response = requests.post(f"{BASE_URL}/api/escalation/check", headers=headers)
        assert response.status_code == 200, f"Failed to trigger check: {response.text}"
        
        data = response.json()
        assert data["message"] == "Escalation check completed"
        print("Escalation check triggered successfully")


class TestEscalationHistory(TestEscalationSetup):
    """Test escalation history endpoints"""
    
    def test_get_order_escalation_history_not_found(self, headers):
        """GET /api/escalation/history/{order_id} - non-existent order returns empty list"""
        fake_order_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/escalation/history/{fake_order_id}", headers=headers)
        assert response.status_code == 200, f"Failed to get history: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
        print("Empty history for non-existent order works correctly")


class TestEscalationValidation(TestEscalationSetup):
    """Test validation and edge cases"""
    
    def test_create_policy_missing_name(self, headers):
        """POST /api/escalation/policies - missing name should fail"""
        policy_data = {
            "trigger": "both",
            "levels": [{"level": 1, "name": "Alert", "time_threshold_minutes": 0, "actions": []}],
            "cooldown_minutes": 30
        }
        
        response = requests.post(f"{BASE_URL}/api/escalation/policies", headers=headers, json=policy_data)
        assert response.status_code == 422, f"Expected 422 for missing name, got {response.status_code}"
        print("Validation for missing name works correctly")
    
    def test_create_policy_invalid_trigger(self, headers):
        """POST /api/escalation/policies - invalid trigger should fail"""
        policy_data = {
            "name": f"TEST_InvalidTrigger_{uuid.uuid4().hex[:8]}",
            "trigger": "invalid_trigger",
            "levels": [{"level": 1, "name": "Alert", "time_threshold_minutes": 0, "actions": []}],
            "cooldown_minutes": 30
        }
        
        response = requests.post(f"{BASE_URL}/api/escalation/policies", headers=headers, json=policy_data)
        assert response.status_code == 422, f"Expected 422 for invalid trigger, got {response.status_code}"
        print("Validation for invalid trigger works correctly")
    
    def test_create_policy_cooldown_too_low(self, headers):
        """POST /api/escalation/policies - cooldown < 5 should fail"""
        policy_data = {
            "name": f"TEST_LowCooldown_{uuid.uuid4().hex[:8]}",
            "trigger": "both",
            "levels": [{"level": 1, "name": "Alert", "time_threshold_minutes": 0, "actions": []}],
            "cooldown_minutes": 2  # Below minimum of 5
        }
        
        response = requests.post(f"{BASE_URL}/api/escalation/policies", headers=headers, json=policy_data)
        assert response.status_code == 422, f"Expected 422 for low cooldown, got {response.status_code}"
        print("Validation for cooldown minimum works correctly")


class TestCleanup(TestEscalationSetup):
    """Cleanup test data"""
    
    def test_cleanup_test_policies(self, headers):
        """Clean up all TEST_ prefixed policies"""
        response = requests.get(f"{BASE_URL}/api/escalation/policies?active_only=false", headers=headers)
        if response.status_code == 200:
            policies = response.json()
            for policy in policies:
                if policy["name"].startswith("TEST_"):
                    delete_response = requests.delete(
                        f"{BASE_URL}/api/escalation/policies/{policy['id']}", 
                        headers=headers
                    )
                    if delete_response.status_code == 200:
                        print(f"Cleaned up policy: {policy['name']}")
        print("Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
