"""
P1 Improvements Test Suite
Tests for:
1. Categories: Subcategory move to different L1 parent
2. Logs: Empty states, tooltips, real logs from activity_logs
3. Announcements: 24h retention for expired announcements
"""
import pytest
import requests
import os
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCategoriesSubcategoryMove:
    """Test moving subcategories across L1 categories"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_l1_categories(self):
        """Test GET /api/categories/l1 returns categories"""
        response = requests.get(f"{BASE_URL}/api/categories/l1", headers=self.headers)
        assert response.status_code == 200
        categories = response.json()
        assert isinstance(categories, list)
        print(f"Found {len(categories)} L1 categories")
        if categories:
            print(f"L1 Categories: {[c['name'] for c in categories]}")
    
    def test_get_l2_categories(self):
        """Test GET /api/categories/l2 returns subcategories"""
        response = requests.get(f"{BASE_URL}/api/categories/l2", headers=self.headers)
        assert response.status_code == 200
        subcategories = response.json()
        assert isinstance(subcategories, list)
        print(f"Found {len(subcategories)} L2 subcategories")
    
    def test_create_l1_category_for_move_test(self):
        """Create L1 categories for move testing"""
        # Create first L1 category
        response1 = requests.post(f"{BASE_URL}/api/categories/l1", headers=self.headers, json={
            "name": "TEST_Source_Category",
            "description": "Source category for move test"
        })
        assert response1.status_code == 200, f"Failed to create source L1: {response1.text}"
        self.source_l1_id = response1.json()["id"]
        print(f"Created source L1 category: {self.source_l1_id}")
        
        # Create second L1 category
        response2 = requests.post(f"{BASE_URL}/api/categories/l1", headers=self.headers, json={
            "name": "TEST_Target_Category",
            "description": "Target category for move test"
        })
        assert response2.status_code == 200, f"Failed to create target L1: {response2.text}"
        self.target_l1_id = response2.json()["id"]
        print(f"Created target L1 category: {self.target_l1_id}")
    
    def test_create_and_move_subcategory(self):
        """Test creating a subcategory and moving it to a different parent"""
        # First get existing L1 categories
        l1_response = requests.get(f"{BASE_URL}/api/categories/l1", headers=self.headers)
        l1_categories = l1_response.json()
        
        if len(l1_categories) < 2:
            # Create two L1 categories for testing
            resp1 = requests.post(f"{BASE_URL}/api/categories/l1", headers=self.headers, json={
                "name": "TEST_Move_Source",
                "description": "Source for move test"
            })
            source_l1_id = resp1.json()["id"]
            
            resp2 = requests.post(f"{BASE_URL}/api/categories/l1", headers=self.headers, json={
                "name": "TEST_Move_Target",
                "description": "Target for move test"
            })
            target_l1_id = resp2.json()["id"]
        else:
            source_l1_id = l1_categories[0]["id"]
            target_l1_id = l1_categories[1]["id"]
        
        # Create a subcategory under source L1
        create_response = requests.post(f"{BASE_URL}/api/categories/l2", headers=self.headers, json={
            "name": "TEST_Movable_Subcategory",
            "category_l1_id": source_l1_id,
            "description": "This subcategory will be moved"
        })
        assert create_response.status_code == 200, f"Failed to create L2: {create_response.text}"
        subcategory = create_response.json()
        subcategory_id = subcategory["id"]
        print(f"Created subcategory {subcategory_id} under L1 {source_l1_id}")
        
        # Verify initial parent
        assert subcategory["category_l1_id"] == source_l1_id
        
        # Move subcategory to target L1 using PATCH /api/categories/l2/{id}
        move_response = requests.patch(
            f"{BASE_URL}/api/categories/l2/{subcategory_id}",
            headers=self.headers,
            json={"category_l1_id": target_l1_id}
        )
        assert move_response.status_code == 200, f"Failed to move subcategory: {move_response.text}"
        moved_subcategory = move_response.json()
        
        # Verify the move
        assert moved_subcategory["category_l1_id"] == target_l1_id, "Subcategory was not moved to target L1"
        print(f"Successfully moved subcategory from {source_l1_id} to {target_l1_id}")
        
        # Verify category_l1_name was updated
        if "category_l1_name" in moved_subcategory:
            print(f"Updated category_l1_name: {moved_subcategory['category_l1_name']}")
        
        # Cleanup - delete test subcategory
        requests.delete(f"{BASE_URL}/api/categories/l2/{subcategory_id}", headers=self.headers)
    
    def test_move_to_invalid_parent_fails(self):
        """Test that moving to non-existent parent fails"""
        # Get an existing subcategory
        l2_response = requests.get(f"{BASE_URL}/api/categories/l2", headers=self.headers)
        subcategories = l2_response.json()
        
        if not subcategories:
            pytest.skip("No subcategories to test with")
        
        subcategory_id = subcategories[0]["id"]
        
        # Try to move to non-existent parent
        move_response = requests.patch(
            f"{BASE_URL}/api/categories/l2/{subcategory_id}",
            headers=self.headers,
            json={"category_l1_id": "non-existent-id-12345"}
        )
        assert move_response.status_code == 404, "Should fail when moving to non-existent parent"
        print("Correctly rejected move to non-existent parent")


class TestLogsModule:
    """Test Logs module - empty states, real logs from activity_logs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_system_logs(self):
        """Test GET /api/logs/system returns logs from activity_logs collection"""
        response = requests.get(f"{BASE_URL}/api/logs/system", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert "total" in data
        print(f"System logs: {data['total']} entries")
        if data['logs']:
            print(f"Sample log: {data['logs'][0]}")
    
    def test_get_api_logs(self):
        """Test GET /api/logs/api returns logs"""
        response = requests.get(f"{BASE_URL}/api/logs/api", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        print(f"API logs: {data['total']} entries")
    
    def test_get_ui_logs(self):
        """Test GET /api/logs/ui returns logs"""
        response = requests.get(f"{BASE_URL}/api/logs/ui", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        print(f"UI logs: {data['total']} entries")
    
    def test_get_user_logs(self):
        """Test GET /api/logs/user returns logs"""
        response = requests.get(f"{BASE_URL}/api/logs/user", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        print(f"User logs: {data['total']} entries")
    
    def test_invalid_log_type_rejected(self):
        """Test that invalid log type returns 400"""
        response = requests.get(f"{BASE_URL}/api/logs/invalid_type", headers=self.headers)
        assert response.status_code == 400
        print("Invalid log type correctly rejected")
    
    def test_create_log_entry(self):
        """Test POST /api/logs creates a log entry"""
        response = requests.post(f"{BASE_URL}/api/logs", headers=self.headers, json={
            "level": "INFO",
            "message": "TEST_P1_Log_Entry - Testing log creation",
            "source": "system",
            "details": {"test": True}
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        print(f"Created log entry: {data['id']}")
        
        # Verify log appears in system logs
        logs_response = requests.get(f"{BASE_URL}/api/logs/system", headers=self.headers)
        logs = logs_response.json()["logs"]
        test_logs = [l for l in logs if "TEST_P1_Log_Entry" in l.get("message", "")]
        assert len(test_logs) > 0, "Created log should appear in system logs"
        print("Log entry verified in system logs")


class TestAnnouncementsRetention:
    """Test Announcements 24h retention for expired announcements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_announcements(self):
        """Test GET /api/announcements returns announcements"""
        response = requests.get(f"{BASE_URL}/api/announcements", headers=self.headers)
        assert response.status_code == 200
        announcements = response.json()
        assert isinstance(announcements, list)
        print(f"Found {len(announcements)} announcements")
    
    def test_create_announcement(self):
        """Test POST /api/announcements creates announcement"""
        response = requests.post(f"{BASE_URL}/api/announcements", headers=self.headers, json={
            "title": "TEST_P1_Announcement",
            "message": "This is a test announcement for P1 improvements",
            "is_active": True,
            "send_to_all": True,
            "priority": 1
        })
        assert response.status_code == 200, f"Failed to create announcement: {response.text}"
        announcement = response.json()
        assert announcement["title"] == "TEST_P1_Announcement"
        print(f"Created announcement: {announcement['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/announcements/{announcement['id']}", headers=self.headers)
    
    def test_create_expired_announcement_within_24h(self):
        """Test that expired announcements within 24h are retained"""
        # Create announcement that expired 1 hour ago
        end_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        
        response = requests.post(f"{BASE_URL}/api/announcements", headers=self.headers, json={
            "title": "TEST_Expired_Within_24h",
            "message": "This announcement expired 1 hour ago",
            "is_active": True,
            "send_to_all": True,
            "priority": 1,
            "end_at": end_time
        })
        assert response.status_code == 200, f"Failed to create announcement: {response.text}"
        announcement = response.json()
        announcement_id = announcement["id"]
        print(f"Created expired announcement: {announcement_id}")
        
        # Verify it still appears in list (within 24h retention)
        list_response = requests.get(f"{BASE_URL}/api/announcements", headers=self.headers)
        announcements = list_response.json()
        found = any(a["id"] == announcement_id for a in announcements)
        assert found, "Expired announcement within 24h should still be visible"
        print("Expired announcement within 24h is retained as expected")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/announcements/{announcement_id}", headers=self.headers)
    
    def test_announcement_with_schedule(self):
        """Test announcement with start and end schedule"""
        start_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        end_time = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        
        response = requests.post(f"{BASE_URL}/api/announcements", headers=self.headers, json={
            "title": "TEST_Scheduled_Announcement",
            "message": "This announcement is scheduled for the future",
            "is_active": True,
            "send_to_all": True,
            "priority": 2,
            "start_at": start_time,
            "end_at": end_time
        })
        assert response.status_code == 200
        announcement = response.json()
        assert announcement["start_at"] is not None
        assert announcement["end_at"] is not None
        print(f"Created scheduled announcement: {announcement['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/announcements/{announcement['id']}", headers=self.headers)
    
    def test_get_active_announcements_for_user(self):
        """Test GET /api/announcements/active returns active announcement for user"""
        response = requests.get(f"{BASE_URL}/api/announcements/active", headers=self.headers)
        # Can be 200 with data or 200 with null
        assert response.status_code == 200
        print(f"Active announcement response: {response.json()}")
    
    def test_get_all_active_announcements(self):
        """Test GET /api/announcements/active/all returns all active announcements"""
        response = requests.get(f"{BASE_URL}/api/announcements/active/all", headers=self.headers)
        assert response.status_code == 200
        announcements = response.json()
        assert isinstance(announcements, list)
        print(f"All active announcements: {len(announcements)}")


class TestCategoryL2UpdateModel:
    """Test that CategoryL2Update model accepts category_l1_id field"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@redribbonops.com",
            "password": "Fmtvvl171**"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_patch_l2_with_category_l1_id(self):
        """Test PATCH /api/categories/l2/{id} accepts category_l1_id"""
        # Get L1 categories
        l1_response = requests.get(f"{BASE_URL}/api/categories/l1", headers=self.headers)
        l1_categories = l1_response.json()
        
        if len(l1_categories) < 2:
            pytest.skip("Need at least 2 L1 categories for this test")
        
        source_l1 = l1_categories[0]
        target_l1 = l1_categories[1]
        
        # Create a test subcategory
        create_response = requests.post(f"{BASE_URL}/api/categories/l2", headers=self.headers, json={
            "name": "TEST_L2_Move_Test",
            "category_l1_id": source_l1["id"],
            "description": "Test subcategory for move"
        })
        
        if create_response.status_code != 200:
            # May already exist, try to find it
            l2_response = requests.get(f"{BASE_URL}/api/categories/l2", headers=self.headers)
            subcategories = l2_response.json()
            test_sub = next((s for s in subcategories if s["name"] == "TEST_L2_Move_Test"), None)
            if test_sub:
                subcategory_id = test_sub["id"]
            else:
                pytest.skip("Could not create or find test subcategory")
        else:
            subcategory_id = create_response.json()["id"]
        
        # Test PATCH with category_l1_id
        patch_response = requests.patch(
            f"{BASE_URL}/api/categories/l2/{subcategory_id}",
            headers=self.headers,
            json={
                "name": "TEST_L2_Move_Test_Updated",
                "category_l1_id": target_l1["id"]
            }
        )
        assert patch_response.status_code == 200, f"PATCH failed: {patch_response.text}"
        updated = patch_response.json()
        assert updated["category_l1_id"] == target_l1["id"], "category_l1_id should be updated"
        print(f"Successfully updated subcategory with new parent: {target_l1['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/categories/l2/{subcategory_id}", headers=self.headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
