# myPikimWalk — 文件索引

這裡是給開發者、協作者、和 AI agent 看的技術文件。如果你只是想**安裝使用**，請看根目錄的 [README.md](../README.md)。

---

## 文件目錄

| 檔案 | 用途 | 適合誰 |
|---|---|---|
| [AGENTS.md](AGENTS.md) | AI agent 快速接手指南 | LLM agent、自動化工具 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 系統設計、模組圖、資料流 | 想理解整體架構的人 |
| [API.md](API.md) | REST 端點 + WebSocket 協定規格 | 前端開發者、API 整合 |
| [DECISIONS.md](DECISIONS.md) | 8 條關鍵架構決策（ADR 格式） | 想了解「為什麼這樣做」的人 |
| [IOS_SETUP.md](IOS_SETUP.md) | iPhone Developer Mode 完整設定 | 第一次用的人、疑難排解 |
| [HISTORY.md](HISTORY.md) | 從 0 到 ship 的開發歷程 | 想了解設計演化脈絡 |
| [TECH_STACK.md](TECH_STACK.md) | 所有依賴與版本、選擇理由 | 評估技術棧的人 |
| [ANTI_DETECTION.md](ANTI_DETECTION.md) | 反偵測參數設計依據 | 調整參數前必讀 |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 常見錯誤與解法 | 出問題的時候 |
| [ROADMAP.md](ROADMAP.md) | 未來可加功能 + 已知限制 | 想擴充功能的人 |

---

## 快速定向

```
想改移動速度或抖動參數   → backend/walker.py  +  ANTI_DETECTION.md
想加新的移動模式         → backend/sim_engine.py  +  ARCHITECTURE.md
想改地圖樣式             → frontend/app.js (TILE_STYLES)
想加新的 API 端點        → backend/main.py  +  API.md
想了解 iOS 連線原理      → backend/device.py  +  IOS_SETUP.md
遇到連線問題             → TROUBLESHOOTING.md
```

> **注意**：程式碼永遠是 source of truth。若文件和程式碼有衝突，以程式碼為準，並請更新文件。
