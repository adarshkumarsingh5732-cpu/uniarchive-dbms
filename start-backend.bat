@echo off
title UniArchive Backend Server (Port 5001)
cd /d "%~dp0server"

echo ===================================================
echo           UniArchive Backend Launcher
echo ===================================================
echo.

:: Check if MySQL service is running
sc query MySQL80 2>nul | find "RUNNING" >nul
if %errorlevel% neq 0 (
    echo [INFO] Checking MySQL80 Windows service...
    net start MySQL80 >nul 2>&1
    if %errorlevel% neq 0 (
        echo [NOTICE] If MySQL is not running, start it via:
        echo          - Windows Services Manager: start MySQL80
        echo          - Or in an Administrator terminal: net start MySQL80
        echo.
    ) else (
        echo [OK] MySQL80 service is active.
        echo.
    )
) else (
    echo [OK] MySQL80 service is active.
    echo.
)

:: Check dependencies
if not exist "node_modules\" (
    echo [INFO] Installing backend dependencies...
    call npm install
    echo.
)

echo [INFO] Launching backend server on port 5001...
echo [INFO] Press Ctrl+C at any time to stop.
echo ===================================================
echo.

call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Backend exited with an error code.
    pause
)
