from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db

router = APIRouter(prefix="/api/brands", tags=["Brands"])

@router.get("")
async def get_brands(db: AsyncSession = Depends(get_db)):
    query = text("SELECT id, name, slug, genre, accent_color, city, capacity, description, logo_url, is_active FROM brands ORDER BY id")
    res = await db.execute(query)
    rows = res.fetchall()
    return [dict(row._mapping) for row in rows]

@router.get("/{brand_id}")
async def get_brand(brand_id: int, db: AsyncSession = Depends(get_db)):
    query = text("SELECT id, name, slug, genre, accent_color, city, capacity, description, logo_url, is_active FROM brands WHERE id = :id")
    res = await db.execute(query, {"id": brand_id})
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Brand not found")
    return dict(row._mapping)

@router.get("/{brand_id}/venues")
async def get_brand_venues(brand_id: int, db: AsyncSession = Depends(get_db)):
    query = text("SELECT id, name, address, city, capacity, num_bars, is_active FROM venues WHERE brand_id = :brand_id")
    res = await db.execute(query, {"brand_id": brand_id})
    rows = res.fetchall()
    return [dict(row._mapping) for row in rows]
