# HISTORY.md — 開發歷程

記錄 myPikimWalk 從概念到上線的完整開發過程，包含每個關鍵決策的背景和當時的思考。

---

## 起點：需求釐清

**使用者目標**：「我想要玩皮克敏但下雨天出門危險，請協助找出 ianyGo 產品的底層邏輯是用哪款開源軟體，設計並研究一個類似的開源產品，計劃並執行」。

**初步調研**：分析 iAnyGo / AnyGo 等商業 GPS 模擬工具的技術基礎：
- 這些工具都使用 Apple 官方 DVT（Developer Tools）協定
- 核心 API：`simulateLocationWithLatitude:longitude:`（Instruments App 也用同一個）
- 開源實作：`pymobiledevice3` 是最完整的 Python 套件

**環境確認**：
- 使用者已有 Python 3.13、Homebrew、Xcode Command Line Tools
- iPhone iOS 17+
- Mac USB 連線可用

---

## Phase 0：方案比較

調研現有開源方案，比對後決定自行開發：

| 專案 | 語言 | iOS 17+ | 客製化空間 |
|---|---|---|---|
| Kinesis | Python | ❌ 舊版 | 低（舊 API）|
| locwarp | Swift/macOS native | ✅ | 低（非 Web）|
| LocationSimulator | macOS native | 部分 | 低（無法程式控制）|
| FakePosition | Python | 部分 | 中 |
| **myPikimWalk（本專案）** | Python + Web | ✅ | 高（完全客製）|

---

## Phase 1：環境搭建

```bash
brew install libimobiledevice
python3.13 -m venv .venv
pip install pymobiledevice3 fastapi uvicorn[standard] httpx
```

---

## Phase 2：後端骨架

按模組設計順序：

1. **`device.py`**：最小可行版 `DeviceSession`，驗證 `pymobiledevice3.remote.remotexpc` 和 DVT 連線
2. **`walker.py`**：純函式 async generator，haversine 計算，確認數學正確
3. **`osrm.py`**：HTTP 呼叫 OSRM demo server，decode GeoJSON polyline
4. **`sim_engine.py`**：三個模式（idle/navigate/joystick），單一 task 設計
5. **`waypoints.py`**：多點路線段落拼接
6. **`ws.py`**：WebSocket hub，廣播位置，接收搖桿輸入
7. **`main.py`**：FastAPI 路由，lifespan 管理

---

## Phase 3：前端

1. **`index.html`**：三個 tab（導航/多點路線/搖桿），狀態列，速度滑桿
2. **`app.js`**：Leaflet 地圖，WebSocket 接收位置，REST 呼叫
3. **`joystick.js`**（初版）：8 方向 D-pad，鍵盤事件
4. **`panel.js`**：多點路線 waypoint 管理列表

---

## Phase 4：iPhone 首次設定（踩坑紀錄）

**問題**：使用者找不到「iOS 26（beta）」的 Developer Mode 在哪裡設定。

**解法**：iOS 26 beta 更改了設定入口位置，但 `pymobiledevice3 amfi enable-developer-mode` 可以直接從命令列開啟，不需要先找 UI 入口。

**第二個問題**：執行命令時出現 `Cannot enable developer-mode when passcode is set`。

**原因和解法**：iPhone 螢幕鎖定時，AMFI 拒絕此操作（安全機制）。解法很簡單：先解鎖 iPhone 螢幕（輸入密碼回到主畫面），再重新執行命令。

**結果**：使用者回報「讚啦 重新啟動了」，問題解決。

---

## Phase 5：UX 第一輪改善

使用者使用後回饋三個問題：

### 問題 1：「我現在在哪裡我要怎麼知道」

**解法**：在導航 tab 加入「📍 定位我的位置」按鈕，呼叫 `navigator.geolocation.getCurrentPosition()`，把瀏覽器 GPS 座標填入輸入欄並 teleport 到該位置作為起點。

### 問題 2：「我希望可以在螢幕上點擊拉桿來上下左右移動，不要用鍵盤」

**解法**：重寫 `joystick.js`，從 D-pad 改為圓形拖曳搖桿：
- `#joystick-base`（140px 深色圓形）
- `#joystick-thumb`（52px 綠色球，支援 pointer/touch 事件）
- 傳送連續向量 `{type:"vector", vx, vy}`
- 保留鍵盤 WASD 作為 fallback

同時更新 `backend/joystick.py` 新增 `compute_delta_vector()` 處理連續向量輸入。

### 問題 3：「最高上限速度要在哪裡調整」

**解法**：
- 把速度滑桿上限從 5 km/h 提高到 10 km/h
- 更新 `walker.py` 的 `MAX_SPEED_MPS`
- 在 UI 加入 `>5 km/h` 的黃色警告文字

---

## Phase 6：UX 第二輪美化

使用者第二輪回饋：

### 問題 1：「地圖太醜了，有沒有其他樣式」

**解法**：在 `app.js` 加入 `TILE_STYLES` dict（dark/voyager/sat），在 UI 加 🌑🗺🛰 三個切換按鈕。把預設從 OSM 改為 CartoDB dark（配合深色主題）。

### 問題 2：「我的人的綠點太醜了，能否給我一個皮克敏」

**解法**：手繪 Pikmin SVG（黃色身體、葉子、眼睛、腳），替換 Leaflet 預設的 `L.divIcon` 綠點。角色有 36×48px，`iconAnchor` 設在腳底。

### 問題 3：「開啟整個軟體太複雜了，有沒有比較簡單的方式」

**解法**：建立 `start.sh`，整合：
1. `pymobiledevice3 remote tunneld` 以背景啟動
2. `sleep 2` 等 tunnel 就緒
3. `su $SUDO_USER -c "open http://127.0.0.1:8000"` 開瀏覽器
4. `python -m backend.main` 啟動伺服器（前台）
5. `Ctrl+C` 的 trap cleanup

---

## Phase 7：GitHub

```bash
git init
git remote add origin https://github.com/nstksean/myPikimWalk.git
git branch -M main
git add .
git commit -m "feat: initial myPikimWalk release"
git push -u origin main
```

---

## Phase 8：文件 + setup.sh

使用者要求：「幫我在產品中新增 docs/ 把你現在使用的技術、經歷的文件、我做的決策……所有 agent 可能要的東西都丟進去，然後上 code 寫 readme」。

同時要求：「幫我開啟前導的事件也做成一個快速的 script」。

→ 新增 `docs/` 目錄（11 個 Markdown 文件）+ `setup.sh` 首次設定腳本 + README 更新。

---

## Phase 9：Windows 支援

使用者問：「這個有辦法讓 Windows 也能用嗎？」

**調研結果**：
- `pymobiledevice3` 官方支援 Windows（2024 年初加入）
- Windows 上用 iTunes（Microsoft Store 版）替代 `libimobiledevice`
- `tunneld` 在 Windows 管理員 PowerShell 可正常執行
- WSL2 + usbipd-win 對 iPhone USB 有已知問題，**不建議**

**實作**：
- 新增 `setup.ps1`：Windows 版首次設定腳本（對應 `setup.sh`）
- 新增 `start.ps1`：Windows 版每日啟動腳本（對應 `start.sh`）
- 後端 Python 程式碼**零修改**（跨平台）
- 更新 README 加 Windows 安裝/啟動說明
- 更新 `docs/TROUBLESHOOTING.md` 加 Windows 專屬問題

---

## 時間軸摘要

| 階段 | 主要產出 |
|---|---|
| 需求釐清 + 調研 | 確認用 pymobiledevice3 + FastAPI + Leaflet |
| Phase 0–3 | 完整後端 + 前端骨架 |
| Phase 4 | iOS Developer Mode 設定（含 passcode 解法）|
| Phase 5 | geolocation 按鈕、圓形搖桿、速度滑桿擴大 |
| Phase 6 | CartoDB tiles、Pikmin SVG、start.sh |
| Phase 7 | git push 上 GitHub |
| Phase 8 | docs/ + setup.sh + README 更新 |
| Phase 9 | Windows 支援：setup.ps1 + start.ps1 |
