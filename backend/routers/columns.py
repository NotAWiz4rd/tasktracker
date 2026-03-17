from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import ColumnsFile
from .. import store

router = APIRouter(prefix="/api/columns", tags=["columns"])


@router.get("")
def list_columns(
    _user: Annotated[str, Depends(get_current_user)],
) -> ColumnsFile:
    return ColumnsFile(**store.read_json(store.COLUMNS_PATH))
