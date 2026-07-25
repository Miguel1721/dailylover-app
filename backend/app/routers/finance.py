from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import require_permission
from app.schemas.finance import IncomeCreate, IncomeOut, ExpenseCreate, ExpenseOut, CashflowOut
from typing import List, Optional
from datetime import date, datetime, timedelta
from uuid import UUID

router = APIRouter(prefix="/api/v1/admin/finance", tags=["Finance"])

@router.get("/income", response_model=List[IncomeOut])
async def list_income(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    category: Optional[str] = Query(None),
    event_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("ingresos", "view"))
):
    """List income records with filters."""
    query = """
        SELECT ir.id, ir.event_id, ir.category, ir.description, ir.amount, ir.payment_method, ir.received_at, ir.created_at, ev.name as event_name
        FROM income_records ir
        LEFT JOIN events ev ON ev.id = ir.event_id
        WHERE (CAST(:start_date AS DATE) IS NULL OR ir.received_at >= :start_date)
          AND (CAST(:end_date AS DATE) IS NULL OR ir.received_at <= :end_date)
          AND (CAST(:category AS VARCHAR) IS NULL OR ir.category = :category)
          AND (CAST(:event_id AS INTEGER) IS NULL OR ir.event_id = :event_id)
        ORDER BY ir.received_at DESC, ir.created_at DESC
    """
    res = await db.execute(text(query), {
        "start_date": start_date,
        "end_date": end_date,
        "category": category,
        "event_id": event_id
    })
    return [
        IncomeOut(
            id=r.id,
            event_id=r.event_id,
            event_name=r.event_name,
            category=r.category,
            description=r.description,
            amount=float(r.amount),
            payment_method=r.payment_method,
            received_at=r.received_at,
            created_at=r.created_at
        ) for r in res.fetchall()
    ]

@router.post("/income", response_model=IncomeOut, status_code=status.HTTP_201_CREATED)
async def create_income(
    req: IncomeCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("ingresos", "create"))
):
    """Record a manual income transaction."""
    res = await db.execute(text("""
        INSERT INTO income_records (event_id, category, description, amount, payment_method, received_at)
        VALUES (:ev_id, :cat, :desc, :amount, :pay, :date)
        RETURNING id, event_id, category, description, amount, payment_method, received_at, created_at
    """), {
        "ev_id": req.event_id,
        "cat": req.category,
        "desc": req.description,
        "amount": req.amount,
        "pay": req.payment_method,
        "date": req.received_at
    })
    await db.commit()
    r = res.fetchone()
    
    # Fetch event name if exists
    event_name = None
    if r.event_id:
        event_name = (await db.execute(text("SELECT name FROM events WHERE id = :id"), {"id": r.event_id})).scalar()
        
    return IncomeOut(
        id=r.id,
        event_id=r.event_id,
        event_name=event_name,
        category=r.category,
        description=r.description,
        amount=float(r.amount),
        payment_method=r.payment_method,
        received_at=r.received_at,
        created_at=r.created_at
    )

@router.get("/expenses", response_model=List[ExpenseOut])
async def list_expenses(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    category: Optional[str] = Query(None),
    event_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("gastos", "view"))
):
    """List expense records with filters."""
    query = """
        SELECT er.id, er.event_id, er.category, er.description, er.amount, er.payment_method, er.paid_at, er.created_at, er.is_recurring, ev.name as event_name
        FROM expense_records er
        LEFT JOIN events ev ON ev.id = er.event_id
        WHERE (CAST(:start_date AS DATE) IS NULL OR er.paid_at >= :start_date)
          AND (CAST(:end_date AS DATE) IS NULL OR er.paid_at <= :end_date)
          AND (CAST(:category AS VARCHAR) IS NULL OR er.category = :category)
          AND (CAST(:event_id AS INTEGER) IS NULL OR er.event_id = :event_id)
        ORDER BY er.paid_at DESC, er.created_at DESC
    """
    res = await db.execute(text(query), {
        "start_date": start_date,
        "end_date": end_date,
        "category": category,
        "event_id": event_id
    })
    return [
        ExpenseOut(
            id=r.id,
            event_id=r.event_id,
            event_name=r.event_name,
            category=r.category,
            description=r.description,
            amount=float(r.amount),
            payment_method=r.payment_method,
            paid_at=r.paid_at,
            is_recurring=r.is_recurring,
            created_at=r.created_at
        ) for r in res.fetchall()
    ]

@router.post("/expenses", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
async def create_expense(
    req: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("gastos", "create"))
):
    """Record a manual expense transaction."""
    res = await db.execute(text("""
        INSERT INTO expense_records (event_id, category, description, amount, payment_method, paid_at, is_recurring)
        VALUES (:ev_id, :cat, :desc, :amount, :pay, :date, :is_rec)
        RETURNING id, event_id, category, description, amount, payment_method, paid_at, is_recurring, created_at
    """), {
        "ev_id": req.event_id,
        "cat": req.category,
        "desc": req.description,
        "amount": req.amount,
        "pay": req.payment_method,
        "date": req.paid_at,
        "is_rec": req.is_recurring
    })
    await db.commit()
    r = res.fetchone()
    
    # Fetch event name if exists
    event_name = None
    if r.event_id:
        event_name = (await db.execute(text("SELECT name FROM events WHERE id = :id"), {"id": r.event_id})).scalar()
        
    return ExpenseOut(
        id=r.id,
        event_id=r.event_id,
        event_name=event_name,
        category=r.category,
        description=r.description,
        amount=float(r.amount),
        payment_method=r.payment_method,
        paid_at=r.paid_at,
        is_recurring=r.is_recurring,
        created_at=r.created_at
    )

@router.get("/cashflow", response_model=CashflowOut)
async def get_cashflow(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("flujo_caja", "view"))
):
    """Get cashflow balance, historical monthly summaries, category summaries and 30-day projection."""
    # 1. Current Balance = Total Income - Total Expense
    inc_sum = (await db.execute(text("SELECT COALESCE(SUM(amount), 0) FROM income_records"))).scalar() or 0
    exp_sum = (await db.execute(text("SELECT COALESCE(SUM(amount), 0) FROM expense_records"))).scalar() or 0
    current_balance = float(inc_sum) - float(exp_sum)
    
    # 2. Monthly Summary (last 6 months)
    # We build month list starting from 5 months ago to current month
    monthly_summary = []
    today = datetime.now()
    
    # Generate list of YYYY-MM strings for the last 6 months
    months = []
    for i in range(5, -1, -1):
        d = today - timedelta(days=30 * i)
        months.append(d.strftime("%Y-%m"))
        
    for m in months:
        # Sum income
        inc_res = await db.execute(text("""
            SELECT COALESCE(SUM(amount), 0) FROM income_records 
            WHERE TO_CHAR(received_at, 'YYYY-MM') = :month
        """), {"month": m})
        inc = float(inc_res.scalar() or 0)
        
        # Sum expense
        exp_res = await db.execute(text("""
            SELECT COALESCE(SUM(amount), 0) FROM expense_records 
            WHERE TO_CHAR(paid_at, 'YYYY-MM') = :month
        """), {"month": m})
        exp = float(exp_res.scalar() or 0)
        
        monthly_summary.append({
            "month": m,
            "income": inc,
            "expenses": exp,
            "net": inc - exp
        })
        
    # 3. Projection 30d (average of net income of last 3 months)
    # Take months from t-3, t-2, t-1 (ignoring current partial month to be stable, or last 3 months in the monthly_summary list)
    last_3_months = monthly_summary[-4:-1] if len(monthly_summary) >= 4 else monthly_summary
    if last_3_months:
        avg_net = sum(item["net"] for item in last_3_months) / len(last_3_months)
    else:
        avg_net = 0.0
    projection_30d = avg_net
    
    # ─── 90-DAY CASHFLOW PROJECTION ───
    # 1. Fetch active employee payroll total
    payroll_sum_res = await db.execute(text("SELECT COALESCE(SUM(base_salary), 0) FROM employees WHERE status = 'active'"))
    monthly_payroll = float(payroll_sum_res.scalar() or 0.0)
    daily_payroll = monthly_payroll / 30.0

    # 2. Fetch recurring expenses monthly rate (average of last 90 days)
    recurring_exp_res = await db.execute(text("""
        SELECT COALESCE(SUM(amount), 0) / 3.0 
        FROM expense_records 
        WHERE is_recurring = true AND paid_at >= CURRENT_DATE - INTERVAL '90 days'
    """))
    monthly_recurring = float(recurring_exp_res.scalar() or 0.0)
    daily_recurring = monthly_recurring / 30.0

    # 3. Fetch future events in the next 90 days
    future_events_res = await db.execute(text("""
        SELECT id, name, date, format, budget_income 
        FROM events 
        WHERE date > NOW() AND date <= NOW() + INTERVAL '90 days'
        ORDER BY date ASC
    """))
    future_events = future_events_res.fetchall()

    # Calculate average TOTAL income per past event (not per record row — avoids inflation)
    global_avg_event_income_res = await db.execute(text("""
        SELECT COALESCE(AVG(ev_total), 0) FROM (
            SELECT event_id, SUM(amount) as ev_total
            FROM income_records
            WHERE event_id IS NOT NULL
            GROUP BY event_id
        ) sub
    """))
    global_avg_event_income = float(global_avg_event_income_res.scalar() or 0.0)
    # If still 0 (no historical data), use a conservative placeholder
    if global_avg_event_income <= 0:
        global_avg_event_income = 0.0  # Don't invent numbers with no data

    # Map future events with projected income
    projected_event_incomes = []
    for ev in future_events:
        if ev.budget_income is not None and float(ev.budget_income) > 0:
            projected_income = float(ev.budget_income)
        else:
            # Try to get total income average of past events with same format
            format_avg_res = await db.execute(text("""
                SELECT COALESCE(AVG(ev_total), 0) FROM (
                    SELECT ir.event_id, SUM(ir.amount) as ev_total
                    FROM income_records ir
                    JOIN events e ON e.id = ir.event_id
                    WHERE e.format = :format AND ir.event_id IS NOT NULL
                    GROUP BY ir.event_id
                ) sub
            """), {"format": ev.format})
            format_avg = float(format_avg_res.scalar() or 0.0)
            projected_income = format_avg if format_avg > 0 else global_avg_event_income

        projected_event_incomes.append({
            "date": ev.date,
            "income": projected_income
        })

    # Generate weekly projection points for the next 90 days (13 weeks)
    projection_90d = []
    start_date = datetime.now()
    running_balance = current_balance

    for w in range(1, 14): # weeks 1 to 13
        days_offset = w * 7
        target_date = start_date + timedelta(days=days_offset)
        
        # Calculate expected income from events scheduled up to target_date
        week_income = 0.0
        interval_start = start_date + timedelta(days=(w - 1) * 7)
        interval_end = target_date
        
        for pev in projected_event_incomes:
            ev_date = pev["date"]
            if ev_date >= interval_start and ev_date <= interval_end:
                week_income += pev["income"]
                
        # Known expenses for this 7-day interval
        week_payroll = daily_payroll * 7.0
        week_recurring = daily_recurring * 7.0
        week_expenses = week_payroll + week_recurring
        
        running_balance = running_balance + week_income - week_expenses
        
        projection_90d.append({
            "date": target_date.date().isoformat(),
            "expected_income": round(week_income, 2),
            "known_expenses": round(week_expenses, 2),
            "projected_balance": round(running_balance, 2)
        })

    # 4. Sum by category
    inc_cat_res = await db.execute(text("SELECT category, COALESCE(SUM(amount), 0) as total FROM income_records GROUP BY category"))
    by_category_income = {r.category: float(r.total) for r in inc_cat_res.fetchall()}
    
    exp_cat_res = await db.execute(text("SELECT category, COALESCE(SUM(amount), 0) as total FROM expense_records GROUP BY category"))
    by_category_expense = {r.category: float(r.total) for r in exp_cat_res.fetchall()}
    
    return CashflowOut(
        current_balance=current_balance,
        monthly_summary=monthly_summary,
        projection_30d=projection_30d,
        by_category={
            "income": by_category_income,
            "expenses": by_category_expense
        },
        projection_90d=projection_90d
    )


@router.get("/cashflow/export-pdf")
async def export_cashflow_pdf(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("finanzas", "view"))
):
    """Export cashflow summary as branded Daily Lover PDF."""
    from fastapi.responses import Response
    from app.services.pdf_service import build_cashflow_pdf

    # Get current balance
    income_total = (await db.execute(text("SELECT COALESCE(SUM(amount), 0) FROM income_records"))).scalar() or 0.0
    expense_total = (await db.execute(text("SELECT COALESCE(SUM(amount), 0) FROM expense_records"))).scalar() or 0.0
    current_balance = float(income_total) - float(expense_total)

    # Get monthly summary (last 12 months)
    monthly_rows = (await db.execute(text("""
        SELECT period_month as month, period_year as year,
               SUM(income) as income, SUM(expenses) as expenses
        FROM (
            SELECT EXTRACT(MONTH FROM received_at) as period_month, EXTRACT(YEAR FROM received_at) as period_year,
                   amount as income, 0 as expenses FROM income_records
            UNION ALL
            SELECT EXTRACT(MONTH FROM paid_at), EXTRACT(YEAR FROM paid_at),
                   0, amount FROM expense_records
        ) combined
        GROUP BY period_month, period_year
        ORDER BY period_year ASC, period_month ASC
    """))).fetchall()

    monthly_summary = [{
        "month": int(r.month),
        "year": int(r.year),
        "income": float(r.income),
        "expenses": float(r.expenses),
    } for r in monthly_rows]

    from datetime import datetime as dt
    period_label = dt.now().strftime("%Y")

    pdf_bytes = build_cashflow_pdf(monthly_summary, current_balance, period_label)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="flujo_caja_{period_label}.pdf"'}
    )
