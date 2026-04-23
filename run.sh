#!/bin/bash
# myPikminGps launcher
# Usage: sudo ./run.sh
# Requires: sudo pymobiledevice3 remote tunneld  (running in another terminal)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$SCRIPT_DIR/.venv/bin/python"

if [ ! -f "$VENV" ]; then
  echo "❌  .venv not found. Run:"
  echo "    python3.13 -m venv .venv && source .venv/bin/activate"
  echo "    pip install -r requirements.txt"
  exit 1
fi

echo "🌱  Starting myPikminGps on http://127.0.0.1:8000"
echo "    Make sure 'sudo pymobiledevice3 remote tunneld' is running"
echo ""

cd "$SCRIPT_DIR"
exec "$VENV" -m backend.main
