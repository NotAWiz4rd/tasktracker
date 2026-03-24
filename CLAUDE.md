# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TaskTracker is a Kanban board application with a built-in Knowledge Base, backed by four components:
- **Backend**: FastAPI REST API with JSON file-based storage
- **Frontend**: React + TypeScript + Vite + Tailwind CSS kanban board + Knowledge Base
- **MCP Server**: FastAPI-less MCP server — direct file access, SSE/HTTP transport

## Development Commands

### Backend
```bash
# Install dependencies
pip install -e ".[dev]"

# Run development server
python -m uvicorn backend.main:app --reload
# Runs on http://localhost:8000 — Swagger docs at /docs
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # Dev server on http://localhost:5173
npm run build      # TypeScript check + production build
npm run lint       # ESLint
npm run preview    # Preview production build
```

### MCP Server
```bash
# Start the MCP server (required before opening Claude Code)
python backend/mcp_server.py --transport http           # localhost:8001 (default)
python backend/mcp_server.py --transport http --host 0.0.0.0 --port 8001  # remote/network
python backend/mcp_server.py --transport stdio          # stdio mode (not used by default)
```

The server URL is configured in `.mcp.json`. For local dev it points to `http://localhost:8001/sse`.
To connect Claude Code to a remote instance, update the `url` in `.mcp.json` to the remote host.

### Tests (Backend)
```bash
python -m pytest                                  # All tests
python -m pytest tests/test_tickets.py -v        # Specific file
python -m pytest -k test_create_ticket           # Single test by name
```

## Architecture

### Data Layer
All state lives in files under `data/`:
- `tickets.json` — ticket array
- `columns.json` — board column definitions
- `config.json` — users (with plaintext passwords), priorities, labels, `next_ticket_number` counter
- `kb/kb_index.json` — Knowledge Base article metadata (slug, title, tags, parent, timestamps)
- `kb/articles/{slug}.md` — Knowledge Base article content (one Markdown file per article)

`backend/store.py` provides file-locked read/write for tickets/columns/config. `backend/kb_store.py` provides the same for the Knowledge Base. The MCP server imports these modules directly — no HTTP round-trips to the backend API.

### Auto-Archiving
Tickets in "done" status with no activity for 30 days are automatically archived. Archiving runs on each ticket list read (API or MCP). Archived tickets have `archived: true` and `archived_at` fields. They are excluded from listings by default — pass `include_archived=true` query param (API) or `include_archived` tool arg (MCP) to include them. The frontend has a "Show archived" checkbox in the FilterBar. Archived tickets can be restored via `PATCH /api/tickets/{id}/unarchive` or the "Restore ticket" button in the TicketModal.

### Authentication
JWT tokens with a hardcoded dev secret (`"tasktracker-dev-secret-key-min32"`). Users/passwords are in `data/config.json`. 72-hour token expiry. The MCP server bypasses auth and accesses `store.py` directly, identifying itself as `agent:claude`.

### Frontend Data Flow
- `useAuth()` — JWT login/logout, token in `localStorage`
- `useTickets()` — polls every 5 seconds, owns all CRUD mutations
- `useArticles()` — polls every 10 seconds, owns all KB CRUD mutations
- All hooks are called from `App.tsx` and passed down as props
- Filtered view is computed with `useMemo` client-side
- `selectedTicketId` (string, not object) is tracked to stay in sync with polling

### API Proxy
Vite dev server proxies `/api/*` → `http://localhost:8000`, so frontend always uses relative `/api/` paths.

### Drag-and-Drop
Uses `@dnd-kit` (PointerSensor, 8px activation, `closestCenter` collision). Dropping a card on a column calls `PATCH /api/tickets/{id}/move` with `{ status }`.

## Key Endpoints
- `POST /api/login`, `GET /api/me`
- `GET/POST /api/tickets`, `GET/PATCH/DELETE /api/tickets/{id}`
- `POST /api/tickets/{id}/comments`, `PATCH /api/tickets/{id}/move`
- `GET /api/columns`, `GET /api/config`
- `GET/POST /api/kb`, `GET/PATCH/DELETE /api/kb/{slug}`

### Knowledge Base API
`backend/routers/kb.py` — all endpoints require auth, prefix `/api/kb`.

- `GET /api/kb` — list articles; query params: `tag`, `search` (title + content), `parent` (`root` for top-level or a slug)
- `POST /api/kb` — create article; body: `{ title, slug?, content?, tags?, parent? }`; slug auto-generated from title with collision suffixes
- `GET /api/kb/{slug}` — fetch article with content and children list
- `PATCH /api/kb/{slug}` — update title, content, tags, or parent (cycle detection prevents invalid reparenting)
- `DELETE /api/kb/{slug}` — delete article; orphaned children are re-parented to root

### MCP Server Architecture
`backend/mcp_server.py` exposes all ticket operations as MCP tools. It runs as a standalone process and connects to Claude Code via SSE over HTTP (configured in `.mcp.json`).

- Transport: SSE (`mcp.server.sse.SseServerTransport`) served via Starlette + Uvicorn on port 8001
- `.mcp.json` uses `url: "http://localhost:8001/sse"` — change the host to point at a remote instance
- Identifies all writes as `agent:claude`
- Tools: `list_tickets`, `get_ticket`, `create_ticket`, `update_ticket`, `delete_ticket`, `add_comment`, `get_board_summary`, `list_users`
- Resources: `tasktracker://board`, `tasktracker://tickets`, `tasktracker://ticket/{id}`

## Phase Status
- Phase 1 (Backend API): complete
- Phase 2 (Frontend): complete
- Phase 3 (MCP Server): complete
- Phase 4 (Knowledge Base): complete
- Phase 5 (Polish): not started
