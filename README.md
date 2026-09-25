# Spillburg Holdings — Enterprise Company Portal

[![Python](https://img.shields.io/badge/Python-3.9%20%7C%203.10%20%7C%203.11%20%7C%203.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Pure%20Stdlib)-brightgreen?style=for-the-badge)](requirements.txt)
[![Deploy on Render](https://img.shields.io/badge/Deploy%20to-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=for-the-badge)](render.yaml)

A unified, high-performance, **zero-external-dependency** enterprise web portal engineered for **Spillburg Holdings (Pvt) Ltd**.

The portal centralizes corporate presence, operations tracking, customer file registers (with physical cupboard/box indexing), and digitized financial ledger archives into a single, lightning-fast Single-Page Application (SPA).

---

## 🌐 Live Cloud Demo

- **Production URL**: [https://spillburg-portal.onrender.com](https://spillburg-portal.onrender.com) *(when deployed)*
- **Local Address**: `http://127.0.0.1:8080`

---

## ⚡ Key Highlights

- **Zero Pip Dependencies**: Runs 100% out of the box using only the Python 3 Standard Library (`http.server`, `socketserver`, `sqlite3`, `json`, `urllib`).
- **Dual-Mode Data Architecture**:
  - **Local Windows Mode**: Interfaces directly with Microsoft Access (`Office File Register.accdb` / `Customer_Files_Active.accdb`) via 32-bit PowerShell OLEDB 16.0 bridge.
  - **Cloud / Cross-Platform Mode**: Seamlessly auto-syncs and falls back to SQLite3 (`customers.sqlite`) and robust JSON persistence on Linux/Render.com environments where Access drivers are unavailable.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions (Director, Admin, Staff Editor, Staff Viewer) with secure token-based session management and administrative access governance.
- **Physical Box & Cupboard Visualizer**: Interactive physical filing index showing folder distribution across Cupboards 1, 2, and 3 and physical box numbers for instant paper file retrieval.
- **Dual-Record Company Onboarding**: Automatically creates paired entries for company registration: **Original File** (Cupboards 1 & 3) and **Customer Copy** (Cupboard 2).
- **Digitized Financial Ledger**: Searchable catalog of 44 physical register pages and vouchers with high-resolution inspection modal and zoom controls.

---

## 🏛️ Portal Modules

### 1. Corporate Hub
- Official corporate credentials, vision, and core service offerings.
- Directory of bilateral business councils (Sri Lanka - China, Sri Lanka - Japan, Sri Lanka - ASEAN, etc.).
- Executive leadership directory and organizational hierarchy.

### 2. Operations Tracker
- Task management with priorities (`Urgent`, `High`, `Medium`, `Low`) and statuses (`Pending`, `In Progress`, `Under Review`, `Completed`).
- Isolated per-user workspaces with individual task queues.
- Master operations archive preserved in `data/archived_master_tracker.json`.
- Live search, filtering by department, assignee, and status.

### 3. Customer File Database
- Search across Company Name, Registration Number (`PV...`), Cupboard, and Box File numbers.
- **Dual View Modes**:
  - **Table View**: Sortable grid with edit, delete, and detail drawers.
  - **Physical Box View**: Visual representation of physical filing cabinets to find paper documents in seconds.
- Dual-record company onboarding workflow.
- One-click timestamped database backups.
- One-click CSV / Excel export and dedicated clean print stylesheet.

### 4. Financial Files Database
- Searchable catalog of 44 digitized physical ledger book entries and payment vouchers.
- Categorized by fiscal year, ledger book, and voucher series.
- Modal inspection viewer with zoom and high-resolution rendering.

### 5. Admin & User Access Control
- Dedicated management interface for administrators.
- Create users, reassign roles, toggle module-level edit/view permissions, and reset credentials.
- Safety guard preventing accidental self-deletion of the active administrator.

---

## 🔐 Default Roles & Credentials

| Role | Username | Password | Permissions |
|:---|:---|:---|:---|
| **Executive Director** | `director` | `director123` | Full access across all corporate modules |
| **System Admin** | `admin` | `admin123` | Full access + User & Role Management |
| **Admin (Zaharan)** | `zaharan` | `admin123` | Full administrative control & tracker sync |
| **Managing Director** | `hameez` | `spillburg123` | Executive oversight |
| **Operations Director**| `shameel` | `spillburg123` | Operations management |
| **Staff Member (Editor)**| `staff_editor` | `staff123` | Edit & create tasks and customer records |
| **Staff Member (Viewer)**| `staff_viewer` | `staff123` | Read-only access across registers |

> **Security Note:** Default credentials should be updated or rotated via the Admin panel prior to exposing the portal to public untrusted networks.

---

## 🚀 Quick Start Guide

### Option A: Windows (One-Click Launcher)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/muhzahjr07/company_portal.git
   cd company_portal
   ```
2. Double-click **`Start_Spillburg_Portal.bat`**.
3. The server starts at `http://127.0.0.1:8080` and automatically launches in your default browser.

---

### Option B: Command Line (Any OS)

Requires Python 3.9 or newer. No pip installations needed!

```bash
# Clone the repository
git clone https://github.com/muhzahjr07/company_portal.git
cd company_portal

# Start the server (default port: 8080)
python server.py

# Or specify a custom port
python server.py 9000
```

Visit `http://localhost:8080` in your web browser.

---

### Option C: 1-Click Cloud Deployment on Render.com

This repository is pre-configured with `render.yaml` (Render Blueprint) and `Procfile`.

1. Push your repository to GitHub:
   - Run `Push_To_GitHub.bat` (Windows) or push via git CLI.
2. Sign in to [Render.com](https://dashboard.render.com).
3. Click **New +** → **Blueprint** (or **Web Service**).
4. Connect this GitHub repository (`company_portal`).
5. Render will automatically detect settings:
   - **Environment**: Python 3
   - **Build Command**: *(leave empty)*
   - **Start Command**: `python server.py`
   - **Plan**: Free
6. Click **Deploy**. Your permanent HTTPS link will be active in under 60 seconds!

---

## 📁 Repository Structure

```
company_portal/
├── .github/                       # GitHub actions workflows & community templates
│   ├── workflows/ci.yml           # Automated CI verification suite
│   ├── ISSUE_TEMPLATE/            # Bug report & feature request templates
│   └── pull_request_template.md   # Pull request checklist
├── customer_file_db/              # Customer file database & MS Access engine
│   ├── Customer_Files_Active.accdb# Active Access database file
│   ├── Office File Register.accdb # Master Access file register
│   ├── customers.sqlite           # SQLite cross-platform database
│   ├── server.ps1                 # Standalone 32-bit PowerShell REST server
│   └── backups/                   # Timestamped database backups
├── data/                          # JSON data stores & caches
│   ├── users.json                 # Role & user credentials store
│   ├── operations.json            # Operations tasks
│   ├── financial_records.json     # Digitized financial metadata
│   ├── customer_records_cache.json# Customer records cache
│   └── archived_master_tracker.json# Master task archive
├── financial_files_db/            # 44 digitized physical ledger photos
├── public/                        # Frontend Single-Page Application (SPA)
│   ├── index.html                 # HTML5 layout & application views
│   ├── app.js                     # Client logic, router & state management
│   ├── styles.css                 # Custom CSS & print layout styling
│   ├── logo.png                   # Official Spillburg Holdings brand asset
│   └── manifest.json              # Web App Manifest (PWA support)
├── access_bridge.ps1              # 32-bit OLEDB bridge for Microsoft Access
├── inspect_db.ps1                 # Database diagnostic utility
├── Procfile                       # Render / Heroku process declaration
├── Push_To_GitHub.bat             # 1-click GitHub deployment utility
├── render.yaml                    # Render Blueprint Infrastructure-as-Code
├── requirements.txt               # Pure Python stdlib indicator
├── server.py                      # Multi-threaded Python HTTP/REST API server
├── Start_Spillburg_Portal.bat     # Windows one-click desktop launcher
├── verify_portal.py               # Automated end-to-end test suite
├── CONTRIBUTING.md                # Contribution guidelines
├── CODE_OF_CONDUCT.md             # Contributor Covenant code of conduct
├── SECURITY.md                    # Security policy & reporting guidelines
├── CHANGELOG.md                   # Chronological release log
└── LICENSE                        # MIT License
```

---

## 📡 REST API Reference

All protected endpoints accept session authorization via `Authorization: Bearer <token>` header or `token` cookie.

### Authentication
| Method | Endpoint | Description | Access |
|:---|:---|:---|:---|
| `POST` | `/api/auth/login` | Authenticate and obtain session token | Public |
| `POST` | `/api/auth/logout` | Invalidate active session token | Authenticated |
| `GET` | `/api/auth/me` | Fetch active user profile and permissions | Authenticated |

### Operations Tracker
| Method | Endpoint | Description | Access |
|:---|:---|:---|:---|
| `GET` | `/api/operations` | List operations tasks (filtered by user) | Authenticated |
| `POST` | `/api/operations` | Create a new operations task | Editor / Admin |
| `PUT` | `/api/operations/<id>` | Update status, priority, or task details | Editor / Admin |
| `DELETE` | `/api/operations/<id>` | Remove an operations task | Editor / Admin |

### Customer Files
| Method | Endpoint | Description | Access |
|:---|:---|:---|:---|
| `GET` | `/api/customer-files` | Retrieve file records & cupboard metadata | Authenticated |
| `POST` | `/api/customer-files` | Add a single customer file record | Editor / Admin |
| `POST` | `/api/customer-files/onboard` | Dual-record onboarding (Original + Copy)| Editor / Admin |
| `PUT` | `/api/customer-files/<no>` | Update company or cupboard placement | Editor / Admin |
| `DELETE` | `/api/customer-files/<no>` | Remove a customer file record | Editor / Admin |

### Financial Archives
| Method | Endpoint | Description | Access |
|:---|:---|:---|:---|
| `GET` | `/api/financial-files` | List financial photos & ledger metadata | Authenticated |

### User Management
| Method | Endpoint | Description | Access |
|:---|:---|:---|:---|
| `GET` | `/api/users` | List all system users and roles | Admin Only |
| `POST` | `/api/users` | Create a new portal user | Admin Only |
| `PUT` | `/api/users/<id>` | Modify role, permissions, or password | Admin Only |
| `DELETE` | `/api/users/<id>` | Delete user (with self-deletion guard) | Admin Only |

---

## 🧪 Automated Testing & Verification

The repository includes a comprehensive end-to-end verification script testing API status codes, RBAC barriers, static asset routing, data integrity, and session handling:

```bash
# Run verification suite (starts a test instance automatically)
python verify_portal.py
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🏢 Organization & Author

**Spillburg Holdings (Pvt) Ltd**  
*Corporate Hub & Technology Infrastructure*  
Author & Lead Developer: **Muhammad Zaharan** ([@muhzahjr07](https://github.com/muhzahjr07))
