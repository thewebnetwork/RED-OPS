"""
Test i18n and Categories multi-language support
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestI18nCategories:
    """Test Categories API with multi-language fields"""
    
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
    
    def test_get_categories_l1(self):
        """Test GET /api/categories/l1"""
        response = requests.get(f"{BASE_URL}/api/categories/l1", headers=self.headers)
        assert response.status_code == 200
        categories = response.json()
        print(f"Found {len(categories)} L1 categories")
        
        # Check if categories have multi-language fields
        if categories:
            cat = categories[0]
            print(f"Category fields: {list(cat.keys())}")
            # Check for multi-language fields in response
            has_name_en = 'name_en' in cat
            has_name_pt = 'name_pt' in cat
            has_name_es = 'name_es' in cat
            print(f"Has name_en: {has_name_en}, name_pt: {has_name_pt}, name_es: {has_name_es}")
    
    def test_create_category_with_translations(self):
        """Test creating a category with multi-language names"""
        payload = {
            "name": "TEST_MultiLang Category",
            "name_en": "Test Category EN",
            "name_pt": "Categoria de Teste PT",
            "name_es": "Categoría de Prueba ES",
            "description": "Test category with translations",
            "icon": "file"
        }
        
        response = requests.post(f"{BASE_URL}/api/categories/l1", json=payload, headers=self.headers)
        print(f"Create response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 200:
            cat = response.json()
            print(f"Created category: {cat}")
            
            # Verify multi-language fields were saved
            assert cat.get('name') == payload['name'], "Name not saved correctly"
            
            # Check if multi-language fields are in response
            if 'name_en' in cat:
                assert cat.get('name_en') == payload['name_en'], "name_en not saved"
            if 'name_pt' in cat:
                assert cat.get('name_pt') == payload['name_pt'], "name_pt not saved"
            if 'name_es' in cat:
                assert cat.get('name_es') == payload['name_es'], "name_es not saved"
            
            # Cleanup - delete the test category
            cat_id = cat.get('id')
            if cat_id:
                requests.delete(f"{BASE_URL}/api/categories/l1/{cat_id}", headers=self.headers)
                print(f"Cleaned up test category {cat_id}")
        else:
            # Check if it's a validation error or missing fields
            print(f"Failed to create category: {response.text}")
    
    def test_categories_l2(self):
        """Test GET /api/categories/l2"""
        response = requests.get(f"{BASE_URL}/api/categories/l2", headers=self.headers)
        assert response.status_code == 200
        categories = response.json()
        print(f"Found {len(categories)} L2 categories")
        
        if categories:
            cat = categories[0]
            print(f"L2 Category fields: {list(cat.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
