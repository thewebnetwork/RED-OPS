"""
Test suite for Visual Workflow Builder APIs
Tests: CRUD operations, node/edge management, duplicate, delete
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://rulebook-redops.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


class TestWorkflowAPIs:
    """Test Workflow CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json()["token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Store created workflow IDs for cleanup
        self.created_workflow_ids = []
        
        yield
        
        # Cleanup - delete test workflows
        for wf_id in self.created_workflow_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/workflows/{wf_id}")
            except:
                pass
    
    def test_01_list_workflows(self):
        """Test GET /api/workflows - List all workflows"""
        response = self.session.get(f"{BASE_URL}/api/workflows")
        assert response.status_code == 200, f"Failed to list workflows: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Found {len(data)} workflows")
    
    def test_02_create_workflow(self):
        """Test POST /api/workflows - Create a new workflow"""
        workflow_name = f"TEST_Workflow_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": workflow_name,
            "description": "Test workflow for automated testing",
            "assigned_roles": [],
            "color": "#3B82F6",
            "nodes": [],
            "edges": [],
            "is_template": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/workflows", json=payload)
        assert response.status_code == 200, f"Failed to create workflow: {response.text}"
        
        data = response.json()
        assert data["name"] == workflow_name
        assert data["description"] == "Test workflow for automated testing"
        assert "id" in data
        assert data["active"] == True
        
        self.created_workflow_ids.append(data["id"])
        print(f"✓ Created workflow: {data['name']} (ID: {data['id']})")
        return data
    
    def test_03_create_workflow_with_nodes(self):
        """Test POST /api/workflows - Create workflow with nodes and edges"""
        workflow_name = f"TEST_Workflow_Nodes_{uuid.uuid4().hex[:8]}"
        
        # Create a workflow with trigger and end nodes
        payload = {
            "name": workflow_name,
            "description": "Workflow with nodes",
            "assigned_roles": [],
            "color": "#22c55e",
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Start",
                    "position": {"x": 250, "y": 50},
                    "data": {"trigger_type": "manual"}
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "label": "Process",
                    "position": {"x": 250, "y": 150},
                    "data": {"actions": []}
                },
                {
                    "id": "end-1",
                    "type": "end",
                    "label": "Complete",
                    "position": {"x": 250, "y": 250},
                    "data": {}
                }
            ],
            "edges": [
                {
                    "id": "edge-1",
                    "source": "trigger-1",
                    "target": "action-1",
                    "source_handle": None,
                    "label": None
                },
                {
                    "id": "edge-2",
                    "source": "action-1",
                    "target": "end-1",
                    "source_handle": None,
                    "label": None
                }
            ],
            "is_template": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/workflows", json=payload)
        assert response.status_code == 200, f"Failed to create workflow with nodes: {response.text}"
        
        data = response.json()
        assert len(data["nodes"]) == 3, f"Expected 3 nodes, got {len(data['nodes'])}"
        assert len(data["edges"]) == 2, f"Expected 2 edges, got {len(data['edges'])}"
        
        self.created_workflow_ids.append(data["id"])
        print(f"✓ Created workflow with {len(data['nodes'])} nodes and {len(data['edges'])} edges")
        return data
    
    def test_04_get_workflow_by_id(self):
        """Test GET /api/workflows/{id} - Get specific workflow"""
        # First create a workflow
        workflow = self.test_02_create_workflow()
        workflow_id = workflow["id"]
        
        # Get the workflow
        response = self.session.get(f"{BASE_URL}/api/workflows/{workflow_id}")
        assert response.status_code == 200, f"Failed to get workflow: {response.text}"
        
        data = response.json()
        assert data["id"] == workflow_id
        assert data["name"] == workflow["name"]
        print(f"✓ Retrieved workflow: {data['name']}")
    
    def test_05_get_nonexistent_workflow(self):
        """Test GET /api/workflows/{id} - 404 for non-existent workflow"""
        fake_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/workflows/{fake_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Correctly returns 404 for non-existent workflow")
    
    def test_06_update_workflow_full(self):
        """Test PUT /api/workflows/{id} - Full update with nodes"""
        # First create a workflow
        workflow = self.test_02_create_workflow()
        workflow_id = workflow["id"]
        
        # Update with new nodes
        update_payload = {
            "name": workflow["name"] + "_Updated",
            "description": "Updated description",
            "nodes": [
                {
                    "id": "trigger-new",
                    "type": "trigger",
                    "label": "New Trigger",
                    "position": {"x": 100, "y": 100},
                    "data": {"trigger_type": "form_submit"}
                }
            ],
            "edges": []
        }
        
        response = self.session.put(f"{BASE_URL}/api/workflows/{workflow_id}", json=update_payload)
        assert response.status_code == 200, f"Failed to update workflow: {response.text}"
        
        data = response.json()
        assert data["description"] == "Updated description"
        assert len(data["nodes"]) == 1
        print(f"✓ Updated workflow with PUT: {data['name']}")
    
    def test_07_update_workflow_partial(self):
        """Test PATCH /api/workflows/{id} - Partial update"""
        # First create a workflow
        workflow = self.test_02_create_workflow()
        workflow_id = workflow["id"]
        
        # Partial update - only description
        update_payload = {
            "description": "Partially updated description"
        }
        
        response = self.session.patch(f"{BASE_URL}/api/workflows/{workflow_id}", json=update_payload)
        assert response.status_code == 200, f"Failed to patch workflow: {response.text}"
        
        data = response.json()
        assert data["description"] == "Partially updated description"
        assert data["name"] == workflow["name"]  # Name unchanged
        print(f"✓ Partially updated workflow with PATCH")
    
    def test_08_duplicate_workflow(self):
        """Test POST /api/workflows/{id}/duplicate - Duplicate workflow"""
        # First create a workflow with nodes
        workflow = self.test_03_create_workflow_with_nodes()
        workflow_id = workflow["id"]
        
        # Duplicate it
        new_name = f"TEST_Duplicated_{uuid.uuid4().hex[:8]}"
        response = self.session.post(
            f"{BASE_URL}/api/workflows/{workflow_id}/duplicate",
            params={"new_name": new_name}
        )
        assert response.status_code == 200, f"Failed to duplicate workflow: {response.text}"
        
        data = response.json()
        assert data["name"] == new_name
        assert data["id"] != workflow_id  # Different ID
        assert len(data["nodes"]) == len(workflow["nodes"])  # Same nodes
        assert len(data["edges"]) == len(workflow["edges"])  # Same edges
        
        self.created_workflow_ids.append(data["id"])
        print(f"✓ Duplicated workflow: {data['name']}")
    
    def test_09_duplicate_workflow_name_conflict(self):
        """Test POST /api/workflows/{id}/duplicate - Conflict on duplicate name"""
        # First create a workflow
        workflow = self.test_02_create_workflow()
        workflow_id = workflow["id"]
        
        # Try to duplicate with same name
        response = self.session.post(
            f"{BASE_URL}/api/workflows/{workflow_id}/duplicate",
            params={"new_name": workflow["name"]}
        )
        assert response.status_code == 400, f"Expected 400 for duplicate name, got {response.status_code}"
        print("✓ Correctly rejects duplicate with existing name")
    
    def test_10_delete_workflow(self):
        """Test DELETE /api/workflows/{id} - Soft delete workflow"""
        # First create a workflow
        workflow = self.test_02_create_workflow()
        workflow_id = workflow["id"]
        
        # Delete it
        response = self.session.delete(f"{BASE_URL}/api/workflows/{workflow_id}")
        assert response.status_code == 200, f"Failed to delete workflow: {response.text}"
        
        # Verify it's deactivated (not in active list)
        list_response = self.session.get(f"{BASE_URL}/api/workflows")
        workflows = list_response.json()
        workflow_ids = [w["id"] for w in workflows]
        assert workflow_id not in workflow_ids, "Deleted workflow should not appear in active list"
        
        # Remove from cleanup list since already deleted
        if workflow_id in self.created_workflow_ids:
            self.created_workflow_ids.remove(workflow_id)
        
        print("✓ Deleted workflow (soft delete)")
    
    def test_11_create_workflow_duplicate_name(self):
        """Test POST /api/workflows - Reject duplicate name"""
        # First create a workflow
        workflow = self.test_02_create_workflow()
        
        # Try to create another with same name
        payload = {
            "name": workflow["name"],
            "description": "Duplicate name test"
        }
        
        response = self.session.post(f"{BASE_URL}/api/workflows", json=payload)
        assert response.status_code == 400, f"Expected 400 for duplicate name, got {response.status_code}"
        print("✓ Correctly rejects workflow with duplicate name")
    
    def test_12_workflow_meta_actions(self):
        """Test GET /api/workflows/meta/actions - Get available actions"""
        response = self.session.get(f"{BASE_URL}/api/workflows/meta/actions")
        assert response.status_code == 200, f"Failed to get workflow actions: {response.text}"
        
        data = response.json()
        assert "actions" in data
        assert len(data["actions"]) > 0
        
        action_types = [a["type"] for a in data["actions"]]
        expected_actions = ["assign_role", "forward_ticket", "email_user", "email_requester", "update_status", "notify", "webhook"]
        for expected in expected_actions:
            assert expected in action_types, f"Missing action type: {expected}"
        
        print(f"✓ Got {len(data['actions'])} workflow action types")
    
    def test_13_workflow_meta_field_types(self):
        """Test GET /api/workflows/meta/field-types - Get form field types"""
        response = self.session.get(f"{BASE_URL}/api/workflows/meta/field-types")
        assert response.status_code == 200, f"Failed to get field types: {response.text}"
        
        data = response.json()
        assert "field_types" in data
        assert len(data["field_types"]) > 0
        print(f"✓ Got {len(data['field_types'])} form field types")
    
    def test_14_workflow_with_all_node_types(self):
        """Test creating workflow with all 5 node types"""
        workflow_name = f"TEST_AllNodes_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "name": workflow_name,
            "description": "Workflow with all node types",
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Start Trigger",
                    "position": {"x": 250, "y": 0},
                    "data": {"trigger_type": "ticket_created"}
                },
                {
                    "id": "form-1",
                    "type": "form",
                    "label": "Collect Info",
                    "position": {"x": 250, "y": 100},
                    "data": {
                        "fields": [
                            {"id": "f1", "name": "name", "label": "Name", "field_type": "text", "required": True}
                        ]
                    }
                },
                {
                    "id": "condition-1",
                    "type": "condition",
                    "label": "Check Priority",
                    "position": {"x": 250, "y": 200},
                    "data": {
                        "conditions": [
                            {"id": "c1", "field": "priority", "operator": "equals", "value": "High"}
                        ]
                    }
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "label": "Assign Role",
                    "position": {"x": 100, "y": 300},
                    "data": {
                        "actions": [
                            {"id": "a1", "action_type": "assign_role", "config": {"role_id": "editor"}}
                        ]
                    }
                },
                {
                    "id": "end-1",
                    "type": "end",
                    "label": "Complete",
                    "position": {"x": 250, "y": 400},
                    "data": {}
                }
            ],
            "edges": [
                {"id": "e1", "source": "trigger-1", "target": "form-1"},
                {"id": "e2", "source": "form-1", "target": "condition-1"},
                {"id": "e3", "source": "condition-1", "target": "action-1", "source_handle": "yes", "label": "Yes"},
                {"id": "e4", "source": "condition-1", "target": "end-1", "source_handle": "no", "label": "No"},
                {"id": "e5", "source": "action-1", "target": "end-1"}
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/workflows", json=payload)
        assert response.status_code == 200, f"Failed to create workflow with all nodes: {response.text}"
        
        data = response.json()
        assert len(data["nodes"]) == 5, f"Expected 5 nodes, got {len(data['nodes'])}"
        assert len(data["edges"]) == 5, f"Expected 5 edges, got {len(data['edges'])}"
        
        # Verify all node types present
        node_types = [n["type"] for n in data["nodes"]]
        for expected_type in ["trigger", "form", "condition", "action", "end"]:
            assert expected_type in node_types, f"Missing node type: {expected_type}"
        
        self.created_workflow_ids.append(data["id"])
        print(f"✓ Created workflow with all 5 node types: trigger, form, condition, action, end")
        return data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
