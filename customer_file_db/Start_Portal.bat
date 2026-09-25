@echo off
title Office File Register Portal - Customer Database
cls
echo =====================================================================
echo           OFFICE FILE REGISTER - CUSTOMER DATABASE PORTAL            
echo =====================================================================
echo.
echo  Database: Office File Register.accdb
echo  Starting local web portal on http://127.0.0.1:8080 ...
echo.

:: Open default browser after 2 seconds in background
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8080"

:: Start the 32-bit PowerShell backend server (matches Access 32-bit OLEDB driver)
C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8080

echo.
echo Server stopped.
pause
