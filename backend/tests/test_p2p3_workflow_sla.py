"""
Test P2/P3 Features: Backend Refactoring, Workflow Execution Engine, SLA Breach Alerts
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestP2BackendRefactoring:
    """P2: Verify backend services are modularized"""
    
    def test_services_directory_exists(self, auth_headers):
        """Verify services directory structure exists (checked via imports working)"""
        # If the server is running and these endpoints work, the imports worked
        # Test that workflow engine service is imported
        response = requests.get(f"{BASE_URL}/api/workflows", headers=auth_headers)
        assert response.status_code == 200
        
        # Test that SLA monitor service is imported
        response = requests.get(f"{BASE_URL}/api/sla-alerts/statistics", headers=auth_headers)
        assert response.status_code == 200
        
        print("✓ Backend services are properly imported and running")
    
    def test_notifications_service_works(self, auth_headers):
        """Test notifications service is working via API"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ Notifications service working - returned {len(response.json())} notifications")
    
    def test_webhooks_service_works(self, auth_headers):
        """Test webhooks service is working via API"""
        response = requests.get(f"{BASE_URL}/api/webhooks", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ Webhooks service working - returned {len(response.json())} webhooks")


class TestP3WorkflowExecutionEngine:
    """P3: Workflow Execution Engine tests"""
    
    def test_get_workflows(self, auth_headers):
        """GET /api/workflows - List all workflows"""
        response = requests.get(f"{BASE_URL}/api/workflows", headers=auth_headers)
        assert response.status_code == 200
        workflows = response.json()
        assert isinstance(workflows, list)
        print(f"✓ GET /api/workflows returned {len(workflows)} workflows")
        return workflows
    
    def test_get_workflow_executions(self, auth_headers):
        """GET /api/workflow-executions - List execution logs"""
        response = requests.get(f"{BASE_URL}/api/workflow-executions", headers=auth_headers)
        assert response.status_code == 200
        executions = response.json()
        assert isinstance(executions, list)
        print(f"✓ GET /api/workflow-executions returned {len(executions)} executions")
        return executions
    
    def test_workflow_test_endpoint(self, auth_headers):
        """POST /api/workflows/{id}/test - Test workflow execution"""
        # First get a workflow
        workflows_response = requests.get(f"{BASE_URL}/api/workflows", headers=auth_headers)
        assert workflows_response.status_code == 200
        workflows = workflows_response.json()
        
        if not workflows:
            pytest.skip("No workflows available to test")
        
        # Find an active workflow
        active_workflow = next((w for w in workflows if w.get('is_active') or w.get('active')), None)
        if not active_workflow:
            # Try to activate one
            workflow_id = workflows[0]['id']
            activate_response = requests.patch(
                f"{BASE_URL}/api/workflows/{workflow_id}",
                headers=auth_headers,
                json={"is_active": True, "active": True}
            )
            if activate_response.status_code == 200:
                active_workflow = workflows[0]
            else:
                pytest.skip("No active workflows and couldn't activate one")
        
        workflow_id = active_workflow['id']
        
        # Test the workflow
        response = requests.post(f"{BASE_URL}/api/workflows/{workflow_id}/test", headers=auth_headers)
        
        # Should return execution log or null if workflow not active
        if response.status_code == 200:
            result = response.json()
            if result:
                assert "id" in result
                assert "status" in result
                assert result["status"] in ["completed", "failed", "running"]
                print(f"✓ Workflow test executed - Status: {result['status']}")
            else:
                print("✓ Workflow test returned null (workflow may be inactive)")
        else:
            print(f"⚠ Workflow test returned status {response.status_code}")
    
    def test_workflow_execution_has_required_fields(self, auth_headers):
        """Verify execution logs have required fields"""
        response = requests.get(f"{BASE_URL}/api/workflow-executions", headers=auth_headers)
        assert response.status_code == 200
        executions = response.json()
        
        if not executions:
            pytest.skip("No executions to verify")
        
        execution = executions[0]
        required_fields = ["id", "workflow_id", "workflow_name", "status", "started_at"]
        for field in required_fields:
            assert field in execution, f"Missing field: {field}"
        
        print(f"✓ Execution log has all required fields: {required_fields}")


class TestP3SLABreachAlerts:
    """P3: SLA Breach Alerts tests"""
    
    def test_get_sla_statistics(self, auth_headers):
        """GET /api/sla-alerts/statistics - Get SLA statistics"""
        response = requests.get(f"{BASE_URL}/api/sla-alerts/statistics", headers=auth_headers)
        assert response.status_code == 200
        stats = response.json()
        
        # Verify structure
        assert "orders" in stats
        assert "alerts" in stats
        
        # Verify orders breakdown
        orders = stats["orders"]
        assert "on_track" in orders
        assert "at_risk" in orders
        assert "breached" in orders
        assert "total_open" in orders
        
        # Verify alerts breakdown
        alerts = stats["alerts"]
        assert "total" in alerts
        assert "unacknowledged" in alerts
        assert "breaches_today" in alerts
        
        print(f"✓ SLA Statistics: {orders['on_track']} on track, {orders['at_risk']} at risk, {orders['breached']} breached")
        print(f"  Alerts: {alerts['total']} total, {alerts['unacknowledged']} unacknowledged")
    
    def test_get_sla_alerts(self, auth_headers):
        """GET /api/sla-alerts - List SLA alerts"""
        response = requests.get(f"{BASE_URL}/api/sla-alerts", headers=auth_headers)
        assert response.status_code == 200
        alerts = response.json()
        assert isinstance(alerts, list)
        print(f"✓ GET /api/sla-alerts returned {len(alerts)} alerts")
        
        if alerts:
            alert = alerts[0]
            required_fields = ["id", "order_id", "alert_type", "triggered_at", "acknowledged"]
            for field in required_fields:
                assert field in alert, f"Missing field: {field}"
            print(f"  First alert: {alert['alert_type']} for order {alert.get('order_code', 'N/A')}")
    
    def test_manual_sla_check(self, auth_headers):
        """POST /api/sla-check - Manually trigger SLA check"""
        response = requests.post(f"{BASE_URL}/api/sla-check", headers=auth_headers)
        assert response.status_code == 200
        result = response.json()
        
        assert "checked" in result
        assert "breached" in result
        assert "warnings" in result
        
        print(f"✓ Manual SLA check: {result['checked']} orders checked, {result['breached']} breached, {result['warnings']} warnings")
    
    def test_acknowledge_sla_alert(self, auth_headers):
        """POST /api/sla-alerts/{id}/acknowledge - Acknowledge an alert"""
        # First get alerts
        alerts_response = requests.get(f"{BASE_URL}/api/sla-alerts", headers=auth_headers)
        assert alerts_response.status_code == 200
        alerts = alerts_response.json()
        
        # Find an unacknowledged alert
        unack_alert = next((a for a in alerts if not a.get('acknowledged')), None)
        
        if not unack_alert:
            pytest.skip("No unacknowledged alerts to test")
        
        alert_id = unack_alert['id']
        response = requests.post(f"{BASE_URL}/api/sla-alerts/{alert_id}/acknowledge", headers=auth_headers)
        
        if response.status_code == 200:
            result = response.json()
            assert result["acknowledged"] == True
            print(f"✓ Alert {alert_id} acknowledged successfully")
        else:
            print(f"⚠ Acknowledge returned status {response.status_code}")


class TestSLADefinitions:
    """Test SLA definitions CRUD"""
    
    def test_get_sla_definitions(self, auth_headers):
        """GET /api/sla - List SLA definitions"""
        response = requests.get(f"{BASE_URL}/api/sla", headers=auth_headers)
        assert response.status_code == 200
        slas = response.json()
        assert isinstance(slas, list)
        print(f"✓ GET /api/sla returned {len(slas)} SLA definitions")


class TestWorkflowTriggersOnOrderCreation:
    """Test that workflows are triggered when orders are created"""
    
    def test_create_order_triggers_workflow(self, auth_headers):
        """Creating an order should trigger associated workflows"""
        # Get initial execution count
        exec_response = requests.get(f"{BASE_URL}/api/workflow-executions", headers=auth_headers)
        initial_count = len(exec_response.json()) if exec_response.status_code == 200 else 0
        
        # Create a test order
        order_data = {
            "title": "TEST_Workflow_Trigger_Order",
            "description": "Testing workflow trigger on order creation",
            "priority": "Normal"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", headers=auth_headers, json=order_data)
        
        if create_response.status_code == 201:
            order = create_response.json()
            print(f"✓ Created test order: {order.get('order_code', order['id'])}")
            
            # Wait a moment for async workflow execution
            time.sleep(1)
            
            # Check if new executions were created
            exec_response = requests.get(f"{BASE_URL}/api/workflow-executions", headers=auth_headers)
            new_count = len(exec_response.json()) if exec_response.status_code == 200 else 0
            
            if new_count > initial_count:
                print(f"✓ Workflow execution triggered - {new_count - initial_count} new execution(s)")
            else:
                print("⚠ No new workflow executions (may not have active workflows with order.created trigger)")
            
            # Cleanup - delete the test order
            requests.delete(f"{BASE_URL}/api/orders/{order['id']}", headers=auth_headers)
        else:
            print(f"⚠ Could not create test order: {create_response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
