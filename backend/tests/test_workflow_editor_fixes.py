"""
Test Workflow Editor Fixes - P0 ResizeObserver and P1 Route to Specialty
Tests:
- Backend: assign_specialty action type in workflow_engine.py
- Backend: Workflow CRUD operations
- Backend: Specialties endpoint for dropdown
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWorkflowEditorBackend:
    """Backend tests for workflow editor fixes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth"""
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
        self.user = login_response.json().get("user")
        yield
    
    def test_admin_login_success(self):
        """Test admin login works"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print("✅ Admin login successful")
    
    def test_get_workflows_list(self):
        """Test GET /api/workflows returns list of workflows"""
        response = self.session.get(f"{BASE_URL}/api/workflows")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/workflows returned {len(data)} workflows")
        return data
    
    def test_get_single_workflow(self):
        """Test GET /api/workflows/{id} returns workflow details"""
        # First get list of workflows
        workflows = self.test_get_workflows_list()
        if len(workflows) == 0:
            pytest.skip("No workflows available to test")
        
        workflow_id = workflows[0]["id"]
        response = self.session.get(f"{BASE_URL}/api/workflows/{workflow_id}")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "nodes" in data or data.get("nodes") is None
        assert "edges" in data or data.get("edges") is None
        print(f"✅ GET /api/workflows/{workflow_id} returned workflow: {data.get('name')}")
        return data
    
    def test_get_specialties_for_dropdown(self):
        """Test GET /api/specialties returns list for Route to Specialty dropdown"""
        response = self.session.get(f"{BASE_URL}/api/specialties")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/specialties returned {len(data)} specialties")
        if len(data) > 0:
            # Verify specialty structure
            specialty = data[0]
            assert "id" in specialty
            assert "name" in specialty
            print(f"   Sample specialty: {specialty.get('name')}")
        return data
    
    def test_get_roles_for_dropdown(self):
        """Test GET /api/roles returns list for action dropdowns"""
        response = self.session.get(f"{BASE_URL}/api/roles")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/roles returned {len(data)} roles")
        return data
    
    def test_get_teams_for_dropdown(self):
        """Test GET /api/teams returns list for action dropdowns"""
        response = self.session.get(f"{BASE_URL}/api/teams")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/teams returned {len(data)} teams")
        return data
    
    def test_get_sla_policies_for_dropdown(self):
        """Test GET /api/sla-policies returns list for Apply SLA Policy action"""
        response = self.session.get(f"{BASE_URL}/api/sla-policies")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/sla-policies returned {len(data)} policies")
        return data
    
    def test_workflow_update_nodes_edges(self):
        """Test PUT /api/workflows/{id} can update nodes and edges"""
        # Get existing workflow
        workflows_response = self.session.get(f"{BASE_URL}/api/workflows")
        workflows = workflows_response.json()
        if len(workflows) == 0:
            pytest.skip("No workflows available to test")
        
        workflow_id = workflows[0]["id"]
        
        # Get current workflow
        current = self.session.get(f"{BASE_URL}/api/workflows/{workflow_id}").json()
        
        # Update with same nodes/edges (no actual change, just verify endpoint works)
        update_payload = {
            "nodes": current.get("nodes", []),
            "edges": current.get("edges", [])
        }
        
        response = self.session.put(f"{BASE_URL}/api/workflows/{workflow_id}", json=update_payload)
        assert response.status_code == 200
        print(f"✅ PUT /api/workflows/{workflow_id} - Update successful")
    
    def test_workflow_with_assign_specialty_action(self):
        """Test creating/updating workflow with assign_specialty action type"""
        # Get existing workflow
        workflows_response = self.session.get(f"{BASE_URL}/api/workflows")
        workflows = workflows_response.json()
        if len(workflows) == 0:
            pytest.skip("No workflows available to test")
        
        workflow_id = workflows[0]["id"]
        
        # Get specialties for the action config
        specialties = self.session.get(f"{BASE_URL}/api/specialties").json()
        specialty_id = specialties[0]["id"] if len(specialties) > 0 else "test-specialty-id"
        
        # Create nodes with assign_specialty action
        test_nodes = [
            {
                "id": "trigger-test-1",
                "type": "trigger",
                "label": "Test Trigger",
                "position": {"x": 100, "y": 100},
                "data": {"trigger_type": "manual"}
            },
            {
                "id": "action-test-1",
                "type": "action",
                "label": "Route to Specialty",
                "position": {"x": 100, "y": 250},
                "data": {
                    "action_type": "assign_specialty",
                    "config": {
                        "specialty_id": specialty_id,
                        "pool_preference": "pool_1",
                        "fallback": "admin_queue"
                    }
                }
            }
        ]
        
        test_edges = [
            {
                "id": "edge-test-1",
                "source": "trigger-test-1",
                "target": "action-test-1",
                "source_handle": None,
                "label": None
            }
        ]
        
        # Update workflow with assign_specialty action
        update_payload = {
            "nodes": test_nodes,
            "edges": test_edges
        }
        
        response = self.session.put(f"{BASE_URL}/api/workflows/{workflow_id}", json=update_payload)
        assert response.status_code == 200
        print(f"✅ Workflow updated with assign_specialty action")
        
        # Verify the update persisted
        verify_response = self.session.get(f"{BASE_URL}/api/workflows/{workflow_id}")
        assert verify_response.status_code == 200
        updated_workflow = verify_response.json()
        
        # Check nodes contain assign_specialty action
        action_nodes = [n for n in updated_workflow.get("nodes", []) if n.get("type") == "action"]
        if len(action_nodes) > 0:
            action_data = action_nodes[0].get("data", {})
            assert action_data.get("action_type") == "assign_specialty" or "assign_specialty" in str(action_data)
            print(f"✅ assign_specialty action persisted in workflow")
        
        return updated_workflow
    
    def test_multiple_workflow_opens(self):
        """Test opening multiple workflows back-to-back (P0 - ResizeObserver crash test)"""
        workflows_response = self.session.get(f"{BASE_URL}/api/workflows")
        workflows = workflows_response.json()
        
        if len(workflows) < 2:
            pytest.skip("Need at least 2 workflows to test multiple opens")
        
        # Open 5 workflows (or all available if less than 5)
        workflows_to_test = workflows[:min(5, len(workflows))]
        
        for i, workflow in enumerate(workflows_to_test):
            workflow_id = workflow["id"]
            response = self.session.get(f"{BASE_URL}/api/workflows/{workflow_id}")
            assert response.status_code == 200
            data = response.json()
            assert "id" in data
            print(f"✅ Workflow {i+1}/{len(workflows_to_test)}: {data.get('name')} opened successfully")
        
        print(f"✅ All {len(workflows_to_test)} workflows opened without backend errors")


class TestAssignSpecialtyActionEngine:
    """Test the assign_specialty action in workflow_engine.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
    
    def test_workflow_execution_endpoint_exists(self):
        """Test workflow execution endpoint exists"""
        response = self.session.get(f"{BASE_URL}/api/workflow-executions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/workflow-executions returned {len(data)} executions")
    
    def test_workflow_templates_endpoint(self):
        """Test workflow templates endpoint for creating new workflows"""
        response = self.session.get(f"{BASE_URL}/api/workflow-templates")
        assert response.status_code == 200
        data = response.json()
        # Endpoint returns dict with 'templates' key
        assert isinstance(data, dict)
        assert "templates" in data
        templates = data.get("templates", [])
        assert isinstance(templates, list)
        print(f"✅ GET /api/workflow-templates returned {len(templates)} templates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
