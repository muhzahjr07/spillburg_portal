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
import copy
import shutil
import urllib.parse
import subprocess
import sqlite3
import re
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
PAYROLL_RECORDS = {}

# Canonical Default Users Format (Preserved baseline - do NOT wipe or alter on portal updates)
DEFAULT_USERS = [
    {
        "id": "usr_dir_master",
        "username": "director",
        "password": "director123",
        "fullName": "Executive Director",
        "role": "director",
        "title": "Managing Director / Board Member",
        "email": "director@spillburg.com",
        "permissions": {
            "operations": "full",
            "customer_files": "full",
            "financial_files": "full",
            "user_management": "full"
        },
        "createdAt": "2026-09-01T08:00:00Z",
        "status": "active"
    },
    {
        "id": "usr_staff_insaaf",
        "username": "staff_insaaf",
        "password": "staff123",
        "fullName": "Insaaf",
        "role": "staff",
        "title": "Customer Database Coordinator",
        "email": "insaaf@spillburg.com",
        "permissions": {
            "operations": "editor",
            "customer_files": "editor",
            "financial_files": "none",
            "user_management": "none"
        },
        "createdAt": "2026-09-12T10:00:00Z",
        "status": "active"
    },
    {
        "id": "usr_staff_hemanthi",
        "username": "staff_hemanthi",
        "password": "staff123",
        "fullName": "Miss Hemanthi",
        "role": "staff",
        "title": "Office Operations Officer",
        "email": "hemanthi@spillburg.com",
        "permissions": {
            "operations": "editor",
            "customer_files": "editor",
            "financial_files": "editor",
            "user_management": "none"
        },
        "createdAt": "2026-09-10T09:30:00Z",
        "status": "active"
    },
    {
        "id": "usr_dir_hameez",
        "username": "hameez",
        "password": "spillburg123",
        "fullName": "Mohamed Hussain Kariapper Hameez",
        "role": "director",
        "title": "Managing Director",
        "email": "hameezm@yahoo.com",
        "permissions": {
            "operations": "full",
            "customer_files": "full",
            "financial_files": "full",
            "user_management": "full"
        },
        "createdAt": "2026-09-01T08:00:00Z",
        "status": "active"
    },
    {
        "id": "usr_dir_shameel",
        "username": "shameel",
        "password": "spillburg123",
        "fullName": "Mohamed Shaameel Mohideen",
        "role": "director",
        "title": "Director/CEO",
        "email": "shaameelmohideen@gmail.com",
        "permissions": {
            "operations": "full",
            "customer_files": "full",
            "financial_files": "full",
            "user_management": "full"
        },
        "createdAt": "2026-09-01T08:00:00Z",
        "status": "active"
    },
    {
        "id": "usr_admin_zaharan",
        "username": "zaharan",
        "password": "admin123",
        "fullName": "Muhammad Zaharan",
        "role": "admin",
        "title": "Operations & Systems Admin",
        "email": "zaharan@spillburg.com",
        "permissions": {
            "operations": "full",
            "customer_files": "full",
            "financial_files": "full",
            "user_management": "full"
        },
        "createdAt": "2026-09-01T08:00:00Z",
        "status": "active"
    },
    {
        "id": "usr_staff_editor",
        "username": "staff_editor",
        "password": "staff123",
        "fullName": "Staff Member (Editor)",
        "role": "staff",
        "title": "Senior Operations Executive",
        "email": "editor@spillburg.com",
        "permissions": {
            "operations": "editor",
            "customer_files": "editor",
            "financial_files": "editor",
            "user_management": "none"
        },
        "createdAt": "2026-09-15T11:00:00Z",
        "status": "active"
    },
    {
        "id": "usr_staff_viewer",
        "username": "staff_viewer",
        "password": "staff123",
        "fullName": "Staff Member (Viewer)",
        "role": "staff",
        "title": "Research & Audit Assistant",
        "email": "viewer@spillburg.com",
        "permissions": {
            "operations": "viewer",
            "customer_files": "viewer",
            "financial_files": "viewer",
            "user_management": "none"
        },
        "createdAt": "2026-09-15T11:00:00Z",
        "status": "active"
    },
    {
        "id": "usr_admin_master",
        "username": "admin",
        "password": "admin123",
        "fullName": "System Administrator",
        "role": "admin",
        "title": "Corporate Portal Administrator",
        "email": "admin@spillburg.com",
        "permissions": {
            "operations": "full",
            "customer_files": "full",
            "financial_files": "full",
            "user_management": "full"
        },
        "createdAt": "2026-09-01T08:00:00Z",
        "status": "active"
    }
]

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
    temp_path = path + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    if os.path.exists(path):
        try:
            shutil.copy2(path, path + ".bak")
        except Exception:
            pass
    shutil.move(temp_path, path)

def sync_users_from_disk():
    global USERS
    disk_users = load_json_file("users.json", None)
    if disk_users and isinstance(disk_users, list) and len(disk_users) > 0:
        USERS = disk_users
    return USERS

def init_data():
    global USERS, OPERATIONS, FINANCIAL_RECORDS, CUSTOMER_RECORDS
    existing_users = load_json_file("users.json", None)
    if not existing_users or not isinstance(existing_users, list) or len(existing_users) == 0:
        USERS = copy.deepcopy(DEFAULT_USERS)
        save_json_file("users.json", USERS)
        print(f"[INIT] Initialized default user format with {len(USERS)} accounts.")
    else:
        USERS = existing_users
        print(f"[INIT] Loaded {len(USERS)} user accounts from users.json (all user edits and additions preserved).")

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

    # Initialize payroll records
    global PAYROLL_RECORDS
    PAYROLL_RECORDS = load_json_file("payroll_records.json", {})
    print(f"[INIT] Active portal ready with {len(USERS)} users, {len(OPERATIONS)} operations tasks, {len(FINANCIAL_RECORDS)} financial files, {len(CUSTOMER_RECORDS)} customer file records, {len(PAYROLL_RECORDS.get('periods', []))} payroll cycles.")

def save_payroll_records():
    global PAYROLL_RECORDS
    save_json_file("payroll_records.json", PAYROLL_RECORDS)

def calculate_apit_tax(gross_lkr):
    g = float(gross_lkr or 0.0)
    if g <= 150000.0:
        return 0.0
    elif g <= 191666.67:
        return round((g - 150000.0) * 0.06)
    elif g <= 233333.33:
        return round(g * 0.12 - 11500.0)
    elif g <= 275000.0:
        return round(g * 0.18 - 25500.0)
    elif g <= 316666.67:
        return round(g * 0.24 - 42000.0)
    elif g <= 358333.33:
        return round(g * 0.30 - 61000.0)
    else:
        return round(g * 0.36 - 94000.0)

def compute_employee_payroll(emp, exchange_rate):
    gbp_salary = float(emp.get('gbpSalary') or 0.0)
    earned_gbp = float(emp.get('earnedGbp') if emp.get('earnedGbp') is not None else gbp_salary)
    
    epf12_gbp = round(earned_gbp * 0.12)
    etf3_gbp = round(earned_gbp * 0.03)
    total_gbp = round(earned_gbp + epf12_gbp + etf3_gbp, 2)
    
    rate = float(exchange_rate or 440.0)
    lkr_gross = round(earned_gbp * rate)
    special_allowance = float(emp.get('specialAllowance') or 0.0)
    total_gross_lkr = lkr_gross + special_allowance
    
    no_pay_late = float(emp.get('noPayLate') or 0.0)
    net_total_gross = total_gross_lkr - no_pay_late
    
    epf8_lkr = round(lkr_gross * 0.08)
    epf12_lkr = round(lkr_gross * 0.12)
    etf3_lkr = round(lkr_gross * 0.03)
    
    if emp.get('apit') is not None and str(emp.get('apit')).strip() != '':
        apit = float(emp.get('apit'))
    else:
        apit = float(calculate_apit_tax(lkr_gross))
        
    advance = float(emp.get('advance') or 0.0)
    loan = float(emp.get('loan') or 0.0)
    
    total_deductions = epf8_lkr + apit + advance + loan
    net_salary_lkr = round(net_total_gross - total_deductions)
    
    return {
        **emp,
        'gbpSalary': gbp_salary,
        'earnedGbp': earned_gbp,
        'epf12Gbp': epf12_gbp,
        'etf3Gbp': etf3_gbp,
        'totalGbp': total_gbp,
        'lkrGross': lkr_gross,
        'specialAllowance': special_allowance,
        'totalGrossLkr': total_gross_lkr,
        'noPayLate': no_pay_late,
        'netTotalGross': net_total_gross,
        'epf8Lkr': epf8_lkr,
        'epf12Lkr': epf12_lkr,
        'etf3Lkr': etf3_lkr,
        'apit': apit,
        'advance': advance,
        'loan': loan,
        'totalDeductions': total_deductions,
        'netSalaryLkr': net_salary_lkr
    }

def enrich_payroll_period(period):
    rate = float(period.get('exchangeRate', 440.0))
    employees = period.get('employees', [])
    computed_emps = []
    
    sum_gbp_salary = 0.0
    sum_earned_gbp = 0.0
    sum_epf12_gbp = 0.0
    sum_etf3_gbp = 0.0
    sum_total_gbp = 0.0
    sum_lkr_gross = 0.0
    sum_epf8_lkr = 0.0
    sum_epf12_lkr = 0.0
    sum_etf3_lkr = 0.0
    sum_apit_lkr = 0.0
    sum_deductions_lkr = 0.0
    sum_net_salary_lkr = 0.0
    
    for emp in employees:
        c = compute_employee_payroll(emp, rate)
        computed_emps.append(c)
        sum_gbp_salary += c['gbpSalary']
        sum_earned_gbp += c['earnedGbp']
        sum_epf12_gbp += c['epf12Gbp']
        sum_etf3_gbp += c['etf3Gbp']
        sum_total_gbp += c['totalGbp']
        sum_lkr_gross += c['lkrGross']
        sum_epf8_lkr += c['epf8Lkr']
        sum_epf12_lkr += c['epf12Lkr']
        sum_etf3_lkr += c['etf3Lkr']
        sum_apit_lkr += c['apit']
        sum_deductions_lkr += c['totalDeductions']
        sum_net_salary_lkr += c['netSalaryLkr']
        
    enriched = copy.deepcopy(period)
    enriched['employees'] = computed_emps
    enriched['totals'] = {
        'totalEmployees': len(computed_emps),
        'sumGbpSalary': round(sum_gbp_salary, 2),
        'sumEarnedGbp': round(sum_earned_gbp, 2),
        'sumEpf12Gbp': round(sum_epf12_gbp, 2),
        'sumEtf3Gbp': round(sum_etf3_gbp, 2),
        'sumTotalGbp': round(sum_total_gbp, 2),
        'sumLkrGross': round(sum_lkr_gross, 2),
        'sumEpf8Lkr': round(sum_epf8_lkr, 2),
        'sumEpf12Lkr': round(sum_epf12_lkr, 2),
        'sumEtf3Lkr': round(sum_etf3_lkr, 2),
        'sumApitLkr': round(sum_apit_lkr, 2),
        'sumDeductionsLkr': round(sum_deductions_lkr, 2),
        'sumNetSalaryLkr': round(sum_net_salary_lkr, 2)
    }
    return enriched

def generate_payroll_csv(enriched_period):
    month = enriched_period.get("month", "Period")
    rate = enriched_period.get("exchangeRate", 440.0)
    employees = enriched_period.get("employees", [])
    totals = enriched_period.get("totals", {})

    lines = []
    lines.append(f'SALARY SHEET (IN GBP ) - {month.upper()}')
    lines.append('No,Employee Name,POSITION,GBP Salary,Working Days,Earned Base (GBP),EPF (12% ),ETF(3% ),Total Employer Cost (GBP),BANK ACCOUNT NO,TIN NO,IDNO,Date of Joined')
    for e in employees:
        bank_str = f"{e.get('bankAccountNo','')}({e.get('bankCode','')})" if e.get('bankCode') else str(e.get('bankAccountNo',''))
        lines.append(f'"{e.get("no","")}","{e.get("name","")}","{e.get("position","")}",{e.get("gbpSalary",0)},"{e.get("workDays","")}",{e.get("earnedGbp",0)},{e.get("epf12Gbp",0)},{e.get("etf3Gbp",0)},{e.get("totalGbp",0)},"{bank_str}","{e.get("tinNo","")}","{e.get("idNo","")}","{e.get("dateJoined","")}"')
    lines.append(f',,,{totals.get("sumGbpSalary",0)},,{totals.get("sumEarnedGbp",0)},{totals.get("sumEpf12Gbp",0)},{totals.get("sumEtf3Gbp",0)},{totals.get("sumTotalGbp",0)},,,,')
    lines.append('')
    lines.append(f'Checked by: {enriched_period.get("checkedBy","")},Accountant,,,Authorized by: {enriched_period.get("authorizedSignatory","")},{enriched_period.get("authorizedCompany","")}')
    lines.append('')
    lines.append(f'SALARY SHEET (IN GBP ) - {month.upper().replace(" ", "")}. @{rate}')
    lines.append('No,Employee Name,POSITION,GBP Salary,Working Days,Earned Base (GBP),LKR,EPF 8%,EPF12%,ETF 3%,APIT,Other Deductions,Net Remittance (LKR)')
    for e in employees:
        lines.append(f'"{e.get("no","")}","{e.get("name","")}","{e.get("position","")}",{e.get("gbpSalary",0)},"{e.get("workDays","")}",{e.get("earnedGbp",0)},{e.get("lkrGross",0)},{e.get("epf8Lkr",0)},{e.get("epf12Lkr",0)},{e.get("etf3Lkr",0)},{e.get("apit",0)},,{e.get("netSalaryLkr",0)}')
    lines.append(f',,,{totals.get("sumGbpSalary",0)},,{totals.get("sumEarnedGbp",0)},{totals.get("sumLkrGross",0)},{totals.get("sumEpf8Lkr",0)},{totals.get("sumEpf12Lkr",0)},{totals.get("sumEtf3Lkr",0)},{totals.get("sumApitLkr",0)},,{totals.get("sumNetSalaryLkr",0)}')
    return '\n'.join(lines)

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

MONTHS_LIST = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
MONTH_NAME_TO_IDX = {m.lower(): i for i, m in enumerate(MONTHS_LIST)}

def to_standard_date_format(val):
    if not val or str(val).strip() in ['', '-', 'N/A', 'None']:
        return ''
    val = str(val).strip()
    # Already DD-MMM-YYYY or D-MMM-YYYY
    m = re.match(r'^(\d{1,2})-([A-Za-z]{3})-(\d{4})$', val)
    if m:
        day = int(m.group(1))
        mon_str = m.group(2).lower()
        year = int(m.group(3))
        if mon_str in MONTH_NAME_TO_IDX:
            return f"{day:02d}-{MONTHS_LIST[MONTH_NAME_TO_IDX[mon_str]]}-{year}"
    # YYYY-MM-DD or YYYY/MM/DD
    m = re.match(r'^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})', val)
    if m:
        year = int(m.group(1))
        mon = int(m.group(2)) - 1
        day = int(m.group(3))
        if 0 <= mon < 12 and 1 <= day <= 31:
            return f"{day:02d}-{MONTHS_LIST[mon]}-{year}"
    # DD/MM/YYYY or DD-MM-YYYY
    m = re.match(r'^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})', val)
    if m:
        day = int(m.group(1))
        mon = int(m.group(2)) - 1
        year = int(m.group(3))
        if 0 <= mon < 12 and 1 <= day <= 31:
            return f"{day:02d}-{MONTHS_LIST[mon]}-{year}"
    return val

def sync_customer_records_from_access():
    global CUSTOMER_RECORDS
    init_sqlite_db()
    res = call_access_bridge("GetRecords")
    if res.get("success") and "records" in res:
        records = res["records"]
        for r in records:
            if "Date of Incorporation" in r and r["Date of Incorporation"]:
                r["Date of Incorporation"] = to_standard_date_format(r["Date of Incorporation"])
        CUSTOMER_RECORDS = records
        save_json_file("customer_records_cache.json", CUSTOMER_RECORDS)
    else:
        records = load_json_file("customer_records_cache.json", [])
        for r in records:
            if "Date of Incorporation" in r and r["Date of Incorporation"]:
                r["Date of Incorporation"] = to_standard_date_format(r["Date of Incorporation"])
        CUSTOMER_RECORDS = records

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

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
        
        # Also check URL query string for token (critical for <img> tags and direct links)
        if not token:
            try:
                parsed = urllib.parse.urlparse(self.path)
                qs = urllib.parse.parse_qs(parsed.query)
                if "token" in qs and qs["token"]:
                    token = qs["token"][0].strip()
            except Exception:
                pass
        
        if token and token in SESSIONS:
            user_id = SESSIONS[token]["userId"]
            for u in USERS:
                if u["id"] == user_id:
                    return u
            sync_users_from_disk()
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
        user_perms = user.get("permissions", {})
        mod_perm = user_perms.get(module, "none")
        
        if mod_perm == "none":
            self.send_json({
                "error": f"Access Denied: You need '{required_level}' access for module '{module}'. Your permission level is '{mod_perm}'."
            }, 403)
            return None

        if role in ["director", "admin"]:
            return user
        
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

        # 2. API: Users List (Admin and Director)
        elif path == "/api/users":
            user = self.get_auth_user()
            if not user or user.get("role") not in ["admin", "director"]:
                self.send_json({"error": "Admin or Director privileges required"}, 403)
                return
            sync_users_from_disk()
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
                user_tasks = [t for t in OPERATIONS if t.get("userId") == user.get("id") or t.get("ownerUsername") == user.get("username")]
                base_tasks = user_tasks

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
                user_tasks = [t for t in OPERATIONS if t.get("userId") == user.get("id") or t.get("ownerUsername") == user.get("username")]
                base_tasks = user_tasks

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
            photo_raw = path.replace("/api/financial-files/photos/", "")
            photo_name = os.path.basename(urllib.parse.unquote(photo_raw))
            photo_path = os.path.join(FINANCIAL_PHOTOS_DIR, photo_name)

            if not os.path.exists(photo_path):
                # Attempt case-insensitive or partial match
                for f in os.listdir(FINANCIAL_PHOTOS_DIR):
                    if f.lower() == photo_name.lower():
                        photo_path = os.path.join(FINANCIAL_PHOTOS_DIR, f)
                        break

            if os.path.exists(photo_path) and photo_path.lower().endswith(('.jpg', '.jpeg', '.png')):
                with open(photo_path, "rb") as f:
                    content = f.read()
                ext = "png" if photo_path.lower().endswith(".png") else "jpeg"
                self.send_response(200)
                self.send_header("Content-Type", f"image/{ext}")
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Cache-Control", "public, max-age=86400")
                self.end_headers()
                self.wfile.write(content)
                return
            else:
                self.send_json({"error": f"Photo '{photo_name}' not found"}, 404)
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

        # 6.5. API: Payroll Management
        elif path == "/api/payroll":
            user = self.require_permission("payroll", "viewer")
            if not user: return

            active_id = PAYROLL_RECORDS.get("activePeriodId", "")
            periods_list = []
            active_period_enriched = None
            
            for p in PAYROLL_RECORDS.get("periods", []):
                enriched = enrich_payroll_period(p)
                periods_list.append({
                    "id": p.get("id"),
                    "companyId": p.get("companyId"),
                    "month": p.get("month"),
                    "monthCode": p.get("monthCode"),
                    "yearPeriod": p.get("yearPeriod"),
                    "exchangeRate": p.get("exchangeRate"),
                    "status": p.get("status"),
                    "employeeCount": len(p.get("employees", [])),
                    "totalNetRemittance": enriched.get("totals", {}).get("sumNetSalaryLkr", 0)
                })
                if p.get("id") == active_id:
                    active_period_enriched = enriched
            
            if not active_period_enriched and PAYROLL_RECORDS.get("periods"):
                active_period_enriched = enrich_payroll_period(PAYROLL_RECORDS["periods"][0])

            self.send_json({
                "companies": PAYROLL_RECORDS.get("companies", []),
                "periods": periods_list,
                "activePeriod": active_period_enriched
            })
            return

        elif path == "/api/payroll/period":
            user = self.require_permission("payroll", "viewer")
            if not user: return

            pid = query.get("id", [""])[0] or PAYROLL_RECORDS.get("activePeriodId", "")
            target_period = None
            for p in PAYROLL_RECORDS.get("periods", []):
                if p.get("id") == pid:
                    target_period = p
                    break
            
            if not target_period:
                self.send_json({"error": "Payroll period not found"}, 404)
                return

            self.send_json({"period": enrich_payroll_period(target_period)})
            return

        elif path == "/api/payroll/export-csv":
            user = self.require_permission("payroll", "viewer")
            if not user: return

            pid = query.get("id", [""])[0] or query.get("periodId", [""])[0] or PAYROLL_RECORDS.get("activePeriodId", "")
            target_period = None
            for p in PAYROLL_RECORDS.get("periods", []):
                if p.get("id") == pid:
                    target_period = p
                    break
            
            if not target_period:
                self.send_json({"error": "Payroll period not found"}, 404)
                return

            enriched = enrich_payroll_period(target_period)
            csv_content = generate_payroll_csv(enriched)
            body = csv_content.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", f"attachment; filename=\"Payroll_{enriched.get('monthCode', 'Period')}.csv\"")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        elif path == "/api/payroll/export-xlsx":
            user = self.require_permission("payroll", "viewer")
            if not user: return

            master_xlsx = os.path.join(BASE_DIR, "payroll", "APADMI -SALARY SHEET -SEP 2026.xlsx")
            if not os.path.exists(master_xlsx):
                master_xlsx = os.path.join(BASE_DIR, "payroll", "APADAMI -SALARY SHEET -SEP 2026.xlsx")
            if os.path.exists(master_xlsx):
                with open(master_xlsx, "rb") as xf:
                    xbytes = xf.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                self.send_header("Content-Disposition", "attachment; filename=\"APADMI_Salary_Sheet_SEP_2026.xlsx\"")
                self.send_header("Content-Length", str(len(xbytes)))
                self.end_headers()
                self.wfile.write(xbytes)
                return
            else:
                self.send_json({"error": "Template file not found"}, 404)
                return

        # 7. Static file serving (SPA)
        if path == "/" or path == "/index.html":
            file_path = os.path.join(PUBLIC_DIR, "index.html")
            self.serve_static_file(file_path, "text/html; charset=utf-8")
            return
        elif path in ["/favicon.ico", "/logo.png"]:
            file_path = os.path.join(PUBLIC_DIR, "logo.png")
            self.serve_static_file(file_path, "image/png")
            return
        elif path == "/manifest.json":
            file_path = os.path.join(PUBLIC_DIR, "manifest.json")
            self.serve_static_file(file_path, "application/manifest+json")
            return
        elif path.startswith("/public/"):
            rel = path[8:]
            file_path = os.path.join(PUBLIC_DIR, rel)
            self.serve_static_file(file_path)
            return

        # Direct file in public dir (e.g. /flatpickr.min.js, /styles.css, /app.js)
        direct_file = os.path.join(PUBLIC_DIR, path.lstrip("/"))
        if os.path.isfile(direct_file):
            self.serve_static_file(direct_file)
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
            elif file_path.endswith(".ico"): content_type = "image/x-icon"
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
        query = urllib.parse.parse_qs(parsed.query)
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
            
            sync_users_from_disk()
            matched = None
            for u in USERS:
                u_user = u.get("username", "").strip().lower()
                u_email = u.get("email", "").strip().lower()
                is_user_match = (
                    u_user == username or
                    (u_email and u_email == username) or
                    (username == "staff" and u_user == "staff_editor")
                )
                pwd_match = (u.get("password") == password) or (password and u.get("password") == password.strip())
                if is_user_match and pwd_match:
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
            if not user or user.get("role") not in ["admin", "director"]:
                self.send_json({"error": "Admin or Director privileges required to create accounts"}, 403)
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
                "taskedDate": time.strftime("%d-%b-%Y"),
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
                "taskedDate": body.get("taskedDate", time.strftime("%d-%b-%Y")),
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
                "dateOfIncorp": to_standard_date_format(body.get("dateOfIncorp", "")),
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
                "photoFile": body.get("photoFile", ""),
                "filingChecklist": body.get("filingChecklist", {})
            }
            FINANCIAL_RECORDS.insert(0, new_rec)
            save_json_file("financial_records_active.json", FINANCIAL_RECORDS)
            self.send_json({"success": True, "record": new_rec})
            return

        # 7. Customer Files: Add Single Record (Editor, Admin, Director)
        elif path == "/api/customer-files":
            user = self.require_permission("customer_files", "editor")
            if not user: return

            if "Date of Incorporation" in body and body["Date of Incorporation"]:
                body["Date of Incorporation"] = to_standard_date_format(body["Date of Incorporation"])

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

            if "Date of Incorporation" in body and body["Date of Incorporation"]:
                body["Date of Incorporation"] = to_standard_date_format(body["Date of Incorporation"])
            if "dateOfIncorp" in body and body["dateOfIncorp"]:
                body["dateOfIncorp"] = to_standard_date_format(body["dateOfIncorp"])

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

        # 9. Payroll: Create Period
        elif path == "/api/payroll/period":
            user = self.require_permission("payroll", "editor")
            if not user: return

            clone_from_id = body.get("cloneFromId") or body.get("cloneFromPeriodId")
            month = body.get("month", "New Month")
            month_code = body.get("monthCode", "Month")
            year_period = body.get("yearPeriod", "2026-2027")
            exchange_rate = float(body.get("exchangeRate", 440.0))
            letter_date = body.get("letterDate", time.strftime("%d.%m.%Y"))
            company_id = body.get("companyId", "comp_apadmi")
            comp = None
            for c in PAYROLL_RECORDS.get("companies", []):
                if c.get("id") == company_id:
                    comp = c
                    break

            new_period_id = f"period_{uuid.uuid4().hex[:6]}"
            base_employees = []
            if clone_from_id:
                for p in PAYROLL_RECORDS.get("periods", []):
                    if p.get("id") == clone_from_id:
                        for e in p.get("employees", []):
                            emp_copy = copy.deepcopy(e)
                            emp_copy["id"] = f"emp_{uuid.uuid4().hex[:6]}"
                            base_employees.append(emp_copy)
                        break

            new_period = {
                "id": new_period_id,
                "companyId": company_id,
                "month": month,
                "monthCode": month_code,
                "yearPeriod": year_period or (comp.get("payrollYearPeriod") if comp else "2026-2027"),
                "letterDate": letter_date,
                "exchangeRate": exchange_rate,
                "baseCurrency": "GBP",
                "localCurrency": "LKR",
                "status": "Draft",
                "checkedBy": body.get("checkedBy", (comp.get("checkedBy") if comp else "Hemanthi Basnayake")),
                "checkedTitle": body.get("checkedTitle", (comp.get("checkedTitle") if comp else "Accountant")),
                "authorizedSignatory": body.get("authorizedSignatory", (comp.get("authorizedSignatory") if comp else "Shaameel Mohideen")),
                "authorizedCompany": body.get("authorizedCompany", (comp.get("authorizedCompany") if comp else "Spillburg Holdings (pvt)Ltd")),
                "bankName": body.get("bankName", (comp.get("bankName") if comp else "Nations Trust Bank PLC")),
                "bankBranch": body.get("bankBranch", (comp.get("bankBranch") if comp else "Borella Branch")),
                "bankAddress": body.get("bankAddress", (comp.get("bankAddress") if comp else "67 D.S. Senanayake Mawatha,\nColombo 08.")),
                "debitAccountNo": body.get("debitAccountNo", (comp.get("debitAccountNo") if comp else "1001 5000 7554")),
                "debitAccountName": body.get("debitAccountName", (comp.get("debitAccountName") if comp else (comp.get("name") if comp else "Spillburg Holdings (Private) Limited"))),
                "employees": base_employees
            }
            PAYROLL_RECORDS.setdefault("periods", []).append(new_period)
            PAYROLL_RECORDS["activePeriodId"] = new_period_id
            save_payroll_records()
            self.send_json({"success": True, "period": enrich_payroll_period(new_period)})
            return

        # 10. Payroll: Add Employee to Period
        elif path == "/api/payroll/employee":
            user = self.require_permission("payroll", "editor")
            if not user: return

            period_id = body.get("periodId") or PAYROLL_RECORDS.get("activePeriodId")
            target_period = None
            for p in PAYROLL_RECORDS.get("periods", []):
                if p.get("id") == period_id:
                    target_period = p
                    break
            
            if not target_period:
                self.send_json({"error": "Period not found"}, 404)
                return

            emps = target_period.setdefault("employees", [])
            new_no = max([e.get("no", 0) for e in emps] or [0]) + 1
            new_emp = {
                "id": f"emp_{uuid.uuid4().hex[:6]}",
                "no": new_no,
                "epfNo": body.get("epfNo", f"{new_no:02d}"),
                "name": body.get("name", "New Employee").strip(),
                "shortName": body.get("shortName", body.get("name", "")).strip(),
                "position": body.get("position", "Software Engineer").strip(),
                "gbpSalary": float(body.get("gbpSalary", 1000.0)),
                "workDays": body.get("workDays", ""),
                "earnedGbp": float(body.get("earnedGbp", body.get("gbpSalary", 1000.0))),
                "bankAccountNo": body.get("bankAccountNo", ""),
                "bankCode": body.get("bankCode", ""),
                "bankBranch": body.get("bankBranch", ""),
                "tinNo": body.get("tinNo", ""),
                "idNo": body.get("idNo", ""),
                "dateJoined": body.get("dateJoined", time.strftime("%d/%m/%Y")),
                "specialAllowance": float(body.get("specialAllowance", 0.0)),
                "noPayLate": float(body.get("noPayLate", 0.0)),
                "advance": float(body.get("advance", 0.0)),
                "loan": float(body.get("loan", 0.0)),
                "apit": float(body["apit"]) if ("apit" in body and body["apit"] is not None and str(body["apit"]).strip() != "") else None
            }
            emps.append(new_emp)
            save_payroll_records()
            self.send_json({"success": True, "employee": compute_employee_payroll(new_emp, target_period.get("exchangeRate", 440.0)), "period": enrich_payroll_period(target_period)})
            return

        # 11. Payroll: Add or Update Managed Company
        elif path == "/api/payroll/company":
            user = self.require_permission("payroll", "editor")
            if not user: return

            comp_id = body.get("id", f"comp_{uuid.uuid4().hex[:6]}")
            comps = PAYROLL_RECORDS.setdefault("companies", [])
            target_comp = None
            for c in comps:
                if c.get("id") == comp_id:
                    target_comp = c
                    break
            if not target_comp:
                target_comp = {"id": comp_id}
                comps.append(target_comp)
            
            for k in ["name", "code", "registrationNo", "address", "bankName", "bankBranch", "bankAddress", "debitAccountNo", "debitAccountName", "authorizedSignatory", "authorizedTitle", "authorizedCompany", "checkedBy", "checkedTitle", "payrollYearPeriod"]:
                if k in body:
                    target_comp[k] = body[k]
            
            save_payroll_records()
            self.send_json({"success": True, "company": target_comp})
            return

        self.send_json({"error": "Endpoint not found"}, 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)
        body = self.parse_body()

        # 1. Users: Update role & permissions (Admin & Director)
        if path.startswith("/api/users/"):
            user = self.get_auth_user()
            if not user or user.get("role") not in ["admin", "director"]:
                self.send_json({"error": "Admin or Director privileges required"}, 403)
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
            if "permissions" in body:
                if not isinstance(target.get("permissions"), dict):
                    target["permissions"] = {}
                target["permissions"].update(body["permissions"])
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

            if "dateOfIncorp" in body and body["dateOfIncorp"]:
                body["dateOfIncorp"] = to_standard_date_format(body["dateOfIncorp"])

            for key in ["entityName", "category", "regNo", "dateOfIncorp", "tinNo", "economicCode", "irdPin", "irdPassword", "irdEmail", "ssid", "ssidPin", "directorName", "directorPassportOrId", "emails", "phones", "filingStatus", "notes", "photoFile", "filingChecklist"]:
                if key in body:
                    target[key] = body[key]

            save_json_file("financial_records_active.json", FINANCIAL_RECORDS)
            save_json_file("financial_records.json", FINANCIAL_RECORDS)
            self.send_json({"success": True, "record": target})
            return

        # 4. Customer Files: Update Record (Editor, Admin, Director)
        elif path.startswith("/api/customer-files/"):
            user = self.require_permission("customer_files", "editor")
            if not user: return

            rec_no = path.replace("/api/customer-files/", "")
            if "No" not in body or not body.get("No"):
                body["No"] = rec_no

            if "Date of Incorporation" in body and body["Date of Incorporation"]:
                body["Date of Incorporation"] = to_standard_date_format(body["Date of Incorporation"])

            res = call_access_bridge("UpdateRecord", body)
            if res.get("success"):
                sync_customer_records_from_access()
                self.send_json(res)
            else:
                self.send_json({"success": False, "error": res.get("error", "Access bridge update failed")}, 500)
            return

        # 5. Payroll: Update Period (e.g. Exchange Rate, Letter Date, Signatories, Bank Details, Status)
        elif path.startswith("/api/payroll/period"):
            user = self.require_permission("payroll", "editor")
            if not user: return

            pid = query.get("id", [""])[0] or body.get("id") or PAYROLL_RECORDS.get("activePeriodId")
            target_period = None
            for p in PAYROLL_RECORDS.get("periods", []):
                if p.get("id") == pid:
                    target_period = p
                    break
            
            if not target_period:
                self.send_json({"error": "Period not found"}, 404)
                return

            for k in ["month", "monthCode", "yearPeriod", "letterDate", "exchangeRate", "status", "checkedBy", "checkedTitle", "authorizedSignatory", "authorizedCompany", "bankName", "bankBranch", "bankAddress", "debitAccountNo", "debitAccountName"]:
                if k in body:
                    if k == "exchangeRate":
                        target_period[k] = float(body[k])
                    else:
                        target_period[k] = body[k]

            if body.get("setActive"):
                PAYROLL_RECORDS["activePeriodId"] = pid

            save_payroll_records()
            self.send_json({"success": True, "period": enrich_payroll_period(target_period)})
            return

        # 6. Payroll: Update Employee
        elif path.startswith("/api/payroll/employee"):
            user = self.require_permission("payroll", "editor")
            if not user: return

            emp_id = query.get("id", [""])[0] or body.get("id")
            period_id = query.get("periodId", [""])[0] or body.get("periodId") or PAYROLL_RECORDS.get("activePeriodId")
            
            target_period = None
            target_emp = None
            for p in PAYROLL_RECORDS.get("periods", []):
                if not period_id or p.get("id") == period_id:
                    for e in p.get("employees", []):
                        if e.get("id") == emp_id:
                            target_emp = e
                            target_period = p
                            break
                    if target_emp: break

            if not target_emp or not target_period:
                self.send_json({"error": "Employee or period not found"}, 404)
                return

            for k in ["no", "epfNo", "name", "shortName", "position", "gbpSalary", "workDays", "earnedGbp", "bankAccountNo", "bankCode", "bankBranch", "tinNo", "idNo", "dateJoined", "specialAllowance", "noPayLate", "advance", "loan", "apit"]:
                if k in body:
                    if k in ["gbpSalary", "earnedGbp", "specialAllowance", "noPayLate", "advance", "loan"]:
                        target_emp[k] = float(body[k]) if body[k] is not None else 0.0
                    elif k == "apit":
                        target_emp[k] = float(body[k]) if (body[k] is not None and str(body[k]).strip() != '') else None
                    elif k == "no":
                        target_emp[k] = int(body[k])
                    else:
                        target_emp[k] = body[k]

            save_payroll_records()
            self.send_json({"success": True, "employee": compute_employee_payroll(target_emp, target_period.get("exchangeRate", 440.0)), "period": enrich_payroll_period(target_period)})
            return

        # 7. Payroll: Update Company
        elif path.startswith("/api/payroll/company"):
            user = self.require_permission("payroll", "editor")
            if not user: return

            comp_id = query.get("id", [""])[0] or body.get("id")
            comps = PAYROLL_RECORDS.setdefault("companies", [])
            target_comp = None
            for c in comps:
                if c.get("id") == comp_id:
                    target_comp = c
                    break

            if not target_comp:
                self.send_json({"error": "Company not found"}, 404)
                return

            for k in ["name", "code", "registrationNo", "address", "bankName", "bankBranch", "bankAddress", "debitAccountNo", "debitAccountName", "authorizedSignatory", "authorizedTitle", "authorizedCompany", "checkedBy", "checkedTitle", "payrollYearPeriod"]:
                if k in body:
                    target_comp[k] = body[k]

            save_payroll_records()
            self.send_json({"success": True, "company": target_comp})
            return

        self.send_json({"error": "Endpoint not found"}, 404)

    def do_DELETE(self):
        global USERS, OPERATIONS, FINANCIAL_RECORDS
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. Users: Delete (Admin & Director)
        if path.startswith("/api/users/"):
            user = self.get_auth_user()
            if not user or user.get("role") not in ["admin", "director"]:
                self.send_json({"error": "Admin or Director privileges required"}, 403)
                return

            user_id = path.replace("/api/users/", "")
            if user.get("id") == user_id:
                self.send_json({"error": "Security Alert: You cannot delete your own active administrator account."}, 400)
                return

            USERS = [u for u in USERS if u["id"] != user_id]
            save_json_file("users.json", USERS)
            OPERATIONS = [t for t in OPERATIONS if t.get("userId") != user_id]
            save_json_file("operations.json", OPERATIONS)
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

        # 5. Payroll: Delete Employee
        elif path.startswith("/api/payroll/employee"):
            user = self.require_permission("payroll", "editor")
            if not user: return

            emp_id = query.get("id", [""])[0] or path.replace("/api/payroll/employee/", "")
            period_id = query.get("periodId", [""])[0] or PAYROLL_RECORDS.get("activePeriodId")

            target_period = None
            for p in PAYROLL_RECORDS.get("periods", []):
                if not period_id or p.get("id") == period_id:
                    target_period = p
                    break

            if not target_period:
                self.send_json({"error": "Period not found"}, 404)
                return

            before_len = len(target_period.get("employees", []))
            target_period["employees"] = [e for e in target_period.get("employees", []) if e.get("id") != emp_id]
            if len(target_period["employees"]) == before_len:
                self.send_json({"error": "Employee not found"}, 404)
                return

            save_payroll_records()
            self.send_json({"success": True, "period": enrich_payroll_period(target_period)})
            return

        # 6. Payroll: Delete Period
        elif path.startswith("/api/payroll/period"):
            user = self.require_permission("payroll", "editor")
            if not user: return

            pid = query.get("id", [""])[0] or path.replace("/api/payroll/period/", "")
            periods = PAYROLL_RECORDS.get("periods", [])
            if len(periods) <= 1:
                self.send_json({"error": "Cannot delete the only remaining payroll period"}, 400)
                return

            PAYROLL_RECORDS["periods"] = [p for p in periods if p.get("id") != pid]
            if PAYROLL_RECORDS.get("activePeriodId") == pid:
                PAYROLL_RECORDS["activePeriodId"] = PAYROLL_RECORDS["periods"][0]["id"]

            save_payroll_records()
            self.send_json({"success": True, "activePeriodId": PAYROLL_RECORDS["activePeriodId"]})
            return

        # 7. Payroll: Delete Company
        elif path.startswith("/api/payroll/company"):
            user = self.require_permission("payroll", "editor")
            if not user: return

            cid = query.get("id", [""])[0] or path.replace("/api/payroll/company/", "")
            comps = PAYROLL_RECORDS.get("companies", [])
            if len(comps) <= 1:
                self.send_json({"error": "Cannot delete the only remaining company"}, 400)
                return

            PAYROLL_RECORDS["companies"] = [c for c in comps if c.get("id") != cid]
            PAYROLL_RECORDS["periods"] = [p for p in PAYROLL_RECORDS.get("periods", []) if p.get("companyId") != cid]
            if PAYROLL_RECORDS.get("periods"):
                PAYROLL_RECORDS["activePeriodId"] = PAYROLL_RECORDS["periods"][0]["id"]
            else:
                PAYROLL_RECORDS["activePeriodId"] = None

            save_payroll_records()
            self.send_json({"success": True, "companies": PAYROLL_RECORDS["companies"]})
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
