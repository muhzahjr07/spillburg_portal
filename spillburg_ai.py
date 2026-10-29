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


def extract_standard_date(text):
    """
    Extracts a date from free-form text (e.g., '28/10/2026', '28-10-2026', '28 Oct 2026', 'yesterday')
    and returns it in DD-MMM-YYYY format (e.g., '28-Oct-2026').
    """
    if not text:
        return datetime.date.today().strftime("%d-%b-%Y")

    # 1. Explicit DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    m = re.search(r'\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b', text)
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
    """Builds a list of (alias_lower, user_dict) for resolving user mentions like 'Ravi', 'Bilal', 'Hemanthi'."""
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
        if fname:
            aliases.append((fname.lower(), u))
            tokens = [t.strip().lower() for t in re.split(r'[\s().\-]+', fname) if len(t.strip()) >= 3]
            for tok in tokens:
                if tok not in ["miss", "mrs", "mr", "staff", "member", "system", "executive", "director", "administrator", "mohamed", "muhammad"]:
                    aliases.append((tok, u))
                elif tok == "ravi" or tok.startswith("ravi"):
                    aliases.append(("ravi", u))
                    aliases.append((tok, u))
            # Also handle prefix match like 'Ravi' for 'Ravindralal'
            for tok in tokens:
                if tok.startswith("ravi"):
                    aliases.append(("ravi", u))
                elif tok.startswith("shaameel") or tok.startswith("shameel"):
                    aliases.append(("shameel", u))
                    aliases.append(("shaameel", u))
    # Sort longer aliases first to avoid partial collisions
    aliases.sort(key=lambda x: len(x[0]), reverse=True)
    return aliases


def resolve_target_user_from_text(text, users, default_user):
    """
    Identifies which user a task log or command refers to (e.g. 'Ravi', 'done the works by Ravi',
    'for Bilal', 'assigned to Hemanthi').
    """
    if not text or not users:
        return default_user

    aliases = build_user_matcher_aliases(users)
    lines = [ln.strip() for ln in text.strip().splitlines() if ln.strip()]

    # 1. Check if the very first line is just a user's name (e.g. "Ravi" or "Ravi:")
    if lines:
        first_clean = re.sub(r'[:\-–—,.]+$', '', lines[0]).strip().lower()
        for alias, u in aliases:
            if first_clean == alias or first_clean == f"@{alias}":
                return u

    # 2. Check explicit patterns like "by <Name>", "for <Name>", "to <Name>", "<Name>'s tasks"
    for alias, u in aliases:
        pat = rf'\b(?:by|for|to|user|staff|member|assign(?:ed)?\s+to)\s+@?{re.escape(alias)}\b|\b{re.escape(alias)}(?:\'s|\s+done|\s+did|\s+completed|\s+tasks|\s+works)\b'
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
    if any(k in lower for k in ['roc', 'registrar', 'bo 2', 'bo2', 'form 1', 'form 13', 'form 15', 'form 20', 'incorporat', 'company approval', 'companies', 'secretarial', 'level 2', 'level 3', 'harshanee']):
        return "Corporate Secretarial & ROC", "ROC / Statutory Filing"
    if any(k in lower for k in ['comm bank', 'commercial bank', 'ntb', 'nations trust', 'bank', 'keyzer', 'fund transfer', 'alp', 'cheque', 'remittance', 'account', 'branch']):
        return "Banking & Finance", "Banking & Fund Transfer"
    if any(k in lower for k in ['ird', 'ramis', 'tin', 'apit', 'tax', 'vat', 'sscl', 'audit', 'financial statement']):
        return "Tax & IRD Compliance", "Tax / Audit Compliance"
    if any(k in lower for k in ['epf', 'etf', 'form c', 'form r-4', 'form r4', 'salary', 'payroll']):
        return "Payroll & Statutory", "EPF / ETF / Payroll"
    if any(k in lower for k in ['website', 'facebook', 'linkedin', 'social', 'marketing', 'seo', 'design', 'presentation']):
        return "Digital Marketing", "Marketing & Content"
    if any(k in lower for k in ['cupboard', 'box file', 'archive', 'original file', 'customer file']):
        return "Archive & Records", "File Management"
    return "Office Operations", "Field / Office Operations"


def build_clean_task_title(raw_text):
    """
    Generates a clean, executive-ready task title from a raw work-log item while preserving
    key entities (e.g., ROC, Coconut Hut, BO 2, Comm Bank Keyzer Street, ALP, People's Park).
    """
    first_line = raw_text.strip().splitlines()[0].strip()
    # Strip trailing conversational instructions if user appended prompt instructions after '..'
    first_line = re.sub(r'\.\.\s*the\s+ai\s+should\s+be\s+able.*$', '', first_line, flags=re.I).strip()
    first_line = re.sub(r'\s+', ' ', first_line)

    lower = first_line.lower()
    # Specific high-clarity title refinements for common shorthand patterns
    if 'roc' in lower and ('level 2' in lower or 'level 3' in lower) and ('5 companies' in lower or 'companies' in lower):
        return "ROC Approvals for 5 Companies (Level 2 to Level 3) & Final Approval Follow-Up"
    if 'bo 2' in lower and 'coconut hut' in lower:
        return "Resolve ROC System Error for BO 2 Application – Coconut Hut"
    if ('comm bank' in lower or 'commercial bank' in lower) and 'alp' in lower:
        return "Commercial Bank Keyzer Street – ALP Fund Transfer Approval"
    if "people's park" in lower and 'sh' in lower:
        return "People's Park – Spillburg Holdings (SH) Operational Needful"

    # General cleanup: fix common typos and capitalize nicely
    cleaned = first_line
    typo_fixes = [
        (r'\bApprovels\b', 'Approvals'),
        (r'\bapprovels\b', 'approvals'),
        (r'\bAssistan\b', 'Assistant'),
        (r'\bassistan\b', 'assistant'),
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
    # Fix common typos for readability while keeping full original meaning
    joined = re.sub(r'\bApprovels\b', 'Approvals', joined, flags=re.I)
    joined = re.sub(r'\bAssistan\b', 'Assistant', joined, flags=re.I)
    return joined


def determine_status_and_priority(item_text, header_done=False, tasked_date=""):
    """
    Determines task status ('Completed', 'In Progress', 'Pending', 'On Hold'),
    completedDate, and priority ('Critical', 'High', 'Medium', 'Low').
    """
    lower = item_text.lower()

    # Check if follow-up / pending action is explicitly mentioned in the item
    has_followup = any(p in lower for p in [
        'to be follow up', 'to be followed up', 'follow up', 'to be gone to final approvals',
        'awaiting', 'waiting for', 'pending approval', 'still in progress', 'in progress',
        'to be done', 'need to follow'
    ])
    has_on_hold = 'on hold' in lower
    has_completed_cue = any(p in lower for p in [
        'sort it out', 'sorted it out', 'sorted out', 'got approved', 'approved by him',
        'completed', 'finished', 'done', 'needful', 'resolved'
    ])

    if has_on_hold:
        status = "On Hold"
        completed_date = ""
    elif has_followup:
        status = "In Progress"
        completed_date = ""
    elif header_done or has_completed_cue:
        status = "Completed"
        completed_date = tasked_date
    else:
        status = "Pending"
        completed_date = ""

    # Priority detection
    if any(p in lower for p in ['urgent', 'critical', 'immediate', 'emergency']):
        priority = "Critical"
    elif any(p in lower for p in ['roc', 'system error', 'bo 2', 'fund transfer', 'bank', 'approval', 'registrar', 'ird']):
        priority = "High"
    else:
        priority = "Medium"

    return status, completed_date, priority


def find_matching_existing_task(item_title, item_notes, user_tasks, explicit_task_no=None, explicit_task_id=None):
    """
    Checks if a proposed task matches an existing task for the target user so SpillburgAI
    can propose an 'update' instead of duplicating, or update when requested.
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
        'task', 'work', 'works', 'done', 'update', 'edit', 'change', 'status', 'mark', 'needful'
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
        # Skip generic onboarding task unless explicitly mentioned
        if "portal onboarding" in t_title and "onboarding" not in combined_query:
            continue
        t_tokens = {w for w in re.findall(r'[a-z0-9]{2,}', f"{t_title} {t_notes}") if w not in stop_words}
        if not t_tokens:
            continue
        intersection = q_tokens.intersection(t_tokens)
        score = len(intersection) / max(min(len(q_tokens), len(t_tokens)), 1)
        if score > best_score and len(intersection) >= 2:
            best_score = score
            best_match = t

    if best_score >= 0.55:
        return best_match
    return None


def parse_ai_task_intent(user, message, users, operations):
    """
    Detects if the user's message is a work report / task list (like Ravi's 1) 2) 3) 4) report)
    or a command to add / update / edit tasks, and returns a structured proposal for user approval.
    Returns None if the message is a general question rather than task creation/editing.
    """
    if not message or not message.strip():
        return None

    text = message.strip()
    lower = text.lower()

    # Check if there are numbered items like "1)", "1)Went", "1. ", "(1)" or bullet items
    numbered_matches = list(re.finditer(r'(?:^|\n)\s*(?:\(?(\d{1,2})\)\s*|\(?(\d{1,2})[.:]\s+|[-•*]\s+)', text))
    if len(numbered_matches) < 2:
        # Also support inline numbered items like "1) ... 2) ... 3) ..."
        inline_matches = list(re.finditer(r'(?:^|\n|(?<=\s))\(?(\d{1,2})\)\s*(?=[A-Za-z])', text))
        if len(inline_matches) >= 2:
            numbered_matches = inline_matches
    is_explicit_task_cmd = bool(re.search(
        r'\b(?:add\s+task|create\s+task|new\s+task|assign\s+task|update\s+task|edit\s+task|mark\s+task|change\s+status|done\s+the\s+works|works\s+done\s+by|daily\s+report|work\s+report)\b',
        lower
    ))

    if len(numbered_matches) < 1 and not is_explicit_task_cmd:
        return None

    target_user = resolve_target_user_from_text(text, users, user)
    target_uid = target_user.get("id")
    target_uname = target_user.get("username")
    target_fname = target_user.get("fullName") or target_uname

    # Existing tasks for this target user
    user_existing_tasks = [
        t for t in operations
        if t.get("userId") == target_uid
        or (t.get("ownerUsername") and t.get("ownerUsername").lower() == (target_uname or "").lower())
        or (target_fname and t.get("assignedTo") and t.get("assignedTo").lower() == target_fname.lower())
    ]

    # Extract header text (before the first numbered item, or entire text if single command)
    header_text = text[:numbered_matches[0].start()] if numbered_matches else text
    tasked_date = extract_standard_date(header_text if numbered_matches else text)
    header_done = bool(re.search(r'\b(?:done\s+the\s+works|works\s+done|completed|did\s+the\s+works|yesterday\s+on)\b', header_text.lower()))

    proposed_tasks = []

    if numbered_matches:
        for idx, m in enumerate(numbered_matches):
            start_pos = m.end()
            end_pos = numbered_matches[idx + 1].start() if idx + 1 < len(numbered_matches) else len(text)
            raw_item = text[start_pos:end_pos].strip()
            if not raw_item:
                continue

            # Clean trailing meta instructions (e.g. ".. the ai should be able to generate tasks...")
            cleaned_notes = clean_item_notes(raw_item)
            if not cleaned_notes:
                continue

            title = build_clean_task_title(raw_item)
            workstream, task_type = classify_workstream_and_type(cleaned_notes)
            status, completed_date, priority = determine_status_and_priority(cleaned_notes, header_done=header_done, tasked_date=tasked_date)

            existing = find_matching_existing_task(title, cleaned_notes, user_existing_tasks)
            action = "update" if existing else "create"

            proposed_tasks.append({
                "proposalId": f"prop_{idx + 1}_{uuid.uuid4().hex[:4]}",
                "action": action,
                "existingTaskId": existing.get("id") if existing else "",
                "existingTaskNo": existing.get("no") if existing else None,
                "existingTaskTitle": existing.get("title") if existing else "",
                "userId": target_uid,
                "ownerUsername": target_uname,
                "assignedTo": target_fname,
                "requestedBy": existing.get("requestedBy") if existing else (user.get("fullName") or "Management"),
                "title": title,
                "workstream": workstream,
                "type": task_type,
                "taskedDate": tasked_date,
                "completedDate": completed_date,
                "status": status,
                "priority": priority,
                "estimatedCost": existing.get("estimatedCost", "") if existing else "",
                "notes": cleaned_notes
            })
    else:
        # Single natural language task creation or update/edit command
        explicit_no_m = re.search(r'\btask\s*#?(\d+)\b', lower)
        explicit_id_m = re.search(r'\b(ops_[a-z0-9_]+)\b', lower)
        explicit_no = int(explicit_no_m.group(1)) if explicit_no_m else None
        explicit_id = explicit_id_m.group(1) if explicit_id_m else None

        is_update_verb = bool(re.search(r'\b(?:update|edit|change|mark|set|complete)\b', lower))
        # Strip command prefix to get core task description
        desc = re.sub(
            r'^(?:please\s+)?(?:can\s+you\s+)?(?:add|create|assign|update|edit|mark|change|set)\s+(?:a\s+)?(?:new\s+)?(?:task\s*(?:#?\d+|ops_[a-z0-9_]+)?\s*)?(?:for|to|of)?\s*(?:@[a-z0-9_]+|[A-Za-z]+)?\s*[:\-–]?\s*',
            '',
            text,
            flags=re.I
        ).strip() or text

        cleaned_notes = clean_item_notes(desc)
        title = build_clean_task_title(cleaned_notes)
        workstream, task_type = classify_workstream_and_type(cleaned_notes)
        status, completed_date, priority = determine_status_and_priority(text, header_done=('completed' in lower or 'done' in lower), tasked_date=tasked_date)

        # Check explicit status override in command (e.g. "to Completed", "as In Progress", "to On Hold")
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
            # Preserve existing task's core title & taskedDate on update while updating status/notes
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
            "requestedBy": existing.get("requestedBy") if existing else (user.get("fullName") or "Management"),
            "title": title,
            "workstream": workstream,
            "type": task_type,
            "taskedDate": tasked_date,
            "completedDate": completed_date,
            "status": status,
            "priority": priority,
            "estimatedCost": existing.get("estimatedCost", "") if existing else "",
            "notes": cleaned_notes
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


def answer_knowledge_query(user, message, users, operations, customer_records, financial_records, payroll_records, enrich_payroll_fn):
    """
    Answers natural language questions across all Spillburg Holdings datasets, strictly enforcing
    each user's module permissions and personal/team scope.
    """
    text = (message or "").strip()
    lower = text.lower()
    access = get_user_access_summary(user)
    role = access["role"]
    is_exec = role in ["director", "admin"]

    # 1. Check if the query is specifically about PAYROLL / SALARIES / EPF / ETF
    payroll_keywords = ['payroll', 'salary', 'salaries', 'epf', 'etf', 'form c', 'form r-4', 'form r4', 'remittance', 'apadmi', 'spillburg vacation', 'exchange rate', 'gbp', 'net pay', 'gross pay', 'apit', 'payslip', 'cheque']
    asks_payroll = any(k in lower for k in payroll_keywords)

    # 2. Check if the query is about FINANCIAL FILES / TAX / TIN / IRD / SSID
    fin_keywords = ['tin', 'ird', 'pin', 'ssid', 'tax', 'financial file', 'financial register', 'audit', 'annual return', 'assessment year', 'passport', 'ramis', 'filing status']
    asks_fin = any(k in lower for k in fin_keywords)

    # 3. Check if the query is about CUSTOMER FILES / CUPBOARDS / BOXES / PV REG NO
    cust_keywords = ['customer file', 'cupboard', 'box file', 'box no', 'original file', 'copy file', 'incorporation', 'pv', 'archive']
    asks_cust = any(k in lower for k in cust_keywords)

    # 4. Check if the query is about OPERATIONS / TASKS
    ops_keywords = ['task', 'tasks', 'operation', 'operations', 'pending', 'in progress', 'completed', 'on hold', 'workstream', 'deliverable', 'todo', 'to-do', 'assigned']
    asks_ops = any(k in lower for k in ops_keywords)

    # 5. Check if the query is about USERS / PERMISSIONS / ACCESS
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

    # --- ENTITY / KEYWORD SEARCH ACROSS PERMITTED DATASETS ---
    sections = []

    # Check if a specific person/user is mentioned for Operations Tasks
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
            if asks_ops or len(text.split()) <= 6:
                comp = sum(1 for t in user_ops if t.get("status") == "Completed")
                in_p = sum(1 for t in user_ops if t.get("status") == "In Progress")
                pend = sum(1 for t in user_ops if t.get("status") == "Pending")
                hold = sum(1 for t in user_ops if t.get("status") == "On Hold")
                lines = [
                    f"### 📋 Operations Tasks for {mentioned_user.get('fullName')} (`@{mentioned_user.get('username')}`)",
                    f"- **Total Tasks**: {len(user_ops)} (`{comp}` Completed, `{in_p}` In Progress, `{pend}` Pending, `{hold}` On Hold)"
                ]
                for t in user_ops[:12]:
                    lines.append(
                        f"  - **#{t.get('no')} {t.get('title')}** — `{t.get('status')}` | *{t.get('workstream', 'General')}* | Tasked: `{t.get('taskedDate') or '-'}`"
                        + (f" | Done: `{t.get('completedDate')}`" if t.get("completedDate") else "")
                        + (f"\n    *Notes*: {t.get('notes')}" if t.get("notes") else "")
                    )
                if len(user_ops) > 12:
                    lines.append(f"  - *...and {len(user_ops) - 12} more tasks.*")
                sections.append("\n".join(lines))
        elif asks_ops:
            # Filter by status or keyword if present
            filtered_ops = scoped_ops
            if 'pending' in lower:
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
                f"- **Total Tasks**: {len(scoped_ops)} | **Completed**: {comp} | **In Progress**: {in_p} | **Pending**: {pend} | **On Hold**: {hold}",
                f"- **Showing ({len(filtered_ops)}) matching tasks**:"
            ]
            for t in filtered_ops[:10]:
                lines.append(
                    f"  - **#{t.get('no')} {t.get('title')}** ({t.get('assignedTo', 'Unassigned')}) — `{t.get('status')}` | *{t.get('workstream', 'General')}* | `{t.get('taskedDate') or '-'}`"
                )
            sections.append("\n".join(lines))

    # B. PAYROLL SEARCH / SUMMARY (Only if permitted!)
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
        # Check if user asked about a specific employee or period
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
                lines.append(
                    f"- **{e.get('name')}** ({e.get('position')}) — *{comp_name} ({month_str})*\n"
                    f"  - Gross LKR: `Rs {e.get('lkrGross', 0):,.2f}` | EPF 8%: `Rs {e.get('epf8Lkr', 0):,.2f}` | EPF 12%: `Rs {e.get('epf12Lkr', 0):,.2f}` | ETF 3%: `Rs {e.get('etf3Lkr', 0):,.2f}` | APIT: `Rs {e.get('apit', 0):,.2f}` | **Net Salary**: `Rs {e.get('netSalaryLkr', 0):,.2f}`"
                )
        else:
            lines.append("\n#### 📅 Payroll Cycles:")
            for p in periods[:6]:
                ep = enrich_payroll_fn(p) if enrich_payroll_fn else p
                tots = ep.get("totals", {})
                comp_name = next((c.get("name") for c in companies if c.get("id") == p.get("companyId")), p.get("companyId"))
                lines.append(
                    f"- **{ep.get('month')}** — *{comp_name}* [`{ep.get('status')}`]: "
                    f"`{len(ep.get('employees', []))}` Staff | Gross: `Rs {tots.get('sumLkrGross', 0):,.2f}` | "
                    f"**Net Remittance**: `Rs {tots.get('sumNetSalaryLkr', 0):,.2f}` | "
                    f"EPF (20%): `Rs {(tots.get('sumEpf8Lkr', 0) + tots.get('sumEpf12Lkr', 0)):,.2f}` | ETF (3%): `Rs {tots.get('sumEtf3Lkr', 0):,.2f}`"
                )
        sections.append("\n".join(lines))

    # C. SPECIFIC ENTITY / KEYWORD SEARCH ACROSS CUSTOMER FILES, FINANCIAL FILES, AND TASKS
    stop_q = {
        'what', 'where', 'when', 'who', 'how', 'many', 'show', 'tell', 'me', 'about', 'find', 'search',
        'the', 'for', 'in', 'of', 'and', 'is', 'are', 'all', 'list', 'give', 'details', 'information',
        'file', 'files', 'company', 'companies', 'record', 'records', 'status', 'number', 'tin', 'ird',
        'pin', 'ssid', 'cupboard', 'box', 'customer', 'financial', 'spillburg', 'portal', 'can', 'you'
    }
    search_terms = [w for w in re.findall(r'[a-z0-9]{3,}', lower) if w not in stop_q]

    if search_terms:
        # Search Financial Records if permitted
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

        # Search Customer Files if permitted
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

        # Search Operations Tasks by keyword if permitted and not already dumped above
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
                for _, t in ops_matches[:6]:
                    lines.append(
                        f"- **#{t.get('no')} {t.get('title')}** (Assigned to: **{t.get('assignedTo')}**) — `{t.get('status')}` | Tasked: `{t.get('taskedDate')}`\n"
                        f"  *Notes*: {t.get('notes') or '-'}"
                    )
                sections.append("\n".join(lines))

    # D. GENERAL MODULE SUMMARIES (Customer DB / Financial DB / Users / Access)
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
            f"- *Tip*: Ask me for any company name or PV number (e.g., `Where is 113 East SL?` or `Find PV102217`) to get its exact Cupboard and Box File!"
        )

    if asks_fin and access["modules"]["financial_files"]["view"] and not any("Financial & Tax Register" in s for s in sections):
        sections.append(
            f"### 📊 Financial Files & Tax Register Overview\n"
            f"- **Total Registered Entities**: `{len(financial_records)}` digitized corporate & individual tax files\n"
            f"- Contains **TIN Numbers**, **IRD RAMIS PINs**, **SSIDs**, **Director Passports/NICs**, and **2024/2025 Filing Checklists**.\n"
            f"- *Tip*: Ask me for any entity's TIN or IRD details (e.g., `What is the TIN and IRD PIN for Remi Dream Lanka?`)."
        )

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

    # E. DEFAULT OVERVIEW / WELCOME RESPONSE IF NO SPECIFIC MATCH
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
            f"1. **Paste Daily Work Logs to Generate or Update Tasks**: Paste a team member's WhatsApp/daily report (e.g., *\"Ravi — Yesterday on 28/10/2026 done the works by Ravi 1) Went to ROC... 2) Coconut Hut BO 2...\"*) and I will automatically extract each task, match any existing tasks, assign them to the relevant user, and let you **Approve & Apply** them.\n"
            f"2. **Edit or Update Existing Tasks**: Say *\"Update task #1 for Ravi to Completed\"* or *\"Add a High priority task for Bilal to follow up ROC Form 20\"*.\n"
            f"3. **Ask Questions Across Permitted Databases**:\n"
            f"   - *\"Show Ravi's tasks\"* or *\"What are our pending operations tasks?\"*\n"
            f"   - *\"Where is the file for 113 East SL?\"* (Customer File DB)\n"
            + (f"   - *\"What is the TIN and IRD PIN for Remi Dream Lanka?\"* (Financial DB)\n" if m["financial_files"]["view"] else "")
            + (f"   - *\"Show the payroll summary and EPF/ETF registration numbers for all companies\"* (Payroll DB)\n" if m["payroll"]["view"] else "")
        )

    return {
        "reply": "\n\n---\n\n".join(sections),
        "intent": "knowledge_response",
        "accessSummary": access
    }


def process_spillburg_ai_message(user, message, history, users, operations, customer_records, financial_records, payroll_records, enrich_payroll_fn=None):
    """
    Main entry point for POST /api/ai/chat.
    1. Checks SpillburgAI access permission.
    2. Checks if the user pasted a task report or requested task creation/editing -> returns structured task proposal for approval.
    3. Otherwise queries the permission-scoped knowledge base.
    """
    if not can_user_access_spillburg_ai(user):
        return {
            "success": False,
            "error": "Access Denied: SpillburgAI access has been disabled for your account by an Administrator.",
            "restricted": True
        }, 403

    # 1. Check if message is a task log / task creation / task edit request
    task_proposal = parse_ai_task_intent(user, message, users, operations)
    if task_proposal:
        # Verify the user has operations view/edit rights
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

    # 2. Answer general / database query with strict permission filtering
    kb_res = answer_knowledge_query(
        user=user,
        message=message,
        users=users,
        operations=operations,
        customer_records=customer_records,
        financial_records=financial_records,
        payroll_records=payroll_records,
        enrich_payroll_fn=enrich_payroll_fn
    )
    return {
        "success": True,
        **kb_res
    }, 200
