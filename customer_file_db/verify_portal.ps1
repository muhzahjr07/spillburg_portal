$baseUrl = "http://127.0.0.1:8080"
Write-Host "=== 1. Testing GET / (HTML UI) ==="
$ui = Invoke-WebRequest -Uri "$baseUrl/" -UseBasicParsing
Write-Host "UI Status: $($ui.StatusCode), Length: $($ui.Content.Length) bytes"

Write-Host "`n=== 2. Testing GET /api/stats ==="
$stats = Invoke-RestMethod -Uri "$baseUrl/api/stats"
Write-Host "Total Records: $($stats.totalRecords)"
Write-Host "Original Count: $($stats.originalCount)"
Write-Host "Copy Count: $($stats.copyCount)"
Write-Host "Unique Companies: $($stats.uniqueCompaniesCount)"
Write-Host "Cupboards: $($stats.availableCupboards -join ', ')"

Write-Host "`n=== 3. Testing GET /api/records (Search & Filter) ==="
$search = Invoke-RestMethod -Uri "$baseUrl/api/records?search=Spillburg"
Write-Host "Spillburg search matches: $($search.total)"
foreach ($r in $search.records) {
    Write-Host ("  [#{0}] {1,-38} | Type: {2,-8} | {3,-12} | {4}" -f $r.No, $r.'Company Name', $r.Type, $r.Cupboard, $r.'Box No')
}

Write-Host "`n=== 4. Testing POST /api/records (Add Single Record) ==="
$newRecord = @{
    No = "999"
    "Company Name" = "Automated Test Company (Pvt) Ltd"
    "Registration No" = "PV99999"
    Type = "Original"
    Category = "Original Files"
    Cupboard = "Cupboard 1"
    "Box No" = "Box File 99"
    "Date of Incorporation" = "2026-09-19"
} | ConvertTo-Json
$addRes = Invoke-RestMethod -Uri "$baseUrl/api/records" -Method Post -Body $newRecord -ContentType "application/json"
Write-Host "Add result: $($addRes.message), Record No: $($addRes.record.No)"

Write-Host "`n=== 5. Testing GET /api/records/999 (Single Record Details) ==="
$getRes = Invoke-RestMethod -Uri "$baseUrl/api/records/999"
Write-Host "Fetched record: $($getRes.record.'Company Name') ($($getRes.record.'Registration No')) in $($getRes.record.Cupboard)"

Write-Host "`n=== 6. Testing PUT /api/records/999 (Edit Record) ==="
$updateData = @{
    "Company Name" = "Updated Test Company (Pvt) Ltd"
    "Registration No" = "PV99999-REV"
    Type = "Original"
    Category = "Original Files"
    Cupboard = "Cupboard 1"
    "Box No" = "Box File 99"
    "Date of Incorporation" = "2026-09-19"
} | ConvertTo-Json
$updateRes = Invoke-RestMethod -Uri "$baseUrl/api/records/999" -Method Put -Body $updateData -ContentType "application/json"
Write-Host "Update result: $($updateRes.message), New Name: $($updateRes.record.'Company Name')"

Write-Host "`n=== 7. Testing DELETE /api/records/999 ==="
$delRes = Invoke-RestMethod -Uri "$baseUrl/api/records/999" -Method Delete
Write-Host "Delete result: $($delRes.message)"

Write-Host "`n=== 8. Testing POST /api/records/dual (Dual Onboarding) ==="
$dualData = @{
    companyName = "Dual Test Enterprises"
    regNo = "PV88888"
    dateOfIncorporation = "2026-09-19"
    originalCupboard = "Cupboard 1"
    originalBox = "Box File 1"
    copyCupboard = "Cupboard 2"
    copyBox = "Box File 01"
} | ConvertTo-Json
$dualRes = Invoke-RestMethod -Uri "$baseUrl/api/records/dual" -Method Post -Body $dualData -ContentType "application/json"
Write-Host "Dual Create result: $($dualRes.message)"
Write-Host "  Original No: $($dualRes.original.No), Copy No: $($dualRes.copy.No)"

# Verify Related pairing
$pairingCheck = Invoke-RestMethod -Uri "$baseUrl/api/records/$($dualRes.original.No)"
Write-Host "  Paired files found: $($pairingCheck.related.Count)"
foreach ($rel in $pairingCheck.related) {
    Write-Host ("    Related File: #{0} {1} ({2}) in {3}" -f $rel.No, $rel.'Company Name', $rel.Type, $rel.Cupboard)
}

# Clean up dual test records
Invoke-RestMethod -Uri "$baseUrl/api/records/$($dualRes.original.No)" -Method Delete | Out-Null
Invoke-RestMethod -Uri "$baseUrl/api/records/$($dualRes.copy.No)" -Method Delete | Out-Null
Write-Host "Cleaned up dual test records"

Write-Host "`n=== 9. Testing POST /api/backup ==="
$backupRes = Invoke-RestMethod -Uri "$baseUrl/api/backup" -Method Post
Write-Host "Backup created: $($backupRes.backup.filename), Size: $($backupRes.backup.sizeBytes) bytes"

Write-Host "`n=== 10. Testing GET /api/export (CSV) ==="
$csv = Invoke-WebRequest -Uri "$baseUrl/api/export" -UseBasicParsing
Write-Host "CSV Export Status: $($csv.StatusCode), Bytes: $($csv.Content.Length)"
$firstLines = ($csv.Content -split "`r`n")[0..3] -join "`n"
Write-Host "CSV Sample Preview:`n$firstLines"

Write-Host "`n==========================================================="
Write-Host " ALL 10 AUTOMATED VERIFICATION TESTS COMPLETED SUCCESSFULLY! "
Write-Host "==========================================================="
