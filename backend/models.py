from __future__ import annotations

from datetime import datetime, timezone
from pydantic import BaseModel, Field


# --- Ticket ---

class Comment(BaseModel):
    id: str
    author: str
    body: str
    created_at: datetime


class HistoryEntry(BaseModel):
    at: datetime
    by: str
    change: str


class Ticket(BaseModel):
    id: str
    title: str
    description: str = ""
    status: str = "backlog"
    assignee: str | None = None
    priority: str = "medium"
    labels: list[str] = Field(default_factory=list)
    created_by: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    archived: bool = False
    archived_at: datetime | None = None
    comments: list[Comment] = Field(default_factory=list)
    history: list[HistoryEntry] = Field(default_factory=list)


class TicketCreate(BaseModel):
    title: str
    description: str = ""
    status: str = "backlog"
    assignee: str | None = None
    priority: str = "medium"
    labels: list[str] = Field(default_factory=list)


class TicketUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    assignee: str | None = None
    priority: str | None = None
    labels: list[str] | None = None


class TicketMove(BaseModel):
    status: str


class TicketReorder(BaseModel):
    status: str
    ids: list[str]


class CommentCreate(BaseModel):
    body: str


# --- Column ---

class Column(BaseModel):
    id: str
    name: str
    order: int


class ColumnsFile(BaseModel):
    columns: list[Column]


# --- Config ---

class UserPreferences(BaseModel):
    dark_mode: bool = False
    split_view: bool = False


class UserPreferencesUpdate(BaseModel):
    dark_mode: bool | None = None
    split_view: bool | None = None


class User(BaseModel):
    id: str
    name: str
    password: str
    avatar_color: str
    preferences: UserPreferences = Field(default_factory=UserPreferences)


class ConfigFile(BaseModel):
    users: list[User]
    priorities: list[str]
    labels: list[str]
    next_ticket_number: int


class UserPublic(BaseModel):
    id: str
    name: str
    avatar_color: str
    preferences: UserPreferences = Field(default_factory=UserPreferences)


class ConfigPublic(BaseModel):
    users: list[UserPublic]
    priorities: list[str]
    labels: list[str]


# --- Auth ---

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: UserPublic


# --- Knowledge Base ---

class Article(BaseModel):
    slug: str
    title: str
    parent: str | None = None
    tags: list[str] = Field(default_factory=list)
    created_by: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: str = ""
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ArticleWithContent(Article):
    content: str = ""
    children: list[Article] = Field(default_factory=list)


class ArticleCreate(BaseModel):
    title: str
    slug: str | None = None
    content: str | None = None
    tags: list[str] = Field(default_factory=list)
    parent: str | None = None


class ArticleUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    tags: list[str] | None = None
    parent: str | None = None


class SharedArticle(BaseModel):
    slug: str
    title: str
    tags: list[str] = Field(default_factory=list)
    updated_at: datetime
    content: str = ""


class SharedArticleResponse(BaseModel):
    article: SharedArticle
    children: list[SharedArticle] = Field(default_factory=list)
