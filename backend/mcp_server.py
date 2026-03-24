"""TaskTracker MCP Server

Exposes ticket operations as MCP tools so Claude and other agents can read
and manage tickets alongside human users. Accesses the data layer directly
(no HTTP round-trips). Identifies as agent:claude.

Run via stdio (default — Claude Code spawns this directly):
    python backend/mcp_server.py

Run via HTTP/SSE (allows remote access; configure .mcp.json with a url):
    python backend/mcp_server.py --transport http [--host 0.0.0.0] [--port 8001]
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
    auto_archive_done_tickets,
    next_ticket_id,
    read_json,
    write_json,
)
from backend.kb_store import (
    ensure_kb_dirs,
    read_index as kb_read_index,
    write_index as kb_write_index,
    read_article_content,
    write_article_content,
    delete_article_file,
    slugify,
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
            description="List tickets on the board, optionally filtered by status, assignee, priority, label, or search text. Archived tickets are excluded by default.",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {"type": "string", "description": "Filter by column status (e.g. backlog, todo, in-progress, review, done)"},
                    "assignee": {"type": "string", "description": "Filter by assignee user ID"},
                    "priority": {"type": "string", "description": "Filter by priority (low, medium, high, urgent)"},
                    "label": {"type": "string", "description": "Filter by label"},
                    "search": {"type": "string", "description": "Search in title and description"},
                    "include_archived": {"type": "boolean", "description": "Include archived tickets (default: false)"},
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
        # --- Knowledge Base ---
        types.Tool(
            name="list_articles",
            description="List knowledge base articles (metadata only). Optionally filter by tag, search text, or parent slug.",
            inputSchema={
                "type": "object",
                "properties": {
                    "tag": {"type": "string", "description": "Filter by tag"},
                    "search": {"type": "string", "description": "Search in title and content"},
                    "parent": {"type": "string", "description": "Filter by parent slug, or 'root' for top-level articles"},
                },
            },
        ),
        types.Tool(
            name="get_article",
            description="Get a knowledge base article with its full markdown content and list of children.",
            inputSchema={
                "type": "object",
                "properties": {
                    "slug": {"type": "string", "description": "Article slug (e.g. getting-started)"},
                },
                "required": ["slug"],
            },
        ),
        types.Tool(
            name="create_article",
            description="Create a new knowledge base article.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Article title"},
                    "slug": {"type": "string", "description": "Custom slug (auto-generated from title if omitted)"},
                    "content": {"type": "string", "description": "Markdown content"},
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "Tags for categorization"},
                    "parent": {"type": "string", "description": "Parent article slug for nesting"},
                },
                "required": ["title"],
            },
        ),
        types.Tool(
            name="update_article",
            description="Update an existing knowledge base article.",
            inputSchema={
                "type": "object",
                "properties": {
                    "slug": {"type": "string", "description": "Article slug"},
                    "title": {"type": "string", "description": "New title"},
                    "content": {"type": "string", "description": "New markdown content"},
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "New tags"},
                    "parent": {"type": "string", "description": "New parent slug (null to make root-level)"},
                },
                "required": ["slug"],
            },
        ),
        types.Tool(
            name="delete_article",
            description="Delete a knowledge base article. Children become root-level.",
            inputSchema={
                "type": "object",
                "properties": {
                    "slug": {"type": "string", "description": "Article slug to delete"},
                },
                "required": ["slug"],
            },
        ),
        types.Tool(
            name="get_kb_tree",
            description="Get the full knowledge base tree structure (nested JSON) for navigation.",
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
    elif name == "list_articles":
        return _tool_list_articles(arguments)
    elif name == "get_article":
        return _tool_get_article(arguments)
    elif name == "create_article":
        return _tool_create_article(arguments)
    elif name == "update_article":
        return _tool_update_article(arguments)
    elif name == "delete_article":
        return _tool_delete_article(arguments)
    elif name == "get_kb_tree":
        return _tool_get_kb_tree()
    else:
        raise ValueError(f"Unknown tool: {name}")


def _tool_list_tickets(args: dict) -> list[types.TextContent]:
    auto_archive_done_tickets()
    tickets: list[dict] = read_json(TICKETS_PATH)

    include_archived = args.get("include_archived", False)
    status = args.get("status")
    assignee = args.get("assignee")
    priority = args.get("priority")
    label = args.get("label")
    search = args.get("search", "").lower()

    results = []
    for t in tickets:
        if not include_archived and t.get("archived"):
            continue
        if status and t.get("status", "").lower() != status.lower():
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
        "status": args.get("status", "backlog").lower(),
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
            value = args[field]
            ticket[field] = value.lower() if field == "status" else value
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
    auto_archive_done_tickets()
    all_tickets: list[dict] = read_json(TICKETS_PATH)
    tickets = [t for t in all_tickets if not t.get("archived")]
    archived_count = len(all_tickets) - len(tickets)
    columns_data = read_json(COLUMNS_PATH)
    columns = sorted(columns_data["columns"], key=lambda c: c["order"])

    counts: dict[str, int] = {col["id"]: 0 for col in columns}
    for t in tickets:
        status = t.get("status", "backlog")
        counts[status] = counts.get(status, 0) + 1

    summary_lines = ["## Board Summary", ""]
    for col in columns:
        summary_lines.append(f"**{col['name']}**: {counts.get(col['id'], 0)} ticket(s)")

    summary_lines += ["", f"**Total active tickets**: {len(tickets)}"]
    if archived_count:
        summary_lines.append(f"**Archived tickets**: {archived_count}")

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
# KB Tool implementations
# ---------------------------------------------------------------------------

def _tool_list_articles(args: dict) -> list[types.TextContent]:
    ensure_kb_dirs()
    index = kb_read_index()

    parent = args.get("parent")
    tag = args.get("tag")
    search = args.get("search", "").lower()

    if parent is not None:
        if parent == "root":
            index = [a for a in index if a.get("parent") is None]
        else:
            index = [a for a in index if a.get("parent") == parent]

    if tag:
        index = [a for a in index if tag in a.get("tags", [])]

    if search:
        results = []
        for a in index:
            if search in a["title"].lower():
                results.append(a)
                continue
            content = read_article_content(a["slug"])
            if search in content.lower():
                results.append(a)
        index = results

    return [types.TextContent(type="text", text=json.dumps(index, indent=2, default=str))]


def _tool_get_article(args: dict) -> list[types.TextContent]:
    ensure_kb_dirs()
    slug = args["slug"]
    index = kb_read_index()
    meta = None
    for a in index:
        if a["slug"] == slug:
            meta = a
            break
    if meta is None:
        return [types.TextContent(type="text", text=f"Error: article {slug!r} not found")]

    content = read_article_content(slug)
    children = [a for a in index if a.get("parent") == slug]
    result = {**meta, "content": content, "children": children}
    return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]


def _tool_create_article(args: dict) -> list[types.TextContent]:
    ensure_kb_dirs()
    index = kb_read_index()

    slug = args.get("slug") or slugify(args["title"])
    if not slug:
        return [types.TextContent(type="text", text="Error: could not generate slug from title")]

    existing_slugs = {a["slug"] for a in index}
    if slug in existing_slugs:
        base = slug
        counter = 2
        while slug in existing_slugs:
            slug = f"{base}-{counter}"
            counter += 1

    parent = args.get("parent")
    if parent is not None and not any(a["slug"] == parent for a in index):
        return [types.TextContent(type="text", text=f"Error: parent article {parent!r} not found")]

    now = _now()
    meta = {
        "slug": slug,
        "title": args["title"],
        "parent": parent,
        "tags": args.get("tags", []),
        "created_by": AGENT_NAME,
        "created_at": now,
        "updated_by": AGENT_NAME,
        "updated_at": now,
    }

    content = args.get("content", "")
    write_article_content(slug, content)
    index.append(meta)
    kb_write_index(index)

    result = {**meta, "content": content}
    return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]


def _tool_update_article(args: dict) -> list[types.TextContent]:
    ensure_kb_dirs()
    slug = args["slug"]
    index = kb_read_index()
    meta = None
    meta_idx = -1
    for i, a in enumerate(index):
        if a["slug"] == slug:
            meta = a
            meta_idx = i
            break
    if meta is None:
        return [types.TextContent(type="text", text=f"Error: article {slug!r} not found")]

    if "parent" in args:
        new_parent = args["parent"]
        if new_parent is not None:
            if new_parent == slug:
                return [types.TextContent(type="text", text="Error: an article cannot be its own parent")]
            if not any(a["slug"] == new_parent for a in index):
                return [types.TextContent(type="text", text=f"Error: parent article {new_parent!r} not found")]
        meta["parent"] = new_parent

    for field in ("title", "tags"):
        if field in args:
            meta[field] = args[field]

    if "content" in args:
        write_article_content(slug, args["content"])

    meta["updated_by"] = AGENT_NAME
    meta["updated_at"] = _now()
    index[meta_idx] = meta
    kb_write_index(index)

    content = read_article_content(slug)
    result = {**meta, "content": content}
    return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]


def _tool_delete_article(args: dict) -> list[types.TextContent]:
    ensure_kb_dirs()
    slug = args["slug"]
    index = kb_read_index()
    original_count = len(index)

    # Re-parent children
    for a in index:
        if a.get("parent") == slug:
            a["parent"] = None

    index = [a for a in index if a["slug"] != slug]
    if len(index) == original_count:
        return [types.TextContent(type="text", text=f"Error: article {slug!r} not found")]

    kb_write_index(index)
    delete_article_file(slug)
    return [types.TextContent(type="text", text=f"Deleted article {slug}")]


def _tool_get_kb_tree() -> list[types.TextContent]:
    ensure_kb_dirs()
    index = kb_read_index()

    # Build tree
    by_slug: dict[str, dict] = {}
    for a in index:
        by_slug[a["slug"]] = {**a, "children": []}

    roots: list[dict] = []
    for a in index:
        node = by_slug[a["slug"]]
        parent_slug = a.get("parent")
        if parent_slug and parent_slug in by_slug:
            by_slug[parent_slug]["children"].append(node)
        else:
            roots.append(node)

    return [types.TextContent(type="text", text=json.dumps(roots, indent=2, default=str))]


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
        types.Resource(
            uri="tasktracker://kb",
            name="Knowledge Base Index",
            description="All KB article metadata as a JSON array",
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
        types.ResourceTemplate(
            uriTemplate="tasktracker://kb/{slug}",
            name="KB Article",
            description="A single knowledge base article with content",
            mimeType="application/json",
        ),
    ]


@server.read_resource()
async def read_resource(uri: types.AnyUrl) -> str:
    uri_str = str(uri)

    if uri_str == "tasktracker://board":
        all_tickets = read_json(TICKETS_PATH)
        tickets = [t for t in all_tickets if not t.get("archived")]
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
        all_tickets = read_json(TICKETS_PATH)
        tickets = [t for t in all_tickets if not t.get("archived")]
        return json.dumps(tickets, indent=2, default=str)

    if uri_str.startswith("tasktracker://ticket/"):
        ticket_id = uri_str.removeprefix("tasktracker://ticket/")
        tickets = read_json(TICKETS_PATH)
        ticket = _find_ticket(tickets, ticket_id)
        if ticket is None:
            raise ValueError(f"Ticket {ticket_id!r} not found")
        return json.dumps(ticket, indent=2, default=str)

    if uri_str == "tasktracker://kb":
        ensure_kb_dirs()
        index = kb_read_index()
        return json.dumps(index, indent=2, default=str)

    if uri_str.startswith("tasktracker://kb/"):
        slug = uri_str.removeprefix("tasktracker://kb/")
        ensure_kb_dirs()
        index = kb_read_index()
        meta = None
        for a in index:
            if a["slug"] == slug:
                meta = a
                break
        if meta is None:
            raise ValueError(f"Article {slug!r} not found")
        content = read_article_content(slug)
        children = [a for a in index if a.get("parent") == slug]
        result = {**meta, "content": content, "children": children}
        return json.dumps(result, indent=2, default=str)

    raise ValueError(f"Unknown resource URI: {uri_str}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="TaskTracker MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "http"],
        default="stdio",
        help="Transport to use: stdio (default, for local subprocess) or http (for network access)",
    )
    parser.add_argument("--host", default="127.0.0.1", help="HTTP bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8001, help="HTTP port (default: 8001)")
    args = parser.parse_args()

    if args.transport == "stdio":
        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                server.create_initialization_options(),
            )
    else:
        from mcp.server.sse import SseServerTransport
        from starlette.applications import Starlette
        from starlette.routing import Mount, Route
        import uvicorn

        sse = SseServerTransport("/messages/")

        async def handle_sse(request):
            async with sse.connect_sse(
                request.scope, request.receive, request._send
            ) as (read_stream, write_stream):
                await server.run(
                    read_stream,
                    write_stream,
                    server.create_initialization_options(),
                )

        starlette_app = Starlette(
            routes=[
                Route("/sse", endpoint=handle_sse),
                Mount("/messages/", app=sse.handle_post_message),
            ]
        )

        print(f"TaskTracker MCP server listening on http://{args.host}:{args.port}/sse")
        config = uvicorn.Config(starlette_app, host=args.host, port=args.port)
        await uvicorn.Server(config).serve()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
