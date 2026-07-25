from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from typing import Optional

router = APIRouter(prefix="/api/compliance", tags=["Compliance & Regulaciones"])

@router.get("")
async def get_compliance_items(brand_id: Optional[int] = None, category: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    query = """
        SELECT 
            ci.id,
            v.name as venue_name,
            b.name as brand_name,
            b.accent_color,
            ci.category,
            ci.item_name,
            ci.due_date,
            ci.status,
            ci.responsible,
            ci.notes,
            ci.completed_at
        FROM compliance_items ci
        JOIN venues v ON ci.venue_id = v.id
        JOIN brands b ON v.brand_id = b.id
        WHERE 1=1
    """
    params = {}
    if brand_id:
        query += " AND b.id = :brand_id"
        params["brand_id"] = brand_id
    if category:
        query += " AND ci.category = :category"
        params["category"] = category
        
    query += " ORDER BY ci.status = 'overdue' DESC, ci.due_date ASC"
    
    res = await db.execute(text(query), params)
    rows = res.fetchall()
    
    items = []
    for r in rows:
        items.append({
            "id": r.id,
            "venue_name": r.venue_name,
            "brand_name": r.brand_name,
            "accent_color": r.accent_color,
            "category": r.category,
            "item_name": r.item_name,
            "due_date": r.due_date.isoformat() if r.due_date else None,
            "status": r.status,
            "responsible": r.responsible,
            "notes": r.notes,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None
        })
    return items

@router.get("/summary")
async def get_compliance_summary(brand_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    query = """
        SELECT 
            ci.status,
            COUNT(*) as count
        FROM compliance_items ci
        JOIN venues v ON ci.venue_id = v.id
        JOIN brands b ON v.brand_id = b.id
        WHERE 1=1
    """
    params = {}
    if brand_id:
        query += " AND b.id = :brand_id"
        params["brand_id"] = brand_id
        
    query += " GROUP BY ci.status"
    
    res = await db.execute(text(query), params)
    rows = res.fetchall()
    
    summary = {"pending": 0, "completed": 0, "overdue": 0, "not_applicable": 0}
    for r in rows:
        summary[r.status] = r.count
        
    return summary
