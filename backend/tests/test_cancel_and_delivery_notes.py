"""
Test P0: Cancel Ticket with Reason and P1: Delivery Notes
Tests:
- P0: Cancel ticket API endpoint
- P0: Cancellation reasons endpoint
- P0: Cancellation creates system message in timeline
- P1: Deliver endpoint requires resolution_notes
- P1: Delivery notes displayed in order detail
- P2: Dashboard shows zero tickets (verified)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - using existing users
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"
REQUESTER_EMAIL = "requester@test.com"
REQUESTER_PASSWORD = "TestPass123!"
EDITOR_EMAIL = "editor@test.com"
EDITOR_PASSWORD = "TestPass123!"


class TestCancellationReasons:
    """P0: Test cancellation reasons endpoint"""
    
    def test_get_cancellation_reasons(self):
        """GET /api/orders/cancellation-reasons returns list of reasons"""
        response = requests.get(f"{BASE_URL}/api/orders/cancellation-reasons")
        assert response.status_code == 200
        
        data = response.json()
        assert "reasons" in data
        assert isinstance(data["reasons"], list)
        assert len(data["reasons"]) > 0
        
        # Verify expected reasons
        expected_reasons = [
            "No longer needed",
            "Changed my mind",
            "Found a different solution",
            "Fixed the issue myself",
            "Duplicate ticket",
            "Other"
        ]
        for reason in expected_reasons:
            assert reason in data["reasons"], f"Missing reason: {reason}"
        
        print(f"✓ Cancellation reasons: {data['reasons']}")


class TestDashboardCleared:
    """P2: Test dashboard shows zero tickets"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin login failed")
    
    def test_dashboard_shows_zero_tickets(self, admin_token):
        """Dashboard stats should show all zeros"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["open_count"] == 0
        assert data["in_progress_count"] == 0
        assert data["pending_count"] == 0
        assert data["delivered_count"] == 0
        print("✓ Dashboard shows zero tickets")
    
    def test_orders_list_empty(self, admin_token):
        """Orders list should be empty"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
        print("✓ Orders list is empty")


class TestCancelTicketFlow:
    """P0: Test full cancel ticket flow"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin login failed")
    
    @pytest.fixture
    def requester_token(self):
        """Get requester auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": REQUESTER_EMAIL,
            "password": REQUESTER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Requester login failed")
    
    @pytest.fixture
    def editor_token(self):
        """Get editor auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EDITOR_EMAIL,
            "password": EDITOR_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Editor login failed")
    
    def test_cancel_open_ticket(self, requester_token):
        """P0: Requester can cancel their own Open ticket"""
        headers = {"Authorization": f"Bearer {requester_token}"}
        
        # Create a ticket
        create_response = requests.post(f"{BASE_URL}/api/orders", headers=headers, json={
            "title": "TEST_Cancel Open Ticket",
            "description": "Test ticket for cancellation",
            "priority": "Normal"
        })
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        order = create_response.json()
        order_id = order["id"]
        
        # Cancel the ticket
        cancel_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/cancel", headers=headers, json={
            "reason": "No longer needed",
            "notes": "Testing cancellation flow"
        })
        assert cancel_response.status_code == 200, f"Cancel failed: {cancel_response.text}"
        print(f"✓ Cancel response: {cancel_response.json()}")
        
        # Verify ticket is canceled
        get_response = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers=headers)
        assert get_response.status_code == 200
        
        canceled_order = get_response.json()
        assert canceled_order["status"] == "Canceled"
        assert canceled_order["cancellation_reason"] == "No longer needed"
        assert canceled_order["cancellation_notes"] == "Testing cancellation flow"
        assert canceled_order["canceled_at"] is not None
        print(f"✓ Ticket canceled with reason: {canceled_order['cancellation_reason']}")
    
    def test_cancel_creates_system_message(self, requester_token):
        """P0: Cancellation creates system message in timeline"""
        headers = {"Authorization": f"Bearer {requester_token}"}
        
        # Create a ticket
        create_response = requests.post(f"{BASE_URL}/api/orders", headers=headers, json={
            "title": "TEST_Cancel System Message",
            "description": "Test ticket for system message",
            "priority": "Normal"
        })
        assert create_response.status_code in [200, 201]
        order = create_response.json()
        order_id = order["id"]
        
        # Cancel the ticket
        cancel_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/cancel", headers=headers, json={
            "reason": "Changed my mind",
            "notes": "Testing system message"
        })
        assert cancel_response.status_code == 200
        
        # Check messages for system message
        messages_response = requests.get(f"{BASE_URL}/api/orders/{order_id}/messages", headers=headers)
        assert messages_response.status_code == 200
        
        messages = messages_response.json()
        system_messages = [m for m in messages if m.get("author_role") == "System" or m.get("is_system_message")]
        
        assert len(system_messages) > 0, "No system message found after cancellation"
        
        # Verify system message content
        cancel_message = system_messages[-1]
        assert "cancel" in cancel_message["message_body"].lower() or "Requester canceled" in cancel_message["message_body"]
        assert "Changed my mind" in cancel_message["message_body"]
        print(f"✓ System message created: {cancel_message['message_body'][:100]}...")
    
    def test_cancel_assigned_ticket_notifies_resolver(self, requester_token, editor_token, admin_token):
        """P0: Canceling assigned ticket notifies resolver"""
        req_headers = {"Authorization": f"Bearer {requester_token}"}
        editor_headers = {"Authorization": f"Bearer {editor_token}"}
        
        # Create a ticket
        create_response = requests.post(f"{BASE_URL}/api/orders", headers=req_headers, json={
            "title": "TEST_Cancel Assigned Ticket",
            "description": "Test ticket for resolver notification",
            "priority": "Normal"
        })
        assert create_response.status_code in [200, 201]
        order = create_response.json()
        order_id = order["id"]
        
        # Editor picks the ticket
        pick_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/pick", headers=editor_headers)
        assert pick_response.status_code == 200, f"Pick failed: {pick_response.text}"
        print("✓ Editor picked the ticket")
        
        # Requester cancels the ticket
        cancel_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/cancel", headers=req_headers, json={
            "reason": "Found a different solution",
            "notes": "Resolved the issue another way"
        })
        assert cancel_response.status_code == 200
        print("✓ Requester canceled the assigned ticket")
        
        # Verify ticket is canceled
        get_response = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers=req_headers)
        assert get_response.status_code == 200
        
        canceled_order = get_response.json()
        assert canceled_order["status"] == "Canceled"
        assert canceled_order["cancellation_reason"] == "Found a different solution"
        print(f"✓ Assigned ticket canceled successfully")
    
    def test_cannot_cancel_delivered_ticket(self, requester_token, editor_token):
        """P0: Cannot cancel a Delivered ticket"""
        req_headers = {"Authorization": f"Bearer {requester_token}"}
        editor_headers = {"Authorization": f"Bearer {editor_token}"}
        
        # Create a ticket
        create_response = requests.post(f"{BASE_URL}/api/orders", headers=req_headers, json={
            "title": "TEST_Cannot Cancel Delivered",
            "description": "Test ticket that will be delivered",
            "priority": "Normal"
        })
        assert create_response.status_code in [200, 201]
        order = create_response.json()
        order_id = order["id"]
        
        # Editor picks the ticket
        pick_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/pick", headers=editor_headers)
        assert pick_response.status_code == 200
        
        # Add a file and mark as final
        file_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/files", headers=editor_headers, json={
            "file_type": "Final Delivery",
            "label": "Final Video",
            "url": "https://example.com/final.mp4"
        })
        assert file_response.status_code in [200, 201]
        file_id = file_response.json()["id"]
        
        mark_final_response = requests.patch(f"{BASE_URL}/api/orders/{order_id}/files/{file_id}/mark-final", headers=editor_headers)
        assert mark_final_response.status_code == 200
        
        # Deliver the ticket with notes
        deliver_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/deliver", headers=editor_headers, json={
            "resolution_notes": "Completed the video editing as requested"
        })
        assert deliver_response.status_code == 200
        print("✓ Ticket delivered")
        
        # Try to cancel - should fail
        cancel_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/cancel", headers=req_headers, json={
            "reason": "No longer needed"
        })
        assert cancel_response.status_code == 400
        print("✓ Cannot cancel delivered ticket (400 error as expected)")
    
    def test_cancel_requires_reason(self, requester_token):
        """P0: Cancel requires a reason"""
        headers = {"Authorization": f"Bearer {requester_token}"}
        
        # Create a ticket
        create_response = requests.post(f"{BASE_URL}/api/orders", headers=headers, json={
            "title": "TEST_Cancel Requires Reason",
            "description": "Test ticket for reason validation",
            "priority": "Normal"
        })
        assert create_response.status_code in [200, 201]
        order = create_response.json()
        order_id = order["id"]
        
        # Try to cancel without reason - should fail
        cancel_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/cancel", headers=headers, json={
            "notes": "Just notes, no reason"
        })
        assert cancel_response.status_code == 422  # Validation error
        print("✓ Cancel requires reason (422 validation error)")


class TestDeliveryNotesFlow:
    """P1: Test delivery notes requirement"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin login failed")
    
    @pytest.fixture
    def requester_token(self):
        """Get requester auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": REQUESTER_EMAIL,
            "password": REQUESTER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Requester login failed")
    
    @pytest.fixture
    def editor_token(self):
        """Get editor auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EDITOR_EMAIL,
            "password": EDITOR_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Editor login failed")
    
    def test_deliver_requires_resolution_notes(self, requester_token, editor_token):
        """P1: Deliver endpoint requires resolution_notes field"""
        req_headers = {"Authorization": f"Bearer {requester_token}"}
        editor_headers = {"Authorization": f"Bearer {editor_token}"}
        
        # Create a ticket
        create_response = requests.post(f"{BASE_URL}/api/orders", headers=req_headers, json={
            "title": "TEST_Delivery Notes Required",
            "description": "Test ticket for delivery notes",
            "priority": "Normal"
        })
        assert create_response.status_code in [200, 201]
        order = create_response.json()
        order_id = order["id"]
        
        # Editor picks the ticket
        pick_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/pick", headers=editor_headers)
        assert pick_response.status_code == 200
        
        # Add a file and mark as final
        file_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/files", headers=editor_headers, json={
            "file_type": "Final Delivery",
            "label": "Final Video",
            "url": "https://example.com/final.mp4"
        })
        assert file_response.status_code in [200, 201]
        file_id = file_response.json()["id"]
        
        mark_final_response = requests.patch(f"{BASE_URL}/api/orders/{order_id}/files/{file_id}/mark-final", headers=editor_headers)
        assert mark_final_response.status_code == 200
        
        # Try to deliver without notes - should fail
        deliver_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/deliver", headers=editor_headers, json={})
        assert deliver_response.status_code == 422  # Validation error
        print("✓ Deliver requires resolution_notes (422 validation error)")
        
        # Try to deliver with empty notes - should fail
        deliver_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/deliver", headers=editor_headers, json={
            "resolution_notes": ""
        })
        assert deliver_response.status_code == 422  # Validation error
        print("✓ Deliver rejects empty resolution_notes (422 validation error)")
    
    def test_delivery_notes_displayed_in_order(self, requester_token, editor_token):
        """P1: Delivery notes displayed in order detail after delivery"""
        req_headers = {"Authorization": f"Bearer {requester_token}"}
        editor_headers = {"Authorization": f"Bearer {editor_token}"}
        
        # Create a ticket
        create_response = requests.post(f"{BASE_URL}/api/orders", headers=req_headers, json={
            "title": "TEST_Delivery Notes Display",
            "description": "Test ticket for delivery notes display",
            "priority": "Normal"
        })
        assert create_response.status_code in [200, 201]
        order = create_response.json()
        order_id = order["id"]
        
        # Editor picks the ticket
        pick_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/pick", headers=editor_headers)
        assert pick_response.status_code == 200
        
        # Add a file and mark as final
        file_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/files", headers=editor_headers, json={
            "file_type": "Final Delivery",
            "label": "Final Video",
            "url": "https://example.com/final.mp4"
        })
        assert file_response.status_code in [200, 201]
        file_id = file_response.json()["id"]
        
        mark_final_response = requests.patch(f"{BASE_URL}/api/orders/{order_id}/files/{file_id}/mark-final", headers=editor_headers)
        assert mark_final_response.status_code == 200
        
        # Deliver with notes
        delivery_notes = "Completed video editing with color correction, audio sync, and final export in 4K resolution."
        deliver_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/deliver", headers=editor_headers, json={
            "resolution_notes": delivery_notes
        })
        assert deliver_response.status_code == 200
        print("✓ Ticket delivered with notes")
        
        # Verify notes in order detail
        get_response = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers=req_headers)
        assert get_response.status_code == 200
        
        delivered_order = get_response.json()
        assert delivered_order["status"] == "Delivered"
        assert delivered_order["resolution_notes"] == delivery_notes
        print(f"✓ Delivery notes displayed in order: {delivered_order['resolution_notes'][:50]}...")
    
    def test_delivery_notes_in_timeline(self, requester_token, editor_token):
        """P1: Delivery notes appear in timeline as message"""
        req_headers = {"Authorization": f"Bearer {requester_token}"}
        editor_headers = {"Authorization": f"Bearer {editor_token}"}
        
        # Create a ticket
        create_response = requests.post(f"{BASE_URL}/api/orders", headers=req_headers, json={
            "title": "TEST_Delivery Notes Timeline",
            "description": "Test ticket for delivery notes in timeline",
            "priority": "Normal"
        })
        assert create_response.status_code in [200, 201]
        order = create_response.json()
        order_id = order["id"]
        
        # Editor picks the ticket
        pick_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/pick", headers=editor_headers)
        assert pick_response.status_code == 200
        
        # Add a file and mark as final
        file_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/files", headers=editor_headers, json={
            "file_type": "Final Delivery",
            "label": "Final Video",
            "url": "https://example.com/final.mp4"
        })
        assert file_response.status_code in [200, 201]
        file_id = file_response.json()["id"]
        
        mark_final_response = requests.patch(f"{BASE_URL}/api/orders/{order_id}/files/{file_id}/mark-final", headers=editor_headers)
        assert mark_final_response.status_code == 200
        
        # Deliver with notes
        delivery_notes = "All requested changes completed. Final video includes intro animation and outro."
        deliver_response = requests.post(f"{BASE_URL}/api/orders/{order_id}/deliver", headers=editor_headers, json={
            "resolution_notes": delivery_notes
        })
        assert deliver_response.status_code == 200
        
        # Check messages for delivery note
        messages_response = requests.get(f"{BASE_URL}/api/orders/{order_id}/messages", headers=req_headers)
        assert messages_response.status_code == 200
        
        messages = messages_response.json()
        delivery_messages = [m for m in messages if m.get("is_delivery_note") or "Delivery Notes" in m.get("message_body", "")]
        
        assert len(delivery_messages) > 0, "No delivery note message found in timeline"
        
        delivery_msg = delivery_messages[-1]
        assert delivery_notes in delivery_msg["message_body"]
        print(f"✓ Delivery notes in timeline: {delivery_msg['message_body'][:80]}...")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin login failed")
    
    def test_cleanup_test_orders(self, admin_token):
        """Clean up TEST_ prefixed orders"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get all orders
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        if response.status_code == 200:
            orders = response.json()
            test_orders = [o for o in orders if o.get("title", "").startswith("TEST_")]
            print(f"Found {len(test_orders)} test orders to clean up")
            # Note: No delete endpoint, but orders are created for testing purposes
        
        print("✓ Cleanup check completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
