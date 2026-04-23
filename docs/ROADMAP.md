# ROADMAP.md — 未來規劃與已知限制

---

## 可擴充功能

### 近期（低複雜度）

**書籤系統**
- 儲存常用位置（家附近的花圃、公園、常跑路線）
- 資料存在 `~/.mypikimwalk/bookmarks.json`
- 改的檔案：`frontend/panel.js`（新增 tab 或 details panel）+ `backend/main.py`（新增 `/api/bookmarks` CRUD）

**搖桿速度微調**
- 搖桿拉到邊緣 = 最快速度，拉一半 = 半速
- 目前 `compute_delta_vector` 對 vx/vy 大小不敏感（只取方向）
- 改的檔案：`backend/joystick.py` + `backend/sim_engine.py`

**停留點視覺提示**
- 在地圖上顯示每個 waypoint 的停留倒數計時
- 改的檔案：`frontend/panel.js` + `frontend/app.js`（新增 WS 事件）

---

### 中期（中等複雜度）

**GPX 匯入**
- 讓使用者上傳 `.gpx` 檔，自動解析成多點路線
- `pymobiledevice3` 的 `DvtProvider` 有 `play_gpx_file()` 方法可以直接使用
- 改的檔案：`backend/main.py`（新增 `/api/gpx` 上傳端點）+ `frontend/`

**GPX 匯出**
- 把走過的軌跡（trail polyline）存成 GPX，可以在其他地圖 App 查看
- 改的檔案：`backend/main.py`（新增 `/api/trail/export`）

**路線排程**
- 設定幾點幾分自動開始哪條路線（掛機刷花）
- 改的檔案：`backend/` 加一個 scheduler 模組（用 asyncio `create_task` + `sleep` 實作）

**健康限制模式**
- 單日累積移動距離上限（避免被 Niantic 偵測到不合理的日步數）
- Cool-down 強制休息時間
- 改的檔案：`backend/sim_engine.py`（加計數器）

---

### 長期（高複雜度）

**多裝置支援**
- 同時連接兩台 iPhone，各自走不同路線
- 需要重構 `device.py`，`DeviceSession` 改為多實例管理
- `sim_engine.py` 需要支援多個引擎並行

**自架 OSRM**
- OSRM 公共 demo server 有流量限制（大量路線規劃會被 rate limit）
- 自架方法：`docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract ...`
- 改的檔案：`backend/osrm.py`（改 base URL）

**Web 行動裝置支援**
- 目前 UI 在手機瀏覽器上版面較窄
- 加 responsive CSS breakpoint，或提供獨立的行動版 UI

---

## 已知限制

| 限制 | 說明 | 可能的解法 |
|---|---|---|
| 只支援 macOS | pymobiledevice3 在 Linux 上也能跑，但未測試；Windows 需要 WSL | 在 Linux 上測試並更新 README |
| 需要常駐 sudo | tunneld 需要 root；無法做成完全無 sudo 的 App | macOS Launch Daemon（設定一次後自動啟動）|
| iOS 16 及以下未測試 | 使用 DVT `LocationSimulation`，舊版 iOS 用 `DtSimulateLocation`，pymobiledevice3 有支援但本專案沒測試 | 在舊裝置測試並加相容處理 |
| OSRM 公共 server 可能降速 | `router.project-osrm.org` 是免費資源，大流量時會慢 | 自架 OSRM Docker |
| 無認證機制 | 伺服器只監聽 `127.0.0.1`，無法從外部網路連線（這同時也是一個安全設計）| 若要 LAN 分享，加基本 token 認證 |
| 無持久化狀態 | 伺服器重啟後路線/書籤清空 | 加 SQLite 或 JSON 檔案儲存 |
