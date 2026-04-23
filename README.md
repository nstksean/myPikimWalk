# 🌱 myPikimWalk

> 雨天也能玩皮克敏！在家透過 Mac 模擬 iPhone GPS，讓角色在地圖上走路、累積步數、種花。

![map preview](https://img.shields.io/badge/iOS-17%2B-blue) ![python](https://img.shields.io/badge/Python-3.13-green) ![license](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 這是什麼

myPikimWalk 是一個開源的 iOS GPS 模擬工具，專為 **Pikmin Bloom** 設計。透過 USB 連接 iPhone，在瀏覽器地圖上點擊目的地或拖曳搖桿，iPhone 就會模擬走路，自動累積步數與種花路徑。

**底層原理**：使用 Apple 官方開發者工具協議（DVT / Instruments），透過 [`pymobiledevice3`](https://github.com/doronz88/pymobiledevice3) 呼叫 `simulateLocationWithLatitude:longitude:`，與 iAnyGo、AnyGo 等商業工具完全相同的技術，但完全免費且可客製化。

---

## 功能

| 功能 | 說明 |
|---|---|
| 🗺 **擬真步行導航** | 點地圖目的地，走 OSRM 步行道路，速度與抖動模擬真人 |
| 📍 **定位目前位置** | 一鍵以瀏覽器 GPS 定位真實座標作為出發點 |
| 🔄 **多點循環路線** | Shift+點擊設定多個停留點，可無限循環（掛機刷花） |
| 🕹 **圓形搖桿** | 拖曳搖桿或 WASD/方向鍵即時控制方向 |
| 🌑🗺🛰 **三種地圖樣式** | 深色 / 彩色街道 / 衛星圖，右上角一鍵切換 |
| ⚡️ **速度調整** | 0.5–10 km/h 可調，超過 5 km/h 會提示不計步 |
| 🛡 **反偵測預設** | 預設 3.5 km/h + ±10% 速度抖動，避免 Niantic 軟封 |
| 🚶 **HealthKit 步數注入** | 搭配 iPhone 捷徑自動寫步數進 Apple Health，遊戲背景模式可計步（見 [docs/HEALTHKIT_STEPS.md](docs/HEALTHKIT_STEPS.md)）|

---

## 系統需求

**Mac**
- macOS 14+
- iPhone（iOS 17 或更新）
- USB 傳輸線（支援資料傳輸，非純充電線）
- Python 3.13（`setup.sh` 自動安裝）

**Windows**
- Windows 10 / 11
- iPhone（iOS 17 或更新）
- USB 傳輸線（支援資料傳輸，非純充電線）
- iTunes（Microsoft Store 版，`setup.ps1` 會引導）
- Python 3.13（`setup.ps1` 自動安裝）

---

## 安裝與設定

### Mac

```bash
# 1. Clone 專案
git clone https://github.com/nstksean/myPikimWalk.git
cd myPikimWalk

# 2. 首次設定（安裝依賴 + iPhone Developer Mode，約 5–10 分鐘）
./setup.sh
```

### Windows

```powershell
# 1. Clone 專案
git clone https://github.com/nstksean/myPikimWalk.git
cd myPikimWalk

# 2. 允許執行腳本（第一次需要，以系統管理員 PowerShell 執行）
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# 3. 首次設定（安裝依賴 + iPhone Developer Mode，約 5–10 分鐘）
.\setup.ps1
```

> 遇到問題請看 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) 或 [docs/IOS_SETUP.md](docs/IOS_SETUP.md)。

---

## 啟動

### Mac

```bash
sudo ./start.sh
```

### Windows（以系統管理員 PowerShell 執行）

```powershell
.\start.ps1
```

腳本會自動：
1. 啟動 iOS tunneld（背景常駐）
2. 等待裝置連線
3. 打開瀏覽器 `http://127.0.0.1:8000`
4. 啟動伺服器

按 `Ctrl+C` 關閉所有服務。

---

## 使用方式

### 導航模式（走到某個點）
1. 切到「導航」分頁
2. 點擊 **📍 定位我的位置** 以真實位置為起點
3. 在地圖上點擊目的地
4. iPhone 開始沿步行路徑移動

### 多點循環（掛機刷花）
1. 切到「多點路線」分頁
2. **Shift + 點擊**地圖，依序新增 3–5 個停留點
3. 勾選「循環」
4. 點「開始路線」→ 放著讓它自動走

### 搖桿模式（手動控制）
1. 切到「搖桿」分頁 → 點「啟動搖桿」
2. 拖曳圓形搖桿，或按 `WASD` / 方向鍵
3. 放開搖桿立即停止

---

## 速度建議

| 速度 | 效果 |
|---|---|
| 3.5 km/h（預設）| 正常步伐，步數完整計算 |
| 5 km/h | 快走上限，步數仍可計算 |
| > 5 km/h | ⚠️ Pikmin Bloom 可能不計步 |

---

## 技術架構

```
Browser (Leaflet) ◀─── REST / WebSocket ───▶ FastAPI (Python)
                                                    │
                                              pymobiledevice3
                                                    │ USB
                                               iPhone (DVT)
                                          simulateLocation(lat, lng)
```

| 元件 | 技術 |
|---|---|
| 後端 | Python 3.13 + FastAPI + uvicorn |
| 裝置通訊 | pymobiledevice3 9.x（DVT RSD tunnel）|
| 路徑規劃 | OSRM 公共 API（步行 profile）|
| 前端 | Vanilla JS + Leaflet 1.9 |
| 地圖圖磚 | CartoDB / Esri（免費）|

---

## 注意事項

- 此工具僅供個人學習研究使用
- GPS 模擬違反 Niantic 服務條款，使用後果自負
- 建議速度不超過 5 km/h，避免帳號被偵測

---

## 📚 深入文件

| 想了解 | 去讀 |
|---|---|
| 系統架構 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 技術選擇理由 | [docs/TECH_STACK.md](docs/TECH_STACK.md) |
| AI agent 接手指南 | [docs/AGENTS.md](docs/AGENTS.md) |
| API 規格 | [docs/API.md](docs/API.md) |
| iPhone 詳細設定 | [docs/IOS_SETUP.md](docs/IOS_SETUP.md) |
| 遇到問題 | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| 反偵測設計 | [docs/ANTI_DETECTION.md](docs/ANTI_DETECTION.md) |
| 所有決策與歷程 | [docs/DECISIONS.md](docs/DECISIONS.md) · [docs/HISTORY.md](docs/HISTORY.md) |
| 未來規劃 | [docs/ROADMAP.md](docs/ROADMAP.md) |

---

## 授權

MIT License
