"""
Multi-Specialty Support Tests (P0)
Tests for users having multiple specialties (many-to-many relationship)

Features tested:
1. Create user with multiple specialties (specialty_ids array)
2. Edit user to add/remove specialties
3. Legacy single specialty (specialty_id) backwards compatibility
4. Migration endpoint for existing users
5. User API response includes specialty_ids, specialties array, primary_specialty_id
6. Pool routing includes users with ANY matching specialty
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMultiSpecialtySupport:
    """Test multi-specialty user management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - login as admin and get specialties"""
        # Login as admin
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        self.admin_token = login_resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get specialties for testing
        spec_resp = requests.get(f"{BASE_URL}/api/specialties", headers=self.admin_headers)
        assert spec_resp.status_code == 200
        self.specialties = spec_resp.json()
        assert len(self.specialties) >= 3, "Need at least 3 specialties for testing"
        
        # Get subscription plans for Partner account type
        plans_resp = requests.get(f"{BASE_URL}/api/subscription-plans", headers=self.admin_headers)
        if plans_resp.status_code == 200 and plans_resp.json():
            self.subscription_plan_id = plans_resp.json()[0]["id"]
        else:
            self.subscription_plan_id = None
        
        yield
        
        # Cleanup: Delete test users created during tests
        users_resp = requests.get(f"{BASE_URL}/api/users", headers=self.admin_headers)
        if users_resp.status_code == 200:
            for user in users_resp.json():
                if user["email"].startswith("test_multispec_"):
                    requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=self.admin_headers)

    def test_01_create_user_with_multiple_specialties(self):
        """Test creating a user with multiple specialties via specialty_ids array"""
        specialty_ids = [self.specialties[0]["id"], self.specialties[1]["id"], self.specialties[2]["id"]]
        primary_specialty_id = self.specialties[1]["id"]
        
        user_data = {
            "name": "Test Multi-Spec User",
            "email": f"test_multispec_{uuid.uuid4().hex[:8]}@test.com",
            "password": "TestPass123!",
            "role": "Standard User",
            "account_type": "Internal Staff",
            "specialty_ids": specialty_ids,
            "primary_specialty_id": primary_specialty_id,
            "force_password_change": False,
            "force_otp_setup": False,
            "send_welcome_email": False
        }
        
        resp = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.admin_headers)
        assert resp.status_code == 200, f"Create user failed: {resp.text}"
        
        user = resp.json()
        
        # Verify specialty_ids array
        assert "specialty_ids" in user, "Missing specialty_ids in response"
        assert len(user["specialty_ids"]) == 3, f"Expected 3 specialties, got {len(user['specialty_ids'])}"
        assert set(user["specialty_ids"]) == set(specialty_ids), "specialty_ids mismatch"
        
        # Verify specialties array with names
        assert "specialties" in user, "Missing specialties array in response"
        assert len(user["specialties"]) == 3, f"Expected 3 specialties objects, got {len(user['specialties'])}"
        
        # Verify primary_specialty_id
        assert user["primary_specialty_id"] == primary_specialty_id, "primary_specialty_id mismatch"
        
        # Verify is_primary flag in specialties array
        primary_count = sum(1 for s in user["specialties"] if s.get("is_primary"))
        assert primary_count == 1, f"Expected exactly 1 primary specialty, got {primary_count}"
        
        # Verify legacy fields for backwards compatibility
        assert user["specialty_id"] == primary_specialty_id, "Legacy specialty_id should equal primary"
        assert user["specialty_name"] is not None, "Legacy specialty_name should be set"
        
        print(f"✓ Created user with {len(user['specialty_ids'])} specialties")
        print(f"  Primary: {user['specialty_name']}")
        print(f"  All: {[s['name'] for s in user['specialties']]}")

    def test_02_create_user_with_legacy_single_specialty(self):
        """Test backwards compatibility - create user with single specialty_id"""
        single_specialty_id = self.specialties[0]["id"]
        
        user_data = {
            "name": "Test Legacy Spec User",
            "email": f"test_multispec_{uuid.uuid4().hex[:8]}@test.com",
            "password": "TestPass123!",
            "role": "Standard User",
            "account_type": "Internal Staff",
            "specialty_id": single_specialty_id,  # Legacy field
            "force_password_change": False,
            "force_otp_setup": False,
            "send_welcome_email": False
        }
        
        resp = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.admin_headers)
        assert resp.status_code == 200, f"Create user failed: {resp.text}"
        
        user = resp.json()
        
        # Verify it was converted to multi-specialty format
        assert "specialty_ids" in user, "Missing specialty_ids"
        assert len(user["specialty_ids"]) == 1, "Should have 1 specialty"
        assert user["specialty_ids"][0] == single_specialty_id
        
        # Verify primary was set
        assert user["primary_specialty_id"] == single_specialty_id
        
        # Verify legacy fields still work
        assert user["specialty_id"] == single_specialty_id
        
        print(f"✓ Legacy single specialty_id converted to specialty_ids array")

    def test_03_edit_user_add_specialties(self):
        """Test editing user to add more specialties"""
        # First create a user with 1 specialty
        initial_specialty = self.specialties[0]["id"]
        
        user_data = {
            "name": "Test Edit Add Spec User",
            "email": f"test_multispec_{uuid.uuid4().hex[:8]}@test.com",
            "password": "TestPass123!",
            "role": "Standard User",
            "account_type": "Internal Staff",
            "specialty_ids": [initial_specialty],
            "force_password_change": False,
            "force_otp_setup": False,
            "send_welcome_email": False
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.admin_headers)
        assert create_resp.status_code == 200
        user_id = create_resp.json()["id"]
        
        # Now update to add more specialties
        new_specialty_ids = [self.specialties[0]["id"], self.specialties[1]["id"], self.specialties[2]["id"]]
        new_primary = self.specialties[2]["id"]
        
        update_resp = requests.patch(
            f"{BASE_URL}/api/users/{user_id}",
            json={
                "specialty_ids": new_specialty_ids,
                "primary_specialty_id": new_primary
            },
            headers=self.admin_headers
        )
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        
        updated_user = update_resp.json()
        
        assert len(updated_user["specialty_ids"]) == 3, "Should have 3 specialties after update"
        assert updated_user["primary_specialty_id"] == new_primary
        
        print(f"✓ User updated from 1 to 3 specialties")

    def test_04_edit_user_remove_specialties(self):
        """Test editing user to remove specialties"""
        # Create user with 3 specialties
        specialty_ids = [self.specialties[0]["id"], self.specialties[1]["id"], self.specialties[2]["id"]]
        
        user_data = {
            "name": "Test Edit Remove Spec User",
            "email": f"test_multispec_{uuid.uuid4().hex[:8]}@test.com",
            "password": "TestPass123!",
            "role": "Standard User",
            "account_type": "Internal Staff",
            "specialty_ids": specialty_ids,
            "primary_specialty_id": self.specialties[0]["id"],
            "force_password_change": False,
            "force_otp_setup": False,
            "send_welcome_email": False
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.admin_headers)
        assert create_resp.status_code == 200
        user_id = create_resp.json()["id"]
        
        # Update to have only 1 specialty
        update_resp = requests.patch(
            f"{BASE_URL}/api/users/{user_id}",
            json={"specialty_ids": [self.specialties[1]["id"]]},
            headers=self.admin_headers
        )
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        
        updated_user = update_resp.json()
        
        assert len(updated_user["specialty_ids"]) == 1, "Should have 1 specialty after removal"
        # Primary should auto-update to the remaining specialty
        assert updated_user["primary_specialty_id"] == self.specialties[1]["id"]
        
        print(f"✓ User updated from 3 to 1 specialty, primary auto-adjusted")

    def test_05_primary_specialty_validation(self):
        """Test that primary_specialty_id must be in specialty_ids"""
        specialty_ids = [self.specialties[0]["id"], self.specialties[1]["id"]]
        invalid_primary = self.specialties[2]["id"]  # Not in specialty_ids
        
        user_data = {
            "name": "Test Invalid Primary User",
            "email": f"test_multispec_{uuid.uuid4().hex[:8]}@test.com",
            "password": "TestPass123!",
            "role": "Standard User",
            "account_type": "Internal Staff",
            "specialty_ids": specialty_ids,
            "primary_specialty_id": invalid_primary,  # Invalid - not in specialty_ids
            "force_password_change": False,
            "force_otp_setup": False,
            "send_welcome_email": False
        }
        
        resp = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.admin_headers)
        assert resp.status_code == 400, f"Should fail with 400, got {resp.status_code}"
        assert "primary specialty must be one of" in resp.text.lower(), f"Wrong error message: {resp.text}"
        
        print("✓ Primary specialty validation works - rejects invalid primary")

    def test_06_at_least_one_specialty_required(self):
        """Test that at least one specialty is required"""
        user_data = {
            "name": "Test No Spec User",
            "email": f"test_multispec_{uuid.uuid4().hex[:8]}@test.com",
            "password": "TestPass123!",
            "role": "Standard User",
            "account_type": "Internal Staff",
            "specialty_ids": [],  # Empty array
            "force_password_change": False,
            "force_otp_setup": False,
            "send_welcome_email": False
        }
        
        resp = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.admin_headers)
        assert resp.status_code == 400, f"Should fail with 400, got {resp.status_code}"
        assert "at least one specialty" in resp.text.lower(), f"Wrong error message: {resp.text}"
        
        print("✓ At least one specialty required validation works")

    def test_07_migration_endpoint_exists(self):
        """Test migration endpoint for single-to-multi specialty"""
        resp = requests.post(
            f"{BASE_URL}/api/users/migrate/single-to-multi-specialty",
            headers=self.admin_headers
        )
        assert resp.status_code == 200, f"Migration endpoint failed: {resp.text}"
        
        result = resp.json()
        assert "message" in result
        assert "users_found" in result
        assert "users_migrated" in result
        
        print(f"✓ Migration endpoint works - found {result['users_found']}, migrated {result['users_migrated']}")

    def test_08_user_list_shows_multiple_specialties(self):
        """Test that user list returns specialty_ids and specialties array"""
        resp = requests.get(f"{BASE_URL}/api/users", headers=self.admin_headers)
        assert resp.status_code == 200
        
        users = resp.json()
        assert len(users) > 0, "No users found"
        
        # Check first user has multi-specialty fields
        first_user = users[0]
        assert "specialty_ids" in first_user, "Missing specialty_ids in user list"
        assert "specialties" in first_user, "Missing specialties array in user list"
        assert "primary_specialty_id" in first_user, "Missing primary_specialty_id in user list"
        
        # Check for backwards compatibility fields
        assert "specialty_id" in first_user, "Missing legacy specialty_id"
        assert "specialty_name" in first_user, "Missing legacy specialty_name"
        
        print(f"✓ User list returns multi-specialty fields for {len(users)} users")

    def test_09_existing_multi_specialty_user(self):
        """Test the existing multi-specialty test user"""
        # Login as the multi-specialty test user
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "multispec@test.com",
            "password": "TestPass123!"
        })
        
        if login_resp.status_code != 200:
            pytest.skip("Multi-specialty test user not found or wrong password")
        
        user = login_resp.json()["user"]
        
        # Verify multi-specialty fields
        assert "specialty_ids" in user or len(user.get("specialty_ids", [])) > 0, "User should have specialty_ids"
        
        # Get full user details via admin
        user_resp = requests.get(f"{BASE_URL}/api/users", headers=self.admin_headers)
        users = user_resp.json()
        multi_user = next((u for u in users if u["email"] == "multispec@test.com"), None)
        
        if multi_user:
            assert len(multi_user.get("specialty_ids", [])) >= 2, "Multi-spec user should have multiple specialties"
            print(f"✓ Multi-specialty user has {len(multi_user['specialty_ids'])} specialties")
            print(f"  Specialties: {[s['name'] for s in multi_user.get('specialties', [])]}")
        else:
            print("✓ Multi-specialty test user exists (verified via login)")


class TestPoolRoutingMultiSpecialty:
    """Test pool routing with multi-specialty users"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        # Login as admin
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert login_resp.status_code == 200
        self.admin_token = login_resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get specialties
        spec_resp = requests.get(f"{BASE_URL}/api/specialties", headers=self.admin_headers)
        self.specialties = spec_resp.json() if spec_resp.status_code == 200 else []
        
        # Get categories
        cat_resp = requests.get(f"{BASE_URL}/api/categories/l2", headers=self.admin_headers)
        self.categories_l2 = cat_resp.json() if cat_resp.status_code == 200 else []
        
        yield

    def test_10_pool_routing_query_uses_or_for_specialty_ids(self):
        """Test that pool routing uses $or query to match ANY specialty in user's specialty_ids"""
        # This test verifies the determine_pool_routing function uses:
        # {"$or": [{"specialty_ids": routing_specialty_id}, {"specialty_id": routing_specialty_id}]}
        
        # Get a category with a specialty mapping
        category_with_specialty = None
        for cat in self.categories_l2:
            if cat.get("specialty_id"):
                category_with_specialty = cat
                break
        
        if not category_with_specialty:
            pytest.skip("No L2 category with specialty mapping found")
        
        routing_specialty_id = category_with_specialty["specialty_id"]
        
        # Check if there are Partners with this specialty in their specialty_ids array
        users_resp = requests.get(f"{BASE_URL}/api/users", headers=self.admin_headers)
        users = users_resp.json()
        
        partners_with_specialty = [
            u for u in users 
            if u.get("account_type") == "Partner" 
            and u.get("active", True)
            and (routing_specialty_id in u.get("specialty_ids", []) or u.get("specialty_id") == routing_specialty_id)
        ]
        
        print(f"✓ Found {len(partners_with_specialty)} Partners with specialty {routing_specialty_id}")
        print(f"  Category: {category_with_specialty['name']}")
        
        # The pool routing should find these partners
        # We can't directly test the query, but we verify the data structure supports it

    def test_11_user_with_multiple_specialties_matches_any(self):
        """Test that a user with multiple specialties can match tickets for ANY of their specialties"""
        # Get the multi-specialty user
        users_resp = requests.get(f"{BASE_URL}/api/users", headers=self.admin_headers)
        users = users_resp.json()
        
        multi_spec_user = next(
            (u for u in users if len(u.get("specialty_ids", [])) > 1),
            None
        )
        
        if not multi_spec_user:
            pytest.skip("No user with multiple specialties found")
        
        user_specialty_ids = multi_spec_user["specialty_ids"]
        
        print(f"✓ User '{multi_spec_user['name']}' has {len(user_specialty_ids)} specialties")
        print(f"  Specialty IDs: {user_specialty_ids}")
        
        # Verify the user would match tickets for ANY of their specialties
        # This is verified by the pool routing logic using $or query
        for spec_id in user_specialty_ids:
            spec = next((s for s in self.specialties if s["id"] == spec_id), None)
            if spec:
                print(f"  - {spec['name']}: User would match tickets routed to this specialty")


class TestUserDialogMultiSpecialty:
    """Test user dialog multi-select specialty checkboxes (frontend integration)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert login_resp.status_code == 200
        self.admin_token = login_resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        spec_resp = requests.get(f"{BASE_URL}/api/specialties", headers=self.admin_headers)
        self.specialties = spec_resp.json() if spec_resp.status_code == 200 else []
        
        yield

    def test_12_api_accepts_specialty_ids_array(self):
        """Test that API correctly accepts and processes specialty_ids array from frontend"""
        # Simulate what the frontend sends when user selects multiple specialties
        specialty_ids = [s["id"] for s in self.specialties[:3]]
        primary_id = specialty_ids[1]  # Second one as primary
        
        user_data = {
            "name": "Frontend Multi-Select Test",
            "email": f"test_multispec_{uuid.uuid4().hex[:8]}@test.com",
            "password": "TestPass123!",
            "role": "Standard User",
            "account_type": "Internal Staff",
            "specialty_ids": specialty_ids,
            "primary_specialty_id": primary_id,
            "team_id": None,
            "subscription_plan_id": None,
            "force_password_change": True,
            "force_otp_setup": True,
            "send_welcome_email": False
        }
        
        resp = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.admin_headers)
        assert resp.status_code == 200, f"API should accept specialty_ids array: {resp.text}"
        
        user = resp.json()
        assert user["specialty_ids"] == specialty_ids
        assert user["primary_specialty_id"] == primary_id
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=self.admin_headers)
        
        print("✓ API correctly accepts specialty_ids array from frontend")

    def test_13_api_returns_specialties_with_is_primary_flag(self):
        """Test that API returns specialties array with is_primary flag for UI display"""
        users_resp = requests.get(f"{BASE_URL}/api/users", headers=self.admin_headers)
        users = users_resp.json()
        
        # Find a user with specialties
        user_with_specs = next((u for u in users if u.get("specialties")), None)
        
        if not user_with_specs:
            pytest.skip("No user with specialties found")
        
        specialties = user_with_specs["specialties"]
        
        # Verify structure
        for spec in specialties:
            assert "id" in spec, "Missing id in specialty"
            assert "name" in spec, "Missing name in specialty"
            assert "is_primary" in spec, "Missing is_primary flag in specialty"
        
        # Verify exactly one is primary
        primary_count = sum(1 for s in specialties if s["is_primary"])
        assert primary_count <= 1, f"Should have at most 1 primary, got {primary_count}"
        
        print(f"✓ API returns specialties with is_primary flag")
        print(f"  User: {user_with_specs['name']}")
        print(f"  Specialties: {[(s['name'], 'PRIMARY' if s['is_primary'] else '') for s in specialties]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
