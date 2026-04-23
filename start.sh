#!/bin/bash
# myPikminGps — 一鍵啟動
# 用法：sudo ./start.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$SCRIPT_DIR/.venv/bin"

if [ ! -f "$VENV/python" ]; then
  echo "❌  找不到 .venv，請先執行："
  echo "    cd $SCRIPT_DIR"
  echo "    python3.13 -m venv .venv && source .venv/bin/activate"
  echo "    pip install -r requirements.txt"
  exit 1
fi

# 確認是 root（tunneld 需要 sudo）
if [ "$EUID" -ne 0 ]; then
  echo "❌  請用 sudo 執行：sudo ./start.sh"
  exit 1
fi

echo "🔌  啟動 tunneld（背景）..."
"$VENV/pymobiledevice3" remote tunneld &
TUNNELD_PID=$!

# 等 tunneld 就緒
sleep 2

echo "🌐  開啟瀏覽器..."
# 以原本使用者身份開啟瀏覽器（避免 sudo 開不了 GUI）
REAL_USER="${SUDO_USER:-$USER}"
su "$REAL_USER" -c "open http://127.0.0.1:8000" 2>/dev/null || true

echo "🌱  啟動 myPikminGps 伺服器  →  http://127.0.0.1:8000"
echo "    按 Ctrl+C 關閉所有服務"
echo ""

cleanup() {
  echo ""
  echo "🛑  正在關閉..."
  kill $TUNNELD_PID 2>/dev/null || true
  wait $TUNNELD_PID 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

cd "$SCRIPT_DIR"
"$VENV/python" -m backend.main

cleanup
