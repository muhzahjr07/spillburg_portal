param(
    [Parameter(Mandatory=$true)]
    [string]$Action,
    [string]$PayloadJson = "",
    [string]$DbPath = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
if (-not $DbPath) {
    $activePath = Join-Path $ScriptDir "customer_file_db\Customer_Files_Active.accdb"
    if (Test-Path $activePath) {
        $DbPath = $activePath
    } else {
        $DbPath = Join-Path $ScriptDir "customer_file_db\Office File Register.accdb"
    }
}
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$DbPath;Persist Security Info=False;"

function Get-DbConnection {
    $conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
    $conn.Open()
    return $conn
}

function Execute-Query {
    param([string]$Query, [array]$Parameters = @())
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
                $row[$col] = if ($val -is [DBNull]) { $null } else { [string]$val }
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
    param([string]$Query, [array]$Parameters = @())
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

try {
    switch ($Action) {
        "GetRecords" {
            $query = "SELECT [No], [Registration No], [Company Name], [Type], [Category], [Cupboard], [Box No], [Date of Incorporation] FROM [File Register] WHERE [Company Name] IS NOT NULL AND [Company Name] <> '' ORDER BY [Company Name] ASC"
            $records = Execute-Query $query
            $out = @{
                success = $true
                total = $records.Count
                records = $records
            }
            $out | ConvertTo-Json -Depth 5 -Compress
        }

        "GetStats" {
            $records = Execute-Query "SELECT [No], [Type], [Cupboard], [Box No], [Company Name] FROM [File Register] WHERE [Company Name] IS NOT NULL AND [Company Name] <> ''"
            $orig = ($records | Where-Object { $_["Type"] -like "*Original*" }).Count
            $copy = ($records | Where-Object { $_["Type"] -like "*Copy*" -or $_["Type"] -like "*Customer*" }).Count
            $cupboards = ($records | ForEach-Object { $_["Cupboard"] } | Where-Object { $_ } | Select-Object -Unique)
            $companies = ($records | ForEach-Object { $_["Company Name"] } | Where-Object { $_ } | Select-Object -Unique)
            
            $out = @{
                success = $true
                totalRecords = $records.Count
                originalCount = $orig
                copyCount = $copy
                uniqueCompaniesCount = $companies.Count
                cupboards = $cupboards
            }
            $out | ConvertTo-Json -Depth 5 -Compress
        }

        "AddRecord" {
            $data = $PayloadJson | ConvertFrom-Json
            $recNo = if ($data.No) { [string]$data.No } else { Get-NextRecordNo }
            $insertQ = "INSERT INTO [File Register] ([No], [Registration No], [Company Name], [Type], [Category], [Cupboard], [Box No], [Date of Incorporation]) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            Execute-NonQuery $insertQ @($recNo, $data.'Registration No', $data.'Company Name', $data.Type, $data.Category, $data.Cupboard, $data.'Box No', $data.'Date of Incorporation') | Out-Null
            
            $out = @{
                success = $true
                message = "Record added successfully"
                recordNo = $recNo
            }
            $out | ConvertTo-Json -Compress
        }

        "DualOnboard" {
            $data = $PayloadJson | ConvertFrom-Json
            $no1 = Get-NextRecordNo
            $no2 = [string]([int]$no1 + 1)

            $q = "INSERT INTO [File Register] ([No], [Registration No], [Company Name], [Type], [Category], [Cupboard], [Box No], [Date of Incorporation]) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            
            # Original File
            Execute-NonQuery $q @($no1, $data.regNo, $data.companyName, "Original", "Original Files", $data.originalCupboard, $data.originalBox, $data.dateOfIncorporation) | Out-Null
            # Customer Copy
            Execute-NonQuery $q @($no2, $data.regNo, $data.companyName, "Copy", "Customer Files", $data.copyCupboard, $data.copyBox, $data.dateOfIncorporation) | Out-Null

            $out = @{
                success = $true
                message = "Dual file records created successfully"
                originalNo = $no1
                copyNo = $no2
            }
            $out | ConvertTo-Json -Compress
        }

        "UpdateRecord" {
            $data = $PayloadJson | ConvertFrom-Json
            $q = "UPDATE [File Register] SET [Registration No] = ?, [Company Name] = ?, [Type] = ?, [Category] = ?, [Cupboard] = ?, [Box No] = ?, [Date of Incorporation] = ? WHERE [No] = ?"
            Execute-NonQuery $q @($data.'Registration No', $data.'Company Name', $data.Type, $data.Category, $data.Cupboard, $data.'Box No', $data.'Date of Incorporation', [string]$data.No) | Out-Null
            
            $out = @{
                success = $true
                message = "Record updated successfully"
            }
            $out | ConvertTo-Json -Compress
        }

        "DeleteRecord" {
            $data = $PayloadJson | ConvertFrom-Json
            $q = "DELETE FROM [File Register] WHERE [No] = ?"
            Execute-NonQuery $q @([string]$data.No) | Out-Null
            
            $out = @{
                success = $true
                message = "Record deleted successfully"
            }
            $out | ConvertTo-Json -Compress
        }

        "Backup" {
            $backupsDir = Join-Path (Split-Path $DbPath) "backups"
            if (-not (Test-Path $backupsDir)) { New-Item -ItemType Directory -Path $backupsDir -Force | Out-Null }
            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
            $backupFileName = "Office_File_Register_backup_$timestamp.accdb"
            $dest = Join-Path $backupsDir $backupFileName
            Copy-Item -Path $DbPath -Destination $dest -Force
            
            $out = @{
                success = $true
                filename = $backupFileName
                sizeBytes = (Get-Item $dest).Length
                created = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            }
            $out | ConvertTo-Json -Compress
        }

        default {
            @{ success = $false; error = "Unknown action $Action" } | ConvertTo-Json -Compress
        }
    }
} catch {
    @{
        success = $false
        error = $_.Exception.Message
    } | ConvertTo-Json -Compress
}
