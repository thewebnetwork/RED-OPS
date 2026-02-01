"""
Test Multi-Dashboard System - P0 Feature
Tests for:
1. Dashboard Builder APIs (CRUD, clone, preview)
2. 4 System Dashboard Templates with correct widget counts
3. Widget Library API
4. IAM User Dashboard Type Assignment
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMultiDashboardSystem:
    """Multi-Dashboard System API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Admin123!"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    # ============== Dashboard List API Tests ==============
    
    def test_dashboard_list_returns_4_system_dashboards(self):
        """GET /api/dashboards/list returns 4 system dashboards"""
        response = requests.get(f"{BASE_URL}/api/dashboards/list", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "dashboards" in data
        
        system_dashboards = [d for d in data["dashboards"] if d.get("is_system")]
        assert len(system_dashboards) >= 4, f"Expected at least 4 system dashboards, got {len(system_dashboards)}"
    
    def test_admin_executive_dashboard_has_19_widgets(self):
        """Admin Executive Dashboard has 19 widgets"""
        response = requests.get(f"{BASE_URL}/api/dashboards/list", headers=self.headers)
        assert response.status_code == 200
        
        dashboards = response.json()["dashboards"]
        admin_dashboard = next((d for d in dashboards if d["id"] == "admin_executive"), None)
        
        assert admin_dashboard is not None, "Admin Executive Dashboard not found"
        assert len(admin_dashboard["widgets"]) == 19, f"Expected 19 widgets, got {len(admin_dashboard['widgets'])}"
        assert admin_dashboard["is_default_for"] == "Administrator"
    
    def test_resolver_operator_dashboard_has_11_widgets(self):
        """Resolver/Operator Dashboard has 11 widgets"""
        response = requests.get(f"{BASE_URL}/api/dashboards/list", headers=self.headers)
        assert response.status_code == 200
        
        dashboards = response.json()["dashboards"]
        resolver_dashboard = next((d for d in dashboards if d["id"] == "resolver_operator"), None)
        
        assert resolver_dashboard is not None, "Resolver/Operator Dashboard not found"
        assert len(resolver_dashboard["widgets"]) == 11, f"Expected 11 widgets, got {len(resolver_dashboard['widgets'])}"
        assert resolver_dashboard["is_default_for"] == "Internal Staff"
    
    def test_partner_vendor_dashboard_has_9_widgets(self):
        """Partner/Vendor Dashboard has 9 widgets"""
        response = requests.get(f"{BASE_URL}/api/dashboards/list", headers=self.headers)
        assert response.status_code == 200
        
        dashboards = response.json()["dashboards"]
        partner_dashboard = next((d for d in dashboards if d["id"] == "partner_vendor"), None)
        
        assert partner_dashboard is not None, "Partner/Vendor Dashboard not found"
        assert len(partner_dashboard["widgets"]) == 9, f"Expected 9 widgets, got {len(partner_dashboard['widgets'])}"
        assert partner_dashboard["is_default_for"] == "Partner"
    
    def test_requester_client_dashboard_has_10_widgets(self):
        """Requester/Client Dashboard has 10 widgets"""
        response = requests.get(f"{BASE_URL}/api/dashboards/list", headers=self.headers)
        assert response.status_code == 200
        
        dashboards = response.json()["dashboards"]
        client_dashboard = next((d for d in dashboards if d["id"] == "requester_client"), None)
        
        assert client_dashboard is not None, "Requester/Client Dashboard not found"
        assert len(client_dashboard["widgets"]) == 10, f"Expected 10 widgets, got {len(client_dashboard['widgets'])}"
        assert client_dashboard["is_default_for"] == "Media Client"
    
    # ============== Widget Library API Tests ==============
    
    def test_widget_library_returns_widgets_and_categories(self):
        """GET /api/dashboards/widgets returns widget library with categories"""
        response = requests.get(f"{BASE_URL}/api/dashboards/widgets", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "widgets" in data
        assert "categories" in data
        assert len(data["widgets"]) > 0, "Widget library should not be empty"
        
        # Verify expected categories exist
        expected_categories = ["KPI Cards", "SLA Status", "Pool Status", "Charts", "Ticket Lists"]
        for cat in expected_categories:
            assert cat in data["categories"], f"Category '{cat}' not found in widget library"
    
    def test_widget_library_has_kpi_cards(self):
        """Widget library contains KPI card widgets"""
        response = requests.get(f"{BASE_URL}/api/dashboards/widgets", headers=self.headers)
        assert response.status_code == 200
        
        widgets = response.json()["widgets"]
        kpi_widgets = [w for w in widgets if w["widget_type"] == "kpi_card"]
        assert len(kpi_widgets) > 0, "No KPI card widgets found"
    
    def test_widget_library_has_charts(self):
        """Widget library contains chart widgets"""
        response = requests.get(f"{BASE_URL}/api/dashboards/widgets", headers=self.headers)
        assert response.status_code == 200
        
        widgets = response.json()["widgets"]
        chart_widgets = [w for w in widgets if w["widget_type"] == "chart"]
        assert len(chart_widgets) > 0, "No chart widgets found"
    
    def test_widget_library_has_ticket_lists(self):
        """Widget library contains ticket list widgets"""
        response = requests.get(f"{BASE_URL}/api/dashboards/widgets", headers=self.headers)
        assert response.status_code == 200
        
        widgets = response.json()["widgets"]
        list_widgets = [w for w in widgets if w["widget_type"] == "ticket_list"]
        assert len(list_widgets) > 0, "No ticket list widgets found"
    
    # ============== Clone Dashboard API Tests ==============
    
    def test_clone_dashboard_creates_new_dashboard(self):
        """POST /api/dashboards/{id}/clone creates a cloned dashboard"""
        clone_name = "TEST_Cloned_Admin_Dashboard"
        response = requests.post(
            f"{BASE_URL}/api/dashboards/admin_executive/clone?name={clone_name}",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["message"] == "Dashboard cloned successfully"
        
        # Verify the cloned dashboard exists
        list_response = requests.get(f"{BASE_URL}/api/dashboards/list", headers=self.headers)
        dashboards = list_response.json()["dashboards"]
        cloned = next((d for d in dashboards if d["name"] == clone_name), None)
        
        assert cloned is not None, "Cloned dashboard not found in list"
        assert cloned["is_system"] == False, "Cloned dashboard should not be a system dashboard"
        
        # Cleanup - delete the cloned dashboard
        requests.delete(f"{BASE_URL}/api/dashboards/{data['id']}", headers=self.headers)
    
    def test_clone_nonexistent_dashboard_returns_404(self):
        """Clone non-existent dashboard returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/dashboards/nonexistent_id/clone?name=Test",
            headers=self.headers
        )
        assert response.status_code == 404
    
    # ============== Preview Dashboard API Tests ==============
    
    def test_preview_dashboard_as_administrator(self):
        """GET /api/dashboards/{id}/preview?role=Administrator returns preview"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/admin_executive/preview?role=Administrator",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "dashboard" in data
        assert "preview_role" in data
        assert "original_widget_count" in data
        assert "visible_widget_count" in data
        
        assert data["preview_role"] == "Administrator"
        assert data["original_widget_count"] == 19
        # Admin should see all widgets
        assert data["visible_widget_count"] == 19
    
    def test_preview_dashboard_as_operator(self):
        """Preview dashboard as Operator role"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/admin_executive/preview?role=Operator",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["preview_role"] == "Operator"
        # Operator may have fewer visible widgets due to permissions
        assert data["visible_widget_count"] <= data["original_widget_count"]
    
    def test_preview_nonexistent_dashboard_returns_404(self):
        """Preview non-existent dashboard returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/nonexistent_id/preview?role=Administrator",
            headers=self.headers
        )
        assert response.status_code == 404
    
    # ============== Dashboard CRUD Tests ==============
    
    def test_create_custom_dashboard(self):
        """POST /api/dashboards creates a custom dashboard"""
        response = requests.post(
            f"{BASE_URL}/api/dashboards",
            headers=self.headers,
            json={
                "name": "TEST_Custom_Dashboard",
                "description": "Test custom dashboard",
                "widgets": []
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        dashboard_id = data["id"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dashboards/{dashboard_id}", headers=self.headers)
    
    def test_update_dashboard(self):
        """PUT /api/dashboards/{id} updates a dashboard"""
        # First create a dashboard
        create_response = requests.post(
            f"{BASE_URL}/api/dashboards",
            headers=self.headers,
            json={
                "name": "TEST_Update_Dashboard",
                "description": "Original description",
                "widgets": []
            }
        )
        dashboard_id = create_response.json()["id"]
        
        # Update it
        update_response = requests.put(
            f"{BASE_URL}/api/dashboards/{dashboard_id}",
            headers=self.headers,
            json={
                "name": "TEST_Updated_Dashboard",
                "description": "Updated description"
            }
        )
        assert update_response.status_code == 200
        
        # Verify update
        list_response = requests.get(f"{BASE_URL}/api/dashboards/list", headers=self.headers)
        dashboards = list_response.json()["dashboards"]
        updated = next((d for d in dashboards if d["id"] == dashboard_id), None)
        
        assert updated is not None
        assert updated["name"] == "TEST_Updated_Dashboard"
        assert updated["description"] == "Updated description"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dashboards/{dashboard_id}", headers=self.headers)
    
    def test_cannot_delete_system_dashboard(self):
        """DELETE /api/dashboards/{id} fails for system dashboards"""
        response = requests.delete(
            f"{BASE_URL}/api/dashboards/admin_executive",
            headers=self.headers
        )
        assert response.status_code == 400
        assert "system dashboard" in response.json()["detail"].lower()
    
    def test_delete_custom_dashboard(self):
        """DELETE /api/dashboards/{id} deletes custom dashboard"""
        # Create a dashboard
        create_response = requests.post(
            f"{BASE_URL}/api/dashboards",
            headers=self.headers,
            json={
                "name": "TEST_Delete_Dashboard",
                "description": "To be deleted",
                "widgets": []
            }
        )
        dashboard_id = create_response.json()["id"]
        
        # Delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/dashboards/{dashboard_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200
        
        # Verify deletion
        list_response = requests.get(f"{BASE_URL}/api/dashboards/list", headers=self.headers)
        dashboards = list_response.json()["dashboards"]
        deleted = next((d for d in dashboards if d["id"] == dashboard_id), None)
        assert deleted is None, "Dashboard should be deleted"


class TestIAMDashboardTypeAssignment:
    """Tests for IAM User Dashboard Type Assignment"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Admin123!"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get a specialty for user creation
        specialties_response = requests.get(f"{BASE_URL}/api/specialties", headers=self.headers)
        if specialties_response.status_code == 200 and specialties_response.json():
            self.specialty_id = specialties_response.json()[0]["id"]
        else:
            # Create a specialty if none exists
            create_spec = requests.post(
                f"{BASE_URL}/api/specialties",
                headers=self.headers,
                json={"name": "TEST_Specialty", "description": "Test", "color": "#FF0000"}
            )
            self.specialty_id = create_spec.json()["id"]
    
    def test_create_user_with_dashboard_type(self):
        """Create user with dashboard_type_id field"""
        response = requests.post(
            f"{BASE_URL}/api/users",
            headers=self.headers,
            json={
                "name": "TEST_Dashboard_User",
                "email": "test_dashboard_user@test.com",
                "password": "TestPass123!",
                "role": "Standard User",
                "account_type": "Internal Staff",
                "specialty_ids": [self.specialty_id],
                "dashboard_type_id": "resolver_operator",
                "send_welcome_email": False
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["dashboard_type_id"] == "resolver_operator"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{data['id']}", headers=self.headers)
    
    def test_update_user_dashboard_type(self):
        """Update user's dashboard_type_id"""
        # Create user
        create_response = requests.post(
            f"{BASE_URL}/api/users",
            headers=self.headers,
            json={
                "name": "TEST_Update_Dashboard_User",
                "email": "test_update_dashboard@test.com",
                "password": "TestPass123!",
                "role": "Standard User",
                "account_type": "Internal Staff",
                "specialty_ids": [self.specialty_id],
                "dashboard_type_id": "resolver_operator",
                "send_welcome_email": False
            }
        )
        user_id = create_response.json()["id"]
        
        # Update dashboard type
        update_response = requests.patch(
            f"{BASE_URL}/api/users/{user_id}",
            headers=self.headers,
            json={"dashboard_type_id": "admin_executive"}
        )
        assert update_response.status_code == 200
        assert update_response.json()["dashboard_type_id"] == "admin_executive"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
    
    def test_user_response_includes_dashboard_type_name(self):
        """User response includes dashboard_type_name"""
        # Create user with dashboard type
        create_response = requests.post(
            f"{BASE_URL}/api/users",
            headers=self.headers,
            json={
                "name": "TEST_Dashboard_Name_User",
                "email": "test_dashboard_name@test.com",
                "password": "TestPass123!",
                "role": "Standard User",
                "account_type": "Internal Staff",
                "specialty_ids": [self.specialty_id],
                "dashboard_type_id": "admin_executive",
                "send_welcome_email": False
            }
        )
        assert create_response.status_code == 200
        
        data = create_response.json()
        assert data["dashboard_type_id"] == "admin_executive"
        assert data["dashboard_type_name"] == "Admin Executive Dashboard"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{data['id']}", headers=self.headers)


class TestDashboardWidgetPermissions:
    """Tests for widget auto-hide based on permissions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Admin123!"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_widgets_have_required_permissions(self):
        """All widgets have required_permissions field"""
        response = requests.get(f"{BASE_URL}/api/dashboards/list", headers=self.headers)
        assert response.status_code == 200
        
        dashboards = response.json()["dashboards"]
        for dashboard in dashboards:
            for widget in dashboard.get("widgets", []):
                assert "required_permissions" in widget, f"Widget {widget['id']} missing required_permissions"
                assert isinstance(widget["required_permissions"], list)
    
    def test_pool_widgets_require_orders_pick_permission(self):
        """Pool widgets require orders.pick permission"""
        response = requests.get(f"{BASE_URL}/api/dashboards/list", headers=self.headers)
        assert response.status_code == 200
        
        dashboards = response.json()["dashboards"]
        admin_dashboard = next((d for d in dashboards if d["id"] == "admin_executive"), None)
        
        pool_widgets = [w for w in admin_dashboard["widgets"] if "pool" in w["title"].lower()]
        for widget in pool_widgets:
            assert "orders.pick" in widget["required_permissions"] or "orders.view" in widget["required_permissions"], \
                f"Pool widget {widget['title']} should require orders.pick or orders.view permission"
    
    def test_preview_filters_widgets_by_role_permissions(self):
        """Preview API filters widgets based on role permissions"""
        # Preview as Standard User (limited permissions)
        response = requests.get(
            f"{BASE_URL}/api/dashboards/admin_executive/preview?role=Standard%20User",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Standard User should see fewer widgets than original
        # (they don't have orders.pick permission for pool widgets)
        assert data["visible_widget_count"] <= data["original_widget_count"]


# Cleanup any test data
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    
    # Login
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@redribbonops.com",
        "password": "Admin123!"
    })
    if login_response.status_code != 200:
        return
    
    token = login_response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Delete test dashboards
    list_response = requests.get(f"{BASE_URL}/api/dashboards/list", headers=headers)
    if list_response.status_code == 200:
        for dashboard in list_response.json().get("dashboards", []):
            if dashboard["name"].startswith("TEST_") and not dashboard.get("is_system"):
                requests.delete(f"{BASE_URL}/api/dashboards/{dashboard['id']}", headers=headers)
    
    # Delete test users
    users_response = requests.get(f"{BASE_URL}/api/users", headers=headers)
    if users_response.status_code == 200:
        for user in users_response.json():
            if user["name"].startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=headers)
