"""
P1 Features Backend Tests for Service Hub Platform
Tests for: Logs, API Keys, Webhooks, SLA, Announcement Ticker, User Provisioning
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


class TestSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Get authenticated headers"""
        return {"Authorization": f"Bearer {admin_token}"}


class TestAnnouncementTicker(TestSetup):
    """P1-2: Announcement Ticker tests"""
    
    def test_get_announcement_ticker(self, auth_headers):
        """Test GET /api/announcement-ticker"""
        response = requests.get(f"{BASE_URL}/api/announcement-ticker", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get ticker: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "is_active" in data
        assert "background_color" in data
        assert "text_color" in data
        print(f"SUCCESS: Ticker retrieved - Active: {data['is_active']}, Message: {data['message'][:50]}...")
    
    def test_update_announcement_ticker(self, auth_headers):
        """Test PUT /api/announcement-ticker"""
        test_message = f"TEST_P1_Ticker_Message_{datetime.now().isoformat()}"
        
        response = requests.put(f"{BASE_URL}/api/announcement-ticker", 
            headers=auth_headers,
            json={
                "message": test_message,
                "is_active": True,
                "background_color": "#A2182C",
                "text_color": "#FFFFFF"
            }
        )
        assert response.status_code == 200, f"Failed to update ticker: {response.text}"
        
        data = response.json()
        assert data["message"] == test_message
        assert data["is_active"] == True
        print(f"SUCCESS: Ticker updated with message: {test_message[:30]}...")
        
        # Restore original message
        requests.put(f"{BASE_URL}/api/announcement-ticker", 
            headers=auth_headers,
            json={
                "message": "Welcome to Red Ops! New features have been released. Check them out!",
                "is_active": True,
                "background_color": "#A2182C",
                "text_color": "#FFFFFF"
            }
        )


class TestLogs(TestSetup):
    """P1-4: Logs Module tests"""
    
    def test_get_system_logs(self, auth_headers):
        """Test GET /api/logs/system"""
        response = requests.get(f"{BASE_URL}/api/logs/system?limit=50", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get system logs: {response.text}"
        
        data = response.json()
        assert "logs" in data
        print(f"SUCCESS: System logs retrieved - Count: {len(data['logs'])}")
    
    def test_get_api_logs(self, auth_headers):
        """Test GET /api/logs/api"""
        response = requests.get(f"{BASE_URL}/api/logs/api?limit=50", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get API logs: {response.text}"
        
        data = response.json()
        assert "logs" in data
        print(f"SUCCESS: API logs retrieved - Count: {len(data['logs'])}")
    
    def test_get_ui_logs(self, auth_headers):
        """Test GET /api/logs/ui"""
        response = requests.get(f"{BASE_URL}/api/logs/ui?limit=50", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get UI logs: {response.text}"
        
        data = response.json()
        assert "logs" in data
        print(f"SUCCESS: UI logs retrieved - Count: {len(data['logs'])}")
    
    def test_get_user_logs(self, auth_headers):
        """Test GET /api/logs/user"""
        response = requests.get(f"{BASE_URL}/api/logs/user?limit=50", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get user logs: {response.text}"
        
        data = response.json()
        assert "logs" in data
        print(f"SUCCESS: User logs retrieved - Count: {len(data['logs'])}")
    
    def test_create_log_entry(self, auth_headers):
        """Test POST /api/logs"""
        response = requests.post(f"{BASE_URL}/api/logs", 
            headers=auth_headers,
            json={
                "log_type": "system",
                "level": "INFO",
                "message": "TEST_P1_Log_Entry"
            }
        )
        assert response.status_code == 200, f"Failed to create log: {response.text}"
        print("SUCCESS: Log entry created")


class TestApiKeys(TestSetup):
    """P1-5: API Keys tests"""
    
    def test_list_api_keys(self, auth_headers):
        """Test GET /api/api-keys"""
        response = requests.get(f"{BASE_URL}/api/api-keys", headers=auth_headers)
        assert response.status_code == 200, f"Failed to list API keys: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: API keys listed - Count: {len(data)}")
    
    def test_create_api_key(self, auth_headers):
        """Test POST /api/api-keys"""
        response = requests.post(f"{BASE_URL}/api/api-keys", 
            headers=auth_headers,
            json={
                "name": "TEST_P1_API_Key",
                "permissions": "read"
            }
        )
        assert response.status_code == 200, f"Failed to create API key: {response.text}"
        
        data = response.json()
        assert "key" in data or "id" in data
        print(f"SUCCESS: API key created")
        
        # Store key ID for cleanup
        return data.get("id")
    
    def test_delete_api_key(self, auth_headers):
        """Test DELETE /api/api-keys/{key_id}"""
        # First create a key to delete
        create_response = requests.post(f"{BASE_URL}/api/api-keys", 
            headers=auth_headers,
            json={
                "name": "TEST_P1_Delete_Key",
                "permissions": "read"
            }
        )
        
        if create_response.status_code == 200:
            key_id = create_response.json().get("id")
            if key_id:
                delete_response = requests.delete(f"{BASE_URL}/api/api-keys/{key_id}", headers=auth_headers)
                assert delete_response.status_code in [200, 204], f"Failed to delete API key: {delete_response.text}"
                print(f"SUCCESS: API key deleted")


class TestWebhooks(TestSetup):
    """P1-5: Webhooks tests"""
    
    def test_list_webhooks(self, auth_headers):
        """Test GET /api/webhooks"""
        response = requests.get(f"{BASE_URL}/api/webhooks", headers=auth_headers)
        assert response.status_code == 200, f"Failed to list webhooks: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Webhooks listed - Count: {len(data)}")
    
    def test_create_webhook(self, auth_headers):
        """Test POST /api/webhooks"""
        response = requests.post(f"{BASE_URL}/api/webhooks", 
            headers=auth_headers,
            json={
                "name": "TEST_P1_Webhook",
                "url": "https://example.com/webhook",
                "direction": "outgoing",
                "events": ["order.created"],
                "is_active": True
            }
        )
        assert response.status_code == 200, f"Failed to create webhook: {response.text}"
        
        data = response.json()
        assert "id" in data
        print(f"SUCCESS: Webhook created - ID: {data['id']}")
        return data["id"]
    
    def test_delete_webhook(self, auth_headers):
        """Test DELETE /api/webhooks/{webhook_id}"""
        # First create a webhook to delete
        create_response = requests.post(f"{BASE_URL}/api/webhooks", 
            headers=auth_headers,
            json={
                "name": "TEST_P1_Delete_Webhook",
                "url": "https://example.com/delete-webhook",
                "direction": "outgoing",
                "events": [],
                "is_active": False
            }
        )
        
        if create_response.status_code == 200:
            webhook_id = create_response.json().get("id")
            if webhook_id:
                delete_response = requests.delete(f"{BASE_URL}/api/webhooks/{webhook_id}", headers=auth_headers)
                assert delete_response.status_code in [200, 204], f"Failed to delete webhook: {delete_response.text}"
                print(f"SUCCESS: Webhook deleted")


class TestSLA(TestSetup):
    """P1-8: SLA Module tests"""
    
    def test_list_slas(self, auth_headers):
        """Test GET /api/sla"""
        response = requests.get(f"{BASE_URL}/api/sla", headers=auth_headers)
        assert response.status_code == 200, f"Failed to list SLAs: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: SLAs listed - Count: {len(data)}")
    
    def test_create_sla(self, auth_headers):
        """Test POST /api/sla"""
        # First get a role to assign SLA to
        roles_response = requests.get(f"{BASE_URL}/api/roles", headers=auth_headers)
        roles = roles_response.json()
        
        if len(roles) > 0:
            role_id = roles[0]["id"]
            
            response = requests.post(f"{BASE_URL}/api/sla", 
                headers=auth_headers,
                json={
                    "name": "TEST_P1_SLA",
                    "description": "Test SLA for P1 testing",
                    "response_time_hours": 4,
                    "resolution_time_hours": 24,
                    "priority": "Normal",
                    "applies_to_type": "role",
                    "applies_to_id": role_id
                }
            )
            assert response.status_code == 200, f"Failed to create SLA: {response.text}"
            
            data = response.json()
            assert "id" in data
            print(f"SUCCESS: SLA created - ID: {data['id']}")
            return data["id"]
        else:
            pytest.skip("No roles available to assign SLA")
    
    def test_delete_sla(self, auth_headers):
        """Test DELETE /api/sla/{sla_id}"""
        # First get roles
        roles_response = requests.get(f"{BASE_URL}/api/roles", headers=auth_headers)
        roles = roles_response.json()
        
        if len(roles) > 0:
            role_id = roles[0]["id"]
            
            # Create SLA to delete
            create_response = requests.post(f"{BASE_URL}/api/sla", 
                headers=auth_headers,
                json={
                    "name": "TEST_P1_Delete_SLA",
                    "description": "SLA to delete",
                    "response_time_hours": 2,
                    "resolution_time_hours": 8,
                    "priority": "High",
                    "applies_to_type": "role",
                    "applies_to_id": role_id
                }
            )
            
            if create_response.status_code == 200:
                sla_id = create_response.json().get("id")
                if sla_id:
                    delete_response = requests.delete(f"{BASE_URL}/api/sla/{sla_id}", headers=auth_headers)
                    assert delete_response.status_code in [200, 204], f"Failed to delete SLA: {delete_response.text}"
                    print(f"SUCCESS: SLA deleted")


class TestUserProvisioning(TestSetup):
    """P1-6 & P1-7: User Provisioning tests"""
    
    def test_create_user_with_force_password_change(self, auth_headers):
        """Test creating user with force_password_change flag"""
        test_email = f"test_p1_pwd_{datetime.now().strftime('%H%M%S')}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/users", 
            headers=auth_headers,
            json={
                "name": "TEST_P1_Password_User",
                "email": test_email,
                "password": "TestPass123!",
                "role": "Requester",
                "force_password_change": True,
                "force_otp_setup": False
            }
        )
        assert response.status_code == 200, f"Failed to create user: {response.text}"
        
        data = response.json()
        assert data["force_password_change"] == True
        print(f"SUCCESS: User created with force_password_change=True")
        
        # Cleanup - delete user
        requests.delete(f"{BASE_URL}/api/users/{data['id']}", headers=auth_headers)
    
    def test_create_user_with_force_otp_setup(self, auth_headers):
        """Test creating user with force_otp_setup flag"""
        test_email = f"test_p1_otp_{datetime.now().strftime('%H%M%S')}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/users", 
            headers=auth_headers,
            json={
                "name": "TEST_P1_OTP_User",
                "email": test_email,
                "password": "TestPass123!",
                "role": "Requester",
                "force_password_change": False,
                "force_otp_setup": True
            }
        )
        assert response.status_code == 200, f"Failed to create user: {response.text}"
        
        data = response.json()
        assert data["force_otp_setup"] == True
        print(f"SUCCESS: User created with force_otp_setup=True")
        
        # Cleanup - delete user
        requests.delete(f"{BASE_URL}/api/users/{data['id']}", headers=auth_headers)
    
    def test_create_user_with_team_assignment(self, auth_headers):
        """Test creating user with team assignment"""
        # First get teams
        teams_response = requests.get(f"{BASE_URL}/api/teams", headers=auth_headers)
        teams = teams_response.json()
        
        if len(teams) > 0:
            team_id = teams[0]["id"]
            test_email = f"test_p1_team_{datetime.now().strftime('%H%M%S')}@test.com"
            
            response = requests.post(f"{BASE_URL}/api/users", 
                headers=auth_headers,
                json={
                    "name": "TEST_P1_Team_User",
                    "email": test_email,
                    "password": "TestPass123!",
                    "role": "Editor",
                    "team_id": team_id,
                    "force_password_change": False,
                    "force_otp_setup": False
                }
            )
            assert response.status_code == 200, f"Failed to create user: {response.text}"
            
            data = response.json()
            assert data["team_id"] == team_id
            print(f"SUCCESS: User created with team assignment")
            
            # Cleanup - delete user
            requests.delete(f"{BASE_URL}/api/users/{data['id']}", headers=auth_headers)
        else:
            pytest.skip("No teams available for assignment")
    
    def test_update_user_security_flags(self, auth_headers):
        """Test updating user security flags (re-trigger)"""
        # First create a user
        test_email = f"test_p1_update_{datetime.now().strftime('%H%M%S')}@test.com"
        
        create_response = requests.post(f"{BASE_URL}/api/users", 
            headers=auth_headers,
            json={
                "name": "TEST_P1_Update_User",
                "email": test_email,
                "password": "TestPass123!",
                "role": "Requester",
                "force_password_change": False,
                "force_otp_setup": False
            }
        )
        
        if create_response.status_code == 200:
            user_id = create_response.json()["id"]
            
            # Update to enable security flags
            update_response = requests.patch(f"{BASE_URL}/api/users/{user_id}", 
                headers=auth_headers,
                json={
                    "force_password_change": True,
                    "force_otp_setup": True
                }
            )
            assert update_response.status_code == 200, f"Failed to update user: {update_response.text}"
            
            data = update_response.json()
            assert data["force_password_change"] == True
            assert data["force_otp_setup"] == True
            print(f"SUCCESS: User security flags updated (re-triggered)")
            
            # Cleanup - delete user
            requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)


class TestWorkflowTriggers(TestSetup):
    """P1-3: Workflow Triggers tests"""
    
    def test_get_categories_l2_with_triggers(self, auth_headers):
        """Test GET /api/categories/l2 includes triggers_editor_workflow field"""
        response = requests.get(f"{BASE_URL}/api/categories/l2", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get categories: {response.text}"
        
        data = response.json()
        if len(data) > 0:
            # Check that triggers_editor_workflow field exists
            assert "triggers_editor_workflow" in data[0], "Missing triggers_editor_workflow field"
            print(f"SUCCESS: Categories L2 include triggers_editor_workflow field")
        else:
            print("INFO: No L2 categories found to verify")
    
    def test_update_category_trigger(self, auth_headers):
        """Test PATCH /api/categories/l2/{id} to update trigger"""
        # Get categories
        response = requests.get(f"{BASE_URL}/api/categories/l2", headers=auth_headers)
        categories = response.json()
        
        if len(categories) > 0:
            cat_id = categories[0]["id"]
            original_trigger = categories[0].get("triggers_editor_workflow", False)
            
            # Toggle the trigger
            update_response = requests.patch(f"{BASE_URL}/api/categories/l2/{cat_id}", 
                headers=auth_headers,
                json={
                    "name": categories[0]["name"],
                    "category_l1_id": categories[0]["category_l1_id"],
                    "triggers_editor_workflow": not original_trigger
                }
            )
            assert update_response.status_code == 200, f"Failed to update category: {update_response.text}"
            
            # Restore original value
            requests.patch(f"{BASE_URL}/api/categories/l2/{cat_id}", 
                headers=auth_headers,
                json={
                    "name": categories[0]["name"],
                    "category_l1_id": categories[0]["category_l1_id"],
                    "triggers_editor_workflow": original_trigger
                }
            )
            print(f"SUCCESS: Category trigger toggle works")
        else:
            pytest.skip("No L2 categories available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
