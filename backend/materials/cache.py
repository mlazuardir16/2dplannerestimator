"""Server-side cache for normalized material recommendations.

Cache key is deliberately just `country:category` — never user-specific and
never including the requested quantity. That's what makes the cache actually
save cost as usage grows: 1000 users asking about "ID:flooring" should
trigger ~1 real provider call, not 1000, because the browser does all the
quantity-dependent math itself (see frontend/src/lib/purchaseMath.js).
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

CACHE_TTL_DAYS = 30


def cache_key(country: str, category: str) -> str:
    return f"{country.upper()}:{category.lower()}"


def _parse_iso(value: str) -> datetime:
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


async def get_cached(db, country: str, category: str, provider_name: str) -> Optional[Dict[str, Any]]:
    doc = await db.materials_cache.find_one({"_id": cache_key(country, category)})
    if not doc:
        return None
    if doc.get("provider") != provider_name:
        return None  # provider/version changed — treat as stale
    if datetime.now(timezone.utc) - _parse_iso(doc["fetchedAt"]) > timedelta(days=CACHE_TTL_DAYS):
        return None
    return doc


async def set_cached(
    db, country: str, category: str, materials: List[Dict[str, Any]], provider_name: str
) -> Dict[str, Any]:
    doc = {
        "_id": cache_key(country, category),
        "country": country.upper(),
        "category": category.lower(),
        "materials": materials,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "provider": provider_name,
    }
    await db.materials_cache.replace_one({"_id": doc["_id"]}, doc, upsert=True)
    return doc
