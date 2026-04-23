# AGENTS.md — AI Agent 快速接手指南

你是一個被叫來修改或擴充 **myPikimWalk** 的 AI agent。讀完這份文件，你就能了解這個專案、知道要改哪裡，以及避免踩常見的坑。

---

## 這是什麼專案？

一個讓 iPhone 在家裡模擬 GPS 走路的工具，主要用於 Pikmin Bloom 的步數/種花刷取。

架構：**瀏覽器 UI ⇄ Python FastAPI 伺服器 ⇄ pymobiledevice3 ⇄ iPhone（DVT 協定）**

---

## 30 秒架構理解

```
browser/
  frontend/
    index.html     # 控制面板 HTML
    app.js         # Leaflet 地圖 + REST 呼叫 + WS 接收
    joystick.js    # 圓形拖曳搖桿 + 鍵盤輸入
    panel.js       # 多點路線 waypoint 管理
    style.css      # 深色主題 CSS

server/
  backend/
    main.py        # FastAPI 路由 + lifespan
    sim_engine.py  # 狀態機（idle/navigate/route/joystick）
    device.py      # DeviceSession（pymobiledevice3 封裝）
    walker.py      # 純函式 polyline 插值（可測試）
    osrm.py        # OSRM HTTP 步行路徑規劃
    waypoints.py   # 多點路線段落拼接
    joystick.py    # 方向向量計算
    ws.py          # WebSocket hub

storage:
  要求 sudo 常駐的 tunneld daemon（不在本專案內）
```

---

## 改 XX 要看哪個檔案

| 需求 | 主要檔案 | 參考文件 |
|---|---|---|
| 加新移動模式 | `backend/sim_engine.py` (Mode enum + 新 `_run_*` task) | ARCHITECTURE.md |
| 改速度/抖動/半徑 | `backend/walker.py` 頂部常數 | ANTI_DETECTION.md |
| 改地圖 tile 樣式 | `frontend/app.js` (TILE_STYLES dict) | — |
| 加新 REST 端點 | `backend/main.py` | API.md |
| 改 WS 訊息格式 | `backend/ws.py` + `frontend/app.js` ws.onmessage | API.md |
| 改 iOS 裝置連線 | `backend/device.py` (DeviceSession) | IOS_SETUP.md |
| 改路徑規劃 API | `backend/osrm.py` | TECH_STACK.md |
| 改搖桿方向計算 | `backend/joystick.py` | — |
| 加 waypoint 功能 | `backend/waypoints.py` + `frontend/panel.js` | — |

---

## 怎麼跑起來（開發用）

**Mac**
```bash
# 終端機 1：啟動 iOS tunnel（需要常駐）
sudo .venv/bin/pymobiledevice3 remote tunneld

# 終端機 2：啟動伺服器
sudo .venv/bin/python -m backend.main
# 或：sudo ./start.sh（一鍵，會自動開瀏覽器）
```

**Windows（以系統管理員 PowerShell 執行）**
```powershell
# 終端機 1：啟動 iOS tunnel（需要常駐）
.venv\Scripts\python.exe -m pymobiledevice3 remote tunneld

# 終端機 2：啟動伺服器
.venv\Scripts\python.exe -m backend.main
# 或：.\start.ps1（一鍵，會自動開瀏覽器）
```

伺服器在 `http://127.0.0.1:8000`

---

## 不要做的事（已踩過的坑）

| 禁止 | 原因 |
|---|---|
| 把 `LocationSimulation` 的生命週期移出 `DeviceSession` | 會產生對 DVT service 的 race condition；`DeviceSession` 用 `AsyncExitStack` 保證順序 |
| 在 `walker.py` 裡加任何 I/O（網路/檔案/log） | `walker.py` 故意是純計算函式，設計目的是可以無副作用地單元測試 |
| 把 `tunneld` 移到伺服器內部啟動 | `tunneld` 需要 root，而 FastAPI 伺服器不應該以 root 長期運行；兩者分開是有意設計 |
| 用 `print()` 除錯 | 改用 `logging.getLogger(__name__)`，方便控制 log level |
| 在 `_run_walk` / `_run_joystick` 裡不 catch `CancelledError` | 模式切換靠 `task.cancel()` 完成，如果不 catch 會讓 task 留下殘局 |
| 直接操作 `self._task` 而不走 `_cancel_task()` | `_cancel_task()` 有 `asyncio.wait_for` 等待 cleanup，直接操作會 race |

---

## 測試

```bash
# 基本語法檢查
python -m py_compile backend/*.py

# 有 pytest 的話
pytest tests/
```

目前沒有完整測試套件。`walker.py` 的純函式最適合加 pytest 單元測試。

---

## 專案術語速查

| 術語 | 意思 |
|---|---|
| **DVT** | Apple Developer Tools 協定，iOS instruments 用的底層傳輸 |
| **RSD** | Remote Service Discovery，iOS 17+ 的 USB/WiFi tunnel 機制 |
| **tunneld** | `pymobiledevice3 remote tunneld` 常駐 daemon，建立 iOS 17+ RSD tunnel |
| **DDI** | Developer Disk Image，掛載後開啟 iOS 上的開發者服務（現代版叫 Personalized DDI）|
| **OSRM** | Open Source Routing Machine，計算步行路線的免費開源服務 |
| **AMFI** | Apple Mobile File Integrity，管理 iOS 上的 Developer Mode 開關 |
| **softban** | Niantic 偵測到異常 GPS 後的帳號軟封禁（步數停止計算、種花無效）|
| **Jitter** | 每次 tick 的速度隨機浮動，模擬真人走路的不規律性 |

---

## 關鍵常數一覽

```python
# backend/walker.py
MAX_SPEED_MPS   = 10.0 / 3.6   # 硬上限 10 km/h
DEFAULT_SPEED_MPS = 3.5 / 3.6  # 預設 3.5 km/h（安全步數範圍）
JITTER_FRACTION = 0.10          # ±10% 速度抖動
ARRIVAL_RADIUS_M = 3.0          # 距離目標 3m 內視為到達

# backend/sim_engine.py
TICK_S = 1.0                    # 每秒更新一次位置（1 Hz）
```

---

## 增加新模式的範例步驟

1. 在 `backend/sim_engine.py` 的 `Mode` enum 加新值
2. 在 `SimulationEngine` 加 `async def start_xxx()` — 呼叫 `_cancel_task()` 再建新 task
3. 加 `async def _run_xxx()` — 確保 catch `CancelledError`
4. 在 `backend/main.py` 加對應的 `@app.post("/api/xxx")` 路由
5. 在 `frontend/app.js` 加按鈕 / 呼叫邏輯
6. 更新 `docs/API.md`
