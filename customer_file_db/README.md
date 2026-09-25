# Office File Register - Customer Database Portal

A modern, high-performance web portal to manage, search, add, edit, and delete customer file records directly connected to **`Office File Register.accdb`**.

---

## Quick Start (One-Click)

To launch the portal:
1. Double-click **`Start_Portal.bat`** in this folder.
2. The server will start and automatically open your default browser at **`http://127.0.0.1:8080`**.

---

## Key Features

- **Direct Access Database Connectivity**:
  - Operates directly on `Office File Register.accdb` using native 32-bit Microsoft Access Database Engine (OLEDB 16.0).
  - All additions, edits, and deletions persist immediately in your Access database file.
- **Fast Search & Smart Filtering**:
  - Live search across Company Name, Registration Number (e.g. `PV...`), Cupboard, and Box File numbers.
  - One-click tabs to switch between **All Records**, **Original Files** (Cupboards 1 & 3), and **Customer Files / Copies** (Cupboard 2).
  - Filter by specific Cupboard or Box File.
- **Onboard Company (Dual Record Creation)**:
  - Specially designed for company onboarding: registers both the **Original File** and the **Customer Copy** simultaneously with their respective cupboard and box locations.
- **Add, Change / Edit, & Delete**:
  - Add individual file records with auto-calculated record numbers.
  - Edit any record details with live field validation.
  - Safe record removal with confirmation safeguards.
- **Dual View Modes**:
  - **Table View**: Comprehensive, sortable table with status badges and quick action buttons.
  - **Physical Box View**: Visual representation of physical Cupboards and Box Files showing how many folders are inside each physical box—perfect for office filing and physical file retrieval.
- **Database Safety & Backups**:
  - One-click instant database backups saved in the `backups/` directory with timestamped filenames.
  - A baseline backup was automatically created in `backups/`.
- **CSV / Excel Export**:
  - Export the full or filtered file register directly to a `.csv` spreadsheet at any time.
- **Printable File Register**:
  - Dedicated clean print stylesheet for printing out physical file lists and box indexes.

---

## Project Structure

```
customer_file_db/
│
├── Office File Register.accdb    # Primary Microsoft Access Database
├── Start_Portal.bat             # One-click Windows batch launcher
├── server.ps1                   # Standalone 32-bit PowerShell REST API & static server
├── README.md                    # Documentation & instructions
│
├── public/
│   └── index.html               # Responsive Single-Page Application (HTML5, Tailwind, JS)
│
└── backups/                     # Directory storing timestamped database backups
    └── Office_File_Register_Initial_Backup.accdb
```

---

## Technical Details

- **Backend Runtime**: Windows 32-bit PowerShell (`C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe`) with `System.Net.HttpListener`.
- **Database Driver**: `Microsoft.ACE.OLEDB.16.0`.
- **Dependencies**: None. 100% self-contained on Windows with zero pip/node installations required.
- **Default Port**: `8080` (can be customized by passing `-Port <number>` to `server.ps1`).
