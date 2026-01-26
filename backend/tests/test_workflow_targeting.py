"""
Test Workflow Module Alignment - Specialty and Access Tier Targeting
Tests for:
1. Workflow Templates API returns object with 'templates' and 'categories' keys
2. Workflow API returns assigned_specialties and assigned_access_tiers fields
3. Creating/updating workflows with specialty and access tier targeting
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWorkflowTemplates:
    """Test workflow templates API structure"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_templates_returns_object_with_templates_and_categories(self):
        """Verify templates endpoint returns {templates: [], categories: []}"""
        response = requests.get(f"{BASE_URL}/api/workflow-templates", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "templates" in data, "Response should have 'templates' key"
        assert "categories" in data, "Response should have 'categories' key"
        assert isinstance(data["templates"], list), "templates should be a list"
        assert isinstance(data["categories"], list), "categories should be a list"
    
    def test_templates_returns_6_templates(self):
        """Verify 6 templates are returned"""
        response = requests.get(f"{BASE_URL}/api/workflow-templates", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["templates"]) == 6, f"Expected 6 templates, got {len(data['templates'])}"
    
    def test_templates_returns_6_categories(self):
        """Verify 6 categories are returned"""
        response = requests.get(f"{BASE_URL}/api/workflow-templates", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        expected_categories = ["Assignment", "Automation", "Escalation", "Feedback", "Integration", "Routing"]
        assert len(data["categories"]) == 6, f"Expected 6 categories, got {len(data['categories'])}"
        for cat in expected_categories:
            assert cat in data["categories"], f"Category '{cat}' not found"
    
    def test_templates_filter_by_category(self):
        """Verify templates can be filtered by category"""
        response = requests.get(f"{BASE_URL}/api/workflow-templates?category=Assignment", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["templates"]) >= 1, "Should have at least 1 Assignment template"
        for template in data["templates"]:
            assert template["category"] == "Assignment"
    
    def test_template_structure(self):
        """Verify template structure has required fields"""
        response = requests.get(f"{BASE_URL}/api/workflow-templates", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        template = data["templates"][0]
        required_fields = ["id", "name", "description", "category", "icon", "color", "popularity", "nodes", "edges"]
        for field in required_fields:
            assert field in template, f"Template missing field: {field}"


class TestWorkflowSpecialtyAccessTierFields:
    """Test workflow API returns specialty and access tier fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_workflows_list_has_specialty_fields(self):
        """Verify workflows list returns assigned_specialties and assigned_specialty_names"""
        response = requests.get(f"{BASE_URL}/api/workflows", headers=self.headers)
        assert response.status_code == 200
        
        workflows = response.json()
        if len(workflows) > 0:
            workflow = workflows[0]
            assert "assigned_specialties" in workflow, "Workflow should have assigned_specialties field"
            assert "assigned_specialty_names" in workflow, "Workflow should have assigned_specialty_names field"
            assert isinstance(workflow["assigned_specialties"], list)
            assert isinstance(workflow["assigned_specialty_names"], list)
    
    def test_workflows_list_has_access_tier_fields(self):
        """Verify workflows list returns assigned_access_tiers and assigned_access_tier_names"""
        response = requests.get(f"{BASE_URL}/api/workflows", headers=self.headers)
        assert response.status_code == 200
        
        workflows = response.json()
        if len(workflows) > 0:
            workflow = workflows[0]
            assert "assigned_access_tiers" in workflow, "Workflow should have assigned_access_tiers field"
            assert "assigned_access_tier_names" in workflow, "Workflow should have assigned_access_tier_names field"
            assert isinstance(workflow["assigned_access_tiers"], list)
            assert isinstance(workflow["assigned_access_tier_names"], list)


class TestWorkflowSpecialtyTargeting:
    """Test creating and updating workflows with specialty targeting"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token, fetch specialties"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get specialties
        spec_response = requests.get(f"{BASE_URL}/api/specialties", headers=self.headers)
        self.specialties = spec_response.json()
        
        # Get access tiers
        tier_response = requests.get(f"{BASE_URL}/api/access-tiers", headers=self.headers)
        self.access_tiers = tier_response.json()
    
    def test_create_workflow_with_specialties(self):
        """Test creating a workflow with assigned specialties"""
        specialty_ids = [self.specialties[0]["id"], self.specialties[1]["id"]] if len(self.specialties) >= 2 else []
        
        workflow_data = {
            "name": "TEST_Specialty_Workflow",
            "description": "Test workflow with specialty targeting",
            "assigned_specialties": specialty_ids,
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Start",
                    "position": {"x": 250, "y": 50},
                    "data": {"trigger_type": "manual"}
                }
            ],
            "edges": []
        }
        
        response = requests.post(f"{BASE_URL}/api/workflows", json=workflow_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create workflow: {response.text}"
        
        created = response.json()
        assert created["assigned_specialties"] == specialty_ids
        assert len(created["assigned_specialty_names"]) == len(specialty_ids)
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/workflows/{created['id']}", headers=self.headers)
    
    def test_create_workflow_with_access_tiers(self):
        """Test creating a workflow with assigned access tiers"""
        tier_ids = [self.access_tiers[0]["id"]] if len(self.access_tiers) >= 1 else []
        
        workflow_data = {
            "name": "TEST_AccessTier_Workflow",
            "description": "Test workflow with access tier targeting",
            "assigned_access_tiers": tier_ids,
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Start",
                    "position": {"x": 250, "y": 50},
                    "data": {"trigger_type": "manual"}
                }
            ],
            "edges": []
        }
        
        response = requests.post(f"{BASE_URL}/api/workflows", json=workflow_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create workflow: {response.text}"
        
        created = response.json()
        assert created["assigned_access_tiers"] == tier_ids
        assert len(created["assigned_access_tier_names"]) == len(tier_ids)
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/workflows/{created['id']}", headers=self.headers)
    
    def test_update_workflow_specialties_via_patch(self):
        """Test updating workflow specialties via PATCH"""
        # Create workflow first
        workflow_data = {
            "name": "TEST_Update_Specialty_Workflow",
            "description": "Test workflow for specialty update",
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Start",
                    "position": {"x": 250, "y": 50},
                    "data": {"trigger_type": "manual"}
                }
            ],
            "edges": []
        }
        
        create_response = requests.post(f"{BASE_URL}/api/workflows", json=workflow_data, headers=self.headers)
        assert create_response.status_code == 200
        workflow_id = create_response.json()["id"]
        
        # Update with specialties
        specialty_ids = [self.specialties[0]["id"]] if len(self.specialties) >= 1 else []
        update_response = requests.patch(
            f"{BASE_URL}/api/workflows/{workflow_id}",
            json={"assigned_specialties": specialty_ids},
            headers=self.headers
        )
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["assigned_specialties"] == specialty_ids
        assert len(updated["assigned_specialty_names"]) == len(specialty_ids)
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/workflows/{workflow_id}", headers=self.headers)
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["assigned_specialties"] == specialty_ids
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/workflows/{workflow_id}", headers=self.headers)
    
    def test_update_workflow_access_tiers_via_patch(self):
        """Test updating workflow access tiers via PATCH"""
        # Create workflow first
        workflow_data = {
            "name": "TEST_Update_AccessTier_Workflow",
            "description": "Test workflow for access tier update",
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Start",
                    "position": {"x": 250, "y": 50},
                    "data": {"trigger_type": "manual"}
                }
            ],
            "edges": []
        }
        
        create_response = requests.post(f"{BASE_URL}/api/workflows", json=workflow_data, headers=self.headers)
        assert create_response.status_code == 200
        workflow_id = create_response.json()["id"]
        
        # Update with access tiers
        tier_ids = [self.access_tiers[0]["id"], self.access_tiers[1]["id"]] if len(self.access_tiers) >= 2 else []
        update_response = requests.patch(
            f"{BASE_URL}/api/workflows/{workflow_id}",
            json={"assigned_access_tiers": tier_ids},
            headers=self.headers
        )
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["assigned_access_tiers"] == tier_ids
        assert len(updated["assigned_access_tier_names"]) == len(tier_ids)
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/workflows/{workflow_id}", headers=self.headers)
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["assigned_access_tiers"] == tier_ids
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/workflows/{workflow_id}", headers=self.headers)


class TestWorkflowBySpecialtyAndTier:
    """Test workflow filtering by specialty and access tier"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get specialties and tiers
        spec_response = requests.get(f"{BASE_URL}/api/specialties", headers=self.headers)
        self.specialties = spec_response.json()
        
        tier_response = requests.get(f"{BASE_URL}/api/access-tiers", headers=self.headers)
        self.access_tiers = tier_response.json()
    
    def test_get_workflows_by_specialty(self):
        """Test GET /api/workflows/by-specialty/{specialty_id}"""
        if len(self.specialties) == 0:
            pytest.skip("No specialties available")
        
        specialty_id = self.specialties[0]["id"]
        response = requests.get(f"{BASE_URL}/api/workflows/by-specialty/{specialty_id}", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_workflows_by_access_tier(self):
        """Test GET /api/workflows/by-access-tier/{tier_id}"""
        if len(self.access_tiers) == 0:
            pytest.skip("No access tiers available")
        
        tier_id = self.access_tiers[0]["id"]
        response = requests.get(f"{BASE_URL}/api/workflows/by-access-tier/{tier_id}", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestSpecialtiesAndAccessTiersExist:
    """Verify specialties and access tiers data exists in database"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_specialties_exist(self):
        """Verify specialties data exists"""
        response = requests.get(f"{BASE_URL}/api/specialties", headers=self.headers)
        assert response.status_code == 200
        specialties = response.json()
        assert len(specialties) > 0, "No specialties found in database"
        
        # Verify structure
        specialty = specialties[0]
        assert "id" in specialty
        assert "name" in specialty
    
    def test_access_tiers_exist(self):
        """Verify access tiers data exists"""
        response = requests.get(f"{BASE_URL}/api/access-tiers", headers=self.headers)
        assert response.status_code == 200
        tiers = response.json()
        assert len(tiers) > 0, "No access tiers found in database"
        
        # Verify structure
        tier = tiers[0]
        assert "id" in tier
        assert "name" in tier
