# IOS_SETUP.md — iPhone 首次設定指南

**首選方式**：執行設定腳本，它會自動引導你完成所有步驟。

| 系統 | 腳本 |
|---|---|
| Mac | `./setup.sh` |
| Windows（管理員 PowerShell）| `.\setup.ps1` |

本文件是設定腳本的詳細說明，以及腳本失敗時的手動 fallback 流程。

---

## 需要做什麼？

iPhone 上的 GPS 模擬需要以下三件事：

1. **信任此電腦**：iPhone 和電腦之間的 USB 信任
2. **Developer Mode**：iOS 17+ 的開發者模式開關
3. **DDI 掛載**：Developer Disk Image（現代版由 pymobiledevice3 自動處理）

只需要在**第一次設定時**做，之後每次只要啟動腳本。

---

## 自動設定（推薦）

**Mac**
```bash
./setup.sh
```

**Windows（管理員 PowerShell）**
```powershell
.\setup.ps1
```

腳本會自動完成：環境安裝 → 裝置偵測 → Developer Mode 啟用 → 驗證

詳見根目錄的 [README.md](../README.md)。

---

## 手動設定流程（腳本失敗時的 fallback）

### 步驟 1：USB 信任

1. 解鎖 iPhone 螢幕
2. 用 **資料傳輸線**（非純充電線）連接到電腦
3. iPhone 螢幕彈出「是否信任此電腦？」→ 點**信任**
4. 輸入 iPhone 密碼確認

驗證：

```bash
# Mac
idevice_id -l
# 應該輸出 UDID，例如：00008140-000A6C8A0A98801C
```

```powershell
# Windows
.venv\Scripts\python.exe -m pymobiledevice3 usbmux list
# 應該輸出包含 identifier 的裝置資訊
```

---

### 步驟 2：啟用 Developer Mode

**重要**：iPhone 螢幕必須已解鎖（回到主畫面），不能在鎖定狀態。

```bash
# Mac
sudo .venv/bin/pymobiledevice3 amfi enable-developer-mode
```

```powershell
# Windows（管理員 PowerShell）
.venv\Scripts\python.exe -m pymobiledevice3 amfi enable-developer-mode
```

常見結果：
- **成功**：iPhone 彈出確認視窗 → 點「開啟」→ iPhone 自動重啟
- **失敗**：`Cannot enable developer-mode when passcode is set`
  → 解法：先解鎖 iPhone 螢幕（輸入密碼到主畫面），再重新執行命令

---

### 步驟 3：iPhone 重啟後開啟 Developer Mode

iPhone 重啟後，螢幕上方會出現橫幅提示「Ready to Enable Developer Mode」：

1. 滑上去點橫幅
2. 點「**開啟**」
3. 輸入 iPhone 密碼

或者：設定 → 隱私權與安全性 → 開發者模式 → 開啟 → 重啟

---

### 步驟 4：驗證設定完成

```bash
# Mac
sudo .venv/bin/pymobiledevice3 amfi developer-mode-status
```

```powershell
# Windows
.venv\Scripts\python.exe -m pymobiledevice3 amfi developer-mode-status
```

兩者都應該輸出：`developer mode is enabled`

---

## DDI 說明

舊版 iOS（16 以下）需要手動掛載 Developer Disk Image。iOS 17+ 使用 Personalized DDI，由 `pymobiledevice3 mounter` 自動在需要時掛載。

你**不需要**手動執行 `pymobiledevice3 mounter auto-mount`。

---

## tunneld 生命週期

`tunneld` 是 iOS 17+ 必要的背景 daemon：

- 為什麼需要：iOS 17 改用 RSD（Remote Service Discovery）tunnel，DVT 服務必須透過這個 tunnel 通訊
- 為什麼需要 sudo：tunnel 建立需要修改系統網路路由
- 為什麼每次都要重啟：tunnel 和 iPhone 的連線綁定在一起，iPhone 重開機或拔 USB 就失效

`./start.sh` 會自動管理 tunneld 的啟動和關閉。

---

## 常見問題

### Q: `Cannot enable developer-mode when passcode is set`

A: iPhone 鎖屏時無法啟用 Developer Mode。先解鎖螢幕（輸入密碼到主畫面），再執行命令。

### Q: `idevice_id -l` 沒有輸出任何 UDID

可能原因：
1. USB 線只支援充電，不支援資料傳輸 → 換資料線
2. 沒有點 iPhone 上的「信任此電腦」→ 拔插 USB，再點信任
3. `libimobiledevice` 未安裝 → `brew install libimobiledevice`

### Q: `TunneldConnectionError` 或 `No iOS device found via tunneld`

A: `tunneld` 未啟動，或剛啟動還沒建好連線。

```bash
# 終端機 1（保持運行）
sudo pymobiledevice3 remote tunneld

# 等 5-10 秒後，終端機 2
sudo ./start.sh
```

### Q: iPhone 重新整理後，GPS 還是沒有動

A: 進入伺服器 UI，按右下角「重新連線」，或呼叫：
```bash
curl -X POST http://127.0.0.1:8000/api/connect
```

### Q: iOS 17+ 以下的 iPhone 可以用嗎？

A: 理論上 iOS 16 以下走 `DtSimulateLocation` 路徑，`pymobiledevice3` 也支援，但這個專案目前只在 iOS 17+ 測試過。
