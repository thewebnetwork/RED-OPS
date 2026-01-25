"""
Test P0 Features for Service Hub Platform:
1. Requester Visibility: Requesters must see who a ticket is 'Assigned To'
2. Ticket Timestamps: Ticket details must show 'Created' and 'Last Modified' timestamps
3. Requester-side Close: Requesters must be able to close their own tickets with a reason
4. Label Change: The label 'Editor' should be changed to 'Assigned to:' on order/ticket summaries
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"
REQUESTER_EMAIL = "testrequester@test.com"
REQUESTER_PASSWORD = "Test123!"


class TestP0Features:
    """Test P0 features for Service Hub Platform"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login(self, email, password):
        """Login and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            token = response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            return response.json()
        return None
    
    # ============== P0-1: Assigned To Visibility ==============
    
    def test_my_requests_includes_assigned_to_name(self):
        """P0-1: Verify my-requests endpoint includes assigned_to_name field"""
        login_result = self.login(REQUESTER_EMAIL, REQUESTER_PASSWORD)
        assert login_result is not None, "Requester login failed"
        
        response = self.session.get(f"{BASE_URL}/api/my-requests")
        assert response.status_code == 200, f"my-requests failed: {response.text}"
        
        requests_list = response.json()
        assert isinstance(requests_list, list), "Response should be a list"
        
        # Check that assigned_to_name field exists in response schema
        if len(requests_list) > 0:
            first_request = requests_list[0]
            assert "assigned_to_name" in first_request, "assigned_to_name field missing from my-requests response"
            print(f"✓ assigned_to_name field present in my-requests response")
            
            # Find a request with an assigned editor
            assigned_requests = [r for r in requests_list if r.get("assigned_to_name")]
            if assigned_requests:
                print(f"✓ Found {len(assigned_requests)} requests with assigned_to_name populated")
                print(f"  Example: {assigned_requests[0]['code']} assigned to {assigned_requests[0]['assigned_to_name']}")
            else:
                print("  Note: No requests currently have an assigned editor")
    
    def test_order_detail_includes_editor_name(self):
        """P0-1: Verify order detail endpoint includes editor_name field"""
        login_result = self.login(REQUESTER_EMAIL, REQUESTER_PASSWORD)
        assert login_result is not None, "Requester login failed"
        
        # Get my requests first
        response = self.session.get(f"{BASE_URL}/api/my-requests")
        assert response.status_code == 200
        
        requests_list = response.json()
        editing_requests = [r for r in requests_list if r.get("request_type") == "Editing"]
        
        if editing_requests:
            order_id = editing_requests[0]["id"]
            response = self.session.get(f"{BASE_URL}/api/orders/{order_id}")
            assert response.status_code == 200, f"Get order failed: {response.text}"
            
            order = response.json()
            assert "editor_name" in order, "editor_name field missing from order detail"
            assert "editor_id" in order, "editor_id field missing from order detail"
            print(f"✓ Order detail includes editor_name: {order.get('editor_name')}")
        else:
            pytest.skip("No editing requests found for requester")
    
    # ============== P0-2: Timestamps ==============
    
    def test_order_detail_includes_timestamps(self):
        """P0-2: Verify order detail includes created_at and updated_at timestamps"""
        login_result = self.login(REQUESTER_EMAIL, REQUESTER_PASSWORD)
        assert login_result is not None, "Requester login failed"
        
        response = self.session.get(f"{BASE_URL}/api/my-requests")
        assert response.status_code == 200
        
        requests_list = response.json()
        editing_requests = [r for r in requests_list if r.get("request_type") == "Editing"]
        
        if editing_requests:
            order_id = editing_requests[0]["id"]
            response = self.session.get(f"{BASE_URL}/api/orders/{order_id}")
            assert response.status_code == 200
            
            order = response.json()
            
            # Check created_at
            assert "created_at" in order, "created_at field missing"
            assert order["created_at"] is not None, "created_at should not be null"
            print(f"✓ created_at present: {order['created_at']}")
            
            # Check updated_at
            assert "updated_at" in order, "updated_at field missing"
            assert order["updated_at"] is not None, "updated_at should not be null"
            print(f"✓ updated_at present: {order['updated_at']}")
            
            # Check picked_at (optional)
            if "picked_at" in order:
                print(f"✓ picked_at present: {order.get('picked_at')}")
            
            # Check delivered_at (optional)
            if "delivered_at" in order:
                print(f"✓ delivered_at present: {order.get('delivered_at')}")
        else:
            pytest.skip("No editing requests found for requester")
    
    # ============== P0-3: Requester Close Ticket ==============
    
    def test_close_order_endpoint_exists(self):
        """P0-3: Verify close order endpoint exists"""
        login_result = self.login(REQUESTER_EMAIL, REQUESTER_PASSWORD)
        assert login_result is not None, "Requester login failed"
        
        # Get an open order to test with
        response = self.session.get(f"{BASE_URL}/api/my-requests")
        assert response.status_code == 200
        
        requests_list = response.json()
        # Find an open editing request
        open_requests = [r for r in requests_list if r.get("request_type") == "Editing" and r.get("status") not in ["Closed", "Delivered"]]
        
        if open_requests:
            order_id = open_requests[0]["id"]
            # Test that endpoint accepts POST with reason
            response = self.session.post(f"{BASE_URL}/api/orders/{order_id}/close", json={
                "reason": "TEST_CLOSE_REASON - Testing close functionality"
            })
            
            # Should succeed (200) or fail with validation error (400/403), not 404/405
            assert response.status_code in [200, 400, 403], f"Close endpoint returned unexpected status: {response.status_code} - {response.text}"
            
            if response.status_code == 200:
                print(f"✓ Close endpoint works - order {open_requests[0]['code']} closed successfully")
            else:
                print(f"✓ Close endpoint exists but returned {response.status_code}: {response.text}")
        else:
            # Test with a known order ID to verify endpoint exists
            response = self.session.post(f"{BASE_URL}/api/orders/nonexistent-id/close", json={
                "reason": "Test reason"
            })
            # Should return 404 (not found) not 405 (method not allowed)
            assert response.status_code == 404, f"Close endpoint should return 404 for nonexistent order, got {response.status_code}"
            print("✓ Close endpoint exists (returns 404 for nonexistent order)")
    
    def test_close_order_requires_reason(self):
        """P0-3: Verify close order requires a reason"""
        login_result = self.login(REQUESTER_EMAIL, REQUESTER_PASSWORD)
        assert login_result is not None, "Requester login failed"
        
        response = self.session.get(f"{BASE_URL}/api/my-requests")
        assert response.status_code == 200
        
        requests_list = response.json()
        open_requests = [r for r in requests_list if r.get("request_type") == "Editing" and r.get("status") not in ["Closed", "Delivered"]]
        
        if open_requests:
            order_id = open_requests[0]["id"]
            
            # Test without reason
            response = self.session.post(f"{BASE_URL}/api/orders/{order_id}/close", json={})
            assert response.status_code == 422, f"Should require reason field, got {response.status_code}"
            print("✓ Close endpoint requires reason field")
            
            # Test with empty reason
            response = self.session.post(f"{BASE_URL}/api/orders/{order_id}/close", json={"reason": ""})
            assert response.status_code == 422, f"Should reject empty reason, got {response.status_code}"
            print("✓ Close endpoint rejects empty reason")
        else:
            pytest.skip("No open editing requests found for requester")
    
    def test_closed_order_has_closed_at_and_reason(self):
        """P0-3: Verify closed order shows closed_at timestamp and close_reason"""
        login_result = self.login(REQUESTER_EMAIL, REQUESTER_PASSWORD)
        assert login_result is not None, "Requester login failed"
        
        response = self.session.get(f"{BASE_URL}/api/my-requests")
        assert response.status_code == 200
        
        requests_list = response.json()
        # Find a closed editing request
        closed_requests = [r for r in requests_list if r.get("request_type") == "Editing" and r.get("status") == "Closed"]
        
        if closed_requests:
            order_id = closed_requests[0]["id"]
            response = self.session.get(f"{BASE_URL}/api/orders/{order_id}")
            assert response.status_code == 200
            
            order = response.json()
            
            # Check closed_at
            assert "closed_at" in order, "closed_at field missing from closed order"
            print(f"✓ closed_at present: {order.get('closed_at')}")
            
            # Check close_reason
            assert "close_reason" in order, "close_reason field missing from closed order"
            print(f"✓ close_reason present: {order.get('close_reason')}")
        else:
            # Use the known closed order from test context
            known_closed_order_id = "a53513f9-980a-4b4f-babd-2be40252674d"
            response = self.session.get(f"{BASE_URL}/api/orders/{known_closed_order_id}")
            
            if response.status_code == 200:
                order = response.json()
                assert "closed_at" in order, "closed_at field missing"
                assert "close_reason" in order, "close_reason field missing"
                print(f"✓ Closed order has closed_at: {order.get('closed_at')}")
                print(f"✓ Closed order has close_reason: {order.get('close_reason')}")
            else:
                pytest.skip("No closed orders found and known order not accessible")
    
    def test_cannot_close_already_closed_order(self):
        """P0-3: Verify cannot close an already closed order"""
        login_result = self.login(REQUESTER_EMAIL, REQUESTER_PASSWORD)
        assert login_result is not None, "Requester login failed"
        
        # Use the known closed order
        known_closed_order_id = "a53513f9-980a-4b4f-babd-2be40252674d"
        
        response = self.session.post(f"{BASE_URL}/api/orders/{known_closed_order_id}/close", json={
            "reason": "Trying to close again"
        })
        
        # Should return 400 (already closed) or 403 (not owner)
        assert response.status_code in [400, 403], f"Should reject closing already closed order, got {response.status_code}"
        print(f"✓ Cannot close already closed order - returned {response.status_code}")
    
    # ============== P0-4: Label Change (Backend Schema) ==============
    
    def test_order_response_schema_has_editor_name(self):
        """P0-4: Verify OrderResponse schema uses editor_name (not just 'Editor')"""
        login_result = self.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert login_result is not None, "Admin login failed"
        
        response = self.session.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 200
        
        orders = response.json()
        if orders:
            order = orders[0]
            # Verify the field is named editor_name (for "Assigned to" display)
            assert "editor_name" in order, "editor_name field should exist in order response"
            print(f"✓ Order response includes editor_name field")
        else:
            pytest.skip("No orders found")
    
    def test_unified_request_response_has_assigned_to_name(self):
        """P0-4: Verify UnifiedRequestResponse uses assigned_to_name field"""
        login_result = self.login(REQUESTER_EMAIL, REQUESTER_PASSWORD)
        assert login_result is not None, "Requester login failed"
        
        response = self.session.get(f"{BASE_URL}/api/my-requests")
        assert response.status_code == 200
        
        requests_list = response.json()
        if requests_list:
            first_request = requests_list[0]
            # Verify the field is named assigned_to_name (for "Assigned to" display)
            assert "assigned_to_name" in first_request, "assigned_to_name field should exist in unified request response"
            print(f"✓ Unified request response includes assigned_to_name field")
        else:
            pytest.skip("No requests found")


class TestCloseOrderFlow:
    """Test the complete close order flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login(self, email, password):
        """Login and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            token = response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            return response.json()
        return None
    
    def test_create_and_close_order_flow(self):
        """Test creating a new order and closing it as requester"""
        # Login as requester
        login_result = self.login(REQUESTER_EMAIL, REQUESTER_PASSWORD)
        assert login_result is not None, "Requester login failed"
        
        # Create a new order
        create_response = self.session.post(f"{BASE_URL}/api/orders", json={
            "title": "TEST_P0_Close_Test_Order",
            "description": "This order is created to test the close functionality",
            "priority": "Normal"
        })
        
        assert create_response.status_code == 200, f"Create order failed: {create_response.text}"
        order = create_response.json()
        order_id = order["id"]
        order_code = order["order_code"]
        print(f"✓ Created test order: {order_code}")
        
        # Verify order is Open
        assert order["status"] == "Open", f"New order should be Open, got {order['status']}"
        
        # Close the order
        close_response = self.session.post(f"{BASE_URL}/api/orders/{order_id}/close", json={
            "reason": "TEST_P0_CLOSE - Testing close functionality from pytest"
        })
        
        assert close_response.status_code == 200, f"Close order failed: {close_response.text}"
        print(f"✓ Closed order: {order_code}")
        
        # Verify order is now Closed with reason and timestamp
        get_response = self.session.get(f"{BASE_URL}/api/orders/{order_id}")
        assert get_response.status_code == 200
        
        closed_order = get_response.json()
        assert closed_order["status"] == "Closed", f"Order should be Closed, got {closed_order['status']}"
        assert closed_order["close_reason"] == "TEST_P0_CLOSE - Testing close functionality from pytest"
        assert closed_order["closed_at"] is not None, "closed_at should be set"
        
        print(f"✓ Order status: {closed_order['status']}")
        print(f"✓ Close reason: {closed_order['close_reason']}")
        print(f"✓ Closed at: {closed_order['closed_at']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
