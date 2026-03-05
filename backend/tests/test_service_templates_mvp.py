"""
Service Templates MVP Test Suite
Tests for service-template-driven client intake flow:
- GET /api/service-templates returns 9 templates with correct form_schema
- POST /api/orders with service_template_id auto-resolves hidden category L1 from template
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://i18n-fix-11.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Admin123!"
CLIENT_EMAIL = "test2@client.com"
CLIENT_PASSWORD = "Client123!"


class TestServiceTemplatesAPI:
    """Tests for GET /api/service-templates endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_service_templates_returns_9_templates(self):
        """GET /api/service-templates should return exactly 9 active, client-visible templates"""
        response = requests.get(f"{BASE_URL}/api/service-templates", headers=self.headers)
        assert response.status_code == 200, f"Failed to get templates: {response.text}"
        
        templates = response.json()
        assert len(templates) == 9, f"Expected 9 templates, got {len(templates)}"
        
        # Verify all expected template names are present
        expected_names = [
            "Video Editing 60s Reels",
            "Story Editing",
            "Long Form Video Editing",
            "YouTube Long Form Editing 15 to 30 Minutes",
            "Thumbnail Design",
            "Social Media Graphics",
            "Content Writing",
            "Email Campaign Support",
            "Website Updates"
        ]
        actual_names = [t["name"] for t in templates]
        for name in expected_names:
            assert name in actual_names, f"Missing template: {name}"
    
    def test_video_editing_60s_has_correct_form_schema(self):
        """Video Editing 60s Reels should have correct tailored form fields"""
        response = requests.get(f"{BASE_URL}/api/service-templates", headers=self.headers)
        assert response.status_code == 200
        
        templates = response.json()
        video_60s = next((t for t in templates if t["id"] == "video-editing-60s"), None)
        assert video_60s is not None, "video-editing-60s template not found"
        
        # Verify form_schema contains expected fields
        schema = video_60s.get("form_schema", [])
        field_names = [f["field"] for f in schema]
        
        expected_fields = [
            "footage_links",
            "platform",
            "goal",
            "reference_links",
            "captions",
            "hook_script",
            "priority",
            "deadline",
            "special_notes"
        ]
        
        for expected in expected_fields:
            assert expected in field_names, f"Missing field '{expected}' in Video Editing 60s schema"
        
        # Verify required fields
        required_fields = video_60s.get("required_fields", [])
        assert "footage_links" in required_fields
        assert "platform" in required_fields
        assert "goal" in required_fields
        assert "captions" in required_fields
        assert "priority" in required_fields
    
    def test_youtube_long_form_has_different_form_schema(self):
        """YouTube Long Form Editing should have DIFFERENT tailored form fields than Video Editing 60s"""
        response = requests.get(f"{BASE_URL}/api/service-templates", headers=self.headers)
        assert response.status_code == 200
        
        templates = response.json()
        youtube = next((t for t in templates if t["id"] == "youtube-long-form"), None)
        assert youtube is not None, "youtube-long-form template not found"
        
        schema = youtube.get("form_schema", [])
        field_names = [f["field"] for f in schema]
        
        # YouTube-specific fields
        expected_youtube_fields = [
            "footage_links",
            "video_length_target",
            "youtube_title_topic",
            "audience_goal",
            "cta_offer",
            "reference_links",
            "chapter_markers",
            "captions",
            "thumbnail_needed",
            "priority",
            "deadline",
            "special_notes"
        ]
        
        for expected in expected_youtube_fields:
            assert expected in field_names, f"Missing field '{expected}' in YouTube Long Form schema"
        
        # Verify YouTube-specific required fields
        required_fields = youtube.get("required_fields", [])
        assert "video_length_target" in required_fields
        assert "youtube_title_topic" in required_fields
        assert "audience_goal" in required_fields
        assert "chapter_markers" in required_fields
        assert "thumbnail_needed" in required_fields
    
    def test_templates_have_hidden_category_l1(self):
        """All templates should have hidden_category_l1 for auto-resolution"""
        response = requests.get(f"{BASE_URL}/api/service-templates", headers=self.headers)
        assert response.status_code == 200
        
        templates = response.json()
        for template in templates:
            assert "hidden_category_l1" in template, f"Template {template['name']} missing hidden_category_l1"
            assert template["hidden_category_l1"] is not None, f"Template {template['name']} has null hidden_category_l1"
    
    def test_single_template_by_id(self):
        """GET /api/service-templates/{id} should return specific template"""
        response = requests.get(f"{BASE_URL}/api/service-templates/video-editing-60s", headers=self.headers)
        assert response.status_code == 200, f"Failed to get template by ID: {response.text}"
        
        template = response.json()
        assert template["id"] == "video-editing-60s"
        assert template["name"] == "Video Editing 60s Reels"
        assert "form_schema" in template


class TestOrderCreationWithServiceTemplate:
    """Tests for POST /api/orders with service_template_id"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_order_with_service_template_id(self):
        """POST /api/orders with service_template_id should create order with service_fields"""
        unique_id = str(uuid.uuid4())[:8]
        
        order_data = {
            "title": f"TEST_ServiceTemplate_{unique_id}",
            "description": "Test video editing request via service template",
            "priority": "Normal",
            "service_template_id": "video-editing-60s",
            "service_name": "Video Editing 60s Reels",
            "service_fields": {
                "footage_links": "https://drive.google.com/test-footage",
                "platform": "Instagram Reels",
                "goal": "Drive engagement for product launch",
                "captions": "Yes",
                "priority": "Normal"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        
        order = response.json()
        
        # Verify service template fields are stored
        assert order["service_template_id"] == "video-editing-60s"
        assert order["service_name"] == "Video Editing 60s Reels"
        assert order["service_fields"] is not None
        assert order["service_fields"]["platform"] == "Instagram Reels"
        assert order["service_fields"]["footage_links"] == "https://drive.google.com/test-footage"
        
        # Store order ID for cleanup
        self.created_order_id = order["id"]
    
    def test_order_auto_resolves_hidden_category_l1(self):
        """POST /api/orders with service_template_id should auto-resolve hidden category L1"""
        unique_id = str(uuid.uuid4())[:8]
        
        order_data = {
            "title": f"TEST_CategoryResolve_{unique_id}",
            "description": "Test hidden category resolution",
            "priority": "Normal",
            "service_template_id": "video-editing-60s",
            "service_name": "Video Editing 60s Reels",
            "service_fields": {
                "footage_links": "https://drive.google.com/test",
                "platform": "TikTok",
                "goal": "Engagement",
                "captions": "Yes",
                "priority": "Normal"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        
        order = response.json()
        
        # Verify hidden category L1 was auto-resolved from template
        # Video Editing 60s has hidden_category_l1 = "Video Production"
        assert order["category_l1_name"] == "Video Production", f"Expected 'Video Production', got '{order.get('category_l1_name')}'"
    
    def test_youtube_order_has_youtube_specific_fields(self):
        """Order created with YouTube template should store YouTube-specific service_fields"""
        unique_id = str(uuid.uuid4())[:8]
        
        order_data = {
            "title": f"TEST_YouTubeOrder_{unique_id}",
            "description": "YouTube Long Form request test",
            "priority": "High",
            "service_template_id": "youtube-long-form",
            "service_name": "YouTube Long Form Editing 15 to 30 Minutes",
            "service_fields": {
                "footage_links": "https://drive.google.com/youtube-footage",
                "video_length_target": "20-25 minutes",
                "youtube_title_topic": "How to Build an MVP in 30 Days",
                "audience_goal": "Developers learning startup skills",
                "chapter_markers": "Yes",
                "captions": "Yes",
                "thumbnail_needed": "Yes",
                "priority": "High"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        
        order = response.json()
        
        # Verify YouTube-specific fields stored
        assert order["service_template_id"] == "youtube-long-form"
        assert order["service_fields"]["video_length_target"] == "20-25 minutes"
        assert order["service_fields"]["youtube_title_topic"] == "How to Build an MVP in 30 Days"
        assert order["service_fields"]["thumbnail_needed"] == "Yes"
        assert order["service_fields"]["chapter_markers"] == "Yes"
    
    def test_order_without_service_template_works(self):
        """Orders can still be created without service_template_id (legacy flow)"""
        unique_id = str(uuid.uuid4())[:8]
        
        order_data = {
            "title": f"TEST_LegacyOrder_{unique_id}",
            "description": "Legacy order without service template",
            "priority": "Normal"
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create legacy order: {response.text}"
        
        order = response.json()
        assert order["service_template_id"] is None
        assert order["service_fields"] is None


class TestServiceTemplateIntegrity:
    """Tests for service template data integrity"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_all_templates_have_form_schema(self):
        """All 9 templates should have non-empty form_schema"""
        response = requests.get(f"{BASE_URL}/api/service-templates", headers=self.headers)
        assert response.status_code == 200
        
        templates = response.json()
        for template in templates:
            schema = template.get("form_schema", [])
            assert len(schema) > 0, f"Template {template['name']} has empty form_schema"
    
    def test_templates_sorted_by_sort_order(self):
        """Templates should be returned sorted by sort_order"""
        response = requests.get(f"{BASE_URL}/api/service-templates", headers=self.headers)
        assert response.status_code == 200
        
        templates = response.json()
        sort_orders = [t.get("sort_order", 999) for t in templates]
        assert sort_orders == sorted(sort_orders), "Templates not sorted by sort_order"
    
    def test_all_templates_are_client_visible(self):
        """GET /api/service-templates should only return client_visible=True templates"""
        response = requests.get(f"{BASE_URL}/api/service-templates", headers=self.headers)
        assert response.status_code == 200
        
        templates = response.json()
        for template in templates:
            assert template.get("client_visible") == True, f"Template {template['name']} should be client_visible"
    
    def test_all_templates_are_active(self):
        """GET /api/service-templates should only return active=True templates"""
        response = requests.get(f"{BASE_URL}/api/service-templates", headers=self.headers)
        assert response.status_code == 200
        
        templates = response.json()
        for template in templates:
            assert template.get("active") == True, f"Template {template['name']} should be active"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
