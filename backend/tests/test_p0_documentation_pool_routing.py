"""
Test P0 Features: Documentation Download and Pool Routing Logic
- Documentation page for admins to view/download System Logic Snapshot
- Pool routing logic to skip Pool 1 if no eligible Partners exist
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"email": "admin@redribbonops.com", "password": "Fmtvvl171**"}
STANDARD_USER_CREDS = {"email": "standarduser@test.com", "password": "TestPass123!"}
PARTNER_USER_CREDS = {"email": "partneruser@test.com", "password": "TestPass123!"}

# Category IDs from the system
EDITING_SERVICES_L2_ID = "5aebcbf0-1084-4426-854c-33dcccbd01d1"  # Has 3D Artist specialty - Partner exists
PHOTOGRAPHY_L2_ID = "c083000d-1b0e-464a-9ad8-9152de36e36e"  # Has non-existent specialty - NO Partner


class TestDocumentationEndpoints:
    """Test Documentation Download feature for admins"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_01_get_system_logic_snapshot_admin(self):
        """Admin can access GET /api/documentation/system-logic-snapshot"""
        response = requests.get(
            f"{BASE_URL}/api/documentation/system-logic-snapshot",
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "content" in data, "Response should contain 'content' field"
        assert "filename" in data, "Response should contain 'filename' field"
        assert "last_modified" in data, "Response should contain 'last_modified' field"
        assert data["filename"] == "System_Logic_Snapshot.md"
        assert "# Red Ops - System Logic Snapshot" in data["content"]
        print(f"✅ Admin can view documentation - content length: {len(data['content'])} chars")
    
    def test_02_download_md_format_admin(self):
        """Admin can download .md file via GET /api/documentation/system-logic-snapshot/download?format=md"""
        response = requests.get(
            f"{BASE_URL}/api/documentation/system-logic-snapshot/download?format=md",
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Should return raw markdown content
        content = response.text
        assert "# Red Ops - System Logic Snapshot" in content
        print(f"✅ Admin can download .md file - content length: {len(content)} chars")
    
    def test_03_download_pdf_format_admin(self):
        """Admin can download PDF via GET /api/documentation/system-logic-snapshot/download?format=pdf"""
        response = requests.get(
            f"{BASE_URL}/api/documentation/system-logic-snapshot/download?format=pdf",
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "content" in data, "Response should contain 'content' field"
        assert "filename" in data, "Response should contain 'filename' field"
        assert "format" in data, "Response should contain 'format' field"
        assert data["format"] == "pdf"
        assert data["filename"] == "System_Logic_Snapshot.pdf"
        print(f"✅ Admin can download PDF - content provided for frontend generation")
    
    def test_04_non_admin_cannot_access_documentation(self):
        """Non-admin users get 403 when accessing documentation"""
        # Login as standard user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER_CREDS)
        if login_response.status_code != 200:
            pytest.skip("Standard user not available for testing")
        
        standard_token = login_response.json()["token"]
        standard_headers = {"Authorization": f"Bearer {standard_token}"}
        
        # Try to access documentation
        response = requests.get(
            f"{BASE_URL}/api/documentation/system-logic-snapshot",
            headers=standard_headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✅ Non-admin correctly denied access (403)")
    
    def test_05_invalid_format_returns_400(self):
        """Invalid format parameter returns 400"""
        response = requests.get(
            f"{BASE_URL}/api/documentation/system-logic-snapshot/download?format=invalid",
            headers=self.admin_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✅ Invalid format correctly returns 400")


class TestPoolRoutingLogic:
    """Test Pool Routing Logic - Skip Pool 1 if no eligible Partners"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_06_ticket_with_matching_partner_goes_to_pool_1(self):
        """Ticket with specialty that has matching Partner goes to POOL_1"""
        # Create ticket with Editing Services category (has 3D Artist specialty - Partner exists)
        order_data = {
            "title": "TEST_Pool1_Routing_Test",
            "description": "Testing pool routing - should go to Pool 1",
            "category_l2_id": EDITING_SERVICES_L2_ID,
            "priority": "Normal"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=order_data,
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        order = response.json()
        assert order["pool_stage"] == "POOL_1", f"Expected POOL_1, got {order.get('pool_stage')}"
        assert order["routing_specialty_name"] == "3D Artist", f"Expected 3D Artist specialty"
        assert order["pool1_expires_at"] is not None, "Pool 1 should have expiration time"
        
        print(f"✅ Ticket {order['order_code']} correctly routed to POOL_1 (3D Artist specialty has Partner)")
        
        # Store order ID for cleanup
        self.pool1_order_id = order["id"]
        return order
    
    def test_07_ticket_without_matching_partner_goes_to_pool_2(self):
        """Ticket with specialty that has NO matching Partner goes directly to POOL_2"""
        # Create ticket with Photography category (has non-existent specialty - NO Partner)
        order_data = {
            "title": "TEST_Pool2_Direct_Routing_Test",
            "description": "Testing pool routing - should skip Pool 1 and go directly to Pool 2",
            "category_l2_id": PHOTOGRAPHY_L2_ID,
            "priority": "Normal"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=order_data,
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        order = response.json()
        assert order["pool_stage"] == "POOL_2", f"Expected POOL_2, got {order.get('pool_stage')}"
        assert order["pool1_expires_at"] is None, "Pool 2 tickets should not have Pool 1 expiration"
        
        print(f"✅ Ticket {order['order_code']} correctly routed directly to POOL_2 (no matching Partner)")
        
        # Store order ID for cleanup
        self.pool2_order_id = order["id"]
        return order
    
    def test_08_partner_can_see_pool_1_tickets_matching_specialty(self):
        """Partner user can see POOL_1 tickets matching their specialty"""
        # Login as partner user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=PARTNER_USER_CREDS)
        if login_response.status_code != 200:
            pytest.skip("Partner user not available for testing")
        
        partner_token = login_response.json()["token"]
        partner_headers = {"Authorization": f"Bearer {partner_token}"}
        partner_user = login_response.json()["user"]
        
        # Get Pool 1 tickets
        response = requests.get(
            f"{BASE_URL}/api/orders/pool/1",
            headers=partner_headers
        )
        assert response.status_code == 200, f"Pool 1 access failed: {response.text}"
        
        tickets = response.json()
        print(f"Partner sees {len(tickets)} tickets in Pool 1")
        
        # Verify all tickets match partner's specialty
        partner_specialty_id = partner_user.get("specialty_id")
        for ticket in tickets:
            if ticket.get("routing_specialty_id"):
                assert ticket["routing_specialty_id"] == partner_specialty_id, \
                    f"Ticket {ticket['order_code']} has wrong specialty for this Partner"
        
        print(f"✅ Partner can access Pool 1 and sees only matching specialty tickets")
    
    def test_09_pool_stage_and_routing_fields_stored_correctly(self):
        """Verify pool_stage and routing_specialty fields are correctly stored in orders"""
        # Create a new ticket and verify all pool routing fields
        order_data = {
            "title": "TEST_Pool_Fields_Verification",
            "description": "Testing pool routing field storage",
            "category_l2_id": EDITING_SERVICES_L2_ID,
            "priority": "High"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=order_data,
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        order = response.json()
        
        # Verify all pool routing fields
        assert "pool_stage" in order, "pool_stage field should exist"
        assert "routing_specialty_id" in order, "routing_specialty_id field should exist"
        assert "routing_specialty_name" in order, "routing_specialty_name field should exist"
        assert "pool1_expires_at" in order, "pool1_expires_at field should exist"
        
        # Verify values
        assert order["pool_stage"] in ["POOL_1", "POOL_2"], f"Invalid pool_stage: {order['pool_stage']}"
        
        print(f"✅ Pool routing fields correctly stored:")
        print(f"   - pool_stage: {order['pool_stage']}")
        print(f"   - routing_specialty_id: {order['routing_specialty_id']}")
        print(f"   - routing_specialty_name: {order['routing_specialty_name']}")
        print(f"   - pool1_expires_at: {order['pool1_expires_at']}")
        
        # Fetch the order again to verify persistence
        get_response = requests.get(
            f"{BASE_URL}/api/orders/{order['id']}",
            headers=self.admin_headers
        )
        assert get_response.status_code == 200
        
        fetched_order = get_response.json()
        assert fetched_order["pool_stage"] == order["pool_stage"], "pool_stage not persisted correctly"
        assert fetched_order["routing_specialty_id"] == order["routing_specialty_id"], "routing_specialty_id not persisted"
        
        print(f"✅ Pool routing fields verified after GET - data persisted correctly")
    
    def test_10_draft_submission_triggers_pool_routing(self):
        """Submitting a draft triggers pool routing logic"""
        # Create a draft
        draft_data = {
            "title": "TEST_Draft_Pool_Routing",
            "description": "Testing draft submission pool routing",
            "category_l2_id": EDITING_SERVICES_L2_ID,
            "priority": "Normal",
            "is_draft": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=draft_data,
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Draft creation failed: {response.text}"
        
        draft = response.json()
        assert draft["status"] == "Draft", f"Expected Draft status, got {draft['status']}"
        assert draft["pool_stage"] is None, "Draft should not have pool_stage"
        
        print(f"✅ Draft created without pool routing: {draft['order_code']}")
        
        # Submit the draft
        submit_response = requests.post(
            f"{BASE_URL}/api/orders/{draft['id']}/submit",
            headers=self.admin_headers
        )
        assert submit_response.status_code == 200, f"Draft submission failed: {submit_response.text}"
        
        submitted = submit_response.json()
        assert submitted["status"] == "Open", f"Expected Open status, got {submitted['status']}"
        assert submitted["pool_stage"] == "POOL_1", f"Expected POOL_1, got {submitted.get('pool_stage')}"
        assert submitted["routing_specialty_name"] == "3D Artist"
        
        print(f"✅ Draft submitted and routed to POOL_1 correctly")


class TestPoolAccessControl:
    """Test Pool Access Control based on account type"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_11_admin_can_access_both_pools(self):
        """Admin can access both Pool 1 and Pool 2"""
        # Access Pool 1
        pool1_response = requests.get(
            f"{BASE_URL}/api/orders/pool/1",
            headers=self.admin_headers
        )
        assert pool1_response.status_code == 200, f"Admin Pool 1 access failed: {pool1_response.text}"
        
        # Access Pool 2
        pool2_response = requests.get(
            f"{BASE_URL}/api/orders/pool/2",
            headers=self.admin_headers
        )
        assert pool2_response.status_code == 200, f"Admin Pool 2 access failed: {pool2_response.text}"
        
        print(f"✅ Admin can access both pools - Pool 1: {len(pool1_response.json())} tickets, Pool 2: {len(pool2_response.json())} tickets")
    
    def test_12_standard_user_cannot_access_pools(self):
        """Standard user (Media Client) cannot access pool endpoints"""
        # Login as standard user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER_CREDS)
        if login_response.status_code != 200:
            pytest.skip("Standard user not available for testing")
        
        standard_token = login_response.json()["token"]
        standard_headers = {"Authorization": f"Bearer {standard_token}"}
        
        # Try to access Pool 1
        pool1_response = requests.get(
            f"{BASE_URL}/api/orders/pool/1",
            headers=standard_headers
        )
        assert pool1_response.status_code == 403, f"Expected 403 for Pool 1, got {pool1_response.status_code}"
        
        # Try to access Pool 2
        pool2_response = requests.get(
            f"{BASE_URL}/api/orders/pool/2",
            headers=standard_headers
        )
        assert pool2_response.status_code == 403, f"Expected 403 for Pool 2, got {pool2_response.status_code}"
        
        print(f"✅ Standard user correctly denied access to both pools (403)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
