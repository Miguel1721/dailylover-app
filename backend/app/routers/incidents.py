from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import require_permission
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from uuid import UUID

router = APIRouter(prefix="/api/v1/admin", tags=["Incidents"])

class IncidentCreate(BaseModel):
    category: str
    severity: str
    description: str

class IncidentOut(BaseModel):
    id: UUID
    event_id: int
    reported_by: Optional[UUID] = None
    reported_by_name: Optional[str] = None
    category: str
    severity: str
    description: str
    resolved: bool
    created_at: datetime

@router.get("/events/{event_id}/incidents", response_model=List[IncidentOut])
async def list_event_incidents(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("eventos", "view"))
):
    """List all incidents for a specific event."""
    query = """
        SELECT ei.id, ei.event_id, ei.reported_by, ei.category, ei.severity, 
               ei.description, ei.resolved, ei.created_at, e.full_name as reported_by_name
        FROM event_incidents ei
        LEFT JOIN employees e ON e.id = ei.reported_by
        WHERE ei.event_id = :event_id
        ORDER BY ei.created_at DESC
    """
    res = await db.execute(text(query), {"event_id": event_id})
    return [
        IncidentOut(
            id=r.id,
            event_id=r.event_id,
            reported_by=r.reported_by,
            reported_by_name=r.reported_by_name,
            category=r.category,
            severity=r.severity,
            description=r.description,
            resolved=r.resolved,
            created_at=r.created_at
        ) for r in res.fetchall()
    ]

@router.post("/events/{event_id}/incidents", response_model=IncidentOut, status_code=status.HTTP_201_CREATED)
async def create_event_incident(
    event_id: int,
    req: IncidentCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("eventos", "edit"))
):
    """Create a new incident for an event, reported by the current authenticated user's employee."""
    # Find employee_id corresponding to user.id
    user_id = user["id"]
    emp_res = await db.execute(text(
        "SELECT employee_id FROM user_accounts WHERE id = :user_id"
    ), {"user_id": user_id})
    employee_id = emp_res.scalar()

    if not employee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cuenta de usuario no está asociada a ningún empleado"
        )

    res = await db.execute(text("""
        INSERT INTO event_incidents (event_id, reported_by, category, severity, description, resolved)
        VALUES (:event_id, :reported_by, :category, :severity, :description, false)
        RETURNING id, event_id, reported_by, category, severity, description, resolved, created_at
    """), {
        "event_id": event_id,
        "reported_by": employee_id,
        "category": req.category,
        "severity": req.severity,
        "description": req.description
    })
    await db.commit()
    r = res.fetchone()

    # Get employee name
    emp_name = (await db.execute(text("SELECT full_name FROM employees WHERE id = :id"), {"id": r.reported_by})).scalar()

    return IncidentOut(
        id=r.id,
        event_id=r.event_id,
        reported_by=r.reported_by,
        reported_by_name=emp_name,
        category=r.category,
        severity=r.severity,
        description=r.description,
        resolved=r.resolved,
        created_at=r.created_at
    )

@router.put("/incidents/{id}/resolve", response_model=IncidentOut)
async def resolve_incident(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("eventos", "edit"))
):
    """Mark an incident as resolved."""
    # Check if exists
    exists = (await db.execute(text("SELECT 1 FROM event_incidents WHERE id = :id"), {"id": id})).scalar()
    if not exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incidente no encontrado"
        )

    res = await db.execute(text("""
        UPDATE event_incidents
        SET resolved = true
        WHERE id = :id
        RETURNING id, event_id, reported_by, category, severity, description, resolved, created_at
    """), {"id": id})
    await db.commit()
    r = res.fetchone()

    emp_name = (await db.execute(text("SELECT full_name FROM employees WHERE id = :id"), {"id": r.reported_by})).scalar() if r.reported_by else None

    return IncidentOut(
        id=r.id,
        event_id=r.event_id,
        reported_by=r.reported_by,
        reported_by_name=emp_name,
        category=r.category,
        severity=r.severity,
        description=r.description,
        resolved=r.resolved,
        created_at=r.created_at
    )

@router.get("/incidents/recent", response_model=List[IncidentOut])
async def list_recent_incidents(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("dashboard", "view"))
):
    """List 10 most recent incidents across all events."""
    query = """
        SELECT ei.id, ei.event_id, ei.reported_by, ei.category, ei.severity, 
               ei.description, ei.resolved, ei.created_at, e.full_name as reported_by_name
        FROM event_incidents ei
        LEFT JOIN employees e ON e.id = ei.reported_by
        ORDER BY ei.created_at DESC
        LIMIT 10
    """
    res = await db.execute(text(query))
    return [
        IncidentOut(
            id=r.id,
            event_id=r.event_id,
            reported_by=r.reported_by,
            reported_by_name=r.reported_by_name,
            category=r.category,
            severity=r.severity,
            description=r.description,
            resolved=r.resolved,
            created_at=r.created_at
        ) for r in res.fetchall()
    ]
