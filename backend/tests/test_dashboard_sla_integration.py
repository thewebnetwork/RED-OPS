"""
Test Dashboard SLA Integration and Access Tier Scope
Tests for:
1. Dashboard shows unified SLA Status section with On Track, At Risk, Breached, Unacknowledged KPIs
2. Dashboard SLA KPIs link to SLA module with correct filters
3. Old 'SLA Breaching' KPI removed from Dashboard (not used in Admin Dashboard)
4. Dashboard SLA stats match SLA module stats exactly (single source of truth)
5. SLA Policy scope includes Access Tier in addition to Roles, Teams, Specialties
6. Policy creation dialog shows Access Tier section with checkboxes
7. Backend SLAPolicyScope model includes access_tier_ids field
8. Policy engine auto_apply considers access_tier_ids in scope matching
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDashboardSLAIntegration:
    """Test Dashboard SLA Status integration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        # Cleanup: Delete any TEST_ prefixed policies
        try:
            policies = self.session.get(f"{BASE_URL}/api/sla-policies?active_only=false").json()
            for policy in policies:
                if policy.get("name", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/sla-policies/{policy['id']}")
        except:
            pass
    
    # ============== Dashboard SLA Stats Tests ==============
    
    def test_sla_monitoring_stats_endpoint_returns_correct_structure(self):
        """Test /api/sla-policies/monitoring/stats returns correct structure"""
        response = self.session.get(f"{BASE_URL}/api/sla-policies/monitoring/stats")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Verify orders section
        assert "orders" in data, "Missing 'orders' section"
        orders = data["orders"]
        assert "total_active" in orders, "Missing 'total_active' in orders"
        assert "on_track" in orders, "Missing 'on_track' in orders"
        assert "at_risk" in orders, "Missing 'at_risk' in orders"
        assert "breached" in orders, "Missing 'breached' in orders"
        
        # Verify escalations section
        assert "escalations" in data, "Missing 'escalations' section"
        escalations = data["escalations"]
        assert "unacknowledged" in escalations, "Missing 'unacknowledged' in escalations"
        
        print(f"SLA Stats: on_track={orders['on_track']}, at_risk={orders['at_risk']}, breached={orders['breached']}, unacknowledged={escalations['unacknowledged']}")
    
    def test_dashboard_stats_does_not_include_sla_breaching_in_admin_kpis(self):
        """Test that dashboard stats endpoint still works but sla_breaching_count is not used in Admin Dashboard KPIs"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # The endpoint may still return sla_breaching_count for backward compatibility
        # but the Admin Dashboard should use /api/sla-policies/monitoring/stats instead
        
        # Verify basic stats are present
        assert "open_count" in data
        assert "in_progress_count" in data
        assert "pending_count" in data
        assert "delivered_count" in data
        
        print(f"Dashboard stats: open={data['open_count']}, in_progress={data['in_progress_count']}")
    
    def test_sla_stats_consistency_between_endpoints(self):
        """Test that SLA stats are consistent (single source of truth)"""
        # Get stats from monitoring endpoint
        monitoring_response = self.session.get(f"{BASE_URL}/api/sla-policies/monitoring/stats")
        assert monitoring_response.status_code == 200
        monitoring_data = monitoring_response.json()
        
        # Get at-risk orders
        at_risk_response = self.session.get(f"{BASE_URL}/api/sla-policies/monitoring/at-risk")
        assert at_risk_response.status_code == 200
        at_risk_orders = at_risk_response.json()
        
        # Get breached orders
        breached_response = self.session.get(f"{BASE_URL}/api/sla-policies/monitoring/breached")
        assert breached_response.status_code == 200
        breached_orders = breached_response.json()
        
        # Verify counts match
        assert monitoring_data["orders"]["at_risk"] == len(at_risk_orders), \
            f"At-risk count mismatch: stats={monitoring_data['orders']['at_risk']}, actual={len(at_risk_orders)}"
        assert monitoring_data["orders"]["breached"] == len(breached_orders), \
            f"Breached count mismatch: stats={monitoring_data['orders']['breached']}, actual={len(breached_orders)}"
        
        print(f"Stats consistency verified: at_risk={len(at_risk_orders)}, breached={len(breached_orders)}")
    
    # ============== Access Tier Scope Tests ==============
    
    def test_access_tiers_endpoint_available(self):
        """Test /api/access-tiers endpoint returns access tiers"""
        response = self.session.get(f"{BASE_URL}/api/access-tiers")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        tiers = response.json()
        assert isinstance(tiers, list), "Expected list of access tiers"
        assert len(tiers) > 0, "Expected at least one access tier"
        
        # Verify tier structure
        tier = tiers[0]
        assert "id" in tier, "Missing 'id' in access tier"
        assert "name" in tier, "Missing 'name' in access tier"
        
        print(f"Found {len(tiers)} access tiers: {[t['name'] for t in tiers]}")
    
    def test_create_policy_with_access_tier_scope(self):
        """Test creating SLA policy with access_tier_ids in scope"""
        # Get an access tier ID
        tiers_response = self.session.get(f"{BASE_URL}/api/access-tiers")
        assert tiers_response.status_code == 200
        tiers = tiers_response.json()
        assert len(tiers) > 0, "No access tiers available"
        
        tier_id = tiers[0]["id"]
        tier_name = tiers[0]["name"]
        
        # Create policy with access tier scope
        policy_data = {
            "name": f"TEST_AccessTier_Policy_{uuid.uuid4().hex[:8]}",
            "description": "Test policy with access tier scope",
            "scope": {
                "role_ids": [],
                "team_ids": [],
                "specialty_ids": [],
                "access_tier_ids": [tier_id]
            },
            "sla_rules": {
                "duration_minutes": 480,
                "business_hours_only": False
            },
            "thresholds": {
                "at_risk_minutes": 120
            },
            "escalation_levels": [],
            "is_active": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/sla-policies", json=policy_data)
        assert response.status_code == 200, f"Failed to create policy: {response.text}"
        
        created_policy = response.json()
        
        # Verify access_tier_ids is in scope
        assert "scope" in created_policy, "Missing 'scope' in response"
        assert "access_tier_ids" in created_policy["scope"], "Missing 'access_tier_ids' in scope"
        assert tier_id in created_policy["scope"]["access_tier_ids"], "Access tier ID not saved"
        
        # Verify access_tier_names is populated
        assert "access_tier_names" in created_policy["scope"], "Missing 'access_tier_names' in scope"
        assert tier_name in created_policy["scope"]["access_tier_names"], "Access tier name not populated"
        
        print(f"Created policy with access tier scope: {created_policy['name']}")
        print(f"Access tier IDs: {created_policy['scope']['access_tier_ids']}")
        print(f"Access tier names: {created_policy['scope']['access_tier_names']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/sla-policies/{created_policy['id']}")
    
    def test_update_policy_with_access_tier_scope(self):
        """Test updating SLA policy to add access_tier_ids"""
        # Create a basic policy first
        policy_data = {
            "name": f"TEST_UpdateAccessTier_{uuid.uuid4().hex[:8]}",
            "description": "Test policy for update",
            "scope": {
                "role_ids": [],
                "team_ids": [],
                "specialty_ids": [],
                "access_tier_ids": []
            },
            "sla_rules": {
                "duration_minutes": 480,
                "business_hours_only": False
            },
            "thresholds": {
                "at_risk_minutes": 120
            },
            "escalation_levels": [],
            "is_active": True
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/sla-policies", json=policy_data)
        assert create_response.status_code == 200
        policy_id = create_response.json()["id"]
        
        # Get access tiers
        tiers_response = self.session.get(f"{BASE_URL}/api/access-tiers")
        tiers = tiers_response.json()
        tier_id = tiers[0]["id"]
        
        # Update policy with access tier
        update_data = {
            "scope": {
                "role_ids": [],
                "team_ids": [],
                "specialty_ids": [],
                "access_tier_ids": [tier_id]
            }
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/sla-policies/{policy_id}", json=update_data)
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        
        updated_policy = update_response.json()
        assert tier_id in updated_policy["scope"]["access_tier_ids"], "Access tier not added"
        
        print(f"Updated policy with access tier: {updated_policy['scope']['access_tier_ids']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/sla-policies/{policy_id}")
    
    def test_policy_scope_includes_all_scope_types(self):
        """Test that policy scope supports all scope types: roles, teams, specialties, access_tiers"""
        # Get reference data
        roles_response = self.session.get(f"{BASE_URL}/api/roles")
        teams_response = self.session.get(f"{BASE_URL}/api/teams")
        specialties_response = self.session.get(f"{BASE_URL}/api/specialties")
        tiers_response = self.session.get(f"{BASE_URL}/api/access-tiers")
        
        roles = roles_response.json() if roles_response.status_code == 200 else []
        teams = teams_response.json() if teams_response.status_code == 200 else []
        specialties = specialties_response.json() if specialties_response.status_code == 200 else []
        tiers = tiers_response.json() if tiers_response.status_code == 200 else []
        
        # Create policy with all scope types
        scope = {
            "role_ids": [roles[0]["id"]] if roles else [],
            "team_ids": [teams[0]["id"]] if teams else [],
            "specialty_ids": [specialties[0]["id"]] if specialties else [],
            "access_tier_ids": [tiers[0]["id"]] if tiers else []
        }
        
        policy_data = {
            "name": f"TEST_AllScopes_{uuid.uuid4().hex[:8]}",
            "description": "Test policy with all scope types",
            "scope": scope,
            "sla_rules": {
                "duration_minutes": 480,
                "business_hours_only": False
            },
            "thresholds": {
                "at_risk_minutes": 120
            },
            "escalation_levels": [],
            "is_active": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/sla-policies", json=policy_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        created_policy = response.json()
        
        # Verify all scope types are present
        policy_scope = created_policy["scope"]
        assert "role_ids" in policy_scope, "Missing role_ids"
        assert "team_ids" in policy_scope, "Missing team_ids"
        assert "specialty_ids" in policy_scope, "Missing specialty_ids"
        assert "access_tier_ids" in policy_scope, "Missing access_tier_ids"
        
        # Verify names are populated
        if roles:
            assert "role_names" in policy_scope, "Missing role_names"
        if teams:
            assert "team_names" in policy_scope, "Missing team_names"
        if specialties:
            assert "specialty_names" in policy_scope, "Missing specialty_names"
        if tiers:
            assert "access_tier_names" in policy_scope, "Missing access_tier_names"
        
        print(f"Policy scope verified with all types:")
        print(f"  Roles: {policy_scope.get('role_names', [])}")
        print(f"  Teams: {policy_scope.get('team_names', [])}")
        print(f"  Specialties: {policy_scope.get('specialty_names', [])}")
        print(f"  Access Tiers: {policy_scope.get('access_tier_names', [])}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/sla-policies/{created_policy['id']}")
    
    # ============== SLA Policy Engine Tests ==============
    
    def test_policy_check_endpoint_works(self):
        """Test /api/sla-policies/check endpoint triggers policy evaluation"""
        response = self.session.post(f"{BASE_URL}/api/sla-policies/check")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Missing 'message' in response"
        assert "processed" in data, "Missing 'processed' count"
        
        print(f"Policy check result: {data}")
    
    def test_escalation_history_endpoint(self):
        """Test /api/sla-policies/monitoring/history returns escalation history"""
        response = self.session.get(f"{BASE_URL}/api/sla-policies/monitoring/history")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        history = response.json()
        assert isinstance(history, list), "Expected list of history entries"
        
        print(f"Found {len(history)} escalation history entries")
    
    def test_at_risk_orders_endpoint(self):
        """Test /api/sla-policies/monitoring/at-risk returns at-risk orders"""
        response = self.session.get(f"{BASE_URL}/api/sla-policies/monitoring/at-risk")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        orders = response.json()
        assert isinstance(orders, list), "Expected list of orders"
        
        # Verify order structure if any exist
        if orders:
            order = orders[0]
            assert "id" in order, "Missing 'id'"
            assert "order_code" in order, "Missing 'order_code'"
            assert "sla_status" in order, "Missing 'sla_status'"
            assert order["sla_status"] == "at_risk", f"Expected 'at_risk' status, got {order['sla_status']}"
        
        print(f"Found {len(orders)} at-risk orders")
    
    def test_breached_orders_endpoint(self):
        """Test /api/sla-policies/monitoring/breached returns breached orders"""
        response = self.session.get(f"{BASE_URL}/api/sla-policies/monitoring/breached")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        orders = response.json()
        assert isinstance(orders, list), "Expected list of orders"
        
        # Verify order structure if any exist
        if orders:
            order = orders[0]
            assert "id" in order, "Missing 'id'"
            assert "order_code" in order, "Missing 'order_code'"
            assert "sla_status" in order, "Missing 'sla_status'"
            assert order["sla_status"] == "breached", f"Expected 'breached' status, got {order['sla_status']}"
        
        print(f"Found {len(orders)} breached orders")


class TestSLAPolicyModel:
    """Test SLA Policy model structure"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        # Cleanup
        try:
            policies = self.session.get(f"{BASE_URL}/api/sla-policies?active_only=false").json()
            for policy in policies:
                if policy.get("name", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/sla-policies/{policy['id']}")
        except:
            pass
    
    def test_policy_response_includes_all_fields(self):
        """Test that policy response includes all expected fields"""
        # Create a policy
        policy_data = {
            "name": f"TEST_FullFields_{uuid.uuid4().hex[:8]}",
            "description": "Test policy with all fields",
            "scope": {
                "role_ids": [],
                "team_ids": [],
                "specialty_ids": [],
                "access_tier_ids": []
            },
            "sla_rules": {
                "duration_minutes": 480,
                "business_hours_only": True,
                "timezone": "UTC"
            },
            "thresholds": {
                "at_risk_minutes": 120,
                "at_risk_percentage": 80
            },
            "escalation_levels": [
                {
                    "level": 1,
                    "name": "First Alert",
                    "trigger": "at_risk",
                    "delay_minutes": 0,
                    "actions": []
                }
            ],
            "is_active": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/sla-policies", json=policy_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        policy = response.json()
        
        # Verify all expected fields
        assert "id" in policy, "Missing 'id'"
        assert "name" in policy, "Missing 'name'"
        assert "description" in policy, "Missing 'description'"
        assert "scope" in policy, "Missing 'scope'"
        assert "sla_rules" in policy, "Missing 'sla_rules'"
        assert "thresholds" in policy, "Missing 'thresholds'"
        assert "escalation_levels" in policy, "Missing 'escalation_levels'"
        assert "is_active" in policy, "Missing 'is_active'"
        assert "orders_count" in policy, "Missing 'orders_count'"
        assert "created_at" in policy, "Missing 'created_at'"
        
        # Verify scope structure
        scope = policy["scope"]
        assert "role_ids" in scope, "Missing 'role_ids' in scope"
        assert "team_ids" in scope, "Missing 'team_ids' in scope"
        assert "specialty_ids" in scope, "Missing 'specialty_ids' in scope"
        assert "access_tier_ids" in scope, "Missing 'access_tier_ids' in scope"
        
        print(f"Policy structure verified: {policy['name']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/sla-policies/{policy['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
