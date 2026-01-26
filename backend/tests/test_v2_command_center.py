"""
V2 Command Center Backend API Tests
Tests for: Categories L1/L2, Feature Requests, Bug Reports, My Requests, Profile
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ticketflow-129.preview.emergentagent.com').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "Admin"
        return data["token"]
    
    def test_admin_login(self, admin_token):
        """Test admin login returns valid token"""
        assert admin_token is not None
        assert len(admin_token) > 0
    
    def test_get_me(self, admin_token):
        """Test /auth/me endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@redribbonops.com"
        assert data["role"] == "Admin"


class TestCategoriesL1:
    """Category Level 1 CRUD tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_list_categories_l1(self, admin_token):
        """Test listing L1 categories - should have seeded categories"""
        response = requests.get(
            f"{BASE_URL}/api/categories/l1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 3, "Should have at least 3 seeded L1 categories"
        
        # Verify seeded categories exist
        names = [c["name"] for c in data]
        assert "Media Services" in names, "Media Services category should exist"
        assert "Feature Requests" in names, "Feature Requests category should exist"
        assert "Bug Reports / Incidents" in names, "Bug Reports category should exist"
    
    def test_create_category_l1(self, admin_token):
        """Test creating a new L1 category"""
        response = requests.post(
            f"{BASE_URL}/api/categories/l1",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "TEST_New Category",
                "description": "Test category description",
                "icon": "file"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_New Category"
        assert data["description"] == "Test category description"
        assert data["active"] == True
        assert "id" in data
        
        # Verify it appears in list
        list_response = requests.get(
            f"{BASE_URL}/api/categories/l1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        names = [c["name"] for c in list_response.json()]
        assert "TEST_New Category" in names


class TestCategoriesL2:
    """Category Level 2 CRUD tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def media_services_id(self, admin_token):
        """Get Media Services L1 category ID"""
        response = requests.get(
            f"{BASE_URL}/api/categories/l1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        for cat in response.json():
            if cat["name"] == "Media Services":
                return cat["id"]
        pytest.fail("Media Services category not found")
    
    def test_list_categories_l2(self, admin_token, media_services_id):
        """Test listing L2 categories for Media Services"""
        response = requests.get(
            f"{BASE_URL}/api/categories/l2?category_l1_id={media_services_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify Editing Services exists with editor workflow
        editing_services = next((c for c in data if c["name"] == "Editing Services"), None)
        assert editing_services is not None, "Editing Services subcategory should exist"
        assert editing_services["triggers_editor_workflow"] == True
    
    def test_create_category_l2(self, admin_token, media_services_id):
        """Test creating a new L2 subcategory"""
        response = requests.post(
            f"{BASE_URL}/api/categories/l2",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "TEST_New Subcategory",
                "category_l1_id": media_services_id,
                "description": "Test subcategory",
                "triggers_editor_workflow": True
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_New Subcategory"
        assert data["triggers_editor_workflow"] == True
        assert data["category_l1_id"] == media_services_id


class TestFeatureRequests:
    """Feature Request CRUD tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def feature_category_ids(self, admin_token):
        """Get Feature Requests L1 and L2 category IDs"""
        l1_response = requests.get(
            f"{BASE_URL}/api/categories/l1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        l1_id = None
        for cat in l1_response.json():
            if cat["name"] == "Feature Requests":
                l1_id = cat["id"]
                break
        
        l2_response = requests.get(
            f"{BASE_URL}/api/categories/l2?category_l1_id={l1_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        l2_id = l2_response.json()[0]["id"] if l2_response.json() else None
        
        return {"l1_id": l1_id, "l2_id": l2_id}
    
    def test_create_feature_request(self, admin_token, feature_category_ids):
        """Test creating a feature request"""
        response = requests.post(
            f"{BASE_URL}/api/feature-requests",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "TEST_New Feature Request",
                "category_l1_id": feature_category_ids["l1_id"],
                "category_l2_id": feature_category_ids["l2_id"],
                "description": "This is a test feature request",
                "why_important": "Testing purposes",
                "who_is_for": "Test users",
                "reference_links": "https://example.com",
                "priority": "Normal"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "TEST_New Feature Request"
        assert data["request_type"] == "Feature"
        assert data["status"] == "Open"
        assert "request_code" in data
        assert data["request_code"].startswith("FR-")
        return data["id"]
    
    def test_list_feature_requests(self, admin_token):
        """Test listing feature requests"""
        response = requests.get(
            f"{BASE_URL}/api/feature-requests",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestBugReports:
    """Bug Report CRUD tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def bug_category_ids(self, admin_token):
        """Get Bug Reports L1 and L2 category IDs"""
        l1_response = requests.get(
            f"{BASE_URL}/api/categories/l1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        l1_id = None
        for cat in l1_response.json():
            if "Bug" in cat["name"]:
                l1_id = cat["id"]
                break
        
        l2_response = requests.get(
            f"{BASE_URL}/api/categories/l2?category_l1_id={l1_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        l2_id = l2_response.json()[0]["id"] if l2_response.json() else None
        
        return {"l1_id": l1_id, "l2_id": l2_id}
    
    def test_create_bug_report(self, admin_token, bug_category_ids):
        """Test creating a bug report"""
        response = requests.post(
            f"{BASE_URL}/api/bug-reports",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "TEST_Bug Report",
                "category_l1_id": bug_category_ids["l1_id"],
                "category_l2_id": bug_category_ids["l2_id"],
                "bug_type": "UI Bug",
                "steps_to_reproduce": "1. Go to page\n2. Click button\n3. See error",
                "expected_behavior": "Button should work",
                "actual_behavior": "Button does nothing",
                "browser": "Chrome",
                "device": "Desktop",
                "url_page": "https://example.com/page",
                "severity": "High"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "TEST_Bug Report"
        assert data["request_type"] == "Bug"
        assert data["status"] == "Open"
        assert data["severity"] == "High"
        assert "report_code" in data
        assert data["report_code"].startswith("BUG-")
    
    def test_list_bug_reports(self, admin_token):
        """Test listing bug reports"""
        response = requests.get(
            f"{BASE_URL}/api/bug-reports",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestMyRequests:
    """My Requests unified endpoint tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_get_my_requests(self, admin_token):
        """Test getting unified my-requests list"""
        response = requests.get(
            f"{BASE_URL}/api/my-requests",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify structure of items
        if len(data) > 0:
            item = data[0]
            assert "id" in item
            assert "code" in item
            assert "request_type" in item
            assert "title" in item
            assert "status" in item
            assert "priority_or_severity" in item


class TestProfile:
    """Profile management tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_update_profile(self, admin_token):
        """Test updating profile name"""
        # First get current profile
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        original_name = me_response.json()["name"]
        
        # Update name
        response = requests.patch(
            f"{BASE_URL}/api/auth/profile",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"name": "Admin Updated"}
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Admin Updated"
        
        # Restore original name
        requests.patch(
            f"{BASE_URL}/api/auth/profile",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"name": original_name}
        )
    
    def test_change_password_wrong_current(self, admin_token):
        """Test password change with wrong current password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword123"
            }
        )
        assert response.status_code == 400
        assert "incorrect" in response.json()["detail"].lower()


class TestDashboard:
    """Dashboard stats tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_dashboard_stats(self, admin_token):
        """Test dashboard stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected fields
        assert "open_count" in data
        assert "in_progress_count" in data
        assert "pending_count" in data
        assert "delivered_count" in data
        assert "sla_breaching_count" in data
        assert "feature_requests_count" in data
        assert "bug_reports_count" in data


class TestEditingOrders:
    """Editing order workflow tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def editing_category_ids(self, admin_token):
        """Get Editing Services category IDs"""
        l1_response = requests.get(
            f"{BASE_URL}/api/categories/l1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        l1_id = None
        for cat in l1_response.json():
            if cat["name"] == "Media Services":
                l1_id = cat["id"]
                break
        
        l2_response = requests.get(
            f"{BASE_URL}/api/categories/l2?category_l1_id={l1_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        l2_id = None
        for cat in l2_response.json():
            if cat["name"] == "Editing Services":
                l2_id = cat["id"]
                break
        
        return {"l1_id": l1_id, "l2_id": l2_id}
    
    def test_create_editing_order(self, admin_token, editing_category_ids):
        """Test creating an editing order through Command Center"""
        response = requests.post(
            f"{BASE_URL}/api/orders",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "TEST_Editing Order",
                "category_l1_id": editing_category_ids["l1_id"],
                "category_l2_id": editing_category_ids["l2_id"],
                "priority": "High",
                "description": "Test editing order description",
                "video_script": "Test script content",
                "reference_links": "https://example.com/ref",
                "footage_links": "https://drive.google.com/footage",
                "music_preference": "Upbeat",
                "delivery_format": "1080p MP4",
                "special_instructions": "Test instructions"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "TEST_Editing Order"
        assert data["request_type"] == "Editing"
        assert data["status"] == "Open"
        assert data["priority"] == "High"
        assert "order_code" in data
        assert data["order_code"].startswith("RRG-")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
