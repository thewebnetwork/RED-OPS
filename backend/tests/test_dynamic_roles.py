"""
Test suite for Phase 1 Dynamic Roles System
Tests: Roles CRUD, role filtering, system role protection, user creation with dynamic roles
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDynamicRolesSystem:
    """Test suite for Dynamic Roles System - Phase 1"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    # ========== GET /api/roles Tests ==========
    
    def test_get_all_roles_returns_31_seeded_roles(self):
        """GET /api/roles should return all 31 seeded roles"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=self.headers)
        assert response.status_code == 200
        roles = response.json()
        assert len(roles) >= 31, f"Expected at least 31 roles, got {len(roles)}"
        
        # Verify role structure
        for role in roles:
            assert "id" in role
            assert "name" in role
            assert "display_name" in role
            assert "role_type" in role
            assert "can_pick_orders" in role
            assert "can_create_orders" in role
            assert "active" in role
    
    def test_get_service_provider_roles_returns_29(self):
        """GET /api/roles?role_type=service_provider should return 29 service providers"""
        response = requests.get(f"{BASE_URL}/api/roles?role_type=service_provider", headers=self.headers)
        assert response.status_code == 200
        roles = response.json()
        assert len(roles) == 29, f"Expected 29 service provider roles, got {len(roles)}"
        
        # Verify all are service providers
        for role in roles:
            assert role["role_type"] == "service_provider"
            assert role["can_pick_orders"] == True, f"Service provider {role['name']} should have can_pick_orders=True"
    
    def test_get_system_roles_returns_2(self):
        """GET /api/roles?role_type=system should return 2 system roles (Admin, Requester)"""
        response = requests.get(f"{BASE_URL}/api/roles?role_type=system", headers=self.headers)
        assert response.status_code == 200
        roles = response.json()
        assert len(roles) == 2, f"Expected 2 system roles, got {len(roles)}"
        
        role_names = [r["name"] for r in roles]
        assert "Admin" in role_names, "Admin role should exist"
        assert "Requester" in role_names, "Requester role should exist"
    
    def test_service_provider_roles_include_expected_roles(self):
        """Verify specific service provider roles exist"""
        response = requests.get(f"{BASE_URL}/api/roles?role_type=service_provider", headers=self.headers)
        assert response.status_code == 200
        roles = response.json()
        role_names = [r["name"] for r in roles]
        
        expected_roles = [
            "Editor", "Photographer", "Videographer", "DroneOperator",
            "GeneralContractor", "Electrician", "Plumber", "HVACTechnician",
            "GraphicDesigner", "SocialMediaManager", "SEOSpecialist", "Copywriter"
        ]
        
        for expected in expected_roles:
            assert expected in role_names, f"Expected role '{expected}' not found"
    
    # ========== POST /api/roles Tests ==========
    
    def test_create_custom_role(self):
        """POST /api/roles should create a new custom role"""
        role_data = {
            "name": "TEST_CustomRole",
            "display_name": "Test Custom Role",
            "description": "A test custom role for testing",
            "role_type": "custom",
            "icon": "briefcase",
            "color": "#3B82F6",
            "can_pick_orders": True,
            "can_create_orders": False
        }
        
        response = requests.post(f"{BASE_URL}/api/roles", json=role_data, headers=self.headers)
        assert response.status_code == 200
        
        created_role = response.json()
        assert created_role["name"] == role_data["name"]
        assert created_role["display_name"] == role_data["display_name"]
        assert created_role["role_type"] == "custom"
        assert created_role["can_pick_orders"] == True
        assert created_role["active"] == True
        
        # Cleanup - delete the test role
        requests.delete(f"{BASE_URL}/api/roles/{created_role['id']}", headers=self.headers)
    
    def test_create_duplicate_role_fails(self):
        """POST /api/roles with duplicate name should fail"""
        role_data = {
            "name": "Admin",
            "display_name": "Duplicate Admin",
            "role_type": "custom"
        }
        
        response = requests.post(f"{BASE_URL}/api/roles", json=role_data, headers=self.headers)
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
    
    # ========== PATCH /api/roles Tests ==========
    
    def test_update_non_system_role(self):
        """PATCH /api/roles/{id} should update non-system roles"""
        # First create a test role
        create_response = requests.post(f"{BASE_URL}/api/roles", json={
            "name": "TEST_UpdateRole",
            "display_name": "Test Update Role",
            "role_type": "custom"
        }, headers=self.headers)
        assert create_response.status_code == 200
        role_id = create_response.json()["id"]
        
        # Update the role
        update_response = requests.patch(f"{BASE_URL}/api/roles/{role_id}", json={
            "display_name": "Updated Display Name",
            "description": "Updated description"
        }, headers=self.headers)
        assert update_response.status_code == 200
        
        updated_role = update_response.json()
        assert updated_role["display_name"] == "Updated Display Name"
        assert updated_role["description"] == "Updated description"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/roles/{role_id}", headers=self.headers)
    
    def test_cannot_modify_system_roles(self):
        """PATCH /api/roles/{id} should fail for system roles"""
        # Get Admin role ID
        roles_response = requests.get(f"{BASE_URL}/api/roles?role_type=system", headers=self.headers)
        admin_role = [r for r in roles_response.json() if r["name"] == "Admin"][0]
        
        # Try to update Admin role
        update_response = requests.patch(f"{BASE_URL}/api/roles/{admin_role['id']}", json={
            "display_name": "Modified Admin"
        }, headers=self.headers)
        
        assert update_response.status_code == 400
        assert "Cannot modify system roles" in update_response.json()["detail"]
    
    # ========== DELETE /api/roles Tests ==========
    
    def test_delete_deactivates_role(self):
        """DELETE /api/roles/{id} should deactivate (soft delete) the role"""
        # Create a test role
        create_response = requests.post(f"{BASE_URL}/api/roles", json={
            "name": "TEST_DeleteRole",
            "display_name": "Test Delete Role",
            "role_type": "custom"
        }, headers=self.headers)
        assert create_response.status_code == 200
        role_id = create_response.json()["id"]
        
        # Delete the role
        delete_response = requests.delete(f"{BASE_URL}/api/roles/{role_id}", headers=self.headers)
        assert delete_response.status_code == 200
        assert "deactivated" in delete_response.json()["message"]
        
        # Verify role is deactivated (not in active_only list)
        roles_response = requests.get(f"{BASE_URL}/api/roles", headers=self.headers)
        active_role_ids = [r["id"] for r in roles_response.json()]
        assert role_id not in active_role_ids
    
    def test_cannot_delete_system_roles(self):
        """DELETE /api/roles/{id} should fail for system roles"""
        # Get Requester role ID
        roles_response = requests.get(f"{BASE_URL}/api/roles?role_type=system", headers=self.headers)
        requester_role = [r for r in roles_response.json() if r["name"] == "Requester"][0]
        
        # Try to delete Requester role
        delete_response = requests.delete(f"{BASE_URL}/api/roles/{requester_role['id']}", headers=self.headers)
        
        assert delete_response.status_code == 400
        assert "Cannot delete system roles" in delete_response.json()["detail"]
    
    # ========== User Creation with Dynamic Roles Tests ==========
    
    def test_create_user_with_service_provider_role(self):
        """POST /api/users should work with service provider roles"""
        user_data = {
            "name": "TEST Service Provider",
            "email": "test_sp_user@test.com",
            "password": "test123",
            "role": "Photographer"
        }
        
        response = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.headers)
        assert response.status_code == 200
        
        created_user = response.json()
        assert created_user["name"] == user_data["name"]
        assert created_user["email"] == user_data["email"]
        assert created_user["role"] == "Photographer"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{created_user['id']}", headers=self.headers)
    
    def test_create_user_with_invalid_role_fails(self):
        """POST /api/users with invalid role should fail"""
        user_data = {
            "name": "TEST Invalid Role User",
            "email": "test_invalid_role@test.com",
            "password": "test123",
            "role": "NonExistentRole"
        }
        
        response = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.headers)
        assert response.status_code == 400
        assert "does not exist" in response.json()["detail"]
    
    def test_update_user_role_to_service_provider(self):
        """PATCH /api/users/{id} should allow changing to service provider role"""
        # Create a test user
        create_response = requests.post(f"{BASE_URL}/api/users", json={
            "name": "TEST Role Change User",
            "email": "test_role_change@test.com",
            "password": "test123",
            "role": "Requester"
        }, headers=self.headers)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Update role to Electrician
        update_response = requests.patch(f"{BASE_URL}/api/users/{user_id}", json={
            "role": "Electrician"
        }, headers=self.headers)
        assert update_response.status_code == 200
        assert update_response.json()["role"] == "Electrician"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
    
    # ========== Service Provider Roles Endpoint Test ==========
    
    def test_get_service_providers_endpoint(self):
        """GET /api/roles/service-providers should return roles that can pick orders"""
        response = requests.get(f"{BASE_URL}/api/roles/service-providers", headers=self.headers)
        assert response.status_code == 200
        
        roles = response.json()
        assert len(roles) >= 29, f"Expected at least 29 service providers, got {len(roles)}"
        
        # All should have can_pick_orders=True
        for role in roles:
            assert role["can_pick_orders"] == True


class TestRolePermissions:
    """Test role permissions and capabilities"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_service_providers_have_can_pick_orders(self):
        """All service provider roles should have can_pick_orders=True"""
        response = requests.get(f"{BASE_URL}/api/roles?role_type=service_provider", headers=self.headers)
        assert response.status_code == 200
        
        for role in response.json():
            assert role["can_pick_orders"] == True, f"Role {role['name']} should have can_pick_orders=True"
    
    def test_system_roles_have_correct_permissions(self):
        """System roles should have correct permissions"""
        response = requests.get(f"{BASE_URL}/api/roles?role_type=system", headers=self.headers)
        assert response.status_code == 200
        
        roles = {r["name"]: r for r in response.json()}
        
        # Admin should be able to create orders
        assert roles["Admin"]["can_create_orders"] == True
        
        # Requester should be able to create orders
        assert roles["Requester"]["can_create_orders"] == True
        
        # Neither should pick orders
        assert roles["Admin"]["can_pick_orders"] == False
        assert roles["Requester"]["can_pick_orders"] == False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
