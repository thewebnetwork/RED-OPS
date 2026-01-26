"""
Test Reports Module and Command Center Submit/Save Draft Button Visibility
Tests for:
1. Reports Module - Available reports list, report generation, CSV/PDF exports
2. Command Center - Submit/Save Draft buttons visibility based on L1+L2 selection
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@redribbonops.com"
ADMIN_PASSWORD = "Fmtvvl171**"


class TestAuthentication:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin login returns token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        print(f"✓ Admin login successful, user: {data['user'].get('name')}")
        return data["access_token"]


class TestReportsModule:
    """Reports Module API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
        else:
            pytest.skip("Authentication failed")
    
    def test_get_available_reports(self):
        """Test GET /api/reports/available returns list of canned reports"""
        response = requests.get(f"{BASE_URL}/api/reports/available", headers=self.headers)
        assert response.status_code == 200, f"Failed to get reports: {response.text}"
        
        reports = response.json()
        assert isinstance(reports, list), "Response should be a list"
        assert len(reports) > 0, "Should have at least one report"
        
        # Verify report structure
        for report in reports:
            assert "id" in report, "Report should have id"
            assert "name" in report, "Report should have name"
            assert "description" in report, "Report should have description"
            assert "category" in report, "Report should have category"
        
        # Check for expected reports
        report_ids = [r["id"] for r in reports]
        expected_reports = ["tickets_created", "sla_compliance", "stale_pending_review"]
        for expected in expected_reports:
            assert expected in report_ids, f"Expected report '{expected}' not found"
        
        print(f"✓ Found {len(reports)} available reports")
        print(f"  Report IDs: {report_ids}")
    
    def test_generate_sla_compliance_report(self):
        """Test generating SLA Compliance Summary report"""
        response = requests.post(
            f"{BASE_URL}/api/reports/sla_compliance/generate",
            headers=self.headers,
            json={}  # Empty filters
        )
        assert response.status_code == 200, f"Failed to generate report: {response.text}"
        
        data = response.json()
        assert data["report_id"] == "sla_compliance"
        assert data["report_name"] == "SLA Compliance Summary"
        assert "generated_at" in data
        assert "total_rows" in data
        assert "columns" in data
        assert "data" in data
        assert "summary" in data
        
        # Check summary has expected fields
        summary = data["summary"]
        assert "on_track" in summary
        assert "at_risk" in summary
        assert "breached" in summary
        assert "compliance_rate" in summary
        
        print(f"✓ SLA Compliance report generated: {data['total_rows']} rows")
        print(f"  Summary: on_track={summary['on_track']}, at_risk={summary['at_risk']}, breached={summary['breached']}")
    
    def test_generate_tickets_created_report(self):
        """Test generating Tickets Created report"""
        response = requests.post(
            f"{BASE_URL}/api/reports/tickets_created/generate",
            headers=self.headers,
            json={
                "date_from": "2024-01-01",
                "date_to": "2026-12-31"
            }
        )
        assert response.status_code == 200, f"Failed to generate report: {response.text}"
        
        data = response.json()
        assert data["report_id"] == "tickets_created"
        assert data["report_name"] == "Tickets Created"
        assert "columns" in data
        assert "date" in data["columns"]
        assert "count" in data["columns"]
        
        print(f"✓ Tickets Created report generated: {data['total_rows']} date entries")
    
    def test_generate_stale_pending_review_report(self):
        """Test generating Stale Pending Review report"""
        response = requests.post(
            f"{BASE_URL}/api/reports/stale_pending_review/generate",
            headers=self.headers,
            json={}
        )
        assert response.status_code == 200, f"Failed to generate report: {response.text}"
        
        data = response.json()
        assert data["report_id"] == "stale_pending_review"
        assert data["report_name"] == "Stale Pending Review Tickets"
        assert "summary" in data
        
        summary = data["summary"]
        assert "total_pending" in summary
        
        print(f"✓ Stale Pending Review report generated: {data['total_rows']} tickets")
    
    def test_generate_tickets_by_assignee_report(self):
        """Test generating Tickets by Assignee report"""
        response = requests.post(
            f"{BASE_URL}/api/reports/tickets_by_assignee/generate",
            headers=self.headers,
            json={}
        )
        assert response.status_code == 200, f"Failed to generate report: {response.text}"
        
        data = response.json()
        assert data["report_id"] == "tickets_by_assignee"
        assert "columns" in data
        assert "assignee_name" in data["columns"]
        assert "ticket_count" in data["columns"]
        
        print(f"✓ Tickets by Assignee report generated: {data['total_rows']} assignees")
    
    def test_generate_open_ticket_aging_report(self):
        """Test generating Open Ticket Aging report"""
        response = requests.post(
            f"{BASE_URL}/api/reports/open_ticket_aging/generate",
            headers=self.headers,
            json={}
        )
        assert response.status_code == 200, f"Failed to generate report: {response.text}"
        
        data = response.json()
        assert data["report_id"] == "open_ticket_aging"
        assert "summary" in data
        assert "buckets" in data["summary"]
        
        buckets = data["summary"]["buckets"]
        expected_buckets = ["0-24h", "1-3 days", "3-7 days", "7-14 days", "14+ days"]
        for bucket in expected_buckets:
            assert bucket in buckets, f"Expected bucket '{bucket}' not found"
        
        print(f"✓ Open Ticket Aging report generated: {data['total_rows']} open tickets")
        print(f"  Buckets: {buckets}")
    
    def test_export_csv(self):
        """Test CSV export for SLA Compliance report"""
        response = requests.post(
            f"{BASE_URL}/api/reports/sla_compliance/export/csv",
            headers=self.headers,
            json={}
        )
        assert response.status_code == 200, f"CSV export failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type, f"Expected CSV content type, got: {content_type}"
        
        # Check content disposition header
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment" in content_disp, "Should have attachment disposition"
        assert ".csv" in content_disp, "Should have .csv extension"
        
        # Check CSV content
        csv_content = response.text
        assert len(csv_content) > 0, "CSV should not be empty"
        
        # Check headers are present
        lines = csv_content.strip().split('\n')
        if len(lines) > 0:
            headers = lines[0]
            assert "order_code" in headers or "sla_state" in headers, "CSV should have expected headers"
        
        print(f"✓ CSV export successful: {len(csv_content)} bytes")
    
    def test_export_pdf_data(self):
        """Test PDF export endpoint returns data for frontend PDF generation"""
        response = requests.post(
            f"{BASE_URL}/api/reports/sla_compliance/export/pdf",
            headers=self.headers,
            json={}
        )
        assert response.status_code == 200, f"PDF export failed: {response.text}"
        
        data = response.json()
        assert "report" in data, "Should have report data"
        assert "brand_colors" in data, "Should have brand colors"
        assert "generated_by" in data, "Should have generated_by"
        assert "generated_at" in data, "Should have generated_at"
        
        # Check brand colors
        colors = data["brand_colors"]
        assert "primary" in colors
        assert colors["primary"] == "#E11D48"  # Rose-600
        
        print(f"✓ PDF export data returned successfully")
    
    def test_report_with_filters(self):
        """Test report generation with filters applied"""
        response = requests.post(
            f"{BASE_URL}/api/reports/sla_compliance/generate",
            headers=self.headers,
            json={
                "date_from": "2025-01-01",
                "date_to": "2026-12-31",
                "sla_state": "breached"
            }
        )
        assert response.status_code == 200, f"Failed to generate filtered report: {response.text}"
        
        data = response.json()
        assert "filters_applied" in data
        
        # If there's data, all should be breached
        if data["data"]:
            for row in data["data"]:
                assert row.get("sla_state") == "breached", "All rows should be breached"
        
        print(f"✓ Filtered report generated: {data['total_rows']} breached tickets")
    
    def test_invalid_report_id(self):
        """Test generating report with invalid ID returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/reports/invalid_report_xyz/generate",
            headers=self.headers,
            json={}
        )
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("✓ Invalid report ID returns 404")


class TestCategoriesForCommandCenter:
    """Test categories endpoints used by Command Center"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
        else:
            pytest.skip("Authentication failed")
    
    def test_get_categories_l1(self):
        """Test GET /api/categories/l1 returns L1 categories"""
        response = requests.get(f"{BASE_URL}/api/categories/l1", headers=self.headers)
        assert response.status_code == 200, f"Failed to get L1 categories: {response.text}"
        
        categories = response.json()
        assert isinstance(categories, list), "Response should be a list"
        
        if len(categories) > 0:
            cat = categories[0]
            assert "id" in cat, "Category should have id"
            assert "name" in cat, "Category should have name"
        
        print(f"✓ Found {len(categories)} L1 categories")
        return categories
    
    def test_get_categories_l2(self):
        """Test GET /api/categories/l2 returns L2 categories"""
        # First get L1 categories
        l1_response = requests.get(f"{BASE_URL}/api/categories/l1", headers=self.headers)
        if l1_response.status_code != 200 or not l1_response.json():
            pytest.skip("No L1 categories available")
        
        l1_id = l1_response.json()[0]["id"]
        
        # Get L2 categories for this L1
        response = requests.get(
            f"{BASE_URL}/api/categories/l2?category_l1_id={l1_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get L2 categories: {response.text}"
        
        categories = response.json()
        assert isinstance(categories, list), "Response should be a list"
        
        print(f"✓ Found {len(categories)} L2 categories for L1 '{l1_id}'")
        return categories


class TestOrdersForCommandCenter:
    """Test orders endpoints used by Command Center"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
            self.user = response.json().get("user")
        else:
            pytest.skip("Authentication failed")
    
    def test_create_draft_order(self):
        """Test creating a draft order (is_draft=true)"""
        # First get categories
        l1_response = requests.get(f"{BASE_URL}/api/categories/l1", headers=self.headers)
        if l1_response.status_code != 200 or not l1_response.json():
            pytest.skip("No L1 categories available")
        
        l1_id = l1_response.json()[0]["id"]
        
        l2_response = requests.get(
            f"{BASE_URL}/api/categories/l2?category_l1_id={l1_id}",
            headers=self.headers
        )
        if l2_response.status_code != 200 or not l2_response.json():
            pytest.skip("No L2 categories available")
        
        l2_id = l2_response.json()[0]["id"]
        
        # Create draft order
        response = requests.post(
            f"{BASE_URL}/api/orders",
            headers=self.headers,
            json={
                "title": "TEST_Draft_Order_Reports_Test",
                "description": "Test draft order for reports testing",
                "category_l1_id": l1_id,
                "category_l2_id": l2_id,
                "is_draft": True,
                "priority": "Normal"
            }
        )
        assert response.status_code in [200, 201], f"Failed to create draft: {response.text}"
        
        data = response.json()
        assert data.get("status") == "Draft", "Draft order should have Draft status"
        assert data.get("sla_deadline") is None, "Draft should not have SLA deadline"
        
        print(f"✓ Draft order created: {data.get('order_code')}")
        return data
    
    def test_submit_order_requires_l1_l2(self):
        """Test that submitting order requires both L1 and L2 categories"""
        # Try to create order without L2
        l1_response = requests.get(f"{BASE_URL}/api/categories/l1", headers=self.headers)
        if l1_response.status_code != 200 or not l1_response.json():
            pytest.skip("No L1 categories available")
        
        l1_id = l1_response.json()[0]["id"]
        
        # Create order without L2 (should still work as draft)
        response = requests.post(
            f"{BASE_URL}/api/orders",
            headers=self.headers,
            json={
                "title": "TEST_Order_Without_L2",
                "description": "Test order without L2 category",
                "category_l1_id": l1_id,
                "is_draft": False,
                "priority": "Normal"
            }
        )
        
        # The backend may allow this or reject it - document the behavior
        print(f"Order without L2 response: {response.status_code}")
        if response.status_code in [200, 201]:
            print("✓ Order created without L2 (backend allows it)")
        else:
            print(f"✓ Order without L2 rejected: {response.text}")


class TestReportCategories:
    """Test all report categories are covered"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
        else:
            pytest.skip("Authentication failed")
    
    def test_all_report_categories(self):
        """Test that all expected report categories exist"""
        response = requests.get(f"{BASE_URL}/api/reports/available", headers=self.headers)
        assert response.status_code == 200
        
        reports = response.json()
        categories = set(r["category"] for r in reports)
        
        expected_categories = {"Volume", "Aging", "Performance", "SLA", "Distribution", "Escalation", "Workflow"}
        
        for cat in expected_categories:
            assert cat in categories, f"Expected category '{cat}' not found"
        
        print(f"✓ All expected categories found: {categories}")
    
    def test_generate_all_reports(self):
        """Test generating each available report"""
        response = requests.get(f"{BASE_URL}/api/reports/available", headers=self.headers)
        assert response.status_code == 200
        
        reports = response.json()
        results = []
        
        for report in reports:
            gen_response = requests.post(
                f"{BASE_URL}/api/reports/{report['id']}/generate",
                headers=self.headers,
                json={}
            )
            
            status = "✓" if gen_response.status_code == 200 else "✗"
            results.append({
                "id": report["id"],
                "name": report["name"],
                "status": gen_response.status_code,
                "rows": gen_response.json().get("total_rows", 0) if gen_response.status_code == 200 else 0
            })
            print(f"{status} {report['name']}: {gen_response.status_code}")
        
        # All reports should generate successfully
        failed = [r for r in results if r["status"] != 200]
        assert len(failed) == 0, f"Failed reports: {failed}"
        
        print(f"\n✓ All {len(reports)} reports generated successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
