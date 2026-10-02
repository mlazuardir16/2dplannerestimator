"""HTTP endpoints over the RAB engine. Pure calculation — no database access;
a project's RAB inputs are saved with the project document itself."""

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from . import service
from .schemas import RabRequest

router = APIRouter(prefix="/rab", tags=["rab"])


@router.get("/templates")
def get_templates() -> Dict[str, Any]:
    return service.templates()


@router.post("/calculate")
def calculate(req: RabRequest) -> Dict[str, Any]:
    try:
        return service.calculate(req)
    except service.RabInputError as e:
        raise HTTPException(status_code=422, detail=str(e))
