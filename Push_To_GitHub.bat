@echo off
title Push Spillburg Portal to GitHub for Render.com
cls
echo ===============================================================================
echo        SPILLBURG HOLDINGS - PUSH TO GITHUB (FOR RENDER.COM DEPLOYMENT)
echo ===============================================================================
echo.

set PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;%PATH%

:: Check existing git remote
for /f "tokens=*" %%i in ('git remote get-url origin 2^>nul') do set CURRENT_REMOTE=%%i

if not "%CURRENT_REMOTE%"=="" (
    echo Current GitHub Repository detected:
    echo   %CURRENT_REMOTE%
    echo.
    set /p USE_EXISTING="Use this repository? [Y/n] (or paste new URL): "
    if /i "%USE_EXISTING%"=="n" (
        set /p REPO_URL="Enter new GitHub Repository URL: "
    ) else if "%USE_EXISTING%"=="" (
        set REPO_URL=%CURRENT_REMOTE%
    ) else if /i "%USE_EXISTING%"=="y" (
        set REPO_URL=%CURRENT_REMOTE%
    ) else (
        set REPO_URL=%USE_EXISTING%
    )
) else (
    echo  Step 1: Open https://github.com/new in your browser and create a repository:
    echo         Repository name: spillburg-portal (or any name you choose)
    echo         Select: Public or Private
    echo         Do NOT initialize with README or .gitignore (already prepared)
    echo.
    echo  Step 2: Copy your repository URL from GitHub.
    echo         Example: https://github.com/YOUR_USERNAME/spillburg-portal.git
    echo.
    set /p REPO_URL="Enter your GitHub Repository URL: "
)

if "%REPO_URL%"=="" goto error

git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main

echo.
echo ===============================================================================
echo [PERSISTENCE STEP] Auto-saving and syncing latest backup data...
echo ===============================================================================
python -c "import server; server.auto_sync_latest_backup_to_data(force=True)"
git add -A
git diff --cached --quiet
if %ERRORLEVEL% neq 0 (
    echo Saving modified user accounts, operations tasks, payroll records, and backups to git...
    git commit -m "chore: save live portal data, passwords, tracker, payroll updates, and latest backup before deployment"
    echo [OK] Live database, backup files, and portal state committed!
) else (
    echo [OK] All portal files, databases, and backup files are already up to date.
)

echo.
echo Pushing codebase and persistent database state to GitHub...
git push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ===============================================================================
    echo  SUCCESS! Your portal code and ALL active data are published to GitHub!
    echo ===============================================================================
    echo.
    echo Render will now automatically deploy the exact state you have on your system.
    echo All user accounts, changed passwords, and operations tracker tasks are safe!
    echo.
    echo Portal URL: https://spillburg-portal.onrender.com
    echo.
) else (
    echo.
    echo [ERROR] Git push failed. 
    echo Please make sure you are logged into GitHub or enter a Personal Access Token if prompted.
)
pause
exit /b

:error
echo.
echo [ERROR] No GitHub URL was entered. Please run again and paste your URL.
pause
