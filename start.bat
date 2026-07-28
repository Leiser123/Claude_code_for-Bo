@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "bun.exe" (
    echo [Error] bun.exe not found. Please install Bun first.
    echo Download: https://bun.sh/docs/installation
    pause
    exit /b 1
)

echo [Info] Starting Claude Code...
echo.

powershell -ExecutionPolicy Bypass -File "start.ps1"

echo.
echo [Done] Backend and frontend services are running. Keep this window open.
pause
