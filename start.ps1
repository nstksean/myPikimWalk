# myPikimWalk — Windows 啟動腳本
# 用法（以系統管理員身份執行 PowerShell）：
#   .\start.ps1
#
# 每次要玩的時候執行，按 Ctrl+C 關閉所有服務。

Set-StrictMode -Version Latest
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$venv      = "$ScriptDir\.venv"

# ── 顏色輸出 ─────────────────────────────────────────────────────────────────
function Ok($msg)   { Write-Host "✅ $msg" -ForegroundColor Green }
function Info($msg) { Write-Host "ℹ️  $msg" -ForegroundColor Cyan }
function Die($msg)  { Write-Host "❌ $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "🌱 myPikimWalk 啟動中..." -ForegroundColor Green
Write-Host ""

# ── 1. 系統管理員確認 ─────────────────────────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]"Administrator"
)
if (-not $isAdmin) {
    Die "請以系統管理員身份執行 PowerShell，再重新跑此腳本`n`n   右鍵點 PowerShell → 以系統管理員身份執行"
}

# ── 2. .venv 確認 ────────────────────────────────────────────────────────────
if (-not (Test-Path "$venv\Scripts\python.exe")) {
    Die "找不到 .venv，請先執行首次設定：`n   .\setup.ps1"
}

# ── 3. 啟動 tunneld（背景）────────────────────────────────────────────────────
Info "啟動 tunneld（iOS RSD tunnel，背景常駐）..."

$tunneldProc = Start-Process `
    -FilePath "$venv\Scripts\python.exe" `
    -ArgumentList "-m", "pymobiledevice3", "remote", "tunneld" `
    -PassThru `
    -NoNewWindow

# 等 tunneld 初始化
Start-Sleep -Seconds 3

# ── 4. 開啟瀏覽器 ────────────────────────────────────────────────────────────
Info "開啟瀏覽器..."
Start-Process "http://127.0.0.1:8000"

# ── 5. 啟動伺服器（前台，Ctrl+C 停止）────────────────────────────────────────
Ok "myPikimWalk 伺服器  →  http://127.0.0.1:8000"
Write-Host "   按 Ctrl+C 關閉所有服務" -ForegroundColor Yellow
Write-Host ""

try {
    Set-Location $ScriptDir
    & "$venv\Scripts\python.exe" -m backend.main
} finally {
    # ── 清理：關閉 tunneld ─────────────────────────────────────────────────
    Write-Host ""
    Info "正在關閉 tunneld..."
    if ($tunneldProc -and -not $tunneldProc.HasExited) {
        Stop-Process -Id $tunneldProc.Id -Force -ErrorAction SilentlyContinue
    }
    # 也清理同名的殘留程序（避免多次啟動殘留）
    Get-Process -Name "python" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match "tunneld" } |
        Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Host "🛑 已關閉所有服務" -ForegroundColor Red
    Write-Host ""
}
