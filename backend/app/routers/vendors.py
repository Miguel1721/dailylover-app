from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import require_permission
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID

router = APIRouter(prefix="/api/v1/admin/vendors", tags=["Vendors"])

class VendorCreate(BaseModel):
    name: str
    category: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    agreed_rate: Optional[Decimal] = None
    rate_type: Optional[str] = None
    internal_rating: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[str] = "active"

class VendorOut(BaseModel):
    id: UUID
    name: str
    category: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    agreed_rate: Optional[float] = None
    rate_type: Optional[str] = None
    internal_rating: Optional[int] = None
    notes: Optional[str] = None
    status: str
    created_at: datetime

class VendorHistoryCreate(BaseModel):
    event_id: int
    amount_paid: Optional[Decimal] = None
    performance_note: Optional[str] = None
    would_rehire: Optional[bool] = None

class VendorHistoryOut(BaseModel):
    id: UUID
    vendor_id: UUID
    event_id: Optional[int] = None
    event_name: Optional[str] = None
    event_date: Optional[datetime] = None
    amount_paid: Optional[float] = None
    performance_note: Optional[str] = None
    would_rehire: Optional[bool] = None
    created_at: datetime

@router.get("", response_model=List[VendorOut])
async def list_vendors(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("proveedores", "view"))
):
    """List vendors with optional filters for category and unaccented name search."""
    params = {}
    where_clauses = []
    
    if category:
        where_clauses.append("category = :category")
        params["category"] = category
        
    if search:
        # Use unaccent and lower for accent-insensitive and case-insensitive search
        where_clauses.append("lower(unaccent(name)) LIKE lower(unaccent(:search))")
        params["search"] = f"%{search}%"
        
    where_sql = " AND ".join(where_clauses)
    query = f"""
        SELECT id, name, category, contact_name, phone, email, agreed_rate, rate_type, 
               internal_rating, notes, status, created_at
        FROM vendors
        {f"WHERE {where_sql}" if where_clauses else ""}
        ORDER BY name ASC
    """
    res = await db.execute(text(query), params)
    return [
        VendorOut(
            id=r.id,
            name=r.name,
            category=r.category,
            contact_name=r.contact_name,
            phone=r.phone,
            email=r.email,
            agreed_rate=float(r.agreed_rate) if r.agreed_rate is not None else None,
            rate_type=r.rate_type,
            internal_rating=r.internal_rating,
            notes=r.notes,
            status=r.status,
            created_at=r.created_at
        ) for r in res.fetchall()
    ]

@router.post("", response_model=VendorOut, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    req: VendorCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("proveedores", "create"))
):
    """Create a new vendor."""
    res = await db.execute(text("""
        INSERT INTO vendors (name, category, contact_name, phone, email, agreed_rate, rate_type, internal_rating, notes, status)
        VALUES (:name, :category, :contact_name, :phone, :email, :agreed_rate, :rate_type, :internal_rating, :notes, :status)
        RETURNING id, name, category, contact_name, phone, email, agreed_rate, rate_type, internal_rating, notes, status, created_at
    """), {
        "name": req.name,
        "category": req.category,
        "contact_name": req.contact_name,
        "phone": req.phone,
        "email": req.email,
        "agreed_rate": req.agreed_rate,
        "rate_type": req.rate_type,
        "internal_rating": req.internal_rating,
        "notes": req.notes,
        "status": req.status
    })
    await db.commit()
    r = res.fetchone()
    return VendorOut(
        id=r.id,
        name=r.name,
        category=r.category,
        contact_name=r.contact_name,
        phone=r.phone,
        email=r.email,
        agreed_rate=float(r.agreed_rate) if r.agreed_rate is not None else None,
        rate_type=r.rate_type,
        internal_rating=r.internal_rating,
        notes=r.notes,
        status=r.status,
        created_at=r.created_at
    )

@router.put("/{id}", response_model=VendorOut)
async def update_vendor(
    id: UUID,
    req: VendorCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("proveedores", "edit"))
):
    """Update an existing vendor."""
    exists = (await db.execute(text("SELECT 1 FROM vendors WHERE id = :id"), {"id": id})).scalar()
    if not exists:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
        
    res = await db.execute(text("""
        UPDATE vendors
        SET name = :name,
            category = :category,
            contact_name = :contact_name,
            phone = :phone,
            email = :email,
            agreed_rate = :agreed_rate,
            rate_type = :rate_type,
            internal_rating = :internal_rating,
            notes = :notes,
            status = :status
        WHERE id = :id
        RETURNING id, name, category, contact_name, phone, email, agreed_rate, rate_type, internal_rating, notes, status, created_at
    """), {
        "id": id,
        "name": req.name,
        "category": req.category,
        "contact_name": req.contact_name,
        "phone": req.phone,
        "email": req.email,
        "agreed_rate": req.agreed_rate,
        "rate_type": req.rate_type,
        "internal_rating": req.internal_rating,
        "notes": req.notes,
        "status": req.status
    })
    await db.commit()
    r = res.fetchone()
    return VendorOut(
        id=r.id,
        name=r.name,
        category=r.category,
        contact_name=r.contact_name,
        phone=r.phone,
        email=r.email,
        agreed_rate=float(r.agreed_rate) if r.agreed_rate is not None else None,
        rate_type=r.rate_type,
        internal_rating=r.internal_rating,
        notes=r.notes,
        status=r.status,
        created_at=r.created_at
    )

@router.get("/{id}/history", response_model=List[VendorHistoryOut])
async def list_vendor_history(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("proveedores", "view"))
):
    """Get the event history for a vendor."""
    query = """
        SELECT veh.id, veh.vendor_id, veh.event_id, veh.amount_paid, veh.performance_note, 
               veh.would_rehire, veh.created_at, e.name as event_name, e.date as event_date
        FROM vendor_event_history veh
        LEFT JOIN events e ON e.id = veh.event_id
        WHERE veh.vendor_id = :vendor_id
        ORDER BY e.date DESC, veh.created_at DESC
    """
    res = await db.execute(text(query), {"vendor_id": id})
    return [
        VendorHistoryOut(
            id=r.id,
            vendor_id=r.vendor_id,
            event_id=r.event_id,
            event_name=r.event_name,
            event_date=r.event_date,
            amount_paid=float(r.amount_paid) if r.amount_paid is not None else None,
            performance_note=r.performance_note,
            would_rehire=r.would_rehire,
            created_at=r.created_at
        ) for r in res.fetchall()
    ]

@router.post("/{id}/history", response_model=VendorHistoryOut, status_code=status.HTTP_201_CREATED)
async def create_vendor_history(
    id: UUID,
    req: VendorHistoryCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("proveedores", "edit"))
):
    """Record vendor participation in an event."""
    # Check if vendor exists
    exists = (await db.execute(text("SELECT 1 FROM vendors WHERE id = :id"), {"id": id})).scalar()
    if not exists:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
        
    res = await db.execute(text("""
        INSERT INTO vendor_event_history (vendor_id, event_id, amount_paid, performance_note, would_rehire)
        VALUES (:vendor_id, :event_id, :amount_paid, :performance_note, :would_rehire)
        RETURNING id, vendor_id, event_id, amount_paid, performance_note, would_rehire, created_at
    """), {
        "vendor_id": id,
        "event_id": req.event_id,
        "amount_paid": req.amount_paid,
        "performance_note": req.performance_note,
        "would_rehire": req.would_rehire
    })
    await db.commit()
    r = res.fetchone()
    
    # Get event details
    ev_res = await db.execute(text("SELECT name, date FROM events WHERE id = :id"), {"id": r.event_id})
    ev = ev_res.fetchone()
    
    return VendorHistoryOut(
        id=r.id,
        vendor_id=r.vendor_id,
        event_id=r.event_id,
        event_name=ev.name if ev else None,
        event_date=ev.date if ev else None,
        amount_paid=float(r.amount_paid) if r.amount_paid is not None else None,
        performance_note=r.performance_note,
        would_rehire=r.would_rehire,
        created_at=r.created_at
    )
