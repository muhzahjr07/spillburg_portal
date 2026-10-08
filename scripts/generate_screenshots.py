#!/usr/bin/env python3
"""
Spillburg Holdings - Automated Screenshot Capture Suite
Captures pixel-perfect, high-resolution (1440x960) interface screenshots of all portal
modules for GitHub documentation using Edge Headless CDP and Playwright.
"""

import subprocess
import time
import os
import sys
import threading
import urllib.request
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
import server

SCREENSHOTS_DIR = os.path.join(BASE_DIR, "screenshots")
PORT = 8092
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def main():
    print("=" * 68)
    print("   SPILLBURG HOLDINGS - AUTOMATED SCREENSHOT GENERATION SUITE   ")
    print("=" * 68)

    # 1. Start Server in daemon thread
    print(f"[INFO] Initializing server on port {PORT}...")
    server_thread = threading.Thread(target=server.run, args=(PORT,), daemon=True)
    server_thread.start()

    for i in range(30):
        try:
            res = urllib.request.urlopen(f"http://127.0.0.1:{PORT}/")
            if res.status == 200:
                print(f"[PASS] Server active and reachable at http://127.0.0.1:{PORT}/")
                break
        except Exception:
            time.sleep(0.5)
    else:
        print("[FAIL] Server failed to initialize within 15 seconds")
        return

    # 2. Start Edge Headless with CDP
    cdp_port = 9235
    edge_cmd = [
        EDGE_PATH,
        f"--remote-debugging-port={cdp_port}",
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1440,960",
        "about:blank"
    ]
    print(f"[INFO] Launching Edge headless on CDP port {cdp_port}...")
    edge_proc = subprocess.Popen(edge_cmd)
    time.sleep(2)

    try:
        import playwright.sync_api
        with playwright.sync_api.sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{cdp_port}")
            context = browser.contexts[0]
            page = context.new_page()
            page.set_viewport_size({"width": 1440, "height": 960})

            # 1. Login Screen
            print("\n[1/12] Capturing 01_login_screen.png...")
            page.goto(f"http://127.0.0.1:{PORT}/")
            page.wait_for_selector("#loginUsername", timeout=10000)
            time.sleep(1)
            page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "01_login_screen.png"))
            print("  [SAVED] 01_login_screen.png")

            # Authenticate as Director
            page.fill("#loginUsername", "director")
            page.fill("#loginPassword", "director123")
            page.click("#loginSubmitBtn")
            page.wait_for_selector("#userNameDisplay", timeout=10000)
            time.sleep(2)

            # 2. Executive Dashboard
            print("\n[2/12] Capturing 02_executive_dashboard.png...")
            page.click("#nav-dashboard")
            time.sleep(2)
            page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "02_executive_dashboard.png"))
            print("  [SAVED] 02_executive_dashboard.png")

            # 3. Operations Tracker (All Team Tasks)
            print("\n[3/12] Capturing 03_operations_tracker.png...")
            page.click("#nav-operations")
            time.sleep(2)
            page.evaluate("if (typeof changeOperationsUserFilter === 'function') { changeOperationsUserFilter('all'); }")
            time.sleep(2)
            page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "03_operations_tracker.png"))
            print("  [SAVED] 03_operations_tracker.png")

            # 4. Customer Files (Table View)
            print("\n[4/12] Capturing 04_customer_files_table.png...")
            page.click("#nav-customer-files")
            time.sleep(2)
            page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "04_customer_files_table.png"))
            print("  [SAVED] 04_customer_files_table.png")

            # 5. Customer Files (Physical Box View)
            print("\n[5/12] Capturing 05_customer_files_physical_cabinets.png...")
            page.evaluate("if (typeof setCustomerViewMode === 'function') { setCustomerViewMode('boxes'); }")
            time.sleep(2)
            page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "05_customer_files_physical_cabinets.png"))
            print("  [SAVED] 05_customer_files_physical_cabinets.png")

            # 6. Financial Files Database
            print("\n[6/12] Capturing 06_financial_files_ledger.png...")
            page.click("#nav-financial-files")
            time.sleep(2)
            page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "06_financial_files_ledger.png"))
            print("  [SAVED] 06_financial_files_ledger.png")

            # 7. Financial Files Lightbox Inspection
            print("\n[7/12] Capturing 07_financial_files_lightbox.png...")
            page.evaluate("openPhotoLightbox('Register_01_Remi_Dream_Lanka.jpeg', 'Register 01: Remi Dream Lanka - Digitized Physical Ledger')")
            time.sleep(2)
            page.wait_for_selector("#photoLightbox:not(.hidden)", timeout=5000)
            page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "07_financial_files_lightbox.png"))
            print("  [SAVED] 07_financial_files_lightbox.png")
            page.evaluate("if (typeof closePhotoLightbox === 'function') { closePhotoLightbox(); }")
            time.sleep(1)

            # 8. Payroll Dual-Currency Salary Sheet
            print("\n[8/12] Capturing 08_payroll_dual_currency_sheet.png...")
            page.click("#nav-payroll")
            time.sleep(2)
            page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "08_payroll_dual_currency_sheet.png"))
            print("  [SAVED] 08_payroll_dual_currency_sheet.png")

            # 9. Bank Remittance Request Letter
            print("\n[9/12] Capturing 09_bank_remittance_letter.png...")
            page.evaluate("if (typeof switchPayrollSubTab === 'function') { switchPayrollSubTab('letter'); }")
            time.sleep(2)
            page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "09_bank_remittance_letter.png"))
            print("  [SAVED] 09_bank_remittance_letter.png")

            # 10. Individual Payslip Vouchers
            print("\n[10/12] Capturing 10_individual_payslips.png...")
            page.evaluate("if (typeof switchPayrollSubTab === 'function') { switchPayrollSubTab('slips'); }")
            time.sleep(2)
            page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "10_individual_payslips.png"))
            print("  [SAVED] 10_individual_payslips.png")

            # 11. Access Control Center
            print("\n[11/12] Capturing 11_access_control_governance.png...")
            page.click("#nav-access-control")
            time.sleep(2)
            page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "11_access_control_governance.png"))
            print("  [SAVED] 11_access_control_governance.png")

            # 12. Period Management Hub Modal
            print("\n[12/12] Capturing 12_period_management_hub.png...")
            page.click("#nav-payroll")
            time.sleep(2)
            page.click("button:has-text('Staff Payroll Sheet (Dual Table)')")
            time.sleep(1)
            page.click("button:has-text('New Period')")
            time.sleep(1.5)
            page.wait_for_selector("#modalBackdrop:not(.hidden)", timeout=5000)
            page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "12_period_management_hub.png"))
            print("  [SAVED] 12_period_management_hub.png")

            browser.close()
            print("\n" + "=" * 68)
            print("  ALL 12 HIGH-RESOLUTION SCREENSHOTS GENERATED SUCCESSFULLY!  ")
            print("=" * 68)

    finally:
        print("[INFO] Shutting down Edge...")
        try:
            edge_proc.terminate()
            edge_proc.wait(timeout=5)
        except Exception:
            pass

if __name__ == "__main__":
    main()
