# TECH_STACK.md — 技術棧與選擇理由

## 後端

| 元件 | 版本 | 為何選它 | 捨棄的替代方案 |
|---|---|---|---|
| **Python** | 3.13 | pymobiledevice3 最新版支援的版本；asyncio 最完整 | 3.11（太舊，部分新 syntax 不支援）|
| **pymobiledevice3** | ≥9.0 | iOS 17+ 的事實標準；DVT API 最完整；作者持續維護 | libimobiledevice（無 iOS 17 tunnel 支援）、自行實作 DVT（維護成本極高）|
| **FastAPI** | ≥0.130 | async 原生、lifespan 管理乾淨、內建 WebSocket、Pydantic 驗證 | Flask（同步，不適合 asyncio）、aiohttp（WebSocket API 較繁瑣）|
| **uvicorn** | ≥0.46 | FastAPI 官方推薦的 ASGI server；`[standard]` extra 含 websockets | gunicorn（多 worker 對這個場景沒必要）|
| **httpx** | ≥0.28 | async HTTP client，呼叫 OSRM API；FastAPI 測試用 | aiohttp（API 較繁瑣）、requests（同步）|

## 前端

| 元件 | 版本 | 為何選它 | 捨棄的替代方案 |
|---|---|---|---|
| **Leaflet** | 1.9.4（CDN）| 成熟穩定、無建置步驟、免費圖磚豐富、API 直覺 | Mapbox GL JS（需要 API key）、Google Maps（需要 key + 收費）、OpenLayers（太複雜）|
| **CartoDB 圖磚** | 公共（免費）| 深色主題配 UI、彩色版清晰；不需要 API key | OSM 標準圖磚（配色與深色 UI 不協調）、Mapbox（要 key）|
| **Esri 衛星圖磚** | ArcGIS REST 公共 | 免費、解析度夠、全球覆蓋 | Google Satellite（要 key）|
| **Vanilla JS** | ES2022+（module）| 無建置步驟；整個前端 <1000 行不需要框架 | React（過度工程）、Vue（一樣過度）、Electron（要打包，失去 Web 的可及性）|

## iOS 連線

| 元件 | 說明 |
|---|---|
| **DVT（Developer Tools）協定** | Apple 私有協定，Instruments App 用的底層傳輸；`simulateLocationWithLatitude:longitude:` 是其中的一個方法 |
| **RSD（Remote Service Discovery）** | iOS 17+ 新增的 USB/WiFi tunnel 機制，取代舊的 AFC/usbmux 直連 |
| **DDI（Developer Disk Image）** | 掛載後開啟 iOS 上的開發者服務；iOS 17+ 使用 Personalized DDI，pymobiledevice3 自動處理 |
| **AMFI** | Apple Mobile File Integrity；管理 Developer Mode 開關（`enable-developer-mode` 命令）|

## 路徑規劃

| 元件 | 版本 | 說明 |
|---|---|---|
| **OSRM** | 公共 demo server | `router.project-osrm.org`；步行 profile；免費使用 |
| fallback | 直線內插 | OSRM API 失敗時，退回兩點之間的直線路徑 |

OSRM 請求格式：
```
GET https://router.project-osrm.org/route/v1/foot/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson
```

## 系統依賴

```bash
brew install libimobiledevice   # idevice_id 等 USB 工具
```

`libimobiledevice` 提供 `idevice_id -l` 列出 iPhone，是 pymobiledevice3 USB 連線的基礎工具鏈。

---

## requirements.txt

```
pymobiledevice3>=9.0
fastapi>=0.130
uvicorn[standard]>=0.46
httpx>=0.28
```

這四個是完整的依賴集合，沒有不必要的套件。
