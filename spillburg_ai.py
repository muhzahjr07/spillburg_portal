import os
import re
import json
import time
import uuid
import datetime
import urllib.request
import urllib.error

MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
MONTH_LOOKUP = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'sept': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11
}


def can_user_access_spillburg_ai(user):
    """Returns True if the user is permitted to access SpillburgAI."""
    if not user:
        return False
    perms = user.get("permissions") or {}
    ai_perm = str(perms.get("spillburg_ai", "allowed")).strip().lower()
    if ai_perm in ["none", "disallowed", "false", "0", "blocked"]:
        return False
    return True


def can_user_view_module(user, module):
    """Checks if a user has at least viewer access to a portal module."""
    if not user:
        return False
    role = (user.get("role") or "staff").lower()
    perms = user.get("permissions") or {}
    mod_perm = str(perms.get(module, "none")).strip().lower()
    if mod_perm == "none":
        return False
    if role in ["director", "admin"]:
        return True
    return mod_perm in ["viewer", "editor", "full", "allowed"]


def can_user_edit_module(user, module):
    """Checks if a user has editor/full access to a portal module."""
    if not user:
        return False
    role = (user.get("role") or "staff").lower()
    perms = user.get("permissions") or {}
    mod_perm = str(perms.get(module, "none")).strip().lower()
    if mod_perm == "none":
        return False
    if role in ["director", "admin"]:
        return True
    return mod_perm in ["editor", "full"]


def get_user_access_summary(user):
    """Returns a structured dictionary of what the user can view/edit."""
    role = (user.get("role") or "staff").lower()
    is_exec = role in ["director", "admin"]
    return {
        "userId": user.get("id"),
        "username": user.get("username"),
        "fullName": user.get("fullName"),
        "role": role,
        "title": user.get("title"),
        "spillburg_ai": can_user_access_spillburg_ai(user),
        "geminiConfigured": bool(get_gemini_api_key()),
        "modules": {
            "operations": {
                "view": can_user_view_module(user, "operations"),
                "edit": can_user_edit_module(user, "operations"),
                "scope": "all_team" if is_exec else "personal_only",
                "level": "Full" if is_exec and (user.get("permissions") or {}).get("operations") != "none" else (user.get("permissions") or {}).get("operations", "none")
            },
            "customer_files": {
                "view": can_user_view_module(user, "customer_files"),
                "edit": can_user_edit_module(user, "customer_files"),
                "level": "Full" if is_exec and (user.get("permissions") or {}).get("customer_files") != "none" else (user.get("permissions") or {}).get("customer_files", "none")
            },
            "financial_files": {
                "view": can_user_view_module(user, "financial_files"),
                "edit": can_user_edit_module(user, "financial_files"),
                "level": "Full" if is_exec and (user.get("permissions") or {}).get("financial_files") != "none" else (user.get("permissions") or {}).get("financial_files", "none")
            },
            "payroll": {
                "view": can_user_view_module(user, "payroll"),
                "edit": can_user_edit_module(user, "payroll"),
                "level": "Full" if is_exec and (user.get("permissions") or {}).get("payroll") != "none" else (user.get("permissions") or {}).get("payroll", "none")
            },
            "user_management": {
                "view": is_exec or can_user_view_module(user, "user_management"),
                "edit": is_exec or can_user_edit_module(user, "user_management"),
                "level": "Full" if is_exec else (user.get("permissions") or {}).get("user_management", "none")
            }
        }
    }


def get_gemini_api_key():
    """Returns configured Gemini API key from environment or persistent/local ai_config.json."""
    env_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if env_key and env_key.strip():
        return env_key.strip()
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        candidate_dirs = []
        if os.environ.get("PORTAL_DATA_DIR"):
            candidate_dirs.append(os.path.abspath(os.environ.get("PORTAL_DATA_DIR")))
        if os.path.exists("/var/data") and os.path.isdir("/var/data"):
            candidate_dirs.append("/var/data")
        candidate_dirs.append(os.path.join(base_dir, "data"))
        for d in candidate_dirs:
            cfg_path = os.path.join(d, "ai_config.json")
            if os.path.exists(cfg_path):
                with open(cfg_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    if cfg.get("geminiApiKey"):
                        return str(cfg["geminiApiKey"]).strip()
    except Exception:
        pass
    return ""



SRI_LANKA_STATUTORY_KNOWLEDGE = {
    "roc_forms": {
        "form_1": {
            "title": "ROC Form 1 — Application for Incorporation of a Company",
            "statute": "Companies Act No. 7 of 2007 (Section 4)",
            "purpose": "Primary incorporation application to register a new Private Limited (Pvt Ltd) or Public company in Sri Lanka.",
            "requirements": [
                "Approved Name Reservation from ROC (valid for 3 months)",
                "Articles of Association (Table A or custom)",
                "Form 18 (Consent and Certificate of each Director)",
                "Form 19 (Consent and Certificate of Company Secretary)",
                "Registered office address in Sri Lanka",
                "Shareholder schedule and stated capital"
            ],
            "statutory_fee": "Rs. 4,000 + 18% VAT (approx Rs. 4,720) + Form 18 (Rs. 2,000 per director) + Form 19 (Rs. 2,000)",
            "filing_mode": "Online eROC Portal (e-services.drc.gov.lk) followed by seal endorsement."
        },
        "form_13": {
            "title": "ROC Form 13 — Notice of Change of Registered Office Address",
            "statute": "Companies Act No. 7 of 2007 (Section 113)",
            "purpose": "Statutory notification to the Registrar of Companies of change in registered office location.",
            "timeline": "Must be filed within 10 working days of the effective change date.",
            "requirements": [
                "Board Resolution approving new registered address",
                "Exact postal address with postal code and district",
                "Signed by active Director or Secretary"
            ],
            "statutory_fee": "Rs. 2,000 + 18% VAT (approx Rs. 2,360)",
            "filing_mode": "Online eROC Portal (e-services.drc.gov.lk)."
        },
        "form_15": {
            "title": "ROC Form 15 / 15(A) — Annual Return of a Company",
            "statute": "Companies Act No. 7 of 2007 (Section 131)",
            "purpose": "Mandatory annual statutory return declaring shareholders, directors, stated capital, charges, and registered address.",
            "timeline": "Must be filed annually within 30 working days of the Annual General Meeting (AGM) or written resolution.",
            "requirements": [
                "List of active shareholders & shareholdings",
                "List of active directors and company secretary",
                "Stated capital statement",
                "Audited Accounts (where statutory turnover thresholds apply)"
            ],
            "statutory_fee": "Rs. 6,000 + 18% VAT (approx Rs. 7,080). Late filing incurs stepped statutory penalties up to Rs. 20,000.",
            "filing_mode": "Online eROC Portal."
        },
        "form_20": {
            "title": "ROC Form 20 — Notice of Change of Director / Secretary or Particulars",
            "statute": "Companies Act No. 7 of 2007 (Section 223)",
            "purpose": "Statutory notification of appointment, resignation, removal, or change of particulars of a Director or Secretary.",
            "timeline": "STRICT STATUTORY DEADLINE: Must be filed within 20 working days of the effective resolution date.",
            "requirements": [
                "Board of Directors Resolution or Shareholder Resolution",
                "Form 18 (Consent of new Director) or signed Resignation Letter",
                "Form 19 (Consent of new Secretary, if applicable)",
                "Certified NIC copy (Sri Lankan citizens) or Certified Passport copy (foreign nationals)",
                "Full legal name, residential address, occupation, and nationalities",
                "Signed by active Director or Secretary"
            ],
            "statutory_fee": "Rs. 2,000 + 18% VAT (approx Rs. 2,360). Delay requires court order or compounding penalty.",
            "filing_mode": "Online eROC Portal (scanned upload with wet signatures) + seal endorsement."
        },
        "bo_2": {
            "title": "ROC Form BO 2 — Beneficial Ownership Disclosure Register",
            "statute": "Companies Act No. 7 of 2007 & Companies (Amendment) Act No. 28 of 2023",
            "purpose": "Mandatory disclosure to ROC of natural persons holding 25% or more shares, voting rights, or controlling interest.",
            "timeline": "Mandatory upon incorporation and within 14 working days of any ownership/control change.",
            "requirements": [
                "Full legal name, date of birth, nationality, residential address of ultimate beneficial owner(s)",
                "National Identity Card (NIC) or Passport number",
                "Nature and percentage of beneficial interest (direct or indirect)",
                "Declaration signed by Directors/Secretary"
            ],
            "statutory_fee": "Rs. 2,000 + 18% VAT.",
            "filing_mode": "Online eROC Portal."
        }
    },
    "tax_compliance": {
        "cit": {
            "title": "Corporate Income Tax (CIT)",
            "rate": "Standard 30% on taxable corporate profits under Inland Revenue Act No. 24 of 2017 (as amended).",
            "basis": "Applicable to standard resident private limited companies in Sri Lanka."
        },
        "apit": {
            "title": "Advance Personal Income Tax (APIT / PAYE)",
            "description": "Progressive tax deducted directly from employee monthly gross employment remuneration.",
            "slabs": [
                {"bracket": "First Rs. 100,000 / month (Rs. 1,200,000 / year)", "rate": "0% (Exempt relief)"},
                {"bracket": "Next Rs. 41,667 / month (Rs. 500,000 / year)", "rate": "6%"},
                {"bracket": "Next Rs. 41,667 / month (Rs. 500,000 / year)", "rate": "12%"},
                {"bracket": "Next Rs. 41,667 / month (Rs. 500,000 / year)", "rate": "18%"},
                {"bracket": "Next Rs. 41,667 / month (Rs. 500,000 / year)", "rate": "24%"},
                {"bracket": "Next Rs. 41,667 / month (Rs. 500,000 / year)", "rate": "30%"},
                {"bracket": "Balance exceeding Rs. 308,333 / month (Rs. 3,700,000 / year)", "rate": "36%"}
            ],
            "remittance_deadline": "On or before the 15th day of the following month to Inland Revenue Department (IRD)."
        },
        "sscl": {
            "title": "Social Security Contribution Levy (SSCL)",
            "rate": "2.5% liable turnover tax on liable supplies, imports, and services exceeding statutory turnover thresholds (SSCL Act No. 25 of 2022)."
        },
        "vat": {
            "title": "Value Added Tax (VAT)",
            "rate": "Standard 18% (effective Jan 1, 2024 under VAT Amendment Act No. 32 of 2023)."
        },
        "ramis_deadlines": {
            "quarterly_installments": "Quarter 1: 15 August | Quarter 2: 15 November | Quarter 3: 15 February | Quarter 4: 15 May",
            "set": "Statement of Estimated Tax (SET) submission: Due on or before 15 August of the assessment year.",
            "annual_return": "Final Annual Return of Income & Audited Accounts: Due on or before 30 November following assessment year end."
        }
    },
    "epf_etf_statutory": {
        "epf": {
            "rate": "20% Total = 12% Employer Contribution + 8% Employee Contribution.",
            "base": "Total gross earnings (including basic salary, cost of living allowance, attendance bonus, and food allowances).",
            "governing_body": "Central Bank of Sri Lanka (CBSL) & Department of Labour.",
            "statutory_form": "Central Bank EPF Form C (monthly advice of remittance) with employer registration number."
        },
        "etf": {
            "rate": "3% Employer Contribution (0% Employee deduction).",
            "base": "Total gross earnings.",
            "governing_body": "Employees' Trust Fund Board (ETFB).",
            "statutory_form": "ETF Form R-4 (Advice of Remittance)."
        },
        "deadline": "On or before the LAST WORKING DAY of the month following the salary period (e.g. October 2026 remittance due by November 30, 2026).",
        "surcharges": [
            {"period": "Delayed by 1 to 10 days", "penalty": "5% surcharge on unpaid amount"},
            {"period": "Delayed by 11 to 30 days", "penalty": "10% surcharge"},
            {"period": "Delayed by 1 to 3 months", "penalty": "15% surcharge"},
            {"period": "Delayed by 3 to 6 months", "penalty": "20% surcharge"},
            {"period": "Delayed by 6 to 12 months", "penalty": "30% surcharge"},
            {"period": "Delayed by 12 to 24 months", "penalty": "40% surcharge"},
            {"period": "Delayed by over 2 years", "penalty": "50% maximum surcharge"}
        ]
    }
}


def get_statutory_knowledge_response(query_text):
    """
    Returns rich, structured Sri Lankan statutory information when queries match
    ROC filing procedures, IRD/RAMIS tax compliance, or EPF/ETF statutory regulations.
    """
    low = (query_text or "").lower()
    sections = []

    # 1. ROC Form Queries
    if "form 20" in low or ("director" in low and ("change" in low or "resign" in low or "appoint" in low)):
        f20 = SRI_LANKA_STATUTORY_KNOWLEDGE["roc_forms"]["form_20"]
        sections.append(
            f"### 📜 {f20['title']}\n"
            f"- **Statute**: `{f20['statute']}`\n"
            f"- **Statutory Window**: **{f20['timeline']}**\n"
            f"- **Statutory Fee**: `{f20['statutory_fee']}`\n"
            f"- **Filing Mode**: {f20['filing_mode']}\n"
            f"\n**Mandatory Required Documents**:\n" +
            "\n".join(f"  - {r}" for r in f20["requirements"])
        )
    elif "form 13" in low or ("address" in low and "roc" in low):
        f13 = SRI_LANKA_STATUTORY_KNOWLEDGE["roc_forms"]["form_13"]
        sections.append(
            f"### 📜 {f13['title']}\n"
            f"- **Statute**: `{f13['statute']}`\n"
            f"- **Statutory Window**: **{f13['timeline']}**\n"
            f"- **Statutory Fee**: `{f13['statutory_fee']}`\n"
            f"\n**Mandatory Requirements**:\n" +
            "\n".join(f"  - {r}" for r in f13["requirements"])
        )
    elif "form 15" in low or ("annual return" in low and "roc" in low):
        f15 = SRI_LANKA_STATUTORY_KNOWLEDGE["roc_forms"]["form_15"]
        sections.append(
            f"### 📜 {f15['title']}\n"
            f"- **Statute**: `{f15['statute']}`\n"
            f"- **Statutory Window**: **{f15['timeline']}**\n"
            f"- **Statutory Fee**: `{f15['statutory_fee']}`\n"
            f"\n**Requirements**:\n" +
            "\n".join(f"  - {r}" for r in f15["requirements"])
        )
    elif "bo 2" in low or "bo2" in low or "beneficial" in low:
        bo2 = SRI_LANKA_STATUTORY_KNOWLEDGE["roc_forms"]["bo_2"]
        sections.append(
            f"### 📜 {bo2['title']}\n"
            f"- **Statute**: `{bo2['statute']}`\n"
            f"- **Threshold**: Natural persons holding **25% or more** shares, voting rights, or significant control.\n"
            f"- **Timeline**: **{bo2['timeline']}**\n"
            f"- **Statutory Fee**: `{bo2['statutory_fee']}`\n"
            f"\n**Required Details**:\n" +
            "\n".join(f"  - {r}" for r in bo2["requirements"])
        )
    elif "form 1" in low or ("incorporat" in low and "roc" in low):
        f1 = SRI_LANKA_STATUTORY_KNOWLEDGE["roc_forms"]["form_1"]
        sections.append(
            f"### 📜 {f1['title']}\n"
            f"- **Statute**: `{f1['statute']}`\n"
            f"- **Statutory Fee**: `{f1['statutory_fee']}`\n"
            f"\n**Incorporation Checklist**:\n" +
            "\n".join(f"  - {r}" for r in f1["requirements"])
        )

    # 2. Tax / APIT / CIT / RAMIS Queries
    if "apit" in low or "tax slab" in low or "tax bracket" in low or "paye" in low:
        apit = SRI_LANKA_STATUTORY_KNOWLEDGE["tax_compliance"]["apit"]
        lines = [
            f"### 🏛️ {apit['title']} (Inland Revenue Act)\n"
            f"{apit['description']}\n"
            f"- **Remittance Deadline**: `{apit['remittance_deadline']}`\n\n"
            f"| Monthly Taxable Remuneration | APIT Rate | Cumulative Top Tax |\n"
            f"| :--- | :---: | :---: |"
        ]
        for s in apit["slabs"]:
            lines.append(f"| {s['bracket']} | **{s['rate']}** | Statutory Band |")
        sections.append("\n".join(lines))
    elif any(k in low for k in ["cit", "corporate tax", "sscl", "vat", "ramis deadline", "tax deadline"]):
        cit = SRI_LANKA_STATUTORY_KNOWLEDGE["tax_compliance"]["cit"]
        sscl = SRI_LANKA_STATUTORY_KNOWLEDGE["tax_compliance"]["sscl"]
        vat = SRI_LANKA_STATUTORY_KNOWLEDGE["tax_compliance"]["vat"]
        ram = SRI_LANKA_STATUTORY_KNOWLEDGE["tax_compliance"]["ramis_deadlines"]
        sections.append(
            f"### 🏛️ Sri Lankan Corporate Tax Rates & RAMIS Deadlines\n"
            f"- **Corporate Income Tax (CIT)**: `{cit['rate']}`\n"
            f"- **Social Security Contribution Levy (SSCL)**: `{sscl['rate']}`\n"
            f"- **Value Added Tax (VAT)**: `{vat['rate']}`\n\n"
            f"#### 📅 RAMIS Statutory Filing Deadlines:\n"
            f"- **Quarterly CIT Installments**: `{ram['quarterly_installments']}`\n"
            f"- **Statement of Estimated Tax (SET)**: `{ram['set']}`\n"
            f"- **Annual Return of Income (Final)**: `{ram['annual_return']}`"
        )

    # 3. EPF & ETF Statutory Rules & Penalties
    if any(k in low for k in ["epf rate", "etf rate", "epf deadline", "etf deadline", "surcharge", "penalty", "late payment"]):
        epf_info = SRI_LANKA_STATUTORY_KNOWLEDGE["epf_etf_statutory"]
        lines = [
            f"### 🏦 Sri Lanka Statutory EPF & ETF Regulations\n"
            f"- **EPF (Central Bank)**: `{epf_info['epf']['rate']}` ({epf_info['epf']['base']})\n"
            f"- **ETF (Trust Fund)**: `{epf_info['etf']['rate']}` ({epf_info['etf']['base']})\n"
            f"- **Statutory Remittance Due Date**: **{epf_info['deadline']}**\n\n"
            f"#### ⚠️ Statutory Surcharge Scale for Delayed Remittance:\n"
            f"| Period of Delay | Statutory Surcharge Penalty |\n"
            f"| :--- | :---: |"
        ]
        for sc in epf_info["surcharges"]:
            lines.append(f"| {sc['period']} | **{sc['penalty']}** |")
        sections.append("\n".join(lines))

    return "\n\n---\n\n".join(sections) if sections else None


def call_gemini_enhancement(user, message, history, deterministic_reply, access_summary, attachments=None):
    """
    If GEMINI_API_KEY is configured, refines or answers conversational queries using
    Gemini 3.5 Flash Lite (with fallback to 3.1 Flash Lite) while strictly bounding
    context to the deterministic permission-filtered data.
    """
    api_key = get_gemini_api_key()
    if not api_key:
        return None

    models_to_try = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash"]
    sys_prompt = (
        "You are SpillburgAI, the official corporate intelligence assistant for Spillburg Holdings (Pvt) Ltd "
        "and Spillburg Vacation (Pvt) Ltd in Colombo, Sri Lanka.\n"
        f"Current User: {user.get('fullName')} (Role: {access_summary.get('role', 'staff').upper()}, Title: {user.get('title')}).\n"
        "STRICT SECURITY RULE: Only use the permission-verified corporate data provided below. Never fabricate TINs, "
        "EPF/ETF numbers, salaries, or box numbers. Format your response in clean markdown.\n\n"
        f"PERMISSION-SCOPED DATABASE RETRIEVAL:\n{deterministic_reply}"
    )
    contents = []
    for h in (history or [])[-6:]:
        role = "user" if h.get("role") == "user" else "model"
        contents.append({"role": role, "parts": [{"text": str(h.get("content", ""))[:1500]}]})

    user_parts = [{"text": message or ("Please analyze the attached document or voice note." if attachments else "")}]
    if attachments:
        for att in attachments:
            b64 = att.get("base64") or ""
            mtype = att.get("type", "image/jpeg")
            if b64:
                if "," in b64:
                    b64 = b64.split(",", 1)[1]
                user_parts.append({
                    "inlineData": {
                        "mimeType": mtype,
                        "data": b64
                    }
                })
    contents.append({"role": "user", "parts": user_parts})

    payload = {
        "systemInstruction": {"parts": [{"text": sys_prompt}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 2048, "thinkingConfig": {"thinkingBudget": 0}}
    }
    encoded_payload = json.dumps(payload).encode("utf-8")

    for model_name in models_to_try:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            req = urllib.request.Request(
                url,
                data=encoded_payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                candidates = res_data.get("candidates") or []
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts") or []
                    if parts and parts[0].get("text"):
                        return parts[0]["text"].strip()
        except urllib.error.HTTPError as he:
            if he.code in [404, 400]:
                continue
            break
        except Exception:
            continue
    return None


def extract_standard_date(text):
    """
    Extracts a date from free-form text (e.g., '28/10/2026', '28-10-2026', '28 Oct 2026', 'yesterday')
    and returns it in DD-MMM-YYYY format (e.g., '28-Oct-2026').
    """
    if not text:
        return datetime.date.today().strftime("%d-%b-%Y")

    # 1. Explicit DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (also handles spaces around slashes like 15/10/ 2026)
    m = re.search(r'\b(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})\b', text)
    if m:
        day, mon, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mon <= 12 and 1 <= day <= 31:
            return f"{day:02d}-{MONTHS_SHORT[mon - 1]}-{yr}"

    # 2. Explicit YYYY-MM-DD
    m = re.search(r'\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b', text)
    if m:
        yr, mon, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mon <= 12 and 1 <= day <= 31:
            return f"{day:02d}-{MONTHS_SHORT[mon - 1]}-{yr}"

    # 3. Explicit DD MMM YYYY or DD Month YYYY (e.g. 28 Oct 2026, 28-Oct-2026)
    m = re.search(r'\b(\d{1,2})[\s\-]+([A-Za-z]{3,9})[\s,\-]+(\d{4})\b', text)
    if m:
        day = int(m.group(1))
        mon_name = m.group(2).lower()
        yr = int(m.group(3))
        if mon_name in MONTH_LOOKUP and 1 <= day <= 31:
            return f"{day:02d}-{MONTHS_SHORT[MONTH_LOOKUP[mon_name]]}-{yr}"

    # 4. Relative words ('yesterday', 'today')
    lower = text.lower()
    today = datetime.date.today()
    if 'yesterday' in lower:
        yd = today - datetime.timedelta(days=1)
        return yd.strftime("%d-%b-%Y")

    return today.strftime("%d-%b-%Y")


def build_user_matcher_aliases(users):
    """Builds a list of (alias_lower, user_dict) for resolving user mentions like 'Ravi', 'Bilal', 'Hemanthi', 'Insaaf'."""
    aliases = []
    for u in users:
        uname = (u.get("username") or "").strip().lower()
        fname = (u.get("fullName") or "").strip()
        if uname:
            aliases.append((uname, u))
            if uname.startswith("staff_"):
                short_u = uname.replace("staff_", "").strip()
                if len(short_u) >= 3:
                    aliases.append((short_u, u))
                    if short_u == "insaaf":
                        aliases.append(("insaff", u))
        if fname:
            aliases.append((fname.lower(), u))
            tokens = [t.strip().lower() for t in re.split(r'[\s().\-]+', fname) if len(t.strip()) >= 3]
            for tok in tokens:
                if tok not in ["miss", "mrs", "mr", "staff", "member", "system", "executive", "director", "administrator", "mohamed", "muhammad"]:
                    aliases.append((tok, u))
                elif tok == "ravi" or tok.startswith("ravi"):
                    aliases.append(("ravi", u))
                    aliases.append((tok, u))
            for tok in tokens:
                if tok.startswith("ravi"):
                    aliases.append(("ravi", u))
                elif tok.startswith("shaameel") or tok.startswith("shameel"):
                    aliases.append(("shameel", u))
                    aliases.append(("shaameel", u))
                elif tok.startswith("zaharan"):
                    aliases.append(("zaharan", u))
                    aliases.append(("shaharan", u))
    aliases.sort(key=lambda x: len(x[0]), reverse=True)
    return aliases


def resolve_target_user_from_text(text, users, default_user):
    """
    Identifies which user a task log or command refers to (e.g. 'Ravi', 'done the works by Ravi',
    'for Bilal', 'assigned to Hemanthi', 'Insaaf').
    """
    if not text or not users:
        return default_user

    aliases = build_user_matcher_aliases(users)
    lines = [ln.strip() for ln in text.strip().splitlines() if ln.strip()]

    # 1. Check if the very first line is just a user's name (e.g. "Ravi" or "Insaaf:")
    if lines:
        first_clean = re.sub(r'[:\-–—,.]+$', '', lines[0]).strip().lower()
        for alias, u in aliases:
            if first_clean == alias or first_clean == f"@{alias}":
                return u

    # 2. Check explicit patterns like "by <Name>", "for <Name>", "to <Name>", "<Name>'s tasks"
    for alias, u in aliases:
        pat = rf'\b(?:by|for|to|user|staff|member|assign(?:ed)?\s+to)\s+@?{re.escape(alias)}\b|\b{re.escape(alias)}(?:\'s|\s+done|\s+did|\s+completed|\s+tasks|\s+works|\s+tracker)\b'
        if re.search(pat, text, re.I):
            return u

    # 3. Check if any line in the header (before item 1) mentions a user alias as a whole word
    header_part = lines[0] if len(lines) == 1 else "\n".join(lines[:3])
    for alias, u in aliases:
        if len(alias) >= 4 and re.search(rf'\b{re.escape(alias)}\b', header_part, re.I):
            return u

    return default_user


def classify_workstream_and_type(text):
    """Classifies workstream and task type based on Sri Lankan corporate/secretarial/banking domain keywords."""
    lower = text.lower()
    if any(k in lower for k in ['roc', 'registrar', 'bo 2', 'bo2', 'beneficial', 'benificial', 'form 1', 'form 13', 'form 15', 'form 20', 'incorporat', 'company approval', 'companies', 'secretarial', 'level 2', 'level 3', 'harshanee', 'chrishanthi', 'trademark', 'intellectual', 'interlectual', 'utps', 'paper advertisement', 'seal', 'trc', 'sltda', 'tourist']):
        return "Corporate Secretarial & ROC", "ROC / Statutory Filing"
    if any(k in lower for k in ['epf', 'etf', 'form c', 'form r-4', 'form r4', 'salary', 'salaries', 'payroll', 'labour', 'rahul']):
        return "Payroll & Statutory", "EPF / ETF / Payroll"
    if any(re.search(rf'\b{re.escape(k)}\b' if len(k) <= 4 else re.escape(k), lower) for k in ['ird', 'ramis', 'tin', 'apit', 'apiit', 'wht', 'tax', 'vat', 'sscl', 'audit', 'financial statement', 'financial account', 'fa', 'f a', 'monthly sales', 'monthly. sales', 'diziko', 'life cosmetics', 'shehan', 'frontier', 'draft account', 'qunli', 'wanli', 'manhan', 'gaia ella', 'tdl', 'hmk']):
        return "Accounting & Audit", "Accounting & Tax Compliance"
    if any(k in lower for k in ['petty cash', 'voucher', 'reimbursement']):
        return "Finance & Petty Cash", "Petty Cash & Vouchers"
    if any(k in lower for k in ['comm bank', 'commercial bank', 'ntb', 'nations trust', 'sampath', 'hnb', 'ndb', 'dfcc', 'citi', 'bank', 'keyzer', 'fund transfer', 'alp', 'cheque', 'remittance', 'account', 'mandate']):
        return "Banking & Treasury", "Banking & Fund Transfer"
    if any(k in lower for k in ['chamber of commerce', 'business council', 'slgbc', 'slajbc', 'slfbc', 'slcbc', 'slmbc', 'slrbc', 'slusabc', 'slitbc', 'slbbc', 'nordic', 'cancham']):
        return "Chamber & Business Councils", "Chamber / Council Activity"
    if any(k in lower for k in ['website', 'facebook', 'linkedin', 'social', 'marketing', 'seo', 'design', 'presentation']):
        return "Digital Marketing", "Marketing & Content"
    if any(k in lower for k in ['cupboard', 'box file', 'archive', 'original file', 'customer file', 'checklist', 'bind', 'database']):
        return "Archive & Records", "File Management"
    return "Office Operations", "Field / Office Operations"


def infer_requester_from_text(text, default_requester="Mr. Shameel"):
    """Infers who requested the task based on shorthand markers like SH, HM, Hemanthi, Gehan, Zaharan."""
    low = text.lower()
    if "hameez" in low or re.search(r'\bhm\b', low) or "cancham" in low:
        return "Mr. Hameez"
    if "shameel" in low or "shaameel" in low or re.search(r'\bsh\b', low):
        return "Mr. Shameel"
    if "hemanthi" in low:
        return "Miss Hemanthi"
    if "gehan" in low:
        return "Mr. Gehan"
    if "zaharan" in low or "shaharan" in low:
        return "Muhammad Zaharan"
    return default_requester


def build_clean_task_title(raw_text):
    """
    Generates a clean, executive-ready task title from a raw work-log item while preserving
    key entities (e.g., ROC, Coconut Hut, BO 2, Comm Bank Keyzer Street, ALP, People's Park).
    """
    first_line = raw_text.strip().splitlines()[0].strip()
    first_line = re.sub(r'\.\.\s*the\s+ai\s+should\s+be\s+able.*$', '', first_line, flags=re.I).strip()
    first_line = re.sub(r'\s+', ' ', first_line)

    lower = first_line.lower()
    if 'roc' in lower and ('level 2' in lower or 'level 3' in lower) and ('5 companies' in lower or 'companies' in lower):
        return "ROC Approvals for 5 Companies (Level 2 to Level 3) & Final Approval Follow-Up"
    if 'bo 2' in lower and 'coconut hut' in lower:
        return "Resolve ROC System Error for BO 2 Application – Coconut Hut"
    if ('comm bank' in lower or 'commercial bank' in lower) and 'alp' in lower:
        return "Commercial Bank Keyzer Street – ALP Fund Transfer Approval"
    if "people's park" in lower and 'sh' in lower:
        return "People's Park – Spillburg Holdings (SH) Operational Needful"
    if 'ird' in lower and ('apiit' in lower or 'tax slip' in lower or 'slip' in lower):
        return "Inland Revenue Department (IRD) – Collect Tax Slips for APIIT"
    if ('epf' in lower or 'etf' in lower) and ('apadmi' in lower or 'roc' in lower):
        return "Pay EPF/ETF Remittance for Apadmi & ROC Statutory Payments"
    if 'chamber of commerce' in lower or 'ceylon chamber' in lower:
        return "Ceylon Chamber of Commerce Field Visit & Submissions"
    if 'trigital' in lower and ('visiting card' in lower or 'card' in lower or 'manisha' in lower):
        return "Trigital World – Collect Visiting Cards for Manisha"
    if 'labour' in lower and ('alp' in lower or 'commissioner' in lower or 'narahenpita' in lower):
        return "Labour Dept Narahenpita – Meet Labour Commissioner Reg. ALP Matter"

    # Accounting / Miss Hemanthi daily work-plan shorthand expansions
    if 'monthly' in lower and 'sales' in lower and ('sv' in lower or 'vacation' in lower):
        return "Prepare Monthly Sales Report – Spillburg Vacation (SV)"
    if 'bank' in lower and 'update' in lower and 'both' in lower and 'compan' in lower:
        return "Update Banking Transactions – Both Companies (Spillburg Holdings & Vacation)"
    fa_match = re.match(r'^([a-z0-9\s.&()\-]+?)\s+f\s*\.?\s*a\.?\s+(?:will\s+(?:finish|do|complete)|to\s+finish|finish|prepare).*$', first_line, flags=re.I)
    if fa_match:
        client_raw = fa_match.group(1).strip().title()
        if 'life cosmetics' in client_raw.lower() and 'lanka' not in client_raw.lower():
            client_raw = "Life Cosmetics Lanka"
        return f"Complete Financial Accounts (FA) – {client_raw}"
    if re.match(r'^salaries\s+will\s+do\b', lower):
        return "Prepare & Process Monthly Staff Salaries"

    cleaned = re.sub(r'^(?:going\s+to|went\s+to|visit)\s+', '', first_line, flags=re.I).strip()
    typo_fixes = [
        (r'\bApprovels\b', 'Approvals'),
        (r'\bapprovels\b', 'approvals'),
        (r'\bAssistan\b', 'Assistant'),
        (r'\bassistan\b', 'assistant'),
        (r'\bBenificial\b', 'Beneficial'),
        (r'\bbenificial\b', 'beneficial'),
        (r'\bInterlectual\b', 'Intellectual'),
        (r'\binterlectual\b', 'intellectual'),
        (r'\s*,\s*', ', '),
        (r'\.\s*([a-z])', lambda m: '. ' + m.group(1).upper())
    ]
    for pat, rep in typo_fixes:
        cleaned = re.sub(pat, rep, cleaned)

    if len(cleaned) > 95:
        cleaned = cleaned[:92].rsplit(' ', 1)[0] + "..."
    return cleaned[0].upper() + cleaned[1:] if cleaned else "Operational Task"


def clean_item_notes(raw_text):
    """Cleans up trailing prompt instructions from an item's full text to store as clean task notes."""
    cleaned = re.sub(r'\.\.\s*the\s+ai\s+should\s+be\s+able.*$', '', raw_text.strip(), flags=re.I).strip()
    lines = [ln.strip() for ln in cleaned.splitlines() if ln.strip()]
    joined = " ".join(lines)
    joined = re.sub(r'\s+', ' ', joined)
    joined = re.sub(r'\bApprovels\b', 'Approvals', joined, flags=re.I)
    joined = re.sub(r'\bAssistan\b', 'Assistant', joined, flags=re.I)
    joined = re.sub(r'\bBenificial\b', 'Beneficial', joined, flags=re.I)
    return joined


def extract_followup_action(notes_text):
    """
    Checks if a completed work log item also specifies a follow-up requirement
    (e.g., 'To be follow up', 'ask me to contact on 29/10/2026', 'asked me to come on Monday',
    'To be gone to final approvals from Mrs.Harshanee').
    Returns a clean follow-up title & notes if detected, else None.
    """
    lower = notes_text.lower()
    followup_cues = [
        'to be follow up', 'to be followed up', 'follow up tomorrow', 'follow up on',
        'follow up again', 'follow up next week', 'to be gone to final approvals',
        'asked me to come on', 'ask me to contact on', 'to be contact'
    ]
    if not any(cue in lower for cue in followup_cues):
        return None

    # Build a specific follow-up title
    if 'harshanee' in lower or ('roc' in lower and 'level 3' in lower):
        fu_title = "Follow-Up: ROC Level 3 Final Approvals with Assistant Registrar Mrs. Harshanee"
    elif 'jayasekara' in lower or ('labour' in lower and ('alp' in lower or 'lpl' in lower)):
        fu_title = "Follow-Up: Labour Dept EPF Registration Approval with Mr. Jayasekara"
    elif 'dewmin' in lower or 'bangaladesh' in lower or 'bangladesh' in lower:
        fu_title = "Follow-Up: Bangladesh Business Council Rs. 10,000 Subscription Refund (Mr. Dewmin)"
    elif 'shehan' in lower and 'audit' in lower:
        fu_title = "Follow-Up: Collect Signed Audit Reports from Shehan's Office (Rajagiriya)"
    elif 'chrishanthi' in lower:
        fu_title = "Follow-Up: Secretarial Mandate / Power of Attorney with Ms. Chrishanthi"
    elif 'nova vista' in lower:
        fu_title = "Follow-Up: ROC Name Reservation Approval for Nova Vista (Pvt) Ltd"
    else:
        base_t = build_clean_task_title(notes_text)
        base_t = re.sub(r'^(?:Went\s+to\s+|Follow-Up:\s*)', '', base_t, flags=re.I)
        fu_title = f"Follow-Up: {base_t[:75]}"

    return {
        "title": fu_title,
        "notes": f"Auto-detected follow-up from work log: {notes_text}"
    }


def determine_status_and_priority(item_text, header_done=False, tasked_date="", is_work_plan=False):
    """
    Determines task status ('Completed', 'In Progress', 'Pending', 'On Hold'),
    completedDate, and priority ('Critical', 'High', 'Medium', 'Low').
    """
    lower = item_text.lower()

    has_followup = is_work_plan or any(p in lower for p in [
        'to be follow up', 'to be followed up', 'follow up', 'to be gone to final approvals',
        'awaiting', 'waiting for', 'pending approval', 'still in progress', 'in progress',
        'to be done', 'need to follow', 'will do', 'will finish', 'to finish', 'works to be',
        'prepare'
    ])
    has_on_hold = 'on hold' in lower
    has_completed_cue = any(p in lower for p in [
        'sort it out', 'sorted it out', 'sorted out', 'got approved', 'approved by him',
        'completed', 'finished', 'done', 'needful', 'resolved', 'handed over', 'deposited',
        'cashed', 'collected', 'purchased', 'refilled'
    ]) and not any(p in lower for p in ['will finish', 'will do', 'to be done', 'works to be'])

    if has_on_hold:
        status = "On Hold"
        completed_date = ""
    elif has_followup and not has_completed_cue:
        status = "In Progress"
        completed_date = ""
    elif has_followup and header_done:
        status = "In Progress"
        completed_date = ""
    elif header_done or has_completed_cue:
        status = "Completed"
        completed_date = tasked_date
    else:
        status = "Pending"
        completed_date = ""

    if any(p in lower for p in ['urgent', 'critical', 'immediate', 'emergency']):
        priority = "Critical"
    elif any(p in lower for p in ['roc', 'system error', 'bo 2', 'fund transfer', 'bank', 'approval', 'registrar', 'ird', 'epf', 'etf', 'audit', 'salary', 'salaries', 'fa ', 'f a ']):
        priority = "High"
    else:
        priority = "Medium"

    return status, completed_date, priority


def find_matching_existing_task(item_title, item_notes, user_tasks, explicit_task_no=None, explicit_task_id=None):
    """
    Checks if a proposed task matches an existing task for the target user so SpillburgAI
    can propose an 'update' instead of duplicating, or update when requested.
    Prioritizes open ('In Progress' / 'Pending') tasks when matching daily logs.
    """
    if not user_tasks:
        return None

    if explicit_task_id:
        for t in user_tasks:
            if str(t.get("id", "")).lower() == str(explicit_task_id).lower():
                return t

    if explicit_task_no is not None:
        for t in user_tasks:
            if str(t.get("no", "")) == str(explicit_task_no):
                return t

    stop_words = {
        'went', 'to', 'the', 'for', 'from', 'and', 'got', 'by', 'him', 'her', 'was', 'there',
        'with', 'that', 'this', 'have', 'been', 'since', 'last', 'monday', 'yesterday', 'today',
        'task', 'work', 'works', 'done', 'update', 'edit', 'change', 'status', 'mark', 'needful',
        'bank', 'office', 'handed', 'over', 'deposited', 'cash', 'cheque', 'cashed', 'will'
    }
    combined_query = f"{item_title} {item_notes}".lower()
    q_tokens = {w for w in re.findall(r'[a-z0-9]{2,}', combined_query) if w not in stop_words}
    if not q_tokens:
        return None

    best_match = None
    best_score = 0.0

    for t in user_tasks:
        t_title = (t.get("title") or "").lower()
        t_notes = (t.get("notes") or "").lower()
        if "portal onboarding" in t_title and "onboarding" not in combined_query:
            continue
        t_tokens = {w for w in re.findall(r'[a-z0-9]{2,}', f"{t_title} {t_notes}") if w not in stop_words}
        if not t_tokens:
            continue
        intersection = q_tokens.intersection(t_tokens)
        score = len(intersection) / max(min(len(q_tokens), len(t_tokens)), 1)
        # Boost open tasks slightly so completing a pending/in-progress task matches it cleanly
        if t.get("status") in ["In Progress", "Pending"]:
            score += 0.08
        if score > best_score and len(intersection) >= 2:
            best_score = score
            best_match = t

    if best_score >= 0.60:
        return best_match
    return None


def parse_ai_cross_module_intent(user, message, customer_records, financial_records):
    """
    Detects commands to update a Customer File Register record (Cupboard / Box / Type)
    or a Financial Register record (TIN, IRD PIN, SSID, Filing Status, Notes) and returns
    an interactive approval proposal.
    """
    if not message or not message.strip():
        return None
    text = message.strip()
    lower = text.lower()

    # 1. Customer File Register update intent: e.g. "Move 113 East SL to Cupboard 2 Box 5" or "Update customer file #12 to Cupboard 1 Box 3"
    cust_cmd = re.search(
        r'\b(?:move|relocate|transfer|update|change|set)\s+(?:customer\s+file|company\s+file|file)?\s*(?:#?(\d+)|([a-z0-9\s.&()\-]{3,45}?))\s+(?:to|in|into)\s+(?:(cupboard\s*\d+|cupboard\s*[a-z0-9]+))?\s*[,&\s]*\s*(?:(box\s*(?:no\.?\s*)?\d+[a-z]?))?',
        lower
    )
    if cust_cmd and (cust_cmd.group(3) or cust_cmd.group(4)):
        rec_no = cust_cmd.group(1)
        comp_query = (cust_cmd.group(2) or "").strip()
        new_cupboard = (cust_cmd.group(3) or "").strip().title()
        new_box = (cust_cmd.group(4) or "").strip().title()
        new_box = re.sub(r'^Box\s+No\.?\s*', 'Box ', new_box, flags=re.I)

        matched_rec = None
        for r in customer_records:
            if rec_no and str(r.get("No", "")).strip() == rec_no:
                matched_rec = r
                break
            elif comp_query and len(comp_query) >= 3 and comp_query in str(r.get("Company Name", "")).lower():
                matched_rec = r
                break

        if matched_rec:
            if not can_user_edit_module(user, "customer_files"):
                return {
                    "reply": "🔒 **Customer Files Edit Permission Required**\n\nYou need `editor` or `full` permission on the Customer File Register to move or update archive locations.",
                    "intent": "restricted",
                    "restrictedModule": "customer_files"
                }
            proposed_record = {
                "No": matched_rec.get("No"),
                "Company Name": matched_rec.get("Company Name"),
                "Registration No": matched_rec.get("Registration No", ""),
                "Type": matched_rec.get("Type", "Original"),
                "Category": matched_rec.get("Category", "Original Files"),
                "Cupboard": new_cupboard or matched_rec.get("Cupboard", "Cupboard 1"),
                "Box No": new_box or matched_rec.get("Box No", "Box 1"),
                "Date of Incorporation": matched_rec.get("Date of Incorporation", "")
            }
            return {
                "reply": (
                    f"I matched **#{matched_rec.get('No')} {matched_rec.get('Company Name')}** in the Customer File Register.\n\n"
                    f"Review the proposed archive location update below (`{matched_rec.get('Cupboard')} → {matched_rec.get('Box No')}` to "
                    f"`{proposed_record['Cupboard']} → {proposed_record['Box No']}`) and click **Approve & Update File Register**."
                ),
                "intent": "cross_module_proposal",
                "module": "customer_files",
                "proposedRecord": proposed_record,
                "originalRecord": matched_rec
            }

    # 2. Financial File update intent: e.g. "Update financial file for Zhong Hui Lanka filing status to Completed" or "Update TIN for Remi Dream Lanka to 102938475"
    fin_cmd = re.search(
        r'\b(?:update|set|mark|change)\s+(?:financial\s+(?:file|record)|tax\s+record|tin|ird\s+pin|ssid|filing\s+status|audit\s+status)?\s*(?:for|of)?\s+([a-z0-9\s.&()\-]{3,45}?)\s+(?:(tin|ird\s*pin|ssid|filing\s*status|notes)\s+)?(?:to|as|=|:)\s+(.+)$',
        text,
        flags=re.I
    )
    if fin_cmd and any(k in lower for k in ['financial', 'tin', 'ird', 'ssid', 'filing status', 'audit status']):
        entity_q = fin_cmd.group(1).strip().lower()
        field_raw = (fin_cmd.group(2) or "").strip().lower()
        val_raw = fin_cmd.group(3).strip()

        matched_fin = None
        for r in financial_records:
            if entity_q in str(r.get("entityName", "")).lower():
                matched_fin = r
                break

        if matched_fin:
            if not can_user_edit_module(user, "financial_files"):
                return {
                    "reply": "🔒 **Financial Register Edit Permission Required**\n\nYou need `editor` or `full` permission on the Financial Files DB to modify tax or audit records.",
                    "intent": "restricted",
                    "restrictedModule": "financial_files"
                }
            updated_fin = dict(matched_fin)
            if "tin" in field_raw or "tin" in lower:
                updated_fin["tinNo"] = val_raw
                changed_field = "TIN No"
            elif "pin" in field_raw or "ird" in lower:
                updated_fin["irdPin"] = val_raw
                changed_field = "IRD PIN"
            elif "ssid" in field_raw:
                updated_fin["ssid"] = val_raw
                changed_field = "SSID"
            elif "status" in field_raw or "filing" in lower or "audit" in lower:
                updated_fin["filingStatus"] = val_raw
                changed_field = "Filing / Audit Status"
            else:
                updated_fin["notes"] = val_raw
                changed_field = "Notes"

            return {
                "reply": (
                    f"I matched **{matched_fin.get('entityName')}** in the Financial & Tax Register.\n\n"
                    f"Please review the proposed update to **{changed_field}** (`{val_raw}`) below and click **Approve & Update Financial Record**."
                ),
                "intent": "cross_module_proposal",
                "module": "financial_files",
                "changedField": changed_field,
                "proposedRecord": updated_fin,
                "originalRecord": matched_fin
            }

    return None



def extract_raw_task_items(text, users=None):
    """
    Extracts individual task entries from a raw message, supporting:
    1. Numbered lists: 1) ... 2) ... or 1. ... 2. ... or bullet points
    2. Repeated staff name markers: 'Ravi\nGoing to...\nRavi\nGoing to...'
    3. Action verb sequences: 'Going to IRD...\nGoing to pay EPF...'
    4. Multi-line work plans (e.g. 'Today Works to be,' / 'tasks for staff_hemanthi') and inline work plans
    """
    lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
    if not lines:
        return []

    # 1. Explicit numbered items
    num_matches = list(re.finditer(r'(?:^|\n)\s*(?:\(?(\d{1,2})\)\s*|\(?(\d{1,2})[.:]\s+|[-•*]\s+)', text))
    if len(num_matches) < 2:
        inline_m = list(re.finditer(r'(?:^|\n|(?<=\s))\(?(\d{1,2})\)\s*(?=[A-Za-z])', text))
        if len(inline_m) >= 2:
            num_matches = inline_m
    if num_matches:
        items = []
        for idx, m in enumerate(num_matches):
            s = m.end()
            e = num_matches[idx + 1].start() if idx + 1 < len(num_matches) else len(text)
            it = text[s:e].strip()
            if it:
                items.append(it)
        if len(items) >= 1:
            return items

    staff_tok = r'(?:staff_)?(?:ravi|hemanthi|insaaf|insaff|bilal|zaharan|shameel|shaameel)'
    cmd_head_pat = rf'^(?:tasks?\s*tracker\s*update|(?:(?:create|add|new|update|edit|track|log)\s+)*(?:the\s+)?(?:tasks?|tracker|works?)(?:\s+(?:for|of|to)\s+@?{staff_tok})?)\s*[,:\-–]*\s*$'
    work_plan_hdr_pat = r'^(?:today(?:\'?s)?\s+works?(?:\s+to\s+be|\s+done)?|yesterday(?:\'?s)?\s+(?:completed\s+)?works?|works?\s+to\s+be(?:\s+done|\s+completed)?|to\s+be\s+completed?)\s*[,:\-–]*\s*$'
    name_pat = rf'^@?{staff_tok}\b[:\- ]*$'
    action_verb_pat = r'^(?:going\s+to|went\s+to|visit|visiting|to\s+be|need\s+to|collect|collecting|collected|hand\s+over|handed\s+over|call|calling|called|pay|paying|paid|meet|meeting|met|deposit|depositing|deposited|purchas|purchasing|follow\s+up|followed\s+up|submit|submitting|submitted|sort\s+out|sorted\s+out|prepare|preparing|update|updating|complete|completing)\b'

    has_plan_header = any(
        re.match(cmd_head_pat, l, re.I) or re.match(work_plan_hdr_pat, l, re.I)
        for l in lines
    ) or bool(re.search(r"today(?:'?s)?\s+works?\s*(?:to\s+be|done)?|yesterday(?:'?s)?\s+(?:completed\s+)?works?|\bworks?\s+to\s+be\b", text, re.I))

    has_repeated_names = sum(1 for l in lines if re.match(name_pat, l, re.I)) >= 2

    # Strip header lines first
    body_lines = []
    for l in lines:
        if re.match(cmd_head_pat, l, re.I) or re.match(work_plan_hdr_pat, l, re.I):
            continue
        # Also strip inline header prefix if someone wrote header + first task on the same line
        l_clean = re.sub(
            rf'^(?:(?:create|add|new|update|edit|track|log)\s+)*(?:the\s+)?(?:tasks?|tracker|works?)\s+(?:for|of|to)\s+@?{staff_tok}\b\s*[,:\-–]*\s*',
            '',
            l,
            flags=re.I
        ).strip()
        l_clean = re.sub(
            r'^(?:today(?:\'?s)?\s+works?(?:\s+to\s+be|\s+done)?|yesterday(?:\'?s)?\s+(?:completed\s+)?works?|works?\s+to\s+be(?:\s+done|\s+completed)?)\s*[,:\-–]*\s*',
            '',
            l_clean,
            flags=re.I
        ).strip()
        if l_clean:
            body_lines.append(l_clean)

    # If this is a multi-line work plan (e.g. Hemanthi's 'Today Works to be' list) without repeated name separators,
    # each line is a separate task item (unless a line is just a parenthetical continuation note)
    if (has_plan_header or len(body_lines) >= 2) and not has_repeated_names:
        will_do_lines = sum(1 for l in body_lines if re.search(r'\b(?:will\s+do|will\s+finish|to\s+be|prepare|update|finish|complete)\b', l, re.I))
        if has_plan_header or will_do_lines >= 2:
            plan_items = []
            for l in body_lines:
                if l.startswith('(') and plan_items:
                    plan_items[-1] = f"{plan_items[-1]} {l}"
                else:
                    # Also handle if multiple items were pasted onto a single line
                    sub_parts = re.sub(
                        r'(\b(?:will\s+do|will\s+finish|prepare\s+SV|both\s+company|both\s+companies))\s+(?=[A-Z])',
                        r'\1\n',
                        l
                    ).splitlines()
                    for sp in sub_parts:
                        sp_clean = sp.strip().rstrip(',.')
                        if sp_clean and len(sp_clean) >= 3:
                            plan_items.append(sp_clean)
            if len(plan_items) >= 1:
                return plan_items

    # 2. Repeated name separators or action line sequences
    items = []
    current_item = []

    for l in body_lines:
        is_name_hdr = bool(re.match(name_pat, l, re.I))
        is_act = bool(re.match(action_verb_pat, l, re.I))

        if is_name_hdr:
            if current_item:
                items.append(' '.join(current_item))
                current_item = []
        elif is_act:
            if current_item:
                items.append(' '.join(current_item))
                current_item = [l]
            else:
                current_item.append(l)
        else:
            if current_item:
                current_item.append(l)
            else:
                current_item = [l]

    if current_item:
        items.append(' '.join(current_item))

    cleaned_items = []
    for it in items:
        it_clean = re.sub(rf'^(?:tasks?\s*tracker\s*update|(?:(?:create|add|new|update|edit|track)\s+)+(?:the\s+)?(?:tasks?|tracker)?(?:\s+(?:for|to|of)\s+)?(?:@?{staff_tok}\b)?\s*)', '', it, flags=re.I).strip()
        it_clean = re.sub(rf'^@?{staff_tok}\b[:\- ]*', '', it_clean, flags=re.I).strip()
        if it_clean and len(it_clean) >= 4:
            cleaned_items.append(it_clean)

    return cleaned_items


def parse_ai_task_intent(user, message, users, operations):
    """
    Detects if the user's message is a work report / task list (like Ravi's 1) 2) 3) 4) report
    or Hemanthi's 'Today's works to be' list) or a command to add / update / edit tasks,
    and returns a structured proposal for user approval (including automatic follow-up generation).
    """
    if not message or not message.strip():
        return None

    text = message.strip()
    lower = text.lower()

    # Check if there are numbered items like "1)", "1)Went", "1. ", "(1)" or bullet items
    numbered_matches = list(re.finditer(r'(?:^|\n)\s*(?:\(?(\d{1,2})\)\s*|\(?(\d{1,2})[.:]\s+|[-•*]\s+)', text))
    if len(numbered_matches) < 2:
        inline_matches = list(re.finditer(r'(?:^|\n|(?<=\s))\(?(\d{1,2})\)\s*(?=[A-Za-z])', text))
        if len(inline_matches) >= 2:
            numbered_matches = inline_matches

    # Also check unnumbered multi-line work plans (supports both "Today's works" and "Today Works to be")
    is_work_plan_header = bool(re.search(
        r"today(?:'?s)?\s+works?\s*(?:to\s+be|done)?|yesterday(?:'?s)?\s+(?:completed\s+)?works?|\bworks?\s+to\s+be\b",
        lower
    ))
    is_explicit_task_cmd = bool(re.search(
        r'\b(?:add|create|new|assign|update|edit|mark|log|track)\s*(?:and\s*update\s*)?(?:the\s*)?(?:tasks?|tracker|deliverables?|todos?|to-dos?|works?|work\s*log|daily\s*log)\b|\b(?:tasks?|tracker)\s+(?:update|create|entry|log)\b|\b(?:done\s+the\s+works|works\s+done|daily\s+report|work\s+report)\b',
        lower
    ))

    raw_items = extract_raw_task_items(text, users)
    is_action_sequence = len(raw_items) >= 2

    if len(numbered_matches) < 1 and not is_explicit_task_cmd and not is_work_plan_header and not is_action_sequence:
        return None

    target_user = resolve_target_user_from_text(text, users, user)
    target_uid = target_user.get("id")
    target_uname = target_user.get("username")
    target_fname = target_user.get("fullName") or target_uname

    user_existing_tasks = [
        t for t in operations
        if t.get("userId") == target_uid
        or (t.get("ownerUsername") and t.get("ownerUsername").lower() == (target_uname or "").lower())
        or (target_fname and t.get("assignedTo") and t.get("assignedTo").lower() == target_fname.lower())
    ]

    header_text = text[:numbered_matches[0].start()] if numbered_matches else text
    tasked_date = extract_standard_date(header_text if numbered_matches else text)
    header_done = bool(re.search(r'\b(?:done\s+the\s+works|works\s+done|completed|did\s+the\s+works|yesterday\s+on|today(?:\'?s)?\s+work\s+done)\b', header_text.lower()))

    proposed_tasks = []
    auto_followups_count = 0

    items_to_process = []
    if numbered_matches:
        for idx, m in enumerate(numbered_matches):
            start_pos = m.end()
            end_pos = numbered_matches[idx + 1].start() if idx + 1 < len(numbered_matches) else len(text)
            raw_item = text[start_pos:end_pos].strip()
            if raw_item:
                items_to_process.append(raw_item)
    elif raw_items:
        items_to_process = raw_items

    if items_to_process:
        for raw_item in items_to_process:
            cleaned_notes = clean_item_notes(raw_item)
            if not cleaned_notes:
                continue

            title = build_clean_task_title(raw_item)
            workstream, task_type = classify_workstream_and_type(cleaned_notes)
            req_by = infer_requester_from_text(cleaned_notes, default_requester=user.get("fullName") or "Mr. Shameel")
            status, completed_date, priority = determine_status_and_priority(
                cleaned_notes,
                header_done=header_done,
                tasked_date=tasked_date,
                is_work_plan=is_work_plan_header
            )

            existing = find_matching_existing_task(title, cleaned_notes, user_existing_tasks)
            action = "update" if existing else "create"

            proposed_tasks.append({
                "proposalId": f"prop_{len(proposed_tasks) + 1}_{uuid.uuid4().hex[:4]}",
                "action": action,
                "existingTaskId": existing.get("id") if existing else "",
                "existingTaskNo": existing.get("no") if existing else None,
                "existingTaskTitle": existing.get("title") if existing else "",
                "userId": target_uid,
                "ownerUsername": target_uname,
                "assignedTo": target_fname,
                "requestedBy": existing.get("requestedBy") if existing else req_by,
                "title": title,
                "workstream": workstream,
                "type": task_type,
                "taskedDate": tasked_date,
                "completedDate": completed_date,
                "status": status,
                "priority": priority,
                "estimatedCost": existing.get("estimatedCost", "") if existing else "",
                "notes": cleaned_notes,
                "isAutoFollowUp": False
            })

            # If this was a completed field visit that also noted a follow-up requirement, propose a separate Follow-Up task!
            fu = extract_followup_action(cleaned_notes)
            if fu and header_done:
                fu_existing = find_matching_existing_task(fu["title"], fu["notes"], user_existing_tasks)
                if not fu_existing or (existing and fu_existing.get("id") == existing.get("id")):
                    auto_followups_count += 1
                    proposed_tasks.append({
                        "proposalId": f"prop_fu_{len(proposed_tasks) + 1}_{uuid.uuid4().hex[:4]}",
                        "action": "create",
                        "existingTaskId": "",
                        "existingTaskNo": None,
                        "existingTaskTitle": "",
                        "userId": target_uid,
                        "ownerUsername": target_uname,
                        "assignedTo": target_fname,
                        "requestedBy": req_by,
                        "title": fu["title"],
                        "workstream": workstream,
                        "type": "Follow-Up Action",
                        "taskedDate": tasked_date,
                        "completedDate": "",
                        "status": "In Progress",
                        "priority": "High",
                        "estimatedCost": "",
                        "notes": fu["notes"],
                        "isAutoFollowUp": True
                    })
    elif is_work_plan_header:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        plan_items = []
        for ln in lines:
            if re.search(r"today'?s\s+works?|yesterday'?s?\s+works?|to\s+be\s+complete", ln.lower()):
                continue
            if len(ln) >= 3:
                plan_items.append(ln.rstrip(",."))
        for idx, item_ln in enumerate(plan_items):
            cleaned_notes = clean_item_notes(item_ln)
            title = build_clean_task_title(cleaned_notes)
            workstream, task_type = classify_workstream_and_type(cleaned_notes)
            req_by = infer_requester_from_text(cleaned_notes, default_requester=user.get("fullName") or "Mr. Shameel")
            status, completed_date, priority = determine_status_and_priority(cleaned_notes, header_done=header_done, tasked_date=tasked_date)
            existing = find_matching_existing_task(title, cleaned_notes, user_existing_tasks)
            proposed_tasks.append({
                "proposalId": f"prop_{idx + 1}_{uuid.uuid4().hex[:4]}",
                "action": "update" if existing else "create",
                "existingTaskId": existing.get("id") if existing else "",
                "existingTaskNo": existing.get("no") if existing else None,
                "existingTaskTitle": existing.get("title") if existing else "",
                "userId": target_uid,
                "ownerUsername": target_uname,
                "assignedTo": target_fname,
                "requestedBy": existing.get("requestedBy") if existing else req_by,
                "title": title,
                "workstream": workstream,
                "type": task_type,
                "taskedDate": tasked_date,
                "completedDate": completed_date,
                "status": status,
                "priority": priority,
                "estimatedCost": "",
                "notes": cleaned_notes,
                "isAutoFollowUp": False
            })
    else:
        # Single natural language task creation or update/edit command
        explicit_no_m = re.search(r'\btask\s*#?(\d+)\b', lower)
        explicit_id_m = re.search(r'\b(ops_[a-z0-9_]+)\b', lower)
        explicit_no = int(explicit_no_m.group(1)) if explicit_no_m else None
        explicit_id = explicit_id_m.group(1) if explicit_id_m else None

        is_update_verb = bool(re.search(r'\b(?:update|edit|change|mark|set|complete)\b', lower))
        desc = re.sub(
            r'^(?:please\s+)?(?:can\s+you\s+)?(?:add|create|assign|update|edit|mark|change|set)\s+(?:a\s+)?(?:new\s+)?(?:task\s*(?:#?\d+|ops_[a-z0-9_]+)?\s*)?(?:for|to|of)?\s*(?:@[a-z0-9_]+|[A-Za-z]+)?\s*[:\-–]?\s*',
            '',
            text,
            flags=re.I
        ).strip() or text

        cleaned_notes = clean_item_notes(desc)
        title = build_clean_task_title(cleaned_notes)
        workstream, task_type = classify_workstream_and_type(cleaned_notes)
        req_by = infer_requester_from_text(cleaned_notes, default_requester=user.get("fullName") or "Mr. Shameel")
        status, completed_date, priority = determine_status_and_priority(text, header_done=('completed' in lower or 'done' in lower), tasked_date=tasked_date)

        st_m = re.search(r'\b(?:to|as|status\s*[:=]?)\s*(completed|in\s+progress|pending|on\s+hold)\b', lower)
        if st_m:
            st_val = st_m.group(1).title()
            if st_val.lower() == "in progress":
                st_val = "In Progress"
            elif st_val.lower() == "on hold":
                st_val = "On Hold"
            status = st_val
            completed_date = tasked_date if status == "Completed" else ""

        existing = find_matching_existing_task(title, cleaned_notes, user_existing_tasks, explicit_task_no=explicit_no, explicit_task_id=explicit_id)
        action = "update" if (existing or is_update_verb and existing) else "create"

        if existing:
            title = existing.get("title") or title
            workstream = existing.get("workstream") or workstream
            task_type = existing.get("type") or task_type
            tasked_date = existing.get("taskedDate") or tasked_date

        proposed_tasks.append({
            "proposalId": f"prop_1_{uuid.uuid4().hex[:4]}",
            "action": action,
            "existingTaskId": existing.get("id") if existing else "",
            "existingTaskNo": existing.get("no") if existing else None,
            "existingTaskTitle": existing.get("title") if existing else "",
            "userId": target_uid,
            "ownerUsername": target_uname,
            "assignedTo": target_fname,
            "requestedBy": existing.get("requestedBy") if existing else req_by,
            "title": title,
            "workstream": workstream,
            "type": task_type,
            "taskedDate": tasked_date,
            "completedDate": completed_date,
            "status": status,
            "priority": priority,
            "estimatedCost": existing.get("estimatedCost", "") if existing else "",
            "notes": cleaned_notes,
            "isAutoFollowUp": False
        })

    if not proposed_tasks:
        return None

    create_count = sum(1 for t in proposed_tasks if t["action"] == "create")
    update_count = sum(1 for t in proposed_tasks if t["action"] == "update")

    summary_parts = []
    if create_count:
        summary_parts.append(f"**{create_count} new task{'s' if create_count > 1 else ''}** to create")
    if update_count:
        summary_parts.append(f"**{update_count} existing task{'s' if update_count > 1 else ''}** to update")
    if auto_followups_count:
        summary_parts.append(f"(including **{auto_followups_count} auto-detected follow-up reminder{'s' if auto_followups_count > 1 else ''}**)")

    reply_md = (
        f"I have analyzed the work log for **{target_fname}** (`@{target_uname}`) dated **{tasked_date}** "
        f"and prepared {' and '.join(summary_parts)}.\n\n"
        f"Please review the extracted task details below. You can edit any field (Title, Action, Target User, Status, Priority, Workstream, Dates, or Notes) and click **Approve & Apply Tasks** to commit them to **{target_fname}'s Operations Tracker**."
    )

    return {
        "reply": reply_md,
        "intent": "task_proposal",
        "targetUser": {
            "id": target_uid,
            "username": target_uname,
            "fullName": target_fname,
            "role": target_user.get("role", "staff"),
            "title": target_user.get("title", "Staff Member")
        },
        "taskedDate": tasked_date,
        "proposedTasks": proposed_tasks,
        "existingUserTasks": [
            {
                "id": t.get("id"),
                "no": t.get("no"),
                "title": t.get("title"),
                "status": t.get("status"),
                "taskedDate": t.get("taskedDate"),
                "workstream": t.get("workstream")
            }
            for t in user_existing_tasks
        ]
    }


def generate_morning_call_briefing(user, users, operations, customer_records, financial_records, payroll_records):
    """
    Generates an executive 9:00–9:30 AM Morning Call Briefing & Compliance Alert summary,
    strictly scoped to the user's permissions.
    """
    access = get_user_access_summary(user)
    is_exec = access["role"] in ["director", "admin"]
    scoped_ops = list(operations) if is_exec else [
        t for t in operations
        if t.get("userId") == user.get("id")
        or (t.get("ownerUsername") and t.get("ownerUsername").lower() == (user.get("username") or "").lower())
    ]

    total = len(scoped_ops)
    comp = sum(1 for t in scoped_ops if t.get("status") == "Completed")
    in_prog = [t for t in scoped_ops if t.get("status") == "In Progress"]
    pending = [t for t in scoped_ops if t.get("status") == "Pending"]
    on_hold = [t for t in scoped_ops if t.get("status") == "On Hold"]

    lines = [
        f"### ☀️ Spillburg Holdings — 9:00 AM Morning Call Executive Briefing",
        f"- **Date**: `{datetime.date.today().strftime('%d-%b-%Y')}` | **Prepared for**: **{user.get('fullName')}** (`{access['role'].upper()}`)",
        f"- **Tracker Overview**: `{total}` Total Tasks (`{comp}` Completed · `{len(in_prog)}` In Progress · `{len(pending)}` Pending · `{len(on_hold)}` On Hold)"
    ]

    # Staff breakdown if executive
    if is_exec:
        lines.append("\n#### 👥 Team Workload & Recent Activity Breakdown")
        staff_order = [
            ("usr_6b04a953", "Ravindralal Mahinda Wijeweera (Ravi)"),
            ("usr_staff_hemanthi", "Miss Hemanthi"),
            ("usr_staff_insaaf", "Insaaf"),
            ("usr_bcc9abca", "Bilal Mohideen"),
            ("usr_admin_zaharan", "Muhammad Zaharan")
        ]
        for uid, label in staff_order:
            u_tasks = [t for t in scoped_ops if t.get("userId") == uid]
            if not u_tasks:
                continue
            u_comp = sum(1 for t in u_tasks if t.get("status") == "Completed")
            u_act = sum(1 for t in u_tasks if t.get("status") in ["In Progress", "Pending"])
            latest_done = [t for t in u_tasks if t.get("status") == "Completed"][-2:]
            latest_titles = "; ".join(f"{t.get('title')[:55]} ({t.get('taskedDate')})" for t in latest_done)
            lines.append(
                f"- **{label}**: `{len(u_tasks)}` total (`{u_comp}` Done, `{u_act}` Active)\n"
                + (f"  - *Latest Completed*: {latest_titles}" if latest_titles else "")
            )

    # Priority Active / Follow-Up Items
    lines.append(f"\n#### 🚨 Active Follow-Ups & In-Progress Deliverables ({len(in_prog) + len(pending)} items)")
    active_items = in_prog + pending
    for t in active_items[:12]:
        lines.append(
            f"- **[`{t.get('status')}`] #{t.get('no')} {t.get('title')}** — Assignee: **{t.get('assignedTo')}** | Priority: `{t.get('priority')}` | Date: `{t.get('taskedDate')}`\n"
            f"  - *Notes*: {t.get('notes') or '-'}"
        )

    # Stale / On-Hold / Compliance Alerts
    # Calculate dynamic statutory countdowns
    today = datetime.date.today()
    next_m = today.replace(day=28) + datetime.timedelta(days=4)
    last_day_of_month = next_m - datetime.timedelta(days=next_m.day)
    days_to_epf = max(0, (last_day_of_month - today).days)

    nov_30 = datetime.date(today.year if (today.month < 11 or (today.month == 11 and today.day <= 30)) else today.year + 1, 11, 30)
    days_to_nov_30 = max(0, (nov_30 - today).days)

    quarters = [
        datetime.date(today.year, 2, 15),
        datetime.date(today.year, 5, 15),
        datetime.date(today.year, 8, 15),
        datetime.date(today.year, 11, 15),
        datetime.date(today.year + 1, 2, 15),
    ]
    next_inst = min(d for d in quarters if d >= today)
    days_to_inst = max(0, (next_inst - today).days)

    lines.append(
        f"\n#### 📅 Statutory Compliance Calendar & Deadlines\n"
        f"- **EPF & ETF Monthly Remittance**: Due by `{last_day_of_month.strftime('%d-%b-%Y')}` (**{days_to_epf} days remaining**)\n"
        f"- **IRD RAMIS Quarterly Tax Installment**: Next payment due `{next_inst.strftime('%d-%b-%Y')}` (**{days_to_inst} days remaining**)\n"
        f"- **RAMIS Corporate Return of Income**: Statutory deadline `{nov_30.strftime('%d-%b-%Y')}` (**{days_to_nov_30} days remaining**)"
    )

    alert_lines = ["\n#### ⚠️ Operational Compliance & Stale Task Alerts"]
    if on_hold:
        alert_lines.append(f"- **On-Hold Deliverables**: `{len(on_hold)}` tasks are currently marked `On Hold` and may need scope review.")
    if access["modules"]["payroll"]["view"]:
        comps = payroll_records.get("companies", [])
        missing_stat = [c.get("name") for c in comps if not c.get("epfRegNo") or not c.get("etfRegNo")]
        if missing_stat:
            alert_lines.append(f"- **Payroll Statutory Alert**: Missing EPF/ETF Reg No on: {', '.join(missing_stat)}")
        else:
            alert_lines.append(f"- **Payroll Statutory Check**: All `{len(comps)}` payroll companies have unique EPF & ETF registration numbers configured.")
    if access["modules"]["financial_files"]["view"]:
        pending_fin = sum(1 for r in financial_records if "pending" in str(r.get("filingStatus", "Pending")).lower())
        alert_lines.append(f"- **Tax & Audit Register**: `{pending_fin}` of `{len(financial_records)}` entities have pending filing/audit statuses.")
    lines.extend(alert_lines)

    nav_actions = [
        {"label": "Open All Team Tasks", "view": "operations", "forUser": "all" if is_exec else "me"},
        {"label": "Ravi's Tracker", "view": "operations", "forUser": "usr_6b04a953"},
        {"label": "Hemanthi's Tracker", "view": "operations", "forUser": "usr_staff_hemanthi"},
        {"label": "Insaaf's Tracker", "view": "operations", "forUser": "usr_staff_insaaf"},
        {"label": "Bilal's Tracker", "view": "operations", "forUser": "usr_bcc9abca"}
    ] if is_exec else [
        {"label": "Open My Operations Tracker", "view": "operations", "forUser": "me"}
    ]

    return {
        "reply": "\n".join(lines),
        "intent": "morning_briefing",
        "navActions": nav_actions,
        "accessSummary": access
    }


def answer_knowledge_query(user, message, users, operations, customer_records, financial_records, payroll_records, enrich_payroll_fn, history=None, attachments=None):
    """
    Answers natural language questions across all Spillburg Holdings datasets, strictly enforcing
    each user's module permissions and personal/team scope.
    """
    text = (message or "").strip()
    lower = text.lower()
    access = get_user_access_summary(user)
    role = access["role"]
    is_exec = role in ["director", "admin"]

    # Check if user asked for Morning Call Briefing / Daily Briefing / Compliance Alerts
    if any(k in lower for k in ['morning call', 'daily briefing', 'morning briefing', 'compliance alert', 'stale task', 'team summary', 'standup']):
        if not access["modules"]["operations"]["view"]:
            return {
                "reply": "🔒 **Access Restricted — Operations Tracker**\n\nYour account does not have access to generate the Operations Morning Call Briefing.",
                "intent": "restricted",
                "restrictedModule": "operations"
            }
        return generate_morning_call_briefing(user, users, operations, customer_records, financial_records, payroll_records)

    payroll_keywords = ['payroll', 'salary', 'salaries', 'epf', 'etf', 'form c', 'form r-4', 'form r4', 'remittance', 'apadmi', 'spillburg vacation', 'exchange rate', 'gbp', 'net pay', 'gross pay', 'apit', 'payslip', 'cheque']
    asks_payroll = any(k in lower for k in payroll_keywords)

    fin_keywords = ['tin', 'ird', 'pin', 'ssid', 'tax', 'financial file', 'financial register', 'audit', 'annual return', 'assessment year', 'passport', 'ramis', 'filing status']
    asks_fin = any(k in lower for k in fin_keywords)

    cust_keywords = ['customer file', 'cupboard', 'box file', 'box no', 'original file', 'copy file', 'incorporation', 'pv', 'archive']
    asks_cust = any(k in lower for k in cust_keywords)

    ops_keywords = ['task', 'tasks', 'operation', 'operations', 'pending', 'in progress', 'completed', 'on hold', 'workstream', 'deliverable', 'todo', 'to-do', 'assigned', 'tracker']
    asks_ops = any(k in lower for k in ops_keywords)

    user_keywords = ['permission', 'permissions', 'access level', 'my access', 'who has access', 'user account', 'users', 'staff list', 'team members']
    asks_users = any(k in lower for k in user_keywords)

    # --- ENFORCE PERMISSION RESTRICTIONS ---
    if asks_payroll and not access["modules"]["payroll"]["view"]:
        return {
            "reply": (
                "🔒 **Access Restricted — Corporate Payroll & Bank Remittance**\n\n"
                f"Your account (**{user.get('fullName')}**, Role: `{role.upper()}`, Payroll Permission: `{access['modules']['payroll']['level']}`) "
                "does not have authorization to view corporate payroll records, staff salaries, EPF/ETF returns, or bank remittance files.\n\n"
                "Please contact a **Director** or **System Administrator** if you require access to the Payroll module."
            ),
            "intent": "restricted",
            "restrictedModule": "payroll"
        }

    if asks_fin and not access["modules"]["financial_files"]["view"]:
        return {
            "reply": (
                "🔒 **Access Restricted — Financial Files & Tax Register**\n\n"
                f"Your account (**{user.get('fullName')}**, Role: `{role.upper()}`, Financial DB Permission: `{access['modules']['financial_files']['level']}`) "
                "does not have authorization to view client TIN numbers, IRD PINs/passwords, SSIDs, or tax filing registers.\n\n"
                "Please contact a **Director** or **System Administrator** to request Financial Files DB access."
            ),
            "intent": "restricted",
            "restrictedModule": "financial_files"
        }

    if asks_cust and not access["modules"]["customer_files"]["view"]:
        return {
            "reply": (
                "🔒 **Access Restricted — Customer File Database**\n\n"
                f"Your account (**{user.get('fullName')}**, Role: `{role.upper()}`, Customer DB Permission: `{access['modules']['customer_files']['level']}`) "
                "does not have authorization to query the Customer File Database."
            ),
            "intent": "restricted",
            "restrictedModule": "customer_files"
        }

    if asks_ops and not access["modules"]["operations"]["view"]:
        return {
            "reply": (
                "🔒 **Access Restricted — Operations Tracker**\n\n"
                f"Your account (**{user.get('fullName')}**) does not currently have access to the Operations Tracker module."
            ),
            "intent": "restricted",
            "restrictedModule": "operations"
        }

    sections = []
    nav_actions = []

    # Check for Sri Lankan statutory / ROC / Tax compliance guidance
    statutory_info = get_statutory_knowledge_response(text)
    if statutory_info:
        sections.append(statutory_info)

    mentioned_user = resolve_target_user_from_text(text, users, None)
    if mentioned_user and not is_exec and mentioned_user.get("id") != user.get("id") and asks_ops:
        return {
            "reply": (
                "🔒 **Personal Tracker Scope Restriction**\n\n"
                f"As a Staff account (**{user.get('fullName')}**), your Operations Tracker access is scoped to your **personal tasks only**. "
                f"Viewing tasks assigned to **{mentioned_user.get('fullName')}** requires **Director** or **Administrator** privileges."
            ),
            "intent": "restricted",
            "restrictedModule": "operations_scope"
        }

    # A. OPERATIONS SEARCH / SUMMARY
    if access["modules"]["operations"]["view"]:
        if is_exec:
            scoped_ops = list(operations)
        else:
            uid = user.get("id")
            uname = (user.get("username") or "").lower()
            fname = (user.get("fullName") or "").lower()
            scoped_ops = [
                t for t in operations
                if t.get("userId") == uid
                or (t.get("ownerUsername") and t.get("ownerUsername").lower() == uname)
                or (fname and t.get("assignedTo") and t.get("assignedTo").lower() == fname)
            ]

        if mentioned_user and (is_exec or mentioned_user.get("id") == user.get("id")):
            m_uid = mentioned_user.get("id")
            m_uname = (mentioned_user.get("username") or "").lower()
            m_fname = (mentioned_user.get("fullName") or "").lower()
            user_ops = [
                t for t in scoped_ops
                if t.get("userId") == m_uid
                or (t.get("ownerUsername") and t.get("ownerUsername").lower() == m_uname)
                or (m_fname and t.get("assignedTo") and t.get("assignedTo").lower() == m_fname)
            ]
            if asks_ops or len(text.split()) <= 8:
                comp = sum(1 for t in user_ops if t.get("status") == "Completed")
                in_p = sum(1 for t in user_ops if t.get("status") == "In Progress")
                pend = sum(1 for t in user_ops if t.get("status") == "Pending")
                hold = sum(1 for t in user_ops if t.get("status") == "On Hold")
                lines = [
                    f"### 📋 Operations Tasks for {mentioned_user.get('fullName')} (`@{mentioned_user.get('username')}`)",
                    f"- **Total Tasks**: `{len(user_ops)}` (`{comp}` Completed, `{in_p}` In Progress, `{pend}` Pending, `{hold}` On Hold)"
                ]
                # Show active tasks first, then most recent completed tasks
                active_u = [t for t in user_ops if t.get("status") in ["In Progress", "Pending"]]
                done_u = [t for t in user_ops if t.get("status") == "Completed"]
                display_u = active_u + list(reversed(done_u))
                for t in display_u[:12]:
                    lines.append(
                        f"  - **#{t.get('no')} {t.get('title')}** — `{t.get('status')}` | *{t.get('workstream', 'General')}* | Tasked: `{t.get('taskedDate') or '-'}`"
                        + (f" | Done: `{t.get('completedDate')}`" if t.get("completedDate") else "")
                        + (f"\n    *Notes*: {t.get('notes')}" if t.get("notes") else "")
                    )
                if len(user_ops) > 12:
                    lines.append(f"  - *...and {len(user_ops) - 12} more tasks in {mentioned_user.get('fullName')}'s tracker.*")
                sections.append("\n".join(lines))
                nav_actions.append({
                    "label": f"Open {mentioned_user.get('fullName')}'s Tracker ({len(user_ops)})",
                    "view": "operations",
                    "forUser": m_uid
                })
        elif asks_ops:
            filtered_ops = scoped_ops
            if 'pending' in lower and 'in progress' in lower:
                filtered_ops = [t for t in scoped_ops if (t.get("status") or "").lower() in ["pending", "in progress"]]
            elif 'pending' in lower:
                filtered_ops = [t for t in scoped_ops if (t.get("status") or "").lower() == "pending"]
            elif 'in progress' in lower:
                filtered_ops = [t for t in scoped_ops if (t.get("status") or "").lower() == "in progress"]
            elif 'completed' in lower:
                filtered_ops = [t for t in scoped_ops if (t.get("status") or "").lower() == "completed"]
            elif 'on hold' in lower:
                filtered_ops = [t for t in scoped_ops if (t.get("status") or "").lower() == "on hold"]

            comp = sum(1 for t in scoped_ops if t.get("status") == "Completed")
            in_p = sum(1 for t in scoped_ops if t.get("status") == "In Progress")
            pend = sum(1 for t in scoped_ops if t.get("status") == "Pending")
            hold = sum(1 for t in scoped_ops if t.get("status") == "On Hold")
            scope_label = "All Team Members" if is_exec else user.get("fullName")
            lines = [
                f"### 📋 Operations Tracker Summary ({scope_label})",
                f"- **Total Tasks**: `{len(scoped_ops)}` | **Completed**: `{comp}` | **In Progress**: `{in_p}` | **Pending**: `{pend}` | **On Hold**: `{hold}`",
                f"- **Showing ({len(filtered_ops)}) matching tasks**:"
            ]
            for t in filtered_ops[:12]:
                lines.append(
                    f"  - **#{t.get('no')} {t.get('title')}** ({t.get('assignedTo', 'Unassigned')}) — `{t.get('status')}` | *{t.get('workstream', 'General')}* | `{t.get('taskedDate') or '-'}`"
                )
            sections.append("\n".join(lines))
            nav_actions.append({
                "label": f"Open Operations Tracker ({len(scoped_ops)})",
                "view": "operations",
                "forUser": "all" if is_exec else "me"
            })

    # B. PAYROLL SEARCH / SUMMARY
    if asks_payroll and access["modules"]["payroll"]["view"]:
        companies = payroll_records.get("companies", [])
        periods = payroll_records.get("periods", [])
        lines = ["### 🏦 Corporate Payroll & Statutory Summary"]
        lines.append(f"- **Managed Companies ({len(companies)})**:")
        for c in companies:
            c_periods = [p for p in periods if p.get("companyId") == c.get("id")]
            lines.append(
                f"  - **{c.get('name')}** (`{c.get('code')}`) | Reg No: `{c.get('registrationNo') or '-'}` | "
                f"**EPF Reg No**: `{c.get('epfRegNo') or 'Not set'}` | **ETF Reg No**: `{c.get('etfRegNo') or 'Not set'}` | "
                f"Bank: {c.get('bankName')} ({c.get('bankBranch')}) A/C `{c.get('debitAccountNo')}` | Periods: {len(c_periods)}"
            )
        matched_emps = []
        for p in periods:
            ep = enrich_payroll_fn(p) if enrich_payroll_fn else p
            comp_name = next((c.get("name") for c in companies if c.get("id") == p.get("companyId")), p.get("companyId"))
            for e in ep.get("employees", []):
                e_name = (e.get("name") or "").lower()
                e_short = (e.get("shortName") or "").lower()
                if any(tok in lower for tok in [w for w in e_short.split() if len(w) >= 4]) or (e_name and e_name in lower):
                    matched_emps.append((comp_name, ep.get("month"), e))

        if matched_emps:
            lines.append("\n#### 👤 Matching Payroll Employee Records:")
            for comp_name, month_str, e in matched_emps[:8]:
                basic_lkr = e.get('lkrGross', 0)
                earned_lkr = e.get('totalGrossLkr', basic_lkr)
                lines.append(
                    f"- **{e.get('name')}** ({e.get('position')}) — *{comp_name} ({month_str})*\n"
                    f"  - Basic LKR: `Rs {basic_lkr:,.2f}` | Earned Salary: `Rs {earned_lkr:,.2f}` | EPF 8%: `Rs {e.get('epf8Lkr', 0):,.2f}` | EPF 12%: `Rs {e.get('epf12Lkr', 0):,.2f}` | ETF 3%: `Rs {e.get('etf3Lkr', 0):,.2f}` | APIT: `Rs {e.get('apit', 0):,.2f}` | **Net Salary**: `Rs {e.get('netSalaryLkr', 0):,.2f}`"
                )
        else:
            lines.append("\n#### 📅 Payroll Cycles:")
            for p in periods[:6]:
                ep = enrich_payroll_fn(p) if enrich_payroll_fn else p
                tots = ep.get("totals", {})
                comp_name = next((c.get("name") for c in companies if c.get("id") == p.get("companyId")), p.get("companyId"))
                lines.append(
                    f"- **{ep.get('month')}** — *{comp_name}* [`{ep.get('status')}`]: "
                    f"`{len(ep.get('employees', []))}` Staff | Basic: `Rs {tots.get('sumLkrGross', 0):,.2f}` | Earned: `Rs {tots.get('sumTotalGrossLkr', tots.get('sumLkrGross', 0)):,.2f}` | "
                    f"**Net Remittance**: `Rs {tots.get('sumNetSalaryLkr', 0):,.2f}` | "
                    f"EPF (20%): `Rs {(tots.get('sumEpf8Lkr', 0) + tots.get('sumEpf12Lkr', 0)):,.2f}` | ETF (3%): `Rs {tots.get('sumEtf3Lkr', 0):,.2f}`"
                )
        sections.append("\n".join(lines))
        nav_actions.append({"label": "Open Corporate Payroll", "view": "payroll"})

    # C. SPECIFIC ENTITY / KEYWORD SEARCH ACROSS CUSTOMER FILES, FINANCIAL FILES, AND TASKS
    stop_q = {
        'what', 'where', 'when', 'who', 'how', 'many', 'show', 'tell', 'me', 'about', 'find', 'search',
        'the', 'for', 'in', 'of', 'and', 'is', 'are', 'all', 'list', 'give', 'details', 'information',
        'file', 'files', 'company', 'companies', 'record', 'records', 'status', 'number', 'tin', 'ird',
        'pin', 'ssid', 'cupboard', 'box', 'customer', 'financial', 'spillburg', 'portal', 'can', 'you',
        'tasks', 'task', 'tracker', 'operations', 'staff', 'ravi', 'hemanthi', 'insaaf', 'insaff',
        'bilal', 'zaharan', 'shameel', 'shaameel', 'miss', 'mrs', 'today', 'works', 'work', 'will'
    }
    search_terms = [w for w in re.findall(r'[a-z_0-9]{3,}', lower) if w not in stop_q and not w.startswith('staff_')]

    is_pure_user_task_lookup = bool(asks_ops and mentioned_user and not asks_fin and not asks_cust)
    if search_terms and not is_pure_user_task_lookup:
        if access["modules"]["financial_files"]["view"]:
            fin_matches = []
            for r in financial_records:
                blob = f"{r.get('entityName', '')} {r.get('tinNo', '')} {r.get('regNo', '')} {r.get('directorName', '')} {r.get('ssid', '')} {r.get('irdEmail', '')} {r.get('notes', '')}".lower()
                hits = sum(1 for term in search_terms if term in blob)
                if hits > 0:
                    fin_matches.append((hits, r))
            fin_matches.sort(key=lambda x: x[0], reverse=True)
            if fin_matches:
                lines = [f"### 📊 Financial & Tax Register Matches ({len(fin_matches)} found)"]
                for _, r in fin_matches[:6]:
                    lines.append(
                        f"- **{r.get('entityName')}** ({r.get('category', 'Corporate')})\n"
                        f"  - **TIN No**: `{r.get('tinNo') or 'N/A'}` | **IRD PIN**: `{r.get('irdPin') or 'N/A'}` | **SSID**: `{r.get('ssid') or 'N/A'}` | **Incorp**: `{r.get('dateOfIncorp') or 'N/A'}`\n"
                        f"  - **Director**: {r.get('directorName') or 'N/A'} (`{r.get('directorPassportOrId') or '-'}`) | **Contact**: {r.get('phones') or '-'} / {r.get('emails') or '-'}\n"
                        f"  - **Filing Status**: {r.get('filingStatus') or 'Pending'}"
                    )
                sections.append("\n".join(lines))
                nav_actions.append({
                    "label": f"View '{fin_matches[0][1].get('entityName', '')[:22]}' in Financial DB",
                    "view": "financial-files",
                    "search": fin_matches[0][1].get("entityName", "")
                })

        if access["modules"]["customer_files"]["view"]:
            cust_matches = []
            for r in customer_records:
                blob = f"{r.get('Company Name', '')} {r.get('Registration No', '')} {r.get('Cupboard', '')} {r.get('Box No', '')} {r.get('Type', '')}".lower()
                hits = sum(1 for term in search_terms if term in blob)
                if hits > 0:
                    cust_matches.append((hits, r))
            cust_matches.sort(key=lambda x: x[0], reverse=True)
            if cust_matches:
                lines = [f"### 🗂️ Customer File Archive Matches ({len(cust_matches)} found)"]
                for _, r in cust_matches[:8]:
                    lines.append(
                        f"- **#{r.get('No')} {r.get('Company Name')}** — Reg No: `{r.get('Registration No') or 'N/A'}` | "
                        f"**Location**: `{r.get('Cupboard')}` &rarr; `{r.get('Box No')}` | "
                        f"Type: `{r.get('Type')}` | Incorporated: `{r.get('Date of Incorporation') or 'N/A'}`"
                    )
                sections.append("\n".join(lines))
                nav_actions.append({
                    "label": f"Locate '{cust_matches[0][1].get('Company Name', '')[:22]}' in Customer DB",
                    "view": "customer-files",
                    "search": cust_matches[0][1].get("Company Name", "")
                })

        if access["modules"]["operations"]["view"] and not asks_ops and not mentioned_user:
            scoped_ops = operations if is_exec else [t for t in operations if t.get("userId") == user.get("id")]
            ops_matches = []
            for t in scoped_ops:
                blob = f"{t.get('title', '')} {t.get('notes', '')} {t.get('workstream', '')} {t.get('assignedTo', '')}".lower()
                hits = sum(1 for term in search_terms if term in blob)
                if hits > 0:
                    ops_matches.append((hits, t))
            ops_matches.sort(key=lambda x: x[0], reverse=True)
            if ops_matches:
                lines = [f"### ✅ Related Operations Tasks ({len(ops_matches)} found)"]
                for _, t in ops_matches[:8]:
                    lines.append(
                        f"- **#{t.get('no')} {t.get('title')}** (Assigned to: **{t.get('assignedTo')}**) — `{t.get('status')}` | Tasked: `{t.get('taskedDate')}`\n"
                        f"  *Notes*: {t.get('notes') or '-'}"
                    )
                sections.append("\n".join(lines))
                nav_actions.append({"label": "Open Operations Tracker", "view": "operations"})

    # D. GENERAL MODULE SUMMARIES
    if asks_cust and access["modules"]["customer_files"]["view"] and not any("Customer File Archive" in s for s in sections):
        orig = sum(1 for r in customer_records if "original" in str(r.get("Type", "")).lower())
        copy_cnt = sum(1 for r in customer_records if "copy" in str(r.get("Type", "")).lower())
        cupboards = {}
        for r in customer_records:
            c = r.get("Cupboard", "Unassigned")
            cupboards[c] = cupboards.get(c, 0) + 1
        cup_str = ", ".join(f"**{k}**: {v} files" for k, v in sorted(cupboards.items()))
        sections.append(
            f"### 🗂️ Customer File Database Overview\n"
            f"- **Total Archived Files**: `{len(customer_records)}` (`{orig}` Originals, `{copy_cnt}` Copies)\n"
            f"- **Cupboard Breakdown**: {cup_str}\n"
            f"- *Tip*: Ask me for any company name or PV number (e.g., `Where is 113 East SL?`) or say `Move 113 East SL to Cupboard 2 Box 5` to update its location!"
        )
        nav_actions.append({"label": "Open Customer Files DB", "view": "customer-files"})

    if asks_fin and access["modules"]["financial_files"]["view"] and not any("Financial & Tax Register" in s for s in sections):
        sections.append(
            f"### 📊 Financial Files & Tax Register Overview\n"
            f"- **Total Registered Entities**: `{len(financial_records)}` digitized corporate & individual tax files\n"
            f"- Contains **TIN Numbers**, **IRD RAMIS PINs**, **SSIDs**, **Director Passports/NICs**, and **2024/2025 Filing Checklists**.\n"
            f"- *Tip*: Ask me for any entity's TIN or IRD details (e.g., `What is the TIN and IRD PIN for Remi Dream Lanka?`) or say `Update financial file for Zhong Hui Lanka filing status to Completed`."
        )
        nav_actions.append({"label": "Open Financial Files DB", "view": "financial-files"})

    if asks_users:
        if access["modules"]["user_management"]["view"]:
            u_lines = [f"### 👥 Portal User Accounts & Access Matrix ({len(users)} users)"]
            for u in users:
                p = u.get("permissions") or {}
                ai_st = "Allowed" if can_user_access_spillburg_ai(u) else "Disallowed"
                u_lines.append(
                    f"- **{u.get('fullName')}** (`@{u.get('username')}`) — Role: `{u.get('role', 'staff').upper()}` ({u.get('title', 'Staff')})\n"
                    f"  - Ops: `{p.get('operations', 'none')}` | Cust DB: `{p.get('customer_files', 'none')}` | Fin DB: `{p.get('financial_files', 'none')}` | Payroll: `{p.get('payroll', 'none')}` | SpillburgAI: `{ai_st}`"
                )
            sections.append("\n".join(u_lines))
            nav_actions.append({"label": "Open Access Control", "view": "access-control"})
        else:
            m = access["modules"]
            sections.append(
                f"### 🛡️ Your Active Access Profile ({user.get('fullName')})\n"
                f"- **Role**: `{role.upper()}` ({user.get('title')})\n"
                f"- **Operations Tracker**: `{m['operations']['level']}` ({'All Team Tasks' if m['operations']['scope'] == 'all_team' else 'Personal Tasks Only'})\n"
                f"- **Customer Files DB**: `{m['customer_files']['level']}`\n"
                f"- **Financial Files DB**: `{m['financial_files']['level']}`\n"
                f"- **Corporate Payroll**: `{m['payroll']['level']}`\n"
                f"- **SpillburgAI Assistant**: `Allowed`"
            )

    if not sections:
        m = access["modules"]
        allowed_list = []
        if m["operations"]["view"]:
            allowed_list.append(f"**Operations Tracker** ({'All Team Tasks' if is_exec else 'Your Personal Tasks'})")
        if m["customer_files"]["view"]:
            allowed_list.append(f"**Customer File DB** ({len(customer_records)} files)")
        if m["financial_files"]["view"]:
            allowed_list.append(f"**Financial & Tax Register** ({len(financial_records)} entities)")
        if m["payroll"]["view"]:
            allowed_list.append(f"**Corporate Payroll & EPF/ETF** ({len(payroll_records.get('companies', []))} companies)")

        sections.append(
            f"### 🤖 SpillburgAI — Corporate Intelligence & Task Automation\n"
            f"Hello **{user.get('fullName')}**! I am connected to Spillburg Holdings' live databases, scoped to your **{role.upper()}** permissions ({', '.join(allowed_list)}).\n\n"
            f"**What you can do right here:**\n"
            f"1. **Paste Daily Work Logs + Auto-Detect Follow-Ups**: Paste any team member's WhatsApp report (e.g., *Ravi's 28/10/2026 ROC & Bank log* or *Hemanthi's daily work plan*) and I will extract each task, match existing open tasks, generate follow-up reminders, and let you **Approve & Apply** them.\n"
            f"2. **9:00 AM Morning Call Briefing**: Click **Morning Call Briefing** to get a full standup summary of yesterday's completed tasks per staff member and today's active follow-ups.\n"
            f"3. **Cross-Module Register Updates**: Say *\"Move 113 East SL to Cupboard 2 Box 5\"* or *\"Update financial file for Zhong Hui Lanka filing status to Completed\"*.\n"
            f"4. **Ask Questions Across Permitted Databases**:\n"
            f"   - *\"Show Ravi's tasks\"*, *\"Show Insaaf's tasks\"*, *\"Show Hemanthi's tasks\"*, or *\"Show Bilal's tasks\"*\n"
            f"   - *\"Where is the file for 113 East SL?\"* (Customer File DB)\n"
            + (f"   - *\"What is the TIN and IRD PIN for Remi Dream Lanka?\"* (Financial DB)\n" if m["financial_files"]["view"] else "")
            + (f"   - *\"Show the payroll summary and EPF/ETF registration numbers for all companies\"* (Payroll DB)\n" if m["payroll"]["view"] else "")
        )

    base_reply = "\n\n---\n\n".join(sections)
    gemini_reply = call_gemini_enhancement(user, message, history, base_reply, access, attachments=attachments)
    final_reply = gemini_reply if gemini_reply else base_reply

    return {
        "reply": final_reply,
        "intent": "knowledge_response",
        "navActions": nav_actions[:5],
        "accessSummary": access
    }


def process_spillburg_ai_message(user, message, history, users, operations, customer_records, financial_records, payroll_records, enrich_payroll_fn=None, attachments=None):
    """
    Main entry point for POST /api/ai/chat.
    1. Checks SpillburgAI access permission.
    2. Checks if the user requested a Cross-Module update (Customer Files / Financial Register).
    3. Checks if the user pasted a task report or requested task creation/editing -> returns structured task proposal for approval.
    4. Otherwise queries the permission-scoped knowledge base (with Morning Call Briefing & optional Gemini 2.5 Flash enhancement).
    """
    if not can_user_access_spillburg_ai(user):
        return {
            "success": False,
            "error": "Access Denied: SpillburgAI access has been disabled for your account by an Administrator.",
            "restricted": True
        }, 403

    # 1. Check for Cross-Module Update Proposal (Customer File DB or Financial Register)
    cross_prop = parse_ai_cross_module_intent(user, message, customer_records, financial_records)
    if cross_prop:
        return {
            "success": True,
            **cross_prop
        }, 200

    # 2. Check if message is a task log / task creation / task edit request
    task_proposal = parse_ai_task_intent(user, message, users, operations)
    if task_proposal:
        if not can_user_edit_module(user, "operations"):
            return {
                "success": True,
                "reply": (
                    "🔒 **Operations Edit Permission Required**\n\n"
                    "I detected task updates in your message, but your account currently has **Read-Only (`viewer`)** or **No Access** permission for the Operations Tracker. "
                    "Please ask an Administrator or Director to grant you `editor` access for Operations to create or update tasks."
                ),
                "intent": "restricted",
                "restrictedModule": "operations"
            }, 200

        return {
            "success": True,
            **task_proposal
        }, 200

    # 3. Answer general / database query or Morning Call Briefing with strict permission filtering
    kb_res = answer_knowledge_query(
        user=user,
        message=message,
        users=users,
        operations=operations,
        customer_records=customer_records,
        financial_records=financial_records,
        payroll_records=payroll_records,
        enrich_payroll_fn=enrich_payroll_fn,
        history=history,
        attachments=attachments
    )
    return {
        "success": True,
        **kb_res
    }, 200


# Curated baseline of Muhammad Zaharan's real task Title -> Notes examples across workstreams
ZAHARAN_STYLE_EXAMPLES = [
    ("Corporate Website Audit Report", "Operational Task", "Compare with reference websites and prepare a report with shortcomings and suggestions"),
    ("Destination Consultancy Website Review", "Operational Task", "Review the new website and find out shortcomings and suggestions"),
    ("Sri Lanka France Business Council Website Report", "Digital Marketing", "Review the website and find out shortcomings and suggestions"),
    ("Investor Presentation Redesign & Updates", "Designing & Editing", "Complete visual overhaul & financial metrics deck redesign"),
    ("Sri Lanka Export Products Portfolio", "Designing & Editing", "Design and develop a presentation deck for Sri Lanka export products"),
    ("France Council Presentation", "Designing & Editing", "Preparation of bilateral trade council presentation deck"),
    ("Proposal Infographic for Attanagala", "Designing & Editing", "Design an infographic for brochure for Attanagala project"),
    ("Company Profile For Corporate Services", "Digital Marketing", "Create a company profile for Spillburg Corporate Services"),
    ("Company Profile For Spillburg Logistics 1", "Designing & Editing", "Create a unique Company Profile for Spillburg Logistics 1"),
    ("Design business card for Maneesha Kannangara - destination", "Designing & Editing", "Design business card for Maneesha Kannangara - Destination Consultancy"),
    ("Updated Chamber Events Slideshow", "Designing & Editing", "Create a slideshow video for Spillburg Holdings, based on Mr. Shameel and Mr. Hameez LinkedIn Profiles"),
    ("Ad Video based on Instagram Ad", "Digital Marketing", "Create an Ad video based on Overseas Company Ad Video on Instagram\nLocalization - French and German\nAdd QR Code, mail, and contact numbers"),
    ("LinkedIn and Facebook Page for SLJapanBC", "Digital Marketing", "Create a LinkedIn and FB page for Sri Lanka Japan Business Council, Info Needed"),
    ("Facebook and LinkedIn Page for Spillburg Corporate Services", "Digital Marketing", "Create a Facebook and LinkedIn Page for Spillburg Corporate Services and send link to spytLabs"),
    ("Website for SLFBC", "Designing & Editing", "Coordinate with Anisa and create a website for SLFBC\nNotes - SL FR - Localization, check reference council websites"),
    ("Transfer of All Domains & Hosting", "Operational Task", "Transfer all domains and hostings from Firzan to company email.\nUpdate - all except vacations hosting transferred"),
    ("Corporate Services Website Deployment", "Operational Task", "Purchase a domain and deploy corporate services website"),
    ("Destination Consultancy Website Deployment", "Operational Task", "Get access for destination domain nameserver and transfer website"),
    ("Renew Spillburg Vacation Domain", "Procurement", "Renew Spillburg Vacation Domain from onlydomains.com"),
    ("Purchase Hosting for Domain Sites", "Office Operations", "Find suitable hosting providers and purchase hosting for domain sites"),
    ("Create new 3 emails for Zaharan, Bilal, Insaaf", "Office Operations", "Coordinate with Haritha to create new 3 emails, bilal@spillburg.com, insaaf@spillburg.com, zaharan@spillburg.com"),
    ("MSI Monitor Stand", "Procurement", "Quote and purchase a monitor stand for MSI Monitor"),
    ("Purchase Work Laptop for Director", "Procurement", "Quote and purchase a work laptop for director"),
    ("Quote Canon Pixma G3010 Printer for Director", "Procurement", "Quote and purchase a Canon printer for director"),
    ("Canon PG-47 Black Cartridge for Canon E470 Printer", "Procurement", "Purchase or refill Canon PG-47 Black Cartridge for Canon E470 Printer"),
    ("HP HS04 Laptop Battery Replacement", "Procurement", "Replacement battery unit for HP laptop (HS04 4-cell)"),
    ("WiFi adapter", "Procurement", "High-gain dual-band USB WiFi network adapter (Quote pending)"),
    ("Top Legal & Secretarial Services Firms in Sri Lanka", "R&D", "Research and create a list of top 50 firms in legal and secretarial"),
    ("Research for Diploma Course in Arbitration", "R&D", "Research for Diploma Course in Arbitration in BASL, ICLP, details, accreditation comparison"),
    ("Sri Lanka To Singapore Exporter Master Directory", "R&D", "On the EDB database check companies dealing with Singapore market and compile details"),
    ("Investor-Business Chamber Contact Details Sheet in Middle East Countries", "Office Operations", "Create a sheet on Business Chambers and Investors to visit by delegation who will setup on Port City. Saudi, Qatar, Kuwait, Oman, Bahrain"),
    ("Potential Fashion Industry & Event Sponsors Directory", "Operational Task", "Compile categorized directory of fashion industry & event sponsors with contact details, partnership roles, and status tracking"),
    ("Director & Corporate Leadership Programme Application", "Office Operations", "Apply for Director & Corporate Leadership Programme with CA\nNotes - Registered, payment to be made"),
    ("Workshop on Recent Changes to Taxation on 23rd October 2026 Application", "Office Operations", "Apply to Workshop on Recent Changes to Taxation and send a Google Calendar invite"),
    ("Request course materials, session recording, certification and future programmes from CSM Business Solutions", "Office Operations", "Contact CSM Business Solutions via email to request complete course materials, session recording, and final certificate for Mr. Shaameel. Additionally, request their upcoming programmes."),
    ("Prepare Staff Appraisal File", "Office Operations", "Prepare Staff Appraisal File based on staff performance"),
    ("Company Laptops Audit & Review", "Office Operations", "Review and audit 3 company laptops and prepare to send off-company"),
    ("Attanagala Waste Management Report", "Designing & Editing", "Create a report on Attanagala Waste Management based on images and raw data"),
]


def infer_zaharan_workstream(title, current_workstream=""):
    """Suggests the best workstream matching Zaharan's tracker conventions."""
    t_low = (title or "").lower()
    if any(w in t_low for w in ["quote", "purchase", "buy", "procure", "cartridge", "refill", "battery", "adapter", "stand", "cable", "hose", "printer", "monitor", "renew domain"]):
        return "Procurement"
    if any(w in t_low for w in ["design", "logo", "infographic", "brochure", "business card", "visiting card", "presentation", "slideshow", "deck", "company profile", "personal profile", "redesign", "banner"]):
        return "Designing & Editing"
    if any(w in t_low for w in ["facebook", "linkedin", "instagram", "social", "post", "ad video", "seo", "campaign", "vacancy in linkedin", "marketing"]):
        return "Digital Marketing"
    if any(w in t_low for w in ["research", "study", "find options", "top 50", "top legal", "diploma", "course in", "gazette", "beneficial ownership", "beneficary ownership", "edb database"]):
        return "R&D"
    return current_workstream or "Office Operations"


def _find_similar_zaharan_tasks(title, operations=None, limit=6):
    """Finds the closest historical tasks written by Zaharan based on word overlap."""
    t_words = set(re.findall(r"[a-z0-9]{3,}", (title or "").lower())) - {"the", "and", "for", "with", "from", "into", "new"}
    pool = []
    seen_titles = set()

    if operations:
        for op in operations:
            if (op.get("ownerUsername") or "").lower() == "zaharan":
                op_t = (op.get("title") or "").strip()
                op_n = (op.get("notes") or "").strip()
                op_ws = (op.get("workstream") or "").strip()
                if not op_t or not op_n:
                    continue
                # Skip old robotic AI fallback sentences so they don't pollute Zaharan's style
                if any(bad in op_n.lower() for bad in ["execute deliverables for", "verify public responsiveness", "report completion status to management", "hand over vendor bill/receipt"]):
                    continue
                if op_t.lower() not in seen_titles:
                    seen_titles.add(op_t.lower())
                    pool.append((op_t, op_ws, op_n))

    for ex_t, ex_ws, ex_n in ZAHARAN_STYLE_EXAMPLES:
        if ex_t.lower() not in seen_titles:
            seen_titles.add(ex_t.lower())
            pool.append((ex_t, ex_ws, ex_n))

    scored = []
    for item_t, item_ws, item_n in pool:
        item_words = set(re.findall(r"[a-z0-9]{3,}", (item_t + " " + item_n).lower()))
        overlap = len(t_words & item_words)
        scored.append((overlap, item_t, item_ws, item_n))

    scored.sort(key=lambda x: x[0], reverse=True)
    selected = [x[1:] for x in scored[:limit] if x[0] > 0]
    if len(selected) < limit:
        for _, item_t, item_ws, item_n in scored:
            if (item_t, item_ws, item_n) not in selected:
                selected.append((item_t, item_ws, item_n))
            if len(selected) >= limit:
                break
    return selected


def _lookup_entity_context_for_notes(title, existing_notes="", customer_records=None, financial_records=None):
    """Finds any matching company/client in Customer DB or Financial DB mentioned in the title."""
    combined = f"{title or ''} {existing_notes or ''}".lower()
    tokens = [w for w in re.findall(r"[a-z0-9]{3,}", combined) if w not in {
        "the", "and", "for", "with", "from", "new", "create", "update", "review", "website", "report",
        "company", "profile", "corporate", "services", "sri", "lanka", "pvt", "ltd", "private", "limited",
        "business", "council", "design", "purchase", "quote", "follow", "check", "file", "files", "portal",
        "spillburg", "holdings", "vacation", "logistics", "office", "task", "bank", "tax", "roc", "ird"
    }]
    if not tokens:
        return ""

    hints = []
    if customer_records:
        for c in customer_records:
            cname = (c.get("companyName") or "").strip()
            if not cname:
                continue
            cname_low = cname.lower()
            if any(tok in cname_low for tok in tokens if len(tok) >= 4):
                reg = c.get("registrationNo") or ""
                loc = f"{c.get('cupboardNo') or ''} / {c.get('boxNo') or ''}".strip(" /")
                hints.append(f"Customer DB Match: {cname} (Reg: {reg}, Archive: {loc})")
                break

    if financial_records:
        for f in financial_records:
            ename = (f.get("entityName") or "").strip()
            if not ename:
                continue
            ename_low = ename.lower()
            if any(tok in ename_low for tok in tokens if len(tok) >= 4):
                tin = f.get("tinNo") or ""
                status = f.get("filingStatus") or ""
                hints.append(f"Financial DB Match: {ename} (TIN: {tin}, Status: {status})")
                break

    return " | ".join(hints)


def _synthesize_zaharan_style_note(clean_title, workstream="", requestedBy="", existing_notes="", mode="auto"):
    """
    Deterministic Zaharan-style note generator modeled directly on Muhammad Zaharan's 75+ real tasks.
    Produces crisp, natural, practical 1-line notes (and optional Update - / Notes - lines) without robotic filler.
    """
    t = clean_title.strip()
    t_low = t.lower()
    req = (requestedBy or "").strip()
    draft = (existing_notes or "").strip()

    # If mode is 'append' and there are existing notes, append an 'Update - ' line in Zaharan's exact format
    if mode == "append" and draft:
        if "update -" not in draft.lower() and "notes -" not in draft.lower():
            return f"{draft}\nUpdate - In progress, pending final review and completion"
        return f"{draft}\nUpdate - Followed up and updated status"

    # If the user already typed rough shorthand notes (that aren't just a copy of the title or old AI boilerplate),
    # polish and incorporate their draft notes in Zaharan's style
    is_boilerplate = any(b in draft.lower() for b in [
        "execute deliverables for", "verify public responsiveness", "report completion status to management",
        "hand over vendor bill/receipt", "coordinate with relevant team members, and document final completion"
    ])
    if draft and not is_boilerplate and draft.lower() != t_low and mode != "replace":
        # Clean up shorthand into Zaharan's format (Main line + Notes - / Update - if multi-part)
        lines = [ln.strip() for ln in draft.splitlines() if ln.strip()]
        if len(lines) == 1 and len(draft) < 90:
            # Combine title intent + user's specific detail naturally
            first_char = draft[0].upper() + draft[1:] if draft else ""
            if any(draft.lower().startswith(v) for v in ["create", "review", "quote", "purchase", "design", "research", "coordinate", "cordinate", "contact", "apply", "prepare", "setup", "get ", "check ", "compare ", "transfer ", "renew ", "update "]):
                return first_char
            base = _synthesize_zaharan_style_note(clean_title, workstream=workstream, requestedBy=requestedBy, existing_notes="", mode="replace")
            return f"{base}\nNotes - {first_char}"

    # 1. Website / Company Profile / Portfolio Audit or Review
    if any(w in t_low for w in ["website report", "website review", "website audit", "audit report", "profile review"]):
        if "compare" in t_low or "audit" in t_low:
            return f"Compare {t.replace('Report', '').replace('Audit', '').strip()} with reference websites and prepare a report with shortcomings and suggestions"
        if "personal profile" in t_low or "profile review" in t_low:
            subject = re.sub(r"(?i)\s*review\s*&?\s*update\s*", "", t).strip()
            return f"Review & update {subject} with the details provided"
        return "Review the website and find out shortcomings and suggestions"

    # 2. Website Deployment / Domain / Hosting / Email Setup or Transfer
    if any(w in t_low for w in ["domain", "hosting", "nameserver", "website deployment", "mail domain", "emails for", "create new", "email setup"]):
        if "renew" in t_low:
            return f"{t} and verify DNS/hosting renewal status"
        if "transfer" in t_low and "domain" in t_low:
            return f"Get access for domain nameserver and transfer {t.replace('Transfer', '').strip()}"
        if "deployment" in t_low:
            return f"Configure domain/hosting and deploy {t.replace('Deployment', '').strip()}"
        if "hosting" in t_low and ("purchase" in t_low or "buy" in t_low):
            return "Find suitable hosting providers and purchase hosting for domain sites"
        if "email" in t_low or "mail" in t_low:
            return f"Coordinate and set up email accounts / domain access for {t}"

    # 3. Website Creation / Development
    if "website" in t_low and not any(w in t_low for w in ["report", "review", "audit", "deployment"]):
        if "update" in t_low or "news" in t_low or "content" in t_low:
            return "Corporate website content updates, SEO & landing pages"
        if "eroc" in t_low:
            return "Electronic Registrar of Companies (eROC) filing & submission study"
        target = re.sub(r"(?i)^(create\s+a?\s*)?website\s+(for\s+)?", "", t).strip()
        if target and target.lower() != t_low:
            return f"Design and develop the website for {target}"
        return f"Design and develop website for {t.replace('Website', '').strip()}"

    # 4. Social Media Pages, Banners, Posts, Ads, Vacancies
    if any(w in t_low for w in ["facebook", "linkedin", "instagram", "socials", "social media", "anniversary post", "featured post", "welcome post", "ad video", "vacancy"]):
        if "vacancy" in t_low or "hiring" in t_low:
            clean_vac = re.sub(r"(?i)^(post|publish|create)\s+", "", t).strip()
            return f"Prepare job post creative and publish {clean_vac}"
        if "banner" in t_low:
            if "qr" in t_low:
                return f"{t} with brand styling and contact details"
            return f"Design social media banner creative for {t.replace('Design', '').strip()}"
        if "ad video" in t_low or "video" in t_low:
            return f"Create {t} with localization, QR code, email, and contact numbers"
        if "post" in t_low:
            clean_post = re.sub(r"(?i)^(create|design|publish|post)\s+(an?\s+)?", "", t).strip()
            return f"Create and publish {clean_post}"
        if "page" in t_low:
            target = re.sub(r"(?i)^(create\s+a?\s*)?(linkedin\s+and\s+facebook|facebook\s+and\s+linkedin)\s+page\s+for\s+", "", t).strip()
            return f"Create a Facebook and LinkedIn page for {target} and update brand details"
        if "profile" in t_low or "portfolio" in t_low:
            return "Corporate profile management, content updates & outreach"

    # 5. Company Profile / Strategic Business Plan / Proposal / Brochure / Presentation Deck / Slideshow
    if any(w in t_low for w in ["company profile", "business plan", "strategic", "presentation", "portfolio", "infographic", "brochure", "slideshow", "logo", "business card", "visiting card"]):
        if "business plan" in t_low or "strategic" in t_low:
            return f"Prepare and structure the {t} with market research, financial projections, and growth roadmap"
        if "company profile" in t_low:
            if "review" in t_low:
                return "Review the company profile and find out shortcomings and suggestions"
            target = re.sub(r"(?i)^(create\s+a?\s*)?(unique\s+)?company\s+profile\s+(for\s+)?", "", t).strip()
            return f"Create a Company Profile for {target or t}"
        if "presentation" in t_low or "portfolio" in t_low:
            if "redesign" in t_low or "update" in t_low:
                return f"Complete visual overhaul & deck redesign for {t.replace('Redesign', '').replace('& Updates', '').strip()}"
            return f"Design and develop a presentation deck for {t.replace('Presentation', '').strip()}"
        if "infographic" in t_low or "brochure" in t_low:
            return f"Design an infographic / brochure layout for {t.replace('Proposal Infographic for', '').strip()}"
        if "slideshow" in t_low:
            return f"Create a slideshow video for {t.replace('Updated', '').replace('Slideshow', '').strip()}"
        if "logo" in t_low:
            target = re.sub(r"(?i)^create\s+logos?\s+for\s+", "", t).strip()
            return f"Create logo for {target or t}"
        if "business card" in t_low or "visiting card" in t_low:
            target = re.sub(r"(?i)^design\s+(business|visiting)\s+cards?\s+for\s+", "", t).strip()
            return f"Design business card for {target or t}"

    # 6. Procurement / Cartridges / Hardware / Laptops / Printers / Accessories
    if any(w in t_low for w in ["quote", "purchase", "buy", "cartridge", "printer", "laptop", "battery", "keyboard", "monitor", "stand", "adapter", "hose", "cable"]) or (workstream or "").lower() == "procurement":
        if "audit" in t_low or "review" in t_low:
            return f"Review and audit {t.replace('Audit & Review', '').strip()} and prepare status summary"
        if "cartridge" in t_low or "ink" in t_low or "toner" in t_low:
            clean_cart = re.sub(r"(?i)^(quote\s+and\s+purchase|quote|purchase|refill|buy)\s+", "", t).strip()
            return f"Purchase or refill {clean_cart}"
        if t_low.startswith("quote ") or t_low.startswith("purchase "):
            item = re.sub(r"(?i)^(quote\s+and\s+purchase|quote|purchase)\s+", "", t).strip()
            return f"Quote and purchase {item}"
        if "replacement" in t_low or "battery" in t_low or "keyboard" in t_low:
            return f"Quote and purchase replacement {t.replace('Replacement', '').strip()}"
        return f"Quote and purchase {t}"

    # 7. Research / Directories / Master Sheets / Lists / Courses / Gazette
    if any(w in t_low for w in ["research", "directory", "sheet", "master", "top ", "firms", "diploma", "arbitration", "beneficial ownership", "beneficary ownership", "options", "exporter"]) or (workstream or "").lower() == "r&d":
        if "directory" in t_low or "sheet" in t_low or "exporter" in t_low:
            return f"Research and compile structured contact & details sheet for {t}"
        if "diploma" in t_low or "course" in t_low and "request" not in t_low:
            return f"Research {t.replace('Research for', '').strip()}, course details, fees & accreditation comparison"
        if "options" in t_low:
            return f"Find options and pricing for {t.replace('Options', '').strip()}"
        if "top " in t_low or "firms" in t_low:
            return f"Research and create a list of {t}"
        if t_low.startswith("research"):
            return f"{t} and compile key findings & comparison"
        return f"Research on {t} and prepare summary notes"

    # 8. Course Materials / Workshop Applications / Calendar Invites / Emails
    if any(w in t_low for w in ["request ", "workshop", "programme", "application", "calendar", "appraisal", "indemnity"]):
        if t_low.startswith("request "):
            return f"Send email / follow up to {t[0].lower() + t[1:]}"
        if "workshop" in t_low or "application" in t_low or "programme" in t_low:
            clean_prog = re.sub(r"(?i)\s*application$", "", t).strip()
            return f"Register and apply for {clean_prog} and send Google Calendar invite"
        if "calendar" in t_low:
            return f"{t} to schedule events and appointments"
        if "appraisal" in t_low:
            return f"{t} based on staff performance"
        if "indemnity" in t_low:
            return "Prepare and fill the indemnity form documents for clients"

    # 9. Portal / Database / System Integration
    if any(w in t_low for w in ["portal", "database", "db", "payroll system", "tracker", "spillburgai", "ai integration", "integrate", "intergrate"]):
        if t_low.startswith(("add ", "create ", "integrate ", "intergrate ", "update ")):
            return f"{t} and verify functionality across the portal"
        return f"Develop and integrate {t} in the Spillburg Company Portal"

    # 10. ROC / IRD / EPF / ETF / Bank / Statutory (when logging general office/staff tasks)
    if any(w in t_low for w in ["roc", "form 1", "form 13", "form 15", "form 20", "level 2", "level 3", "incorporat"]):
        return f"Follow up with ROC on {t} and check approval status"
    if any(w in t_low for w in ["epf", "etf", "labour dept", "narahenpita"]):
        return f"Coordinate EPF/ETF compliance and documentation for {t}"
    if any(w in t_low for w in ["ird", "tin", "ramis", "tax"]):
        return f"Coordinate with IRD and update tax/TIN records for {t}"
    if any(w in t_low for w in ["bank", "cheque", "deposit", "ntb", "commercial bank", "chamber of commerce"]):
        return f"Coordinate banking / payment transaction for {t}"

    # Default Zaharan-style concise note (never uses 'Execute deliverables for...')
    if any(t_low.startswith(v) for v in ["create ", "design ", "prepare ", "review ", "update ", "post ", "setup ", "add ", "compile ", "check ", "follow up ", "contact "]):
        if req and req.lower() not in ["self", "management", "muhammad zaharan"] and req.lower() not in t_low:
            return f"{t} as requested by {req}"
        return f"{t} with the details provided"
    if "report" in t_low:
        return f"Prepare and compile {t} based on data provided"
    return f"Prepare and complete {t}" + (f" ({workstream})" if workstream and workstream not in ["Office Operations", "Operational Task"] else "")


def generate_task_action_notes(title, workstream="", requestedBy="", existingNotes="", mode="auto", user=None, operations=None, customer_records=None, financial_records=None):
    """
    Generates concise, natural task notes modeled directly on Muhammad Zaharan's real task writing style
    in the Spillburg Operations Tracker.
    - Learns from Zaharan's historical tasks (few-shot similarity matching).
    - Injects matched Customer DB / Financial DB context if a specific client is named.
    - Supports polishing draft shorthand ('auto'/'polish'), replacing ('replace'), or appending an 'Update - ' line ('append').
    - Returns a dict with {'notes': str, 'suggestedWorkstream': str} or plain str for backward compatibility.
    """
    clean_title = (title or "").strip()
    suggested_ws = infer_zaharan_workstream(clean_title, workstream)
    if not clean_title:
        return "Prepare and complete task with the details provided"

    draft = (existingNotes or "").strip()
    if mode == "append" and draft:
        # Use Gemini or deterministic rule to append an 'Update - ...' line in Zaharan's style
        pass

    similar_examples = _find_similar_zaharan_tasks(clean_title, operations=operations, limit=7)
    entity_hint = _lookup_entity_context_for_notes(clean_title, existing_notes=draft, customer_records=customer_records, financial_records=financial_records)

    api_key = get_gemini_api_key()
    if api_key:
        models_to_try = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash"]
        examples_block = "\n".join([f"- Title: \"{ex_t}\" [{ex_ws}] -> Notes: \"{ex_n}\"" for ex_t, ex_ws, ex_n in similar_examples])
        sys_prompt = (
            "You write task notes for Muhammad Zaharan in the Spillburg Holdings Operations Tracker.\n"
            "CRITICAL STYLE RULES — Match Muhammad Zaharan's exact personal writing style from his earlier tasks:\n"
            "1. Keep it SHORT, DIRECT, and NATURAL (typically 1 concise sentence, 7 to 20 words).\n"
            "2. Start directly with an action verb or clear noun phrase (e.g. 'Review the website and find out shortcomings and suggestions', 'Quote and purchase a...', 'Create a company profile for...', 'Design social media banner with QR code for...', 'Research and compile...').\n"
            "3. NEVER use stiff, robotic corporate AI phrases like 'Execute deliverables for...', 'Execute technical deliverables and content updates for...', 'verify public responsiveness, and report completion status to management', or 'document final completion in the operations tracker'.\n"
            "4. Do NOT repeat 'as requested by ...' or 'Notes - Requested by ...' since Requested By is already a separate column in the table.\n"
            "5. If the user already typed rough draft notes or extra details, keep every specific detail (names, countries, emails, dates, QR codes, languages) and format secondary remarks on a new line starting with 'Notes - ' or 'Update - ' just like Zaharan does.\n"
            "6. Output ONLY the raw note text—no quotes, no markdown bolding, no intro text.\n\n"
            f"EXAMPLES OF MUHAMMAD ZAHARAN'S REAL EARLIER TASKS:\n{examples_block}"
        )
        user_prompt_lines = [
            f"Task Title: {clean_title}",
            f"Workstream: {suggested_ws or workstream or 'Office Operations'}",
            f"Requested By: {requestedBy or 'Mr. Shameel'}",
        ]
        if entity_hint:
            user_prompt_lines.append(f"Matched Company Context (include Reg No/TIN/Archive only if relevant): {entity_hint}")
        if draft and mode != "replace":
            if mode == "append":
                user_prompt_lines.append(f"Existing Notes:\n{draft}\nInstruction: Keep the existing notes exactly as they are and append a new line starting with 'Update - ' summarizing the next step or progress.")
            else:
                user_prompt_lines.append(f"User's Rough Draft Notes to Polish/Expand in Zaharan's Style:\n{draft}")

        payload = {
            "systemInstruction": {"parts": [{"text": sys_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": "\n".join(user_prompt_lines)}]}],
            "generationConfig": {"temperature": 0.25, "maxOutputTokens": 800, "thinkingConfig": {"thinkingBudget": 0}}
        }
        encoded = json.dumps(payload).encode("utf-8")
        for m in models_to_try:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
                req = urllib.request.Request(url, data=encoded, headers={"Content-Type": "application/json"}, method="POST")
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    cand = data.get("candidates") or []
                    if cand:
                        text = cand[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                        if text:
                            text = re.sub(r'^["\']|["\']$', '', text).strip()
                            return text
            except Exception:
                continue

    # Built-in Zaharan-Style Synthesizer (works 100% offline or without API key)
    base_note = _synthesize_zaharan_style_note(
        clean_title,
        workstream=suggested_ws or workstream,
        requestedBy=requestedBy,
        existing_notes=draft,
        mode=mode
    )
    if entity_hint and entity_hint not in base_note and any(k in clean_title.lower() for k in ["file", "roc", "tin", "ird", "tax", "epf", "etf", "form "]):
        base_note = f"{base_note}\nNotes - {entity_hint}"
    return base_note
