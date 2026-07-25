from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from typing import Optional

router = APIRouter(prefix="/api/crm", tags=["CRM & Reservas"])

@router.get("/customers")
async def get_customers(search: Optional[str] = None, vip_tier: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    query = """
        SELECT id, full_name, phone, email, instagram, birth_date, vip_tier, total_visits, total_spend, preferred_drink, notes, no_show_score
        FROM customers
        WHERE 1=1
    """
    params = {}
    if search:
        query += " AND (full_name ILIKE :search OR email ILIKE :search OR phone ILIKE :search OR instagram ILIKE :search)"
        params["search"] = f"%{search}%"
    if vip_tier:
        query += " AND vip_tier = :vip_tier"
        params["vip_tier"] = vip_tier
        
    query += " ORDER BY total_spend DESC"
    
    res = await db.execute(text(query), params)
    rows = res.fetchall()
    
    customers = []
    for r in rows:
        customers.append({
            "id": r.id,
            "full_name": r.full_name,
            "phone": r.phone,
            "email": r.email,
            "instagram": r.instagram,
            "birth_date": r.birth_date.isoformat() if r.birth_date else None,
            "vip_tier": r.vip_tier,
            "total_visits": r.total_visits,
            "total_spend": float(r.total_spend) if r.total_spend else 0.0,
            "preferred_drink": r.preferred_drink,
            "notes": r.notes,
            "no_show_score": float(r.no_show_score) if r.no_show_score else 0.0
        })
    return customers

@router.get("/customers/{customer_id}/affinity")
async def get_customer_affinity(customer_id: int, db: AsyncSession = Depends(get_db)):
    query = """
        SELECT cbv.id, b.name as brand_name, b.accent_color, cbv.visit_count, cbv.last_visit, cbv.avg_spend
        FROM customer_brand_visits cbv
        JOIN brands b ON cbv.brand_id = b.id
        WHERE cbv.customer_id = :customer_id
        ORDER BY cbv.visit_count DESC
    """
    res = await db.execute(text(query), {"customer_id": customer_id})
    rows = res.fetchall()
    
    affinity = []
    for r in rows:
        affinity.append({
            "id": r.id,
            "brand_name": r.brand_name,
            "accent_color": r.accent_color,
            "visit_count": r.visit_count,
            "last_visit": r.last_visit.isoformat() if r.last_visit else None,
            "avg_spend": float(r.avg_spend) if r.avg_spend else 0.0
        })
    return affinity

@router.get("/reservations")
async def get_reservations(brand_id: Optional[int] = None, date: Optional[str] = "2025-07-19", db: AsyncSession = Depends(get_db)):
    query = """
        SELECT 
            r.id,
            c.full_name as customer_name,
            c.vip_tier as customer_vip_tier,
            c.no_show_score,
            v.name as venue_name,
            b.name as brand_name,
            b.accent_color,
            r.reservation_date,
            r.party_size,
            r.type,
            r.status,
            r.bottle_package,
            r.estimated_spend,
            r.deposit_paid,
            r.special_notes
        FROM reservations r
        JOIN customers c ON r.customer_id = c.id
        JOIN venues v ON r.venue_id = v.id
        JOIN brands b ON v.brand_id = b.id
        WHERE r.reservation_date = :date
    """
    params = {"date": date}
    if brand_id:
        query += " AND b.id = :brand_id"
        params["brand_id"] = brand_id
        
    query += " ORDER BY c.vip_tier = 'platinum' DESC, c.vip_tier = 'gold' DESC, r.created_at"
    
    res = await db.execute(text(query), params)
    rows = res.fetchall()
    
    reservations = []
    for r in rows:
        reservations.append({
            "id": r.id,
            "customer_name": r.customer_name,
            "customer_vip_tier": r.customer_vip_tier,
            "no_show_score": float(r.no_show_score) if r.no_show_score else 0.0,
            "venue_name": r.venue_name,
            "brand_name": r.brand_name,
            "accent_color": r.accent_color,
            "reservation_date": r.reservation_date.isoformat(),
            "party_size": r.party_size,
            "type": r.type,
            "status": r.status,
            "bottle_package": r.bottle_package,
            "estimated_spend": float(r.estimated_spend) if r.estimated_spend else 0.0,
            "deposit_paid": float(r.deposit_paid) if r.deposit_paid else 0.0,
            "special_notes": r.special_notes
        })
    return reservations
