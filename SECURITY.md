# Security Policy

## Supported Versions

Security updates and patches are actively maintained for the following versions:

| Version | Supported          |
|:--------|:-------------------|
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

We take the security and confidentiality of Spillburg Holdings corporate data and records seriously.

If you discover a security vulnerability, please **DO NOT** open a public issue. Instead, follow these steps:

1. **Email Contact**: Send a private report directly to the repository maintainer:
   - Muhammad Zaharan ([muhzahjr07@gmail.com](mailto:muhzahjr07@gmail.com))
2. **Include Key Details**:
   - Description of the vulnerability and its potential impact.
   - Exact steps or proof-of-concept script to reproduce the issue.
   - Component affected (`server.py`, authentication, RBAC, access bridge, session store).
   - Any suggested mitigations or patches.

### Response Timeline

- **Initial Acknowledgment**: Within 48 hours of receipt.
- **Triage & Assessment**: Within 5 business days.
- **Resolution & Release**: Critical security issues will receive high-priority remediation.

---

## Security Best Practices for Deployment

1. **Rotate Default Passwords**: Change all default passwords (`director123`, `admin123`, `staff123`) in `data/users.json` or via the Admin panel before deploying to public cloud services.
2. **HTTPS Enforcement**: Always deploy behind a TLS/HTTPS reverse proxy (e.g. Render.com automatic TLS, Cloudflare, or Nginx).
3. **Database Access Locks**: Do not expose raw Microsoft Access (`.accdb`) or SQLite (`.sqlite`) files directly over HTTP. All access must flow through authenticated REST handlers in `server.py`.
4. **Environment Variables**: Use the `PORT` environment variable to configure listening ports rather than hardcoding.
