"""
UAT P0 Blockers Test Suite - Red Ops
Tests for:
1. User creation error handling (Pydantic validation)
2. Ticket creation and persistence
3. Reports access for all authenticated users
4. Logs access for Administrator/Operator
5. Admin reopen capability
6. IAM CRUD operations
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_admin_login(self):
        """Test admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "Administrator", f"Expected Administrator role, got {data['user']['role']}"
        return data["token"]


class TestUserCreationErrorHandling:
    """Test user creation with validation error handling"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_create_user_invalid_email_returns_error(self, auth_headers):
        """Test that creating user with invalid email returns readable error, not crash"""
        # Get a specialty first
        specialties_res = requests.get(f"{BASE_URL}/api/specialties", headers=auth_headers)
        specialties = specialties_res.json()
        specialty_id = specialties[0]["id"] if specialties else None
        
        response = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json={
            "name": "Test User",
            "email": "invalid-email",  # Invalid email format
            "password": "TestPass123!",
            "role": "Standard User",
            "account_type": "Internal Staff",
            "specialty_id": specialty_id
        })
        # Should return 422 (validation error) not 500 (crash)
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}: {response.text}"
        # Should have readable error message
        data = response.json()
        assert "detail" in data, "No detail in error response"
    
    def test_create_user_missing_required_fields(self, auth_headers):
        """Test that missing required fields returns proper error"""
        response = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json={
            "name": "Test User"
            # Missing email, password, etc.
        })
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
    
    def test_create_user_valid_data_succeeds(self, auth_headers):
        """Test that valid user creation works"""
        # Get a specialty first
        specialties_res = requests.get(f"{BASE_URL}/api/specialties", headers=auth_headers)
        specialties = specialties_res.json()
        specialty_id = specialties[0]["id"] if specialties else None
        
        if not specialty_id:
            pytest.skip("No specialties available")
        
        unique_email = f"test_user_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json={
            "name": "TEST_Valid User",
            "email": unique_email,
            "password": "TestPass123!",
            "role": "Standard User",
            "account_type": "Internal Staff",
            "specialty_id": specialty_id
        })
        assert response.status_code in [200, 201], f"User creation failed: {response.text}"
        data = response.json()
        assert data["email"] == unique_email
        
        # Cleanup - delete the test user
        if "id" in data:
            requests.delete(f"{BASE_URL}/api/users/{data['id']}", headers=auth_headers)


class TestTicketCreationPersistence:
    """Test ticket creation and persistence"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_create_order_persists(self, auth_headers):
        """Test that creating an order via /api/orders persists and shows in My Tickets"""
        # Get categories
        l1_res = requests.get(f"{BASE_URL}/api/categories/l1", headers=auth_headers)
        categories_l1 = l1_res.json()
        category_l1_id = categories_l1[0]["id"] if categories_l1 else None
        
        # Create order
        order_data = {
            "title": f"TEST_Ticket_{uuid.uuid4().hex[:8]}",
            "description": "Test ticket for persistence verification",
            "priority": "Normal",
            "category_l1_id": category_l1_id,
            "is_draft": False
        }
        
        create_res = requests.post(f"{BASE_URL}/api/orders", headers=auth_headers, json=order_data)
        assert create_res.status_code in [200, 201], f"Order creation failed: {create_res.text}"
        created_order = create_res.json()
        order_id = created_order["id"]
        order_code = created_order["order_code"]
        
        # Verify it persists - GET the order
        get_res = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers=auth_headers)
        assert get_res.status_code == 200, f"Failed to get created order: {get_res.text}"
        fetched_order = get_res.json()
        assert fetched_order["title"] == order_data["title"]
        assert fetched_order["status"] == "Open"
        
        # Verify it shows in My Tickets (my-requests)
        my_tickets_res = requests.get(f"{BASE_URL}/api/orders/my-requests", headers=auth_headers)
        assert my_tickets_res.status_code == 200
        my_tickets = my_tickets_res.json()
        order_codes = [t["order_code"] for t in my_tickets]
        assert order_code in order_codes, f"Created order {order_code} not found in My Tickets"
        
        return order_id
    
    def test_create_bug_report_persists(self, auth_headers):
        """Test that creating a bug report persists"""
        # Get bug category
        l1_res = requests.get(f"{BASE_URL}/api/categories/l1", headers=auth_headers)
        categories_l1 = l1_res.json()
        bug_category = next((c for c in categories_l1 if "bug" in c["name"].lower() or "issue" in c["name"].lower()), None)
        category_l1_id = bug_category["id"] if bug_category else (categories_l1[0]["id"] if categories_l1 else None)
        
        bug_data = {
            "title": f"TEST_Bug_{uuid.uuid4().hex[:8]}",
            "description": "Test bug report",
            "category_l1_id": category_l1_id,
            "bug_type": "UI Bug",
            "steps_to_reproduce": "1. Test step",
            "expected_behavior": "Should work",
            "actual_behavior": "Does not work",
            "severity": "Normal"
        }
        
        create_res = requests.post(f"{BASE_URL}/api/bug-reports", headers=auth_headers, json=bug_data)
        assert create_res.status_code in [200, 201], f"Bug report creation failed: {create_res.text}"
        created_bug = create_res.json()
        assert "id" in created_bug or "order_code" in created_bug


class TestReportsAccess:
    """Test reports access for all authenticated users"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_reports_available_endpoint(self, auth_headers):
        """Test that /api/reports/available works for authenticated users"""
        response = requests.get(f"{BASE_URL}/api/reports/available", headers=auth_headers)
        assert response.status_code == 200, f"Reports available failed: {response.text}"
        reports = response.json()
        assert isinstance(reports, list), "Expected list of reports"
        assert len(reports) > 0, "No reports available"
    
    def test_generate_report(self, auth_headers):
        """Test that generating a report works"""
        # Generate tickets_created report
        response = requests.post(
            f"{BASE_URL}/api/reports/tickets_created/generate",
            headers=auth_headers,
            json={}
        )
        assert response.status_code == 200, f"Report generation failed: {response.text}"
        report = response.json()
        assert "report_id" in report
        assert "data" in report


class TestLogsAccess:
    """Test logs access for Administrator and Operator roles"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_system_logs_access(self, auth_headers):
        """Test that Administrator can access system logs"""
        response = requests.get(f"{BASE_URL}/api/logs/system", headers=auth_headers)
        assert response.status_code == 200, f"System logs access failed: {response.text}"
        data = response.json()
        assert "logs" in data
    
    def test_api_logs_access(self, auth_headers):
        """Test that Administrator can access API logs"""
        response = requests.get(f"{BASE_URL}/api/logs/api", headers=auth_headers)
        assert response.status_code == 200, f"API logs access failed: {response.text}"
    
    def test_ui_logs_access(self, auth_headers):
        """Test that Administrator can access UI logs"""
        response = requests.get(f"{BASE_URL}/api/logs/ui", headers=auth_headers)
        assert response.status_code == 200, f"UI logs access failed: {response.text}"
    
    def test_user_logs_access(self, auth_headers):
        """Test that Administrator can access user logs"""
        response = requests.get(f"{BASE_URL}/api/logs/user", headers=auth_headers)
        assert response.status_code == 200, f"User logs access failed: {response.text}"


class TestAdminReopenCapability:
    """Test Admin reopen capability for closed tickets"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_reopen_closed_ticket(self, auth_headers):
        """Test that Admin can reopen a closed ticket"""
        # First create a ticket
        order_data = {
            "title": f"TEST_Reopen_{uuid.uuid4().hex[:8]}",
            "description": "Test ticket for reopen verification",
            "priority": "Normal",
            "is_draft": False
        }
        
        create_res = requests.post(f"{BASE_URL}/api/orders", headers=auth_headers, json=order_data)
        assert create_res.status_code in [200, 201], f"Order creation failed: {create_res.text}"
        order = create_res.json()
        order_id = order["id"]
        
        # Close the ticket
        close_res = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/close",
            headers=auth_headers,
            json={"reason": "Test closure for reopen test"}
        )
        assert close_res.status_code == 200, f"Close failed: {close_res.text}"
        
        # Verify it's closed
        get_res = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers=auth_headers)
        assert get_res.json()["status"] == "Closed"
        
        # Reopen the ticket
        reopen_res = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/reopen",
            headers=auth_headers,
            json={"reason": "Test reopen by admin"}
        )
        assert reopen_res.status_code == 200, f"Reopen failed: {reopen_res.text}"
        
        # Verify it's reopened
        get_res2 = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers=auth_headers)
        assert get_res2.json()["status"] == "Open", f"Expected Open status after reopen, got {get_res2.json()['status']}"


class TestIAMCRUD:
    """Test IAM CRUD operations for Roles, Account Types, Specialties, Teams, Plans"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    # Roles CRUD
    def test_list_roles(self, auth_headers):
        """Test listing roles"""
        response = requests.get(f"{BASE_URL}/api/iam/roles", headers=auth_headers)
        assert response.status_code == 200, f"List roles failed: {response.text}"
        roles = response.json()
        assert isinstance(roles, list)
    
    def test_create_role(self, auth_headers):
        """Test creating a role"""
        role_data = {
            "name": f"TEST_Role_{uuid.uuid4().hex[:8]}",
            "description": "Test role",
            "color": "#FF5733"
        }
        response = requests.post(f"{BASE_URL}/api/iam/roles", headers=auth_headers, json=role_data)
        assert response.status_code in [200, 201], f"Create role failed: {response.text}"
        role = response.json()
        assert role["name"] == role_data["name"]
        
        # Cleanup
        if "id" in role:
            requests.delete(f"{BASE_URL}/api/iam/roles/{role['id']}", headers=auth_headers)
    
    # Account Types CRUD
    def test_list_account_types(self, auth_headers):
        """Test listing account types"""
        response = requests.get(f"{BASE_URL}/api/iam/account-types", headers=auth_headers)
        assert response.status_code == 200, f"List account types failed: {response.text}"
        account_types = response.json()
        assert isinstance(account_types, list)
    
    def test_create_account_type(self, auth_headers):
        """Test creating an account type"""
        at_data = {
            "name": f"TEST_AccountType_{uuid.uuid4().hex[:8]}",
            "description": "Test account type",
            "color": "#33FF57",
            "requires_subscription": False
        }
        response = requests.post(f"{BASE_URL}/api/iam/account-types", headers=auth_headers, json=at_data)
        assert response.status_code in [200, 201], f"Create account type failed: {response.text}"
        at = response.json()
        assert at["name"] == at_data["name"]
        
        # Cleanup
        if "id" in at:
            requests.delete(f"{BASE_URL}/api/iam/account-types/{at['id']}", headers=auth_headers)
    
    # Specialties CRUD
    def test_list_specialties(self, auth_headers):
        """Test listing specialties"""
        response = requests.get(f"{BASE_URL}/api/specialties", headers=auth_headers)
        assert response.status_code == 200, f"List specialties failed: {response.text}"
        specialties = response.json()
        assert isinstance(specialties, list)
    
    def test_create_specialty(self, auth_headers):
        """Test creating a specialty"""
        spec_data = {
            "name": f"TEST_Specialty_{uuid.uuid4().hex[:8]}",
            "description": "Test specialty",
            "color": "#5733FF"
        }
        response = requests.post(f"{BASE_URL}/api/specialties", headers=auth_headers, json=spec_data)
        assert response.status_code in [200, 201], f"Create specialty failed: {response.text}"
        spec = response.json()
        assert spec["name"] == spec_data["name"]
        
        # Cleanup
        if "id" in spec:
            requests.delete(f"{BASE_URL}/api/specialties/{spec['id']}", headers=auth_headers)
    
    # Teams CRUD
    def test_list_teams(self, auth_headers):
        """Test listing teams"""
        response = requests.get(f"{BASE_URL}/api/teams", headers=auth_headers)
        assert response.status_code == 200, f"List teams failed: {response.text}"
        teams = response.json()
        assert isinstance(teams, list)
    
    def test_create_team(self, auth_headers):
        """Test creating a team"""
        team_data = {
            "name": f"TEST_Team_{uuid.uuid4().hex[:8]}",
            "description": "Test team"
        }
        response = requests.post(f"{BASE_URL}/api/teams", headers=auth_headers, json=team_data)
        assert response.status_code in [200, 201], f"Create team failed: {response.text}"
        team = response.json()
        assert team["name"] == team_data["name"]
        
        # Cleanup
        if "id" in team:
            requests.delete(f"{BASE_URL}/api/teams/{team['id']}", headers=auth_headers)
    
    # Plans CRUD
    def test_list_plans(self, auth_headers):
        """Test listing subscription plans"""
        response = requests.get(f"{BASE_URL}/api/subscription-plans", headers=auth_headers)
        assert response.status_code == 200, f"List plans failed: {response.text}"
        plans = response.json()
        assert isinstance(plans, list)
    
    def test_create_plan(self, auth_headers):
        """Test creating a subscription plan"""
        plan_data = {
            "name": f"TEST_Plan_{uuid.uuid4().hex[:8]}",
            "description": "Test plan",
            "price_monthly": 99.99,
            "price_yearly": 999.99,
            "features": ["Feature 1", "Feature 2"],
            "sort_order": 99
        }
        response = requests.post(f"{BASE_URL}/api/subscription-plans", headers=auth_headers, json=plan_data)
        assert response.status_code in [200, 201], f"Create plan failed: {response.text}"
        plan = response.json()
        assert plan["name"] == plan_data["name"]
        
        # Cleanup
        if "id" in plan:
            requests.delete(f"{BASE_URL}/api/subscription-plans/{plan['id']}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
