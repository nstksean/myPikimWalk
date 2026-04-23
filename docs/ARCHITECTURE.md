# ARCHITECTURE.md — 系統架構

## 系統概覽

```
┌─────────────────────────────────────────────────────┐
│  Browser（Leaflet UI）                               │
│  frontend/app.js · joystick.js · panel.js            │
└────────────────┬──────────────────┬──────────────────┘
                 │ REST HTTP         │ WebSocket /ws
                 ▼                  ▼
┌─────────────────────────────────────────────────────┐
│  FastAPI Server（Python 3.13）                       │
│  backend/main.py                                     │
│  ├── SimulationEngine  (sim_engine.py)               │
│  ├── WSHub             (ws.py)                       │
│  ├── DeviceSession     (device.py)                   │
│  ├── walk_polyline()   (walker.py)                   │
│  ├── get_walking_route() (osrm.py)                   │
│  ├── build_full_polyline() (waypoints.py)            │
│  └── compute_delta*()  (joystick.py)                 │
└────────────────────────────────────────┬────────────┘
                                         │ pymobiledevice3
                                         │ DVT / RSD tunnel
                                         ▼
┌─────────────────────────────────────────────────────┐
│  iPhone（iOS 17+）                                   │
│  simulateLocationWithLatitude:longitude:              │
│  via LocationSimulation DVT service                  │
└─────────────────────────────────────────────────────┘
```

---

## 三層職責

| 層 | 職責 | 關鍵檔案 |
|---|---|---|
| **UI 層** | 地圖顯示、使用者輸入（點擊/搖桿/按鈕）、WS 接收位置更新 | `frontend/` |
| **模擬引擎層** | 狀態機管理模式切換、路徑插值計算、廣播位置更新 | `backend/sim_engine.py` `walker.py` `osrm.py` `waypoints.py` `joystick.py` |
| **裝置通訊層** | 封裝 pymobiledevice3 生命週期、呼叫 DVT simulateLocation | `backend/device.py` |

---

## 後端模組詳細說明

### `device.py` — DeviceSession

封裝 iOS 裝置連線的完整生命週期。

```python
class DeviceSession:
    async def connect(udid=None)        # 建立 RSD tunnel，掛載 DDI，啟動 LocationSimulation service
    async def disconnect()              # 清理位置，拆除所有 context managers
    async def set_location(lat, lng)    # 呼叫 simulateLocationWithLatitude:longitude:
    async def clear_location()          # 清除 GPS 模擬，iPhone 回到真實位置
```

使用 `AsyncExitStack` 管理多層 context manager（tunnel → lock → DvtProvider → LocationSimulation），確保任何一層失敗都能乾淨清理。

### `walker.py` — 步行引擎

**純計算函式，無 I/O**。`walk_polyline()` 是一個 async generator，沿著 polyline 座標串列，每 `tick_s` 秒 yield 一個 (lat, lng)。

設計選擇：
- 純函式 → 可獨立單元測試
- async generator → 與 asyncio cancel 機制自然整合
- ±10% 速度 jitter → 模擬真人的不規律步伐

### `osrm.py` — 路徑規劃

呼叫 OSRM 公共 API（`router.project-osrm.org`，步行 profile）取得 GeoJSON route，decode 成 polyline。若 HTTP 失敗，fallback 到兩點之間的直線。

### `joystick.py` — 方向計算

兩套 API：
- `compute_delta(held_keys, lat, speed_mps, tick_s)` — 離散鍵盤（WASD/方向鍵）
- `compute_delta_vector(vx, vy, lat, speed_mps, tick_s)` — 連續向量（圓形搖桿）

兩者都做 cos(lat) 校正：在高緯度地區，經度每度對應的實際距離較短，需要除以 cos(lat) 才能讓東西向移動距離正確。

### `waypoints.py` — 多點路線

把 N 個停留點拆成 N-1 段，每段呼叫 `osrm.py` 取步行路線，再拼接成完整 polyline。回傳時同步傳回各段停留時間（`dwell_s`）清單。

### `sim_engine.py` — 狀態機

核心設計：**單一 asyncio task + 模式枚舉**。

```
Mode: idle ──┐
             ├── navigate  (走到單點)
             ├── route     (多點循環)
             └── joystick  (實時控制)
```

模式切換流程：
1. `_cancel_task()` — cancel 現有 task，等最多 2 秒 cleanup
2. 設定 `self._mode` 到新模式
3. `asyncio.create_task()` 啟動新 task

這個「先 cancel 再建」的模式確保同時只有一個 task 在寫 `(lat, lng)`，避免 race condition。

### `ws.py` — WebSocket Hub

管理多個瀏覽器連線的 WebSocket：
- `broadcast()` — 把位置更新推送給所有連線的瀏覽器
- 接收搖桿輸入（`{"type": "keys"}` 或 `{"type": "vector"}`）並存到 `_hub` 狀態
- `get_vector()` / `get_held_keys()` 讓 `sim_engine.py` 輪詢

### `main.py` — FastAPI App

- `lifespan()` — 在 app 啟動時嘗試自動連線裝置；關閉時清理位置並斷線
- `_require_device()` — 所有需要裝置的端點都先確認已連線，否則回 503
- `/static` — 掛載 `frontend/` 目錄（直接 serve HTML/JS/CSS）

---

## 非同步設計原則

1. **單一寫入通道**：`DeviceSession.set_location()` 只由 `SimulationEngine._run_*` task 呼叫，永遠只有一個 task 在執行
2. **asyncio.Lock 保護模式切換**：`_lock` 確保 cancel + create 不會被並發請求交錯
3. **CancelledError 必須處理**：所有 `_run_*` task 都 catch `CancelledError` 避免 unhandled exception
4. **cleanup 在 finally 塊**：`_run_walk` 在 finally 把 mode 設回 idle，確保 UI 狀態同步

---

## 資料流時序圖（以「點地圖 → 走路」為例）

```
使用者點地圖
    │
    ▼
frontend/app.js:startNavigate(lat, lng)
    │  POST /api/navigate {lat, lng, speed_kmh}
    ▼
backend/main.py:navigate()
    │  engine.navigate(lat, lng, speed_kmh)
    ▼
sim_engine.py:navigate()
    │  get_walking_route(current, dest)  ──────────────▶ OSRM API
    │                                    ◀────────────── polyline
    │  _cancel_task() [舊 task 停止]
    │  create_task(_run_walk(polyline))
    ▼
_run_walk() [loop]
    │  walk_polyline() async generator
    │      每 1 秒 yield (lat, lng) with ±10% jitter
    │
    ├──▶ device.set_location(lat, lng)
    │        pymobiledevice3 simulateLocation
    │        iPhone GPS 更新
    │
    └──▶ hub.broadcast({type:"position", lat, lng, mode})
             │  WebSocket
             ▼
         frontend/app.js:ws.onmessage
             updatePosition(lat, lng)
             posMarker.setLatLng()  [Pikmin 角色移動]
             trailPolyline 更新     [綠色軌跡線]
```
