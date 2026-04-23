# myPikimWalk — Windows 首次設定腳本
# 用法（以系統管理員身份執行 PowerShell）：
#
#   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser   # 第一次要跑這行
#   .\setup.ps1
#
# 這個腳本是冪等的：可以重複執行，已完成的步驟會自動跳過。

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── 顏色輸出 ─────────────────────────────────────────────────────────────────
function Ok($msg)   { Write-Host "✅ $msg" -ForegroundColor Green }
function Info($msg) { Write-Host "ℹ️  $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function Die($msg)  { Write-Host "❌ $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "🌱 myPikimWalk Windows 首次設定" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""

# ── 1. 平台確認 ──────────────────────────────────────────────────────────────
if ($env:OS -ne "Windows_NT") {
    Die "此腳本僅支援 Windows。Mac 請用 ./setup.sh"
}
Ok "Windows 確認"

# ── 2. 系統管理員確認 ─────────────────────────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]"Administrator"
)
if (-not $isAdmin) {
    Die "請以系統管理員身份執行 PowerShell，再重新跑此腳本`n`n   右鍵點 PowerShell → 以系統管理員身份執行"
}
Ok "系統管理員權限確認"

# ── 3. 在專案根目錄確認 ───────────────────────────────────────────────────────
if (-not (Test-Path "$ScriptDir\backend\main.py")) {
    Die "找不到 backend\main.py，請確認在 myPikimWalk 根目錄執行"
}
Ok "專案目錄確認"

# ── 4. iTunes / Apple Mobile Device Support 確認 ─────────────────────────────
Info "確認 iTunes（iPhone USB driver 來源）..."
$itunesStore   = Get-AppxPackage -Name "AppleInc.iTunes" -ErrorAction SilentlyContinue
$itunesDesktop = Test-Path "C:\Program Files\iTunes\iTunes.exe"
$appleDevices  = Get-AppxPackage -Name "AppleInc.AppleDevices" -ErrorAction SilentlyContinue

if ($itunesStore -or $itunesDesktop -or $appleDevices) {
    Ok "iTunes / Apple Devices 已安裝"
} else {
    Warn "找不到 iTunes 或 Apple Devices App"
    Write-Host ""
    Write-Host "   請先安裝 iTunes（推薦 Microsoft Store 版本）："
    Write-Host "   Microsoft Store → 搜尋 'iTunes' → 安裝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   或直接開啟：" -ForegroundColor Cyan
    Write-Host "   ms-windows-store://pdp/?ProductId=9PB2MZ1ZMB1S" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "安裝完成後按 Enter 繼續..."
    $itunesStore = Get-AppxPackage -Name "AppleInc.iTunes" -ErrorAction SilentlyContinue
    if (-not $itunesStore -and -not $itunesDesktop) {
        Die "仍找不到 iTunes，請安裝後重新執行 .\setup.ps1"
    }
    Ok "iTunes 安裝確認"
}

# ── 5. Python 3.13 確認 ──────────────────────────────────────────────────────
Info "確認 Python 3.13..."

$pythonExe = $null

# 嘗試 py launcher（Windows 標準方式）
try {
    $ver = & py -3.13 --version 2>&1
    if ($ver -match "3\.13") { $pythonExe = "py -3.13" }
} catch {}

# 嘗試 python3.13
if (-not $pythonExe) {
    try {
        $ver = & python3.13 --version 2>&1
        if ($ver -match "3\.13") { $pythonExe = "python3.13" }
    } catch {}
}

# 嘗試 python（確認版本）
if (-not $pythonExe) {
    try {
        $ver = & python --version 2>&1
        if ($ver -match "3\.13") { $pythonExe = "python" }
    } catch {}
}

if (-not $pythonExe) {
    Info "Python 3.13 未安裝，嘗試用 winget 安裝..."
    try {
        winget install --id Python.Python.3.13 --accept-source-agreements --accept-package-agreements
        # 刷新 PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path", "User")
        $ver = & py -3.13 --version 2>&1
        if ($ver -match "3\.13") { $pythonExe = "py -3.13" }
    } catch {
        Die "winget 安裝 Python 3.13 失敗。請手動從 https://python.org 下載安裝，再重新執行 .\setup.ps1"
    }
}

if (-not $pythonExe) {
    Die "找不到 Python 3.13。請從 https://python.org/downloads 安裝，確認勾選 'Add Python to PATH'"
}

$verStr = Invoke-Expression "$pythonExe --version"
Ok "Python $verStr"

# ── 6. 虛擬環境 ──────────────────────────────────────────────────────────────
$venv = "$ScriptDir\.venv"
if (-not (Test-Path "$venv\Scripts\python.exe")) {
    Info "建立 Python 虛擬環境（.venv）..."
    Invoke-Expression "$pythonExe -m venv `"$venv`""
}
Ok "虛擬環境 .venv 已就緒"

# ── 7. pip 依賴 ───────────────────────────────────────────────────────────────
Info "安裝 Python 套件（pymobiledevice3, fastapi, uvicorn, httpx）..."
& "$venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
& "$venv\Scripts\python.exe" -m pip install -r "$ScriptDir\requirements.txt" --quiet
Ok "Python 套件安裝完成"

Write-Host ""
Write-Host "━━━ iPhone 設定 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# ── 8. 裝置偵測 ───────────────────────────────────────────────────────────────
Info "請解鎖 iPhone 螢幕（輸入密碼到主畫面），用 USB 傳輸線連接電腦。"
Info "iPhone 若彈出「是否信任此電腦？」請點信任並輸入密碼。"
Write-Host ""

$udid = $null
for ($attempt = 1; $attempt -le 3; $attempt++) {
    Read-Host "▶ 準備好後按 Enter 繼續..."

    $listOutput = & "$venv\Scripts\python.exe" -m pymobiledevice3 usbmux list 2>&1 | Out-String
    if ($listOutput -match "identifier") {
        $udid = "found"
        break
    }

    if ($attempt -lt 3) {
        Warn "找不到 iPhone。請確認：`n   1. USB 線支援資料傳輸（非純充電線）`n   2. iPhone 已解鎖`n   3. iPhone 上點了「信任此電腦」`n`n再試一次..."
    }
}

if (-not $udid) {
    Die "嘗試 3 次後仍找不到 iPhone。`n`n排查步驟：`n   1. 換一條 USB 資料傳輸線`n   2. 確認 iPhone 解鎖後插上電腦`n   3. 點 iPhone 上的「信任此電腦」`n   4. 確認 iTunes 已安裝並服務正在執行`n`n排查完後重新執行 .\setup.ps1"
}
Ok "找到 iPhone"

# ── 9. Developer Mode 狀態確認 ────────────────────────────────────────────────
Info "檢查 Developer Mode 狀態..."

$devStatus = & "$venv\Scripts\python.exe" -m pymobiledevice3 amfi developer-mode-status 2>&1 | Out-String
$devEnabled = $devStatus -match "enabled"

if ($devEnabled) {
    Ok "Developer Mode 已啟用，跳過此步驟"
} else {
    Write-Host ""
    Info "Developer Mode 尚未啟用。即將執行啟用程序..."
    Warn "請確認 iPhone 螢幕已解鎖（看得到主畫面），否則會失敗。"
    Write-Host ""
    Read-Host "▶ iPhone 螢幕解鎖後按 Enter 繼續..."

    $enableOutput = & "$venv\Scripts\python.exe" -m pymobiledevice3 amfi enable-developer-mode 2>&1 | Out-String

    if ($enableOutput -match "passcode is set") {
        Die "iPhone 螢幕鎖定中。`n請解鎖 iPhone（輸入密碼到主畫面），然後重新執行 .\setup.ps1"
    }

    Write-Host ""
    Ok "Developer Mode 啟用指令已送出"
    Write-Host ""
    Warn "iPhone 可能會自動重啟。重啟後請："
    Write-Host "   1. 解鎖 iPhone"
    Write-Host "   2. 螢幕上方出現「開啟開發者模式」橫幅 → 點開，輸入密碼"
    Write-Host "      （或到：設定 → 隱私權與安全性 → 開發者模式 → 開啟 → 重啟）"
    Write-Host ""
    Read-Host "▶ 完成 iPhone 上的操作後，按 Enter 繼續..."
}

# ── 10. 完成 ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "🌱 設定完成！" -ForegroundColor Green
Write-Host ""
Write-Host "   之後每次啟動只需要（以系統管理員身份執行）："
Write-Host ""
Write-Host "   .\start.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "   腳本會自動啟動服務並開啟瀏覽器 http://127.0.0.1:8000"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
