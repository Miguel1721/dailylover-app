from fastapi import APIRouter, Depends, Query, HTTPException
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import require_permission
from typing import Optional
import math
import json

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


# ─── STATS ────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("dashboard", "view"))
):
    """Dashboard KPI summary."""
    total_users = (await db.execute(text("SELECT COUNT(*) FROM users"))).scalar() or 0

    events_this_month = (await db.execute(text("""
        SELECT COUNT(*) FROM events
        WHERE date >= date_trunc('month', NOW())
          AND date < date_trunc('month', NOW()) + INTERVAL '1 month'
    """))).scalar() or 0

    active_matches = (await db.execute(text(
        "SELECT (SELECT COUNT(*) FROM match_requests WHERE status = 'pending') + (SELECT COUNT(*) FROM historical_matches)"
    ))).scalar() or 0

    avg_sat_row = (await db.execute(text(
        "SELECT ROUND(AVG(satisfaccion)::numeric, 1) FROM post_event_feedback WHERE satisfaccion IS NOT NULL"
    ))).scalar()
    avg_satisfaction = float(avg_sat_row) if avg_sat_row else None

    # Weekly growth: new users per week for last 8 weeks
    weekly_rows = (await db.execute(text("""
        SELECT
            EXTRACT(WEEK FROM created_at) AS wk,
            COUNT(*) AS cnt
        FROM users
        WHERE created_at >= NOW() - INTERVAL '8 weeks'
        GROUP BY wk
        ORDER BY wk
    """))).fetchall()
    weekly_growth = [int(r.cnt) for r in weekly_rows]

    # Alert-specific metrics
    active_debts = (await db.execute(text(
        "SELECT COUNT(*) FROM accounts_receivable WHERE status = 'pending' AND due_date < CURRENT_DATE"
    ))).scalar() or 0

    pending_payrolls = (await db.execute(text(
        "SELECT COUNT(*) FROM payroll_runs WHERE status = 'draft'"
    ))).scalar() or 0

    critical_events = (await db.execute(text("""
        SELECT COUNT(*) FROM (
            SELECT e.id, e.capacity, COUNT(ea.user_id) as attendees_count
            FROM events e
            LEFT JOIN event_attendees ea ON ea.event_id = e.id AND ea.status IN ('confirmed', 'attended')
            WHERE e.date > NOW()
            GROUP BY e.id, e.capacity
        ) sub WHERE attendees_count >= (capacity * 0.85) AND capacity > 0
    """))).scalar() or 0

    return {
        "total_users": total_users,
        "events_this_month": events_this_month,
        "active_matches": active_matches,
        "avg_satisfaction": avg_satisfaction,
        "weekly_growth": weekly_growth,
        "active_debts": active_debts,
        "pending_payrolls": pending_payrolls,
        "critical_events": critical_events,
    }


@router.get("/today-summary")
async def get_today_summary(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("dashboard", "view"))
):
    """Consolidated operational summary of the next 48 hours."""
    now = datetime.now()
    month = now.month
    year = now.year

    # 1. Upcoming events (next 48 hours)
    event_rows = (await db.execute(text("""
        SELECT e.id, e.name, e.date, e.capacity,
               (SELECT COUNT(*) FROM event_attendees WHERE event_id = e.id AND status IN ('confirmed', 'attended')) as confirmed_attendees
        FROM events e
        WHERE e.date >= NOW() AND e.date <= NOW() + INTERVAL '48 hours'
        ORDER BY e.date ASC
    """))).fetchall()

    upcoming_events = []
    for r in event_rows:
        capacity = r.capacity or 100
        confirmed = r.confirmed_attendees or 0
        pct = (confirmed / capacity * 100.0) if capacity > 0 else 0.0
        
        # Hours until event
        time_diff = r.date - now
        hours_until = max(0.0, time_diff.total_seconds() / 3600.0)
        
        status = "critical" if pct > 85 else "warning" if pct > 70 else "normal"
        
        upcoming_events.append({
            "id": r.id,
            "name": r.name,
            "date": r.date.isoformat(),
            "hours_until": round(hours_until, 1),
            "capacity": capacity,
            "confirmed_attendees": confirmed,
            "occupancy_pct": round(pct, 1),
            "status": status
        })

    # 2. Overdue payments (cartera vencida)
    overdue_rows = (await db.execute(text("""
        SELECT ar.id, ar.user_id, ar.amount, ar.due_date, u.name as user_name,
               (CURRENT_DATE - ar.due_date) as days_overdue
        FROM accounts_receivable ar
        JOIN users u ON u.id = ar.user_id
        WHERE ar.due_date < CURRENT_DATE AND ar.status = 'pending'
        ORDER BY days_overdue DESC
        LIMIT 10
    """))).fetchall()

    overdue_payments = [{
        "id": str(r.id),
        "user_id": r.user_id,
        "user_name": r.user_name,
        "amount": float(r.amount),
        "days_overdue": max(0, int(r.days_overdue))
    } for r in overdue_rows]

    # 3. Pending payroll for current month
    payroll_draft = (await db.execute(text("""
        SELECT COUNT(*) as cnt, COALESCE(SUM(total_paid), 0) as total 
        FROM payroll_runs 
        WHERE period_month = :month AND period_year = :year AND status = 'draft'
        GROUP BY id
    """), {"month": month, "year": year})).fetchone()

    if payroll_draft:
        pending_payroll = {
            "has_pending": True,
            "period": f"{month}/{year}",
            "employees_count": int(payroll_draft.cnt),
            "estimated_total": float(payroll_draft.total)
        }
    else:
        # Generate calculation estimate
        emp_stats = (await db.execute(text("""
            SELECT COUNT(*) as count, COALESCE(SUM(base_salary), 0) as base_sum
            FROM employees
            WHERE status = 'active'
        """))).fetchone()
        
        pending_commissions = (await db.execute(text("""
            SELECT COALESCE(SUM(amount), 0)
            FROM employee_event_commissions
            WHERE status = 'pending'
        """))).scalar() or 0.0
        
        has_active_employees = emp_stats and emp_stats.count > 0
        
        pending_payroll = {
            "has_pending": has_active_employees,
            "period": f"{month}/{year}",
            "employees_count": int(emp_stats.count) if emp_stats else 0,
            "estimated_total": float(emp_stats.base_sum or 0.0) + float(pending_commissions)
        }

    # 4. Recent incidents (Mejora 2)
    incident_rows = (await db.execute(text("""
        SELECT ei.id, ei.event_id, ei.category, ei.severity, ei.description, ei.resolved, ei.created_at,
               ev.name as event_name, emp.full_name as reported_by_name
        FROM event_incidents ei
        LEFT JOIN events ev ON ev.id = ei.event_id
        LEFT JOIN employees emp ON emp.id = ei.reported_by
        ORDER BY ei.created_at DESC
        LIMIT 10
    """))).fetchall()

    recent_incidents = [{
        "id": str(r.id),
        "event_id": r.event_id,
        "event_name": r.event_name,
        "reported_by_name": r.reported_by_name or "Sistema",
        "category": r.category,
        "severity": r.severity,
        "description": r.description,
        "resolved": r.resolved,
        "created_at": r.created_at.isoformat()
    } for r in incident_rows]

    return {
        "date": now.date().isoformat(),
        "upcoming_events": upcoming_events,
        "overdue_payments": overdue_payments,
        "pending_payroll": pending_payroll,
        "low_stock_alerts": [],
        "recent_incidents": recent_incidents
    }


# ─── USERS / CLIENTS ──────────────────────────────────────────────────────────

@router.get("/users")
async def get_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    responsable: Optional[str] = Query(None),
    has_notes: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    has_matches: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("clientes", "view"))
):
    """Paginated client list with rich backend SQL filters."""
    offset = (page - 1) * limit

    where_clauses = ["1=1"]
    params: dict = {"limit": limit, "offset": offset}

    if search:
        where_clauses.append("(unaccent(u.name) ILIKE unaccent(:search) OR u.phone ILIKE :search OR unaccent(COALESCE(p.occupation, '')) ILIKE unaccent(:search) OR unaccent(COALESCE(p.city, '')) ILIKE unaccent(:search))")
        params["search"] = f"%{search}%"

    if responsable and responsable != "all":
        where_clauses.append("unaccent(COALESCE(p.responsable, '')) ILIKE unaccent(:responsable)")
        params["responsable"] = f"%{responsable}%"

    if has_notes == "with_notes":
        where_clauses.append("p.bio_notes IS NOT NULL AND length(trim(p.bio_notes)) > 2")
    elif has_notes == "without_notes":
        where_clauses.append("(p.bio_notes IS NULL OR length(trim(p.bio_notes)) <= 2)")

    if city and city != "all":
        where_clauses.append("(unaccent(COALESCE(p.city, '')) ILIKE unaccent(:city) OR unaccent(COALESCE(p.bio_notes, '')) ILIKE unaccent(:city) OR unaccent(COALESCE(CAST(p.search_preferences AS text), '')) ILIKE unaccent(:city))")
        params["city"] = f"%{city}%"

    if has_matches == "with_matches":
        where_clauses.append("""unaccent(lower(u.name)) IN (
            SELECT DISTINCT unaccent(lower(person_a)) FROM historical_matches WHERE person_a IS NOT NULL
            UNION
            SELECT DISTINCT unaccent(lower(person_b)) FROM historical_matches WHERE person_b IS NOT NULL
        )""")
    elif has_matches == "without_matches":
        where_clauses.append("""unaccent(lower(u.name)) NOT IN (
            SELECT DISTINCT unaccent(lower(person_a)) FROM historical_matches WHERE person_a IS NOT NULL
            UNION
            SELECT DISTINCT unaccent(lower(person_b)) FROM historical_matches WHERE person_b IS NOT NULL
        )""")

    where_str = " AND ".join(where_clauses)

    total = (await db.execute(text(f"""
        SELECT COUNT(*)
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE {where_str}
    """), params)).scalar() or 0

    rows = (await db.execute(text(f"""
        SELECT
            u.id, u.phone, u.name, u.created_at,
            p.user_id AS profile_user_id, p.ocean, p.apego, p.motivacion, p.rol_social,
            p.energia_social, p.momento_vital, p.intereses, p.valores,
            p.city, p.occupation, p.education, p.religion, p.love_language,
            p.bio_notes, p.lifestyle, p.responsable, p.estatura, p.age, p.plan_tier, p.search_preferences
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE {where_str}
        ORDER BY CASE WHEN p.bio_notes IS NOT NULL AND length(p.bio_notes) > 5 THEN 0 ELSE 1 END, u.id ASC
        LIMIT :limit OFFSET :offset
    """), params)).fetchall()

    users = []
    for r in rows:
        users.append({
            "id": r.id,
            "phone": r.phone,
            "name": r.name,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "profile": {
                "ocean": r.ocean,
                "apego": r.apego,
                "motivacion": r.motivacion,
                "rol_social": r.rol_social,
                "energia_social": r.energia_social,
                "momento_vital": r.momento_vital,
                "intereses": r.intereses,
                "valores": r.valores,
                "city": r.city,
                "occupation": r.occupation,
                "education": r.education,
                "religion": r.religion,
                "love_language": r.love_language,
                "bio_notes": r.bio_notes,
                "lifestyle": r.lifestyle,
                "responsable": r.responsable,
                "estatura": r.estatura,
                "age": r.age,
                "plan_tier": r.plan_tier,
                "search_preferences": r.search_preferences,
            } if r.profile_user_id is not None else None
        })

    return {"users": users, "total": total, "page": page, "pages": math.ceil(total / limit)}


@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("clientes", "view"))
):
    """Full profile of a single user."""
    row = (await db.execute(text("""
        SELECT
            u.id, u.phone, u.name, u.created_at,
            p.ocean, p.apego, p.motivacion, p.rol_social,
            p.energia_social, p.momento_vital, p.intereses, p.valores, p.raw_answers
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.id = :uid
    """), {"uid": user_id})).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Events attended
    events = (await db.execute(text("""
        SELECT e.id, e.name, e.date, ea.status
        FROM event_attendees ea
        JOIN events e ON e.id = ea.event_id
        WHERE ea.user_id = :uid
        ORDER BY e.date DESC
        LIMIT 10
    """), {"uid": user_id})).fetchall()

    return {
        "id": row.id,
        "phone": row.phone,
        "name": row.name,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "profile": {
            "ocean": row.ocean,
            "apego": row.apego,
            "motivacion": row.motivacion,
            "rol_social": row.rol_social,
            "energia_social": row.energia_social,
            "momento_vital": row.momento_vital,
            "intereses": row.intereses,
            "valores": row.valores,
        },
        "events": [{"id": e.id, "name": e.name, "date": e.date.isoformat(), "status": e.status} for e in events]
    }


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("clientes", "edit"))
):
    """Update basic user fields."""
    allowed = {k: v for k, v in data.items() if k in ("name", "phone")}
    if not allowed:
        raise HTTPException(status_code=400, detail="No hay campos válidos para actualizar")
    
    set_clause = ", ".join(f"{k} = :{k}" for k in allowed)
    allowed["uid"] = user_id
    await db.execute(text(f"UPDATE users SET {set_clause} WHERE id = :uid"), allowed)
    await db.commit()
    return {"ok": True}


# ─── EVENTS ───────────────────────────────────────────────────────────────────

@router.get("/events")
async def get_events(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("eventos", "view"))
):
    """All events ordered by date descending."""
    rows = (await db.execute(text("""
        SELECT e.id, e.name, e.date, e.location, e.format, e.capacity, e.price, e.created_at,
               e.budget_income, e.budget_expenses,
               COUNT(ea.user_id) AS attendee_count
        FROM events e
        LEFT JOIN event_attendees ea ON ea.event_id = e.id
        GROUP BY e.id
        ORDER BY e.date DESC
    """))).fetchall()

    return {"events": [{
        "id": r.id, "name": r.name,
        "date": r.date.isoformat() if r.date else None,
        "location": r.location, "format": r.format,
        "capacity": r.capacity, "price": float(r.price) if r.price else None,
        "budget_income": float(r.budget_income) if r.budget_income is not None else None,
        "budget_expenses": float(r.budget_expenses) if r.budget_expenses is not None else None,
        "attendee_count": r.attendee_count,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows]}


@router.post("/events", status_code=201)
async def create_event(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("eventos", "create"))
):
    """Create a new event."""
    required = {"name", "date"}
    if not required.issubset(data.keys()):
        raise HTTPException(status_code=400, detail="'name' y 'date' son obligatorios")
    
    try:
        date_str = data["date"]
        if isinstance(date_str, str):
            date_str = date_str.replace(" ", "T").split(".")[0]
            event_date = datetime.fromisoformat(date_str)
        else:
            event_date = date_str
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Formato de fecha inválido: {str(e)}. Use AAAA-MM-DDTHH:MM")

    result = await db.execute(text("""
        INSERT INTO events (name, date, location, format, capacity, price, budget_income, budget_expenses)
        VALUES (:name, :date, :location, :format, :capacity, :price, :budget_income, :budget_expenses)
        RETURNING id
    """), {
        "name": data["name"],
        "date": event_date,
        "location": data.get("location"),
        "format": data.get("format"),
        "capacity": data.get("capacity"),
        "price": data.get("price"),
        "budget_income": data.get("budget_income"),
        "budget_expenses": data.get("budget_expenses"),
    })
    await db.commit()
    event_id = result.scalar()
    return {"id": event_id, "ok": True}


@router.put("/events/{event_id}")
async def update_event(
    event_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("eventos", "edit"))
):
    """Update an existing event."""
    exists = (await db.execute(text("SELECT 1 FROM events WHERE id = :id"), {"id": event_id})).scalar()
    if not exists:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
        
    try:
        date_str = data.get("date")
        event_date = None
        if date_str:
            if isinstance(date_str, str):
                date_str = date_str.replace(" ", "T").split(".")[0]
                event_date = datetime.fromisoformat(date_str)
            else:
                event_date = date_str
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Formato de fecha inválido: {str(e)}")

    await db.execute(text("""
        UPDATE events
        SET name = COALESCE(:name, name),
            date = COALESCE(:date, date),
            location = COALESCE(:location, location),
            format = COALESCE(:format, format),
            capacity = COALESCE(:capacity, capacity),
            price = COALESCE(:price, price),
            budget_income = COALESCE(:budget_income, budget_income),
            budget_expenses = COALESCE(:budget_expenses, budget_expenses)
        WHERE id = :id
    """), {
        "id": event_id,
        "name": data.get("name"),
        "date": event_date,
        "location": data.get("location"),
        "format": data.get("format"),
        "capacity": data.get("capacity"),
        "price": data.get("price"),
        "budget_income": data.get("budget_income"),
        "budget_expenses": data.get("budget_expenses"),
    })
    await db.commit()
    return {"ok": True}


@router.get("/events/{event_id}/budget-comparison")
async def get_event_budget_comparison(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("eventos", "view"))
):
    """Compare budgeted vs actual income, expenses, and net profit for an event."""
    # Fetch event details
    ev_res = await db.execute(text("""
        SELECT name, budget_income, budget_expenses
        FROM events
        WHERE id = :id
    """), {"id": event_id})
    ev = ev_res.fetchone()
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
        
    # Calculate real income and expenses
    real_income = (await db.execute(text("""
        SELECT COALESCE(SUM(amount), 0) FROM income_records WHERE event_id = :id
    """), {"id": event_id})).scalar() or 0.0
    
    real_expenses = (await db.execute(text("""
        SELECT COALESCE(SUM(amount), 0) FROM expense_records WHERE event_id = :id
    """), {"id": event_id})).scalar() or 0.0
    
    b_income = float(ev.budget_income) if ev.budget_income is not None else 0.0
    b_expenses = float(ev.budget_expenses) if ev.budget_expenses is not None else 0.0
    
    b_net = b_income - b_expenses
    r_net = float(real_income) - float(real_expenses)
    
    # Calculate variance pct
    var_income = ((float(real_income) - b_income) / b_income * 100.0) if b_income > 0 else 0.0
    var_expenses = ((float(real_expenses) - b_expenses) / b_expenses * 100.0) if b_expenses > 0 else 0.0
    var_net = ((r_net - b_net) / b_net * 100.0) if b_net != 0 else 0.0
    
    verdict = "positive" if r_net >= b_net else "negative"
    
    return {
        "event_id": event_id,
        "event_name": ev.name,
        "budget": {"income": b_income, "expenses": b_expenses, "net": b_net},
        "real": {"income": float(real_income), "expenses": float(real_expenses), "net": r_net},
        "variance_pct": {"income": round(var_income, 2), "expenses": round(var_expenses, 2), "net": round(var_net, 2)},
        "verdict": verdict
    }


@router.get("/events/{event_id}/attendees")
async def get_attendees(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("eventos", "view"))
):
    """Attendees for a specific event."""
    rows = (await db.execute(text("""
        SELECT ea.user_id, ea.status, ea.created_at, u.name AS user_name, u.phone AS user_phone
        FROM event_attendees ea
        JOIN users u ON u.id = ea.user_id
        WHERE ea.event_id = :eid
        ORDER BY ea.created_at DESC
    """), {"eid": event_id})).fetchall()

    return {"attendees": [{
        "user_id": r.user_id,
        "user_name": r.user_name,
        "user_phone": r.user_phone,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows]}


# ─── MATCHES ──────────────────────────────────────────────────────────────────

@router.get("/matches")
async def get_matches(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("matching", "view"))
):
    """All match requests with user and event names."""
    rows = (await db.execute(text("""
        SELECT mr.id, mr.status, mr.created_at, mr.event_id, mr.from_user, mr.to_user,
               e.name AS event_name,
               uf.name AS from_user_name,
               ut.name AS to_user_name
        FROM match_requests mr
        LEFT JOIN events e ON e.id = mr.event_id
        LEFT JOIN users uf ON uf.id = mr.from_user
        LEFT JOIN users ut ON ut.id = mr.to_user
        ORDER BY mr.created_at DESC
        LIMIT 200
    """))).fetchall()

    return {"matches": [{
        "id": r.id,
        "status": r.status,
        "event_id": r.event_id,
        "event_name": r.event_name,
        "from_user": r.from_user,
        "from_user_name": r.from_user_name,
        "to_user": r.to_user,
        "to_user_name": r.to_user_name,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows]}


# ─── GLOBAL SEARCH & COMPATIBILITY ───────────────────────────────────────────

@router.get("/global-search")
async def global_search(
    query: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("dashboard", "view"))
):
    """Global search across clients, events, and employees."""
    search_pat = f"%{query}%"
    
    # 1. Search clients
    clients_res = await db.execute(text("""
        SELECT u.id, u.name, u.phone, p.motivacion
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE unaccent(u.name) ILIKE unaccent(:q) OR u.phone ILIKE :q
        LIMIT 10
    """), {"q": search_pat})
    clients = [{
        "id": str(r.id),
        "name": r.name,
        "phone": r.phone,
        "motivacion": r.motivacion or "Sin asignar"
    } for r in clients_res.fetchall()]
    
    # 2. Search events
    events_res = await db.execute(text("""
        SELECT id, name, date, location, format
        FROM events
        WHERE unaccent(name) ILIKE unaccent(:q) 
           OR unaccent(location) ILIKE unaccent(:q) 
           OR unaccent(format) ILIKE unaccent(:q)
        LIMIT 10
    """), {"q": search_pat})
    events = [{
        "id": r.id,
        "name": r.name,
        "date": r.date.isoformat() if r.date else None,
        "location": r.location or "Sin asignar",
        "format": r.format or "Sin asignar"
    } for r in events_res.fetchall()]
    
    # 3. Search employees
    employees_res = await db.execute(text("""
        SELECT id, full_name, role, email, phone
        FROM employees
        WHERE unaccent(full_name) ILIKE unaccent(:q) 
           OR unaccent(role) ILIKE unaccent(:q)
        LIMIT 10
    """), {"q": search_pat})
    employees = [{
        "id": str(r.id),
        "name": r.full_name,
        "role": r.role,
        "email": r.email,
        "phone": r.phone
    } for r in employees_res.fetchall()]
    
    return {
        "clients": clients,
        "events": events,
        "employees": employees
    }


@router.get("/events/{event_id}/compatibility")
async def get_event_compatibility(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("matching", "view"))
):
    """Calculates compatibility groups and matrix dynamically for an event."""
    event_res = await db.execute(text("SELECT id, name, date FROM events WHERE id = :id"), {"id": event_id})
    event = event_res.fetchone()
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
        
    attendees_res = await db.execute(text("""
        SELECT ea.user_id, u.name, p.ocean, p.apego, p.motivacion, p.rol_social, p.intereses, p.valores
        FROM event_attendees ea
        JOIN users u ON u.id = ea.user_id
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE ea.event_id = :event_id
    """), {"event_id": event_id})
    attendees = attendees_res.fetchall()
    
    if len(attendees) < 2:
        return {"groups": [], "matrix": {"names": [], "scores": []}}
        
    users_list = []
    for a in attendees:
        ocean = a.ocean if isinstance(a.ocean, dict) else (json.loads(a.ocean) if a.ocean else {})
        apego = a.apego if isinstance(a.apego, dict) else (json.loads(a.apego) if a.apego else {})
        users_list.append({
            "id": a.user_id,
            "name": a.name,
            "ocean": ocean,
            "apego": apego,
            "motivacion": a.motivacion or "exploracion",
            "rol_social": a.rol_social or "mediador",
            "intereses": a.intereses or [],
            "valores": a.valores or []
        })
        
    names = [u["name"] for u in users_list]
    n = len(users_list)
    scores_matrix = [[0] * n for _ in range(n)]
    
    for i in range(n):
        for j in range(n):
            if i == j:
                scores_matrix[i][j] = 100
                continue
            u1, u2 = users_list[i], users_list[j]
            
            ocean_score = 1.0
            if u1["ocean"] and u2["ocean"]:
                diffs = []
                for key in ["apertura", "responsabilidad", "extroversion", "amabilidad", "neuroticismo"]:
                    v1 = u1["ocean"].get(key, 0.5)
                    v2 = u2["ocean"].get(key, 0.5)
                    diffs.append(abs(v1 - v2))
                ocean_score = 1.0 - (sum(diffs) / len(diffs)) if diffs else 1.0
                
            a1 = u1["apego"].get("style", u1["apego"].get("estilo", "seguro"))
            a2 = u2["apego"].get("style", u2["apego"].get("estilo", "seguro"))
            
            attachment_compat = 0.8
            if a1 == "seguro" and a2 == "seguro":
                attachment_compat = 1.0
            elif (a1 == "ansioso" and a2 == "evitativo") or (a1 == "evitativo" and a2 == "ansioso"):
                attachment_compat = 0.35
            elif a1 == "evitativo" and a2 == "evitativo":
                attachment_compat = 0.5
            elif a1 == "ansioso" and a2 == "ansioso":
                attachment_compat = 0.6
                
            shared_interests = set(u1["intereses"]).intersection(set(u2["intereses"]))
            max_interests = max(1, len(u1["intereses"]) + len(u2["intereses"]))
            interests_score = len(shared_interests) / max_interests if shared_interests else 0.0
            
            shared_values = set(u1["valores"]).intersection(set(u2["valores"]))
            max_values = max(1, len(u1["valores"]) + len(u2["valores"]))
            values_score = len(shared_values) / max_values if shared_values else 0.0
            
            final_score = int((ocean_score * 0.4 + attachment_compat * 0.3 + interests_score * 0.15 + values_score * 0.15) * 100)
            scores_matrix[i][j] = min(100, max(0, final_score))
            
    remaining_indices = list(range(n))
    groups = []
    group_num = 1
    
    while len(remaining_indices) >= 2:
        avg_scores = []
        for idx in remaining_indices:
            other_indices = [x for x in remaining_indices if x != idx]
            if not other_indices:
                avg_scores.append((0, idx))
                continue
            avg = sum(scores_matrix[idx][o] for o in other_indices) / len(other_indices)
            avg_scores.append((avg, idx))
            
        avg_scores.sort(reverse=True)
        pivot_idx = avg_scores[0][1]
        
        remaining_indices.remove(pivot_idx)
        best_matches = []
        for idx in remaining_indices:
            score = scores_matrix[pivot_idx][idx]
            best_matches.append((score, idx))
            
        best_matches.sort(reverse=True)
        group_members_indices = [pivot_idx]
        select_count = min(3, len(remaining_indices))
        for m_idx in range(select_count):
            target_idx = best_matches[m_idx][1]
            group_members_indices.append(target_idx)
            remaining_indices.remove(target_idx)
            
        members_data = [users_list[idx] for idx in group_members_indices]
        
        all_ints = []
        for m in members_data:
            all_ints.extend(m["intereses"])
        common_ints = [item for item in set(all_ints) if all_ints.count(item) >= 2]
        
        apegos = [m["apego"].get("style", m["apego"].get("estilo", "seguro")) for m in members_data]
        seguro_count = apegos.count("seguro")
        
        exp = f"Mesa {group_num}: "
        if seguro_count >= 2:
            exp += "Alta estabilidad emocional (estilo seguro predominante). "
        else:
            exp += "Complementariedad psicológica moderada. "
            
        if common_ints:
            exp += f"Intereses en común: {', '.join(common_ints[:3])}."
        else:
            exp += "Valores y perfiles OCEAN alineados."
            
        groups.append({
            "name": f"Mesa {group_num} - Grupo IA",
            "explanation": exp,
            "members": [
                {
                    "user_id": str(m["id"]),
                    "name": m["name"],
                    "profile_summary": f"{m['apego'].get('style', m['apego'].get('estilo', 'seguro')).capitalize()} | {m['rol_social'].capitalize()}"
                } for m in members_data
            ]
        })
        group_num += 1
        
    if remaining_indices:
        idx = remaining_indices[0]
        if groups:
            groups[0]["members"].append({
                "user_id": str(users_list[idx]["id"]),
                "name": users_list[idx]["name"],
                "profile_summary": f"{users_list[idx]['apego'].get('style', users_list[idx]['apego'].get('estilo', 'seguro')).capitalize()} | {users_list[idx]['rol_social'].capitalize()}"
            })
        
    return {
        "groups": groups,
        "matrix": {
            "names": names,
            "scores": scores_matrix
        }
    }


@router.get("/events/{event_id}/export-pdf")
async def export_event_pdf(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("eventos", "view"))
):
    """Export event details (attendees, incidents, budget) as a branded Daily Lover PDF."""
    from fastapi.responses import Response
    from app.core.permissions import require_permission as _rp
    from app.services.pdf_service import build_event_pdf

    # Fetch event
    event_row = (await db.execute(text("""
        SELECT id, name, date, format, description, capacity, location, budget_income, budget_expenses
        FROM events WHERE id = :id
    """), {"id": event_id})).fetchone()

    if not event_row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Evento no encontrado")

    event_dict = {
        "id": event_row.id,
        "name": event_row.name,
        "date": event_row.date.isoformat() if event_row.date else "",
        "format": event_row.format,
        "description": event_row.description,
        "capacity": event_row.capacity,
        "location": event_row.location,
        "budget_income": float(event_row.budget_income or 0),
        "budget_expenses": float(event_row.budget_expenses or 0),
    }

    # Fetch attendees
    att_rows = (await db.execute(text("""
        SELECT u.name, ea.status, ea.ticket_type, pef.satisfaccion
        FROM event_attendees ea
        JOIN users u ON u.id = ea.user_id
        LEFT JOIN post_event_feedback pef ON pef.event_id = ea.event_id AND pef.user_id = ea.user_id
        WHERE ea.event_id = :eid
        ORDER BY ea.status, u.name
    """), {"eid": event_id})).fetchall()

    attendees_list = [{
        "name": r.name,
        "status": r.status,
        "ticket_type": r.ticket_type,
        "satisfaccion": r.satisfaccion,
    } for r in att_rows]

    # Fetch incidents
    inc_rows = (await db.execute(text("""
        SELECT category, severity, description, resolved
        FROM event_incidents
        WHERE event_id = :eid
        ORDER BY created_at DESC
    """), {"eid": event_id})).fetchall()

    incidents_list = [{
        "category": r.category,
        "severity": r.severity,
        "description": r.description,
        "resolved": r.resolved,
    } for r in inc_rows]

    # Fetch budget comparison
    real_income = (await db.execute(text(
        "SELECT COALESCE(SUM(amount), 0) FROM income_records WHERE event_id = :eid"
    ), {"eid": event_id})).scalar() or 0.0

    real_expenses = (await db.execute(text(
        "SELECT COALESCE(SUM(amount), 0) FROM expense_records WHERE event_id = :eid"
    ), {"eid": event_id})).scalar() or 0.0

    budget_comparison = None
    if event_row.budget_income or event_row.budget_expenses:
        bi = float(event_row.budget_income or 0)
        be = float(event_row.budget_expenses or 0)
        ri = float(real_income)
        re_ = float(real_expenses)
        net_budget = bi - be
        net_real = ri - re_
        if net_real > net_budget * 1.05:
            verdict = "Por encima del presupuesto ✓"
        elif net_real < net_budget * 0.9:
            verdict = "Por debajo del presupuesto ✗"
        else:
            verdict = "Dentro del presupuesto ≈"
        budget_comparison = {
            "budget_income": bi,
            "budget_expenses": be,
            "real_income": ri,
            "real_expenses": re_,
            "verdict": verdict,
        }

    pdf_bytes = build_event_pdf(event_dict, attendees_list, incidents_list, budget_comparison)
    event_name_slug = event_dict["name"].lower().replace(" ", "_")[:20]
    filename = f"evento_{event_name_slug}_{event_id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/historical-matches")
async def get_historical_matches(
    page: int = 1,
    limit: int = 20,
    matchmaker: str = None,
    status_filter: str = None,
    search: str = None,
    exact_name: str = None,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("matching", "view"))
):
    """Fetch historical and psychologist matches with support for exact client name matching."""
    offset = (page - 1) * limit
    where_clauses = ["1=1"]
    params = {"limit": limit, "offset": offset}

    if matchmaker and matchmaker != "all":
        where_clauses.append("matchmaker ILIKE :matchmaker")
        params["matchmaker"] = f"%{matchmaker}%"

    if status_filter and status_filter != "all":
        sf = status_filter.upper()
        if sf in ["PENDIENTE", "PENDING"]:
            where_clauses.append("(status IS NULL OR status = '' OR status ILIKE '%PENDIENTE%' OR status ILIKE '%REVISAR%' OR status ~ '^[0-9.]+$' OR status ILIKE '%julio%' OR status ILIKE '%junio%' OR status ILIKE '%mayo%')")
        elif sf in ["APROBADO", "ACCEPTED"]:
            where_clauses.append("(status ILIKE '%APROBADO%' OR status ILIKE '%HECHO%' OR status ILIKE '%ACCEPTED%')")
        elif sf in ["RECHAZADO", "REJECTED"]:
            where_clauses.append("(status ILIKE '%RECHAZADO%' OR status ILIKE '%NOT APPROVED%' OR status ILIKE '%NO MATCH%' OR status ILIKE '%DESCALIFICADO%' OR status ILIKE '%REFUND%')")
        elif sf in ["TROUBLE", "FALLIDO"]:
            where_clauses.append("(status ILIKE '%TROUBLE%' OR status ILIKE '%REVISAR%' OR status ILIKE '%NO HAY GENTE%')")
        else:
            where_clauses.append("status ILIKE :status_filter")
            params["status_filter"] = f"%{status_filter}%"

    if exact_name:
        where_clauses.append("(unaccent(lower(trim(person_a))) = unaccent(lower(trim(:exact_name))) OR unaccent(lower(trim(person_b))) = unaccent(lower(trim(:exact_name))))")
        params["exact_name"] = exact_name
    elif search:
        where_clauses.append("(person_a ILIKE :search OR person_b ILIKE :search)")
        params["search"] = f"%{search}%"

    where_str = " AND ".join(where_clauses)

    total_res = await db.execute(text(f"SELECT COUNT(*) FROM historical_matches WHERE {where_str}"), params)
    total = total_res.scalar() or 0

    rows_res = await db.execute(text(f"""
        SELECT id, person_a, person_b, matchmaker, match_date, city, status, observations
        FROM historical_matches
        WHERE {where_str}
        ORDER BY id DESC
        LIMIT :limit OFFSET :offset
    """), params)

    matches = [{
        "id": r.id,
        "person_a": r.person_a,
        "person_b": r.person_b,
        "matchmaker": r.matchmaker,
        "match_date": r.match_date,
        "city": r.city,
        "status": r.status or "PENDIENTE",
        "observations": r.observations,
    } for r in rows_res.fetchall()]

    return {"matches": matches, "total": total, "page": page, "pages": math.ceil(total / limit)}


@router.patch("/historical-matches/{match_id}/status")
async def update_match_status(
    match_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("matching", "manage"))
):
    """Psychologist 1-click status update: APROBADO, PENDIENTE, RECHAZADO, TROUBLE, POSTPONED."""
    new_status = payload.get("status", "APROBADO")
    await db.execute(text("""
        UPDATE historical_matches
        SET status = :status
        WHERE id = :id
    """), {"status": new_status, "id": match_id})
    await db.commit()
    return {"message": "Estado actualizado correctamente", "id": match_id, "status": new_status}


# ─── REMINDERS & PRIORITY TASKS ───────────────────────────────────────────────

@router.get("/reminders")
async def get_reminders(
    matchmaker: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("dashboard", "view"))
):
    """Retorna lista de recordatorios y tareas prioritarias asignadas a psicólogas."""
    # Ensure table exists
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS reminders (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            client_name VARCHAR(255),
            client_phone VARCHAR(50),
            priority VARCHAR(20) DEFAULT 'ALTA', -- URGENTE, ALTA, MEDIA, BAJA
            matchmaker VARCHAR(50),              -- SILVI, STEFFY, MANU, MARÍA PAULA
            due_date VARCHAR(50),
            completed BOOLEAN DEFAULT FALSE,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """))
    await db.commit()

    # Seed initial realistic reminders if table is empty
    count = (await db.execute(text("SELECT COUNT(*) FROM reminders"))).scalar()
    if count == 0:
        await db.execute(text("""
            INSERT INTO reminders (title, client_name, client_phone, priority, matchmaker, due_date, completed, notes)
            VALUES 
            ('Llamar para feedback post-cita', 'Juan Diego Puerta', '+573101234567', 'URGENTE', 'SILVI', 'Hoy, 5:00 PM', false, 'Verificar impresión de la cita en el restaurante'),
            ('Aprobar propuesta de match con María Camila', 'María Camila Rodríguez', '+573159876543', 'ALTA', 'SILVI', 'Hoy, 6:30 PM', false, 'Revisar fotos de lookbook lado a lado'),
            ('Confirmar asistencia a evento del sábado', 'Carlos Eduardo Silva', '+573005551234', 'MEDIA', 'STEFFY', 'Mañana, 10:00 AM', false, 'Enviar código QR y lugar de encuentro'),
            ('Solicitar actualización de foto de perfil', 'Valentina Ruiz', '+573204449988', 'BAJA', 'MANU', '28 Jul', false, 'Foto actual no cumple calidad mínima de lookbook')
        """))
        await db.commit()

    query = "SELECT * FROM reminders WHERE 1=1"
    params = {}
    if matchmaker:
        query += " AND (UPPER(matchmaker) = :mm OR matchmaker IS NULL)"
        params["mm"] = matchmaker.upper()

    query += " ORDER BY completed ASC, CASE priority WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 ELSE 4 END, id DESC"

    res = await db.execute(text(query), params)
    rows = res.fetchall()

    return {
        "reminders": [{
            "id": r.id,
            "title": r.title,
            "client_name": r.client_name,
            "client_phone": r.client_phone,
            "priority": r.priority,
            "matchmaker": r.matchmaker,
            "due_date": r.due_date,
            "completed": r.completed,
            "notes": r.notes,
            "whatsapp_link": f"https://wa.me/{''.join(filter(str.isdigit, r.client_phone or ''))}" if r.client_phone else None
        } for r in rows]
    }


@router.post("/reminders")
async def create_reminder(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("dashboard", "view"))
):
    """Crea un nuevo recordatorio o tarea prioritaria para el equipo clínico."""
    await db.execute(text("""
        INSERT INTO reminders (title, client_name, client_phone, priority, matchmaker, due_date, notes)
        VALUES (:title, :client_name, :client_phone, :priority, :matchmaker, :due_date, :notes)
    """), {
        "title": payload.get("title", "Nuevo Pendiente"),
        "client_name": payload.get("client_name"),
        "client_phone": payload.get("client_phone"),
        "priority": payload.get("priority", "ALTA"),
        "matchmaker": payload.get("matchmaker", "SILVI"),
        "due_date": payload.get("due_date", "Hoy"),
        "notes": payload.get("notes", "")
    })
    await db.commit()
    return {"message": "Recordatorio creado exitosamente"}


@router.patch("/reminders/{reminder_id}/toggle")
async def toggle_reminder(
    reminder_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("dashboard", "view"))
):
    """Marca un recordatorio como completado o pendiente."""
    await db.execute(text("""
        UPDATE reminders
        SET completed = NOT completed
        WHERE id = :id
    """), {"id": reminder_id})
    await db.commit()
    return {"message": "Estado de recordatorio actualizado"}

