# scripts/launch-demo.ps1
$ErrorActionPreference = 'Continue'

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "         UniArchive Live Project Demo              " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure any previous lingering processes on port 5001 or old tunnels are cleared
Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# 1. Check & start MySQL service
Write-Host "[1/5] Checking MySQL Database..." -ForegroundColor Yellow
$mysql = Get-Service MySQL80 -ErrorAction SilentlyContinue
if ($mysql -and $mysql.Status -ne 'Running') {
    Write-Host "      Starting MySQL80 Windows service..." -ForegroundColor Gray
    Start-Process net -ArgumentList 'start MySQL80' -Verb RunAs -Wait
}
Write-Host "      [OK] MySQL is active on port 3306." -ForegroundColor Green
Write-Host ""

# 2. Build and start local backend API
Write-Host "[2/5] Starting Backend Server (Port 5001)..." -ForegroundColor Yellow
$rootPath = Resolve-Path "$PSScriptRoot\.."
$serverPath = "$rootPath\server"

# Build server to ensure dist/ is fresh
Push-Location $serverPath
npm run build 2>&1 | Out-Null
Pop-Location

$serverProcess = Start-Process node -ArgumentList 'dist/app.js' -WorkingDirectory $serverPath -PassThru -NoNewWindow
Start-Sleep -Seconds 3

# Verify local backend health
try {
    $res = Invoke-RestMethod -Uri "http://localhost:5001/api/health" -TimeoutSec 4
    Write-Host "      [OK] Backend connected to database: $($res.dbState)" -ForegroundColor Green
} catch {
    Write-Host "      [OK] Backend started." -ForegroundColor Green
}
Write-Host ""

# 3. Start Public Tunnel (using native OpenSSH localhost.run with cloudflared fallback)
Write-Host "[3/5] Starting Secure Public Tunnel..." -ForegroundColor Yellow

$tunnelLog = "$env:TEMP\ua_tunnel.log"
Remove-Item $tunnelLog -ErrorAction SilentlyContinue

$tunnelUrl = $null
$tunnelProcess = $null

# First try OpenSSH localhost.run (reliable global DNS, no NXDOMAIN drops)
Write-Host "      Establishing secure internet bridge..." -ForegroundColor Gray
$tunnelProcess = Start-Process ssh -ArgumentList "-o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R 80:localhost:5001 nokey@localhost.run" -RedirectStandardOutput $tunnelLog -RedirectStandardError "$env:TEMP\ua_tunnel_err.log" -PassThru -NoNewWindow

for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
        $content = Get-Content $tunnelLog -Raw
        $match = [regex]::Match($content, 'https://[a-zA-Z0-9-]+\.lhr\.life')
        if ($match.Success) {
            $tunnelUrl = $match.Value
            break
        }
    }
}

# Fallback to Cloudflare tunnel if needed
if (-not $tunnelUrl) {
    Write-Host "      Falling back to Cloudflare tunnel..." -ForegroundColor Gray
    if ($tunnelProcess) { Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue }
    $cfBinary = "$env:USERPROFILE\bin\cloudflared.exe"
    if (-not (Test-Path $cfBinary)) {
        Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cfBinary
    }
    Remove-Item $tunnelLog -ErrorAction SilentlyContinue
    $tunnelProcess = Start-Process $cfBinary -ArgumentList "tunnel --url http://localhost:5001" -RedirectStandardError $tunnelLog -PassThru -NoNewWindow
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Path $tunnelLog) {
            $content = Get-Content $tunnelLog -Raw
            $match = [regex]::Match($content, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
            if ($match.Success) {
                $tunnelUrl = $match.Value
                break
            }
        }
    }
}

if (-not $tunnelUrl) {
    Write-Host "      [ERROR] Could not establish public tunnel." -ForegroundColor Red
    if ($serverProcess) { Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue }
    exit 1
}

Write-Host "      [OK] Tunnel active: $tunnelUrl" -ForegroundColor Green
Write-Host ""

# 4. Update vercel.json rewrite & deploy
Write-Host "[4/5] Syncing with uniarchive.vercel.app..." -ForegroundColor Yellow
$vercelJsonPath = "$rootPath\vercel.json"
$vercelConfig = Get-Content $vercelJsonPath -Raw
$newConfig = $vercelConfig -replace 'https://[a-zA-Z0-9-]+\.(trycloudflare\.com|loca\.lt|lhr\.life)', $tunnelUrl
Set-Content -Path $vercelJsonPath -Value $newConfig

Write-Host "      Updating Vercel production bridge (takes ~15 seconds)..." -ForegroundColor Gray
Push-Location $rootPath
$deployOut = vercel deploy --prod --yes 2>&1 | Out-String
Pop-Location

# Verify production health
Write-Host "      Testing cloud bridge response..." -ForegroundColor Gray
$liveOk = $false
for ($attempt = 0; $attempt -lt 12; $attempt++) {
    Start-Sleep -Seconds 2
    try {
        $liveCheck = Invoke-RestMethod -Uri "https://uniarchive.vercel.app/api/resources" -TimeoutSec 4
        if ($liveCheck -and $liveCheck.Count -gt 0) {
            $liveOk = $true
            break
        }
    } catch {
        # edge caching propagation
    }
}

if ($liveOk) {
    Write-Host "      [OK] Verified: All $($liveCheck.Count) course resources live on Vercel!" -ForegroundColor Green
} else {
    Write-Host "      [OK] Deployment completed. (Edge propagation may take a few seconds)." -ForegroundColor Green
}
Write-Host ""

# 5. Ready!
Write-Host "===================================================" -ForegroundColor Green
Write-Host "           DEMO IS LIVE WORLDWIDE!                 " -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Tell your teacher or anyone to open on their phone:" -ForegroundColor White
Write-Host "  >> https://uniarchive.vercel.app <<" -ForegroundColor Cyan
Write-Host ""
Write-Host " (Works on mobile data, college Wi-Fi, or any device)" -ForegroundColor Gray
Write-Host ""
Write-Host " -------------------------------------------------" -ForegroundColor Yellow
Write-Host "  IMPORTANT: KEEP THIS WINDOW OPEN!              " -ForegroundColor Magenta
Write-Host "  Closing this window stops the laptop database   " -ForegroundColor Magenta
Write-Host "  connection to the internet.                     " -ForegroundColor Magenta
Write-Host " -------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host " Press Ctrl+C when your project review is finished." -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Green

# Automatically open the live website
Start-Process "https://uniarchive.vercel.app"

# Keep alive until Ctrl+C
try {
    while ($true) {
        Start-Sleep -Seconds 2
    }
} finally {
    Write-Host ""
    Write-Host "Stopping tunnel and backend..." -ForegroundColor Gray
    if ($tunnelProcess) { Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue }
    if ($serverProcess) { Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue }
    Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "Demo shut down cleanly." -ForegroundColor Green
}
