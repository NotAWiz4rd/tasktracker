from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import get_current_user, generate_share_token, verify_share_token
from ..models import Article, ArticleCreate, ArticleUpdate, ArticleWithContent, SharedArticle, SharedArticleResponse
from .. import kb_store

router = APIRouter(prefix="/api/kb", tags=["knowledge-base"])


def _would_create_cycle(index: list[dict], slug: str, new_parent: str) -> bool:
    """Return True if making new_parent the parent of slug would create a cycle."""
    parent_map = {a["slug"]: a.get("parent") for a in index}
    current = new_parent
    while current is not None:
        if current == slug:
            return True
        current = parent_map.get(current)
    return False


def _find_article(index: list[dict], slug: str) -> tuple[int, dict]:
    for i, a in enumerate(index):
        if a["slug"] == slug:
            return i, a
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Article {slug!r} not found")


@router.get("")
def list_articles(
    _user: Annotated[str, Depends(get_current_user)],
    tag: str | None = Query(None),
    search: str | None = Query(None),
    parent: str | None = Query(None, description="Filter by parent slug, or 'root' for top-level"),
) -> list[Article]:
    index = kb_store.read_index()

    if parent is not None:
        if parent == "root":
            index = [a for a in index if a.get("parent") is None]
        else:
            index = [a for a in index if a.get("parent") == parent]

    if tag:
        index = [a for a in index if tag in a.get("tags", [])]

    if search:
        q = search.lower()
        results = []
        for a in index:
            if q in a["title"].lower():
                results.append(a)
                continue
            content = kb_store.read_article_content(a["slug"])
            if q in content.lower():
                results.append(a)
        index = results

    return [Article(**a) for a in index]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_article(
    body: ArticleCreate,
    user: Annotated[str, Depends(get_current_user)],
) -> ArticleWithContent:
    index = kb_store.read_index()

    slug = body.slug or kb_store.slugify(body.title)
    if not slug:
        raise HTTPException(status_code=422, detail="Could not generate slug from title")

    # Ensure unique slug
    existing_slugs = {a["slug"] for a in index}
    if slug in existing_slugs:
        base = slug
        counter = 2
        while slug in existing_slugs:
            slug = f"{base}-{counter}"
            counter += 1

    # Validate parent exists if specified
    if body.parent is not None:
        if not any(a["slug"] == body.parent for a in index):
            raise HTTPException(status_code=422, detail=f"Parent article {body.parent!r} not found")

    now = datetime.now(timezone.utc)
    article_meta = {
        "slug": slug,
        "title": body.title,
        "parent": body.parent,
        "tags": body.tags,
        "created_by": user,
        "created_at": now.isoformat(),
        "updated_by": user,
        "updated_at": now.isoformat(),
    }

    content = body.content or ""
    kb_store.write_article_content(slug, content)
    index.append(article_meta)
    kb_store.write_index(index)

    return ArticleWithContent(**article_meta, content=content)


@router.get("/{slug}/share-token")
def get_share_token(
    slug: str,
    _user: Annotated[str, Depends(get_current_user)],
) -> dict:
    index = kb_store.read_index()
    _find_article(index, slug)  # 404 if missing
    return {"token": generate_share_token(slug)}


@router.get("/share/{slug}/{token}")
def get_shared_article(
    slug: str,
    token: str,
    children: bool = Query(False),
) -> SharedArticleResponse:
    if not verify_share_token(slug, token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid share link")
    index = kb_store.read_index()
    _, meta = _find_article(index, slug)
    content = kb_store.read_article_content(slug)
    article = SharedArticle(**{k: meta[k] for k in ("slug", "title", "tags", "updated_at")}, content=content)

    child_articles: list[SharedArticle] = []
    if children:
        queue = [slug]
        visited = {slug}
        while queue:
            current = queue.pop(0)
            for a in index:
                if a.get("parent") == current and a["slug"] not in visited:
                    visited.add(a["slug"])
                    queue.append(a["slug"])
                    child_content = kb_store.read_article_content(a["slug"])
                    child_articles.append(
                        SharedArticle(**{k: a[k] for k in ("slug", "title", "tags", "updated_at")}, content=child_content)
                    )

    return SharedArticleResponse(article=article, children=child_articles)


@router.get("/{slug}")
def get_article(
    slug: str,
    _user: Annotated[str, Depends(get_current_user)],
) -> ArticleWithContent:
    index = kb_store.read_index()
    _, meta = _find_article(index, slug)
    content = kb_store.read_article_content(slug)
    children = [Article(**a) for a in index if a.get("parent") == slug]
    return ArticleWithContent(**meta, content=content, children=children)


@router.patch("/{slug}")
def update_article(
    slug: str,
    body: ArticleUpdate,
    user: Annotated[str, Depends(get_current_user)],
) -> ArticleWithContent:
    index = kb_store.read_index()
    idx, meta = _find_article(index, slug)

    updates = body.model_dump(exclude_unset=True)

    # Validate parent if being changed
    if "parent" in updates:
        new_parent = updates["parent"]
        if new_parent is not None:
            if new_parent == slug:
                raise HTTPException(status_code=422, detail="An article cannot be its own parent")
            if not any(a["slug"] == new_parent for a in index):
                raise HTTPException(status_code=422, detail=f"Parent article {new_parent!r} not found")
            if _would_create_cycle(index, slug, new_parent):
                raise HTTPException(status_code=422, detail="Setting this parent would create a cycle in the article hierarchy")

    if "content" in updates:
        kb_store.write_article_content(slug, updates.pop("content"))

    now = datetime.now(timezone.utc)
    meta.update(updates)
    meta["updated_by"] = user
    meta["updated_at"] = now.isoformat()
    index[idx] = meta
    kb_store.write_index(index)

    content = kb_store.read_article_content(slug)
    children = [Article(**a) for a in index if a.get("parent") == slug]
    return ArticleWithContent(**meta, content=content, children=children)


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article(
    slug: str,
    _user: Annotated[str, Depends(get_current_user)],
) -> None:
    index = kb_store.read_index()
    idx, _ = _find_article(index, slug)

    # Re-parent children to null
    for a in index:
        if a.get("parent") == slug:
            a["parent"] = None

    index.pop(idx)
    kb_store.write_index(index)
    kb_store.delete_article_file(slug)
