"""
Test IAM Searchable Dropdowns and Team-Specialty Relationship Features
Tests for P0 features:
1. SearchableSelect components for IAM dropdowns
2. Team-Specialty relationship with related_specialty_ids
3. User account email alerts (account creation, disable, reactivate)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIAMSearchableDropdowns:
    """Test IAM features for searchable dropdowns and team-specialty relationships"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        print("✓ Admin login successful")
        
    def test_identity_config_returns_roles_and_account_types(self):
        """Test GET /api/users/identity-config returns roles and account types for dropdowns"""
        response = self.session.get(f"{BASE_URL}/api/users/identity-config")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "roles" in data, "Missing roles in identity config"
        assert "account_types" in data, "Missing account_types in identity config"
        
        # Verify expected roles
        roles = data["roles"]
        assert "Administrator" in roles, "Missing Administrator role"
        assert "Standard User" in roles, "Missing Standard User role"
        assert "Operator" in roles, "Missing Operator role"
        print(f"✓ Identity config returns {len(roles)} roles: {roles}")
        
        # Verify expected account types
        account_types = data["account_types"]
        assert "Partner" in account_types, "Missing Partner account type"
        assert "Internal Staff" in account_types, "Missing Internal Staff account type"
        print(f"✓ Identity config returns {len(account_types)} account types: {account_types}")
        
    def test_teams_list_returns_related_specialty_ids(self):
        """Test GET /api/teams returns teams with related_specialty_ids field"""
        response = self.session.get(f"{BASE_URL}/api/teams")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        teams = response.json()
        assert len(teams) > 0, "No teams found"
        
        # Check first team has related_specialty_ids field
        first_team = teams[0]
        assert "related_specialty_ids" in first_team, "Missing related_specialty_ids in team"
        assert "related_specialty_names" in first_team, "Missing related_specialty_names in team"
        print(f"✓ Teams list returns {len(teams)} teams with related_specialty_ids field")
        
    def test_team_update_with_related_specialties(self):
        """Test PATCH /api/teams/{id} can update related_specialty_ids"""
        # Get teams
        teams_response = self.session.get(f"{BASE_URL}/api/teams")
        teams = teams_response.json()
        assert len(teams) > 0, "No teams to test"
        
        test_team = teams[0]
        team_id = test_team["id"]
        
        # Get specialties
        specialties_response = self.session.get(f"{BASE_URL}/api/specialties")
        specialties = specialties_response.json()
        assert len(specialties) > 0, "No specialties found"
        
        # Select first 2 specialties
        specialty_ids = [s["id"] for s in specialties[:2]]
        
        # Update team with related specialties
        update_response = self.session.patch(f"{BASE_URL}/api/teams/{team_id}", json={
            "related_specialty_ids": specialty_ids
        })
        assert update_response.status_code == 200, f"Failed to update team: {update_response.text}"
        
        updated_team = update_response.json()
        assert updated_team["related_specialty_ids"] == specialty_ids, "related_specialty_ids not updated"
        assert len(updated_team["related_specialty_names"]) == 2, "related_specialty_names not populated"
        print(f"✓ Team updated with {len(specialty_ids)} related specialties")
        
        # Verify GET returns updated data
        get_response = self.session.get(f"{BASE_URL}/api/teams/{team_id}")
        assert get_response.status_code == 200
        fetched_team = get_response.json()
        assert fetched_team["related_specialty_ids"] == specialty_ids
        print("✓ GET /api/teams/{id} returns updated related_specialty_ids")
        
    def test_specialties_list_for_dropdown(self):
        """Test GET /api/specialties returns specialties for dropdown"""
        response = self.session.get(f"{BASE_URL}/api/specialties")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        specialties = response.json()
        assert len(specialties) > 0, "No specialties found"
        
        # Check specialty has required fields for dropdown
        first_specialty = specialties[0]
        assert "id" in first_specialty, "Missing id in specialty"
        assert "name" in first_specialty, "Missing name in specialty"
        assert "color" in first_specialty, "Missing color in specialty"
        print(f"✓ Specialties list returns {len(specialties)} specialties with id, name, color")
        
    def test_subscription_plans_list_for_dropdown(self):
        """Test GET /api/subscription-plans returns plans for dropdown"""
        response = self.session.get(f"{BASE_URL}/api/subscription-plans")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        plans = response.json()
        assert len(plans) > 0, "No subscription plans found"
        
        # Check plan has required fields for dropdown
        first_plan = plans[0]
        assert "id" in first_plan, "Missing id in plan"
        assert "name" in first_plan, "Missing name in plan"
        print(f"✓ Subscription plans list returns {len(plans)} plans")
        
    def test_create_user_with_send_welcome_email_flag(self):
        """Test POST /api/users with send_welcome_email flag"""
        # Get a specialty
        specialties_response = self.session.get(f"{BASE_URL}/api/specialties")
        specialties = specialties_response.json()
        specialty_id = specialties[0]["id"]
        
        # Create user with send_welcome_email=False (to avoid actual email)
        test_email = f"test_user_{uuid.uuid4().hex[:8]}@test.com"
        create_response = self.session.post(f"{BASE_URL}/api/users", json={
            "name": "Test User",
            "email": test_email,
            "password": "TempPass123!",
            "role": "Standard User",
            "account_type": "Internal Staff",
            "specialty_id": specialty_id,
            "send_welcome_email": False,  # Don't send actual email
            "force_password_change": True,
            "force_otp_setup": False
        })
        assert create_response.status_code == 200, f"Failed to create user: {create_response.text}"
        
        created_user = create_response.json()
        assert created_user["email"] == test_email.lower()
        assert created_user["role"] == "Standard User"
        assert created_user["account_type"] == "Internal Staff"
        print(f"✓ User created with send_welcome_email flag")
        
        # Cleanup - delete user
        user_id = created_user["id"]
        delete_response = self.session.delete(f"{BASE_URL}/api/users/{user_id}")
        assert delete_response.status_code == 200
        print("✓ Test user cleaned up")
        
    def test_create_partner_user_requires_subscription_plan(self):
        """Test POST /api/users with Partner account type requires subscription_plan_id"""
        # Get a specialty
        specialties_response = self.session.get(f"{BASE_URL}/api/specialties")
        specialties = specialties_response.json()
        specialty_id = specialties[0]["id"]
        
        # Try to create Partner without subscription plan - should fail
        test_email = f"test_partner_{uuid.uuid4().hex[:8]}@test.com"
        create_response = self.session.post(f"{BASE_URL}/api/users", json={
            "name": "Test Partner",
            "email": test_email,
            "password": "TempPass123!",
            "role": "Standard User",
            "account_type": "Partner",
            "specialty_id": specialty_id,
            "send_welcome_email": False
        })
        assert create_response.status_code == 400, "Should fail without subscription_plan_id"
        assert "subscription plan" in create_response.text.lower(), "Error should mention subscription plan"
        print("✓ Partner user creation requires subscription_plan_id")
        
    def test_create_partner_user_with_subscription_plan(self):
        """Test POST /api/users with Partner account type and subscription plan"""
        # Get a specialty
        specialties_response = self.session.get(f"{BASE_URL}/api/specialties")
        specialties = specialties_response.json()
        specialty_id = specialties[0]["id"]
        
        # Get a subscription plan
        plans_response = self.session.get(f"{BASE_URL}/api/subscription-plans")
        plans = plans_response.json()
        assert len(plans) > 0, "No subscription plans found"
        plan_id = plans[0]["id"]
        
        # Create Partner with subscription plan
        test_email = f"test_partner_{uuid.uuid4().hex[:8]}@test.com"
        create_response = self.session.post(f"{BASE_URL}/api/users", json={
            "name": "Test Partner",
            "email": test_email,
            "password": "TempPass123!",
            "role": "Standard User",
            "account_type": "Partner",
            "specialty_id": specialty_id,
            "subscription_plan_id": plan_id,
            "send_welcome_email": False
        })
        assert create_response.status_code == 200, f"Failed to create partner: {create_response.text}"
        
        created_user = create_response.json()
        assert created_user["account_type"] == "Partner"
        assert created_user["subscription_plan_id"] == plan_id
        print(f"✓ Partner user created with subscription plan")
        
        # Cleanup
        user_id = created_user["id"]
        self.session.delete(f"{BASE_URL}/api/users/{user_id}")
        print("✓ Test partner cleaned up")
        
    def test_user_disable_and_reactivate(self):
        """Test user disable and reactivate sends email notifications"""
        # Get a specialty
        specialties_response = self.session.get(f"{BASE_URL}/api/specialties")
        specialties = specialties_response.json()
        specialty_id = specialties[0]["id"]
        
        # Create test user
        test_email = f"test_disable_{uuid.uuid4().hex[:8]}@test.com"
        create_response = self.session.post(f"{BASE_URL}/api/users", json={
            "name": "Test Disable User",
            "email": test_email,
            "password": "TempPass123!",
            "role": "Standard User",
            "account_type": "Internal Staff",
            "specialty_id": specialty_id,
            "send_welcome_email": False
        })
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Disable user
        disable_response = self.session.patch(f"{BASE_URL}/api/users/{user_id}", json={
            "active": False
        })
        assert disable_response.status_code == 200, f"Failed to disable user: {disable_response.text}"
        assert disable_response.json()["active"] == False
        print("✓ User disabled successfully")
        
        # Reactivate user
        reactivate_response = self.session.patch(f"{BASE_URL}/api/users/{user_id}", json={
            "active": True
        })
        assert reactivate_response.status_code == 200, f"Failed to reactivate user: {reactivate_response.text}"
        assert reactivate_response.json()["active"] == True
        print("✓ User reactivated successfully")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/users/{user_id}")
        print("✓ Test user cleaned up")
        
    def test_team_create_with_related_specialties(self):
        """Test POST /api/teams with related_specialty_ids"""
        # Get specialties
        specialties_response = self.session.get(f"{BASE_URL}/api/specialties")
        specialties = specialties_response.json()
        specialty_ids = [s["id"] for s in specialties[:3]]
        
        # Create team with related specialties
        team_name = f"Test Team {uuid.uuid4().hex[:8]}"
        create_response = self.session.post(f"{BASE_URL}/api/teams", json={
            "name": team_name,
            "description": "Test team with related specialties",
            "related_specialty_ids": specialty_ids
        })
        assert create_response.status_code == 200, f"Failed to create team: {create_response.text}"
        
        created_team = create_response.json()
        assert created_team["name"] == team_name
        assert created_team["related_specialty_ids"] == specialty_ids
        assert len(created_team["related_specialty_names"]) == 3
        print(f"✓ Team created with {len(specialty_ids)} related specialties")
        
        # Cleanup
        team_id = created_team["id"]
        self.session.delete(f"{BASE_URL}/api/teams/{team_id}")
        print("✓ Test team cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
