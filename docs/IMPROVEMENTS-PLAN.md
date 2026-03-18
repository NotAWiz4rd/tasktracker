# Improvements & New Features

## Phase 2 — Hardening & New Features

**Goal:** Close correctness gaps, tighten security for shared-network use, and add high-value features.

### 2a — Correctness & Security

1. **Fix race condition in `next_ticket_id()`** (`backend/store.py`)
    - Currently reads config, increments, then writes — with the file lock released between read and write
    - Fix: hold a single file lock across the read-increment-write sequence, or use a separate `counter.json` locked atomically
    - Prevents duplicate ticket IDs under concurrent creates

2. **Validate assignee, priority, and labels on write** (`backend/routers/tickets.py`, `backend/mcp_server.py`)
    - On create and update, check `assignee` against known user IDs, `priority` against config priorities, `labels` against config labels
    - Return 422 with a descriptive message instead of silently writing invalid data
    - Add corresponding tests

3. **Hash passwords** (`backend/auth.py`, `data/config.json`, `backend/seed.py`)
    - Replace plaintext passwords with bcrypt hashes (add `bcrypt` or `passlib[bcrypt]` to deps)
    - Update seed.py and login logic accordingly
    - Existing users in config.json get hashed passwords on first migration

4. **JWT secret from environment variable** (`backend/auth.py`)
    - Read secret from `JWT_SECRET` env var; fall back to dev default only when `DEBUG=true`
    - Document in CLAUDE.md and run.sh

5. **Login rate limiting** (`backend/main.py` or middleware)
    - Add a simple in-memory token-bucket or fixed-window rate limiter on `POST /api/login`
    - ~10 attempts per minute per IP is reasonable for a LAN app

6. **Tighten CORS** (`backend/main.py`)
    - Replace `allow_origins=["*"]` with an explicit origin list (e.g. `http://localhost:5173`)
    - Configurable via env var for deployment flexibility

7. **Request body size limit** (`backend/main.py`)
    - Add a middleware or Starlette `max_body_size` to cap request bodies (e.g. 1 MB)
    - Prevents accidental or malicious oversized payloads

### 2b — New Features

1. **Due dates on tickets**
    - Add optional `due_date` field (ISO date string) to ticket schema
    - Show due date on ticket cards with a red/yellow color if overdue/near
    - Filter bar: "overdue" filter option
    - MCP: expose `due_date` in create/update tools

2. **Ticket ordering within columns**
    - Add an `order` field to tickets (float or integer)
    - Enable drag-to-reorder within the same column (already supported by `@dnd-kit/sortable`)
    - Persist order via a new `PATCH /api/tickets/{id}/reorder` endpoint

3. **Notification / change indicator**
   - When polling detects a ticket was changed by someone else (author ≠ current user), highlight the card briefly
   - Optionally show a "N new updates" banner that clears on click

4. **Bulk actions**
   - Select multiple tickets (checkbox on hover) and bulk-assign, bulk-move, or bulk-delete
   - Useful for agent-created tickets needing human triage

5. **Column WIP limits**
   - Optional `wip_limit` on columns (stored in `columns.json`)
   - Show a warning badge when a column exceeds its limit
   - Configurable from a settings panel

6. **MCP `move_ticket` tool**
   - Dedicated tool for moving a ticket to a new status column
   - Currently agents must use `update_ticket` with a `status` field; a `move_ticket` tool with `from_status` validation is clearer

7. **Saved filters / views**
   - Let users save a named filter combination (e.g. "My open tickets")
   - Stored in `config.json` per user; selectable from a dropdown in the filter bar

8. **MCP unit tests**
   - Add `tests/test_mcp_server.py` testing all 8 tools directly (bypass HTTP, call the tool functions)
   - Cover happy paths + invalid input rejection

9. **End-to-end smoke test**
   - A single pytest integration test that spins up the FastAPI server and exercises login → create → update → move → delete
   - Runs in CI to catch regressions across the full stack
