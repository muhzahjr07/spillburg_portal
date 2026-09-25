# Contributing to Spillburg Holdings Enterprise Portal

Thank you for your interest in contributing to the **Spillburg Holdings Enterprise Company Portal**! This document provides guidelines and workflows for proposing enhancements, fixing bugs, and contributing to the project.

---

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior to the project lead.

---

## Core Development Philosophy

1. **Zero External Dependencies**: The backend MUST remain strictly within the Python 3 Standard Library. Do not introduce pip packages (e.g. Flask, FastAPI, Django, Requests) without explicit architectural consensus.
2. **Dual-Mode Portability**: Ensure changes work seamlessly on both Windows (with Microsoft Access OLEDB bridge) and Linux/cloud environments (with SQLite3 and JSON cache fallback).
3. **Simplicity & Performance**: Prefer clean, semantic HTML5, modern CSS3, and vanilla modern JavaScript over heavy frontend frameworks.
4. **Data Integrity**: Any updates to customer files or operations data must preserve data safety and avoid destructive state overwrites.

---

## Getting Started

1. **Fork or Clone the Repository**:
   ```bash
   git clone https://github.com/muhzahjr07/company_portal.git
   cd company_portal
   ```

2. **Verify Local Environment**:
   Ensure you have Python 3.9+ installed:
   ```bash
   python --version
   ```

3. **Run the Portal Locally**:
   ```bash
   python server.py 8080
   ```
   Open `http://localhost:8080` in your web browser.

---

## Workflow & Git Guidelines

1. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Commit Convention**:
   Write clear, concise commit messages using conventional prefixes:
   - `feat:` A new feature or capability
   - `fix:` A bug fix or patch
   - `docs:` Documentation improvements
   - `style:` Formatting or CSS styling changes
   - `refactor:` Code improvements that do not alter behavior
   - `test:` Adding or updating tests

3. **Run Automated Verification**:
   Before committing, verify that all API endpoints, RBAC checks, and data routes pass:
   ```bash
   python verify_portal.py
   ```

4. **Push and Open a Pull Request**:
   Push your branch to GitHub and open a Pull Request against the `main` branch. Fill in the provided [Pull Request Template](.github/pull_request_template.md).

---

## Reporting Issues

- For bug reports, please use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md).
- For new feature ideas or architectural suggestions, use the [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md).
