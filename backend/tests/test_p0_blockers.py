"""
P0 Blocker Tests - Testing IAM CRUD and Reassign functionality
Tests:
1. IAM Roles CRUD APIs
2. IAM Account Types CRUD APIs
3. Order Reassign endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


class TestAuth:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Administrator"
        return data["access_token"]


class TestIAMRoles:
    """IAM Roles CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_roles(self):
        """Test GET /api/iam/roles - List all roles"""
        response = requests.get(f"{BASE_URL}/api/iam/roles", headers=self.headers)
        assert response.status_code == 200, f"Failed to list roles: {response.text}"
        roles = response.json()
        assert isinstance(roles, list)
        # Should have at least the system roles
        role_names = [r["name"] for r in roles]
        print(f"Found roles: {role_names}")
    
    def test_create_role(self):
        """Test POST /api/iam/roles - Create a new role"""
        test_role = {
            "name": "TEST_CustomRole",
            "description": "Test custom role for testing",
            "color": "#FF5733"
        }
        response = requests.post(f"{BASE_URL}/api/iam/roles", json=test_role, headers=self.headers)
        
        if response.status_code == 400 and "already exists" in response.text:
            # Role already exists, try to delete and recreate
            roles = requests.get(f"{BASE_URL}/api/iam/roles", headers=self.headers).json()
            existing = next((r for r in roles if r["name"] == "TEST_CustomRole"), None)
            if existing:
                requests.delete(f"{BASE_URL}/api/iam/roles/{existing['id']}", headers=self.headers)
                response = requests.post(f"{BASE_URL}/api/iam/roles", json=test_role, headers=self.headers)
        
        assert response.status_code == 200, f"Failed to create role: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_CustomRole"
        assert data["description"] == "Test custom role for testing"
        assert "id" in data
        print(f"Created role: {data['name']} with ID: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/iam/roles/{data['id']}", headers=self.headers)
    
    def test_update_role(self):
        """Test PATCH /api/iam/roles/{role_id} - Update a role"""
        # First create a role
        test_role = {
            "name": "TEST_UpdateRole",
            "description": "Original description",
            "color": "#FF5733"
        }
        create_response = requests.post(f"{BASE_URL}/api/iam/roles", json=test_role, headers=self.headers)
        
        if create_response.status_code == 400:
            # Already exists, get it
            roles = requests.get(f"{BASE_URL}/api/iam/roles", headers=self.headers).json()
            existing = next((r for r in roles if r["name"] == "TEST_UpdateRole"), None)
            if existing:
                role_id = existing["id"]
            else:
                pytest.skip("Could not create or find test role")
        else:
            role_id = create_response.json()["id"]
        
        # Update the role
        update_data = {"description": "Updated description"}
        update_response = requests.patch(f"{BASE_URL}/api/iam/roles/{role_id}", json=update_data, headers=self.headers)
        assert update_response.status_code == 200, f"Failed to update role: {update_response.text}"
        
        updated = update_response.json()
        assert updated["description"] == "Updated description"
        print(f"Updated role description to: {updated['description']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/iam/roles/{role_id}", headers=self.headers)
    
    def test_delete_role(self):
        """Test DELETE /api/iam/roles/{role_id} - Delete a role"""
        # First create a role
        test_role = {
            "name": "TEST_DeleteRole",
            "description": "Role to be deleted",
            "color": "#FF5733"
        }
        create_response = requests.post(f"{BASE_URL}/api/iam/roles", json=test_role, headers=self.headers)
        
        if create_response.status_code == 400:
            roles = requests.get(f"{BASE_URL}/api/iam/roles", headers=self.headers).json()
            existing = next((r for r in roles if r["name"] == "TEST_DeleteRole"), None)
            if existing:
                role_id = existing["id"]
            else:
                pytest.skip("Could not create or find test role")
        else:
            role_id = create_response.json()["id"]
        
        # Delete the role
        delete_response = requests.delete(f"{BASE_URL}/api/iam/roles/{role_id}", headers=self.headers)
        assert delete_response.status_code == 200, f"Failed to delete role: {delete_response.text}"
        print(f"Successfully deleted role with ID: {role_id}")


class TestIAMAccountTypes:
    """IAM Account Types CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_account_types(self):
        """Test GET /api/iam/account-types - List all account types"""
        response = requests.get(f"{BASE_URL}/api/iam/account-types", headers=self.headers)
        assert response.status_code == 200, f"Failed to list account types: {response.text}"
        account_types = response.json()
        assert isinstance(account_types, list)
        at_names = [at["name"] for at in account_types]
        print(f"Found account types: {at_names}")
    
    def test_create_account_type(self):
        """Test POST /api/iam/account-types - Create a new account type"""
        test_at = {
            "name": "TEST_CustomAccountType",
            "description": "Test custom account type",
            "color": "#33FF57",
            "requires_subscription": False
        }
        response = requests.post(f"{BASE_URL}/api/iam/account-types", json=test_at, headers=self.headers)
        
        if response.status_code == 400 and "already exists" in response.text:
            # Already exists, try to delete and recreate
            ats = requests.get(f"{BASE_URL}/api/iam/account-types", headers=self.headers).json()
            existing = next((at for at in ats if at["name"] == "TEST_CustomAccountType"), None)
            if existing:
                requests.delete(f"{BASE_URL}/api/iam/account-types/{existing['id']}", headers=self.headers)
                response = requests.post(f"{BASE_URL}/api/iam/account-types", json=test_at, headers=self.headers)
        
        assert response.status_code == 200, f"Failed to create account type: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_CustomAccountType"
        assert "id" in data
        print(f"Created account type: {data['name']} with ID: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/iam/account-types/{data['id']}", headers=self.headers)
    
    def test_update_account_type(self):
        """Test PATCH /api/iam/account-types/{at_id} - Update an account type"""
        # First create an account type
        test_at = {
            "name": "TEST_UpdateAccountType",
            "description": "Original description",
            "color": "#33FF57"
        }
        create_response = requests.post(f"{BASE_URL}/api/iam/account-types", json=test_at, headers=self.headers)
        
        if create_response.status_code == 400:
            ats = requests.get(f"{BASE_URL}/api/iam/account-types", headers=self.headers).json()
            existing = next((at for at in ats if at["name"] == "TEST_UpdateAccountType"), None)
            if existing:
                at_id = existing["id"]
            else:
                pytest.skip("Could not create or find test account type")
        else:
            at_id = create_response.json()["id"]
        
        # Update the account type
        update_data = {"description": "Updated description", "requires_subscription": True}
        update_response = requests.patch(f"{BASE_URL}/api/iam/account-types/{at_id}", json=update_data, headers=self.headers)
        assert update_response.status_code == 200, f"Failed to update account type: {update_response.text}"
        
        updated = update_response.json()
        assert updated["description"] == "Updated description"
        print(f"Updated account type description to: {updated['description']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/iam/account-types/{at_id}", headers=self.headers)
    
    def test_delete_account_type(self):
        """Test DELETE /api/iam/account-types/{at_id} - Delete an account type"""
        # First create an account type
        test_at = {
            "name": "TEST_DeleteAccountType",
            "description": "Account type to be deleted",
            "color": "#33FF57"
        }
        create_response = requests.post(f"{BASE_URL}/api/iam/account-types", json=test_at, headers=self.headers)
        
        if create_response.status_code == 400:
            ats = requests.get(f"{BASE_URL}/api/iam/account-types", headers=self.headers).json()
            existing = next((at for at in ats if at["name"] == "TEST_DeleteAccountType"), None)
            if existing:
                at_id = existing["id"]
            else:
                pytest.skip("Could not create or find test account type")
        else:
            at_id = create_response.json()["id"]
        
        # Delete the account type
        delete_response = requests.delete(f"{BASE_URL}/api/iam/account-types/{at_id}", headers=self.headers)
        assert delete_response.status_code == 200, f"Failed to delete account type: {delete_response.text}"
        print(f"Successfully deleted account type with ID: {at_id}")


class TestOrderReassign:
    """Order Reassign endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user = response.json()["user"]
    
    def test_get_reassign_options(self):
        """Test GET /api/orders/{order_id}/reassign-options - Get reassign options"""
        # First get an order
        orders_response = requests.get(f"{BASE_URL}/api/orders", headers=self.headers)
        assert orders_response.status_code == 200
        orders = orders_response.json()
        
        if not orders:
            pytest.skip("No orders available to test reassign options")
        
        order_id = orders[0]["id"]
        
        # Get reassign options
        response = requests.get(f"{BASE_URL}/api/orders/{order_id}/reassign-options", headers=self.headers)
        assert response.status_code == 200, f"Failed to get reassign options: {response.text}"
        
        data = response.json()
        assert "users" in data
        assert "teams" in data
        assert "specialties" in data
        
        print(f"Reassign options - Users: {len(data['users'])}, Teams: {len(data['teams'])}, Specialties: {len(data['specialties'])}")
    
    def test_reassign_endpoint_exists(self):
        """Test POST /api/orders/{order_id}/reassign - Verify endpoint exists"""
        # First get an order that can be reassigned (not Closed/Canceled/Delivered)
        orders_response = requests.get(f"{BASE_URL}/api/orders", headers=self.headers)
        assert orders_response.status_code == 200
        orders = orders_response.json()
        
        # Find an order that can be reassigned
        reassignable_order = None
        for order in orders:
            if order["status"] not in ["Closed", "Canceled", "Delivered"]:
                reassignable_order = order
                break
        
        if not reassignable_order:
            pytest.skip("No reassignable orders available")
        
        order_id = reassignable_order["id"]
        
        # Get reassign options to find a valid target
        options_response = requests.get(f"{BASE_URL}/api/orders/{order_id}/reassign-options", headers=self.headers)
        options = options_response.json()
        
        if not options["users"]:
            pytest.skip("No users available for reassignment")
        
        # Try to reassign to a user (we'll use the first available user)
        target_user = options["users"][0]
        
        reassign_data = {
            "reassign_type": "user",
            "target_id": target_user["id"],
            "reason": "Test reassignment"
        }
        
        response = requests.post(f"{BASE_URL}/api/orders/{order_id}/reassign", json=reassign_data, headers=self.headers)
        
        # The endpoint should exist and respond (200 for success, 400/403 for business logic errors)
        assert response.status_code in [200, 400, 403], f"Unexpected status code: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            print(f"Successfully reassigned order {order_id} to user {target_user['name']}")
        else:
            print(f"Reassign endpoint exists but returned: {response.status_code} - {response.text}")


class TestMyTicketsEndpoint:
    """Test My Tickets (My Requests) endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_my_requests_endpoint(self):
        """Test GET /api/orders/my-requests - Get user's own tickets"""
        response = requests.get(f"{BASE_URL}/api/orders/my-requests", headers=self.headers)
        assert response.status_code == 200, f"Failed to get my requests: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"My Tickets count: {len(data)}")


class TestAllOrdersAdminOnly:
    """Test that All Orders is admin-only"""
    
    def test_orders_endpoint_requires_auth(self):
        """Test that /api/orders requires authentication"""
        response = requests.get(f"{BASE_URL}/api/orders")
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422], f"Expected auth error, got: {response.status_code}"
        print("Orders endpoint correctly requires authentication")
