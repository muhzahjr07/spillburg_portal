param(
    [int]$Port = 8080,
    [string]$DbPath = "$PSScriptRoot\Office File Register.accdb"
)

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$PublicDir = Join-Path $ScriptDir "public"
$BackupsDir = Join-Path $ScriptDir "backups"

if (-not (Test-Path $BackupsDir)) {
    New-Item -ItemType Directory -Path $BackupsDir -Force | Out-Null
}

$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$DbPath;Persist Security Info=False;"

function Get-DbConnection {
    $conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
    $conn.Open()
    return $conn
}

function Execute-Query {
    param(
        [string]$Query,
        [array]$Parameters = @()
    )
    $conn = Get-DbConnection
    try {
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $Query
        foreach ($p in $Parameters) {
            $val = if ($null -eq $p) { [DBNull]::Value } else { $p }
            $cmd.Parameters.AddWithValue("?", $val) | Out-Null
        }
        $reader = $cmd.ExecuteReader()
        $results = [System.Collections.ArrayList]@()
        while ($reader.Read()) {
            $row = [ordered]@{}
            for ($i = 0; $i -lt $reader.FieldCount; $i++) {
                $col = $reader.GetName($i)
                $val = $reader.GetValue($i)
                if ($val -is [DBNull]) {
                    $row[$col] = $null
                } else {
                    $row[$col] = [string]$val
                }
            }
            [void]$results.Add($row)
        }
        $reader.Close()
        return ,$results
    } finally {
        $conn.Close()
    }
}

function Execute-NonQuery {
    param(
        [string]$Query,
        [array]$Parameters = @()
    )
    $conn = Get-DbConnection
    try {
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $Query
        foreach ($p in $Parameters) {
            $val = if ($null -eq $p) { [DBNull]::Value } else { $p }
            $cmd.Parameters.AddWithValue("?", $val) | Out-Null
        }
        return $cmd.ExecuteNonQuery()
    } finally {
        $conn.Close()
    }
}

function Get-NextRecordNo {
    $rows = Execute-Query "SELECT [No] FROM [File Register] WHERE [No] IS NOT NULL"
    $maxNo = 0
    foreach ($r in $rows) {
        $val = $r["No"]
        if ($val -match "^\d+$") {
            $n = [int]$val
            if ($n -gt $maxNo) { $maxNo = $n }
        }
    }
    return [string]($maxNo + 1)
}

function Create-Backup {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFileName = "Office_File_Register_backup_$timestamp.accdb"
    $dest = Join-Path $BackupsDir $backupFileName
    Copy-Item -Path $DbPath -Destination $dest -Force
    return @{
        filename = $backupFileName
        created = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        sizeBytes = (Get-Item $dest).Length
    }
}

function Get-AllBackups {
    $files = Get-ChildItem -Path $BackupsDir -Filter "*.accdb" | Sort-Object LastWriteTime -Descending
    $list = [System.Collections.ArrayList]@()
    foreach ($f in $files) {
        [void]$list.Add([ordered]@{
            filename = $f.Name
            sizeBytes = $f.Length
            lastModified = $f.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        })
    }
    return $list
}

function Send-JsonResponse {
    param(
        [System.Net.HttpListenerResponse]$Response,
        $Data,
        [int]$StatusCode = 200
    )
    $json = $Data | ConvertTo-Json -Depth 10 -Compress
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "application/json; charset=utf-8"
    $Response.Headers.Add("Access-Control-Allow-Origin", "*")
    $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
    $Response.ContentLength64 = $buffer.Length
    $Response.OutputStream.Write($buffer, 0, $buffer.Length)
    $Response.OutputStream.Close()
}

function Send-FileResponse {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [string]$FilePath,
        [string]$ContentType = "text/html; charset=utf-8"
    )
    if (Test-Path $FilePath) {
        $bytes = [System.IO.File]::ReadAllBytes($FilePath)
        $Response.StatusCode = 200
        $Response.ContentType = $ContentType
        $Response.ContentLength64 = $bytes.Length
        $Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $Response.OutputStream.Close()
    } else {
        $Response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("File Not Found")
        $Response.OutputStream.Write($msg, 0, $msg.Length)
        $Response.OutputStream.Close()
    }
}

function Send-CsvResponse {
    param(
        [System.Net.HttpListenerResponse]$Response,
        $Records,
        [string]$Filename = "Office_File_Register.csv"
    )
    $csvBuilder = New-Object System.Text.StringBuilder
    [void]$csvBuilder.AppendLine('"No","Registration No","Company Name","Type","Category","Cupboard","Box No","Date of Incorporation"')
    foreach ($r in $Records) {
        $no = ($r["No"] -replace '"', '""')
        $reg = ($r["Registration No"] -replace '"', '""')
        $comp = ($r["Company Name"] -replace '"', '""')
        $type = ($r["Type"] -replace '"', '""')
        $cat = ($r["Category"] -replace '"', '""')
        $cup = ($r["Cupboard"] -replace '"', '""')
        $box = ($r["Box No"] -replace '"', '""')
        $date = ($r["Date of Incorporation"] -replace '"', '""')
        [void]$csvBuilder.AppendLine("`"$no`",`"$reg`",`"$comp`",`"$type`",`"$cat`",`"$cup`",`"$box`",`"$date`"")
    }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($csvBuilder.ToString())
    $Response.StatusCode = 200
    $Response.ContentType = "text/csv; charset=utf-8"
    $Response.Headers.Add("Content-Disposition", "attachment; filename=`"$Filename`"")
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.OutputStream.Close()
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "==========================================================="
    Write-Host " Office File Register Management Portal Server Started!    "
    Write-Host " Local Address: $prefix"
    Write-Host " Database:      $DbPath"
    Write-Host " Press Ctrl+C in this console to stop the server.         "
    Write-Host "==========================================================="
} catch {
    Write-Error "Failed to start HTTP server on ${prefix}: $($_.Exception.Message)"
    exit 1
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $httpMethod = $request.HttpMethod
        $rawUrl = $request.RawUrl
        $path = $request.Url.AbsolutePath

        # Handle CORS preflight
        if ($httpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
            $response.OutputStream.Close()
            continue
        }

        # Parse request body if any
        $bodyJson = $null
        if ($request.HasEntityBody) {
            $streamReader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $bodyText = $streamReader.ReadToEnd()
            $streamReader.Close()
            if ($bodyText -and $bodyText.Trim().Length -gt 0) {
                try {
                    $bodyJson = $bodyText | ConvertFrom-Json
                } catch {
                    $bodyJson = $null
                }
            }
        }

        # Route matching
        if ($path -eq "/" -or $path -eq "/index.html") {
            Send-FileResponse -Response $response -FilePath (Join-Path $PublicDir "index.html") -ContentType "text/html; charset=utf-8"
        }
        elseif ($path.StartsWith("/public/")) {
            $relPath = $path.Substring(8)
            $filePath = Join-Path $PublicDir $relPath
            $ct = "application/octet-stream"
            if ($filePath.EndsWith(".css")) { $ct = "text/css; charset=utf-8" }
            elseif ($filePath.EndsWith(".js")) { $ct = "application/javascript; charset=utf-8" }
            elseif ($filePath.EndsWith(".svg")) { $ct = "image/svg+xml" }
            elseif ($filePath.EndsWith(".png")) { $ct = "image/png" }
            Send-FileResponse -Response $response -FilePath $filePath -ContentType $ct
        }
        elseif ($path -eq "/api/records" -and $httpMethod -eq "GET") {
            $q = "SELECT [No], [Registration No], [Company Name], [Type], [Category], [Cupboard], [Box No], [Date of Incorporation] FROM [File Register] WHERE [Company Name] IS NOT NULL AND [Company Name] <> ''"
            $records = Execute-Query $q

            # Query params filters
            $query = $request.Url.Query
            $parsedQuery = [System.Web.HttpUtility]::ParseQueryString($query)
            $search = $parsedQuery["search"]
            $typeFilter = $parsedQuery["type"]
            $cupboardFilter = $parsedQuery["cupboard"]
            $boxFilter = $parsedQuery["box"]

            $filtered = [System.Collections.ArrayList]@()
            foreach ($r in $records) {
                $match = $true

                if ($typeFilter -and $typeFilter -ne "All" -and $r["Type"] -ne $typeFilter) {
                    $match = $false
                }
                if ($cupboardFilter -and $cupboardFilter -ne "All" -and $r["Cupboard"] -ne $cupboardFilter) {
                    $match = $false
                }
                if ($boxFilter -and $boxFilter -ne "All" -and $r["Box No"] -ne $boxFilter) {
                    $match = $false
                }
                if ($search -and $search.Trim().Length -gt 0) {
                    $st = $search.Trim().ToLower()
                    $hasSearch = ($r["Company Name"] -and $r["Company Name"].ToLower().Contains($st)) -or `
                                 ($r["Registration No"] -and $r["Registration No"].ToLower().Contains($st)) -or `
                                 ($r["Box No"] -and $r["Box No"].ToLower().Contains($st)) -or `
                                 ($r["Cupboard"] -and $r["Cupboard"].ToLower().Contains($st)) -or `
                                 ($r["No"] -and $r["No"].ToLower().Contains($st))
                    if (-not $hasSearch) { $match = $false }
                }

                if ($match) {
                    [void]$filtered.Add($r)
                }
            }

            # Sort by numeric No descending or ascending
            $sort = $parsedQuery["sort"]
            if ($sort -eq "no_desc") {
                $filtered = [System.Collections.ArrayList]($filtered | Sort-Object { if ($_.No -match '^\d+$') { [int]$_.No } else { 0 } } -Descending)
            } else {
                $filtered = [System.Collections.ArrayList]($filtered | Sort-Object { if ($_.No -match '^\d+$') { [int]$_.No } else { 0 } })
            }

            Send-JsonResponse -Response $response -Data @{
                total = $filtered.Count
                records = $filtered
            }
        }
        elseif ($path -match "^/api/records/([^/]+)$" -and $httpMethod -eq "GET") {
            $recordNo = $matches[1]
            $queryRes = Execute-Query "SELECT [No], [Registration No], [Company Name], [Type], [Category], [Cupboard], [Box No], [Date of Incorporation] FROM [File Register] WHERE [No] = ?" @($recordNo)
            $flatRows = [System.Collections.ArrayList]@()
            foreach ($elem in $queryRes) {
                if ($elem -is [System.Collections.IList]) {
                    foreach ($sub in $elem) { [void]$flatRows.Add($sub) }
                } else {
                    [void]$flatRows.Add($elem)
                }
            }
            if ($flatRows.Count -gt 0) {
                $item = $flatRows[0]
                $relatedList = [System.Collections.ArrayList]@()
                if ($item["Registration No"]) {
                    $relRes = Execute-Query "SELECT [No], [Registration No], [Company Name], [Type], [Category], [Cupboard], [Box No], [Date of Incorporation] FROM [File Register] WHERE [Registration No] = ? AND [No] <> ?" @($item["Registration No"], $recordNo)
                    foreach ($r in $relRes) {
                        if ($r -is [System.Collections.IList]) {
                            foreach ($sub in $r) { [void]$relatedList.Add($sub) }
                        } else {
                            [void]$relatedList.Add($r)
                        }
                    }
                }
                Send-JsonResponse -Response $response -Data @{
                    record = $item
                    related = $relatedList
                }
            } else {
                Send-JsonResponse -Response $response -Data @{ error = "Record not found" } -StatusCode 404
            }
        }
        elseif ($path -eq "/api/records" -and $httpMethod -eq "POST") {
            if (-not $bodyJson) {
                Send-JsonResponse -Response $response -Data @{ error = "Invalid JSON body" } -StatusCode 400
                continue
            }

            $compName = [string]$bodyJson.'Company Name'
            if ([string]::IsNullOrWhiteSpace($compName)) {
                $compName = [string]$bodyJson.companyName
            }
            if ([string]::IsNullOrWhiteSpace($compName)) {
                Send-JsonResponse -Response $response -Data @{ error = "Company Name is required" } -StatusCode 400
                continue
            }

            $regNo = [string]$bodyJson.'Registration No'
            if ([string]::IsNullOrEmpty($regNo)) { $regNo = [string]$bodyJson.regNo }

            $type = [string]$bodyJson.'Type'
            if ([string]::IsNullOrEmpty($type)) { $type = [string]$bodyJson.type }
            if ([string]::IsNullOrEmpty($type)) { $type = "Original" }

            $cat = [string]$bodyJson.'Category'
            if ([string]::IsNullOrEmpty($cat)) { $cat = [string]$bodyJson.category }
            if ([string]::IsNullOrEmpty($cat)) {
                $cat = if ($type -eq "Original") { "Original Files" } else { "Customer Files" }
            }

            $cupboard = [string]$bodyJson.'Cupboard'
            if ([string]::IsNullOrEmpty($cupboard)) { $cupboard = [string]$bodyJson.cupboard }

            $boxNo = [string]$bodyJson.'Box No'
            if ([string]::IsNullOrEmpty($boxNo)) { $boxNo = [string]$bodyJson.boxNo }

            $dateInc = [string]$bodyJson.'Date of Incorporation'
            if ([string]::IsNullOrEmpty($dateInc)) { $dateInc = [string]$bodyJson.dateOfIncorporation }

            $no = [string]$bodyJson.'No'
            if ([string]::IsNullOrEmpty($no)) { $no = [string]$bodyJson.no }
            if ([string]::IsNullOrWhiteSpace($no)) {
                $no = Get-NextRecordNo
            }

            $sql = "INSERT INTO [File Register] ([No], [Registration No], [Company Name], [Type], [Category], [Cupboard], [Box No], [Date of Incorporation]) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            $affected = Execute-NonQuery $sql @($no, $regNo, $compName, $type, $cat, $cupboard, $boxNo, $dateInc)

            Send-JsonResponse -Response $response -Data @{
                success = $true
                message = "Record added successfully"
                record = [ordered]@{
                    "No" = $no
                    "Registration No" = $regNo
                    "Company Name" = $compName
                    "Type" = $type
                    "Category" = $cat
                    "Cupboard" = $cupboard
                    "Box No" = $boxNo
                    "Date of Incorporation" = $dateInc
                }
            } -StatusCode 201
        }
        elseif ($path -eq "/api/records/dual" -and $httpMethod -eq "POST") {
            # Add both Original and Copy for a new company onboarding
            if (-not $bodyJson) {
                Send-JsonResponse -Response $response -Data @{ error = "Invalid JSON body" } -StatusCode 400
                continue
            }

            $compName = [string]$bodyJson.companyName
            $regNo = [string]$bodyJson.regNo
            $dateInc = [string]$bodyJson.dateOfIncorporation
            $origCupboard = [string]$bodyJson.originalCupboard
            $origBox = [string]$bodyJson.originalBox
            $copyCupboard = [string]$bodyJson.copyCupboard
            $copyBox = [string]$bodyJson.copyBox

            if ([string]::IsNullOrWhiteSpace($compName)) {
                Send-JsonResponse -Response $response -Data @{ error = "Company Name is required" } -StatusCode 400
                continue
            }

            $firstNo = [int](Get-NextRecordNo)
            $secondNo = $firstNo + 1

            $sql = "INSERT INTO [File Register] ([No], [Registration No], [Company Name], [Type], [Category], [Cupboard], [Box No], [Date of Incorporation]) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            
            # Original Record
            Execute-NonQuery $sql @([string]$firstNo, $regNo, $compName, "Original", "Original Files", $origCupboard, $origBox, $dateInc) | Out-Null

            # Copy Record
            Execute-NonQuery $sql @([string]$secondNo, $regNo, $compName, "Copy", "Customer Files", $copyCupboard, $copyBox, $dateInc) | Out-Null

            Send-JsonResponse -Response $response -Data @{
                success = $true
                message = "Both Original and Customer File records created successfully!"
                original = [ordered]@{
                    "No" = [string]$firstNo
                    "Registration No" = $regNo
                    "Company Name" = $compName
                    "Type" = "Original"
                    "Category" = "Original Files"
                    "Cupboard" = $origCupboard
                    "Box No" = $origBox
                    "Date of Incorporation" = $dateInc
                }
                copy = [ordered]@{
                    "No" = [string]$secondNo
                    "Registration No" = $regNo
                    "Company Name" = $compName
                    "Type" = "Copy"
                    "Category" = "Customer Files"
                    "Cupboard" = $copyCupboard
                    "Box No" = $copyBox
                    "Date of Incorporation" = $dateInc
                }
            } -StatusCode 201
        }
        elseif ($path -match "^/api/records/([^/]+)$" -and $httpMethod -eq "PUT") {
            $recordNo = $matches[1]
            if (-not $bodyJson) {
                Send-JsonResponse -Response $response -Data @{ error = "Invalid JSON body" } -StatusCode 400
                continue
            }

            $compName = [string]$bodyJson.'Company Name'
            if ([string]::IsNullOrEmpty($compName)) { $compName = [string]$bodyJson.companyName }

            $regNo = [string]$bodyJson.'Registration No'
            if ([string]::IsNullOrEmpty($regNo)) { $regNo = [string]$bodyJson.regNo }

            $type = [string]$bodyJson.'Type'
            if ([string]::IsNullOrEmpty($type)) { $type = [string]$bodyJson.type }

            $cat = [string]$bodyJson.'Category'
            if ([string]::IsNullOrEmpty($cat)) { $cat = [string]$bodyJson.category }

            $cupboard = [string]$bodyJson.'Cupboard'
            if ([string]::IsNullOrEmpty($cupboard)) { $cupboard = [string]$bodyJson.cupboard }

            $boxNo = [string]$bodyJson.'Box No'
            if ([string]::IsNullOrEmpty($boxNo)) { $boxNo = [string]$bodyJson.boxNo }

            $dateInc = [string]$bodyJson.'Date of Incorporation'
            if ([string]::IsNullOrEmpty($dateInc)) { $dateInc = [string]$bodyJson.dateOfIncorporation }

            $sql = "UPDATE [File Register] SET [Registration No] = ?, [Company Name] = ?, [Type] = ?, [Category] = ?, [Cupboard] = ?, [Box No] = ?, [Date of Incorporation] = ? WHERE [No] = ?"
            $affected = Execute-NonQuery $sql @($regNo, $compName, $type, $cat, $cupboard, $boxNo, $dateInc, $recordNo)

            if ($affected -gt 0) {
                Send-JsonResponse -Response $response -Data @{
                    success = $true
                    message = "Record $recordNo updated successfully"
                    record = [ordered]@{
                        "No" = $recordNo
                        "Registration No" = $regNo
                        "Company Name" = $compName
                        "Type" = $type
                        "Category" = $cat
                        "Cupboard" = $cupboard
                        "Box No" = $boxNo
                        "Date of Incorporation" = $dateInc
                    }
                }
            } else {
                Send-JsonResponse -Response $response -Data @{ error = "Record $recordNo not found or not modified" } -StatusCode 404
            }
        }
        elseif ($path -match "^/api/records/([^/]+)$" -and $httpMethod -eq "DELETE") {
            $recordNo = $matches[1]
            $sql = "DELETE FROM [File Register] WHERE [No] = ?"
            $affected = Execute-NonQuery $sql @($recordNo)
            if ($affected -gt 0) {
                Send-JsonResponse -Response $response -Data @{
                    success = $true
                    message = "Record $recordNo deleted successfully"
                    deletedNo = $recordNo
                }
            } else {
                Send-JsonResponse -Response $response -Data @{ error = "Record $recordNo not found" } -StatusCode 404
            }
        }
        elseif ($path -eq "/api/stats" -and $httpMethod -eq "GET") {
            $all = Execute-Query "SELECT [No], [Registration No], [Company Name], [Type], [Category], [Cupboard], [Box No] FROM [File Register] WHERE [Company Name] IS NOT NULL AND [Company Name] <> ''"
            $origCount = 0
            $copyCount = 0
            $otherCount = 0
            $companies = [System.Collections.Generic.HashSet[string]]::new()
            $cupboards = @{}
            $boxes = @{}

            foreach ($r in $all) {
                if ($r["Type"] -eq "Original") { $origCount++ }
                elseif ($r["Type"] -eq "Copy") { $copyCount++ }
                else { $otherCount++ }

                if ($r["Company Name"]) {
                    [void]$companies.Add($r["Company Name"].Trim())
                }

                $cup = if ($r["Cupboard"]) { $r["Cupboard"].Trim() } else { "Unassigned" }
                if (-not $cupboards.ContainsKey($cup)) { $cupboards[$cup] = 0 }
                $cupboards[$cup]++

                $bx = if ($r["Box No"]) { $r["Box No"].Trim() } else { "Unassigned" }
                if (-not $boxes.ContainsKey($bx)) { $boxes[$bx] = 0 }
                $boxes[$bx]++
            }

            # Sorted unique lists for UI dropdowns
            $cupboardList = @($cupboards.Keys | Sort-Object)
            $boxList = @($boxes.Keys | Sort-Object)

            Send-JsonResponse -Response $response -Data @{
                totalRecords = $all.Count
                originalCount = $origCount
                copyCount = $copyCount
                otherCount = $otherCount
                uniqueCompaniesCount = $companies.Count
                cupboardBreakdown = $cupboards
                boxBreakdown = $boxes
                availableCupboards = $cupboardList
                availableBoxes = $boxList
            }
        }
        elseif ($path -eq "/api/backup" -and $httpMethod -eq "POST") {
            $backupInfo = Create-Backup
            $allBackups = Get-AllBackups
            Send-JsonResponse -Response $response -Data @{
                success = $true
                message = "Backup created successfully!"
                backup = $backupInfo
                backups = $allBackups
            }
        }
        elseif ($path -eq "/api/backups" -and $httpMethod -eq "GET") {
            $allBackups = Get-AllBackups
            Send-JsonResponse -Response $response -Data @{
                backups = $allBackups
            }
        }
        elseif ($path -eq "/api/export" -and $httpMethod -eq "GET") {
            $records = Execute-Query "SELECT [No], [Registration No], [Company Name], [Type], [Category], [Cupboard], [Box No], [Date of Incorporation] FROM [File Register] WHERE [Company Name] IS NOT NULL AND [Company Name] <> '' ORDER BY CLng([No])"
            Send-CsvResponse -Response $response -Records $records -Filename "Office_File_Register_$(Get-Date -Format 'yyyyMMdd_HHmm').csv"
        }
        else {
            Send-JsonResponse -Response $response -Data @{ error = "Endpoint not found: $path" } -StatusCode 404
        }
    }
    catch {
        Write-Warning "Error processing request: $($_.Exception.Message)"
        try {
            Send-JsonResponse -Response $context.Response -Data @{
                error = $_.Exception.Message
            } -StatusCode 500
        } catch { }
    }
}
