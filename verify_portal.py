#!/usr/bin/env python3
"""
Spillburg Holdings Company Portal - End-to-End Test Suite (Final Production Verification)
Tests:
- Static Assets, Official Brand Logo & Light Theme Delivery
- Public Registration Blocked (POST /api/auth/register -> 403)
- Multi-Role Authentication (Director, Admin, Muhammad Zaharan, Staff Editor, Staff Viewer)
- Muhammad Zaharan's Tracker: All 34 tasks synced from live Google Sheet
- Per-User Isolated Operations Tracker
- Preserved Master Operations Tracker in data/archived_master_tracker.json (34 items)
- Active Customer Files DB (Customer_Files_Active.accdb) & Financial Files DB
- Admin User Management: Create user, edit permissions & password, delete user
- Admin Self-Deletion Security Guard (400 Bad Request)
- No Demo Access or Role Switchers in UI
"""

import sys
import os
import time
import json
import urllib.request
import urllib.parse
import urllib.error
import subprocess

PORT = 8080
BASE_URL = f"http://127.0.0.1:{PORT}"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def make_request(path, method="GET", data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {
        "Accept": "application/json",
        "User-Agent": "SpillburgVerifier/3.0"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    encoded_data = None
    if data is not None:
        headers["Content-Type"] = "application/json; charset=utf-8"
        encoded_data = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            status = resp.status
            content_type = resp.headers.get("Content-Type", "")
            raw_body = resp.read()
            if "application/json" in content_type:
                return status, json.loads(raw_body.decode("utf-8")), resp.headers
            return status, raw_body, resp.headers
    except urllib.error.HTTPError as e:
        raw_body = e.read()
        try:
            body = json.loads(raw_body.decode("utf-8"))
        except Exception:
            body = raw_body.decode("utf-8", errors="ignore")
        return e.code, body, e.headers
    except Exception as e:
        return 0, str(e), {}

def test_suite():
    passed = 0
    failed = 0

    def assert_test(name, condition, details=""):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            print(f"  [FAIL] {name} - {details}")
            failed += 1

    print("=" * 75)
    print("      SPILLBURG HOLDINGS PORTAL - COMPREHENSIVE VERIFICATION SUITE   ")
    print("=" * 75)

    # 1. Database & Google Sheet Sync Integrity Checks
    print("\n--- 1. Testing Database & Master Sheet Archive Integrity ---")
    archive_path = os.path.join(BASE_DIR, "data", "archived_master_tracker.json")
    assert_test("Master Operations Tracker archived", os.path.exists(archive_path))
    if os.path.exists(archive_path):
        with open(archive_path, "r", encoding="utf-8") as f:
            archived_ops = json.load(f)
            assert_test(f"Archived master tracker contains all 34 tasks (found {len(archived_ops)})", len(archived_ops) == 34)

    active_cust_db = os.path.join(BASE_DIR, "customer_file_db", "Customer_Files_Active.accdb")
    orig_cust_db = os.path.join(BASE_DIR, "customer_file_db", "Office File Register.accdb")
    assert_test("Active Customer DB exists (Customer_Files_Active.accdb)", os.path.exists(active_cust_db))
    assert_test("Original Customer DB preserved (Office File Register.accdb)", os.path.exists(orig_cust_db))

    active_fin_db = os.path.join(BASE_DIR, "data", "financial_records_active.json")
    assert_test("Active Financial DB exists (financial_records_active.json)", os.path.exists(active_fin_db))

    # 2. Static Assets, Official Logo & Clean UI Checks
    print("\n--- 2. Testing Static Assets, Official Logo & Clean UI ---")
    status, logo_bytes, headers = make_request("/public/logo.png")
    assert_test("Official Spillburg Logo delivered (/public/logo.png)", status == 200 and len(logo_bytes) > 1000)

    status, html_bytes, headers = make_request("/")
    assert_test("Portal Root HTML loads", status == 200)
    assert_test("Logo embedded in HTML", b"/public/logo.png" in html_bytes)
    assert_test("Quick Demo Access removed from HTML", b"1-Click Demo Quick Access" not in html_bytes)
    assert_test("Test Role Switcher removed from HTML", b"roleSwitcherSelect" not in html_bytes)
    assert_test("Self-registration tab removed from HTML", b"tabBtnRegister" not in html_bytes)

    status, css_bytes, _ = make_request("/public/styles.css")
    assert_test("Light Theme CSS delivers", status == 200 and b"--bg-main: #f8fafc" in css_bytes)

    # 3. Security: Public Self-Registration Blocked
    print("\n--- 3. Testing Security & Public Registration Policy ---")
    status, reg_data, _ = make_request("/api/auth/register", "POST", {
        "fullName": "Intruder User",
        "username": "intruder",
        "password": "password123"
    })
    assert_test("Public POST /api/auth/register is blocked (HTTP 403)", status == 403 and "Administrator" in reg_data.get("error", ""))

    # 4. Authentication: All Verified Accounts
    print("\n--- 4. Testing Multi-Role Authentication ---")
    # Director
    status, data, _ = make_request("/api/auth/login", "POST", {"username": "director", "password": "director123"})
    assert_test("Director Login ('director' / 'director123')", status == 200 and data.get("success") is True and data.get("user", {}).get("role") == "director")
    director_token = data.get("token")

    # Admin
    status, data, _ = make_request("/api/auth/login", "POST", {"username": "admin", "password": "admin123"})
    assert_test("Admin Login ('admin' / 'admin123')", status == 200 and data.get("success") is True and data.get("user", {}).get("role") == "admin")
    admin_token = data.get("token")
    admin_id = data.get("user", {}).get("id")

    # Muhammad Zaharan
    status, data, _ = make_request("/api/auth/login", "POST", {"username": "zaharan", "password": "admin123"})
    assert_test("Muhammad Zaharan Login ('zaharan' / 'admin123')", status == 200 and data.get("success") is True and data.get("user", {}).get("username") == "zaharan")
    zaharan_token = data.get("token")

    # Staff Editor
    status, data, _ = make_request("/api/auth/login", "POST", {"username": "staff_editor", "password": "staff123"})
    assert_test("Staff Editor Login ('staff_editor' / 'staff123')", status == 200 and data.get("success") is True)
    editor_token = data.get("token")

    # Staff Viewer
    status, data, _ = make_request("/api/auth/login", "POST", {"username": "staff_viewer", "password": "staff123"})
    assert_test("Staff Viewer Login ('staff_viewer' / 'staff123')", status == 200 and data.get("success") is True)
    viewer_token = data.get("token")

    # 5. Muhammad Zaharan's Tracker (All 34 Sheet Tasks)
    print("\n--- 5. Testing Muhammad Zaharan's Personal Operations Tracker ---")
    status, z_ops, _ = make_request("/api/operations", token=zaharan_token)
    z_tasks = z_ops.get("tasks", [])
    assert_test(f"Zaharan's tracker contains all 34 tasks (found {len(z_tasks)})", status == 200 and len(z_tasks) == 34)

    # Spot check specific tasks from sheet
    task_laptop = next((t for t in z_tasks if "Quote Work Laptop" in t.get("title", "")), None)
    assert_test("Task #33 'Quote Work Laptop for Director' present", task_laptop is not None)

    task_mktg = next((t for t in z_tasks if "Digital Marketing" in t.get("title", "")), None)
    assert_test("Task #1 'Digital Marketing' present", task_mktg is not None and task_mktg.get("status") == "On Hold")

    # 6. Admin User Management CRUD & Permissions
    print("\n--- 6. Testing Admin User Management & Permission Control ---")
    # Staff cannot create users
    status, forbidden_res, _ = make_request("/api/users", "POST", {"username": "hack_user"}, token=editor_token)
    assert_test("Staff cannot create users (HTTP 403)", status == 403)

    # Admin creates new user
    new_user_name = f"testuser_{int(time.time())}"
    new_user_payload = {
        "fullName": "Auditing Specialist",
        "username": new_user_name,
        "role": "staff",
        "title": "Corporate Compliance Officer",
        "email": f"{new_user_name}@spillburg.com",
        "password": "initialpassword123",
        "permissions": {
            "operations": "editor",
            "customer_files": "viewer",
            "financial_files": "none"
        }
    }
    status, create_res, _ = make_request("/api/users", "POST", new_user_payload, token=admin_token)
    assert_test("Admin creates user via POST /api/users", status in [200, 201] and create_res.get("success") is True)
    created_user_id = create_res.get("user", {}).get("id")

    # Test login with newly created user
    status, login_res, _ = make_request("/api/auth/login", "POST", {
        "username": new_user_name,
        "password": "initialpassword123"
    })
    assert_test("Newly created user logs in successfully", status == 200 and login_res.get("success") is True)
    created_user_token = login_res.get("token")

    # Edit user: update role, email, password, and permissions
    if created_user_id:
        update_payload = {
            "fullName": "Senior Compliance Lead",
            "role": "staff",
            "title": "Head of Corporate Governance",
            "email": f"{new_user_name}_updated@spillburg.com",
            "password": "newpassword456",
            "permissions": {
                "operations": "full",
                "customer_files": "editor",
                "financial_files": "viewer"
            }
        }
        status, update_res, _ = make_request(f"/api/users/{created_user_id}", "PUT", update_payload, token=admin_token)
        assert_test("Admin updates user details, permissions, & password via PUT /api/users/<id>", status == 200 and update_res.get("success") is True)

        # Verify login with the updated password
        status, new_login, _ = make_request("/api/auth/login", "POST", {
            "username": new_user_name,
            "password": "newpassword456"
        })
        assert_test("Login with new updated password succeeds", status == 200 and new_login.get("success") is True)

    # Test Admin Self-Deletion Guard
    status, self_del_res, _ = make_request(f"/api/users/{admin_id}", "DELETE", token=admin_token)
    assert_test("Admin self-deletion blocked (HTTP 400)", status == 400 and "cannot delete your own" in self_del_res.get("error", ""))

    # Admin deletes the created test user
    if created_user_id:
        status, del_res, _ = make_request(f"/api/users/{created_user_id}", "DELETE", token=admin_token)
        assert_test("Admin deletes user account via DELETE /api/users/<id>", status == 200 and del_res.get("success") is True)

    # 7. Customer & Financial Databases
    print("\n--- 7. Testing Customer & Financial Databases ---")
    status, cust_res, _ = make_request("/api/customer-files", token=zaharan_token)
    assert_test(f"Customer files loaded from Access DB ({len(cust_res.get('records', []))} records)", status == 200 and len(cust_res.get("records", [])) >= 170)

    status, fin_res, _ = make_request("/api/financial-files", token=zaharan_token)
    assert_test(f"Financial records loaded ({len(fin_res.get('records', []))} records)", status == 200 and len(fin_res.get("records", [])) >= 40)

    print("\n" + "=" * 75)
    print(f" FINAL TEST RESULTS: {passed} PASSED, {failed} FAILED")
    print("=" * 75)
    return failed == 0

if __name__ == "__main__":
    try:
        urllib.request.urlopen(f"{BASE_URL}/", timeout=2)
        print(f"[INFO] Portal server already running on {BASE_URL}. Running test suite directly...")
        success = test_suite()
        sys.exit(0 if success else 1)
    except Exception:
        print(f"[INFO] Server not detected on {BASE_URL}. Starting temporary server instance...")
        server_py = os.path.join(BASE_DIR, "server.py")
        proc = subprocess.Popen([sys.executable, server_py, str(PORT)])
        ready = False
        for _ in range(20):
            time.sleep(0.5)
            try:
                with urllib.request.urlopen(f"{BASE_URL}/", timeout=1):
                    ready = True
                    break
            except Exception:
                pass
        if not ready:
            print("[ERROR] Server failed to start in time.")
            proc.terminate()
            sys.exit(1)

        try:
            success = test_suite()
        finally:
            print("[INFO] Terminating temporary test server...")
            proc.terminate()
            proc.wait()
        sys.exit(0 if success else 1)
