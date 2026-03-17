# TaskTracker — Implementation Plan

A lightweight, local-network kanban board with an MCP interface for agent collaboration.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  React Frontend │────▶│  FastAPI Backend  │◀────│   MCP Server     │
│  (Vite + React) │     │  (REST API)      │     │  (stdio/SSE)     │
└─────────────────┘     └────────┬─────────┘     └──────────────────┘
                                 │
                        ┌────────▼─────────┐
                        │  JSON File Store  │
                        │  /data/*.json     │
                        └──────────────────┘
```

### Tech Stack

| Layer       | Technology                    | Why                                          |
|-------------|-------------------------------|----------------------------------------------|
| Frontend    | React 18 + Vite + TypeScript  | Fast dev, good DX, lightweight               |
| UI          | Tailwind CSS + dnd-kit        | Minimal setup, native drag-and-drop          |
| Backend     | FastAPI (Python 3.11+)        | Already set up, async, auto OpenAPI docs     |
| Data Store  | JSON files on disk            | Zero dependencies, human-readable, git-able  |
| MCP Server  | Python (`mcp` SDK)            | First-class Claude/agent integration         |

### Data Storage Design

All data lives in `/data/` as JSON files:

```
data/
├── tickets.json          # All tickets (array)
├── columns.json          # Board column definitions
└── config.json           # Users, labels, priorities
```

**Ticket schema:**
```json
{
  "id": "TT-42",
  "title": "Implement login flow",
  "description": "Markdown-supported description",
  "status": "in-progress",
  "assignee": "mike",
  "priority": "high",
  "labels": ["backend"],
  "created_by": "mike",
  "created_at": "2026-03-17T10:00:00Z",
  "updated_at": "2026-03-17T12:30:00Z",
  "comments": [
    {
      "id": "c-1",
      "author": "agent:claude",
      "body": "I've started working on this.",
      "created_at": "2026-03-17T11:00:00Z"
    }
  ]
}
```

**Column schema (columns.json):**
```json
{
  "columns": [
    { "id": "backlog", "name": "Backlog", "order": 0 },
    { "id": "todo", "name": "To Do", "order": 1 },
    { "id": "in-progress", "name": "In Progress", "order": 2 },
    { "id": "review", "name": "Review", "order": 3 },
    { "id": "done", "name": "Done", "order": 4 }
  ]
}
```

**Config schema (config.json):**
```json
{
  "users": [
    { "id": "mike", "name": "Mike", "password": "1234", "avatar_color": "#4F46E5" },
    { "id": "user2", "name": "User 2", "password": "1234", "avatar_color": "#059669" },
    { "id": "user3", "name": "User 3", "password": "1234", "avatar_color": "#D97706" }
  ],
  "priorities": ["low", "medium", "high", "urgent"],
  "labels": ["backend", "frontend", "bug", "feature", "infra"],
  "next_ticket_number": 1
}
```

**File locking:** Use `filelock` (Python) to prevent concurrent writes from the API and MCP server corrupting files.

### Authentication

Simple login to keep casual network users out and prevent accidental identity mix-ups:

- Users and passwords are hardcoded in `config.json` (all default to `1234`)
- `POST /api/login` accepts `{ "username": "mike", "password": "1234" }` and returns a JWT token (signed with a hardcoded secret — this is LAN-only, not a security-critical app)
- The JWT contains the user ID and is sent as `Authorization: Bearer <token>` on all subsequent requests
- Frontend stores the token in `localStorage` and shows a login screen if no valid token is present
- The MCP server bypasses auth entirely — it accesses the data layer directly, not through HTTP, and identifies as `agent:<agent-name>`
- `GET /api/config` returns users (without passwords) so the login screen can show a user list for convenience

---

## Phase 1 — Backend API + Data Layer

**Goal:** Working REST API with file-based storage, all CRUD operations for tickets.

### Tasks

1. **Project setup**
   - Initialize `pyproject.toml` with dependencies: `fastapi`, `uvicorn`, `filelock`, `pydantic`, `pyjwt`
   - Create directory structure:
     ```
     backend/
     ├── main.py              # FastAPI app, CORS, lifespan
     ├── models.py            # Pydantic models (Ticket, Column, Config, etc.)
     ├── store.py             # JSON file read/write with locking
     ├── auth.py              # JWT helpers, login endpoint, auth dependency
     ├── routers/
     │   ├── tickets.py       # Ticket CRUD endpoints
     │   ├── columns.py       # Column management
     │   └── config.py        # Users, labels, priorities
     └── seed.py              # Creates initial data files
     ```
   - Create `data/` directory with seed data

2. **Data layer (`store.py`)**
   - `read_json(path) -> dict/list` — read + parse with filelock
   - `write_json(path, data)` — serialize + write with filelock
   - Auto-increment ticket IDs (`TT-1`, `TT-2`, …)

3. **API endpoints**

   | Method   | Path                          | Description                    |
   |----------|-------------------------------|--------------------------------|
   | `POST`   | `/api/login`                  | Authenticate, returns JWT      |
   | `GET`    | `/api/me`                     | Get current user from token    |
   | `GET`    | `/api/tickets`                | List all tickets (with filters)|
   | `POST`   | `/api/tickets`                | Create a ticket                |
   | `GET`    | `/api/tickets/{id}`           | Get single ticket              |
   | `PATCH`  | `/api/tickets/{id}`           | Update ticket fields           |
   | `DELETE` | `/api/tickets/{id}`           | Delete a ticket                |
   | `POST`   | `/api/tickets/{id}/comments`  | Add a comment                  |
   | `PATCH`  | `/api/tickets/{id}/move`      | Change status (column)         |
   | `GET`    | `/api/columns`                | List columns                   |
   | `GET`    | `/api/config`                 | Get users, labels, priorities  |

   **Filtering (query params on `GET /api/tickets`):**
   - `?status=in-progress`
   - `?assignee=mike`
   - `?priority=high`
   - `?label=backend`
   - `?search=login` (searches title + description)

4. **Validation & error handling**
   - Pydantic models for request/response
   - Proper HTTP status codes (404 for missing tickets, 422 for validation errors)

### Deliverable
A running FastAPI server at `http://localhost:8000` with Swagger docs at `/docs`.

---

## Phase 2 — Frontend (Kanban Board)

**Goal:** A functional kanban board with drag-and-drop, ticket creation/editing, and user switching.

### Tasks

1. **Project setup**
   - `npm create vite@latest frontend -- --template react-ts`
   - Install: `tailwindcss`, `@dnd-kit/core`, `@dnd-kit/sortable`, `lucide-react` (icons)
   - Configure Vite proxy to backend (`/api` → `localhost:8000`)
   - Directory structure:
     ```
     frontend/
     ├── src/
     │   ├── App.tsx
     │   ├── api.ts                # Fetch wrapper for backend
     │   ├── types.ts              # TypeScript types matching backend models
     │   ├── components/
     │   │   ├── Board.tsx          # Main kanban board
     │   │   ├── Column.tsx         # Single column with droppable area
     │   │   ├── TicketCard.tsx     # Draggable ticket card
     │   │   ├── TicketModal.tsx    # Create/edit ticket dialog
     │   │   ├── LoginScreen.tsx     # Simple login form
     │   │   ├── Header.tsx         # App header with logged-in user + logout
     │   │   ├── CommentThread.tsx  # Comments list + add form
     │   │   └── FilterBar.tsx      # Filters for assignee, priority, label
     │   └── hooks/
     │       ├── useTickets.ts      # Data fetching + mutations
     │       └── useAuth.ts         # Login, logout, token management, current user
     ```

2. **Kanban board**
   - Columns rendered from `GET /api/columns`
   - Tickets fetched from `GET /api/tickets`, grouped by status
   - Drag-and-drop between columns using `@dnd-kit` → calls `PATCH /api/tickets/{id}/move`
   - Visual: colored priority badges, assignee avatars (initials in colored circles), label chips

3. **Ticket management**
   - **Create:** "+" button on each column header opens a modal with title, description (textarea), assignee dropdown, priority select, labels multi-select
   - **Edit:** Click a ticket card to open the same modal pre-filled, with an edit form and comment thread below
   - **Delete:** Trash icon in the edit modal with confirmation
   - **Quick actions:** Right-click or kebab menu on cards for assign/priority/move shortcuts

4. **Login screen**
   - Shows on app load if no valid JWT in `localStorage`
   - Displays the list of users (fetched from `GET /api/config`) as clickable buttons/cards — user picks their name, types `1234`, hits enter
   - On success, stores JWT in `localStorage`, redirects to board
   - Header shows current user name + avatar, with a logout button
   - `api.ts` attaches `Authorization: Bearer <token>` to all requests and redirects to login on 401

5. **Filtering**
   - Simple filter bar above the board: assignee, priority, label dropdowns
   - Client-side filtering (all tickets already loaded)

6. **Polling for updates**
   - Poll `GET /api/tickets` every 5 seconds to pick up changes from other users or agents
   - Later can be replaced with SSE/WebSocket if needed

### Deliverable
A working kanban board at `http://localhost:5173` that communicates with the backend.

---

## Phase 3 — MCP Server

**Goal:** Expose ticket operations as MCP tools so Claude and other agents can read and manage tickets alongside humans.

### Tasks

1. **MCP server setup**
   - New file: `backend/mcp_server.py`
   - Uses the `mcp` Python SDK (`pip install mcp`)
   - Runs as a stdio-based MCP server (for Claude Code / desktop integration)
   - Shares the same `store.py` data layer as the REST API (no HTTP round-trips)

2. **MCP Tools to expose**

   | Tool Name             | Description                                      | Parameters                                                 |
   |-----------------------|--------------------------------------------------|------------------------------------------------------------|
   | `list_tickets`        | List tickets, optionally filtered                | `status?`, `assignee?`, `priority?`, `label?`, `search?`  |
   | `get_ticket`          | Get full details of one ticket                   | `ticket_id`                                                |
   | `create_ticket`       | Create a new ticket                              | `title`, `description?`, `status?`, `assignee?`, `priority?`, `labels?` |
   | `update_ticket`       | Update fields on an existing ticket              | `ticket_id`, `title?`, `description?`, `status?`, `assignee?`, `priority?`, `labels?` |
   | `delete_ticket`       | Delete a ticket                                  | `ticket_id`                                                |
   | `add_comment`         | Add a comment to a ticket                        | `ticket_id`, `body`                                        |
   | `get_board_summary`   | Overview: ticket counts per column, recent activity | (none)                                                   |
   | `list_users`          | List available users                             | (none)                                                     |

3. **MCP Resources to expose**

   | Resource URI                | Description                          |
   |-----------------------------|--------------------------------------|
   | `tasktracker://board`       | Full board state (all columns + tickets) |
   | `tasktracker://ticket/{id}` | Single ticket with comments          |

4. **Agent identity**
   - MCP tools automatically set `created_by` / comment `author` to `agent:claude` (or a configurable agent name)
   - This shows up distinctly in the UI so humans can tell what agents did

5. **Configuration for Claude Code**
   - Provide a `.claude/mcp.json` snippet or `claude_desktop_config.json` entry:
     ```json
     {
       "mcpServers": {
         "tasktracker": {
           "command": "python",
           "args": ["backend/mcp_server.py"],
           "cwd": "/path/to/tasktracker"
         }
       }
     }
     ```

### Deliverable
A working MCP server that Claude Code can connect to and use to manage tickets on the same board as human users.

---

## Phase 4 — Polish & Quality of Life

**Goal:** Make it pleasant to use day-to-day.

### Tasks

1. **Startup script**
   - Single `./run.sh` (or `Makefile`) that:
     - Installs Python deps (`pip install -e .`)
     - Installs frontend deps (`npm install`)
     - Seeds data if `data/` is empty
     - Starts backend + frontend concurrently
   - Also a `docker-compose.yml` alternative if preferred

2. **UI polish**
   - Ticket count badges on column headers
   - Empty-state illustrations on empty columns
   - Keyboard shortcuts: `N` for new ticket, `Esc` to close modals
   - Responsive layout (works on smaller screens)
   - Subtle animations on drag-and-drop

3. **Activity feed / history**
   - Add a `history` array to tickets recording status changes, reassignments
   - Show timeline in the ticket detail modal
   - Helps track what agents have been doing

4. **Search**
   - Global search bar in the header
   - Searches across title, description, and comments
   - Highlights matching text

5. **Data durability**
   - Auto-backup: copy `data/*.json` to `data/backups/` on each write (keep last 50)
   - Since it's all JSON files, the whole board can be committed to git

---

## File Structure (Final)

```
tasktracker/
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── store.py
│   ├── auth.py
│   ├── mcp_server.py
│   ├── routers/
│   │   ├── tickets.py
│   │   ├── columns.py
│   │   └── config.py
│   └── seed.py
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── types.ts
│   │   ├── components/
│   │   │   ├── Board.tsx
│   │   │   ├── Column.tsx
│   │   │   ├── TicketCard.tsx
│   │   │   ├── TicketModal.tsx
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── CommentThread.tsx
│   │   │   └── FilterBar.tsx
│   │   └── hooks/
│   │       ├── useTickets.ts
│   │       └── useAuth.ts
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── data/
│   ├── tickets.json
│   ├── columns.json
│   └── config.json
├── pyproject.toml
├── run.sh
├── PLAN.md
└── .gitignore
```

---

## Implementation Order

| Phase | Effort Estimate | Dependencies |
|-------|----------------|--------------|
| Phase 1 — Backend API | Moderate | None |
| Phase 2 — Frontend | Moderate | Phase 1 |
| Phase 3 — MCP Server | Small-moderate | Phase 1 (shares data layer) |
| Phase 4 — Polish | Small per item | Phases 1-3 |

Phases 2 and 3 can be worked on in parallel once Phase 1 is complete, since they both depend on the data layer but not on each other.
