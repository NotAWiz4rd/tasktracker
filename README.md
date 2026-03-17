# TaskTracker

A lightweight Kanban board for small teams, with a built-in MCP server so Claude Code can read and update tickets directly.

## Components

| Component | Purpose | Default port |
|-----------|---------|-------------|
| Backend   | FastAPI REST API, JSON file storage | 8000 |
| Frontend  | React + TypeScript Kanban board (Vite) | 5173 |
| MCP Server | Exposes board operations as MCP tools for Claude Code | 8001 |

---

## Prerequisites

- Python 3.11+
- Node.js 18+ and npm

---

## Setup

### 1. Clone and install backend dependencies

```bash
git clone <repo-url>
cd tasktracker
pip install -e ".[dev]"
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Configure users

Users are defined in `data/config.json`. Open that file and edit the `users` array:

```json
{
  "users": [
    {
      "id": "alice",
      "name": "Alice",
      "password": "password",
      "avatar_color": "#4F46E5"
    },
    {
      "id": "bob",
      "name": "Bob",
      "password": "password",
      "avatar_color": "#059669"
    }
  ],
  ...
}
```

- `id` — used internally and as the login username
- `name` — display name shown on tickets and avatars
- `password` — plaintext password (see security note below)
- `avatar_color` — any CSS hex colour

To add a user, append a new object to the array. To remove one, delete their entry. There is no registration flow — all user management is done by editing this file directly.

**Security note:** Passwords are stored in plaintext and the JWT signing key is a hardcoded dev secret. This project is designed for use on a local machine or a trusted private network only — not for exposure to the internet or untrusted users.

---

## Running the project

All three processes need to be running. Open three terminal tabs:

### Terminal 1 — Backend API

```bash
python -m uvicorn backend.main:app --reload
```

API available at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`.

### Terminal 2 — MCP Server

```bash
python backend/mcp_server.py --transport http
```

Runs on `http://localhost:8001`. Must be started **before** opening Claude Code in this project.

### Terminal 3 — Frontend

```bash
cd frontend
npm run dev
```

Board available at `http://localhost:5173`. Log in with any username/password pair from `data/config.json`.

---

## Claude Code / MCP integration

The `.mcp.json` file in the project root points Claude Code at the MCP server:

```json
{
  "mcpServers": {
    "tasktracker": {
      "url": "http://localhost:8001/sse"
    }
  }
}
```

Once the MCP server is running and you open Claude Code in this directory, it will have access to tools like `list_tickets`, `create_ticket`, `update_ticket`, `add_comment`, and `get_board_summary`.

If running the MCP server on a different machine, update the `url` in `.mcp.json` to point at that host.

---

## Data

All state lives in three JSON files under `data/`:

| File | Contents |
|------|----------|
| `tickets.json` | All tickets |
| `columns.json` | Board column definitions |
| `config.json` | Users, priorities, labels |

These files are read and written directly by both the backend and the MCP server. They are safe to inspect or edit by hand while the services are stopped.

---

## Running tests

```bash
python -m pytest
```
