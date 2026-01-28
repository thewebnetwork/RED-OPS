"""
Test suite for P0/P1 features:
- P0: Admin Ticket Soft-Delete with delete/restore functionality
- P1: SLA Policy Templates tab
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"

# Test order ID
TEST_ORDER_ID = "0b28908e-9f67-49bd-a9dd-341429a2f2b5"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Get headers with admin auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestSoftDeleteFeature:
    """P0: Admin Ticket Soft-Delete tests"""
    
    def test_get_order_before_delete(self, admin_headers):
        """Verify test order exists and is not deleted"""
        response = requests.get(
            f"{BASE_URL}/api/orders/{TEST_ORDER_ID}",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == TEST_ORDER_ID
        assert data.get("deleted") in [None, False]
        print(f"Order {data['order_code']} exists and is not deleted")
    
    def test_soft_delete_order(self, admin_headers):
        """Test soft-deleting an order"""
        response = requests.delete(
            f"{BASE_URL}/api/orders/{TEST_ORDER_ID}",
            headers=admin_headers,
            json={"reason": "Test deletion for pytest"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Ticket soft-deleted successfully"
        print("Order soft-deleted successfully")
    
    def test_deleted_order_in_list(self, admin_headers):
        """Verify deleted order appears in deleted list"""
        response = requests.get(
            f"{BASE_URL}/api/orders/deleted/list",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Find our test order in the deleted list
        deleted_order = next((o for o in data if o["id"] == TEST_ORDER_ID), None)
        assert deleted_order is not None, "Deleted order not found in deleted list"
        assert deleted_order["deleted"] == True
        assert deleted_order["deleted_by_name"] == "Admin"
        assert deleted_order["deletion_reason"] == "Test deletion for pytest"
        print(f"Found deleted order in list: {deleted_order['order_code']}")
    
    def test_restore_order(self, admin_headers):
        """Test restoring a deleted order"""
        response = requests.post(
            f"{BASE_URL}/api/orders/{TEST_ORDER_ID}/restore",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Ticket restored successfully"
        print("Order restored successfully")
    
    def test_restored_order_not_in_deleted_list(self, admin_headers):
        """Verify restored order is no longer in deleted list"""
        response = requests.get(
            f"{BASE_URL}/api/orders/deleted/list",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify our test order is NOT in the deleted list
        deleted_order = next((o for o in data if o["id"] == TEST_ORDER_ID), None)
        assert deleted_order is None, "Restored order should not be in deleted list"
        print("Restored order not in deleted list - correct!")
    
    def test_restored_order_accessible(self, admin_headers):
        """Verify restored order is accessible again"""
        response = requests.get(
            f"{BASE_URL}/api/orders/{TEST_ORDER_ID}",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == TEST_ORDER_ID
        assert data.get("deleted") == False
        print(f"Restored order {data['order_code']} is accessible")
    
    def test_soft_delete_requires_reason(self, admin_headers):
        """Test that soft-delete requires a reason"""
        response = requests.delete(
            f"{BASE_URL}/api/orders/{TEST_ORDER_ID}",
            headers=admin_headers,
            json={"reason": ""}  # Empty reason
        )
        # Should fail validation
        assert response.status_code in [400, 422]
        print("Empty reason correctly rejected")
    
    def test_cannot_delete_already_deleted(self, admin_headers):
        """Test that already deleted orders cannot be deleted again"""
        # First delete the order
        requests.delete(
            f"{BASE_URL}/api/orders/{TEST_ORDER_ID}",
            headers=admin_headers,
            json={"reason": "First deletion"}
        )
        
        # Try to delete again
        response = requests.delete(
            f"{BASE_URL}/api/orders/{TEST_ORDER_ID}",
            headers=admin_headers,
            json={"reason": "Second deletion attempt"}
        )
        assert response.status_code == 400
        assert "already deleted" in response.json().get("detail", "").lower()
        print("Cannot delete already deleted order - correct!")
        
        # Restore for other tests
        requests.post(
            f"{BASE_URL}/api/orders/{TEST_ORDER_ID}/restore",
            headers=admin_headers
        )
    
    def test_cannot_restore_non_deleted(self, admin_headers):
        """Test that non-deleted orders cannot be restored"""
        response = requests.post(
            f"{BASE_URL}/api/orders/{TEST_ORDER_ID}/restore",
            headers=admin_headers
        )
        assert response.status_code == 400
        assert "not deleted" in response.json().get("detail", "").lower()
        print("Cannot restore non-deleted order - correct!")


class TestSLAPoliciesEndpoints:
    """P1: SLA Policies API tests"""
    
    def test_get_sla_policies(self, admin_headers):
        """Test getting SLA policies list"""
        response = requests.get(
            f"{BASE_URL}/api/sla-policies",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} SLA policies")
    
    def test_get_monitoring_stats(self, admin_headers):
        """Test getting SLA monitoring stats"""
        response = requests.get(
            f"{BASE_URL}/api/sla-policies/monitoring/stats",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "orders" in data
        assert "on_track" in data["orders"]
        print(f"Monitoring stats: {data['orders']}")
    
    def test_get_at_risk_orders(self, admin_headers):
        """Test getting at-risk orders"""
        response = requests.get(
            f"{BASE_URL}/api/sla-policies/monitoring/at-risk",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} at-risk orders")
    
    def test_get_breached_orders(self, admin_headers):
        """Test getting breached orders"""
        response = requests.get(
            f"{BASE_URL}/api/sla-policies/monitoring/breached",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} breached orders")
    
    def test_get_escalation_history(self, admin_headers):
        """Test getting escalation history"""
        response = requests.get(
            f"{BASE_URL}/api/sla-policies/monitoring/history?limit=50",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} escalation history entries")


class TestReferenceDataEndpoints:
    """Test reference data endpoints used by SLA Templates"""
    
    def test_get_roles(self, admin_headers):
        """Test getting roles list"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"Found {len(data)} roles")
    
    def test_get_teams(self, admin_headers):
        """Test getting teams list"""
        response = requests.get(
            f"{BASE_URL}/api/teams",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} teams")
    
    def test_get_specialties(self, admin_headers):
        """Test getting specialties list"""
        response = requests.get(
            f"{BASE_URL}/api/specialties",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} specialties")
    
    def test_get_access_tiers(self, admin_headers):
        """Test getting access tiers list"""
        response = requests.get(
            f"{BASE_URL}/api/access-tiers",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} access tiers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
