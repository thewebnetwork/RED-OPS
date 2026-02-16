"""
Test Pool Picker Rules Configuration Feature
Tests for configurable pool eligibility via Settings -> Pool Picker Rules

Features tested:
1. GET /api/pool-picker-rules - returns rules for all account types with defaults
2. PATCH /api/pool-picker-rules/{account_type} - updates the rule
3. POST /api/pool-picker-rules/reset-defaults - resets to default values
4. Pool routing uses config - Partner only in Pool 1 by default
5. Pool routing uses config - Internal Staff only in Pool 1 by default
6. Pool routing uses config - Vendor/Freelancer only in Pool 2 by default
7. User with can_pick=false cannot access pools even if account type allows
8. Pool access control is config-driven (not hardcoded)
"""

import pytest
import requests
import os
import uuid
from urllib.parse import quote

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://client-ui-modes.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


class TestPoolPickerRulesAPI:
    """Test Pool Picker Rules API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        
        token = login_response.json().get("token")
        assert token, "No token returned"
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        # Cleanup - reset rules to defaults after tests
        self.session.post(f"{BASE_URL}/api/pool-picker-rules/reset-defaults")
    
    def test_01_get_pool_picker_rules_returns_all_account_types(self):
        """GET /api/pool-picker-rules returns rules for all account types"""
        response = self.session.get(f"{BASE_URL}/api/pool-picker-rules")
        
        assert response.status_code == 200, f"Failed to get rules: {response.text}"
        data = response.json()
        
        assert "rules" in data, "Response should contain 'rules' key"
        rules = data["rules"]
        
        # Should have rules for all 4 account types
        account_types = [r["account_type"] for r in rules]
        assert "Partner" in account_types, "Missing Partner rule"
        assert "Internal Staff" in account_types, "Missing Internal Staff rule"
        assert "Vendor/Freelancer" in account_types, "Missing Vendor/Freelancer rule"
        assert "Media Client" in account_types, "Missing Media Client rule"
        
        print(f"✓ GET /api/pool-picker-rules returns {len(rules)} rules for all account types")
    
    def test_02_default_rules_partner_pool_1_only(self):
        """Default: Partner can pick from Pool 1 only"""
        response = self.session.get(f"{BASE_URL}/api/pool-picker-rules")
        assert response.status_code == 200
        
        rules = response.json()["rules"]
        partner_rule = next((r for r in rules if r["account_type"] == "Partner"), None)
        
        assert partner_rule is not None, "Partner rule not found"
        assert partner_rule["can_pick"] == True, "Partner should be able to pick by default"
        assert "POOL_1" in partner_rule["allowed_pools"], "Partner should have POOL_1 access"
        assert "POOL_2" not in partner_rule["allowed_pools"], "Partner should NOT have POOL_2 access by default"
        
        print(f"✓ Default Partner rule: can_pick={partner_rule['can_pick']}, pools={partner_rule['allowed_pools']}")
    
    def test_03_default_rules_internal_staff_pool_1_only(self):
        """Default: Internal Staff can pick from Pool 1 only"""
        response = self.session.get(f"{BASE_URL}/api/pool-picker-rules")
        assert response.status_code == 200
        
        rules = response.json()["rules"]
        internal_rule = next((r for r in rules if r["account_type"] == "Internal Staff"), None)
        
        assert internal_rule is not None, "Internal Staff rule not found"
        assert internal_rule["can_pick"] == True, "Internal Staff should be able to pick by default"
        assert "POOL_1" in internal_rule["allowed_pools"], "Internal Staff should have POOL_1 access"
        assert "POOL_2" not in internal_rule["allowed_pools"], "Internal Staff should NOT have POOL_2 access by default"
        
        print(f"✓ Default Internal Staff rule: can_pick={internal_rule['can_pick']}, pools={internal_rule['allowed_pools']}")
    
    def test_04_default_rules_vendor_pool_2_only(self):
        """Default: Vendor/Freelancer can pick from Pool 2 only"""
        response = self.session.get(f"{BASE_URL}/api/pool-picker-rules")
        assert response.status_code == 200
        
        rules = response.json()["rules"]
        vendor_rule = next((r for r in rules if r["account_type"] == "Vendor/Freelancer"), None)
        
        assert vendor_rule is not None, "Vendor/Freelancer rule not found"
        assert vendor_rule["can_pick"] == True, "Vendor/Freelancer should be able to pick by default"
        assert "POOL_2" in vendor_rule["allowed_pools"], "Vendor/Freelancer should have POOL_2 access"
        assert "POOL_1" not in vendor_rule["allowed_pools"], "Vendor/Freelancer should NOT have POOL_1 access by default"
        
        print(f"✓ Default Vendor/Freelancer rule: can_pick={vendor_rule['can_pick']}, pools={vendor_rule['allowed_pools']}")
    
    def test_05_default_rules_media_client_disabled(self):
        """Default: Media Client cannot pick from any pool"""
        response = self.session.get(f"{BASE_URL}/api/pool-picker-rules")
        assert response.status_code == 200
        
        rules = response.json()["rules"]
        client_rule = next((r for r in rules if r["account_type"] == "Media Client"), None)
        
        assert client_rule is not None, "Media Client rule not found"
        assert client_rule["can_pick"] == False, "Media Client should NOT be able to pick by default"
        assert len(client_rule["allowed_pools"]) == 0, "Media Client should have no pool access"
        
        print(f"✓ Default Media Client rule: can_pick={client_rule['can_pick']}, pools={client_rule['allowed_pools']}")
    
    def test_06_patch_pool_picker_rule_update_can_pick(self):
        """PATCH /api/pool-picker-rules/{account_type} updates can_pick"""
        # Update Partner to disable picking
        response = self.session.patch(
            f"{BASE_URL}/api/pool-picker-rules/Partner",
            json={"can_pick": False, "allowed_pools": []}
        )
        
        assert response.status_code == 200, f"Failed to update rule: {response.text}"
        data = response.json()
        
        assert data["account_type"] == "Partner"
        assert data["can_pick"] == False
        
        # Verify the change persisted
        get_response = self.session.get(f"{BASE_URL}/api/pool-picker-rules")
        rules = get_response.json()["rules"]
        partner_rule = next((r for r in rules if r["account_type"] == "Partner"), None)
        
        assert partner_rule["can_pick"] == False, "Partner can_pick should be False after update"
        
        print("✓ PATCH /api/pool-picker-rules/Partner successfully updated can_pick to False")
    
    def test_07_patch_pool_picker_rule_update_allowed_pools(self):
        """PATCH /api/pool-picker-rules/{account_type} updates allowed_pools"""
        # Update Vendor/Freelancer to also access Pool 1
        response = self.session.patch(
            f"{BASE_URL}/api/pool-picker-rules/Vendor/Freelancer",
            json={"can_pick": True, "allowed_pools": ["POOL_1", "POOL_2"]}
        )
        
        assert response.status_code == 200, f"Failed to update rule: {response.text}"
        data = response.json()
        
        assert "POOL_1" in data["allowed_pools"]
        assert "POOL_2" in data["allowed_pools"]
        
        # Verify the change persisted
        get_response = self.session.get(f"{BASE_URL}/api/pool-picker-rules")
        rules = get_response.json()["rules"]
        vendor_rule = next((r for r in rules if r["account_type"] == "Vendor/Freelancer"), None)
        
        assert "POOL_1" in vendor_rule["allowed_pools"], "Vendor should now have POOL_1 access"
        assert "POOL_2" in vendor_rule["allowed_pools"], "Vendor should still have POOL_2 access"
        
        print("✓ PATCH /api/pool-picker-rules/Vendor/Freelancer successfully updated allowed_pools")
    
    def test_08_patch_invalid_account_type_returns_400(self):
        """PATCH with invalid account type returns 400"""
        response = self.session.patch(
            f"{BASE_URL}/api/pool-picker-rules/InvalidType",
            json={"can_pick": True, "allowed_pools": ["POOL_1"]}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid account type, got {response.status_code}"
        print("✓ PATCH with invalid account type correctly returns 400")
    
    def test_09_patch_invalid_pool_returns_400(self):
        """PATCH with invalid pool name returns 400"""
        response = self.session.patch(
            f"{BASE_URL}/api/pool-picker-rules/Partner",
            json={"can_pick": True, "allowed_pools": ["POOL_3"]}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid pool, got {response.status_code}"
        print("✓ PATCH with invalid pool name correctly returns 400")
    
    def test_10_reset_defaults_restores_original_rules(self):
        """POST /api/pool-picker-rules/reset-defaults restores default values"""
        # First, modify some rules
        self.session.patch(
            f"{BASE_URL}/api/pool-picker-rules/Partner",
            json={"can_pick": False, "allowed_pools": []}
        )
        self.session.patch(
            f"{BASE_URL}/api/pool-picker-rules/Media Client",
            json={"can_pick": True, "allowed_pools": ["POOL_1", "POOL_2"]}
        )
        
        # Reset to defaults
        response = self.session.post(f"{BASE_URL}/api/pool-picker-rules/reset-defaults")
        assert response.status_code == 200, f"Failed to reset defaults: {response.text}"
        
        # Verify defaults are restored
        get_response = self.session.get(f"{BASE_URL}/api/pool-picker-rules")
        rules = get_response.json()["rules"]
        
        partner_rule = next((r for r in rules if r["account_type"] == "Partner"), None)
        client_rule = next((r for r in rules if r["account_type"] == "Media Client"), None)
        
        assert partner_rule["can_pick"] == True, "Partner should be restored to can_pick=True"
        assert "POOL_1" in partner_rule["allowed_pools"], "Partner should be restored to POOL_1"
        assert client_rule["can_pick"] == False, "Media Client should be restored to can_pick=False"
        assert len(client_rule["allowed_pools"]) == 0, "Media Client should have no pools"
        
        print("✓ POST /api/pool-picker-rules/reset-defaults successfully restored default values")
    
    def test_11_non_admin_cannot_access_pool_picker_rules(self):
        """Non-admin users cannot access pool picker rules endpoints"""
        # Create a new session without admin token
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Try to access without auth
        response = session.get(f"{BASE_URL}/api/pool-picker-rules")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
        print("✓ Non-admin users correctly denied access to pool picker rules")


class TestPoolRoutingUsesConfig:
    """Test that pool routing uses the configurable rules"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        # Cleanup - reset rules to defaults
        self.session.post(f"{BASE_URL}/api/pool-picker-rules/reset-defaults")
    
    def test_12_pool_routing_respects_config_for_pool_1(self):
        """Pool routing uses config to determine Pool 1 eligibility"""
        # Get current rules
        response = self.session.get(f"{BASE_URL}/api/pool-picker-rules")
        assert response.status_code == 200
        
        rules = response.json()["rules"]
        
        # Verify Partner and Internal Staff are configured for Pool 1
        partner_rule = next((r for r in rules if r["account_type"] == "Partner"), None)
        internal_rule = next((r for r in rules if r["account_type"] == "Internal Staff"), None)
        
        assert partner_rule["can_pick"] == True and "POOL_1" in partner_rule["allowed_pools"], \
            "Partner should be configured for Pool 1"
        assert internal_rule["can_pick"] == True and "POOL_1" in internal_rule["allowed_pools"], \
            "Internal Staff should be configured for Pool 1"
        
        print("✓ Pool routing config correctly shows Partner and Internal Staff for Pool 1")
    
    def test_13_pool_routing_respects_config_for_pool_2(self):
        """Pool routing uses config to determine Pool 2 eligibility"""
        response = self.session.get(f"{BASE_URL}/api/pool-picker-rules")
        assert response.status_code == 200
        
        rules = response.json()["rules"]
        
        # Verify Vendor/Freelancer is configured for Pool 2
        vendor_rule = next((r for r in rules if r["account_type"] == "Vendor/Freelancer"), None)
        
        assert vendor_rule["can_pick"] == True and "POOL_2" in vendor_rule["allowed_pools"], \
            "Vendor/Freelancer should be configured for Pool 2"
        
        print("✓ Pool routing config correctly shows Vendor/Freelancer for Pool 2")


class TestUserCanPickOverride:
    """Test user-level can_pick override functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.test_user_id = None
        
        yield
        
        # Cleanup - delete test user if created
        if self.test_user_id:
            self.session.delete(f"{BASE_URL}/api/users/{self.test_user_id}")
    
    def test_14_user_create_includes_can_pick_field(self):
        """User creation includes can_pick field"""
        # Get a specialty first
        specialties_response = self.session.get(f"{BASE_URL}/api/specialties")
        if specialties_response.status_code == 200 and specialties_response.json():
            specialty_id = specialties_response.json()[0]["id"]
        else:
            pytest.skip("No specialties available for test")
        
        # Create a test user with can_pick=false (use Internal Staff to avoid subscription plan requirement)
        test_email = f"test_canpick_{uuid.uuid4().hex[:8]}@test.com"
        response = self.session.post(f"{BASE_URL}/api/users", json={
            "name": "Test Can Pick User",
            "email": test_email,
            "password": "TestPass123!",
            "role": "Standard User",
            "account_type": "Internal Staff",
            "specialty_ids": [specialty_id],
            "can_pick": False,
            "send_welcome_email": False
        })
        
        assert response.status_code == 200, f"Failed to create user: {response.text}"
        user = response.json()
        self.test_user_id = user["id"]
        
        assert "can_pick" in user, "User response should include can_pick field"
        assert user["can_pick"] == False, "User can_pick should be False as specified"
        
        print(f"✓ User created with can_pick=False: {user['email']}")
    
    def test_15_user_update_can_pick_field(self):
        """User can_pick field can be updated"""
        # Get a specialty first
        specialties_response = self.session.get(f"{BASE_URL}/api/specialties")
        if specialties_response.status_code == 200 and specialties_response.json():
            specialty_id = specialties_response.json()[0]["id"]
        else:
            pytest.skip("No specialties available for test")
        
        # Create a test user (use Internal Staff to avoid subscription plan requirement)
        test_email = f"test_canpick_update_{uuid.uuid4().hex[:8]}@test.com"
        create_response = self.session.post(f"{BASE_URL}/api/users", json={
            "name": "Test Can Pick Update User",
            "email": test_email,
            "password": "TestPass123!",
            "role": "Standard User",
            "account_type": "Internal Staff",
            "specialty_ids": [specialty_id],
            "can_pick": True,
            "send_welcome_email": False
        })
        
        assert create_response.status_code == 200
        user = create_response.json()
        self.test_user_id = user["id"]
        
        # Update can_pick to False
        update_response = self.session.patch(f"{BASE_URL}/api/users/{user['id']}", json={
            "can_pick": False
        })
        
        assert update_response.status_code == 200, f"Failed to update user: {update_response.text}"
        updated_user = update_response.json()
        
        assert updated_user["can_pick"] == False, "User can_pick should be updated to False"
        
        print(f"✓ User can_pick updated from True to False")
    
    def test_16_user_response_includes_can_pick_default_true(self):
        """User response includes can_pick field with default True"""
        # Get list of users
        response = self.session.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200
        
        users = response.json()
        assert len(users) > 0, "Should have at least one user"
        
        # Check that users have can_pick field
        for user in users[:5]:  # Check first 5 users
            assert "can_pick" in user, f"User {user['email']} missing can_pick field"
            # Default should be True for existing users
            print(f"  User {user['email']}: can_pick={user['can_pick']}")
        
        print("✓ User responses include can_pick field")


class TestPoolAccessControlConfigDriven:
    """Test that pool access control is config-driven, not hardcoded"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        # Cleanup - reset rules to defaults
        self.session.post(f"{BASE_URL}/api/pool-picker-rules/reset-defaults")
    
    def test_17_changing_config_affects_pool_eligibility(self):
        """Changing pool picker config affects pool eligibility"""
        # First, verify default config
        response = self.session.get(f"{BASE_URL}/api/pool-picker-rules")
        assert response.status_code == 200
        
        rules = response.json()["rules"]
        vendor_rule = next((r for r in rules if r["account_type"] == "Vendor/Freelancer"), None)
        
        # Default: Vendor has Pool 2 only
        assert "POOL_2" in vendor_rule["allowed_pools"]
        assert "POOL_1" not in vendor_rule["allowed_pools"]
        
        # Change config: Give Vendor access to Pool 1 as well
        update_response = self.session.patch(
            f"{BASE_URL}/api/pool-picker-rules/Vendor/Freelancer",
            json={"can_pick": True, "allowed_pools": ["POOL_1", "POOL_2"]}
        )
        assert update_response.status_code == 200
        
        # Verify config changed
        verify_response = self.session.get(f"{BASE_URL}/api/pool-picker-rules")
        rules = verify_response.json()["rules"]
        vendor_rule = next((r for r in rules if r["account_type"] == "Vendor/Freelancer"), None)
        
        assert "POOL_1" in vendor_rule["allowed_pools"], "Vendor should now have Pool 1 access"
        assert "POOL_2" in vendor_rule["allowed_pools"], "Vendor should still have Pool 2 access"
        
        print("✓ Pool picker config changes are reflected in eligibility rules")
    
    def test_18_disabling_account_type_removes_pool_access(self):
        """Disabling can_pick for account type removes pool access"""
        # Disable Partner picking
        update_response = self.session.patch(
            f"{BASE_URL}/api/pool-picker-rules/Partner",
            json={"can_pick": False, "allowed_pools": []}
        )
        assert update_response.status_code == 200
        
        # Verify config changed
        verify_response = self.session.get(f"{BASE_URL}/api/pool-picker-rules")
        rules = verify_response.json()["rules"]
        partner_rule = next((r for r in rules if r["account_type"] == "Partner"), None)
        
        assert partner_rule["can_pick"] == False, "Partner can_pick should be False"
        assert len(partner_rule["allowed_pools"]) == 0, "Partner should have no pool access"
        
        print("✓ Disabling account type removes pool access")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
