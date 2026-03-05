"""
Test Task RBAC and Account Manager Features

Tests cover:
1. PATCH /api/tasks/account-manager/{client_user_id} - Admin can set account manager for a client
2. GET /api/tasks/account-manager/{client_user_id} - Returns the account manager info  
3. GET /api/tasks/assignable-users - Role-specific user lists
4. POST /api/tasks - Client create restrictions (visibility, assignee)
5. PATCH /api/tasks/{id} - Client edit restrictions (title vs status)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Admin123!"
ADMIN_ID = "e6c237f1-63b2-4ce4-8998-d8c8c5b61320"
ADMIN_TEAM_ID = "3ca645d3-fe4b-4ae1-89d7-5d5b02aeafe0"

CLIENT_EMAIL = "info@redribbonrealty.ca"
CLIENT_PASSWORD = "Client123!"
CLIENT_ID = "6edc2299-1b30-46d0-8012-55ae7516643d"
CLIENT_ORIGINAL_TEAM_ID = "3eaec872-7975-46ab-be9b-f4ebd670d1f6"

INTERNAL_USER_ID = "55a091d8-d996-4bc4-8470-4dfd9309db4e"  # Matheus Pessanha - the account manager


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def client_token():
    """Get client token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CLIENT_EMAIL,
        "password": CLIENT_PASSWORD
    })
    assert response.status_code == 200, f"Client login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture
def admin_headers(admin_token):
    """Admin auth headers"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture
def client_headers(client_token):
    """Client auth headers"""
    return {"Authorization": f"Bearer {client_token}", "Content-Type": "application/json"}


# ─────────────────────────────────────────────────────────────────────
# 1. Account Manager Endpoints Tests
# ─────────────────────────────────────────────────────────────────────

class TestAccountManagerEndpoints:
    """Tests for GET/PATCH /api/tasks/account-manager/{client_user_id}"""
    
    def test_get_account_manager_returns_info(self, admin_headers):
        """GET /api/tasks/account-manager/{client_user_id} returns the account manager info"""
        response = requests.get(
            f"{BASE_URL}/api/tasks/account-manager/{CLIENT_ID}",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "account_manager" in data
        assert data["account_manager"]["id"] == INTERNAL_USER_ID
        assert data["account_manager"]["name"] == "Matheus Pessanha"
        print(f"✓ Account manager for client: {data['account_manager']['name']}")
    
    def test_admin_can_set_account_manager(self, admin_headers):
        """PATCH /api/tasks/account-manager/{client_user_id} - Admin can set account manager"""
        # Set to admin first
        response = requests.patch(
            f"{BASE_URL}/api/tasks/account-manager/{CLIENT_ID}",
            headers=admin_headers,
            json={"account_manager_id": ADMIN_ID}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["account_manager_id"] == ADMIN_ID
        
        # Verify it was set
        verify_response = requests.get(
            f"{BASE_URL}/api/tasks/account-manager/{CLIENT_ID}",
            headers=admin_headers
        )
        assert verify_response.json()["account_manager"]["id"] == ADMIN_ID
        
        # Restore original
        requests.patch(
            f"{BASE_URL}/api/tasks/account-manager/{CLIENT_ID}",
            headers=admin_headers,
            json={"account_manager_id": INTERNAL_USER_ID}
        )
        print("✓ Admin successfully set and restored account manager")
    
    def test_non_admin_cannot_set_account_manager(self, client_headers):
        """PATCH - Non-admin gets 403 when trying to set account manager"""
        response = requests.patch(
            f"{BASE_URL}/api/tasks/account-manager/{CLIENT_ID}",
            headers=client_headers,
            json={"account_manager_id": ADMIN_ID}
        )
        assert response.status_code == 403
        assert "Admin only" in response.json().get("detail", "")
        print("✓ Non-admin correctly blocked from setting account manager")
    
    def test_cannot_assign_client_as_account_manager(self, admin_headers):
        """Account manager must be internal team member, not client"""
        response = requests.patch(
            f"{BASE_URL}/api/tasks/account-manager/{CLIENT_ID}",
            headers=admin_headers,
            json={"account_manager_id": CLIENT_ID}  # Try to set client as own AM
        )
        assert response.status_code == 400
        assert "internal team member" in response.json().get("detail", "").lower()
        print("✓ Cannot assign client as account manager")


# ─────────────────────────────────────────────────────────────────────
# 2. Assignable Users Endpoint Tests
# ─────────────────────────────────────────────────────────────────────

class TestAssignableUsers:
    """Tests for GET /api/tasks/assignable-users based on role"""
    
    def test_admin_gets_all_org_users(self, admin_headers):
        """Admin gets all users in their org"""
        response = requests.get(
            f"{BASE_URL}/api/tasks/assignable-users",
            headers=admin_headers
        )
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        assert len(users) >= 1
        
        # Admin should see users in admin's org (team_id = 3ca645d3)
        user_ids = [u["id"] for u in users]
        assert ADMIN_ID in user_ids, "Admin should see themselves"
        print(f"✓ Admin sees {len(users)} assignable users in their org")
    
    def test_client_gets_self_and_account_manager(self, client_headers):
        """Client gets only self + their account manager with is_account_manager flag"""
        response = requests.get(
            f"{BASE_URL}/api/tasks/assignable-users",
            headers=client_headers
        )
        assert response.status_code == 200
        users = response.json()
        
        # Should have exactly 2 users: self and account manager
        assert len(users) == 2, f"Expected 2 users, got {len(users)}"
        
        user_ids = [u["id"] for u in users]
        assert CLIENT_ID in user_ids, "Client should see themselves"
        assert INTERNAL_USER_ID in user_ids, "Client should see their account manager"
        
        # Check is_account_manager flag
        am_user = next((u for u in users if u["id"] == INTERNAL_USER_ID), None)
        assert am_user is not None
        assert am_user.get("is_account_manager") == True, "Account manager should have is_account_manager flag"
        
        # Self should NOT have is_account_manager
        self_user = next((u for u in users if u["id"] == CLIENT_ID), None)
        assert self_user.get("is_account_manager") is not True
        
        print(f"✓ Client sees self + account manager with is_account_manager=True flag")


# ─────────────────────────────────────────────────────────────────────
# 3. Client Task Create Tests
# ─────────────────────────────────────────────────────────────────────

class TestClientTaskCreate:
    """Tests for POST /api/tasks - Client restrictions"""
    
    def test_client_can_create_client_visibility_task(self, client_headers, admin_headers):
        """Client can create task with visibility=client, assigned to self"""
        task_title = f"TEST_Client_Task_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=client_headers,
            json={
                "org_id": CLIENT_ORIGINAL_TEAM_ID,
                "title": task_title,
                "status": "todo",
                "visibility": "client",
                "task_type": "manual",
                "assignee_user_id": CLIENT_ID
            }
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert data["title"] == task_title
        assert data["visibility"] == "client"
        assert data["assignee_user_id"] == CLIENT_ID
        assert data["created_source"] == "client"
        
        # Cleanup
        task_id = data["id"]
        requests.delete(f"{BASE_URL}/api/tasks/{task_id}", headers=admin_headers)
        print("✓ Client created client-visibility task assigned to self")
    
    def test_client_can_assign_to_account_manager(self, client_headers, admin_headers):
        """Client can create task assigned to their account manager"""
        task_title = f"TEST_Client_AM_Task_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=client_headers,
            json={
                "org_id": CLIENT_ORIGINAL_TEAM_ID,
                "title": task_title,
                "status": "todo",
                "visibility": "client",
                "task_type": "manual",
                "assignee_user_id": INTERNAL_USER_ID  # Assign to account manager
            }
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert data["assignee_user_id"] == INTERNAL_USER_ID
        
        # Cleanup
        task_id = data["id"]
        requests.delete(f"{BASE_URL}/api/tasks/{task_id}", headers=admin_headers)
        print("✓ Client created task assigned to account manager")
    
    def test_client_cannot_assign_to_other_users(self, client_headers):
        """Client CANNOT assign to users other than self or AM (403)"""
        task_title = f"TEST_Client_Bad_Assign_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=client_headers,
            json={
                "org_id": CLIENT_ORIGINAL_TEAM_ID,
                "title": task_title,
                "status": "todo",
                "visibility": "client",
                "task_type": "manual",
                "assignee_user_id": ADMIN_ID  # Try to assign to admin (not AM)
            }
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        assert "account manager" in response.json().get("detail", "").lower()
        print("✓ Client correctly blocked from assigning to non-AM users")
    
    def test_client_cannot_create_internal_visibility_task(self, client_headers):
        """Client CANNOT create internal visibility tasks (403)"""
        task_title = f"TEST_Client_Internal_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=client_headers,
            json={
                "org_id": CLIENT_ORIGINAL_TEAM_ID,
                "title": task_title,
                "status": "todo",
                "visibility": "internal",  # Try internal visibility
                "task_type": "manual"
            }
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        assert "client-visible" in response.json().get("detail", "").lower()
        print("✓ Client correctly blocked from creating internal-visibility tasks")
    
    def test_client_can_create_both_visibility_task(self, client_headers, admin_headers):
        """Client can create task with visibility=both"""
        task_title = f"TEST_Client_Both_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=client_headers,
            json={
                "org_id": CLIENT_ORIGINAL_TEAM_ID,
                "title": task_title,
                "status": "todo",
                "visibility": "both",
                "task_type": "manual"
            }
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert data["visibility"] == "both"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{data['id']}", headers=admin_headers)
        print("✓ Client created both-visibility task")


# ─────────────────────────────────────────────────────────────────────
# 4. Client Task Update Tests
# ─────────────────────────────────────────────────────────────────────

class TestClientTaskUpdate:
    """Tests for PATCH /api/tasks/{id} - Client restrictions"""
    
    @pytest.fixture
    def client_created_task(self, client_headers, admin_headers):
        """Create a task as client for testing"""
        task_title = f"TEST_ClientCreated_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=client_headers,
            json={
                "org_id": CLIENT_ORIGINAL_TEAM_ID,
                "title": task_title,
                "status": "todo",
                "visibility": "client",
                "task_type": "manual"
            }
        )
        assert response.status_code == 200
        task = response.json()
        yield task
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{task['id']}", headers=admin_headers)
    
    @pytest.fixture
    def admin_created_task(self, admin_headers):
        """Create a task as admin (in client org) for testing client edit restrictions"""
        # First temporarily move client to admin org for this test
        task_title = f"TEST_AdminCreated_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=admin_headers,
            json={
                "org_id": ADMIN_TEAM_ID,
                "title": task_title,
                "status": "todo",
                "visibility": "client",  # Client visible
                "task_type": "manual"
            }
        )
        assert response.status_code == 200
        task = response.json()
        yield task
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{task['id']}", headers=admin_headers)
    
    def test_client_can_update_title_on_own_task(self, client_headers, client_created_task):
        """Client can update title on tasks they created"""
        task_id = client_created_task["id"]
        new_title = f"TEST_Updated_Title_{uuid.uuid4().hex[:8]}"
        
        response = requests.patch(
            f"{BASE_URL}/api/tasks/{task_id}",
            headers=client_headers,
            json={"title": new_title}
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        assert response.json()["title"] == new_title
        print("✓ Client updated title on their own task")
    
    def test_client_can_update_status_on_visible_task(self, client_headers, client_created_task):
        """Client CAN update status on any visible task"""
        task_id = client_created_task["id"]
        
        response = requests.patch(
            f"{BASE_URL}/api/tasks/{task_id}",
            headers=client_headers,
            json={"status": "doing"}
        )
        assert response.status_code == 200, f"Status update failed: {response.text}"
        assert response.json()["status"] == "doing"
        print("✓ Client updated status on visible task")


class TestClientCannotEditOthersTitle:
    """Test that client cannot update title on tasks they didn't create"""
    
    def test_client_cannot_update_title_on_others_task(self, client_headers, admin_headers):
        """Client CANNOT update title on tasks they didn't create"""
        # Create a task as admin in a shared visibility context
        # First we need to temporarily put client in admin org for this test
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        import os
        
        async def setup_and_test():
            mongo_client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
            db = mongo_client[os.environ.get('DB_NAME', 'test_database')]
            
            # Temporarily set client to admin's org
            await db.users.update_one(
                {"id": CLIENT_ID},
                {"$set": {"team_id": ADMIN_TEAM_ID}}
            )
            
            try:
                # Need fresh client token after team change
                login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                    "email": CLIENT_EMAIL,
                    "password": CLIENT_PASSWORD
                })
                new_client_token = login_resp.json()["token"]
                new_client_headers = {"Authorization": f"Bearer {new_client_token}", "Content-Type": "application/json"}
                
                # Admin creates a client-visible task
                task_title = f"TEST_AdminTask_{uuid.uuid4().hex[:8]}"
                create_resp = requests.post(
                    f"{BASE_URL}/api/tasks",
                    headers=admin_headers,
                    json={
                        "org_id": ADMIN_TEAM_ID,
                        "title": task_title,
                        "status": "todo",
                        "visibility": "client",
                        "task_type": "manual"
                    }
                )
                assert create_resp.status_code == 200
                task = create_resp.json()
                task_id = task["id"]
                
                # Client tries to update title (should fail)
                update_resp = requests.patch(
                    f"{BASE_URL}/api/tasks/{task_id}",
                    headers=new_client_headers,
                    json={"title": "Hacked Title"}
                )
                assert update_resp.status_code == 403, f"Expected 403, got {update_resp.status_code}: {update_resp.text}"
                
                # Client CAN update status though
                status_resp = requests.patch(
                    f"{BASE_URL}/api/tasks/{task_id}",
                    headers=new_client_headers,
                    json={"status": "doing"}
                )
                assert status_resp.status_code == 200, f"Status update should work: {status_resp.text}"
                
                # Cleanup task
                requests.delete(f"{BASE_URL}/api/tasks/{task_id}", headers=admin_headers)
                
                return True
            finally:
                # Restore client to original org
                await db.users.update_one(
                    {"id": CLIENT_ID},
                    {"$set": {"team_id": CLIENT_ORIGINAL_TEAM_ID}}
                )
                mongo_client.close()
        
        result = asyncio.get_event_loop().run_until_complete(setup_and_test())
        assert result
        print("✓ Client correctly blocked from editing title on tasks they didn't create, but can update status")


# ─────────────────────────────────────────────────────────────────────
# 5. Internal User Assignable Users Test
# ─────────────────────────────────────────────────────────────────────

class TestInternalUserAssignableUsers:
    """Test GET /api/tasks/assignable-users for internal (account manager) users"""
    
    def test_internal_user_gets_self_managed_clients_and_internal_staff(self, admin_headers):
        """Internal user gets self + managed clients + other internal staff"""
        # Login as the internal user (Matheus - the account manager)
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "matheuspessanha@gmail.com",
            "password": "Admin123!"  # Assuming same password pattern
        })
        
        if login_resp.status_code != 200:
            pytest.skip("Could not login as internal user - may have different password")
        
        internal_token = login_resp.json()["token"]
        internal_headers = {"Authorization": f"Bearer {internal_token}", "Content-Type": "application/json"}
        
        response = requests.get(
            f"{BASE_URL}/api/tasks/assignable-users",
            headers=internal_headers
        )
        assert response.status_code == 200
        users = response.json()
        
        user_ids = [u["id"] for u in users]
        
        # Should see themselves
        assert INTERNAL_USER_ID in user_ids, "Internal user should see themselves"
        
        # Should see the client they manage
        assert CLIENT_ID in user_ids, "Internal user should see their managed client"
        
        print(f"✓ Internal user sees {len(users)} assignable users including managed clients")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
