# Changelog

All notable changes to the **Spillburg Holdings Enterprise Company Portal** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-10-08

### Added
- **Dual-Currency Payroll & Statutory Remittance Engine**:
  - Full payroll management suite for managed client companies (APADMI SL Private Limited, etc.).
  - Dual-currency salary grid: contracted salaries in Great British Pounds (GBP) converted at customizable dynamic exchange rates (e.g. `1 GBP = 440.00 LKR`) to Gross Sri Lankan Rupees (LKR).
  - Automated Sri Lankan statutory calculations: EPF 8% (Employee), EPF 12% (Employer), ETF 3% (Employer), APIT (Advance Personal Income Tax), and Net Bank Remittance.
  - Partial-month work day deduction calculation (e.g. 17 Days worked vs standard full month) matching certified APADMI SL September 2026 payroll sheets.
- **Pure Python OpenXML Excel Generator (`payroll_excel.py`)**:
  - High-speed, zero-dependency OpenXML engine creating genuine `.xlsx` spreadsheets dynamically without `openpyxl` or `pandas`.
  - Exports dual tables (GBP Salary Sheet and LKR Statutory Remittance) with custom column widths, borders, and Calibri 8pt typography.
- **Official Bank Remittance Payment Advice**:
  - Formal payment request letter formatted for Sri Lankan commercial banks (Nations Trust Bank PLC, Commercial Bank, Bank of Ceylon).
  - High-resolution letterhead header and footer graphics integration.
  - One-click clean print stylesheet for bank payment execution.
- **Individual Employee Payslip Vouchers**:
  - Formatted monthly vouchers detailing basic earnings, exchange rate conversions, statutory deductions, tax withholdings, and net salary.
  - Batch print or single-employee print preview options.
- **Payroll Period Management Hub**:
  - Multi-period lifecycle tracking (`Draft`, `Approved`, `Paid`, `Closed`).
  - One-click employee roster cloning across periods (names, bank account details, TIN/NIC numbers, and contracted GBP salaries).
  - Period lock and freeze controls to protect historical accounting records.
- **Operations Tracker Date Filtering**:
  - **Tasked Date Year Filter**: Interactive pill bar and dropdown filter across calendar years (`All Years`, `2026`, etc.).
  - **Tasked Date Month Filter**: Granular calendar month selector (`All Months`, `January`, ..., `September`, `October`, etc.) with real-time count badges.
- **Dynamic Requester & Workstream Dropdowns with "+ Add New..."**:
  - Auto-populating select menus extracted dynamically from all active tasks.
  - Inline modal dialogs to register new requesters or workstreams on the fly.
- **Persistence Engine & Deployment Auto-Sync**:
  - Two-way disk synchronization ensuring atomic writes and `.bak` snapshots.
  - Render.com container auto-sync: detects the latest production snapshot in `backup_files/` on boot and restores database state, preventing data loss across cloud restarts.
  - One-click full system JSON backup utility.
- **Fluid Horizontal Table Scrollbar**:
  - Custom floating sticky bottom scrollbar with left/right nudge buttons, track clicking, and percentage badge for wide enterprise tables.
- **Comprehensive Visual Showcase**:
  - Captured and integrated 12 high-resolution (1440x960) interface screenshots into the GitHub `README.md`.
  - Added automated headless browser screenshot capture utility (`scripts/generate_screenshots.py`).
- **Automated Payroll Test Suite (`verify_payroll.py`)**:
  - End-to-end testing for OpenXML `.xlsx` generation, letterhead assets, exchange rate recalculation, and statutory totals.

---

## [1.1.0] - 2026-09-25

### Added
- **Render.com Cloud Deployment**: Added `render.yaml` blueprint and `Procfile` for 1-click cloud hosting.
- **One-Click GitHub Push**: Created `Push_To_GitHub.bat` for seamless repository publishing and branch synchronization.
- **Cross-Platform Resilience**: Auto-fallback to SQLite3 (`customers.sqlite`) and JSON caches when operating in Linux/cloud containers without Windows OLEDB drivers.
- **PWA & Brand Identity**: Added official Spillburg brand logo, favicon support (`/favicon.ico`, `/logo.png`), Apple touch icons, and `manifest.json`.
- **Comprehensive Documentation Suite**: Added `README.md`, `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and GitHub issue/PR templates.
- **GitHub Actions CI**: Added continuous integration workflow for Python syntax checking and portal verification.

### Improved
- **MIME Type Handling**: Extended `server.py` static router to support `.ico`, `.svg`, `.json`, and Web App manifests.
- **Git Hygiene**: Updated `.gitignore` to prevent Microsoft Access lock files (`*.laccdb`, `*.ldb`), OS files, and editor artifacts from polluting git history.

---

## [1.0.0] - 2026-09-22

### Added
- **Initial Production Release**:
  - Unified HTTP and REST API server written in pure Python 3 Standard Library with zero pip dependencies.
  - Multi-role Role-Based Access Control (RBAC): Executive Director, System Admin, Staff Editor, and Staff Viewer.
  - Operations Tracker with task priorities, due dates, statuses, and per-user isolated workspace views.
  - Microsoft Access Database (`.accdb`) bridge via 32-bit PowerShell OLEDB 16.0 engine for customer file records.
  - Dual-record company onboarding (Original File in Cupboards 1/3 and Customer Copy in Cupboard 2).
  - Physical Box & Filing Cabinet interactive view.
  - Financial Files Archive: Searchable catalog of 44 digitized physical register ledger pages and vouchers with high-resolution inspection modal.
  - Admin management panel with user creation, role assignment, and self-deletion security guard.
  - Automated end-to-end verification test suite (`verify_portal.py`).
