from fastapi import FastAPI, APIRouter, HTTPException, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import Any, Dict
import uuid
from datetime import datetime, timezone

from materials import cache as materials_cache
from materials.provider import MockMaterialResearchProvider
from materials.schemas import MaterialSearchRequest, MaterialSearchResponse
from rab.router import router as rab_router


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Floor Planner + Cost Estimator API")
api_router = APIRouter(prefix="/api")

# Single instantiation point for the material research provider — swap this
# for a real (e.g. web-search-backed) implementation later without touching
# the endpoint, the cache, or any frontend code.
material_provider = MockMaterialResearchProvider()

LIST_FIELDS = {
    "_id": 0,
}
SUMMARY_PROJECTION = {
    "_id": 0,
    "id": 1,
    "name": 1,
    "client": 1,
    "location": 1,
    "building": 1,
    "land": 1,
    "floorCount": 1,
    "currency": 1,
    "estimatedCost": 1,
    "buildingArea": 1,
    "createdAt": 1,
    "updatedAt": 1,
    "thumbnail": 1,
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@api_router.get("/")
async def root():
    return {"message": "Floor Planner + Cost Estimator API"}


@api_router.get("/projects")
async def list_projects():
    docs = await db.projects.find({}, SUMMARY_PROJECTION).sort("updatedAt", -1).to_list(1000)
    return docs


@api_router.post("/projects")
async def create_project(payload: Dict[str, Any] = Body(...)):
    now = _now()
    payload["id"] = payload.get("id") or str(uuid.uuid4())
    payload["createdAt"] = now
    payload["updatedAt"] = now
    await db.projects.insert_one(dict(payload))
    payload.pop("_id", None)
    return payload


@api_router.get("/projects/{pid}")
async def get_project(pid: str):
    doc = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return doc


@api_router.put("/projects/{pid}")
async def update_project(pid: str, payload: Dict[str, Any] = Body(...)):
    payload.pop("_id", None)
    payload["id"] = pid
    payload["updatedAt"] = _now()
    if "createdAt" not in payload:
        payload["createdAt"] = payload["updatedAt"]
    await db.projects.update_one({"id": pid}, {"$set": payload}, upsert=True)
    doc = await db.projects.find_one({"id": pid}, {"_id": 0})
    return doc


@api_router.delete("/projects/{pid}")
async def delete_project(pid: str):
    await db.projects.delete_one({"id": pid})
    return {"ok": True}


@api_router.post("/materials/search", response_model=MaterialSearchResponse)
async def search_materials(payload: MaterialSearchRequest):
    cached = await materials_cache.get_cached(db, payload.country, payload.category, material_provider.name)
    if cached:
        return {
            "materials": cached["materials"],
            "cached": True,
            "cachedAt": cached["fetchedAt"],
            "country": payload.country,
            "category": payload.category,
        }

    recommendations = await material_provider.get_recommendations(payload.country, payload.category)
    materials_dicts = [m.model_dump() for m in recommendations]
    doc = await materials_cache.set_cached(db, payload.country, payload.category, materials_dicts, material_provider.name)
    return {
        "materials": materials_dicts,
        "cached": False,
        "cachedAt": doc["fetchedAt"],
        "country": payload.country,
        "category": payload.category,
    }


api_router.include_router(rab_router)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
