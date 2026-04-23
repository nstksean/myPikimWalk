# HealthKit 步數注入

Pikmin Bloom 的計步來源取決於 App 狀態：

| App 狀態 | 計步來源 | GPS 模擬效果 |
|---|---|---|
| **前景**（App 開著）| Core Motion 加速度計 | ❌ |
| **背景**（按 Home 鍵）| Apple HealthKit | ✅ |

GPS 模擬負責種花，HealthKit 注入負責累積步數，兩者獨立。

---

## 步率換算

`GET /api/step-rate` 會根據目前速度回傳建議步率：

| 速度 | 步率 |
|---|---|
| 3.5 km/h（預設）| 74 步/分 |
| 5.0 km/h | 107 步/分 |

---

## iPhone Shortcut 設定步驟

1. 打開 **捷徑 (Shortcuts)** App → 右上角 **+** 新增捷徑
2. 新增動作「**重複**」→ 次數設 `999`
3. 在重複內新增「**取得 URL 內容**」
   - URL：`http://<Mac-IP>:8000/api/step-rate`
   - 方法：GET
4. 新增「**取得字典值**」
   - 字典：上一步的「URL 內容」
   - Key：`steps_per_minute`
5. 新增「**紀錄健康樣本**」
   - 類型：**步數 (Steps)**
   - 數量：上一步的「字典值」
   - 開始時間／結束時間：使用預設（**現在**）
6. 新增「**等待**」→ `60` 秒
7. 儲存捷徑，命名為「皮克敏步數」

> **Mac IP 查詢：** 系統設定 → 網路 → Wi-Fi → 詳細資訊 → IP 位址。
> iPhone 與 Mac 須在同一個 Wi-Fi 網路下。

---

## 使用流程

1. `sudo ./start.sh`（啟動 GPS 模擬）
2. 在瀏覽器設定好路線並開始移動
3. 打開 Pikmin Bloom → 按 **Home 鍵**（切到背景，不要殺掉）
4. 打開「皮克敏步數」捷徑 → 點執行
5. 捷徑會每 60 秒寫一次步數進 Apple Health

狀態欄會顯示「步數注入：74 步/分」，代表捷徑下次讀取的值。

---

## 注意事項

- Pikmin Bloom 讀取 HealthKit 可能延遲數分鐘，Lifelog 不會即時更新
- 調整速度後，步率會在捷徑下次輪詢時自動同步
- 停止 GPS 模擬後（`/api/stop`），`steps_per_minute` 會回到 0，捷徑停止寫入
- 此方法違反 Niantic 服務條款，使用後果自負
