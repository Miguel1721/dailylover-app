from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import require_permission
from app.schemas.commissions import CommissionRuleCreate, CommissionRuleOut, EventCloseRequest
from typing import List
from uuid import UUID

router = APIRouter(prefix="/api/v1/admin", tags=["Commissions"])

@router.get("/commission-rules")
async def list_commission_rules(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("comisiones", "view"))
):
    """List all commission rules, joining employee names."""
    res = await db.execute(text("""
        SELECT cr.id, cr.employee_id, cr.commission_type, cr.value, cr.applies_to, cr.active, e.full_name as employee_name
        FROM commission_rules cr
        JOIN employees e ON e.id = cr.employee_id
        ORDER BY e.full_name
    """))
    return [
        {
            "id": str(r.id),
            "employee_id": str(r.employee_id),
            "employee_name": r.employee_name,
            "commission_type": r.commission_type,
            "value": float(r.value),
            "applies_to": r.applies_to,
            "active": r.active
        } for r in res.fetchall()
    ]

@router.post("/commission-rules", status_code=status.HTTP_201_CREATED)
async def create_commission_rule(
    req: CommissionRuleCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("comisiones", "manage"))
):
    """Create a new commission rule for an employee."""
    # Check if employee exists
    emp_res = await db.execute(text("SELECT id FROM employees WHERE id = :id"), {"id": req.employee_id})
    if not emp_res.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empleado no encontrado")
        
    # Check if employee already has active rules
    dup_res = await db.execute(text("""
        SELECT id FROM commission_rules 
        WHERE employee_id = :emp_id AND active = true
    """), {"emp_id": req.employee_id})
    if dup_res.fetchone():
        # Deactivate previous active rules
        await db.execute(text("""
            UPDATE commission_rules 
            SET active = false 
            WHERE employee_id = :emp_id
        """), {"emp_id": req.employee_id})

    res = await db.execute(text("""
        INSERT INTO commission_rules (employee_id, commission_type, value, applies_to, active)
        VALUES (:emp_id, :type, :value, 'event', true)
        RETURNING id, employee_id, commission_type, value, applies_to, active
    """), {"emp_id": req.employee_id, "type": req.commission_type, "value": req.value})
    
    await db.commit()
    r = res.fetchone()
    return {
        "id": str(r.id),
        "employee_id": str(r.employee_id),
        "commission_type": r.commission_type,
        "value": float(r.value),
        "applies_to": r.applies_to,
        "active": r.active
    }

@router.put("/commission-rules/{rule_id}/toggle")
async def toggle_commission_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("comisiones", "manage"))
):
    """Toggle a rule active/inactive status."""
    rule_res = await db.execute(text("SELECT id, active FROM commission_rules WHERE id = :id"), {"id": rule_id})
    rule = rule_res.fetchone()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Regla de comisión no encontrada")
        
    new_status = not rule.active
    await db.execute(text("UPDATE commission_rules SET active = :status WHERE id = :id"), {"status": new_status, "id": rule_id})
    await db.commit()
    return {"message": f"Regla cambiada a: {'activa' if new_status else 'inactiva'}"}

@router.get("/commissions/pending")
async def list_pending_commissions(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("comisiones", "view"))
):
    """List pending event commissions grouped by employee."""
    res = await db.execute(text("""
        SELECT 
            eec.id, eec.employee_id, eec.event_id, eec.amount, eec.status, eec.created_at,
            e.full_name as employee_name, ev.name as event_name, ev.date as event_date
        FROM employee_event_commissions eec
        JOIN employees e ON e.id = eec.employee_id
        JOIN events ev ON ev.id = eec.event_id
        WHERE eec.status = 'pending'
        ORDER BY e.full_name, eec.created_at
    """))
    return [
        {
            "id": str(r.id),
            "employee_id": str(r.employee_id),
            "employee_name": r.employee_name,
            "event_id": r.event_id,
            "event_name": r.event_name,
            "event_date": r.event_date.isoformat(),
            "amount": float(r.amount),
            "status": r.status,
            "created_at": r.created_at.isoformat()
        } for r in res.fetchall()
    ]

@router.post("/events/{event_id}/close")
async def close_event(
    event_id: int,
    req: EventCloseRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("eventos", "close"))
):
    """Close an event, record revenue, and calculate commissions for active rules."""
    # Check if event exists
    ev_res = await db.execute(text("SELECT id, name, date FROM events WHERE id = :id"), {"id": event_id})
    event = ev_res.fetchone()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evento no encontrado")
        
    # Check if already closed
    chk_res = await db.execute(text("SELECT id FROM income_records WHERE event_id = :id AND category = 'inscripcion'"), {"id": event_id})
    if chk_res.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este evento ya ha sido cerrado anteriormente"
        )
        
    # Record income
    await db.execute(text("""
        INSERT INTO income_records (event_id, category, description, amount, received_at)
        VALUES (:ev_id, 'inscripcion', :desc, :amount, :date)
    """), {
        "ev_id": event_id,
        "desc": f"Recaudo Evento: {event.name}",
        "amount": req.revenue,
        "date": event.date.date()
    })
    
    # Calculate employee commissions for active rules
    rules_res = await db.execute(text("SELECT employee_id, commission_type, value FROM commission_rules WHERE active = true"))
    active_rules = rules_res.fetchall()
    
    commissions_created = 0
    for rule in active_rules:
        amount = 0.0
        if rule.commission_type == "percentage":
            amount = float(req.revenue) * (float(rule.value) / 100.0)
        elif rule.commission_type == "fixed":
            amount = float(rule.value)
            
        if amount > 0:
            await db.execute(text("""
                INSERT INTO employee_event_commissions (employee_id, event_id, amount, status)
                VALUES (:emp_id, :ev_id, :amount, 'pending')
            """), {
                "emp_id": rule.employee_id,
                "ev_id": event_id,
                "amount": amount
            })
            commissions_created += 1
            
    await db.commit()
    return {
        "message": f"Evento cerrado correctamente. Se registró el ingreso por COP {req.revenue:,.2f} y se liquidaron {commissions_created} comisiones."
    }
