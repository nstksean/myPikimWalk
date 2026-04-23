# DECISIONS.md — 架構決策記錄（ADR）

記錄在開發 myPikimWalk 過程中做出的 8 個關鍵決策，格式參考 Architecture Decision Records（ADR）。

---

## ADR-001：使用 pymobiledevice3 而非自己實作 DVT 協定

**Context**：要從 Mac 控制 iPhone 的 GPS，需要呼叫 Apple 私有 DVT（Developer Tools）協定的 `simulateLocationWithLatitude:longitude:` 方法。

**Decision**：直接依賴 `pymobiledevice3` 這個 Python 套件，不自己實作 DVT。

**Consequences**：
- ✅ 維護成本極低，作者 doronz88 持續追蹤 iOS 版本
- ✅ iOS 17+ 的 RSD tunnel 機制已支援
- ✅ DDI（Developer Disk Image）掛載、AMFI Developer Mode 開關都有現成 API
- ⚠️ 外部依賴，若套件棄置需要自己接手

**Alternatives considered**：
- `libimobiledevice` — C 語言寫的，Python binding 很薄，iOS 17+ tunnel 支援有限
- 自己逆向實作 DTX 協定 — 技術可行但維護成本極高，等同重造輪子

---

## ADR-002：Leaflet + 純 Vanilla JS，不用 React 或 Electron

**Context**：需要一個地圖 UI，使用者可以在地圖上點擊目的地、看到角色移動。

**Decision**：Leaflet 1.9（CDN）+ Vanilla JS，不引入任何前端框架，也不打包成桌面 App。

**Consequences**：
- ✅ 無建置步驟，git clone 完直接可用
- ✅ 整個前端 < 1000 行，一個人可以快速讀完
- ✅ 地圖功能成熟，免費圖磚來源豐富
- ⚠️ 若 UI 複雜度增加（例如要做 React 組件），需要重構

**Alternatives considered**：
- React — 過度工程，為 <1000 行的 UI 引入 build pipeline
- Electron — 打包成桌面 App 很重，也限制了多裝置共享 UI 的可能性
- locwarp（開源 iOS GPS spoofer）— 它的前端是 native macOS，無法跨平台、無法客製化

---

## ADR-003：速度上限從 5 km/h 提高到 10 km/h，改用 UI 警告

**Context**：Pikmin Bloom 對速度有步數計算上限（超過約 5 km/h 不計步）。最初把速度滑桿硬鎖在 5 km/h。

**Decision**：把 `MAX_SPEED_MPS` 改為 10 km/h 硬限制，但在 UI 上加黃色警告文字「⚠️ 超過 5 km/h 可能不計步」。

**Consequences**：
- ✅ 給使用者更多測試彈性（例如快速移動到另一個地區）
- ✅ 保留安全提示，使用者知情後自行決定
- ⚠️ 速度過快可能不計步，使用者需要自己承擔

**Alternatives considered**：
- 硬鎖 5 km/h — 太限制使用者，快速前往新地點時需要反覆跑腳本
- 完全不限制 — 無 UI 警告的話使用者可能不知道步數不會計

---

## ADR-004：±10% 速度抖動 + 1 Hz 更新頻率

**Context**：固定速度、固定更新頻率的 GPS 模擬容易被 Niantic 的異常偵測識別（太規律）。

**Decision**：每次 tick 以 ±10% 的範圍隨機浮動速度（`JITTER_FRACTION = 0.10`），更新頻率固定 1 Hz（`TICK_S = 1.0`）。

**Consequences**：
- ✅ 速度分佈接近真人走路的自然噪聲
- ✅ 1 Hz 對應 iOS `CLLocationManager` 的典型更新頻率
- ⚠️ 10% 抖動是經驗值，沒有 Niantic 官方文件支撐

**Alternatives considered**：
- 等速直線 — 最容易被偵測的模式
- 更高頻率（如 5 Hz）— 增加對 iPhone 的寫入次數，沒有額外好處

---

## ADR-005：tunneld 常駐 daemon 與伺服器分開，用 start.sh 統一入口

**Context**：iOS 17+ 需要 `pymobiledevice3 remote tunneld` 以 root 持續運行（建立 RSD tunnel）。最初要求使用者自己開兩個終端機分別跑 tunneld 和伺服器。

**Decision**：建立 `start.sh`，在同一個腳本裡以背景 process 啟動 tunneld，再前台啟動伺服器，`Ctrl+C` 同時清理兩者。

**Consequences**：
- ✅ 使用者只需要一個命令：`sudo ./start.sh`
- ✅ `trap cleanup INT TERM` 確保 tunneld 不會成為孤兒 process
- ⚠️ tunneld 和伺服器在不同 process，log 混在一個終端機

**Alternatives considered**：
- 在 FastAPI `lifespan` 內部用 `subprocess.Popen` 啟動 tunneld — tunneld 需要 root 而伺服器不應該長期 root；混合會讓生命週期複雜化

---

## ADR-006：搖桿從 D-pad（8 方向）改為圓形拖曳搖桿

**Context**：初版搖桿是 8 方向 D-pad（上下左右 + 對角），使用者回饋「太死板，我要能拖曳的圓形搖桿」。

**Decision**：重寫 `frontend/joystick.js`，改為：
- `#joystick-base`（140px 圓形底盤）
- `#joystick-thumb`（52px 綠色球）
- 支援 mouse + touch 拖曳
- 傳送連續向量 `{type:"vector", vx, vy}`（範圍 -1 ~ +1）
- 保留鍵盤 WASD 作為 fallback

**Consequences**：
- ✅ 操作直覺，支援任意方向和力道
- ✅ touch 支援讓手機瀏覽器也可以用
- ⚠️ 向量傳送頻率比鍵盤事件更高（pointerMove 每幀），需要在 sim_engine 端 throttle（已用 1 Hz tick 限制）

---

## ADR-007：預設地圖使用深色 CartoDB

**Context**：最初使用 OpenStreetMap 標準圖磚。使用者回饋「地圖太醜了」。

**Decision**：
- 預設圖磚改為 CartoDB Dark（`dark_all`），配合深色 UI 主題
- 新增圖磚切換器，提供三種選擇：🌑 深色 / 🗺 彩色 / 🛰 衛星（Esri）

**Consequences**：
- ✅ 深色圖磚配 `#1a1a2e` 背景一致性佳，視覺壓力小
- ✅ 三種切換讓使用者在導航時可選衛星圖確認地形
- ✅ CartoDB 和 Esri 圖磚都是免費使用（有使用限制，個人用量不會觸發）

**Alternatives considered**：
- Mapbox — 視覺效果最好，但需要 API key 且超量收費
- OSM 標準圖磚 — 免費，但彩色 + 密集資訊在深色 UI 裡不好看

---

## ADR-008：採用 async generator 設計 walk_polyline()

**Context**：走路邏輯需要「按時間一步一步產出位置」，同時需要能夠被 cancel。

**Decision**：`walker.py` 的 `walk_polyline()` 設計為 `AsyncGenerator[tuple[float, float], None]`，外層用 `async for` 消費。

**Consequences**：
- ✅ `asyncio.sleep(tick_s)` 在 generator 內部，`CancelledError` 自然冒泡出來到 `_run_walk()` 的 catch 塊
- ✅ 函式本身是純計算（輸入 polyline + 速度，輸出座標串流），可以完全獨立測試
- ✅ 不需要外部 timer 或 callback，asyncio 原生支援

**Alternatives considered**：
- Timer callback — 需要外部 state，較難 cancel 和測試
- 一次計算出所有位置再輸出 — 無法配合可變速度，且不真實（要邊走邊算下一步）
