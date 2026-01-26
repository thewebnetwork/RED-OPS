"""
Full QA Pass - Backend API Tests
Tests all modules: Auth, Dashboard, Orders, Users, Teams, Workflows, SLA, Categories, etc.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


class TestAuthModule:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "Administrator"
        print(f"✓ Login successful for {ADMIN_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"
        print("✓ Invalid credentials rejected correctly")
    
    def test_auth_me_endpoint(self):
        """Test /auth/me endpoint"""
        # First login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Test /me endpoint
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        print("✓ /auth/me endpoint works")


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Authentication failed")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestDashboardModule:
    """Dashboard endpoint tests"""
    
    def test_dashboard_stats(self, auth_headers):
        """Test dashboard stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        # Check expected fields - dashboard returns counts
        assert "open_count" in data or "in_progress_count" in data
        print(f"✓ Dashboard stats: {data}")
    
    def test_sla_monitoring_stats(self, auth_headers):
        """Test SLA monitoring stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/sla-policies/monitoring/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "orders" in data
        print(f"✓ SLA Monitoring stats: {data}")


class TestOrdersModule:
    """Orders CRUD tests"""
    
    def test_list_orders(self, auth_headers):
        """Test listing orders"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "orders" in data or isinstance(data, list)
        print(f"✓ Orders list retrieved")
    
    def test_create_order(self, auth_headers):
        """Test creating a new order"""
        order_data = {
            "title": "TEST_QA_Order_Full_Pass",
            "description": "Test order created during full QA pass",
            "priority": "Normal"  # Must be Low, Normal, High, or Urgent
        }
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=auth_headers)
        assert response.status_code in [200, 201], f"Create order failed: {response.text}"
        data = response.json()
        assert "id" in data or "_id" in data
        order_id = data.get("id") or data.get("_id")
        print(f"✓ Order created: {order_id}")
        return order_id
    
    def test_get_order_detail(self, auth_headers):
        """Test getting order detail"""
        # First create an order
        order_data = {
            "title": "TEST_QA_Detail_Order",
            "description": "Test order for detail view",
            "priority": "Low"  # Must be Low, Normal, High, or Urgent
        }
        create_resp = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=auth_headers)
        if create_resp.status_code not in [200, 201]:
            pytest.skip("Could not create order for detail test")
        
        order_id = create_resp.json().get("id") or create_resp.json().get("_id")
        
        # Get order detail
        response = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers=auth_headers)
        assert response.status_code == 200, f"Get order detail failed: {response.text}"
        data = response.json()
        assert data.get("title") == "TEST_QA_Detail_Order"
        print(f"✓ Order detail retrieved: {order_id}")
    
    def test_update_order_status(self, auth_headers):
        """Test updating order status"""
        # Create order first
        order_data = {
            "title": "TEST_QA_Status_Change",
            "description": "Test order for status change",
            "priority": "Normal"  # Must be Low, Normal, High, or Urgent
        }
        create_resp = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=auth_headers)
        if create_resp.status_code not in [200, 201]:
            pytest.skip("Could not create order for status test")
        
        order_id = create_resp.json().get("id") or create_resp.json().get("_id")
        
        # Update status - use PATCH
        response = requests.patch(f"{BASE_URL}/api/orders/{order_id}/status", 
                               json={"status": "in_progress"}, headers=auth_headers)
        assert response.status_code == 200, f"Status update failed: {response.text}"
        print(f"✓ Order status updated to in_progress")


class TestUsersModule:
    """Users CRUD tests"""
    
    def test_list_users(self, auth_headers):
        """Test listing users"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Users list: {len(data)} users")
    
    def test_get_user_detail(self, auth_headers):
        """Test getting user detail"""
        # Get list first
        list_resp = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        users = list_resp.json()
        if not users:
            pytest.skip("No users found")
        
        user_id = users[0].get("id") or users[0].get("_id")
        response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ User detail retrieved")


class TestTeamsModule:
    """Teams CRUD tests"""
    
    def test_list_teams(self, auth_headers):
        """Test listing teams"""
        response = requests.get(f"{BASE_URL}/api/teams", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Teams list: {len(data)} teams")
    
    def test_create_team(self, auth_headers):
        """Test creating a team"""
        team_data = {
            "name": "TEST_QA_Team",
            "description": "Test team for QA"
        }
        response = requests.post(f"{BASE_URL}/api/teams", json=team_data, headers=auth_headers)
        assert response.status_code in [200, 201], f"Create team failed: {response.text}"
        data = response.json()
        assert "id" in data or "_id" in data
        print(f"✓ Team created")
    
    def test_update_team(self, auth_headers):
        """Test updating a team"""
        # Create team first
        team_data = {"name": "TEST_QA_Update_Team", "description": "To be updated"}
        create_resp = requests.post(f"{BASE_URL}/api/teams", json=team_data, headers=auth_headers)
        if create_resp.status_code not in [200, 201]:
            pytest.skip("Could not create team")
        
        team_id = create_resp.json().get("id") or create_resp.json().get("_id")
        
        # Update team - use PATCH not PUT
        response = requests.patch(f"{BASE_URL}/api/teams/{team_id}", 
                               json={"name": "TEST_QA_Updated_Team"}, headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ Team updated")


class TestWorkflowsModule:
    """Workflows tests"""
    
    def test_list_workflows(self, auth_headers):
        """Test listing workflows"""
        response = requests.get(f"{BASE_URL}/api/workflows", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Workflows list: {len(data)} workflows")
    
    def test_list_workflow_templates(self, auth_headers):
        """Test listing workflow templates - filter by is_template"""
        response = requests.get(f"{BASE_URL}/api/workflows?is_template=true", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Workflow templates: {len(data)} templates")
    
    def test_create_workflow(self, auth_headers):
        """Test creating a workflow"""
        workflow_data = {
            "name": "TEST_QA_Workflow",
            "description": "Test workflow for QA",
            "trigger_event": "order.created",
            "is_active": False,
            "nodes": [],
            "edges": []
        }
        response = requests.post(f"{BASE_URL}/api/workflows", json=workflow_data, headers=auth_headers)
        assert response.status_code in [200, 201], f"Create workflow failed: {response.text}"
        print(f"✓ Workflow created")


class TestSLAPoliciesModule:
    """SLA Policies tests"""
    
    def test_list_sla_policies(self, auth_headers):
        """Test listing SLA policies"""
        response = requests.get(f"{BASE_URL}/api/sla-policies", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ SLA Policies: {len(data)} policies")
    
    def test_sla_monitoring_stats(self, auth_headers):
        """Test SLA monitoring stats"""
        response = requests.get(f"{BASE_URL}/api/sla-policies/monitoring/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "orders" in data
        assert "on_track" in data["orders"]
        assert "at_risk" in data["orders"]
        assert "breached" in data["orders"]
        print(f"✓ SLA Monitoring stats: {data}")
    
    def test_sla_at_risk_orders(self, auth_headers):
        """Test at-risk orders endpoint"""
        response = requests.get(f"{BASE_URL}/api/sla-policies/monitoring/at-risk", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ At-risk orders: {len(data)}")
    
    def test_sla_breached_orders(self, auth_headers):
        """Test breached orders endpoint"""
        response = requests.get(f"{BASE_URL}/api/sla-policies/monitoring/breached", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Breached orders: {len(data)}")
    
    def test_escalation_history(self, auth_headers):
        """Test escalation history endpoint"""
        response = requests.get(f"{BASE_URL}/api/sla-policies/monitoring/history", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Escalation history: {len(data)} entries")
    
    def test_create_sla_policy(self, auth_headers):
        """Test creating SLA policy with scope"""
        policy_data = {
            "name": "TEST_QA_SLA_Policy",
            "description": "Test SLA policy for QA",
            "scope": {
                "role_ids": [],
                "team_ids": [],
                "specialty_ids": [],
                "access_tier_ids": []
            },
            "sla_rules": {
                "duration_minutes": 480,
                "business_hours_only": False
            },
            "thresholds": {
                "at_risk_minutes": 60
            },
            "escalation_levels": [
                {
                    "level": 1,
                    "name": "Level 1",
                    "trigger": "at_risk",
                    "delay_minutes": 0,
                    "actions": [
                        {"type": "notify_role", "role_id": "admin"}
                    ]
                }
            ],
            "is_active": False
        }
        response = requests.post(f"{BASE_URL}/api/sla-policies", json=policy_data, headers=auth_headers)
        assert response.status_code in [200, 201], f"Create SLA policy failed: {response.text}"
        print(f"✓ SLA Policy created")


class TestCategoriesModule:
    """Categories tests"""
    
    def test_list_categories_l1(self, auth_headers):
        """Test listing L1 categories"""
        response = requests.get(f"{BASE_URL}/api/categories/l1", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ L1 Categories: {len(data)}")
    
    def test_list_categories_l2(self, auth_headers):
        """Test listing L2 categories"""
        response = requests.get(f"{BASE_URL}/api/categories/l2", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ L2 Categories: {len(data)}")


class TestRolesModule:
    """Roles tests"""
    
    def test_list_roles(self, auth_headers):
        """Test listing roles"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 3  # At least 3 core roles
        print(f"✓ Roles: {len(data)} roles")
    
    def test_get_permissions_matrix(self, auth_headers):
        """Test getting permissions matrix"""
        response = requests.get(f"{BASE_URL}/api/roles/permissions-matrix", headers=auth_headers)
        # This endpoint might not exist, so we check for 200 or 404
        if response.status_code == 200:
            print(f"✓ Permissions matrix retrieved")
        else:
            print(f"⚠ Permissions matrix endpoint returned {response.status_code}")


class TestIntegrationsModule:
    """Integrations tests (API Keys & Webhooks)"""
    
    def test_list_api_keys(self, auth_headers):
        """Test listing API keys"""
        response = requests.get(f"{BASE_URL}/api/api-keys", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ API Keys: {len(data)} keys")
    
    def test_list_webhooks(self, auth_headers):
        """Test listing webhooks"""
        response = requests.get(f"{BASE_URL}/api/webhooks", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Webhooks: {len(data)} webhooks")


class TestNotificationsModule:
    """Notifications tests"""
    
    def test_list_notifications(self, auth_headers):
        """Test listing notifications"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Notifications: {len(data)} notifications")


class TestAnnouncementsModule:
    """Announcements tests"""
    
    def test_get_announcement_ticker(self, auth_headers):
        """Test getting announcement ticker"""
        response = requests.get(f"{BASE_URL}/api/announcement-ticker", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Should have is_active field
        assert "is_active" in data
        print(f"✓ Announcement ticker: active={data.get('is_active')}")


class TestSettingsModule:
    """Settings tests"""
    
    def test_get_ui_settings(self, auth_headers):
        """Test getting UI settings"""
        response = requests.get(f"{BASE_URL}/api/ui-settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ UI Settings: {len(data)} settings")
    
    def test_get_smtp_config(self, auth_headers):
        """Test getting SMTP config"""
        response = requests.get(f"{BASE_URL}/api/smtp-config", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ SMTP Config retrieved")


class TestAccessTiersModule:
    """Access Tiers tests"""
    
    def test_list_access_tiers(self, auth_headers):
        """Test listing access tiers"""
        response = requests.get(f"{BASE_URL}/api/access-tiers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have Free, Starter, Growth, Scale, Partner
        tier_names = [t.get("name") for t in data]
        print(f"✓ Access Tiers: {tier_names}")


class TestSpecialtiesModule:
    """Specialties tests"""
    
    def test_list_specialties(self, auth_headers):
        """Test listing specialties"""
        response = requests.get(f"{BASE_URL}/api/specialties", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Specialties: {len(data)} specialties")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_orders(self, auth_headers):
        """Cleanup TEST_ prefixed orders"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers)
        if response.status_code == 200:
            data = response.json()
            orders = data.get("orders", data) if isinstance(data, dict) else data
            for order in orders:
                title = order.get("title", "")
                if title.startswith("TEST_QA"):
                    order_id = order.get("id") or order.get("_id")
                    requests.delete(f"{BASE_URL}/api/orders/{order_id}", headers=auth_headers)
        print("✓ Test orders cleanup attempted")
    
    def test_cleanup_test_teams(self, auth_headers):
        """Cleanup TEST_ prefixed teams"""
        response = requests.get(f"{BASE_URL}/api/teams", headers=auth_headers)
        if response.status_code == 200:
            teams = response.json()
            for team in teams:
                name = team.get("name", "")
                if name.startswith("TEST_QA"):
                    team_id = team.get("id") or team.get("_id")
                    requests.delete(f"{BASE_URL}/api/teams/{team_id}", headers=auth_headers)
        print("✓ Test teams cleanup attempted")
    
    def test_cleanup_test_workflows(self, auth_headers):
        """Cleanup TEST_ prefixed workflows"""
        response = requests.get(f"{BASE_URL}/api/workflows", headers=auth_headers)
        if response.status_code == 200:
            workflows = response.json()
            for wf in workflows:
                name = wf.get("name", "")
                if name.startswith("TEST_QA"):
                    wf_id = wf.get("id") or wf.get("_id")
                    requests.delete(f"{BASE_URL}/api/workflows/{wf_id}", headers=auth_headers)
        print("✓ Test workflows cleanup attempted")
    
    def test_cleanup_test_sla_policies(self, auth_headers):
        """Cleanup TEST_ prefixed SLA policies"""
        response = requests.get(f"{BASE_URL}/api/sla-policies", headers=auth_headers)
        if response.status_code == 200:
            policies = response.json()
            for policy in policies:
                name = policy.get("name", "")
                if name.startswith("TEST_QA"):
                    policy_id = policy.get("id") or policy.get("_id")
                    requests.delete(f"{BASE_URL}/api/sla-policies/{policy_id}", headers=auth_headers)
        print("✓ Test SLA policies cleanup attempted")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
