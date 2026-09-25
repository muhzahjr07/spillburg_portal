#!/usr/bin/env python3
"""
Spillburg Holdings Master Company Portal Server
A unified, zero-external-dependency HTTP & REST API server providing:
- Role-Based Access Control (Director, Admin, Staff with Editor/Viewer granularity)
- Operations Tracker (preloaded from Google Sheets)
- Customer File Database (connected to Office File Register.accdb via 32-bit PowerShell bridge)
- Financial Files Database (digitized from 44 physical register photos)
- Spillburg Corporate Hub (services, bilateral business councils, company info)
"""

import os
import sys
import json
import uuid
import time
import urllib.parse
import subprocess
import sqlite3
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
FINANCIAL_PHOTOS_DIR = os.path.join(BASE_DIR, "financial_files_db")
ACTIVE_CUSTOMER_DB = os.path.join(BASE_DIR, "customer_file_db", "Customer_Files_Active.accdb")
CUSTOMER_DB_PATH = ACTIVE_CUSTOMER_DB if os.path.exists(ACTIVE_CUSTOMER_DB) else os.path.join(BASE_DIR, "customer_file_db", "Office File Register.accdb")
SQLITE_CUSTOMER_DB = os.path.join(BASE_DIR, "customer_file_db", "customers.sqlite")
BRIDGE_SCRIPT = os.path.join(BASE_DIR, "access_bridge.ps1")
POWERSHELL_32 = r"C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"

# In-memory session store: token -> user dict
SESSIONS = {}

# In-memory caches for high-speed responsiveness
USERS = []
OPERATIONS = []
FINANCIAL_RECORDS = []
CUSTOMER_RECORDS = []

def load_json_file(filename, default_val):
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load {filename}: {e}")
    return default_val

def save_json_file(filename, data):
    path = os.path.join(DATA_DIR, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def init_data():
    global USERS, OPERATIONS, FINANCIAL_RECORDS, CUSTOMER_RECORDS
    USERS = load_json_file("users.json", [])
    OPERATIONS = load_json_file("operations.json", [])
    # Load from active financial database if present, else fallback
    active_fin = os.path.join(DATA_DIR, "financial_records_active.json")
    if os.path.exists(active_fin):
        FINANCIAL_RECORDS = load_json_file("financial_records_active.json", [])
    else:
        FINANCIAL_RECORDS = load_json_file("financial_records.json", [])
    
    # Initialize customer records from Access DB bridge
    sync_customer_records_from_access()
    print(f"[INIT] Active Cust DB: {CUSTOMER_DB_PATH}")
    print(f"[INIT] Loaded {len(USERS)} users, {len(OPERATIONS)} operations tasks, {len(FINANCIAL_RECORDS)} financial files, {len(CUSTOMER_RECORDS)} customer file records.")

def init_sqlite_db():
    os.makedirs(os.path.dirname(SQLITE_CUSTOMER_DB), exist_ok=True)
    conn = sqlite3.connect(SQLITE_CUSTOMER_DB)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS file_register (
            no TEXT PRIMARY KEY,
            registration_no TEXT,
            company_name TEXT,
            type TEXT,
            category TEXT,
            cupboard TEXT,
            box_no TEXT,
            date_of_incorporation TEXT
        )
    """)
    conn.commit()

    c.execute("SELECT COUNT(*) FROM file_register")
    count = c.fetchone()[0]
    if count == 0:
        cache_path = os.path.join(DATA_DIR, "customer_records_cache.json")
        records = []
        if os.path.exists(cache_path):
            records = load_json_file("customer_records_cache.json", [])
        for r in records:
            c.execute("""
                INSERT OR REPLACE INTO file_register (no, registration_no, company_name, type, category, cupboard, box_no, date_of_incorporation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(r.get("No", "")),
                r.get("Registration No", ""),
                r.get("Company Name", ""),
                r.get("Type", ""),
                r.get("Category", ""),
                r.get("Cupboard", ""),
                r.get("Box No", ""),
                r.get("Date of Incorporation", "")
            ))
        conn.commit()
    conn.close()

def query_sqlite(action, payload=None):
    init_sqlite_db()
    conn = sqlite3.connect(SQLITE_CUSTOMER_DB)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    try:
        if action == "GetRecords":
            c.execute("SELECT no as [No], registration_no as [Registration No], company_name as [Company Name], type as [Type], category as [Category], cupboard as [Cupboard], box_no as [Box No], date_of_incorporation as [Date of Incorporation] FROM file_register WHERE company_name IS NOT NULL AND company_name != '' ORDER BY company_name ASC")
            rows = [dict(r) for r in c.fetchall()]
            return {"success": True, "total": len(rows), "records": rows}

        elif action == "GetStats":
            c.execute("SELECT type, cupboard, company_name FROM file_register WHERE company_name IS NOT NULL AND company_name != ''")
            rows = c.fetchall()
            orig = sum(1 for r in rows if "original" in (r["type"] or "").lower())
            copy = sum(1 for r in rows if "copy" in (r["type"] or "").lower() or "customer" in (r["type"] or "").lower())
            cupboards = list(set(r["cupboard"] for r in rows if r["cupboard"]))
            companies = list(set(r["company_name"] for r in rows if r["company_name"]))
            return {
                "success": True,
                "totalRecords": len(rows),
                "originalCount": orig,
                "copyCount": copy,
                "uniqueCompaniesCount": len(companies),
                "cupboards": sorted(cupboards)
            }

        elif action == "AddRecord":
            data = payload or {}
            rec_no = str(data.get("No")) if data.get("No") else None
            if not rec_no:
                c.execute("SELECT no FROM file_register")
                nums = [int(r[0]) for r in c.fetchall() if r[0] and r[0].isdigit()]
                rec_no = str(max(nums, default=0) + 1)
            c.execute("""
                INSERT INTO file_register (no, registration_no, company_name, type, category, cupboard, box_no, date_of_incorporation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rec_no,
                data.get("Registration No", data.get("regNo", "")),
                data.get("Company Name", data.get("companyName", "")),
                data.get("Type", "Customer Files"),
                data.get("Category", "Customer Files"),
                data.get("Cupboard", "Cupboard 2"),
                data.get("Box No", data.get("boxNo", "")),
                data.get("Date of Incorporation", data.get("dateOfIncorporation", ""))
            ))
            conn.commit()
            return {"success": True, "message": "Record added successfully", "recordNo": rec_no}

        elif action == "DualOnboard":
            data = payload or {}
            c.execute("SELECT no FROM file_register")
            nums = [int(r[0]) for r in c.fetchall() if r[0] and r[0].isdigit()]
            no1 = str(max(nums, default=0) + 1)
            no2 = str(int(no1) + 1)

            # 1. Original
            c.execute("""
                INSERT INTO file_register (no, registration_no, company_name, type, category, cupboard, box_no, date_of_incorporation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                no1,
                data.get("RegistrationNo", data.get("regNo", "")),
                data.get("CompanyName", data.get("companyName", "")),
                "Original",
                "Original Files",
                data.get("Cupboard", "Cupboard 1"),
                data.get("BoxNo", data.get("originalBox", "Box 1")),
                data.get("DateOfIncorporation", data.get("dateOfIncorporation", ""))
            ))
            # 2. Customer Copy
            c.execute("""
                INSERT INTO file_register (no, registration_no, company_name, type, category, cupboard, box_no, date_of_incorporation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                no2,
                data.get("RegistrationNo", data.get("regNo", "")),
                data.get("CompanyName", data.get("companyName", "")),
                "Copy",
                "Customer Files",
                "Cupboard 2",
                data.get("BoxNo", data.get("copyBox", "Box 2")),
                data.get("DateOfIncorporation", data.get("dateOfIncorporation", ""))
            ))
            conn.commit()
            return {"success": True, "message": "Dual file records created successfully", "originalNo": no1, "copyNo": no2}

        elif action == "UpdateRecord":
            data = payload or {}
            c.execute("""
                UPDATE file_register
                SET registration_no = ?, company_name = ?, type = ?, category = ?, cupboard = ?, box_no = ?, date_of_incorporation = ?
                WHERE no = ?
            """, (
                data.get("Registration No", data.get("regNo", "")),
                data.get("Company Name", data.get("companyName", "")),
                data.get("Type", ""),
                data.get("Category", ""),
                data.get("Cupboard", ""),
                data.get("Box No", data.get("boxNo", "")),
                data.get("Date of Incorporation", data.get("dateOfIncorporation", "")),
                str(data.get("No"))
            ))
            conn.commit()
            return {"success": True, "message": "Record updated successfully"}

        elif action == "DeleteRecord":
            data = payload or {}
            c.execute("DELETE FROM file_register WHERE no = ?", (str(data.get("No")),))
            conn.commit()
            return {"success": True, "message": "Record deleted successfully"}

        elif action == "Backup":
            backup_dir = os.path.join(BASE_DIR, "customer_file_db", "backups")
            os.makedirs(backup_dir, exist_ok=True)
            ts = time.strftime("%Y%m%d_%H%M%S")
            fname = f"Customer_Files_backup_{ts}.sqlite"
            dest = os.path.join(backup_dir, fname)
            import shutil
            shutil.copyfile(SQLITE_CUSTOMER_DB, dest)
            return {"success": True, "filename": fname, "sizeBytes": os.path.getsize(dest), "created": time.strftime("%Y-%m-%d %H:%M:%S")}

        return {"success": False, "error": f"Unknown action {action}"}
    finally:
        conn.close()

def call_access_bridge(action, payload=None):
    # If running on Linux / Render / non-Windows, or if PowerShell/Access DB not available:
    if os.name != "nt" or not os.path.exists(CUSTOMER_DB_PATH) or not os.path.exists(BRIDGE_SCRIPT):
        return query_sqlite(action, payload)

    # On Windows: try PowerShell bridge first; if it fails, fallback to query_sqlite!
    try:
        ps_cmd = POWERSHELL_32 if os.path.exists(POWERSHELL_32) else "powershell.exe"
        cmd = [
            ps_cmd,
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", BRIDGE_SCRIPT,
            "-Action", action
        ]
        if payload is not None:
            cmd.extend(["-PayloadJson", json.dumps(payload)])
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        out = proc.stdout.strip()
        if out:
            start = out.find("{")
            end = out.rfind("}")
            if start != -1 and end != -1:
                res = json.loads(out[start:end+1])
                if res.get("success"):
                    try: query_sqlite(action, payload)
                    except Exception: pass
                    return res
    except Exception as e:
        print(f"[BRIDGE NOTICE] PowerShell bridge unavailable ({e}), using native database engine.")

    return query_sqlite(action, payload)

def sync_customer_records_from_access():
    global CUSTOMER_RECORDS
    init_sqlite_db()
    res = call_access_bridge("GetRecords")
    if res.get("success") and "records" in res:
        CUSTOMER_RECORDS = res["records"]
        save_json_file("customer_records_cache.json", CUSTOMER_RECORDS)
    else:
        CUSTOMER_RECORDS = load_json_file("customer_records_cache.json", [])

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class PortalRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def parse_body(self):
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len > 0:
            raw = self.rfile.read(content_len).decode("utf-8")
            try:
                return json.loads(raw)
            except Exception:
                return {}
        return {}

    def get_auth_user(self):
        auth_header = self.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        elif "token=" in self.headers.get("Cookie", ""):
            for part in self.headers.get("Cookie", "").split(";"):
                if part.strip().startswith("token="):
                    token = part.strip()[6:]
                    break
        
        if token and token in SESSIONS:
            user_id = SESSIONS[token]["userId"]
            for u in USERS:
                if u["id"] == user_id:
                    return u
        return None

    def require_permission(self, module, required_level="editor"):
        user = self.get_auth_user()
        if not user:
            self.send_json({"error": "Authentication required"}, 401)
            return None
        
        role = user.get("role", "staff")
        if role in ["director", "admin"]:
            return user
        
        user_perms = user.get("permissions", {})
        mod_perm = user_perms.get(module, "none")
        
        if required_level == "viewer":
            if mod_perm in ["viewer", "editor", "full"]:
                return user
        elif required_level == "editor":
            if mod_perm in ["editor", "full"]:
                return user
        elif required_level == "full":
            if mod_perm == "full":
                return user
        
        self.send_json({
            "error": f"Access Denied: You need '{required_level}' access for module '{module}'. Your permission level is '{mod_perm}'."
        }, 403)
        return None

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. API: Auth Me
        if path == "/api/auth/me":
            user = self.get_auth_user()
            if user:
                safe_user = dict(user)
                safe_user.pop("password", None)
                self.send_json({"authenticated": True, "user": safe_user})
            else:
                self.send_json({"authenticated": False}, 401)
            return

        # 2. API: Users List (Admin only)
        elif path == "/api/users":
            user = self.get_auth_user()
            if not user or user.get("role") != "admin":
                self.send_json({"error": "Admin privileges required"}, 403)
                return
            safe_list = []
            for u in USERS:
                cu = dict(u)
                cu.pop("password", None)
                safe_list.append(cu)
            self.send_json({"users": safe_list})
            return

        # 3. API: Company Overview
        elif path == "/api/company/overview":
            self.send_json({
                "companyName": "Spillburg Holdings (Pvt) Ltd",
                "tagline": "Connecting Global Investors with Sri Lankan Opportunity",
                "incorporationDate": "2010-06-24",
                "address": "Office 14, Basement Level, Cinnamon Lakeside Hotel, No 115, Sir Chittampalam A Gardiner Mawatha, Colombo 2, Sri Lanka",
                "contacts": {
                    "general": "+94 11 233 6116",
                    "sales1": "+94 77 748 7720",
                    "sales2": "+94 77 779 0919",
                    "fax": "+94 11 252 9309",
                    "email": "info@spillburg.com",
                    "website": "https://www.spillburg.com"
                },
                "leadership": [
                    {"name": "Mohamed Hussain Kariapper Hameez", "role": "Managing Director"},
                    {"name": "Mohamed Shaameel Mohideen", "role": "Director - Operations & Development"},
                    {"name": "Mr. Azad", "role": "Director - Designing & Strategy"}
                ],
                "services": [
                    "Bilateral Business Councils & Chamber Advocacy",
                    "Corporate Secretarial & Entity Onboarding",
                    "Foreign Direct Investment (FDI) Advisory",
                    "Tax Registration & IRD Compliance Management",
                    "Digital Transformation & Corporate Branding"
                ],
                "businessCouncils": [
                    "Sri Lanka - France Business Council",
                    "Sri Lanka - Japan Business Council",
                    "Bilateral Chambers of Commerce"
                ]
            })
            return

        # 4. API: Operations Tracker (Personalized per user)
        elif path == "/api/operations":
            user = self.require_permission("operations", "viewer")
            if not user: return
            
            search = query.get("search", [""])[0].lower()
            workstream = query.get("workstream", [""])[0]
            status = query.get("status", [""])[0]
            priority = query.get("priority", [""])[0]
            requestedBy = query.get("requestedBy", [""])[0]
            for_user = query.get("forUser", [""])[0]
            role = user.get("role", "staff")

            # User scoping: Director & Admin can inspect all or specific users;
            # by default (and always for staff), return strictly the user's personal tasks.
            if for_user and role in ["director", "admin"]:
                if for_user.lower() == "all":
                    base_tasks = list(OPERATIONS)
                else:
                    base_tasks = [t for t in OPERATIONS if t.get("userId") == for_user or t.get("ownerUsername") == for_user]
            else:
                base_tasks = [t for t in OPERATIONS if t.get("userId") == user.get("id") or t.get("ownerUsername") == user.get("username")]

            filtered = base_tasks
            if search:
                filtered = [t for t in filtered if search in t.get("title", "").lower() or search in t.get("notes", "").lower()]
            if workstream:
                filtered = [t for t in filtered if t.get("workstream", "").lower() == workstream.lower()]
            if status:
                filtered = [t for t in filtered if t.get("status", "").lower() == status.lower()]
            if priority:
                filtered = [t for t in filtered if t.get("priority", "").lower() == priority.lower()]
            if requestedBy:
                filtered = [t for t in filtered if t.get("requestedBy", "").lower() == requestedBy.lower()]

            self.send_json({"total": len(filtered), "tasks": filtered})
            return

        elif path == "/api/operations/stats":
            user = self.require_permission("operations", "viewer")
            if not user: return

            for_user = query.get("forUser", [""])[0]
            role = user.get("role", "staff")

            if for_user and role in ["director", "admin"]:
                if for_user.lower() == "all":
                    base_tasks = list(OPERATIONS)
                else:
                    base_tasks = [t for t in OPERATIONS if t.get("userId") == for_user or t.get("ownerUsername") == for_user]
            else:
                base_tasks = [t for t in OPERATIONS if t.get("userId") == user.get("id") or t.get("ownerUsername") == user.get("username")]

            total = len(base_tasks)
            pending = sum(1 for t in base_tasks if t.get("status") == "Pending")
            in_prog = sum(1 for t in base_tasks if t.get("status") == "In Progress")
            completed = sum(1 for t in base_tasks if t.get("status") == "Completed")
            on_hold = sum(1 for t in base_tasks if t.get("status") == "On Hold")
            pct = round((completed / total * 100), 1) if total else 0

            # Workstream counts
            workstreams = {}
            for t in base_tasks:
                ws = t.get("workstream", "General")
                workstreams[ws] = workstreams.get(ws, 0) + 1

            self.send_json({
                "total": total,
                "pending": pending,
                "inProgress": in_prog,
                "completed": completed,
                "onHold": on_hold,
                "progressPercentage": pct,
                "workstreams": workstreams
            })
            return

        # 5. API: Financial Files Database
        elif path == "/api/financial-files":
            user = self.require_permission("financial_files", "viewer")
            if not user: return

            search = query.get("search", [""])[0].lower()
            category = query.get("category", [""])[0]

            filtered = list(FINANCIAL_RECORDS)
            if search:
                filtered = [r for r in filtered if (
                    search in r.get("entityName", "").lower() or
                    search in r.get("tinNo", "").lower() or
                    search in r.get("directorName", "").lower() or
                    search in r.get("ssid", "").lower() or
                    search in r.get("notes", "").lower() or
                    search in r.get("regNo", "").lower()
                )]
            if category:
                filtered = [r for r in filtered if r.get("category", "").lower() == category.lower()]

            self.send_json({
                "total": len(filtered),
                "records": filtered,
                "categories": list(set(r.get("category", "Corporate") for r in FINANCIAL_RECORDS))
            })
            return

        elif path.startswith("/api/financial-files/photos/"):
            user = self.require_permission("financial_files", "viewer")
            if not user: return
            photo_name = urllib.parse.unquote(path.replace("/api/financial-files/photos/", ""))
            photo_path = os.path.join(FINANCIAL_PHOTOS_DIR, photo_name)
            if os.path.exists(photo_path) and photo_path.lower().endswith(('.jpg', '.jpeg', '.png')):
                with open(photo_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Cache-Control", "public, max-age=86400")
                self.end_headers()
                self.wfile.write(content)
                return
            else:
                self.send_json({"error": "Photo not found"}, 404)
                return

        # 6. API: Customer File Database (Connected to Access)
        elif path == "/api/customer-files":
            user = self.require_permission("customer_files", "viewer")
            if not user: return

            search = query.get("search", [""])[0].lower()
            cupboard = query.get("cupboard", [""])[0]
            box = query.get("box", [""])[0]
            file_type = query.get("type", [""])[0]

            filtered = list(CUSTOMER_RECORDS)
            if search:
                filtered = [r for r in filtered if (
                    search in str(r.get("Company Name", "")).lower() or
                    search in str(r.get("Registration No", "")).lower() or
                    search in str(r.get("Box No", "")).lower() or
                    search in str(r.get("No", "")).lower()
                )]
            if cupboard:
                filtered = [r for r in filtered if str(r.get("Cupboard", "")).lower() == cupboard.lower()]
            if box:
                filtered = [r for r in filtered if str(r.get("Box No", "")).lower() == box.lower()]
            if file_type:
                filtered = [r for r in filtered if file_type.lower() in str(r.get("Type", "")).lower()]

            cupboards = sorted(list(set(str(r.get("Cupboard")) for r in CUSTOMER_RECORDS if r.get("Cupboard"))))
            boxes = sorted(list(set(str(r.get("Box No")) for r in CUSTOMER_RECORDS if r.get("Box No"))))

            self.send_json({
                "total": len(filtered),
                "records": filtered,
                "cupboards": cupboards,
                "boxes": boxes
            })
            return

        elif path == "/api/customer-files/stats":
            user = self.require_permission("customer_files", "viewer")
            if not user: return

            orig = sum(1 for r in CUSTOMER_RECORDS if "original" in str(r.get("Type", "")).lower())
            copy = sum(1 for r in CUSTOMER_RECORDS if "copy" in str(r.get("Type", "")).lower() or "customer" in str(r.get("Type", "")).lower())
            unique_comps = len(set(str(r.get("Company Name")) for r in CUSTOMER_RECORDS if r.get("Company Name")))

            # Cupboard breakdown
            cupboard_counts = {}
            for r in CUSTOMER_RECORDS:
                c = r.get("Cupboard", "Unassigned")
                cupboard_counts[c] = cupboard_counts.get(c, 0) + 1

            self.send_json({
                "total": len(CUSTOMER_RECORDS),
                "originalCount": orig,
                "copyCount": copy,
                "uniqueCompanies": unique_comps,
                "cupboards": cupboard_counts
            })
            return

        # 7. Static file serving (SPA)
        if path == "/" or path == "/index.html":
            file_path = os.path.join(PUBLIC_DIR, "index.html")
            self.serve_static_file(file_path, "text/html; charset=utf-8")
            return
        elif path.startswith("/public/"):
            rel = path[8:]
            file_path = os.path.join(PUBLIC_DIR, rel)
            self.serve_static_file(file_path)
            return

        # Fallback for SPA routing
        fallback = os.path.join(PUBLIC_DIR, "index.html")
        if os.path.exists(fallback):
            self.serve_static_file(fallback, "text/html; charset=utf-8")
        else:
            self.send_json({"error": "Not Found"}, 404)

    def serve_static_file(self, file_path, content_type=None):
        if not os.path.exists(file_path):
            self.send_json({"error": "File Not Found"}, 404)
            return

        if not content_type:
            if file_path.endswith(".html"): content_type = "text/html; charset=utf-8"
            elif file_path.endswith(".css"): content_type = "text/css; charset=utf-8"
            elif file_path.endswith(".js"): content_type = "application/javascript; charset=utf-8"
            elif file_path.endswith(".json"): content_type = "application/json; charset=utf-8"
            elif file_path.endswith(".svg"): content_type = "image/svg+xml"
            elif file_path.endswith(".png"): content_type = "image/png"
            elif file_path.endswith((".jpg", ".jpeg")): content_type = "image/jpeg"
            else: content_type = "application/octet-stream"

        with open(file_path, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()

        # 1. Register (Public registration disabled - moved to Admin Panel)
        if path == "/api/auth/register":
            self.send_json({
                "success": False,
                "error": "Public registration is disabled. All user accounts must be provisioned by an Administrator in the Access Control panel."
            }, 403)
            return

        # 2. Login
        elif path == "/api/auth/login":
            username = body.get("username", "").strip().lower()
            password = body.get("password", "")
            
            matched = None
            for u in USERS:
                if u["username"].lower() == username and u["password"] == password:
                    matched = u
                    break

            if matched:
                token = f"tok_{uuid.uuid4().hex}"
                SESSIONS[token] = {
                    "userId": matched["id"],
                    "createdAt": time.time()
                }
                safe_user = dict(matched)
                safe_user.pop("password", None)
                self.send_json({
                    "success": True,
                    "token": token,
                    "user": safe_user
                })
            else:
                self.send_json({"success": False, "error": "Invalid username or password"}, 401)
            return

        # 3. Logout
        elif path == "/api/auth/logout":
            auth_header = self.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                t = auth_header[7:].strip()
                SESSIONS.pop(t, None)
            self.send_json({"success": True})
            return

        # 4. Users: Create (Admin Panel only)
        elif path == "/api/users":
            user = self.get_auth_user()
            if not user or user.get("role") != "admin":
                self.send_json({"error": "Admin privileges required to create accounts"}, 403)
                return

            username = body.get("username", "").strip().lower()
            password = body.get("password", "spillburg123").strip()
            full_name = body.get("fullName", "").strip()
            role = body.get("role", "staff").strip().lower()
            title = body.get("title", "Staff Member").strip()
            email = body.get("email", "").strip().lower()

            if not username or not full_name or not password:
                self.send_json({"error": "Full Name, Username, and Password are all required."}, 400)
                return

            if any(u["username"].lower() == username for u in USERS):
                self.send_json({"error": f"Username '{username}' is already in use. Please choose another."}, 400)
                return

            if role not in ["staff", "director", "admin"]:
                role = "staff"

            new_user_id = f"usr_{uuid.uuid4().hex[:8]}"
            perms = body.get("permissions", {
                "operations": "editor" if role != "staff" else "viewer",
                "customer_files": "viewer",
                "financial_files": "viewer",
                "user_management": "full" if role == "admin" else "none"
            })

            new_user = {
                "id": new_user_id,
                "username": username,
                "password": password,
                "fullName": full_name,
                "role": role,
                "title": title or "Staff Associate",
                "email": email or f"{username}@spillburg.com",
                "permissions": perms,
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "status": "active"
            }
            USERS.append(new_user)
            save_json_file("users.json", USERS)

            # Auto-create starter task in this new user's personal operations tracker
            init_task = {
                "id": f"ops_{uuid.uuid4().hex[:6]}",
                "no": 1,
                "userId": new_user_id,
                "ownerUsername": username,
                "title": f"Spillburg Portal Onboarding - {title or 'Staff'}",
                "requestedBy": user.get("fullName", "Administrator"),
                "assignedTo": full_name,
                "workstream": "Personal Tasks",
                "type": "Onboarding",
                "taskedDate": time.strftime("%Y-%m-%d"),
                "completedDate": "",
                "status": "In Progress",
                "priority": "Medium",
                "estimatedCost": "",
                "notes": "Welcome to Spillburg Holdings. Review your assigned registers and manage your personal deliverables."
            }
            OPERATIONS.insert(0, init_task)
            save_json_file("operations.json", OPERATIONS)

            safe = dict(new_user)
            safe.pop("password", None)
            self.send_json({"success": True, "user": safe})
            return
            return

        # 5. Operations: Add task (Personalized to user)
        elif path == "/api/operations":
            user = self.require_permission("operations", "editor")
            if not user: return

            user_tasks = [t for t in OPERATIONS if t.get("userId") == user.get("id")]
            new_no = max([t.get("no", 0) for t in user_tasks] or [0]) + 1
            new_task = {
                "id": f"ops_{uuid.uuid4().hex[:6]}",
                "no": new_no,
                "userId": user.get("id"),
                "ownerUsername": user.get("username"),
                "title": body.get("title", "Untitled Task"),
                "requestedBy": body.get("requestedBy", user.get("fullName", "Self")),
                "assignedTo": body.get("assignedTo", user.get("fullName", "Self")),
                "workstream": body.get("workstream", "Office Operations"),
                "type": body.get("type", "Operational Task"),
                "taskedDate": body.get("taskedDate", time.strftime("%Y-%m-%d")),
                "completedDate": body.get("completedDate", ""),
                "status": body.get("status", "Pending"),
                "priority": body.get("priority", "Medium"),
                "estimatedCost": body.get("estimatedCost", ""),
                "notes": body.get("notes", "")
            }
            OPERATIONS.append(new_task)
            save_json_file("operations.json", OPERATIONS)
            self.send_json({"success": True, "task": new_task})
            return

        # 6. Financial Files: Add record (Editor, Admin, Director)
        elif path == "/api/financial-files":
            user = self.require_permission("financial_files", "editor")
            if not user: return

            rec_id = f"fin_{uuid.uuid4().hex[:6]}"
            new_rec = {
                "id": rec_id,
                "entityName": body.get("entityName", "New Entity"),
                "category": body.get("category", "Corporate"),
                "regNo": body.get("regNo", ""),
                "dateOfIncorp": body.get("dateOfIncorp", ""),
                "tinNo": body.get("tinNo", ""),
                "economicCode": body.get("economicCode", ""),
                "irdPin": body.get("irdPin", ""),
                "irdPassword": body.get("irdPassword", ""),
                "irdEmail": body.get("irdEmail", ""),
                "ssid": body.get("ssid", ""),
                "ssidPin": body.get("ssidPin", ""),
                "directorName": body.get("directorName", ""),
                "directorPassportOrId": body.get("directorPassportOrId", ""),
                "emails": body.get("emails", ""),
                "phones": body.get("phones", ""),
                "filingStatus": body.get("filingStatus", ""),
                "notes": body.get("notes", ""),
                "photoFile": body.get("photoFile", "")
            }
            FINANCIAL_RECORDS.insert(0, new_rec)
            save_json_file("financial_records_active.json", FINANCIAL_RECORDS)
            self.send_json({"success": True, "record": new_rec})
            return

        # 7. Customer Files: Add Single Record (Editor, Admin, Director)
        elif path == "/api/customer-files":
            user = self.require_permission("customer_files", "editor")
            if not user: return

            res = call_access_bridge("AddRecord", body)
            if res.get("success"):
                sync_customer_records_from_access()
                self.send_json(res)
            else:
                self.send_json({"success": False, "error": res.get("error", "Access bridge error")}, 500)
            return

        # 7. Customer Files: Dual Onboarding (Editor, Admin, Director)
        elif path == "/api/customer-files/dual":
            user = self.require_permission("customer_files", "editor")
            if not user: return

            res = call_access_bridge("DualOnboard", body)
            if res.get("success"):
                sync_customer_records_from_access()
                self.send_json(res)
            else:
                self.send_json({"success": False, "error": res.get("error", "Access bridge error")}, 500)
            return

        # 8. Customer Files: Backup (Admin, Director)
        elif path == "/api/customer-files/backup":
            user = self.get_auth_user()
            if not user or user.get("role") not in ["director", "admin"]:
                self.send_json({"error": "Director or Admin privileges required"}, 403)
                return
            res = call_access_bridge("Backup")
            self.send_json(res)
            return

        self.send_json({"error": "Endpoint not found"}, 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()

        # 1. Users: Update role & permissions (Admin only)
        if path.startswith("/api/users/"):
            user = self.get_auth_user()
            if not user or user.get("role") != "admin":
                self.send_json({"error": "Admin privileges required"}, 403)
                return

            user_id = path.replace("/api/users/", "")
            target = None
            for u in USERS:
                if u["id"] == user_id:
                    target = u
                    break

            if not target:
                self.send_json({"error": "User not found"}, 404)
                return

            if "role" in body: target["role"] = body["role"]
            if "fullName" in body: target["fullName"] = body["fullName"]
            if "title" in body: target["title"] = body["title"]
            if "email" in body: target["email"] = body["email"]
            if "permissions" in body: target["permissions"] = body["permissions"]
            if "status" in body: target["status"] = body["status"]
            if "password" in body and body["password"]: target["password"] = body["password"]

            save_json_file("users.json", USERS)
            safe = dict(target)
            safe.pop("password", None)
            self.send_json({"success": True, "user": safe})
            return

        # 2. Operations: Update Task (Editor, Admin, Director)
        elif path.startswith("/api/operations/"):
            user = self.require_permission("operations", "editor")
            if not user: return

            task_id = path.replace("/api/operations/", "")
            target = None
            for t in OPERATIONS:
                if str(t.get("id")) == str(task_id) or str(t.get("no")) == str(task_id):
                    target = t
                    break

            if not target:
                self.send_json({"error": "Task not found"}, 404)
                return

            if user.get("role") not in ["director", "admin"] and target.get("userId") != user.get("id"):
                self.send_json({"error": "Access Denied: You can only edit your own tasks"}, 403)
                return

            for key in ["title", "requestedBy", "assignedTo", "workstream", "type", "taskedDate", "completedDate", "status", "priority", "estimatedCost", "notes"]:
                if key in body:
                    target[key] = body[key]

            save_json_file("operations.json", OPERATIONS)
            self.send_json({"success": True, "task": target})
            return

        # 3. Financial Files: Update Record (Editor, Admin, Director)
        elif path.startswith("/api/financial-files/"):
            user = self.require_permission("financial_files", "editor")
            if not user: return

            rec_id = path.replace("/api/financial-files/", "")
            target = None
            for r in FINANCIAL_RECORDS:
                if str(r.get("id")) == str(rec_id):
                    target = r
                    break

            if not target:
                self.send_json({"error": "Financial record not found"}, 404)
                return

            for key in ["entityName", "category", "regNo", "dateOfIncorp", "tinNo", "economicCode", "irdPin", "irdPassword", "irdEmail", "ssid", "ssidPin", "directorName", "directorPassportOrId", "emails", "phones", "filingStatus", "notes", "photoFile"]:
                if key in body:
                    target[key] = body[key]

            save_json_file("financial_records_active.json", FINANCIAL_RECORDS)
            self.send_json({"success": True, "record": target})
            return

        # 4. Customer Files: Update Record (Editor, Admin, Director)
        elif path.startswith("/api/customer-files/"):
            user = self.require_permission("customer_files", "editor")
            if not user: return

            res = call_access_bridge("UpdateRecord", body)
            if res.get("success"):
                sync_customer_records_from_access()
                self.send_json(res)
            else:
                self.send_json({"success": False, "error": res.get("error", "Access bridge update failed")}, 500)
            return

        self.send_json({"error": "Endpoint not found"}, 404)

    def do_DELETE(self):
        global USERS, OPERATIONS, FINANCIAL_RECORDS
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. Users: Delete (Admin only)
        if path.startswith("/api/users/"):
            user = self.get_auth_user()
            if not user or user.get("role") != "admin":
                self.send_json({"error": "Admin privileges required"}, 403)
                return

            user_id = path.replace("/api/users/", "")
            if user.get("id") == user_id:
                self.send_json({"error": "Security Alert: You cannot delete your own active administrator account."}, 400)
                return

            USERS = [u for u in USERS if u["id"] != user_id]
            save_json_file("users.json", USERS)
            self.send_json({"success": True, "message": "User access revoked"})
            return

        # 2. Operations: Delete Task (Editor, Admin, Director)
        elif path.startswith("/api/operations/"):
            user = self.require_permission("operations", "editor")
            if not user: return

            task_id = path.replace("/api/operations/", "")
            target = None
            for t in OPERATIONS:
                if str(t.get("id")) == str(task_id) or str(t.get("no")) == str(task_id):
                    target = t
                    break
            if not target:
                self.send_json({"error": "Task not found"}, 404)
                return

            if user.get("role") not in ["director", "admin"] and target.get("userId") != user.get("id"):
                self.send_json({"error": "Access Denied: You can only delete your own tasks"}, 403)
                return

            OPERATIONS = [t for t in OPERATIONS if str(t.get("id")) != str(task_id) and str(t.get("no")) != str(task_id)]
            save_json_file("operations.json", OPERATIONS)
            self.send_json({"success": True, "message": "Task deleted"})
            return

        # 3. Financial Files: Delete Record (Editor, Admin, Director)
        elif path.startswith("/api/financial-files/"):
            user = self.require_permission("financial_files", "editor")
            if not user: return

            rec_id = path.replace("/api/financial-files/", "")
            FINANCIAL_RECORDS = [r for r in FINANCIAL_RECORDS if str(r.get("id")) != str(rec_id)]
            save_json_file("financial_records_active.json", FINANCIAL_RECORDS)
            self.send_json({"success": True, "message": "Financial record removed"})
            return

        # 4. Customer Files: Delete Record (Editor, Admin, Director)
        elif path.startswith("/api/customer-files/"):
            user = self.require_permission("customer_files", "editor")
            if not user: return

            rec_no = path.replace("/api/customer-files/", "")
            res = call_access_bridge("DeleteRecord", {"No": rec_no})
            if res.get("success"):
                sync_customer_records_from_access()
                self.send_json(res)
            else:
                self.send_json({"success": False, "error": res.get("error", "Access bridge delete failed")}, 500)
            return

        self.send_json({"error": "Endpoint not found"}, 404)

def run(port=8080):
    init_data()
    server_address = ("0.0.0.0", port)
    httpd = ThreadedHTTPServer(server_address, PortalRequestHandler)
    print("=" * 65)
    print("    SPILLBURG HOLDINGS - MASTER ENTERPRISE COMPANY PORTAL     ")
    print("=" * 65)
    print(f" Web Server Active:  http://127.0.0.1:{port}")
    print(f" Public Folder:      {PUBLIC_DIR}")
    print(f" Access DB:          {CUSTOMER_DB_PATH}")
    print(f" Financial Photos:   {FINANCIAL_PHOTOS_DIR}")
    print("=" * 65)
    print(" Default Login Accounts:")
    print("   - Director:  username 'director'  password 'director123' (Full Access)")
    print("   - Admin:     username 'admin'     password 'admin123'    (Full + User Access Control)")
    print("   - Staff (Ed):username 'staff_editor' password 'staff123' (Editor perms)")
    print("   - Staff (Vw):username 'staff_viewer' password 'staff123' (Viewer read-only)")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping portal server...")
        httpd.server_close()

if __name__ == "__main__":
    p = 8080
    if "PORT" in os.environ:
        try:
            p = int(os.environ["PORT"])
        except ValueError:
            pass
    elif len(sys.argv) > 1:
        try:
            p = int(sys.argv[1])
        except ValueError:
            pass
    run(p)
