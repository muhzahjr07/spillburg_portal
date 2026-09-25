# Changelog

All notable changes to the **Spillburg Holdings Enterprise Company Portal** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - Multi-role Role-Based Access Control (RBAC): Executive Director, System Admin, Muhammad Zaharan, Staff Editor, and Staff Viewer.
  - Operations Tracker with task priorities, due dates, statuses, and per-user isolated workspace views.
  - Microsoft Access Database (`.accdb`) bridge via 32-bit PowerShell OLEDB 16.0 engine for customer file records.
  - Dual-record company onboarding (Original File in Cupboards 1/3 and Customer Copy in Cupboard 2).
  - Physical Box & Filing Cabinet interactive view.
  - Financial Files Archive: Searchable catalog of 44 digitized physical register ledger pages and vouchers with high-resolution inspection modal.
  - Admin management panel with user creation, role assignment, and self-deletion security guard.
  - Automated end-to-end verification test suite (`verify_portal.py`).
