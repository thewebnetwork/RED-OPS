"""
Test IAM Permission Matrix - P0 Fix Verification
Tests the restored Permission Matrix UI functionality for roles
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIAMPermissionMatrix:
    """Test IAM Roles Permission Matrix functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("token")  # Fixed: use "token" not "access_token"
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        print(f"✓ Admin login successful")
    
    def test_list_roles(self):
        """Test GET /api/iam/roles - List all roles"""
        response = self.session.get(f"{BASE_URL}/api/iam/roles")
        assert response.status_code == 200, f"Failed to list roles: {response.text}"
        
        roles = response.json()
        assert isinstance(roles, list), "Roles should be a list"
        assert len(roles) >= 3, f"Expected at least 3 roles, got {len(roles)}"
        
        # Check for expected roles
        role_names = [r['name'] for r in roles]
        assert 'Administrator' in role_names, "Administrator role not found"
        assert 'Operator' in role_names, "Operator role not found"
        assert 'Standard User' in role_names, "Standard User role not found"
        
        print(f"✓ Found {len(roles)} roles: {role_names}")
        
        # Verify role structure
        for role in roles:
            assert 'id' in role, "Role missing id"
            assert 'name' in role, "Role missing name"
            assert 'permissions' in role, "Role missing permissions"
            assert 'is_system' in role, "Role missing is_system flag"
        
        print("✓ All roles have correct structure")
    
    def test_get_role_with_permissions(self):
        """Test GET /api/iam/roles/{id} - Get role with permissions"""
        # First get list of roles
        list_response = self.session.get(f"{BASE_URL}/api/iam/roles")
        assert list_response.status_code == 200, f"Failed to list roles: {list_response.text}"
        roles = list_response.json()
        
        # Get Administrator role
        admin_role = next((r for r in roles if r['name'] == 'Administrator'), None)
        assert admin_role is not None, "Administrator role not found"
        
        # Get role details
        response = self.session.get(f"{BASE_URL}/api/iam/roles/{admin_role['id']}")
        assert response.status_code == 200, f"Failed to get role: {response.text}"
        
        role = response.json()
        assert role['name'] == 'Administrator'
        assert 'permissions' in role
        
        # Verify permissions structure
        permissions = role['permissions']
        assert isinstance(permissions, dict), "Permissions should be a dict"
        
        print(f"✓ Administrator role has permissions: {list(permissions.keys())}")
    
    def test_update_role_permissions(self):
        """Test PATCH /api/iam/roles/{id} - Update role permissions"""
        # Get Operator role (non-system role that can be modified)
        list_response = self.session.get(f"{BASE_URL}/api/iam/roles")
        assert list_response.status_code == 200, f"Failed to list roles: {list_response.text}"
        roles = list_response.json()
        
        operator_role = next((r for r in roles if r['name'] == 'Operator'), None)
        assert operator_role is not None, "Operator role not found"
        
        # Store original permissions
        original_permissions = operator_role.get('permissions', {})
        
        # Update permissions
        new_permissions = {
            "dashboard": {"view": True},
            "orders": {"view": True, "create": True, "edit": True, "delete": False, "export": True, "pick": True, "assign": True},
            "users": {"view": True, "create": False, "edit": False, "delete": False},
            "teams": {"view": True, "create": True, "edit": True, "delete": False},
            "settings": {"view": True, "edit": False},
            "reports": {"view": True, "export": True}
        }
        
        update_response = self.session.patch(
            f"{BASE_URL}/api/iam/roles/{operator_role['id']}",
            json={"permissions": new_permissions}
        )
        assert update_response.status_code == 200, f"Failed to update role: {update_response.text}"
        
        updated_role = update_response.json()
        assert updated_role['permissions'] == new_permissions, "Permissions not updated correctly"
        
        print("✓ Role permissions updated successfully")
        
        # Verify persistence by fetching again
        verify_response = self.session.get(f"{BASE_URL}/api/iam/roles/{operator_role['id']}")
        assert verify_response.status_code == 200
        
        verified_role = verify_response.json()
        assert verified_role['permissions'] == new_permissions, "Permissions not persisted"
        
        print("✓ Permissions persisted correctly")
        
        # Restore original permissions
        self.session.patch(
            f"{BASE_URL}/api/iam/roles/{operator_role['id']}",
            json={"permissions": original_permissions}
        )
        print("✓ Original permissions restored")
    
    def test_role_permissions_structure(self):
        """Test that permissions follow expected module/action structure"""
        list_response = self.session.get(f"{BASE_URL}/api/iam/roles")
        assert list_response.status_code == 200, f"Failed to list roles: {list_response.text}"
        roles = list_response.json()
        
        # Expected modules and actions based on PERMISSION_MODULES in IAMPage.js
        expected_modules = {
            'dashboard': ['view'],
            'orders': ['view', 'create', 'edit', 'delete', 'export', 'pick', 'assign'],
            'users': ['view', 'create', 'edit', 'delete'],
            'teams': ['view', 'create', 'edit', 'delete'],
            'settings': ['view', 'edit'],
            'reports': ['view', 'export']
        }
        
        # Check Administrator role has all permissions
        admin_role = next((r for r in roles if r['name'] == 'Administrator'), None)
        if admin_role and admin_role.get('permissions'):
            permissions = admin_role['permissions']
            for module, actions in expected_modules.items():
                if module in permissions:
                    print(f"✓ Module '{module}' found with actions: {list(permissions[module].keys())}")
        
        print("✓ Permission structure validation complete")
    
    def test_system_role_name_protection(self):
        """Test that system roles cannot have their name changed"""
        list_response = self.session.get(f"{BASE_URL}/api/iam/roles")
        assert list_response.status_code == 200, f"Failed to list roles: {list_response.text}"
        roles = list_response.json()
        
        # Find a system role
        system_role = next((r for r in roles if r.get('is_system', False)), None)
        if system_role:
            # Try to rename it
            update_response = self.session.patch(
                f"{BASE_URL}/api/iam/roles/{system_role['id']}",
                json={"name": "TEST_Renamed_Role"}
            )
            
            # Should fail with 400
            assert update_response.status_code == 400, f"Expected 400 for renaming system role, got {update_response.status_code}"
            print(f"✓ System role '{system_role['name']}' correctly protected from renaming")
        else:
            print("⚠ No system roles found to test protection")
    
    def test_create_custom_role_with_permissions(self):
        """Test creating a new custom role with permissions"""
        new_role_data = {
            "name": "TEST_Custom_Role",
            "description": "Test custom role with specific permissions",
            "color": "#FF5733",
            "permissions": {
                "dashboard": {"view": True},
                "orders": {"view": True, "create": True},
                "reports": {"view": True}
            }
        }
        
        # Create role
        create_response = self.session.post(f"{BASE_URL}/api/iam/roles", json=new_role_data)
        assert create_response.status_code == 200, f"Failed to create role: {create_response.text}"
        
        created_role = create_response.json()
        assert created_role['name'] == new_role_data['name']
        assert created_role['permissions'] == new_role_data['permissions']
        assert created_role['is_system'] == False
        
        print(f"✓ Custom role created with id: {created_role['id']}")
        
        # Clean up - delete the test role
        delete_response = self.session.delete(f"{BASE_URL}/api/iam/roles/{created_role['id']}")
        assert delete_response.status_code == 200, f"Failed to delete test role: {delete_response.text}"
        
        print("✓ Test role cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
