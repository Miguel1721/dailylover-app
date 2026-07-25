from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from typing import Optional

router = APIRouter(prefix="/api/cash-registers", tags=["Cash Registers"])

@router.get("")
async def get_cash_registers(brand_id: Optional[int] = None, date: Optional[str] = "2025-07-12", db: AsyncSession = Depends(get_db)):
    query = """
        SELECT 
            cr.id,
            cr.venue_id,
            v.name as venue_name,
            b.name as brand_name,
            b.accent_color,
            cr.register_date,
            cr.cash_total,
            cr.card_total,
            cr.nequi_total,
            cr.rappi_total,
            cr.cover_total,
            cr.pos_total,
            cr.discrepancy,
            cr.void_count,
            cr.discount_count,
            cr.courtesy_count,
            cr.status,
            cr.anomaly_score,
            cr.ai_notes
        FROM cash_registers cr
        JOIN venues v ON cr.venue_id = v.id
        JOIN brands b ON v.brand_id = b.id
        WHERE cr.register_date = :date
    """
    params = {"date": date}
    if brand_id:
        query += " AND b.id = :brand_id"
        params["brand_id"] = brand_id
        
    query += " ORDER BY cr.anomaly_score DESC"
    
    res = await db.execute(text(query), params)
    rows = res.fetchall()
    
    registers = []
    for r in rows:
        registers.append({
            "id": r.id,
            "venue_id": r.venue_id,
            "venue_name": r.venue_name,
            "brand_name": r.brand_name,
            "accent_color": r.accent_color,
            "register_date": r.register_date.isoformat(),
            "cash_total": float(r.cash_total),
            "card_total": float(r.card_total),
            "nequi_total": float(r.nequi_total),
            "rappi_total": float(r.rappi_total),
            "cover_total": float(r.cover_total),
            "pos_total": float(r.pos_total),
            "discrepancy": float(r.discrepancy),
            "void_count": r.void_count,
            "discount_count": r.discount_count,
            "courtesy_count": r.courtesy_count,
            "status": r.status,
            "anomaly_score": float(r.anomaly_score),
            "ai_notes": r.ai_notes
        })
    return registers

@router.get("/{register_id}")
async def get_cash_register(register_id: int, db: AsyncSession = Depends(get_db)):
    query = """
        SELECT 
            cr.id,
            v.name as venue_name,
            b.name as brand_name,
            b.accent_color,
            cr.register_date,
            cr.cash_total,
            cr.card_total,
            cr.nequi_total,
            cr.rappi_total,
            cr.cover_total,
            cr.pos_total,
            cr.discrepancy,
            cr.void_count,
            cr.discount_count,
            cr.courtesy_count,
            cr.status,
            cr.anomaly_score,
            cr.ai_notes
        FROM cash_registers cr
        JOIN venues v ON cr.venue_id = v.id
        JOIN brands b ON v.brand_id = b.id
        WHERE cr.id = :id
    """
    res = await db.execute(text(query), {"id": register_id})
    r = res.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Cash register not found")
        
    # Get anomalies
    anomalies_query = """
        SELECT id, type, severity, amount, description, employee_name, detected_at
        FROM cash_anomalies
        WHERE register_id = :register_id
        ORDER BY severity = 'critical' DESC, severity = 'high' DESC, detected_at DESC
    """
    anom_res = await db.execute(text(anomalies_query), {"register_id": register_id})
    anom_rows = anom_res.fetchall()
    
    anomalies = []
    for a in anom_rows:
        anomalies.append({
            "id": a.id,
            "type": a.type,
            "severity": a.severity,
            "amount": float(a.amount) if a.amount else 0.0,
            "description": a.description,
            "employee_name": a.employee_name,
            "detected_at": a.detected_at.isoformat()
        })
        
    return {
        "register": {
            "id": r.id,
            "venue_name": r.venue_name,
            "brand_name": r.brand_name,
            "accent_color": r.accent_color,
            "register_date": r.register_date.isoformat(),
            "cash_total": float(r.cash_total),
            "card_total": float(r.card_total),
            "nequi_total": float(r.nequi_total),
            "rappi_total": float(r.rappi_total),
            "cover_total": float(r.cover_total),
            "pos_total": float(r.pos_total),
            "discrepancy": float(r.discrepancy),
            "void_count": r.void_count,
            "discount_count": r.discount_count,
            "courtesy_count": r.courtesy_count,
            "status": r.status,
            "anomaly_score": float(r.anomaly_score),
            "ai_notes": r.ai_notes
        },
        "anomalies": anomalies
    }

@router.get("/summary/kpis")
async def get_cash_summary(brand_id: Optional[int] = None, date: Optional[str] = "2025-07-12", db: AsyncSession = Depends(get_db)):
    query = """
        SELECT 
            COALESCE(SUM(cash_total), 0) as cash,
            COALESCE(SUM(card_total), 0) as card,
            COALESCE(SUM(nequi_total), 0) as nequi,
            COALESCE(SUM(rappi_total), 0) as rappi,
            COALESCE(SUM(cover_total), 0) as cover,
            COALESCE(SUM(pos_total), 0) as pos,
            COALESCE(SUM(discrepancy), 0) as discrepancy,
            COALESCE(AVG(anomaly_score), 0) as avg_anomaly
        FROM cash_registers cr
        JOIN venues v ON cr.venue_id = v.id
        WHERE cr.register_date = :date
    """
    params = {"date": date}
    if brand_id:
        query += " AND v.brand_id = :brand_id"
        params["brand_id"] = brand_id
        
    res = await db.execute(text(query), params)
    r = res.fetchone()
    
    # Get active anomalies count
    anom_count_query = """
        SELECT COUNT(*) as count
        FROM cash_anomalies ca
        JOIN cash_registers cr ON ca.register_id = cr.id
        JOIN venues v ON cr.venue_id = v.id
        WHERE cr.register_date = :date
    """
    if brand_id:
        anom_count_query += " AND v.brand_id = :brand_id"
        
    anom_res = await db.execute(text(anom_count_query), params)
    anom_count = anom_res.fetchone().count
    
    return {
        "cash_total": float(r.cash),
        "card_total": float(r.card),
        "nequi_total": float(r.nequi),
        "rappi_total": float(r.rappi),
        "cover_total": float(r.cover),
        "pos_total": float(r.pos),
        "discrepancy_total": float(r.discrepancy),
        "avg_anomaly_score": float(r.avg_anomaly),
        "anomalies_count": anom_count
    }
