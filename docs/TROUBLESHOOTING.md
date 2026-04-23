# TROUBLESHOOTING.md — 常見問題與解法

---

## Windows 專屬問題

### PowerShell 說「無法載入腳本，因為這個系統已停用指令碼執行」

**原因**：Windows 預設封鎖執行 `.ps1` 腳本。

**解法**：以系統管理員身份執行一次：
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
之後 `.\setup.ps1` 和 `.\start.ps1` 就能正常執行。

---

### `setup.ps1` / `start.ps1` 找不到 iPhone（Windows）

**步驟檢查**：
1. iTunes 必須是 **Microsoft Store 版**（不是官網下載的舊版），舊版 driver 有相容問題
2. iPhone 插上後，Windows 裝置管理員應該看到「Apple Mobile Device USB Driver」
3. 確認 iPhone 上有點「信任此電腦」
4. iTunes 打開後能看到 iPhone 才算連線正常

---

### `pymobiledevice3 usbmux list` 輸出是空的（Windows）

**原因**：Apple Mobile Device Service 未啟動。

**解法**：
```powershell
# 以系統管理員身份執行
Start-Service "Apple Mobile Device Service"
```
或在「服務」（services.msc）裡找到 "Apple Mobile Device Service"，右鍵 → 啟動。

---

### Windows 的 `tunneld` 啟動後馬上關閉

**可能原因**：
1. 不是以系統管理員執行 → 右鍵 PowerShell → 以系統管理員身份執行
2. iPhone 還沒 trust 這台電腦 → 拔插 USB，在 iPhone 上點信任

---

### `start.ps1` 關閉後 tunneld 還在背景跑

```powershell
# 手動清理
Get-Process python | Where-Object { $_.MainWindowTitle -match "tunneld" } | Stop-Process
# 或直接停全部 python 程序（確認沒有其他 Python App 在跑）
Get-Process python | Stop-Process
```

---

## 安裝 / 設定問題

### `Cannot enable developer-mode when passcode is set`

**原因**：執行命令時 iPhone 螢幕是鎖定狀態。

**解法**：先解鎖 iPhone 螢幕（輸入密碼回到主畫面），再執行：
```bash
sudo .venv/bin/pymobiledevice3 amfi enable-developer-mode
```

---

### `idevice_id -l` 沒有任何輸出

**可能原因**（按機率排序）：

1. **USB 線只支援充電**，不支援資料傳輸 → 換有資料傳輸功能的 USB 線
2. **未點 iPhone 上的「信任此電腦」** → 拔 USB 再插，iPhone 螢幕解鎖後，點「信任」
3. **libimobiledevice 未安裝** → `brew install libimobiledevice`
4. **usbmuxd 服務未執行** → `brew services start usbmuxd`（通常不需要手動啟動）

---

### `brew services start usbmuxd` 報錯

**原因**：Homebrew 版的 libimobiledevice 不需要 services 管理；usbmuxd 在插上 iPhone 時會自動啟動。

**解法**：忽略這個錯誤。如果 `idevice_id -l` 可以看到 UDID，就代表連線正常。

---

### `setup.sh` 在 Homebrew 步驟卡住

**原因**：`brew install python@3.13` 或 `libimobiledevice` 需要編譯時間。

**解法**：等待，通常 2–5 分鐘。若超過 10 分鐘，可能是網路問題，`Ctrl+C` 再試一次。

---

## 連線問題

### `TunneldConnectionError`

**原因**：`pymobiledevice3 remote tunneld` 未啟動，或 tunnel 建立失敗。

**解法**：
```bash
# 開新的終端機執行：
sudo .venv/bin/pymobiledevice3 remote tunneld

# 等 5-10 秒看到 "Waiting for..." 訊息後，再啟動伺服器
sudo ./start.sh
```

---

### `No iOS device found via tunneld`

**原因**：tunneld 正在啟動中，tunnel 還沒就緒。

**解法**：等 10 秒再試，或重插 USB。

---

### 裝置狀態顯示「裝置未連線」

**解法**：在 UI 面板最底下點「重新連線」，或呼叫：
```bash
curl -X POST http://127.0.0.1:8000/api/connect
```

如果 iPhone 剛重啟或重插 USB，需要先等 tunneld 重新建立 tunnel（5–10 秒）。

---

## 伺服器問題

### 瀏覽器開啟後看到 iTerm2 插件頁面

**原因**：在 iTerm2 裡點擊了 `http://127.0.0.1:8000` 連結，被 iTerm2 的內建瀏覽器攔截。

**解法**：手動在 Safari 或 Chrome 的網址列輸入 `http://127.0.0.1:8000`。

---

### 伺服器無法啟動（port 已被佔用）

```
error: [Errno 48] Address already in use
```

**解法**：找出並停止占用 8000 port 的程序：
```bash
lsof -ti:8000 | xargs kill
sudo ./start.sh
```

---

### `ModuleNotFoundError: No module named 'backend'`

**原因**：沒有在專案根目錄執行。

**解法**：確認你在 `myPikimWalk/` 目錄下：
```bash
cd /path/to/myPikimWalk
sudo .venv/bin/python -m backend.main
```

---

## GPS 模擬問題

### 手機 GPS 沒有動

**可能原因**：
1. 裝置未連線 → 看 UI 的裝置狀態，或呼叫 `/api/status` 檢查 `connected`
2. 模式是 idle → 確認有點「開始走路」或啟動搖桿
3. `mode` 是 `navigate` 但目的地和目前位置很近（<3 公尺）→ 點更遠的目的地

---

### 走到目的地後角色停在原地

這是正常行為。navigate 模式到達目的地後自動切回 idle。若要繼續走，點新的目的地，或切到多點路線並勾選「循環」。

---

### 步數沒有增加

**原因**：速度超過 5 km/h，Apple Health 不計步。

**解法**：把速度調回 3.5 km/h，在速度滑桿下看到警告就代表超速了。

---

### 瀏覽器「📍 定位我的位置」按鈕沒有反應

**可能原因**：
1. 瀏覽器未允許定位 → 在 Safari/Chrome 設定中允許此網站定位
2. 使用 LAN IP 而非 localhost → 部分瀏覽器對非 HTTPS 的非 localhost 網站限制 geolocation；改用 `http://127.0.0.1:8000` 或 `http://localhost:8000`

---

## 關於 sudo

`sudo ./start.sh` 是必要的，因為：
- `pymobiledevice3 remote tunneld` 需要修改系統網路路由，必須 root
- 伺服器本身不需要 root，但 `start.sh` 用 `su $SUDO_USER` 確保瀏覽器以一般使用者身份開啟

若不想每次都輸入密碼，可以把 `pymobiledevice3 remote tunneld` 加入 `/etc/sudoers`（需要謹慎操作）。
