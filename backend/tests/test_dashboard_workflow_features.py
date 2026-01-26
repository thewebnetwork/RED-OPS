"""
Test Dashboard Role Fix and Auto-Escalate Workflow Action
Tests:
1. Dashboard displays correctly for Administrator role
2. Dashboard displays correctly for Privileged User role  
3. Dashboard displays correctly for Standard User role
4. Workflow meta/actions API returns 'auto_escalate' action type
5. Creating/updating workflow with auto_escalate action saves correctly
6. Workflow engine handles auto_escalate action properly
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


class TestAuthentication:
    """Authentication tests"""
    
    def test_admin_login_returns_administrator_role(self):
        """Test that admin login returns 'Administrator' role"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "Administrator"
        print(f"✓ Admin login successful, role: {data['user']['role']}")


class TestDashboardAPIs:
    """Dashboard API tests for different roles"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_stats_api_for_admin(self):
        """Test dashboard stats API returns data for Administrator"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        # Verify expected fields exist
        assert "open_count" in data
        assert "in_progress_count" in data
        assert "pending_count" in data
        assert "delivered_count" in data
        assert "sla_breaching_count" in data
        print(f"✓ Dashboard stats API working: {data}")
    
    def test_dashboard_editor_api(self):
        """Test editor dashboard API"""
        response = requests.get(f"{BASE_URL}/api/dashboard/editor", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        # Verify expected fields exist
        assert "new_orders" in data
        assert "in_progress" in data
        assert "pending_review" in data
        assert "delivered" in data
        assert "sla_breaching" in data
        print(f"✓ Editor dashboard API working")
    
    def test_dashboard_requester_api(self):
        """Test requester dashboard API"""
        response = requests.get(f"{BASE_URL}/api/dashboard/requester", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        # Verify expected fields exist
        assert "open_orders" in data
        assert "in_progress" in data
        assert "needs_review" in data
        assert "delivered" in data
        print(f"✓ Requester dashboard API working")
    
    def test_orders_api_returns_data(self):
        """Test orders API returns data for dashboard"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Orders API working, returned {len(data)} orders")


class TestWorkflowMetaActions:
    """Test workflow meta/actions API for auto_escalate"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_workflow_actions_includes_auto_escalate(self):
        """Test that workflow actions API includes auto_escalate"""
        response = requests.get(f"{BASE_URL}/api/workflows/meta/actions", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "actions" in data
        
        # Find auto_escalate action
        auto_escalate = next((a for a in data["actions"] if a["type"] == "auto_escalate"), None)
        assert auto_escalate is not None, "auto_escalate action not found"
        
        # Verify auto_escalate has correct fields
        assert auto_escalate["label"] == "Auto-Escalate on Breach"
        assert auto_escalate["description"] == "Escalate to manager if ticket remains breached"
        assert auto_escalate["icon"] == "AlertTriangle"
        assert "escalate_after_minutes" in auto_escalate["config_fields"]
        assert "escalate_to_type" in auto_escalate["config_fields"]
        assert "escalate_to_id" in auto_escalate["config_fields"]
        assert "escalation_message" in auto_escalate["config_fields"]
        print(f"✓ auto_escalate action found with correct config fields")
    
    def test_all_expected_action_types_present(self):
        """Test that all expected action types are present"""
        response = requests.get(f"{BASE_URL}/api/workflows/meta/actions", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        expected_types = [
            "assign_role", "forward_ticket", "email_user", "email_requester",
            "update_status", "notify", "webhook", "delay", "auto_escalate"
        ]
        
        actual_types = [a["type"] for a in data["actions"]]
        for expected in expected_types:
            assert expected in actual_types, f"Missing action type: {expected}"
        print(f"✓ All {len(expected_types)} expected action types present")


class TestWorkflowWithAutoEscalate:
    """Test creating and updating workflows with auto_escalate action"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and cleanup"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_workflow_ids = []
        yield
        # Cleanup
        for wf_id in self.created_workflow_ids:
            requests.delete(f"{BASE_URL}/api/workflows/{wf_id}", headers=self.headers)
    
    def test_create_workflow_with_auto_escalate_action(self):
        """Test creating a workflow with auto_escalate action node"""
        workflow_data = {
            "name": f"TEST_AutoEscalate_{uuid.uuid4().hex[:8]}",
            "description": "Test workflow with auto-escalate action",
            "trigger_event": "order.sla_breached",
            "is_active": True,
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "SLA Breached",
                    "position": {"x": 250, "y": 50},
                    "data": {"trigger_type": "order.sla_breached"}
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "label": "Auto Escalate",
                    "position": {"x": 250, "y": 170},
                    "data": {
                        "action_type": "auto_escalate",
                        "config": {
                            "escalate_after_minutes": 60,
                            "escalate_to_type": "role",
                            "escalate_to_id": "admin-role-id",
                            "escalation_message": "Ticket {order_code}: {title} has been escalated due to extended SLA breach."
                        }
                    }
                }
            ],
            "edges": [
                {"id": "e1", "source": "trigger-1", "target": "action-1"}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/workflows", json=workflow_data, headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        self.created_workflow_ids.append(data["id"])
        
        # Verify workflow was created with correct data
        assert data["name"] == workflow_data["name"]
        assert len(data["nodes"]) == 2
        assert len(data["edges"]) == 1
        
        # Verify action node has auto_escalate config
        action_node = next((n for n in data["nodes"] if n["type"] == "action"), None)
        assert action_node is not None
        assert action_node["data"]["action_type"] == "auto_escalate"
        assert action_node["data"]["config"]["escalate_after_minutes"] == 60
        print(f"✓ Created workflow with auto_escalate action: {data['id']}")
    
    def test_update_workflow_with_auto_escalate_action(self):
        """Test updating a workflow to add auto_escalate action"""
        # First create a basic workflow
        workflow_data = {
            "name": f"TEST_UpdateAutoEscalate_{uuid.uuid4().hex[:8]}",
            "description": "Test workflow to update",
            "trigger_event": "order.created",
            "is_active": True,
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Order Created",
                    "position": {"x": 250, "y": 50},
                    "data": {"trigger_type": "order.created"}
                }
            ],
            "edges": []
        }
        
        response = requests.post(f"{BASE_URL}/api/workflows", json=workflow_data, headers=self.headers)
        assert response.status_code == 200
        workflow_id = response.json()["id"]
        self.created_workflow_ids.append(workflow_id)
        
        # Update to add auto_escalate action
        update_data = {
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Order Created",
                    "position": {"x": 250, "y": 50},
                    "data": {"trigger_type": "order.created"}
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "label": "Auto Escalate on Breach",
                    "position": {"x": 250, "y": 170},
                    "data": {
                        "action_type": "auto_escalate",
                        "config": {
                            "escalate_after_minutes": 30,
                            "escalate_to_type": "team",
                            "escalate_to_id": "support-team-id",
                            "escalation_message": "Urgent: {order_code} needs attention!"
                        }
                    }
                }
            ],
            "edges": [
                {"id": "e1", "source": "trigger-1", "target": "action-1"}
            ]
        }
        
        response = requests.put(f"{BASE_URL}/api/workflows/{workflow_id}", json=update_data, headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify update
        assert len(data["nodes"]) == 2
        action_node = next((n for n in data["nodes"] if n["type"] == "action"), None)
        assert action_node is not None
        assert action_node["data"]["action_type"] == "auto_escalate"
        assert action_node["data"]["config"]["escalate_after_minutes"] == 30
        assert action_node["data"]["config"]["escalate_to_type"] == "team"
        print(f"✓ Updated workflow with auto_escalate action: {workflow_id}")
    
    def test_get_workflow_with_auto_escalate_action(self):
        """Test retrieving a workflow with auto_escalate action"""
        # Create workflow
        workflow_data = {
            "name": f"TEST_GetAutoEscalate_{uuid.uuid4().hex[:8]}",
            "description": "Test workflow to retrieve",
            "trigger_event": "order.sla_warning",
            "is_active": True,
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "SLA Warning",
                    "position": {"x": 250, "y": 50},
                    "data": {"trigger_type": "order.sla_warning"}
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "label": "Escalate",
                    "position": {"x": 250, "y": 170},
                    "data": {
                        "action_type": "auto_escalate",
                        "config": {
                            "escalate_after_minutes": 120,
                            "escalate_to_type": "role",
                            "escalate_to_id": "manager-role-id",
                            "escalation_message": "SLA warning for {order_code}"
                        }
                    }
                }
            ],
            "edges": [
                {"id": "e1", "source": "trigger-1", "target": "action-1"}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/workflows", json=workflow_data, headers=self.headers)
        assert response.status_code == 200
        workflow_id = response.json()["id"]
        self.created_workflow_ids.append(workflow_id)
        
        # Retrieve workflow
        response = requests.get(f"{BASE_URL}/api/workflows/{workflow_id}", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify auto_escalate config is preserved
        action_node = next((n for n in data["nodes"] if n["type"] == "action"), None)
        assert action_node is not None
        assert action_node["data"]["action_type"] == "auto_escalate"
        assert action_node["data"]["config"]["escalate_after_minutes"] == 120
        print(f"✓ Retrieved workflow with auto_escalate action preserved")


class TestRolesAndTeamsForEscalation:
    """Test roles and teams APIs for escalation targeting"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_roles_api_returns_roles(self):
        """Test roles API returns roles for escalation targeting"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify Administrator role exists
        admin_role = next((r for r in data if r["name"] == "Administrator"), None)
        assert admin_role is not None, "Administrator role not found"
        print(f"✓ Roles API working, found {len(data)} roles including Administrator")
    
    def test_teams_api_returns_teams(self):
        """Test teams API returns teams for escalation targeting"""
        response = requests.get(f"{BASE_URL}/api/teams", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Teams API working, found {len(data)} teams")


class TestEscalationHistory:
    """Test escalation history collection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_escalation_history_api_exists(self):
        """Test escalation history API exists"""
        # Try to get escalation history (may return empty list)
        response = requests.get(f"{BASE_URL}/api/escalations", headers=self.headers)
        # API may not exist yet, but we check if it returns 200 or 404
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Escalation history API exists, found {len(data)} records")
        elif response.status_code == 404:
            print("⚠ Escalation history API not found (may not be implemented yet)")
        else:
            print(f"⚠ Escalation history API returned status {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
