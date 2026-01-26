"""
Test suite for Workflow Builder Enhancements
Tests: assigned_teams, trigger_categories, form fields with conditional sub-fields, is_trigger flag
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ticketflow-129.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


class TestWorkflowEnhancements:
    """Test Workflow enhancements: teams, categories, conditional sub-fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token and fetch existing data"""
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
        
        # Fetch existing roles, teams, and categories for testing
        self.roles = self.session.get(f"{BASE_URL}/api/roles").json()
        self.teams = self.session.get(f"{BASE_URL}/api/teams").json()
        self.categories_l1 = self.session.get(f"{BASE_URL}/api/categories/l1").json()
        self.categories_l2 = self.session.get(f"{BASE_URL}/api/categories/l2").json()
        
        # Store created IDs for cleanup
        self.created_workflow_ids = []
        self.created_team_ids = []
        self.created_category_ids = []
        
        yield
        
        # Cleanup
        for wf_id in self.created_workflow_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/workflows/{wf_id}")
            except:
                pass
        for team_id in self.created_team_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/teams/{team_id}")
            except:
                pass
    
    # ============== ASSIGNED TEAMS TESTS ==============
    
    def test_01_workflow_response_includes_assigned_teams_field(self):
        """Test GET /api/workflows returns assigned_teams field"""
        response = self.session.get(f"{BASE_URL}/api/workflows")
        assert response.status_code == 200, f"Failed to list workflows: {response.text}"
        
        data = response.json()
        if len(data) > 0:
            workflow = data[0]
            assert "assigned_teams" in workflow, "Response should include assigned_teams field"
            assert "assigned_team_names" in workflow, "Response should include assigned_team_names field"
            print(f"✓ Workflow response includes assigned_teams: {workflow.get('assigned_teams', [])}")
            print(f"✓ Workflow response includes assigned_team_names: {workflow.get('assigned_team_names', [])}")
        else:
            print("✓ No workflows to check, but API returned successfully")
    
    def test_02_workflow_response_includes_trigger_categories_field(self):
        """Test GET /api/workflows returns trigger_categories field"""
        response = self.session.get(f"{BASE_URL}/api/workflows")
        assert response.status_code == 200, f"Failed to list workflows: {response.text}"
        
        data = response.json()
        if len(data) > 0:
            workflow = data[0]
            assert "trigger_categories" in workflow, "Response should include trigger_categories field"
            assert "trigger_category_names" in workflow, "Response should include trigger_category_names field"
            print(f"✓ Workflow response includes trigger_categories: {workflow.get('trigger_categories', [])}")
            print(f"✓ Workflow response includes trigger_category_names: {workflow.get('trigger_category_names', [])}")
        else:
            print("✓ No workflows to check, but API returned successfully")
    
    def test_03_create_workflow_with_assigned_teams(self):
        """Test POST /api/workflows with assigned_teams"""
        # First ensure we have a team to assign
        team_id = None
        if len(self.teams) > 0:
            team_id = self.teams[0]["id"]
        else:
            # Create a test team
            team_response = self.session.post(f"{BASE_URL}/api/teams", json={
                "name": f"TEST_Team_{uuid.uuid4().hex[:8]}",
                "description": "Test team for workflow testing"
            })
            if team_response.status_code == 200:
                team_id = team_response.json()["id"]
                self.created_team_ids.append(team_id)
        
        workflow_name = f"TEST_TeamWorkflow_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": workflow_name,
            "description": "Workflow with assigned teams",
            "assigned_roles": [],
            "assigned_teams": [team_id] if team_id else [],
            "trigger_categories": [],
            "nodes": [],
            "edges": []
        }
        
        response = self.session.post(f"{BASE_URL}/api/workflows", json=payload)
        assert response.status_code == 200, f"Failed to create workflow: {response.text}"
        
        data = response.json()
        self.created_workflow_ids.append(data["id"])
        
        if team_id:
            assert team_id in data["assigned_teams"], "Team should be in assigned_teams"
            assert len(data["assigned_team_names"]) > 0, "Should have team names populated"
            print(f"✓ Created workflow with assigned_teams: {data['assigned_teams']}")
            print(f"✓ Team names resolved: {data['assigned_team_names']}")
        else:
            print("✓ Created workflow (no teams available to assign)")
        
        return data
    
    def test_04_create_workflow_with_trigger_categories(self):
        """Test POST /api/workflows with trigger_categories"""
        # Get a category ID to use
        category_id = None
        if len(self.categories_l2) > 0:
            category_id = self.categories_l2[0]["id"]
        elif len(self.categories_l1) > 0:
            category_id = self.categories_l1[0]["id"]
        
        workflow_name = f"TEST_CategoryWorkflow_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": workflow_name,
            "description": "Workflow with trigger categories",
            "assigned_roles": [],
            "assigned_teams": [],
            "trigger_categories": [category_id] if category_id else [],
            "nodes": [],
            "edges": []
        }
        
        response = self.session.post(f"{BASE_URL}/api/workflows", json=payload)
        assert response.status_code == 200, f"Failed to create workflow: {response.text}"
        
        data = response.json()
        self.created_workflow_ids.append(data["id"])
        
        if category_id:
            assert category_id in data["trigger_categories"], "Category should be in trigger_categories"
            assert len(data["trigger_category_names"]) > 0, "Should have category names populated"
            print(f"✓ Created workflow with trigger_categories: {data['trigger_categories']}")
            print(f"✓ Category names resolved: {data['trigger_category_names']}")
        else:
            print("✓ Created workflow (no categories available to assign)")
        
        return data
    
    def test_05_patch_workflow_with_assigned_teams(self):
        """Test PATCH /api/workflows/{id} accepts assigned_teams"""
        # Create a workflow first
        workflow_name = f"TEST_PatchTeam_{uuid.uuid4().hex[:8]}"
        create_response = self.session.post(f"{BASE_URL}/api/workflows", json={
            "name": workflow_name,
            "description": "Test workflow"
        })
        assert create_response.status_code == 200
        workflow = create_response.json()
        self.created_workflow_ids.append(workflow["id"])
        
        # Get a team ID
        team_id = None
        if len(self.teams) > 0:
            team_id = self.teams[0]["id"]
        
        if team_id:
            # Patch with assigned_teams
            patch_response = self.session.patch(f"{BASE_URL}/api/workflows/{workflow['id']}", json={
                "assigned_teams": [team_id]
            })
            assert patch_response.status_code == 200, f"Failed to patch workflow: {patch_response.text}"
            
            data = patch_response.json()
            assert team_id in data["assigned_teams"], "Team should be in assigned_teams after PATCH"
            print(f"✓ PATCH /api/workflows/{workflow['id']} accepted assigned_teams")
            print(f"✓ Updated assigned_teams: {data['assigned_teams']}")
            print(f"✓ Updated assigned_team_names: {data['assigned_team_names']}")
        else:
            print("✓ Skipped (no teams available)")
    
    def test_06_patch_workflow_with_trigger_categories(self):
        """Test PATCH /api/workflows/{id} accepts trigger_categories"""
        # Create a workflow first
        workflow_name = f"TEST_PatchCategory_{uuid.uuid4().hex[:8]}"
        create_response = self.session.post(f"{BASE_URL}/api/workflows", json={
            "name": workflow_name,
            "description": "Test workflow"
        })
        assert create_response.status_code == 200
        workflow = create_response.json()
        self.created_workflow_ids.append(workflow["id"])
        
        # Get a category ID
        category_id = None
        if len(self.categories_l2) > 0:
            category_id = self.categories_l2[0]["id"]
        elif len(self.categories_l1) > 0:
            category_id = self.categories_l1[0]["id"]
        
        if category_id:
            # Patch with trigger_categories
            patch_response = self.session.patch(f"{BASE_URL}/api/workflows/{workflow['id']}", json={
                "trigger_categories": [category_id]
            })
            assert patch_response.status_code == 200, f"Failed to patch workflow: {patch_response.text}"
            
            data = patch_response.json()
            assert category_id in data["trigger_categories"], "Category should be in trigger_categories after PATCH"
            print(f"✓ PATCH /api/workflows/{workflow['id']} accepted trigger_categories")
            print(f"✓ Updated trigger_categories: {data['trigger_categories']}")
            print(f"✓ Updated trigger_category_names: {data['trigger_category_names']}")
        else:
            print("✓ Skipped (no categories available)")
    
    # ============== FORM FIELDS WITH CONDITIONAL SUB-FIELDS TESTS ==============
    
    def test_07_create_workflow_with_form_node_trigger_field(self):
        """Test creating workflow with form node containing is_trigger field"""
        workflow_name = f"TEST_FormTrigger_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "name": workflow_name,
            "description": "Workflow with form trigger field",
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Start",
                    "position": {"x": 250, "y": 50},
                    "data": {"trigger_type": "manual"}
                },
                {
                    "id": "form-1",
                    "type": "form",
                    "label": "Category Form",
                    "position": {"x": 250, "y": 150},
                    "data": {
                        "fields": [
                            {
                                "id": "field-category",
                                "name": "category",
                                "label": "Category",
                                "field_type": "select",
                                "required": True,
                                "is_trigger": True,
                                "options": ["Renovation", "New Build", "Repair"]
                            }
                        ]
                    }
                }
            ],
            "edges": [
                {"id": "e1", "source": "trigger-1", "target": "form-1"}
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/workflows", json=payload)
        assert response.status_code == 200, f"Failed to create workflow: {response.text}"
        
        data = response.json()
        self.created_workflow_ids.append(data["id"])
        
        # Verify form node has is_trigger field
        form_node = next((n for n in data["nodes"] if n["type"] == "form"), None)
        assert form_node is not None, "Form node should exist"
        
        fields = form_node.get("data", {}).get("fields", [])
        assert len(fields) > 0, "Form should have fields"
        
        trigger_field = fields[0]
        assert trigger_field.get("is_trigger") == True, "Field should have is_trigger=True"
        print(f"✓ Created workflow with form field is_trigger=True")
        print(f"✓ Field: {trigger_field['label']} (is_trigger: {trigger_field.get('is_trigger')})")
        
        return data
    
    def test_08_create_workflow_with_conditional_sub_fields(self):
        """Test creating workflow with form node containing conditional sub-fields"""
        workflow_name = f"TEST_SubFields_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "name": workflow_name,
            "description": "Workflow with conditional sub-fields",
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Start",
                    "position": {"x": 250, "y": 50},
                    "data": {"trigger_type": "manual"}
                },
                {
                    "id": "form-1",
                    "type": "form",
                    "label": "Dynamic Form",
                    "position": {"x": 250, "y": 150},
                    "data": {
                        "fields": [
                            {
                                "id": "field-category",
                                "name": "category",
                                "label": "Category",
                                "field_type": "select",
                                "required": True,
                                "is_trigger": True,
                                "options": ["Renovation", "New Build", "Repair"],
                                "sub_fields": [
                                    {
                                        "id": "subfield-bedrooms",
                                        "parent_value": "Renovation",
                                        "label": "How many bedrooms?",
                                        "field_type": "select",
                                        "required": True,
                                        "is_trigger": False,
                                        "options": ["1", "2", "3", "4+"]
                                    },
                                    {
                                        "id": "subfield-budget",
                                        "parent_value": "New Build",
                                        "label": "Budget Range",
                                        "field_type": "select",
                                        "required": True,
                                        "is_trigger": True,
                                        "options": ["Under $100k", "$100k-$500k", "Over $500k"]
                                    }
                                ]
                            }
                        ]
                    }
                }
            ],
            "edges": [
                {"id": "e1", "source": "trigger-1", "target": "form-1"}
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/workflows", json=payload)
        assert response.status_code == 200, f"Failed to create workflow: {response.text}"
        
        data = response.json()
        self.created_workflow_ids.append(data["id"])
        
        # Verify form node has sub_fields
        form_node = next((n for n in data["nodes"] if n["type"] == "form"), None)
        assert form_node is not None, "Form node should exist"
        
        fields = form_node.get("data", {}).get("fields", [])
        assert len(fields) > 0, "Form should have fields"
        
        category_field = fields[0]
        sub_fields = category_field.get("sub_fields", [])
        assert len(sub_fields) == 2, f"Expected 2 sub-fields, got {len(sub_fields)}"
        
        # Verify sub-field structure
        renovation_subfield = next((sf for sf in sub_fields if sf.get("parent_value") == "Renovation"), None)
        assert renovation_subfield is not None, "Should have sub-field for Renovation"
        assert renovation_subfield["label"] == "How many bedrooms?", "Sub-field label should match"
        assert renovation_subfield["options"] == ["1", "2", "3", "4+"], "Sub-field options should match"
        
        print(f"✓ Created workflow with conditional sub-fields")
        print(f"✓ Parent field: {category_field['label']} with {len(sub_fields)} sub-fields")
        for sf in sub_fields:
            print(f"  - When '{sf['parent_value']}': Show '{sf['label']}' (is_trigger: {sf.get('is_trigger', False)})")
        
        return data
    
    def test_09_get_workflow_preserves_sub_fields(self):
        """Test GET /api/workflows/{id} preserves sub-fields structure"""
        # Create workflow with sub-fields
        workflow = self.test_08_create_workflow_with_conditional_sub_fields()
        workflow_id = workflow["id"]
        
        # Fetch it back
        response = self.session.get(f"{BASE_URL}/api/workflows/{workflow_id}")
        assert response.status_code == 200, f"Failed to get workflow: {response.text}"
        
        data = response.json()
        
        # Verify sub-fields are preserved
        form_node = next((n for n in data["nodes"] if n["type"] == "form"), None)
        fields = form_node.get("data", {}).get("fields", [])
        sub_fields = fields[0].get("sub_fields", [])
        
        assert len(sub_fields) == 2, "Sub-fields should be preserved on GET"
        print(f"✓ GET /api/workflows/{workflow_id} preserves sub-fields structure")
    
    def test_10_update_workflow_with_sub_fields(self):
        """Test PUT /api/workflows/{id} can update sub-fields"""
        # Create a basic workflow first
        workflow_name = f"TEST_UpdateSubFields_{uuid.uuid4().hex[:8]}"
        create_response = self.session.post(f"{BASE_URL}/api/workflows", json={
            "name": workflow_name,
            "description": "Test workflow"
        })
        assert create_response.status_code == 200
        workflow = create_response.json()
        self.created_workflow_ids.append(workflow["id"])
        
        # Update with form node containing sub-fields
        update_payload = {
            "nodes": [
                {
                    "id": "form-1",
                    "type": "form",
                    "label": "Updated Form",
                    "position": {"x": 250, "y": 150},
                    "data": {
                        "fields": [
                            {
                                "id": "field-type",
                                "name": "request_type",
                                "label": "Request Type",
                                "field_type": "select",
                                "required": True,
                                "is_trigger": True,
                                "options": ["Support", "Sales", "Other"],
                                "sub_fields": [
                                    {
                                        "id": "subfield-urgency",
                                        "parent_value": "Support",
                                        "label": "Urgency Level",
                                        "field_type": "select",
                                        "options": ["Low", "Medium", "High"]
                                    }
                                ]
                            }
                        ]
                    }
                }
            ],
            "edges": []
        }
        
        response = self.session.put(f"{BASE_URL}/api/workflows/{workflow['id']}", json=update_payload)
        assert response.status_code == 200, f"Failed to update workflow: {response.text}"
        
        data = response.json()
        
        # Verify update
        form_node = next((n for n in data["nodes"] if n["type"] == "form"), None)
        assert form_node is not None, "Form node should exist after update"
        
        fields = form_node.get("data", {}).get("fields", [])
        sub_fields = fields[0].get("sub_fields", [])
        assert len(sub_fields) == 1, "Sub-fields should be updated"
        
        print(f"✓ PUT /api/workflows/{workflow['id']} successfully updated sub-fields")
    
    # ============== WORKFLOW BY TEAM/CATEGORY ENDPOINTS ==============
    
    def test_11_get_workflows_by_team(self):
        """Test GET /api/workflows/by-team/{team_id}"""
        if len(self.teams) == 0:
            print("✓ Skipped (no teams available)")
            return
        
        team_id = self.teams[0]["id"]
        
        # Create a workflow assigned to this team
        workflow_name = f"TEST_ByTeam_{uuid.uuid4().hex[:8]}"
        create_response = self.session.post(f"{BASE_URL}/api/workflows", json={
            "name": workflow_name,
            "description": "Test workflow",
            "assigned_teams": [team_id]
        })
        assert create_response.status_code == 200
        workflow = create_response.json()
        self.created_workflow_ids.append(workflow["id"])
        
        # Get workflows by team
        response = self.session.get(f"{BASE_URL}/api/workflows/by-team/{team_id}")
        assert response.status_code == 200, f"Failed to get workflows by team: {response.text}"
        
        data = response.json()
        workflow_ids = [w["id"] for w in data]
        assert workflow["id"] in workflow_ids, "Created workflow should be in team's workflows"
        
        print(f"✓ GET /api/workflows/by-team/{team_id} returns {len(data)} workflows")
    
    def test_12_get_workflows_by_category(self):
        """Test GET /api/workflows/by-category/{category_id}"""
        category_id = None
        if len(self.categories_l2) > 0:
            category_id = self.categories_l2[0]["id"]
        elif len(self.categories_l1) > 0:
            category_id = self.categories_l1[0]["id"]
        
        if not category_id:
            print("✓ Skipped (no categories available)")
            return
        
        # Create a workflow with this trigger category
        workflow_name = f"TEST_ByCategory_{uuid.uuid4().hex[:8]}"
        create_response = self.session.post(f"{BASE_URL}/api/workflows", json={
            "name": workflow_name,
            "description": "Test workflow",
            "trigger_categories": [category_id]
        })
        assert create_response.status_code == 200
        workflow = create_response.json()
        self.created_workflow_ids.append(workflow["id"])
        
        # Get workflows by category
        response = self.session.get(f"{BASE_URL}/api/workflows/by-category/{category_id}")
        assert response.status_code == 200, f"Failed to get workflows by category: {response.text}"
        
        data = response.json()
        workflow_ids = [w["id"] for w in data]
        assert workflow["id"] in workflow_ids, "Created workflow should be in category's workflows"
        
        print(f"✓ GET /api/workflows/by-category/{category_id} returns {len(data)} workflows")
    
    # ============== COMBINED TESTS ==============
    
    def test_13_create_complete_workflow_with_all_enhancements(self):
        """Test creating a complete workflow with teams, categories, and sub-fields"""
        # Get IDs for assignment
        team_id = self.teams[0]["id"] if len(self.teams) > 0 else None
        role_id = None
        for role in self.roles:
            if role.get("can_pick_orders"):
                role_id = role["id"]
                break
        category_id = self.categories_l2[0]["id"] if len(self.categories_l2) > 0 else (
            self.categories_l1[0]["id"] if len(self.categories_l1) > 0 else None
        )
        
        workflow_name = f"TEST_Complete_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "name": workflow_name,
            "description": "Complete workflow with all enhancements",
            "assigned_roles": [role_id] if role_id else [],
            "assigned_teams": [team_id] if team_id else [],
            "trigger_categories": [category_id] if category_id else [],
            "color": "#8B5CF6",
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Ticket Created",
                    "position": {"x": 250, "y": 0},
                    "data": {"trigger_type": "ticket_created"}
                },
                {
                    "id": "form-1",
                    "type": "form",
                    "label": "Intake Form",
                    "position": {"x": 250, "y": 100},
                    "data": {
                        "fields": [
                            {
                                "id": "field-category",
                                "name": "category",
                                "label": "Category",
                                "field_type": "select",
                                "required": True,
                                "is_trigger": True,
                                "options": ["Renovation", "New Build", "Repair"],
                                "sub_fields": [
                                    {
                                        "id": "subfield-bedrooms",
                                        "parent_value": "Renovation",
                                        "label": "How many bedrooms?",
                                        "field_type": "select",
                                        "required": True,
                                        "is_trigger": False,
                                        "options": ["1", "2", "3", "4+"]
                                    }
                                ]
                            },
                            {
                                "id": "field-priority",
                                "name": "priority",
                                "label": "Priority",
                                "field_type": "select",
                                "required": True,
                                "is_trigger": True,
                                "options": ["Low", "Normal", "High", "Urgent"]
                            }
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
                            {"id": "c1", "field": "priority", "operator": "equals", "value": "Urgent"}
                        ]
                    }
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "label": "Notify Team",
                    "position": {"x": 100, "y": 300},
                    "data": {
                        "actions": [
                            {"id": "a1", "action_type": "notify", "config": {"message": "Urgent ticket received!"}}
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
        assert response.status_code == 200, f"Failed to create complete workflow: {response.text}"
        
        data = response.json()
        self.created_workflow_ids.append(data["id"])
        
        # Verify all enhancements
        print(f"✓ Created complete workflow: {data['name']}")
        print(f"  - Assigned roles: {data.get('assigned_role_names', [])}")
        print(f"  - Assigned teams: {data.get('assigned_team_names', [])}")
        print(f"  - Trigger categories: {data.get('trigger_category_names', [])}")
        print(f"  - Nodes: {len(data['nodes'])}")
        print(f"  - Edges: {len(data['edges'])}")
        
        # Verify form fields with sub-fields
        form_node = next((n for n in data["nodes"] if n["type"] == "form"), None)
        if form_node:
            fields = form_node.get("data", {}).get("fields", [])
            for field in fields:
                print(f"  - Field: {field['label']} (is_trigger: {field.get('is_trigger', False)})")
                for sf in field.get("sub_fields", []):
                    print(f"    - Sub-field: {sf['label']} when parent='{sf['parent_value']}'")
        
        return data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
