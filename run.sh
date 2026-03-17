#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> Installing Python dependencies..."
pip install -e ".[dev]" -q

echo "==> Installing frontend dependencies..."
(cd frontend && npm install --silent)

echo "==> Seeding data (if needed)..."
python -c "from backend.seed import seed_data; seed_data()"

echo "==> Starting TaskTracker..."
echo "    Backend:    http://localhost:8000"
echo "    Frontend:   http://localhost:5173"
echo "    MCP Server: http://localhost:8001"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

cleanup() {
  echo ""
  echo "Stopping services..."
  kill "$BACKEND_PID" "$MCP_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

python -m uvicorn backend.main:app --port 8000 --reload &
BACKEND_PID=$!

python backend/mcp_server.py --transport http --port 8001 &
MCP_PID=$!

(cd frontend && npm run dev) &
FRONTEND_PID=$!

wait
