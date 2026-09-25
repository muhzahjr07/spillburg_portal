@echo off
title Spillburg Holdings - Master Enterprise Portal
cls
echo ===============================================================================
echo            SPILLBURG HOLDINGS (PVT) LTD - ENTERPRISE PORTAL
echo ===============================================================================
echo.
echo  Corporate Hub, Operations Tracker, Customer Files & Financial Databases
echo.
echo  Starting server at: http://127.0.0.1:8080 (or your LAN IP:8080)
echo.
echo  Key Credentials:
echo    - Admin (Zaharan):    zaharan      / admin123
echo    - System Admin:       admin        / admin123
echo    - Executive Director: director     / director123
echo    - Managing Director:  hameez       / spillburg123
echo    - Operations Director: shameel     / spillburg123
echo    - Staff Members:      staff_editor / staff123 (or custom credentials)
echo.
echo ===============================================================================

:: Auto-open browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8080"

:: Launch Python Server
python "%~dp0server.py" 8080

echo.
echo Portal server stopped.
pause
