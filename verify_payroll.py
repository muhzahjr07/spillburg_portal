import sys
import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8080"

def get_auth_token(username, password):
    url = f"{BASE_URL}/api/auth/login"
    data = json.dumps({"username": username, "password": password}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode('utf-8'))
        return res["token"]

def run_tests():
    print("=" * 70)
    print("   SPILLBURG HOLDINGS - PAYROLL & BANK REMITTANCE TEST SUITE")
    print("=" * 70)

    token = get_auth_token("director", "director123")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Letterhead Asset Verification
    print("\n--- 1. Testing Letterhead Static Asset ---")
    lh_req = urllib.request.Request(f"{BASE_URL}/spillburg_letterhead.jpg")
    with urllib.request.urlopen(lh_req) as lh_res:
        assert lh_res.status == 200, "Letterhead image failed to load"
        lh_bytes = lh_res.read()
        assert len(lh_bytes) > 50000, f"Letterhead image too small: {len(lh_bytes)} bytes"
        print(f"  [PASS] Letterhead image served ({len(lh_bytes)} bytes)")

    # 2. GET /api/payroll
    print("\n--- 2. Testing Payroll Overview & Calculations ---")
    req = urllib.request.Request(f"{BASE_URL}/api/payroll", headers=headers)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        active = data.get("activePeriod")
        assert active is not None, "Missing activePeriod"
        assert active["month"] == "September 2026", f"Unexpected active month: {active.get('month')}"
        
        employees = active.get("employees", [])
        assert len(employees) == 10, f"Expected 10 employees, got {len(employees)}"
        print(f"  [PASS] Active period: {active['month']} with {len(employees)} employees")

        totals = active.get("totals", {})
        print("  Calculated Totals:", json.dumps(totals, indent=2))

        # Check exact totals matching September 2026 excel/PDF (Row 39)
        assert totals["sumGbpSalary"] == 18014.47, f"GBP Salary mismatch: {totals['sumGbpSalary']}"
        assert totals["sumEarnedGbp"] == 17347.51, f"Earned GBP mismatch: {totals['sumEarnedGbp']}"
        assert totals["sumLkrGross"] == 7632905.0, f"LKR Gross mismatch: {totals['sumLkrGross']}"
        assert totals["sumEpf8Lkr"] == 610632.0, f"EPF 8% mismatch: {totals['sumEpf8Lkr']}"
        assert totals["sumEpf12Lkr"] == 915950.0, f"EPF 12% mismatch: {totals['sumEpf12Lkr']}"
        assert totals["sumApitLkr"] == 1807846.0, f"APIT mismatch: {totals['sumApitLkr']}"
        assert totals["sumNetSalaryLkr"] == 5214427.0, f"Net Remittance mismatch: {totals['sumNetSalaryLkr']}"
        print("  [PASS] Statutory totals match APADMI SL September 2026 salary sheet exactly!")
        print("         Total Net Remittance to Bank: Rs 5,214,427.00")

        # Check Kushani's partial days and calculations
        kushani = next(e for e in employees if "kushani" in e["name"].lower())
        assert kushani["workDays"] == "17 D", f"Kushani workDays mismatch: {kushani['workDays']}"
        assert kushani["earnedGbp"] == 872.19, f"Kushani earned GBP mismatch: {kushani['earnedGbp']}"
        assert kushani["lkrGross"] == 383764.0, f"Kushani gross mismatch: {kushani['lkrGross']}"
        assert kushani["epf8Lkr"] == 30701.0, f"Kushani EPF 8% mismatch: {kushani['epf8Lkr']}"
        assert kushani["apit"] == 44155.0, f"Kushani APIT mismatch: {kushani['apit']}"
        assert kushani["netSalaryLkr"] == 308908.0, f"Kushani Net Salary mismatch: {kushani['netSalaryLkr']}"
        print("  [PASS] Partial month deduction verified (Kushani: 17 D -> Net Rs 308,908.00)")

    # 3. GET /api/payroll/export-csv
    print("\n--- 3. Testing Payroll CSV Export ---")
    csv_req = urllib.request.Request(f"{BASE_URL}/api/payroll/export-csv?id=period_2026_09", headers=headers)
    with urllib.request.urlopen(csv_req) as csv_resp:
        assert csv_resp.status == 200, "CSV export failed"
        csv_text = csv_resp.read().decode('utf-8')
        assert "SALARY SHEET (IN GBP ) - SEPTEMBER 2026" in csv_text
        assert "SALARY SHEET (IN LKR) - SEPTEMBER 2026 @ 440" in csv_text
        assert "5214427" in csv_text
        assert "wikum" in csv_text.lower()
        print("  [PASS] Export CSV delivered with dual tables and exact totals")

    # 4. Exchange Rate Modification & Live Recalculation
    print("\n--- 4. Testing Live Exchange Rate Adjustment ---")
    orig_rate = active["exchangeRate"]
    new_rate = 450.0
    put_data = json.dumps({"id": active["id"], "exchangeRate": new_rate}).encode('utf-8')
    put_req = urllib.request.Request(f"{BASE_URL}/api/payroll/period", data=put_data, headers={"Content-Type": "application/json", **headers}, method="PUT")
    with urllib.request.urlopen(put_req) as put_res:
        assert put_res.status == 200
        p_upd = json.loads(put_res.read().decode('utf-8'))["period"]
        assert p_upd["exchangeRate"] == 450.0
        # Recalculated gross at 450
        print(f"  [PASS] Rate updated to 450.0. Recalculated Net Remittance: Rs {p_upd['totals']['sumNetSalaryLkr']:,.2f}")

    # Restore original rate 440.0
    restore_data = json.dumps({"id": active["id"], "exchangeRate": orig_rate}).encode('utf-8')
    res_req = urllib.request.Request(f"{BASE_URL}/api/payroll/period", data=restore_data, headers={"Content-Type": "application/json", **headers}, method="PUT")
    with urllib.request.urlopen(res_req) as res_res:
        assert res_res.status == 200
        p_rest = json.loads(res_res.read().decode('utf-8'))["period"]
        assert p_rest["totals"]["sumNetSalaryLkr"] == 5214427.0
        print("  [PASS] Original rate 440.0 restored (Net Remittance back to Rs 5,214,427.00)")

    print("\n" + "=" * 70)
    print(" ALL PAYROLL TESTS PASSED SUCCESSFULLY! ")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
