from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from typing import Optional

router = APIRouter(prefix="/api/alerts", tags=["Alertas"])

@router.get("")
async def get_alerts(brand_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    query = """
        SELECT 
            a.id,
            v.name as venue_name,
            b.name as brand_name,
            b.accent_color,
            a.type,
            a.severity,
            a.title,
            a.message,
            a.is_resolved,
            a.created_at
        FROM alerts a
        LEFT JOIN venues v ON a.venue_id = v.id
        LEFT JOIN brands b ON a.brand_id = b.id OR v.brand_id = b.id
        WHERE a.is_resolved = FALSE
    """
    params = {}
    if brand_id:
        query += " AND (b.id = :brand_id OR a.brand_id = :brand_id)"
        params["brand_id"] = brand_id
        
    query += " ORDER BY a.severity = 'critical' DESC, a.severity = 'high' DESC, a.created_at DESC"
    
    res = await db.execute(text(query), params)
    rows = res.fetchall()
    
    alerts = []
    for r in rows:
        alerts.append({
            "id": r.id,
            "venue_name": r.venue_name,
            "brand_name": r.brand_name,
            "accent_color": r.accent_color if r.accent_color else "#8B5CF6",
            "type": r.type,
            "severity": r.severity,
            "title": r.title,
            "message": r.message,
            "is_resolved": r.is_resolved,
            "created_at": r.created_at.isoformat()
        })
    return alerts
