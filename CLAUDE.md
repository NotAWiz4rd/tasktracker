# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TaskTracker is a Kanban board application with three components:
- **Backend**: FastAPI REST API with JSON file-based storage
- **Frontend**: React + TypeScript + Vite + Tailwind CSS kanban board
- **MCP Server**: (Phase 3, not yet implemented) — direct file access, no HTTP auth

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

### Tests (Backend)
```bash
pytest                                  # All tests
pytest tests/test_tickets.py -v        # Specific file
pytest -k test_create_ticket           # Single test by name
```

## Architecture

### Data Layer
All state lives in three JSON files in `data/`:
- `tickets.json` — ticket array
- `columns.json` — board column definitions
- `config.json` — users (with plaintext passwords), priorities, labels, `next_ticket_number` counter

`backend/store.py` provides file-locked read/write. This same module will be reused directly by the MCP server (no HTTP layer).

### Authentication
JWT tokens with a hardcoded dev secret (`"tasktracker-dev-secret-key-min32"`). Users/passwords are in `data/config.json`. 72-hour token expiry. The MCP server will bypass auth and access store.py directly, identifying itself as `agent:claude`.

### Frontend Data Flow
- `useAuth()` — JWT login/logout, token in `localStorage`
- `useTickets()` — polls every 5 seconds, owns all CRUD mutations
- Both hooks are called from `App.tsx` and passed down as props
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

## Phase Status
- Phase 1 (Backend API): complete
- Phase 2 (Frontend): complete
- Phase 3 (MCP Server): not started — see `docs/PLAN.md` for design
- Phase 4 (Polish): not started
