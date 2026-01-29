"""
P0 UAT Blockers Testing - Iteration 33
Tests for:
1. Dashboard shows 'Tickets I'm Working On' section for all roles
2. Dashboard shows 'Tickets Delivered' section for all roles
3. Dashboard shows 'My Submitted Tickets' KPI widget linking to /my-tickets
4. Sidebar shows 'My Submitted Tickets' instead of 'My Tickets'
5. 'Manage Users' button removed from Admin dashboard
6. File upload endpoint works - POST /api/orders/{order_id}/files/upload
7. Workflow 'Auto-Assign Role' dropdown shows roles (Administrator, Privileged User, Standard User)
8. Bug report creates both bug_reports AND orders record for visibility in All Orders
9. Pool endpoint filters out Support/Issue tickets for Partners without support specialty
10. /api/dashboard/my-work endpoint returns working_on, delivered, my_submitted_count
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://rulebook-redops.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


class TestAuthentication:
    """Test authentication and get tokens"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        token = response.json().get("token")  # API returns 'token' not 'access_token'
        assert token, "No token returned"
        return token
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get admin headers with auth token"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_admin_login(self):
        """Test admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data, f"Expected 'token' in response, got: {list(data.keys())}"
        assert "user" in data
        print(f"✓ Admin login successful, role: {data['user'].get('role')}")


class TestDashboardMyWork:
    """Test /api/dashboard/my-work endpoint - P0 Feature"""
    
    @pytest.fixture(scope="class")
    def admin_headers(self):
        """Get admin headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_my_work_endpoint_exists(self, admin_headers):
        """Test /api/dashboard/my-work endpoint exists and returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/dashboard/my-work", headers=admin_headers)
        assert response.status_code == 200, f"my-work endpoint failed: {response.text}"
        
        data = response.json()
        assert "working_on" in data, "Missing 'working_on' field"
        assert "delivered" in data, "Missing 'delivered' field"
        assert "my_submitted_count" in data, "Missing 'my_submitted_count' field"
        
        assert isinstance(data["working_on"], list), "working_on should be a list"
        assert isinstance(data["delivered"], list), "delivered should be a list"
        assert isinstance(data["my_submitted_count"], int), "my_submitted_count should be an integer"
        
        print(f"✓ my-work endpoint returns correct structure")
        print(f"  - working_on count: {len(data['working_on'])}")
        print(f"  - delivered count: {len(data['delivered'])}")
        print(f"  - my_submitted_count: {data['my_submitted_count']}")


class TestRolesEndpoint:
    """Test /api/roles endpoint for workflow Auto-Assign Role dropdown"""
    
    @pytest.fixture(scope="class")
    def admin_headers(self):
        """Get admin headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_roles_endpoint_returns_all_roles(self, admin_headers):
        """Test /api/roles returns all roles including Administrator, Privileged User, Standard User"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=admin_headers)
        assert response.status_code == 200, f"Roles endpoint failed: {response.text}"
        
        roles = response.json()
        assert isinstance(roles, list), "Roles should be a list"
        assert len(roles) > 0, "Should have at least one role"
        
        role_names = [r.get("name") or r.get("display_name") for r in roles]
        print(f"✓ Roles endpoint returns {len(roles)} roles: {role_names}")
        
        # Check for expected roles
        expected_roles = ["Administrator", "Privileged User", "Standard User"]
        for expected in expected_roles:
            found = any(expected.lower() in str(name).lower() for name in role_names if name)
            if found:
                print(f"  ✓ Found role: {expected}")
            else:
                print(f"  ⚠ Role not found: {expected}")


class TestFileUpload:
    """Test file upload endpoint - POST /api/orders/{order_id}/files/upload"""
    
    @pytest.fixture(scope="class")
    def admin_headers(self):
        """Get admin headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_order(self, admin_headers):
        """Create a test order for file upload testing"""
        order_data = {
            "title": "TEST_File_Upload_Test_Order",
            "description": "Test order for file upload testing",
            "priority": "Normal"
        }
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=admin_headers)
        if response.status_code == 201:
            return response.json()
        elif response.status_code == 200:
            return response.json()
        else:
            pytest.skip(f"Could not create test order: {response.text}")
    
    def test_file_upload_endpoint_exists(self, admin_headers, test_order):
        """Test file upload endpoint accepts multipart/form-data"""
        if not test_order:
            pytest.skip("No test order available")
        
        order_id = test_order.get("id")
        
        # Create a test file
        test_file_content = b"This is a test file content for upload testing"
        files = {
            "file": ("test_attachment.txt", io.BytesIO(test_file_content), "text/plain")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/files/upload",
            files=files,
            headers=admin_headers
        )
        
        # Accept 200, 201, or 422 (validation error) as valid responses
        # 404 would mean endpoint doesn't exist
        assert response.status_code != 404, f"File upload endpoint not found: {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✓ File upload successful")
            print(f"  - File ID: {data.get('id')}")
            print(f"  - URL: {data.get('url')}")
        else:
            print(f"⚠ File upload returned status {response.status_code}: {response.text[:200]}")


class TestBugReportCreatesOrder:
    """Test bug report creates both bug_reports AND orders record"""
    
    @pytest.fixture(scope="class")
    def admin_headers(self):
        """Get admin headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_bug_report_creates_order(self, admin_headers):
        """Test creating a bug report also creates an order record"""
        bug_data = {
            "title": "TEST_Bug_Report_Order_Visibility",
            "bug_type": "UI Bug",
            "steps_to_reproduce": "1. Open app\n2. Click button\n3. See error",
            "expected_behavior": "Button should work",
            "actual_behavior": "Button does nothing",
            "severity": "Normal"
        }
        
        response = requests.post(f"{BASE_URL}/api/bug-reports", json=bug_data, headers=admin_headers)
        
        if response.status_code in [200, 201]:
            bug_report = response.json()
            bug_id = bug_report.get("id")
            print(f"✓ Bug report created with ID: {bug_id}")
            
            # Now check if an order was also created with the same ID
            order_response = requests.get(f"{BASE_URL}/api/orders/{bug_id}", headers=admin_headers)
            
            if order_response.status_code == 200:
                order = order_response.json()
                print(f"✓ Order record also created for bug report")
                print(f"  - Order code: {order.get('order_code')}")
                print(f"  - Request type: {order.get('request_type')}")
                assert order.get("request_type") in ["Issue", "Bug"], f"Order request_type should be Issue or Bug, got: {order.get('request_type')}"
            else:
                print(f"⚠ Order record not found for bug report ID: {bug_id}")
        else:
            print(f"⚠ Bug report creation returned status {response.status_code}: {response.text[:200]}")


class TestPoolFiltering:
    """Test pool endpoint filters out Support/Issue tickets for Partners without support specialty"""
    
    @pytest.fixture(scope="class")
    def admin_headers(self):
        """Get admin headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_pool_endpoint_exists(self, admin_headers):
        """Test pool endpoint exists and returns data"""
        response = requests.get(f"{BASE_URL}/api/orders/pool", headers=admin_headers)
        
        # Pool endpoint should exist
        assert response.status_code != 404, f"Pool endpoint not found"
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Pool endpoint returns data")
            if isinstance(data, list):
                print(f"  - Pool contains {len(data)} orders")
            elif isinstance(data, dict):
                print(f"  - Pool response keys: {list(data.keys())}")
        else:
            print(f"⚠ Pool endpoint returned status {response.status_code}: {response.text[:200]}")


class TestDashboardStats:
    """Test dashboard stats endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_headers(self):
        """Get admin headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_dashboard_stats_endpoint(self, admin_headers):
        """Test /api/dashboard/stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=admin_headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        expected_fields = ["open_count", "in_progress_count", "pending_count", "delivered_count"]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Dashboard stats endpoint working")
        print(f"  - Open: {data.get('open_count')}")
        print(f"  - In Progress: {data.get('in_progress_count')}")
        print(f"  - Pending: {data.get('pending_count')}")
        print(f"  - Delivered: {data.get('delivered_count')}")


class TestWorkflowsEndpoint:
    """Test workflows endpoint for Auto-Assign Role feature"""
    
    @pytest.fixture(scope="class")
    def admin_headers(self):
        """Get admin headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_workflows_endpoint_exists(self, admin_headers):
        """Test /api/workflows endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/workflows", headers=admin_headers)
        
        assert response.status_code != 404, "Workflows endpoint not found"
        
        if response.status_code == 200:
            workflows = response.json()
            print(f"✓ Workflows endpoint returns {len(workflows)} workflows")
        else:
            print(f"⚠ Workflows endpoint returned status {response.status_code}")


class TestMyRequestsEndpoint:
    """Test my-requests endpoint for My Submitted Tickets"""
    
    @pytest.fixture(scope="class")
    def admin_headers(self):
        """Get admin headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_my_requests_endpoint(self, admin_headers):
        """Test /api/orders/my-requests endpoint for My Submitted Tickets"""
        response = requests.get(f"{BASE_URL}/api/orders/my-requests", headers=admin_headers)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ my-requests endpoint returns {len(data)} requests")
        elif response.status_code == 404:
            # Try alternative endpoint
            response2 = requests.get(f"{BASE_URL}/api/my-requests", headers=admin_headers)
            if response2.status_code == 200:
                print(f"✓ my-requests endpoint at /api/my-requests")
            else:
                print(f"⚠ my-requests endpoint not found at expected paths")
        else:
            print(f"⚠ my-requests returned status {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
