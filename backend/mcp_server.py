"""TaskTracker MCP Server

Exposes ticket operations as MCP tools so Claude and other agents can read
and manage tickets alongside human users. Accesses the data layer directly
(no HTTP round-trips). Identifies as agent:claude.

Run via stdio:
    python backend/mcp_server.py
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

import mcp.types as types
from mcp.server import Server
from mcp.server.stdio import stdio_server

from backend.store import (
    COLUMNS_PATH,
    CONFIG_PATH,
    TICKETS_PATH,
    next_ticket_id,
    read_json,
    write_json,
)

AGENT_NAME = "agent:claude"

server = Server("tasktracker")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _find_ticket(tickets: list[dict], ticket_id: str) -> dict | None:
    for t in tickets:
        if t["id"] == ticket_id:
            return t
    return None


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="list_tickets",
            description="List tickets on the board, optionally filtered by status, assignee, priority, label, or search text.",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {"type": "string", "description": "Filter by column status (e.g. backlog, todo, in-progress, review, done)"},
                    "assignee": {"type": "string", "description": "Filter by assignee user ID"},
                    "priority": {"type": "string", "description": "Filter by priority (low, medium, high, urgent)"},
                    "label": {"type": "string", "description": "Filter by label"},
                    "search": {"type": "string", "description": "Search in title and description"},
                },
            },
        ),
        types.Tool(
            name="get_ticket",
            description="Get full details of a single ticket including all comments.",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string", "description": "Ticket ID (e.g. TT-1)"},
                },
                "required": ["ticket_id"],
            },
        ),
        types.Tool(
            name="create_ticket",
            description="Create a new ticket on the board.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Ticket title"},
                    "description": {"type": "string", "description": "Ticket description (markdown supported)"},
                    "status": {"type": "string", "description": "Initial column status (default: backlog)"},
                    "assignee": {"type": "string", "description": "User ID to assign the ticket to"},
                    "priority": {"type": "string", "description": "Priority: low, medium, high, urgent (default: medium)"},
                    "labels": {"type": "array", "items": {"type": "string"}, "description": "Labels to apply"},
                },
                "required": ["title"],
            },
        ),
        types.Tool(
            name="update_ticket",
            description="Update one or more fields on an existing ticket.",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string", "description": "Ticket ID (e.g. TT-1)"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "status": {"type": "string"},
                    "assignee": {"type": "string"},
                    "priority": {"type": "string"},
                    "labels": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["ticket_id"],
            },
        ),
        types.Tool(
            name="delete_ticket",
            description="Permanently delete a ticket.",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string", "description": "Ticket ID (e.g. TT-1)"},
                },
                "required": ["ticket_id"],
            },
        ),
        types.Tool(
            name="add_comment",
            description="Add a comment to a ticket.",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string", "description": "Ticket ID (e.g. TT-1)"},
                    "body": {"type": "string", "description": "Comment text (markdown supported)"},
                },
                "required": ["ticket_id", "body"],
            },
        ),
        types.Tool(
            name="get_board_summary",
            description="Get an overview of the board: ticket counts per column and recent activity.",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="list_users",
            description="List all users available on the board.",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[types.TextContent]:
    if name == "list_tickets":
        return _tool_list_tickets(arguments)
    elif name == "get_ticket":
        return _tool_get_ticket(arguments)
    elif name == "create_ticket":
        return _tool_create_ticket(arguments)
    elif name == "update_ticket":
        return _tool_update_ticket(arguments)
    elif name == "delete_ticket":
        return _tool_delete_ticket(arguments)
    elif name == "add_comment":
        return _tool_add_comment(arguments)
    elif name == "get_board_summary":
        return _tool_get_board_summary()
    elif name == "list_users":
        return _tool_list_users()
    else:
        raise ValueError(f"Unknown tool: {name}")


def _tool_list_tickets(args: dict) -> list[types.TextContent]:
    tickets: list[dict] = read_json(TICKETS_PATH)

    status = args.get("status")
    assignee = args.get("assignee")
    priority = args.get("priority")
    label = args.get("label")
    search = args.get("search", "").lower()

    results = []
    for t in tickets:
        if status and t.get("status") != status:
            continue
        if assignee and t.get("assignee") != assignee:
            continue
        if priority and t.get("priority") != priority:
            continue
        if label and label not in t.get("labels", []):
            continue
        if search and search not in t.get("title", "").lower() and search not in t.get("description", "").lower():
            continue
        results.append(t)

    return [types.TextContent(type="text", text=json.dumps(results, indent=2, default=str))]


def _tool_get_ticket(args: dict) -> list[types.TextContent]:
    ticket_id = args["ticket_id"]
    tickets: list[dict] = read_json(TICKETS_PATH)
    ticket = _find_ticket(tickets, ticket_id)
    if ticket is None:
        return [types.TextContent(type="text", text=f"Error: ticket {ticket_id!r} not found")]
    return [types.TextContent(type="text", text=json.dumps(ticket, indent=2, default=str))]


def _tool_create_ticket(args: dict) -> list[types.TextContent]:
    ticket_id = next_ticket_id()
    now = _now()
    ticket: dict = {
        "id": ticket_id,
        "title": args["title"],
        "description": args.get("description", ""),
        "status": args.get("status", "backlog"),
        "assignee": args.get("assignee"),
        "priority": args.get("priority", "medium"),
        "labels": args.get("labels", []),
        "created_by": AGENT_NAME,
        "created_at": now,
        "updated_at": now,
        "comments": [],
    }
    tickets: list[dict] = read_json(TICKETS_PATH)
    tickets.append(ticket)
    write_json(TICKETS_PATH, tickets)
    return [types.TextContent(type="text", text=json.dumps(ticket, indent=2, default=str))]


def _tool_update_ticket(args: dict) -> list[types.TextContent]:
    ticket_id = args["ticket_id"]
    tickets: list[dict] = read_json(TICKETS_PATH)
    ticket = _find_ticket(tickets, ticket_id)
    if ticket is None:
        return [types.TextContent(type="text", text=f"Error: ticket {ticket_id!r} not found")]

    updatable = ("title", "description", "status", "assignee", "priority", "labels")
    for field in updatable:
        if field in args:
            ticket[field] = args[field]
    ticket["updated_at"] = _now()

    write_json(TICKETS_PATH, tickets)
    return [types.TextContent(type="text", text=json.dumps(ticket, indent=2, default=str))]


def _tool_delete_ticket(args: dict) -> list[types.TextContent]:
    ticket_id = args["ticket_id"]
    tickets: list[dict] = read_json(TICKETS_PATH)
    original_count = len(tickets)
    tickets = [t for t in tickets if t["id"] != ticket_id]
    if len(tickets) == original_count:
        return [types.TextContent(type="text", text=f"Error: ticket {ticket_id!r} not found")]
    write_json(TICKETS_PATH, tickets)
    return [types.TextContent(type="text", text=f"Deleted ticket {ticket_id}")]


def _tool_add_comment(args: dict) -> list[types.TextContent]:
    ticket_id = args["ticket_id"]
    tickets: list[dict] = read_json(TICKETS_PATH)
    ticket = _find_ticket(tickets, ticket_id)
    if ticket is None:
        return [types.TextContent(type="text", text=f"Error: ticket {ticket_id!r} not found")]

    comment = {
        "id": f"c-{uuid.uuid4().hex[:8]}",
        "author": AGENT_NAME,
        "body": args["body"],
        "created_at": _now(),
    }
    ticket.setdefault("comments", []).append(comment)
    ticket["updated_at"] = _now()
    write_json(TICKETS_PATH, tickets)
    return [types.TextContent(type="text", text=json.dumps(comment, indent=2, default=str))]


def _tool_get_board_summary() -> list[types.TextContent]:
    tickets: list[dict] = read_json(TICKETS_PATH)
    columns_data = read_json(COLUMNS_PATH)
    columns = sorted(columns_data["columns"], key=lambda c: c["order"])

    counts: dict[str, int] = {col["id"]: 0 for col in columns}
    for t in tickets:
        status = t.get("status", "backlog")
        counts[status] = counts.get(status, 0) + 1

    summary_lines = ["## Board Summary", ""]
    for col in columns:
        summary_lines.append(f"**{col['name']}**: {counts.get(col['id'], 0)} ticket(s)")

    summary_lines += ["", f"**Total tickets**: {len(tickets)}"]

    # Recent activity: last 5 updated tickets
    recent = sorted(tickets, key=lambda t: t.get("updated_at", ""), reverse=True)[:5]
    if recent:
        summary_lines += ["", "### Recently Updated"]
        for t in recent:
            summary_lines.append(f"- [{t['id']}] {t['title']} ({t.get('status', '?')}) — {t.get('updated_at', '')[:10]}")

    return [types.TextContent(type="text", text="\n".join(summary_lines))]


def _tool_list_users() -> list[types.TextContent]:
    config = read_json(CONFIG_PATH)
    users = [
        {"id": u["id"], "name": u["name"], "avatar_color": u["avatar_color"]}
        for u in config.get("users", [])
    ]
    return [types.TextContent(type="text", text=json.dumps(users, indent=2))]


# ---------------------------------------------------------------------------
# Resources
# ---------------------------------------------------------------------------

@server.list_resources()
async def list_resources() -> list[types.Resource]:
    return [
        types.Resource(
            uri="tasktracker://board",
            name="Board State",
            description="Full board state: all columns and tickets",
            mimeType="application/json",
        ),
        types.Resource(
            uri="tasktracker://tickets",
            name="All Tickets",
            description="All tickets as a JSON array",
            mimeType="application/json",
        ),
    ]


@server.list_resource_templates()
async def list_resource_templates() -> list[types.ResourceTemplate]:
    return [
        types.ResourceTemplate(
            uriTemplate="tasktracker://ticket/{id}",
            name="Single Ticket",
            description="A single ticket with all its comments",
            mimeType="application/json",
        ),
    ]


@server.read_resource()
async def read_resource(uri: types.AnyUrl) -> str:
    uri_str = str(uri)

    if uri_str == "tasktracker://board":
        tickets = read_json(TICKETS_PATH)
        columns_data = read_json(COLUMNS_PATH)
        columns = sorted(columns_data["columns"], key=lambda c: c["order"])
        board = {
            "columns": [
                {
                    **col,
                    "tickets": [t for t in tickets if t.get("status") == col["id"]],
                }
                for col in columns
            ]
        }
        return json.dumps(board, indent=2, default=str)

    if uri_str == "tasktracker://tickets":
        tickets = read_json(TICKETS_PATH)
        return json.dumps(tickets, indent=2, default=str)

    if uri_str.startswith("tasktracker://ticket/"):
        ticket_id = uri_str.removeprefix("tasktracker://ticket/")
        tickets = read_json(TICKETS_PATH)
        ticket = _find_ticket(tickets, ticket_id)
        if ticket is None:
            raise ValueError(f"Ticket {ticket_id!r} not found")
        return json.dumps(ticket, indent=2, default=str)

    raise ValueError(f"Unknown resource URI: {uri_str}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
