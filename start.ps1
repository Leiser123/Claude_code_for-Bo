# Claude Code Haha launcher - auto-detect available ports

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# 1. Cleanup old processes
Write-Host "[1/4] Cleaning up old processes..."
taskkill /F /IM bun.exe /FI "WINDOWTITLE eq haha-server" 2>$null

# 2. Find available port
function Find-FreePort($startPort) {
    $port = $startPort
    $endPort = $startPort + 100
    while ($port -le $endPort) {
        $result = netstat -ano
        $match = $result | Select-String ":$port "
        if (-not $match) {
            return $port
        }
        $port = $port + 1
    }
    return $null
}

Write-Host "[2/4] Checking port availability..."
$serverPort = Find-FreePort(3456)
if (-not $serverPort) {
    Write-Host "[Error] No available port in range 3456-3556."
    pause
    exit 1
}
if ($serverPort -ne 3456) {
    Write-Host "[Info] Port 3456 is in use, using port $serverPort instead."
}

# 3. Start backend (new window)
Write-Host "[3/4] Starting backend on port $serverPort..."
$backendCmd = "`$host.UI.RawUI.WindowTitle = 'haha-server'; Set-Location '$root'; `$env:SERVER_PORT='$serverPort'; .\bun.exe --env-file=.env run src/server/index.ts; Write-Host 'Backend exited. Press any key to close...'; [Console]::ReadKey() | Out-Null"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# Wait for backend
Write-Host "      Waiting for backend..." -NoNewline
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$serverPort/health" -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 500
    Write-Host "." -NoNewline
}
if (-not $ready) {
    Write-Host "`n[Error] Backend failed to start."
    pause
    exit 1
}
Write-Host " OK"

# 4. Start frontend (new window)
Write-Host "[4/4] Starting frontend..."
$frontendCmd = "Set-Location '$root\desktop'; `$env:VITE_DESKTOP_SERVER_URL='http://127.0.0.1:$serverPort'; ..\bun.exe run dev; Write-Host 'Frontend exited. Press any key to close...'; [Console]::ReadKey() | Out-Null"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "================================================"
Write-Host "  Backend : http://127.0.0.1:$serverPort"
Write-Host "  Frontend: http://localhost:1420"
Write-Host "================================================"
Start-Process "http://localhost:1420"
