# Evidence Report: 觸發 Pikmin Bloom 計步效果的技術方案

**日期：** 2026-04-23  
**Verdict：** CONDITIONALLY-SUPPORTED  
**主張：** 在不實際物理行走的情況下，可透過技術手段觸發 Pikmin Bloom 的 iOS 計步效果，搭配現有 pymobiledevice3 GPS 模擬工具鏈使用。

---

## 維度摘要

| 維度 | 狀態 | 信心度 | 主要依據 |
|------|------|--------|---------|
| D1 學術研究 | PARTIAL | MEDIUM | arXiv:1907.05972（加速度計漏洞），無直接步數注入論文 |
| D2 業界標準 | FOUND | HIGH | Apple HealthKit API 支援第三方寫入；CMPedometer 不允許外部注入 |
| D3 最佳實踐 | PARTIAL | MEDIUM | GitHub nextglabs/healthkit-write-steps 規避 user-entered flag |
| D4 社群共識 | PARTIAL | MEDIUM | 社群確認 HealthKit 背景注入有效；硬體搖晃器效果不一 |

---

## 衝突分析

| 技術方向 | D1 | D2 | D3 | D4 | 判定 |
|---|---|---|---|---|---|
| HealthKit 寫入假步數 | PARTIAL | CONFIRMED | FOR | FOR | **AGREE** |
| Core Motion / DVT 注入 | NOT-FOUND | NOT-DOCUMENTED | NOT-FOUND | NOT-FOUND | **AGREE（不可行）** |
| 外部硬體搖晃器 | NOT-FOUND | NOT-CONFIRMED | FOR | NUANCED | **PARTIAL** |

---

## 關鍵發現

### Pikmin Bloom 計步機制（確認）

| App 狀態 | 計步來源 | HealthKit 注入效果 |
|---|---|---|
| 前景（開著畫面）| Core Motion 加速度計（直接） | ❌ 無效 |
| 背景（按 Home 鍵）| Apple HealthKit | ✅ 有效（有延遲） |

### HealthKit 寫入技術細節

- Apple 官方允許第三方 App 以 `HKQuantityType(.stepCount)` 寫入步數
- 系統預設標記 `HKMetadataKeyWasUserEntered = true`
- 已知繞過方式：不帶 metadata 寫入，系統不自動加標記
- 參考實作：[nextglabs/healthkit-write-steps](https://github.com/nextglabs/healthkit-write-steps)
- 寫入後 Pikmin Bloom 背景模式可讀取，但可能有數小時延遲

### Core Motion 無法外部注入（確認）

- `CMPedometer` 從 iPhone M 晶片讀取，無公開寫入 API
- `pymobiledevice3` DVT 服務不提供 Core Motion 模擬
- DVT 僅支援：位置模擬、截圖、程序監控

---

## 推薦技術方案

### 方案 A：HealthKit 背景注入（推薦）

```
GPS 模擬 (FastAPI) → 計算步率 → GET /step-rate
iPhone Shortcut → 每 60 秒讀取 /step-rate → 寫入 HealthKit
Pikmin Bloom（背景）← 讀取 HealthKit
```

**步率計算：**
```
steps_per_minute = (speed_km_h × 1000 / 60) / stride_length_m
# stride_length ≈ 0.78m (平均步幅)
# 3.5 km/h → ~75 steps/min
# 5.0 km/h → ~107 steps/min
```

**實作方向：**
1. FastAPI 新增 `GET /step-rate` endpoint，回傳目前速度對應步率
2. iPhone Shortcuts：重複迴圈 → 呼叫 /step-rate → Log Health Sample (Steps)
3. 使用時：啟動 GPS 模擬 → 按 Home 鍵讓 Pikmin Bloom 進背景 → 跑 Shortcut

**限制：**
- HealthKit 同步可能延遲數分鐘至數小時
- Shortcut 需手動啟動（iOS 限制）

### 方案 B：硬體搖晃器（備選）

- 手機放在馬達驅動的平台上，模擬步行振動
- 前背景模式皆有效
- 無需軟體整合，但需外部硬體
- 振動頻率需模擬真實步行（約 1.5-2 Hz）

---

## Industry & Standards Reference

| 技術決策 | 參照依據 | 類型 | 來源 |
|---|---|---|---|
| HealthKit 允許第三方寫入步數 | Apple HealthKit Framework | 官方 API | https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/stepcount |
| CMPedometer 不允許外部注入 | Core Motion Documentation | 官方 API | https://developer.apple.com/documentation/coremotion/cmpedometer |
| HealthKit user-entered flag 繞過 | healthkit-write-steps | 開源實作 | https://github.com/nextglabs/healthkit-write-steps |

## Community Consensus & Dissenting Views

| 技術決策 | 社群共識 | 反面意見/已知陷阱 | 來源 |
|---|---|---|---|
| HealthKit 背景注入 | Pikmin Bloom 背景模式確實讀取 HealthKit | 延遲問題、Niantic 可能驗證數據真實性 | r/PikminBloom, gamerant.com |
| 硬體搖晃器 | 可觸發加速度計計步 | 需精確模擬步行頻率，效果不穩定 | 社群實測回報 |
