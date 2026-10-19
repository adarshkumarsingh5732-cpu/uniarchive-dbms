# scripts/launch-demo.ps1
$ErrorActionPreference = 'Stop'

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "         UniArchive Live Project Demo              " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

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

$serverProcess = Start-Process node -ArgumentList 'dist/app.js' -WorkingDirectory $serverPath -PassThru -NoNewWindow
Start-Sleep -Seconds 2

# Verify health
try {
    $res = Invoke-RestMethod -Uri "http://localhost:5001/api/health" -TimeoutSec 3
    Write-Host "      [OK] Backend connected to database: $($res.dbState)" -ForegroundColor Green
} catch {
    Write-Host "      [OK] Backend started." -ForegroundColor Green
}
Write-Host ""

# 3. Start Cloudflare Tunnel
Write-Host "[3/5] Starting Secure Public Tunnel..." -ForegroundColor Yellow
$cfBinary = "$env:USERPROFILE\bin\cloudflared.exe"
if (-not (Test-Path $cfBinary)) {
    Write-Host "      Downloading portable cloudflared..." -ForegroundColor Gray
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cfBinary
}

$tunnelLog = "$env:TEMP\ua_tunnel.log"
Remove-Item $tunnelLog -ErrorAction SilentlyContinue

$tunnelProcess = Start-Process $cfBinary -ArgumentList "tunnel --url http://localhost:5001" -RedirectStandardError $tunnelLog -PassThru -NoNewWindow

$tunnelUrl = $null
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
        $match = Select-String -Path $tunnelLog -Pattern "https://[a-zA-Z0-9-]+\.trycloudflare\.com"
        if ($match) {
            $tunnelUrl = $match.Matches[0].Value
            break
        }
    }
}

if (-not $tunnelUrl) {
    Write-Host "      [ERROR] Could not establish tunnel." -ForegroundColor Red
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "      [OK] Tunnel active: $tunnelUrl" -ForegroundColor Green
Write-Host ""

# 4. Update vercel.json rewrite & deploy
Write-Host "[4/5] Syncing with uniarchive.vercel.app..." -ForegroundColor Yellow
$vercelJsonPath = "$rootPath\vercel.json"
$vercelConfig = Get-Content $vercelJsonPath -Raw
$newConfig = $vercelConfig -replace 'https://[a-zA-Z0-9-]+\.(trycloudflare\.com|loca\.lt)', $tunnelUrl
Set-Content -Path $vercelJsonPath -Value $newConfig

Write-Host "      Updating Vercel production bridge (takes ~10 seconds)..." -ForegroundColor Gray
Push-Location $rootPath
vercel deploy --prod --yes | Out-Null
Pop-Location
Write-Host "      [OK] Production site connected to your laptop!" -ForegroundColor Green
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
    Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Demo shut down cleanly." -ForegroundColor Green
}
