"""
IAM Refactor Tests - Testing the new 3-role system with Specialties, Access Tiers, and Permission Matrix
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
    
    def test_admin_login_success(self):
        """Test admin login returns new IAM structure"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify token exists
        assert "token" in data
        assert len(data["token"]) > 0
        
        # Verify user structure with new IAM fields
        user = data["user"]
        assert user["role"] == "Administrator"
        assert "permissions" in user
        assert "specialty_id" in user
        assert "access_tier_id" in user
        assert "team_id" in user
        
        # Verify permissions structure
        perms = user["permissions"]
        assert "dashboard" in perms
        assert "users" in perms
        assert "roles" in perms
        assert perms["users"]["view"] == True
        assert perms["users"]["create"] == True


@pytest.fixture
def auth_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Authentication failed")


@pytest.fixture
def auth_headers(auth_token):
    """Get auth headers"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestRolesAPI:
    """Test /api/roles endpoints - 3 fixed roles with permission matrix"""
    
    def test_list_roles_returns_3_system_roles(self, auth_headers):
        """GET /api/roles should return exactly 3 system roles"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=auth_headers)
        assert response.status_code == 200
        
        roles = response.json()
        assert len(roles) == 3
        
        role_names = [r["name"] for r in roles]
        assert "Administrator" in role_names
        assert "Privileged User" in role_names
        assert "Standard User" in role_names
    
    def test_roles_have_permission_matrix(self, auth_headers):
        """Each role should have a permissions object with modules"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=auth_headers)
        assert response.status_code == 200
        
        roles = response.json()
        for role in roles:
            assert "permissions" in role
            perms = role["permissions"]
            
            # Check required modules exist
            assert "dashboard" in perms
            assert "orders" in perms
            assert "users" in perms
            assert "teams" in perms
            assert "roles" in perms
            
            # Check actions exist
            assert "view" in perms["dashboard"]
            assert "view" in perms["orders"]
            assert "create" in perms["orders"]
            assert "edit" in perms["orders"]
    
    def test_administrator_has_full_permissions(self, auth_headers):
        """Administrator role should have all permissions enabled"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=auth_headers)
        assert response.status_code == 200
        
        admin_role = next(r for r in response.json() if r["name"] == "Administrator")
        perms = admin_role["permissions"]
        
        # All permissions should be True for admin
        assert perms["users"]["view"] == True
        assert perms["users"]["create"] == True
        assert perms["users"]["edit"] == True
        assert perms["users"]["delete"] == True
        assert perms["roles"]["view"] == True
        assert perms["roles"]["edit"] == True
    
    def test_standard_user_has_limited_permissions(self, auth_headers):
        """Standard User role should have limited permissions"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=auth_headers)
        assert response.status_code == 200
        
        std_role = next(r for r in response.json() if r["name"] == "Standard User")
        perms = std_role["permissions"]
        
        # Standard user should NOT have user management
        assert perms["users"]["view"] == False
        assert perms["users"]["create"] == False
        assert perms["roles"]["view"] == False
        
        # But should have basic access
        assert perms["dashboard"]["view"] == True
        assert perms["orders"]["view"] == True
        assert perms["orders"]["create"] == True
    
    def test_get_role_by_id(self, auth_headers):
        """GET /api/roles/{id} should return specific role"""
        # First get all roles
        response = requests.get(f"{BASE_URL}/api/roles", headers=auth_headers)
        roles = response.json()
        role_id = roles[0]["id"]
        
        # Get specific role
        response = requests.get(f"{BASE_URL}/api/roles/{role_id}", headers=auth_headers)
        assert response.status_code == 200
        
        role = response.json()
        assert role["id"] == role_id
        assert "permissions" in role
    
    def test_update_role_permissions(self, auth_headers):
        """PATCH /api/roles/{id} should update permissions"""
        # Get Standard User role
        response = requests.get(f"{BASE_URL}/api/roles", headers=auth_headers)
        std_role = next(r for r in response.json() if r["name"] == "Standard User")
        role_id = std_role["id"]
        
        # Get current permissions
        original_perms = std_role["permissions"].copy()
        
        # Toggle a permission
        new_perms = std_role["permissions"].copy()
        new_perms["logs"] = {"view": True, "export": False}
        
        response = requests.patch(
            f"{BASE_URL}/api/roles/{role_id}",
            headers=auth_headers,
            json={"permissions": new_perms}
        )
        assert response.status_code == 200
        
        # Verify change
        updated = response.json()
        assert updated["permissions"]["logs"]["view"] == True
        
        # Reset to original
        requests.patch(
            f"{BASE_URL}/api/roles/{role_id}",
            headers=auth_headers,
            json={"permissions": original_perms}
        )
    
    def test_reset_role_to_defaults(self, auth_headers):
        """POST /api/roles/reset-defaults/{id} should reset permissions"""
        # Get Standard User role
        response = requests.get(f"{BASE_URL}/api/roles", headers=auth_headers)
        std_role = next(r for r in response.json() if r["name"] == "Standard User")
        role_id = std_role["id"]
        
        # Reset to defaults
        response = requests.post(
            f"{BASE_URL}/api/roles/reset-defaults/{role_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert "message" in response.json()
    
    def test_get_permission_modules(self, auth_headers):
        """GET /api/roles/permissions/modules should return module definitions"""
        response = requests.get(f"{BASE_URL}/api/roles/permissions/modules", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "modules" in data
        
        modules = data["modules"]
        assert "dashboard" in modules
        assert "orders" in modules
        assert "users" in modules
        
        # Check module structure
        assert "label" in modules["dashboard"]
        assert "actions" in modules["dashboard"]


class TestSpecialtiesAPI:
    """Test /api/specialties endpoints"""
    
    def test_list_specialties(self, auth_headers):
        """GET /api/specialties should return list of specialties"""
        response = requests.get(f"{BASE_URL}/api/specialties", headers=auth_headers)
        assert response.status_code == 200
        
        specialties = response.json()
        assert isinstance(specialties, list)
        
        if len(specialties) > 0:
            spec = specialties[0]
            assert "id" in spec
            assert "name" in spec
            assert "user_count" in spec
    
    def test_create_specialty(self, auth_headers):
        """POST /api/specialties should create new specialty"""
        response = requests.post(
            f"{BASE_URL}/api/specialties",
            headers=auth_headers,
            json={"name": "TEST_IAM_Specialty", "description": "Test specialty for IAM"}
        )
        assert response.status_code == 200
        
        spec = response.json()
        assert spec["name"] == "TEST_IAM_Specialty"
        assert "id" in spec
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/specialties/{spec['id']}", headers=auth_headers)
    
    def test_create_duplicate_specialty_fails(self, auth_headers):
        """POST /api/specialties with duplicate name should fail"""
        # Create first
        response = requests.post(
            f"{BASE_URL}/api/specialties",
            headers=auth_headers,
            json={"name": "TEST_Duplicate_Specialty"}
        )
        spec_id = response.json()["id"]
        
        # Try duplicate
        response = requests.post(
            f"{BASE_URL}/api/specialties",
            headers=auth_headers,
            json={"name": "TEST_Duplicate_Specialty"}
        )
        assert response.status_code == 400
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/specialties/{spec_id}", headers=auth_headers)
    
    def test_delete_specialty(self, auth_headers):
        """DELETE /api/specialties/{id} should soft delete"""
        # Create
        response = requests.post(
            f"{BASE_URL}/api/specialties",
            headers=auth_headers,
            json={"name": "TEST_Delete_Specialty"}
        )
        spec_id = response.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/specialties/{spec_id}", headers=auth_headers)
        assert response.status_code == 200
        assert "message" in response.json()


class TestAccessTiersAPI:
    """Test /api/access-tiers endpoints"""
    
    def test_list_access_tiers(self, auth_headers):
        """GET /api/access-tiers should return list of tiers"""
        response = requests.get(f"{BASE_URL}/api/access-tiers", headers=auth_headers)
        assert response.status_code == 200
        
        tiers = response.json()
        assert isinstance(tiers, list)
        
        # Should have default tiers
        tier_names = [t["name"] for t in tiers]
        assert "Starter" in tier_names or len(tiers) > 0
    
    def test_create_access_tier(self, auth_headers):
        """POST /api/access-tiers should create new tier"""
        response = requests.post(
            f"{BASE_URL}/api/access-tiers",
            headers=auth_headers,
            json={"name": "TEST_IAM_Tier", "description": "Test tier for IAM"}
        )
        assert response.status_code == 200
        
        tier = response.json()
        assert tier["name"] == "TEST_IAM_Tier"
        assert "id" in tier
        assert "sort_order" in tier
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/access-tiers/{tier['id']}", headers=auth_headers)
    
    def test_create_duplicate_tier_fails(self, auth_headers):
        """POST /api/access-tiers with duplicate name should fail"""
        # Create first
        response = requests.post(
            f"{BASE_URL}/api/access-tiers",
            headers=auth_headers,
            json={"name": "TEST_Duplicate_Tier"}
        )
        tier_id = response.json()["id"]
        
        # Try duplicate
        response = requests.post(
            f"{BASE_URL}/api/access-tiers",
            headers=auth_headers,
            json={"name": "TEST_Duplicate_Tier"}
        )
        assert response.status_code == 400
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/access-tiers/{tier_id}", headers=auth_headers)
    
    def test_delete_access_tier(self, auth_headers):
        """DELETE /api/access-tiers/{id} should soft delete"""
        # Create
        response = requests.post(
            f"{BASE_URL}/api/access-tiers",
            headers=auth_headers,
            json={"name": "TEST_Delete_Tier"}
        )
        tier_id = response.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/access-tiers/{tier_id}", headers=auth_headers)
        assert response.status_code == 200
        assert "message" in response.json()


class TestUsersAPI:
    """Test /api/users endpoints with new IAM fields"""
    
    def test_list_users_has_iam_fields(self, auth_headers):
        """GET /api/users should return users with IAM fields"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        
        users = response.json()
        assert len(users) > 0
        
        user = users[0]
        # Check new IAM fields exist
        assert "role" in user
        assert "specialty_id" in user
        assert "specialty_name" in user
        assert "access_tier_id" in user
        assert "access_tier_name" in user
        assert "team_id" in user
        assert "team_name" in user
        assert "permissions" in user
        assert "permission_overrides" in user
    
    def test_create_user_with_iam_fields(self, auth_headers):
        """POST /api/users should create user with IAM fields"""
        # Get a specialty and tier for testing
        specs = requests.get(f"{BASE_URL}/api/specialties", headers=auth_headers).json()
        tiers = requests.get(f"{BASE_URL}/api/access-tiers", headers=auth_headers).json()
        
        spec_id = specs[0]["id"] if specs else None
        tier_id = tiers[0]["id"] if tiers else None
        
        response = requests.post(
            f"{BASE_URL}/api/users",
            headers=auth_headers,
            json={
                "name": "TEST_IAM_User",
                "email": "test_iam_user@example.com",
                "password": "TestPass123!",
                "role": "Standard User",
                "specialty_id": spec_id,
                "access_tier_id": tier_id
            }
        )
        assert response.status_code == 200
        
        user = response.json()
        assert user["name"] == "TEST_IAM_User"
        assert user["role"] == "Standard User"
        assert user["specialty_id"] == spec_id
        assert user["access_tier_id"] == tier_id
        assert "permissions" in user
        
        # Verify permissions match Standard User defaults
        assert user["permissions"]["users"]["view"] == False
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=auth_headers)
    
    def test_create_user_with_invalid_role_fails(self, auth_headers):
        """POST /api/users with invalid role should fail"""
        response = requests.post(
            f"{BASE_URL}/api/users",
            headers=auth_headers,
            json={
                "name": "TEST_Invalid_Role",
                "email": "test_invalid_role@example.com",
                "password": "TestPass123!",
                "role": "InvalidRole"
            }
        )
        assert response.status_code == 400
        assert "Invalid role" in response.json()["detail"]
    
    def test_update_user_role(self, auth_headers):
        """PATCH /api/users/{id} should update role"""
        # Create user
        response = requests.post(
            f"{BASE_URL}/api/users",
            headers=auth_headers,
            json={
                "name": "TEST_Role_Update",
                "email": "test_role_update@example.com",
                "password": "TestPass123!",
                "role": "Standard User"
            }
        )
        user_id = response.json()["id"]
        
        # Update role
        response = requests.patch(
            f"{BASE_URL}/api/users/{user_id}",
            headers=auth_headers,
            json={"role": "Privileged User"}
        )
        assert response.status_code == 200
        assert response.json()["role"] == "Privileged User"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
    
    def test_user_permission_overrides(self, auth_headers):
        """User should support permission_overrides"""
        # Create user with overrides
        response = requests.post(
            f"{BASE_URL}/api/users",
            headers=auth_headers,
            json={
                "name": "TEST_Perm_Override",
                "email": "test_perm_override@example.com",
                "password": "TestPass123!",
                "role": "Standard User",
                "permission_overrides": {
                    "logs": {"view": True, "export": True}
                }
            }
        )
        assert response.status_code == 200
        
        user = response.json()
        # Standard User normally can't view logs, but override should enable it
        assert user["permissions"]["logs"]["view"] == True
        assert user["permission_overrides"]["logs"]["view"] == True
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=auth_headers)
    
    def test_get_user_permissions_modules(self, auth_headers):
        """GET /api/users/permissions/modules should return module definitions"""
        response = requests.get(f"{BASE_URL}/api/users/permissions/modules", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "modules" in data
        assert "default_permissions" in data


class TestTeamsAPI:
    """Test /api/teams endpoints"""
    
    def test_list_teams(self, auth_headers):
        """GET /api/teams should return list of teams"""
        response = requests.get(f"{BASE_URL}/api/teams", headers=auth_headers)
        assert response.status_code == 200
        
        teams = response.json()
        assert isinstance(teams, list)


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
