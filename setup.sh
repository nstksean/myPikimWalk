#!/bin/bash
# myPikimWalk — 首次設定腳本
# 用法：./setup.sh（不需要提前 sudo，內部步驟會自己 prompt）
#
# 這個腳本是冪等的：可以重複執行，已完成的步驟會自動跳過。

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 顏色輸出 ────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $*${NC}"; }
info() { echo -e "${CYAN}ℹ️  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
die()  { echo -e "${RED}❌ $*${NC}"; exit 1; }

echo ""
echo -e "${GREEN}🌱 myPikimWalk 首次設定${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. 平台確認 ──────────────────────────────────────────────────────────────
if [ "$(uname -s)" != "Darwin" ]; then
  die "目前只支援 macOS。你的系統是 $(uname -s)。"
fi
ok "macOS 確認"

# ── 2. 確認在專案根目錄 ───────────────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/backend/main.py" ]; then
  die "找不到 backend/main.py，請確認在 myPikimWalk 根目錄執行：\n    cd $SCRIPT_DIR\n    ./setup.sh"
fi
ok "專案目錄確認"

# ── 3. Homebrew ───────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  die "找不到 Homebrew。請先安裝：\n    /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"\n\n安裝完後重新執行 ./setup.sh"
fi
ok "Homebrew 已安裝"

# ── 4. libimobiledevice ───────────────────────────────────────────────────────
if ! brew list libimobiledevice &>/dev/null; then
  info "安裝 libimobiledevice（提供 idevice_id 等工具）..."
  brew install libimobiledevice
fi
ok "libimobiledevice 已安裝"

# ── 5. Python 3.13 ───────────────────────────────────────────────────────────
if ! command -v python3.13 &>/dev/null; then
  info "安裝 Python 3.13（pymobiledevice3 需要）..."
  brew install python@3.13
  # 確保 3.13 在 PATH
  export PATH="$(brew --prefix python@3.13)/bin:$PATH"
fi
if ! command -v python3.13 &>/dev/null; then
  die "python3.13 安裝後仍找不到，請重新開啟終端機再試"
fi
PYTHON_VER=$(python3.13 --version 2>&1)
ok "Python $PYTHON_VER"

# ── 6. 虛擬環境 ───────────────────────────────────────────────────────────────
VENV="$SCRIPT_DIR/.venv"
if [ ! -d "$VENV" ]; then
  info "建立 Python 虛擬環境（.venv）..."
  python3.13 -m venv "$VENV"
fi
ok "虛擬環境 .venv 已就緒"

# ── 7. pip 依賴 ───────────────────────────────────────────────────────────────
info "安裝 Python 套件（pymobiledevice3, fastapi, uvicorn, httpx）..."
"$VENV/bin/pip" install --upgrade pip --quiet
"$VENV/bin/pip" install -r "$SCRIPT_DIR/requirements.txt" --quiet
ok "Python 套件安裝完成"

echo ""
echo -e "${CYAN}━━━ iPhone 設定 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── 8. 裝置偵測 ───────────────────────────────────────────────────────────────
info "請解鎖 iPhone 螢幕（輸入密碼到主畫面），用 USB 資料線連接 Mac。"
info "iPhone 若彈出「是否信任此電腦？」請點信任並輸入密碼。"
echo ""

UDID=""
for ATTEMPT in 1 2 3; do
  read -r -p "$(echo -e "${YELLOW}▶ 準備好後按 Enter 繼續...${NC}")"
  UDID=$(idevice_id -l 2>/dev/null | head -1)
  if [ -n "$UDID" ]; then
    break
  fi
  if [ "$ATTEMPT" -lt 3 ]; then
    warn "找不到 iPhone。請確認：\n   1. USB 線支援資料傳輸（非純充電線）\n   2. iPhone 已解鎖\n   3. iPhone 上點了「信任此電腦」\n\n再試一次..."
  fi
done

if [ -z "$UDID" ]; then
  die "嘗試 3 次後仍找不到 iPhone。\n\n排查步驟：\n   1. 換一條 USB 資料傳輸線\n   2. 確認 iPhone 解鎖後插上 Mac\n   3. 點 iPhone 上的「信任此電腦」\n\n排查完後重新執行 ./setup.sh"
fi
ok "找到 iPhone：${UDID}"

# ── 9. Developer Mode 狀態檢查 ────────────────────────────────────────────────
info "檢查 Developer Mode 狀態..."

DEV_MODE_STATUS=""
if sudo "$VENV/bin/pymobiledevice3" amfi developer-mode-status 2>&1 | grep -qi "enabled"; then
  DEV_MODE_STATUS="enabled"
fi

if [ "$DEV_MODE_STATUS" = "enabled" ]; then
  ok "Developer Mode 已啟用，跳過此步驟"
else
  echo ""
  info "Developer Mode 尚未啟用。即將執行啟用程序..."
  warn "請確認 iPhone 螢幕已解鎖（看得到主畫面），否則會失敗。"
  echo ""
  read -r -p "$(echo -e "${YELLOW}▶ iPhone 螢幕解鎖後按 Enter 繼續...${NC}")"

  ENABLE_OUTPUT=$(sudo "$VENV/bin/pymobiledevice3" amfi enable-developer-mode 2>&1 || true)

  if echo "$ENABLE_OUTPUT" | grep -qi "passcode is set"; then
    die "iPhone 螢幕鎖定中。\n請解鎖 iPhone（輸入密碼到主畫面），然後重新執行 ./setup.sh"
  fi

  echo ""
  ok "Developer Mode 啟用指令已送出"
  echo ""
  warn "iPhone 可能會自動重啟。重啟後請："
  echo "   1. 解鎖 iPhone"
  echo "   2. 螢幕上方出現「開啟開發者模式」橫幅 → 點開，輸入密碼"
  echo "      （或到：設定 → 隱私權與安全性 → 開發者模式 → 開啟 → 重啟）"
  echo ""
  read -r -p "$(echo -e "${YELLOW}▶ 完成 iPhone 上的操作後，按 Enter 繼續...${NC}")"
fi

# ── 10. 最終驗證 ──────────────────────────────────────────────────────────────
info "驗證裝置連線..."
FINAL_UDID=$(idevice_id -l 2>/dev/null | head -1)
if [ -z "$FINAL_UDID" ]; then
  warn "找不到裝置。如果 iPhone 剛重啟，請等待 10 秒後重新插上 USB，再次執行 ./setup.sh"
fi

# ── 11. 完成 ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🌱 設定完成！${NC}"
echo ""
echo "   之後每次啟動只需要："
echo ""
echo -e "   ${CYAN}sudo ./start.sh${NC}"
echo ""
echo "   腳本會自動啟動服務並開啟瀏覽器 http://127.0.0.1:8000"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
