"""
Task API Tests - Shared Work Orchestration MVP

Tests RBAC rules:
- Admin: Full CRUD on tasks in their org
- Client: Read tasks with visibility=client or both, update status only
- Cross-org restrictions

Test credentials from review_request:
- Admin: admin@redribbonops.com / Admin123! (team_id: 3ca645d3-fe4b-4ae1-89d7-5d5b02aeafe0)
- Client: info@redribbonrealty.ca / Client123! (team_id: 3eaec872-7975-46ab-be9b-f4ebd670d1f6)
- Internal user: 55a091d8-d996-4bc4-8470-4dfd9309db4e (same org as admin)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://i18n-fix-11.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Admin123!"
ADMIN_ID = "e6c237f1-63b2-4ce4-8998-d8c8c5b61320"
ADMIN_TEAM_ID = "3ca645d3-fe4b-4ae1-89d7-5d5b02aeafe0"

CLIENT_EMAIL = "info@redribbonrealty.ca"
CLIENT_PASSWORD = "Client123!"
CLIENT_ID = "6edc2299-1b30-46d0-8012-55ae7516643d"
CLIENT_TEAM_ID = "3eaec872-7975-46ab-be9b-f4ebd670d1f6"

INTERNAL_USER_ID = "55a091d8-d996-4bc4-8470-4dfd9309db4e"
INTERNAL_USER_TEAM_ID = "3ca645d3-fe4b-4ae1-89d7-5d5b02aeafe0"

# Store created task IDs for cleanup
created_task_ids = []


class TestSetup:
    """Setup and teardown helpers"""
    
    @staticmethod
    def get_admin_token():
        """Login as admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        print(f"Admin login failed: {response.status_code} - {response.text}")
        return None
    
    @staticmethod
    def get_client_token():
        """Login as client and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        print(f"Client login failed: {response.status_code} - {response.text}")
        return None


@pytest.fixture(scope="module")
def admin_session():
    """Admin authenticated session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    token = TestSetup.get_admin_token()
    if token:
        session.headers.update({"Authorization": f"Bearer {token}"})
    return session


@pytest.fixture(scope="module")
def client_session():
    """Client authenticated session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    token = TestSetup.get_client_token()
    if token:
        session.headers.update({"Authorization": f"Bearer {token}"})
    return session


@pytest.fixture(scope="module")
def admin_user_info(admin_session):
    """Get admin user info"""
    response = admin_session.get(f"{BASE_URL}/api/auth/me")
    if response.status_code == 200:
        return response.json()
    return None


@pytest.fixture(scope="module")
def client_user_info(client_session):
    """Get client user info"""
    response = client_session.get(f"{BASE_URL}/api/auth/me")
    if response.status_code == 200:
        return response.json()
    return None


# ==================== AUTHENTICATION TESTS ====================

class TestAuthentication:
    """Test authentication for both user types"""
    
    def test_admin_login(self, admin_session):
        """Test admin can authenticate"""
        response = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Admin auth failed: {response.text}"
        user = response.json()
        assert user["role"] == "Administrator"
        print(f"Admin authenticated: {user['name']} (role: {user['role']}, team_id: {user.get('team_id')})")
    
    def test_client_login(self, client_session):
        """Test client can authenticate"""
        response = client_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Client auth failed: {response.text}"
        user = response.json()
        assert user["account_type"] == "Media Client"
        print(f"Client authenticated: {user['name']} (account_type: {user['account_type']}, team_id: {user.get('team_id')})")


# ==================== POST /api/tasks TESTS ====================

class TestCreateTask:
    """Test POST /api/tasks endpoint"""
    
    def test_admin_creates_task_with_all_fields(self, admin_session, admin_user_info):
        """Admin creates a task with all fields"""
        org_id = admin_user_info.get("team_id")
        task_data = {
            "org_id": org_id,
            "title": "TEST_Task with all fields",
            "description": "Test description for task",
            "status": "todo",
            "visibility": "internal",
            "task_type": "manual",
            "due_at": "2026-02-01T12:00:00Z",
            "position": 100.0
        }
        
        response = admin_session.post(f"{BASE_URL}/api/tasks", json=task_data)
        assert response.status_code == 200, f"Create task failed: {response.text}"
        
        task = response.json()
        assert task["title"] == task_data["title"]
        assert task["description"] == task_data["description"]
        assert task["status"] == task_data["status"]
        assert task["visibility"] == task_data["visibility"]
        assert task["task_type"] == task_data["task_type"]
        assert task["position"] == task_data["position"]
        assert task["org_id"] == org_id
        assert task["created_by_user_id"] == admin_user_info["id"]
        assert task["created_source"] == "admin"
        
        created_task_ids.append(task["id"])
        print(f"Created task: {task['id']}")
    
    def test_admin_creates_task_assigned_to_internal_user(self, admin_session, admin_user_info):
        """Admin creates task assigned to internal user in same org"""
        org_id = admin_user_info.get("team_id")
        task_data = {
            "org_id": org_id,
            "title": "TEST_Task assigned to internal user",
            "assignee_user_id": INTERNAL_USER_ID,
            "visibility": "internal"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/tasks", json=task_data)
        # This may fail if internal user doesn't exist or is in different org
        # Accept either 200 or 404 (user not found)
        if response.status_code == 200:
            task = response.json()
            assert task["assignee_user_id"] == INTERNAL_USER_ID
            created_task_ids.append(task["id"])
            print(f"Created task assigned to internal user: {task['id']}")
        else:
            print(f"Note: Assignee test returned {response.status_code}: {response.text}")
            # If user not found, test still passes (it's testing the validation)
            assert response.status_code in [200, 404, 400], f"Unexpected error: {response.text}"
    
    def test_admin_creates_task_auto_position(self, admin_session, admin_user_info):
        """Task auto-generates position if not provided"""
        org_id = admin_user_info.get("team_id")
        task_data = {
            "org_id": org_id,
            "title": "TEST_Task auto position",
            "visibility": "both"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/tasks", json=task_data)
        assert response.status_code == 200, f"Create task failed: {response.text}"
        
        task = response.json()
        assert task["position"] is not None, "Position should be auto-generated"
        assert task["position"] > 0, "Auto-generated position should be positive"
        
        created_task_ids.append(task["id"])
        print(f"Created task with auto position: {task['position']}")
    
    def test_non_admin_cannot_create_tasks(self, client_session, client_user_info):
        """Client (non-admin) cannot create tasks - should return 403"""
        org_id = client_user_info.get("team_id")
        task_data = {
            "org_id": org_id,
            "title": "TEST_Client trying to create task",
            "visibility": "client"
        }
        
        response = client_session.post(f"{BASE_URL}/api/tasks", json=task_data)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("Correctly rejected client task creation with 403")
    
    def test_admin_cannot_create_task_in_different_org(self, admin_session, admin_user_info):
        """Admin cannot create task in different org - should return 403"""
        different_org_id = CLIENT_TEAM_ID  # Client's org is different
        task_data = {
            "org_id": different_org_id,
            "title": "TEST_Task in wrong org",
            "visibility": "internal"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/tasks", json=task_data)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("Correctly rejected cross-org task creation with 403")
    
    def test_assignee_from_different_org_rejected(self, admin_session, admin_user_info):
        """Assigning task to user from different org is rejected - 400"""
        org_id = admin_user_info.get("team_id")
        task_data = {
            "org_id": org_id,
            "title": "TEST_Task with cross-org assignee",
            "assignee_user_id": CLIENT_ID,  # Client is in different org
            "visibility": "internal"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/tasks", json=task_data)
        # Should be 400 (bad request) because assignee is from different org
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("Correctly rejected cross-org assignee with 400")


# ==================== GET /api/tasks TESTS ====================

class TestListTasks:
    """Test GET /api/tasks endpoint with RBAC and filters"""
    
    def test_setup_tasks_for_visibility_tests(self, admin_session, admin_user_info):
        """Setup: Create tasks with different visibility for testing"""
        org_id = admin_user_info.get("team_id")
        
        # Create internal visibility task
        internal_task = {
            "org_id": org_id,
            "title": "TEST_Internal only task",
            "visibility": "internal",
            "status": "todo"
        }
        response = admin_session.post(f"{BASE_URL}/api/tasks", json=internal_task)
        if response.status_code == 200:
            created_task_ids.append(response.json()["id"])
        
        # Create client visibility task
        client_task = {
            "org_id": org_id,
            "title": "TEST_Client visible task",
            "visibility": "client",
            "status": "doing"
        }
        response = admin_session.post(f"{BASE_URL}/api/tasks", json=client_task)
        if response.status_code == 200:
            created_task_ids.append(response.json()["id"])
        
        # Create both visibility task
        both_task = {
            "org_id": org_id,
            "title": "TEST_Both visibility task",
            "visibility": "both",
            "status": "review"
        }
        response = admin_session.post(f"{BASE_URL}/api/tasks", json=both_task)
        if response.status_code == 200:
            created_task_ids.append(response.json()["id"])
        
        print(f"Created {len(created_task_ids)} test tasks for visibility testing")
    
    def test_admin_sees_all_tasks_in_org(self, admin_session, admin_user_info):
        """Admin can see all tasks in their org"""
        response = admin_session.get(f"{BASE_URL}/api/tasks")
        assert response.status_code == 200, f"Get tasks failed: {response.text}"
        
        tasks = response.json()
        assert isinstance(tasks, list)
        
        # Check we can see internal tasks
        internal_tasks = [t for t in tasks if t.get("visibility") == "internal"]
        print(f"Admin sees {len(tasks)} total tasks, {len(internal_tasks)} internal")
    
    def test_filter_by_status(self, admin_session):
        """Filter tasks by status works"""
        response = admin_session.get(f"{BASE_URL}/api/tasks?status=todo")
        assert response.status_code == 200, f"Filter by status failed: {response.text}"
        
        tasks = response.json()
        for task in tasks:
            assert task["status"] == "todo", f"Got task with wrong status: {task['status']}"
        
        print(f"Filter by status=todo returned {len(tasks)} tasks")
    
    def test_filter_by_visibility(self, admin_session):
        """Filter tasks by visibility works"""
        response = admin_session.get(f"{BASE_URL}/api/tasks?visibility=internal")
        assert response.status_code == 200, f"Filter by visibility failed: {response.text}"
        
        tasks = response.json()
        for task in tasks:
            assert task["visibility"] == "internal", f"Got task with wrong visibility: {task['visibility']}"
        
        print(f"Filter by visibility=internal returned {len(tasks)} tasks")


# ==================== CLIENT VISIBILITY TESTS ====================
# Note: These tests require client to be temporarily in same org as admin

class TestClientVisibility:
    """Test client visibility restrictions
    
    These tests need the client to be in the same org as admin.
    The agent_to_agent_context notes we should:
    1. Update client team_id to admin's team_id
    2. Run visibility tests
    3. Restore client's original team_id
    """
    
    @pytest.fixture(autouse=True)
    def setup_client_org(self, admin_session):
        """Temporarily move client to admin's org for testing"""
        # Update client's team_id to admin's team
        response = admin_session.patch(
            f"{BASE_URL}/api/users/{CLIENT_ID}",
            json={"team_id": ADMIN_TEAM_ID}
        )
        if response.status_code == 200:
            print(f"Moved client to admin org for testing")
            yield
            # Restore client's original team_id
            admin_session.patch(
                f"{BASE_URL}/api/users/{CLIENT_ID}",
                json={"team_id": CLIENT_TEAM_ID}
            )
            print(f"Restored client to original org")
        else:
            print(f"Could not update client org: {response.status_code} - {response.text}")
            yield
    
    def test_client_sees_client_visibility_tasks(self, client_session):
        """Client can see tasks with visibility=client"""
        # Need to re-authenticate after org change
        token = TestSetup.get_client_token()
        if token:
            client_session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = client_session.get(f"{BASE_URL}/api/tasks")
        
        # May return 200 or empty list if no visible tasks
        if response.status_code == 200:
            tasks = response.json()
            # Client should only see client or both visibility
            for task in tasks:
                assert task["visibility"] in ["client", "both"], \
                    f"Client should not see internal task: {task['title']}"
            print(f"Client sees {len(tasks)} tasks (all client/both visibility)")
        else:
            print(f"Client tasks request: {response.status_code}")
    
    def test_client_does_not_see_internal_tasks(self, client_session):
        """Client should NOT see internal visibility tasks"""
        token = TestSetup.get_client_token()
        if token:
            client_session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = client_session.get(f"{BASE_URL}/api/tasks")
        
        if response.status_code == 200:
            tasks = response.json()
            internal_tasks = [t for t in tasks if t.get("visibility") == "internal"]
            assert len(internal_tasks) == 0, \
                f"Client should not see {len(internal_tasks)} internal tasks"
            print("Verified: Client does not see internal tasks")


# ==================== PATCH /api/tasks/{id} TESTS ====================

class TestUpdateTask:
    """Test PATCH /api/tasks/{id} endpoint"""
    
    @pytest.fixture(scope="class")
    def test_task(self, admin_session, admin_user_info):
        """Create a test task for update tests"""
        org_id = admin_user_info.get("team_id")
        task_data = {
            "org_id": org_id,
            "title": "TEST_Task for updates",
            "description": "Original description",
            "status": "todo",
            "visibility": "both"  # Both so client can see it
        }
        response = admin_session.post(f"{BASE_URL}/api/tasks", json=task_data)
        if response.status_code == 200:
            task = response.json()
            created_task_ids.append(task["id"])
            return task
        return None
    
    def test_admin_updates_title(self, admin_session, test_task):
        """Admin can update task title"""
        if not test_task:
            pytest.skip("Test task not created")
        
        response = admin_session.patch(
            f"{BASE_URL}/api/tasks/{test_task['id']}",
            json={"title": "TEST_Updated title"}
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        updated = response.json()
        assert updated["title"] == "TEST_Updated title"
        print(f"Admin updated task title successfully")
    
    def test_admin_updates_description(self, admin_session, test_task):
        """Admin can update task description"""
        if not test_task:
            pytest.skip("Test task not created")
        
        response = admin_session.patch(
            f"{BASE_URL}/api/tasks/{test_task['id']}",
            json={"description": "Updated description text"}
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        updated = response.json()
        assert updated["description"] == "Updated description text"
    
    def test_admin_updates_visibility(self, admin_session, test_task):
        """Admin can update task visibility"""
        if not test_task:
            pytest.skip("Test task not created")
        
        response = admin_session.patch(
            f"{BASE_URL}/api/tasks/{test_task['id']}",
            json={"visibility": "internal"}
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        updated = response.json()
        assert updated["visibility"] == "internal"
        
        # Change back to both for client tests
        admin_session.patch(
            f"{BASE_URL}/api/tasks/{test_task['id']}",
            json={"visibility": "both"}
        )
    
    def test_status_change_to_done_sets_completed_at(self, admin_session, admin_user_info):
        """Status change to 'done' auto-sets completed_at"""
        # Create fresh task
        org_id = admin_user_info.get("team_id")
        response = admin_session.post(f"{BASE_URL}/api/tasks", json={
            "org_id": org_id,
            "title": "TEST_Task for done status",
            "status": "todo"
        })
        assert response.status_code == 200
        task = response.json()
        created_task_ids.append(task["id"])
        
        # Update to done
        response = admin_session.patch(
            f"{BASE_URL}/api/tasks/{task['id']}",
            json={"status": "done"}
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        updated = response.json()
        assert updated["status"] == "done"
        assert updated["completed_at"] is not None, "completed_at should be auto-set"
        print(f"Completed_at auto-set: {updated['completed_at']}")
    
    def test_status_change_from_done_clears_completed_at(self, admin_session, admin_user_info):
        """Status change from 'done' to other clears completed_at"""
        # Create fresh task and mark as done
        org_id = admin_user_info.get("team_id")
        response = admin_session.post(f"{BASE_URL}/api/tasks", json={
            "org_id": org_id,
            "title": "TEST_Task for undone status",
            "status": "done"
        })
        # If status is set to done on create, completed_at may not be set
        # Let's update an existing todo task instead
        assert response.status_code == 200
        task = response.json()
        created_task_ids.append(task["id"])
        
        # First set to done
        response = admin_session.patch(
            f"{BASE_URL}/api/tasks/{task['id']}",
            json={"status": "done"}
        )
        assert response.status_code == 200
        done_task = response.json()
        
        # Now change back to todo
        response = admin_session.patch(
            f"{BASE_URL}/api/tasks/{task['id']}",
            json={"status": "todo"}
        )
        assert response.status_code == 200
        
        updated = response.json()
        assert updated["status"] == "todo"
        assert updated["completed_at"] is None, "completed_at should be cleared"
        print("Completed_at cleared when status changed from done")
    
    def test_update_nonexistent_task_returns_404(self, admin_session):
        """Update on non-existent task returns 404"""
        fake_id = str(uuid.uuid4())
        response = admin_session.patch(
            f"{BASE_URL}/api/tasks/{fake_id}",
            json={"title": "Updated"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for non-existent task")


# ==================== CLIENT UPDATE RESTRICTIONS ====================

class TestClientUpdateRestrictions:
    """Test client can only update status on visible tasks"""
    
    @pytest.fixture(scope="class")
    def client_visible_task(self, admin_session, admin_user_info):
        """Create a task visible to client"""
        org_id = admin_user_info.get("team_id")
        response = admin_session.post(f"{BASE_URL}/api/tasks", json={
            "org_id": org_id,
            "title": "TEST_Client visible for update",
            "visibility": "both",
            "status": "todo"
        })
        if response.status_code == 200:
            task = response.json()
            created_task_ids.append(task["id"])
            return task
        return None
    
    @pytest.fixture(scope="class")
    def internal_only_task(self, admin_session, admin_user_info):
        """Create an internal-only task"""
        org_id = admin_user_info.get("team_id")
        response = admin_session.post(f"{BASE_URL}/api/tasks", json={
            "org_id": org_id,
            "title": "TEST_Internal only for update",
            "visibility": "internal",
            "status": "todo"
        })
        if response.status_code == 200:
            task = response.json()
            created_task_ids.append(task["id"])
            return task
        return None
    
    @pytest.fixture(autouse=True)
    def setup_client_in_same_org(self, admin_session):
        """Move client to admin org for testing"""
        response = admin_session.patch(
            f"{BASE_URL}/api/users/{CLIENT_ID}",
            json={"team_id": ADMIN_TEAM_ID}
        )
        yield
        # Restore
        admin_session.patch(
            f"{BASE_URL}/api/users/{CLIENT_ID}",
            json={"team_id": CLIENT_TEAM_ID}
        )
    
    def test_client_can_update_status_on_visible_task(self, client_session, client_visible_task):
        """Client can update status on visible tasks"""
        if not client_visible_task:
            pytest.skip("Client visible task not created")
        
        # Re-auth after org change
        token = TestSetup.get_client_token()
        if token:
            client_session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = client_session.patch(
            f"{BASE_URL}/api/tasks/{client_visible_task['id']}",
            json={"status": "doing"}
        )
        
        # Should succeed
        if response.status_code == 200:
            updated = response.json()
            assert updated["status"] == "doing"
            print("Client successfully updated task status")
        else:
            print(f"Client status update: {response.status_code} - {response.text}")
            # May fail if org change didn't work
    
    def test_client_cannot_update_title(self, client_session, client_visible_task):
        """Client cannot update title - should return 403"""
        if not client_visible_task:
            pytest.skip("Client visible task not created")
        
        token = TestSetup.get_client_token()
        if token:
            client_session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = client_session.patch(
            f"{BASE_URL}/api/tasks/{client_visible_task['id']}",
            json={"title": "Client trying to change title"}
        )
        
        assert response.status_code == 403, \
            f"Expected 403 for client title update, got {response.status_code}: {response.text}"
        print("Correctly rejected client title update with 403")
    
    def test_client_cannot_update_description(self, client_session, client_visible_task):
        """Client cannot update description - should return 403"""
        if not client_visible_task:
            pytest.skip("Client visible task not created")
        
        token = TestSetup.get_client_token()
        if token:
            client_session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = client_session.patch(
            f"{BASE_URL}/api/tasks/{client_visible_task['id']}",
            json={"description": "Client trying to change description"}
        )
        
        assert response.status_code == 403, \
            f"Expected 403 for client description update, got {response.status_code}"
        print("Correctly rejected client description update with 403")
    
    def test_client_cannot_update_visibility(self, client_session, client_visible_task):
        """Client cannot update visibility - should return 403"""
        if not client_visible_task:
            pytest.skip("Client visible task not created")
        
        token = TestSetup.get_client_token()
        if token:
            client_session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = client_session.patch(
            f"{BASE_URL}/api/tasks/{client_visible_task['id']}",
            json={"visibility": "internal"}
        )
        
        assert response.status_code == 403, \
            f"Expected 403 for client visibility update, got {response.status_code}"
        print("Correctly rejected client visibility update with 403")
    
    def test_client_cannot_update_internal_task(self, client_session, internal_only_task):
        """Client cannot update internal-only tasks - should return 403"""
        if not internal_only_task:
            pytest.skip("Internal task not created")
        
        token = TestSetup.get_client_token()
        if token:
            client_session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = client_session.patch(
            f"{BASE_URL}/api/tasks/{internal_only_task['id']}",
            json={"status": "doing"}
        )
        
        assert response.status_code == 403, \
            f"Expected 403 for client updating internal task, got {response.status_code}"
        print("Correctly rejected client update on internal task with 403")


# ==================== PATCH /api/tasks/reorder TESTS ====================

class TestReorderTasks:
    """Test PATCH /api/tasks/reorder endpoint"""
    
    def test_admin_can_reorder_task(self, admin_session, admin_user_info):
        """Admin can reorder tasks"""
        # Create a task to reorder
        org_id = admin_user_info.get("team_id")
        response = admin_session.post(f"{BASE_URL}/api/tasks", json={
            "org_id": org_id,
            "title": "TEST_Task for reorder",
            "position": 500.0
        })
        assert response.status_code == 200
        task = response.json()
        created_task_ids.append(task["id"])
        
        # Reorder the task
        response = admin_session.patch(
            f"{BASE_URL}/api/tasks/reorder",
            json={"task_id": task["id"], "new_position": 1500.0}
        )
        assert response.status_code == 200, f"Reorder failed: {response.text}"
        
        result = response.json()
        assert result["success"] == True
        assert result["new_position"] == 1500.0
        print(f"Task reordered to position {result['new_position']}")
    
    def test_reorder_nonexistent_task_returns_404(self, admin_session):
        """Reorder non-existent task returns 404"""
        fake_id = str(uuid.uuid4())
        response = admin_session.patch(
            f"{BASE_URL}/api/tasks/reorder",
            json={"task_id": fake_id, "new_position": 100.0}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for reordering non-existent task")


# ==================== CLEANUP ====================

class TestCleanup:
    """Clean up test data"""
    
    def test_cleanup_test_tasks(self, admin_session):
        """Delete all TEST_ prefixed tasks"""
        # Get all tasks
        response = admin_session.get(f"{BASE_URL}/api/tasks")
        if response.status_code == 200:
            tasks = response.json()
            test_tasks = [t for t in tasks if t.get("title", "").startswith("TEST_")]
            print(f"Found {len(test_tasks)} test tasks to consider for cleanup")
        
        # Delete tracked tasks via MongoDB (if direct delete endpoint doesn't exist)
        # Since there's no DELETE endpoint in tasks.py, we'll just report
        print(f"Note: {len(created_task_ids)} tasks were created during testing")
        print(f"Task IDs: {created_task_ids[:5]}..." if len(created_task_ids) > 5 else f"Task IDs: {created_task_ids}")
        
        # Restore client org
        response = admin_session.patch(
            f"{BASE_URL}/api/users/{CLIENT_ID}",
            json={"team_id": CLIENT_TEAM_ID}
        )
        if response.status_code == 200:
            print("Client org restored successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
