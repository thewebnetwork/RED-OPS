"""
Dashboard V2 API Tests - Role-based dashboard with metrics and analytics
Tests for P0 Dashboard Rebuild feature
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Admin123!"


class TestDashboardV2Auth:
    """Test authentication for Dashboard V2 endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # API returns 'token' not 'access_token'
        assert "token" in data, "No token in response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Get authenticated headers"""
        return {"Authorization": f"Bearer {admin_token}"}


class TestDashboardV2Metrics(TestDashboardV2Auth):
    """Test /api/dashboard/v2/metrics endpoint"""
    
    def test_metrics_endpoint_returns_200(self, auth_headers):
        """Test that metrics endpoint returns 200 for authenticated user"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/metrics", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_metrics_returns_admin_role_type(self, auth_headers):
        """Test that admin user gets role_type='admin'"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/metrics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["role_type"] == "admin", f"Expected role_type='admin', got '{data.get('role_type')}'"
    
    def test_metrics_contains_kpi_fields(self, auth_headers):
        """Test that metrics response contains all KPI fields"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/metrics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check KPI fields exist
        assert "kpi" in data, "Missing 'kpi' in response"
        kpi = data["kpi"]
        required_kpi_fields = ["open", "in_progress", "pending_review", "delivered", "closed"]
        for field in required_kpi_fields:
            assert field in kpi, f"Missing KPI field: {field}"
            assert isinstance(kpi[field], int), f"KPI field {field} should be int"
    
    def test_metrics_contains_sla_fields(self, auth_headers):
        """Test that metrics response contains SLA status fields"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/metrics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check SLA fields exist
        assert "sla" in data, "Missing 'sla' in response"
        sla = data["sla"]
        required_sla_fields = ["on_track", "at_risk", "breached"]
        for field in required_sla_fields:
            assert field in sla, f"Missing SLA field: {field}"
            assert isinstance(sla[field], int), f"SLA field {field} should be int"
    
    def test_metrics_contains_pool_fields_for_admin(self, auth_headers):
        """Test that admin gets pool metrics"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/metrics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Admin should see pool metrics
        assert data["can_see_pool1"] == True, "Admin should see pool1"
        assert data["can_see_pool2"] == True, "Admin should see pool2"
        assert "pool" in data, "Missing 'pool' in response for admin"
        
        pool = data["pool"]
        required_pool_fields = ["pool1_available", "pool2_available", "pool1_pickups_30d", "pool2_assignments_30d"]
        for field in required_pool_fields:
            assert field in pool, f"Missing pool field: {field}"
    
    def test_metrics_contains_workload_fields(self, auth_headers):
        """Test that metrics response contains workload fields"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/metrics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check workload fields exist
        assert "workload" in data, "Missing 'workload' in response"
        workload = data["workload"]
        required_workload_fields = ["tickets_working_on", "tickets_waiting_on_me", "tickets_pending_review", "recently_delivered_7d"]
        for field in required_workload_fields:
            assert field in workload, f"Missing workload field: {field}"
    
    def test_metrics_contains_trend_data(self, auth_headers):
        """Test that metrics response contains trend data"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/metrics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check trend data exists
        assert "trends_7d" in data, "Missing 'trends_7d' in response"
        assert "trends_30d" in data, "Missing 'trends_30d' in response"
    
    def test_metrics_admin_sees_global_stats(self, auth_headers):
        """Test that admin can see global stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/metrics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["can_see_global_stats"] == True, "Admin should see global stats"


class TestDashboardV2TicketLists(TestDashboardV2Auth):
    """Test ticket list endpoints"""
    
    def test_working_on_endpoint(self, auth_headers):
        """Test /api/dashboard/v2/tickets/working-on endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/tickets/working-on", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "tickets" in data, "Missing 'tickets' in response"
        assert isinstance(data["tickets"], list), "tickets should be a list"
    
    def test_waiting_on_me_endpoint(self, auth_headers):
        """Test /api/dashboard/v2/tickets/waiting-on-me endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/tickets/waiting-on-me", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "tickets" in data, "Missing 'tickets' in response"
        assert isinstance(data["tickets"], list), "tickets should be a list"
    
    def test_pending_review_endpoint(self, auth_headers):
        """Test /api/dashboard/v2/tickets/pending-review endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/tickets/pending-review", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "tickets" in data, "Missing 'tickets' in response"
        assert isinstance(data["tickets"], list), "tickets should be a list"
    
    def test_recently_delivered_endpoint(self, auth_headers):
        """Test /api/dashboard/v2/tickets/recently-delivered endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/tickets/recently-delivered", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "tickets" in data, "Missing 'tickets' in response"
        assert isinstance(data["tickets"], list), "tickets should be a list"
    
    def test_recently_delivered_with_days_param(self, auth_headers):
        """Test recently-delivered endpoint with days parameter"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/tickets/recently-delivered?days=14", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_working_on_with_limit_param(self, auth_headers):
        """Test working-on endpoint with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/tickets/working-on?limit=5", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"


class TestDashboardV2Charts(TestDashboardV2Auth):
    """Test chart data endpoints"""
    
    def test_ticket_volume_by_status_endpoint(self, auth_headers):
        """Test /api/dashboard/v2/charts/ticket-volume-by-status endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/charts/ticket-volume-by-status", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "data" in data, "Missing 'data' in response"
        assert isinstance(data["data"], list), "data should be a list"
    
    def test_ticket_volume_by_status_with_days_param(self, auth_headers):
        """Test ticket-volume-by-status with days parameter"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/charts/ticket-volume-by-status?days=7", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Should have 7 data points
        assert len(data["data"]) == 7, f"Expected 7 data points, got {len(data['data'])}"
    
    def test_ticket_volume_by_category_endpoint(self, auth_headers):
        """Test /api/dashboard/v2/charts/ticket-volume-by-category endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/charts/ticket-volume-by-category", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "data" in data, "Missing 'data' in response"
        assert isinstance(data["data"], list), "data should be a list"
    
    def test_pool_routing_endpoint_for_admin(self, auth_headers):
        """Test /api/dashboard/v2/charts/pool-routing endpoint for admin"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/charts/pool-routing", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "data" in data, "Missing 'data' in response"
        
        # Admin should get pool routing data
        pool_data = data["data"]
        assert "pool1" in pool_data, "Missing pool1 in pool routing data"
        assert "pool2" in pool_data, "Missing pool2 in pool routing data"


class TestDashboardV2Unauthorized:
    """Test unauthorized access to Dashboard V2 endpoints"""
    
    def test_metrics_requires_auth(self):
        """Test that metrics endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/metrics")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_working_on_requires_auth(self):
        """Test that working-on endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/tickets/working-on")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_charts_require_auth(self):
        """Test that chart endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/charts/ticket-volume-by-status")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestDashboardV2DataIntegrity:
    """Test data integrity and response structure"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Get authenticated headers"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_kpi_values_are_non_negative(self, auth_headers):
        """Test that all KPI values are non-negative"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/metrics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        kpi = data["kpi"]
        for field, value in kpi.items():
            assert value >= 0, f"KPI field {field} has negative value: {value}"
    
    def test_sla_values_are_non_negative(self, auth_headers):
        """Test that all SLA values are non-negative"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/metrics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        sla = data["sla"]
        for field, value in sla.items():
            assert value >= 0, f"SLA field {field} has negative value: {value}"
    
    def test_chart_data_has_correct_structure(self, auth_headers):
        """Test that chart data has correct structure"""
        response = requests.get(f"{BASE_URL}/api/dashboard/v2/charts/ticket-volume-by-status?days=7", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        for item in data["data"]:
            assert "date" in item, "Missing 'date' in chart data item"
            # Check for status fields
            assert "open" in item or "in_progress" in item, "Missing status fields in chart data"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
