@echo off
title Push Spillburg Portal to GitHub for Render.com
cls
echo ===============================================================================
echo        SPILLBURG HOLDINGS - PUSH TO GITHUB (FOR RENDER.COM DEPLOYMENT)
echo ===============================================================================
echo.
echo  Step 1: Open https://github.com/new in your browser and create a repository:
echo         Repository name: spillburg-portal (or any name you choose)
echo         Select: Public or Private
echo         Do NOT initialize with README or .gitignore (already prepared)
echo.
echo  Step 2: Copy your repository URL from GitHub.
echo         Example: https://github.com/YOUR_USERNAME/spillburg-portal.git
echo.
set /p REPO_URL="Enter your GitHub Repository URL: "
if "%REPO_URL%"=="" goto error

set PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;%PATH%
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
echo.
echo Pushing codebase and databases to GitHub...
git push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ===============================================================================
    echo  SUCCESS! Your portal code is now published on GitHub!
    echo ===============================================================================
    echo.
    echo Final 2-Minute Step on Render.com:
    echo  1. Go to https://dashboard.render.com and sign in (free).
    echo  2. Click "New +" -^> "Web Service".
    echo  3. Select your "spillburg-portal" GitHub repository.
    echo  4. Render will auto-detect everything from render.yaml!
    echo     - Runtime: Python 3
    echo     - Build Command: (leave empty)
    echo     - Start Command: python server.py
    echo     - Plan: Free
    echo  5. Click "Deploy Web Service".
    echo.
    echo In 60 seconds, Render will give you your permanent 24/7 online link:
    echo   https://spillburg-portal.onrender.com
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
