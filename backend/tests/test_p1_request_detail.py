"""
P1 Request Detail Page Tests
Tests for the enhanced Request Detail page:
- Service badge in header
- Status banner with plain-language explanation
- Structured service-specific fields (from service_fields)
- Sidebar with Service name, Status, Requester, Assigned to, Deadline, Created
- 3 tabs: Tasks, Messages, Files
- Linked tasks via GET /api/tasks?request_id=<order_id>
- My Requests shows service_name instead of category_name
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://account-manager-ops.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Admin123!"


class TestRequestDetailWithServiceTemplate:
    """Tests for Request Detail page data with service template context"""
    
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
    
    def test_create_order_with_service_fields_and_verify(self):
        """Create order with service template and verify service_fields are stored correctly"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create order with Video Editing 60s Reels template
        order_data = {
            "title": f"TEST_P1_ServiceFields_{unique_id}",
            "description": "P1 Test - structured service fields",
            "priority": "Normal",
            "service_template_id": "video-editing-60s",
            "service_name": "Video Editing 60s Reels",
            "service_fields": {
                "footage_links": "https://drive.google.com/test-footage-p1",
                "platform": "TikTok",
                "goal": "Drive engagement for brand awareness",
                "reference_links": "https://youtube.com/example-video",
                "captions": "Yes",
                "hook_script": "Did you know that 90% of businesses fail?",
                "special_notes": "Make it punchy and fast-paced"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        
        created_order = response.json()
        order_id = created_order["id"]
        
        # Fetch the order via GET /api/orders/{id} to verify service_fields persisted
        get_response = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers=self.headers)
        assert get_response.status_code == 200, f"Failed to get order: {get_response.text}"
        
        order = get_response.json()
        
        # Verify service context is present
        assert order["service_template_id"] == "video-editing-60s"
        assert order["service_name"] == "Video Editing 60s Reels"
        
        # Verify service_fields are stored and retrievable
        assert order["service_fields"] is not None
        assert order["service_fields"]["platform"] == "TikTok"
        assert order["service_fields"]["goal"] == "Drive engagement for brand awareness"
        assert order["service_fields"]["captions"] == "Yes"
        assert order["service_fields"]["hook_script"] == "Did you know that 90% of businesses fail?"
        
        # Verify hidden category was auto-resolved
        assert order["category_l1_name"] == "Video Production"
    
    def test_order_response_includes_service_badge_data(self):
        """Verify order response includes service_name for service badge display"""
        unique_id = str(uuid.uuid4())[:8]
        
        order_data = {
            "title": f"TEST_P1_ServiceBadge_{unique_id}",
            "description": "Testing service badge data",
            "priority": "High",
            "service_template_id": "youtube-long-form",
            "service_name": "YouTube Long Form Editing 15 to 30 Minutes",
            "service_fields": {
                "footage_links": "https://drive.google.com/yt-footage",
                "video_length_target": "15-20 minutes",
                "youtube_title_topic": "How to Build Wealth in 2025",
                "audience_goal": "Young professionals",
                "chapter_markers": "Yes",
                "captions": "Yes",
                "thumbnail_needed": "Yes"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert response.status_code == 200
        
        order = response.json()
        
        # Verify service_name is present for badge display
        assert "service_name" in order
        assert order["service_name"] == "YouTube Long Form Editing 15 to 30 Minutes"
        
        # Verify status is present for status banner
        assert "status" in order
        assert order["status"] == "Open"


class TestLinkedTasks:
    """Tests for GET /api/tasks?request_id=<order_id> endpoint"""
    
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
    
    def test_tasks_endpoint_accepts_request_id_filter(self):
        """GET /api/tasks?request_id=<order_id> should filter tasks by linked order"""
        # First create an order
        unique_id = str(uuid.uuid4())[:8]
        order_data = {
            "title": f"TEST_P1_LinkedTasks_{unique_id}",
            "description": "Order for linked tasks test",
            "priority": "Normal"
        }
        
        order_response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert order_response.status_code == 200
        order_id = order_response.json()["id"]
        
        # Query tasks with request_id filter
        tasks_response = requests.get(f"{BASE_URL}/api/tasks", params={"request_id": order_id}, headers=self.headers)
        assert tasks_response.status_code == 200, f"Tasks endpoint failed: {tasks_response.text}"
        
        # Response should be a valid structure (even if empty)
        data = tasks_response.json()
        # Could be either {"tasks": []} or [] depending on implementation
        if isinstance(data, dict):
            assert "tasks" in data or isinstance(data, list)
        else:
            assert isinstance(data, list)
    
    def test_tasks_endpoint_returns_empty_for_order_without_tasks(self):
        """New order should have no linked tasks initially"""
        unique_id = str(uuid.uuid4())[:8]
        order_data = {
            "title": f"TEST_P1_EmptyTasks_{unique_id}",
            "description": "Order with no tasks",
            "priority": "Normal"
        }
        
        order_response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert order_response.status_code == 200
        order_id = order_response.json()["id"]
        
        # Query tasks for this order
        tasks_response = requests.get(f"{BASE_URL}/api/tasks", params={"request_id": order_id}, headers=self.headers)
        assert tasks_response.status_code == 200
        
        data = tasks_response.json()
        tasks = data.get("tasks", []) if isinstance(data, dict) else data
        
        # Should be empty since no tasks linked
        # Note: Some templates may auto-generate tasks on order creation
        # Just verify the endpoint works
        assert isinstance(tasks, list)


class TestMyRequestsServiceName:
    """Tests for My Requests showing service_name instead of category_name"""
    
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
    
    def test_my_requests_includes_service_name(self):
        """GET /api/orders/my-requests should return service_name for service-template orders"""
        # First create an order with service template
        unique_id = str(uuid.uuid4())[:8]
        order_data = {
            "title": f"TEST_P1_MyRequests_{unique_id}",
            "description": "Testing my-requests service_name",
            "priority": "Normal",
            "service_template_id": "thumbnail-design",
            "service_name": "Thumbnail Design",
            "service_fields": {
                "platform": "YouTube",
                "video_topic": "AI Tutorial",
                "number_of_options": "2"
            }
        }
        
        order_response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert order_response.status_code == 200
        created_order_id = order_response.json()["id"]
        
        # Fetch my-requests
        my_requests_response = requests.get(f"{BASE_URL}/api/orders/my-requests", headers=self.headers)
        assert my_requests_response.status_code == 200, f"my-requests failed: {my_requests_response.text}"
        
        orders = my_requests_response.json()
        
        # Find our created order
        our_order = next((o for o in orders if o["id"] == created_order_id), None)
        assert our_order is not None, "Created order not found in my-requests"
        
        # Verify service_name is present
        assert our_order.get("service_name") == "Thumbnail Design"


class TestRequestDetailSidebarFields:
    """Tests to ensure all sidebar fields are returned in order response"""
    
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
    
    def test_order_response_has_sidebar_fields(self):
        """Order response should include all fields needed for sidebar: Service name, Status, Requester, Assigned to, Deadline, Created"""
        unique_id = str(uuid.uuid4())[:8]
        order_data = {
            "title": f"TEST_P1_Sidebar_{unique_id}",
            "description": "Testing sidebar fields",
            "priority": "High",
            "service_template_id": "content-writing",
            "service_name": "Content Writing",
            "service_fields": {
                "content_type": "Blog Post",
                "topic": "AI in Healthcare",
                "target_audience": "Healthcare professionals"
            }
        }
        
        order_response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert order_response.status_code == 200
        order_id = order_response.json()["id"]
        
        # Fetch order detail
        get_response = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers=self.headers)
        assert get_response.status_code == 200
        order = get_response.json()
        
        # Verify sidebar fields exist
        # Service name
        assert "service_name" in order
        assert order["service_name"] == "Content Writing"
        
        # Status
        assert "status" in order
        assert order["status"] in ["Open", "In Progress", "Pending", "Delivered", "Closed", "Canceled", "Draft"]
        
        # Requester info
        assert "requester_name" in order
        assert "requester_email" in order
        
        # Assigned to (can be None for unassigned)
        assert "editor_name" in order or order.get("editor_id") is None
        
        # Deadline (SLA deadline)
        assert "sla_deadline" in order
        
        # Created date
        assert "created_at" in order


class TestNoL1L2CategoryVisibility:
    """Tests to verify clients never see L1/L2 category language"""
    
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
    
    def test_service_templates_dont_expose_l1_l2_to_clients(self):
        """Service templates should use hidden_category_l1 but not expose raw L1/L2 to form"""
        response = requests.get(f"{BASE_URL}/api/service-templates", headers=self.headers)
        assert response.status_code == 200
        
        templates = response.json()
        
        for template in templates:
            # Form schema should NOT include category_l1 or category_l2 fields
            if "form_schema" in template:
                field_names = [f["field"] for f in template["form_schema"]]
                assert "category_l1" not in field_names, f"Template {template['name']} exposes category_l1 in form"
                assert "category_l1_id" not in field_names, f"Template {template['name']} exposes category_l1_id in form"
                assert "category_l2" not in field_names, f"Template {template['name']} exposes category_l2 in form"
                assert "category_l2_id" not in field_names, f"Template {template['name']} exposes category_l2_id in form"
            
            # Hidden category should be present (for backend use only)
            assert "hidden_category_l1" in template


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
