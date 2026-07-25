from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import require_permission
from app.schemas.payroll import PayrollGenerate, PayrollRunOut, PayrollItemOut
from typing import List
from uuid import UUID
from datetime import datetime

router = APIRouter(prefix="/api/v1/admin/payroll", tags=["Payroll"])

DEDUCTION_RATE = 0.08  # 8% standard Colombian health + pension deduction

@router.get("/history", response_model=List[PayrollRunOut])
async def list_payroll_history(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("nomina", "view"))
):
    """Get history of all payroll runs."""
    res = await db.execute(text("""
        SELECT id, period_month, period_year, status, total_base, total_commissions, total_deductions, total_paid, liquidated_at
        FROM payroll_runs
        ORDER BY period_year DESC, period_month DESC
    """))
    return [
        PayrollRunOut(
            id=r.id,
            period_month=r.period_month,
            period_year=r.period_year,
            status=r.status,
            total_base=float(r.total_base or 0),
            total_commissions=float(r.total_commissions or 0),
            total_deductions=float(r.total_deductions or 0),
            total_paid=float(r.total_paid or 0),
            liquidated_at=r.liquidated_at
        ) for r in res.fetchall()
    ]

@router.get("/{run_id}")
async def get_payroll_details(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("nomina", "view"))
):
    """Get full details of a specific payroll run including items."""
    # Get run
    run_res = await db.execute(text("""
        SELECT id, period_month, period_year, status, total_base, total_commissions, total_deductions, total_paid, liquidated_at
        FROM payroll_runs WHERE id = :id
    """), {"id": run_id})
    run = run_res.fetchone()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nómina no encontrada")
        
    # Get items
    items_res = await db.execute(text("""
        SELECT 
            pi.id, pi.employee_id, pi.base_salary, pi.commissions, pi.deductions, pi.total,
            e.full_name as employee_name, e.role as employee_role
        FROM payroll_items pi
        JOIN employees e ON e.id = pi.employee_id
        WHERE pi.payroll_run_id = :run_id
        ORDER BY e.full_name
    """), {"run_id": run_id})
    
    items = [
        {
            "id": str(i.id),
            "employee_id": str(i.employee_id),
            "employee_name": i.employee_name,
            "employee_role": i.employee_role,
            "base_salary": float(i.base_salary or 0),
            "commissions": float(i.commissions or 0),
            "deductions": float(i.deductions or 0),
            "total": float(i.total or 0)
        } for i in items_res.fetchall()
    ]
    
    return {
        "payroll_run": {
            "id": str(run.id),
            "period_month": run.period_month,
            "period_year": run.period_year,
            "status": run.status,
            "total_base": float(run.total_base or 0),
            "total_commissions": float(run.total_commissions or 0),
            "total_deductions": float(run.total_deductions or 0),
            "total_paid": float(run.total_paid or 0),
            "liquidated_at": run.liquidated_at.isoformat() if run.liquidated_at else None
        },
        "items": items
    }

@router.post("/generate")
async def generate_payroll(
    req: PayrollGenerate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("nomina", "generate"))
):
    """Generate a draft payroll run, calculating salaries, commissions, and deductions."""
    # Check if run exists
    exist_res = await db.execute(text("""
        SELECT id, status FROM payroll_runs 
        WHERE period_month = :m AND period_year = :y
    """), {"m": req.month, "y": req.year})
    existing = exist_res.fetchone()
    
    if existing:
        if existing.status == "liquidated":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La nómina para el periodo {req.month}/{req.year} ya fue liquidada e historizada."
            )
        else:
            # Delete old draft to regenerate
            await db.execute(text("DELETE FROM payroll_runs WHERE id = :id"), {"id": existing.id})
            
    # Insert new payroll run
    run_res = await db.execute(text("""
        INSERT INTO payroll_runs (period_month, period_year, status, total_base, total_commissions, total_deductions, total_paid)
        VALUES (:m, :y, 'draft', 0, 0, 0, 0)
        RETURNING id
    """), {"m": req.month, "y": req.year})
    run_id = run_res.scalar()
    
    # Get active employees
    emps_res = await db.execute(text("SELECT id, base_salary FROM employees WHERE status = 'active'"))
    employees = emps_res.fetchall()
    
    total_base = 0.0
    total_commissions = 0.0
    total_deductions = 0.0
    total_paid = 0.0
    
    for emp in employees:
        # Sum pending commissions
        comm_res = await db.execute(text("""
            SELECT COALESCE(SUM(amount), 0) 
            FROM employee_event_commissions 
            WHERE employee_id = :emp_id AND status = 'pending'
        """), {"emp_id": emp.id})
        comm_sum = float(comm_res.scalar() or 0)
        
        base = float(emp.base_salary)
        deduction = round(base * DEDUCTION_RATE, 2)
        total = base + comm_sum - deduction
        
        total_base += base
        total_commissions += comm_sum
        total_deductions += deduction
        total_paid += total
        
        await db.execute(text("""
            INSERT INTO payroll_items (payroll_run_id, employee_id, base_salary, commissions, deductions, total)
            VALUES (:run_id, :emp_id, :base, :comm, :ded, :total)
        """), {
            "run_id": run_id,
            "emp_id": emp.id,
            "base": base,
            "comm": comm_sum,
            "ded": deduction,
            "total": total
        })
        
    # Update totals
    await db.execute(text("""
        UPDATE payroll_runs 
        SET total_base = :base, total_commissions = :comm, total_deductions = :ded, total_paid = :total
        WHERE id = :run_id
    """), {
        "base": total_base,
        "comm": total_commissions,
        "ded": total_deductions,
        "total": total_paid,
        "run_id": run_id
    })
    
    await db.commit()
    return {"run_id": str(run_id), "message": "Nómina en borrador generada exitosamente"}

@router.post("/{run_id}/liquidate")
async def liquidate_payroll(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("nomina", "liquidate"))
):
    """Liquidate payroll: update commissions status to 'paid' and post to expense ledger."""
    # Get run
    run_res = await db.execute(text("SELECT id, period_month, period_year, status, total_paid FROM payroll_runs WHERE id = :id"), {"id": run_id})
    run = run_res.fetchone()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nómina no encontrada")
        
    if run.status == "liquidated":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta nómina ya ha sido liquidada")
        
    # Mark as liquidated
    await db.execute(text("""
        UPDATE payroll_runs 
        SET status = 'liquidated', liquidated_at = NOW() 
        WHERE id = :id
    """), {"id": run_id})
    
    # Update all items' commissions to 'paid'
    items_res = await db.execute(text("SELECT employee_id FROM payroll_items WHERE payroll_run_id = :id"), {"id": run_id})
    for item in items_res.fetchall():
        await db.execute(text("""
            UPDATE employee_event_commissions 
            SET status = 'paid' 
            WHERE employee_id = :emp_id AND status = 'pending'
        """), {"emp_id": item.employee_id})
        
    # Record expense in finance book
    await db.execute(text("""
        INSERT INTO expense_records (category, description, amount, payment_method, paid_at)
        VALUES ('nomina', :desc, :amount, 'transferencia', NOW())
    """), {
        "desc": f"Liquidación Nómina Periodo {run.period_month}/{run.period_year}",
        "amount": float(run.total_paid)
    })
    
    await db.commit()
    return {"message": f"Nómina liquidada. Registrado gasto de nómina por COP {float(run.total_paid):,.2f}."}


@router.get("/{run_id}/export-pdf")
async def export_payroll_pdf(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("nomina", "view"))
):
    """Export a payroll run as a branded PDF document."""
    from fastapi.responses import Response
    from app.services.pdf_service import build_payroll_pdf

    # Fetch the payroll run
    run_row = (await db.execute(text("""
        SELECT pr.id, pr.period_month, pr.period_year, pr.status, pr.total_base, pr.total_commissions, pr.total_deductions, pr.total_paid, pr.liquidated_at,
               ua.username as executed_by_name
        FROM payroll_runs pr
        LEFT JOIN user_accounts ua ON ua.id = pr.liquidated_by
        WHERE pr.id = :run_id
    """), {"run_id": run_id})).fetchone()

    if not run_row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Nómina no encontrada")

    run_dict = {
        "period_month": run_row.period_month,
        "period_year": run_row.period_year,
        "status": run_row.status,
        "total_paid": float(run_row.total_paid or 0),
        "executed_by_name": run_row.executed_by_name,
        "executed_at": str(run_row.liquidated_at or ""),
    }

    # Fetch individual payroll items
    items_res = (await db.execute(text("""
        SELECT pi.employee_id, pi.base_salary, pi.total_commissions as commissions, pi.deductions, pi.net_payment,
               emp.full_name, emp.position
        FROM payroll_items pi
        JOIN employees emp ON emp.id = pi.employee_id
        WHERE pi.run_id = :run_id
    """), {"run_id": run_id})).fetchall()

    employees_list = [{
        "full_name": row.full_name,
        "position": row.position,
        "base_salary": float(row.base_salary or 0),
        "commissions": float(row.commissions or 0),
        "deductions": float(row.deductions or 0),
        "net": float(row.net_payment or 0),
    } for row in items_res]

    pdf_bytes = build_payroll_pdf(run_dict, employees_list)
    filename = f"nomina_{run_row.period_month:02d}_{run_row.period_year}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
