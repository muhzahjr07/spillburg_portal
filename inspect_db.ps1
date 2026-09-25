$connStr = 'Provider=Microsoft.ACE.OLEDB.16.0;Data Source=c:\Users\User\Desktop\Zaharan\projects\company_portal\customer_file_db\Office File Register.accdb;Persist Security Info=False;'
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = 'SELECT DISTINCT [Company Name], [Registration No], [Date of Incorporation] FROM [File Register] WHERE [Company Name] IS NOT NULL'
$reader = $cmd.ExecuteReader()
$list = @()
while ($reader.Read()) {
    $list += [PSCustomObject]@{
        CompanyName = [string]$reader['Company Name']
        RegNo = [string]$reader['Registration No']
        DateOfIncorp = [string]$reader['Date of Incorporation']
    }
}
$conn.Close()

Write-Host "Total unique companies in Access DB: $($list.Count)"
$list | Select-Object -First 35 | ForEach-Object {
    Write-Host "$($_.CompanyName) | $($_.RegNo) | $($_.DateOfIncorp)"
}
