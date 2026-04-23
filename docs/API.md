# API.md — REST 端點 + WebSocket 協定

Base URL: `http://127.0.0.1:8000`

---

## REST 端點

### `GET /api/status`

取得目前伺服器狀態。

**回應**
```json
{
  "mode": "idle",
  "lat": 25.03300,
  "lng": 121.56540,
  "speed_kmh": 3.5,
  "connected": true,
  "udid": "00008140-000A6C8A0A98801C",
  "ios_version": "18.4"
}
```

| 欄位 | 說明 |
|---|---|
| `mode` | `"idle"` / `"navigate"` / `"route"` / `"joystick"` |
| `lat`, `lng` | 目前模擬位置（上次已知位置）|
| `speed_kmh` | 目前速度設定 |
| `connected` | 裝置是否已連線 |
| `udid` | iPhone UDID（未連線時為 `null`）|
| `ios_version` | iOS 版本字串（未連線時為 `null`）|

---

### `POST /api/connect`

（重新）連線到 iOS 裝置。

**Query 參數**（可選）
- `udid` — 指定裝置 UDID，多台裝置時使用

**回應（成功）**
```json
{
  "connected": true,
  "udid": "00008140-000A6C8A0A98801C",
  "ios_version": "18.4"
}
```

**錯誤**
- `503` — 找不到裝置（tunneld 未啟動、USB 未插）

---

### `POST /api/teleport`

立即跳到指定座標（不走路）。

**Request Body**
```json
{ "lat": 25.0330, "lng": 121.5654 }
```

**回應**
```json
{ "ok": true, "lat": 25.0330, "lng": 121.5654 }
```

**注意**：teleport 跨越大距離（數公里）可能觸發 Niantic softban，請謹慎使用。

---

### `POST /api/navigate`

沿著 OSRM 步行路線走到目的地。

**Request Body**
```json
{
  "lat": 25.0400,
  "lng": 121.5700,
  "speed_kmh": 3.5
}
```

| 欄位 | 型別 | 預設 | 限制 |
|---|---|---|---|
| `lat` | float | 必填 | -90 ~ 90 |
| `lng` | float | 必填 | -180 ~ 180 |
| `speed_kmh` | float | 3.5 | 0.5 ~ 10.0 |

**回應**
```json
{ "ok": true, "mode": "navigate", "dest": { "lat": 25.0400, "lng": 121.5700 } }
```

---

### `POST /api/route`

執行多點循環路線。

**Request Body**
```json
{
  "waypoints": [
    { "lat": 25.0330, "lng": 121.5654, "dwell_s": 5 },
    { "lat": 25.0350, "lng": 121.5670, "dwell_s": 10 },
    { "lat": 25.0310, "lng": 121.5640, "dwell_s": 5 }
  ],
  "speed_kmh": 3.5,
  "loop": true
}
```

| 欄位 | 型別 | 預設 | 限制 |
|---|---|---|---|
| `waypoints` | array | 必填 | 至少 2 個 |
| `waypoints[].dwell_s` | float | 5.0 | ≥ 0 |
| `speed_kmh` | float | 3.5 | 0.5 ~ 10.0 |
| `loop` | bool | false | — |

**回應**
```json
{ "ok": true, "mode": "route", "waypoints": 3, "loop": true }
```

---

### `POST /api/joystick/start`

啟動搖桿模式。之後透過 WebSocket 傳送方向輸入。

**Request Body**（可選）
```json
{ "speed_kmh": 3.5 }
```

**回應**
```json
{ "ok": true, "mode": "joystick" }
```

---

### `GET /api/step-rate`

取得目前速度對應的 HealthKit 步率，供 iPhone Shortcut 使用。

**回應**
```json
{
  "speed_kmh": 3.5,
  "steps_per_minute": 74,
  "stride_length_m": 0.78,
  "active": true
}
```

| 欄位 | 說明 |
|---|---|
| `speed_kmh` | 目前速度設定 |
| `steps_per_minute` | 建議每分鐘寫入 HealthKit 的步數（mode=idle 時為 0）|
| `stride_length_m` | 計算用步幅（0.78 m，固定值）|
| `active` | `true` 表示目前有移動模式在跑，Shortcut 應寫入步數 |

> iPhone Shortcut 每 60 秒輪詢此 endpoint，讀取 `steps_per_minute` 後寫入 Apple Health。
> 詳見 [HEALTHKIT_STEPS.md](HEALTHKIT_STEPS.md)。

---

### `POST /api/speed`

即時更新移動速度（在任何模式下都可以呼叫）。

**Request Body**
```json
{ "speed_kmh": 4.0 }
```

**回應**
```json
{ "ok": true, "speed_kmh": 4.0 }
```

---

### `POST /api/stop`

停止所有移動，回到 idle 模式。

**Request Body**：無

**回應**
```json
{ "ok": true, "mode": "idle" }
```

---

## WebSocket `/ws`

連線位址：`ws://127.0.0.1:8000/ws`

---

### 下行訊息（Server → Browser）

#### position 事件

每 1 秒廣播一次（當模式不是 idle 且有位置更新時）。

```json
{
  "type": "position",
  "lat": 25.03312,
  "lng": 121.56548,
  "mode": "navigate"
}
```

---

### 上行訊息（Browser → Server）

#### 鍵盤輸入（離散方向）

```json
{
  "type": "keys",
  "keys": ["w", "a"]
}
```

`keys` 陣列可包含的值：`"w"`, `"a"`, `"s"`, `"d"`, `"ArrowUp"`, `"ArrowLeft"`, `"ArrowDown"`, `"ArrowRight"`

#### 搖桿向量（連續方向）

```json
{
  "type": "vector",
  "vx": 0.5,
  "vy": -0.3
}
```

- `vx`：東西方向，`-1.0`（全西）到 `+1.0`（全東）
- `vy`：南北方向，`-1.0`（全南）到 `+1.0`（全北）
- 搖桿放開時前端傳 `{"type": "vector", "vx": 0, "vy": 0}`

---

## 通用錯誤碼

| HTTP 狀態碼 | 原因 |
|---|---|
| `422 Unprocessable Entity` | 請求 body 驗證失敗（欄位缺失、超出範圍）|
| `503 Service Unavailable` | 裝置未連線，或 Engine 未初始化 |
