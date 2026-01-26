"""
Test suite for refactored backend routes after modularization.
Tests the critical endpoints that were reported as broken:
- /api/categories/l1 and /api/categories/l2
- /api/dashboard/editor and /api/dashboard/requester
- /api/ratings/my-stats
- /api/notifications/unread-count
- /api/my-requests
- /api/teams and /api/teams/{id}/members
- /api/workflows
- /api/announcement-ticker
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """Test successful login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "Admin"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "wrong@example.com", "password": "wrongpass"}
        )
        assert response.status_code == 401


class TestCategoriesEndpoints:
    """Test categories L1 and L2 endpoints"""
    
    def test_get_categories_l1(self, auth_headers):
        """Test GET /api/categories/l1 - returns list of L1 categories"""
        response = requests.get(f"{BASE_URL}/api/categories/l1", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify structure of L1 category
        if len(data) > 0:
            category = data[0]
            assert "id" in category
            assert "name" in category
            assert "active" in category
    
    def test_get_categories_l2(self, auth_headers):
        """Test GET /api/categories/l2 - returns list of L2 categories"""
        response = requests.get(f"{BASE_URL}/api/categories/l2", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify structure of L2 category
        if len(data) > 0:
            category = data[0]
            assert "id" in category
            assert "name" in category
            assert "category_l1_id" in category


class TestDashboardEndpoints:
    """Test dashboard endpoints"""
    
    def test_get_dashboard_stats(self, auth_headers):
        """Test GET /api/dashboard/stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "open_count" in data
        assert "in_progress_count" in data
        assert "delivered_count" in data
    
    def test_get_dashboard_editor(self, auth_headers):
        """Test GET /api/dashboard/editor - Admin should get 403 (not an editor role)"""
        response = requests.get(f"{BASE_URL}/api/dashboard/editor", headers=auth_headers)
        # Admin role cannot pick orders, so should get 403
        assert response.status_code == 403
    
    def test_get_dashboard_requester(self, auth_headers):
        """Test GET /api/dashboard/requester - Admin should get 403 (not a requester role)"""
        response = requests.get(f"{BASE_URL}/api/dashboard/requester", headers=auth_headers)
        # Admin role is not Requester, so should get 403
        assert response.status_code == 403


class TestRatingsEndpoints:
    """Test ratings endpoints"""
    
    def test_get_my_stats(self, auth_headers):
        """Test GET /api/ratings/my-stats"""
        response = requests.get(f"{BASE_URL}/api/ratings/my-stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_ratings" in data
        assert "average_rating" in data
        assert "total_delivered" in data


class TestNotificationsEndpoints:
    """Test notifications endpoints"""
    
    def test_get_unread_count(self, auth_headers):
        """Test GET /api/notifications/unread-count"""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)
    
    def test_get_notifications(self, auth_headers):
        """Test GET /api/notifications"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestMyRequestsEndpoint:
    """Test my-requests endpoint"""
    
    def test_get_my_requests(self, auth_headers):
        """Test GET /api/my-requests"""
        response = requests.get(f"{BASE_URL}/api/my-requests", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify structure of request
        if len(data) > 0:
            request = data[0]
            assert "id" in request
            assert "code" in request
            assert "title" in request
            assert "status" in request


class TestTeamsEndpoints:
    """Test teams endpoints"""
    
    def test_get_teams(self, auth_headers):
        """Test GET /api/teams"""
        response = requests.get(f"{BASE_URL}/api/teams", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify structure of team
        if len(data) > 0:
            team = data[0]
            assert "id" in team
            assert "name" in team
            assert "member_count" in team
    
    def test_get_team_members(self, auth_headers):
        """Test GET /api/teams/{id}/members - returns object with team and members"""
        # First get teams
        teams_response = requests.get(f"{BASE_URL}/api/teams", headers=auth_headers)
        teams = teams_response.json()
        
        if len(teams) > 0:
            team_id = teams[0]["id"]
            response = requests.get(f"{BASE_URL}/api/teams/{team_id}/members", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            # API returns {team: {...}, members: [...]}
            assert "team" in data
            assert "members" in data
            assert isinstance(data["members"], list)


class TestWorkflowsEndpoints:
    """Test workflows endpoints"""
    
    def test_get_workflows(self, auth_headers):
        """Test GET /api/workflows"""
        response = requests.get(f"{BASE_URL}/api/workflows", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify structure of workflow
        if len(data) > 0:
            workflow = data[0]
            assert "id" in workflow
            assert "name" in workflow
            assert "nodes" in workflow
            assert "edges" in workflow


class TestAnnouncementEndpoints:
    """Test announcement endpoints"""
    
    def test_get_announcement_ticker(self, auth_headers):
        """Test GET /api/announcement-ticker"""
        response = requests.get(f"{BASE_URL}/api/announcement-ticker", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "is_active" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
