"""Cambios de horario entre personas (Fase 5): mover matches y pedir/aceptar intercambios.

Las reglas viven en app/services/shift_changes.py (puras). Aquí solo se carga el estado, se valida y se aplica.
"""
import asyncio
import html
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.scheduling import (ensure_shift_tables, local_monday, require_staff, hides_costs, save_availability,
                                    AvailabilityRequest, AvailabilityDay, ShiftRange, DAY_KEYS, DAY_LABELS_ES)
from app.services import shift_changes as RULES
from app.services import shift_planning as SP

router = APIRouter(prefix="/api/v1/shifts", tags=["Cambios de horario"])
BOGOTA = ZoneInfo("America/Bogota")

ACCOUNT_EMAILS = {
    "Estefania Rodriguez": "joplin.er21@gmail.com", "Ana Maria Tolosa": "anatolosaamado@gmail.com",
    "Isabela Marquez": "isamarqueza21@gmail.com", "Jennifer Pimiento": "ps.jpimientob@gmail.com",
    "Silvana Manrique": "psi.silvanamanrique@gmail.com", "Maria Pia Cottrino": "piasantacruzg@gmail.com",
    "Mara Paula de la Espriella": "mapa.delae@gmail.com",
}
_ready = False

# codigo corto con el que las citas antiguas guardaron a cada persona
CODIGO_CITAS = {"ana maria tolosa": "ANA", "estefania rodriguez": "STEFFY", "isabela marquez": "ISA", "jennifer pimiento": "JENN",
                "mara paula de la espriella": "MAPE D", "maria pia cottrino": "PIA", "silvana manrique": "SILVI"}


def _nombres_cita(person: str) -> List[str]:
    out = [person.upper()]
    if person.lower() in CODIGO_CITAS:
        out.append(CODIGO_CITAS[person.lower()])
    return out


async def ensure_change_tables(db: AsyncSession) -> None:
    global _ready
    if _ready:
        return
    await ensure_shift_tables(db)
    await SP.ensure_planning_tables(db)
    await db.execute(text("ALTER TABLE staff_team ADD COLUMN IF NOT EXISTS account_email VARCHAR(150)"))
    for nm, em in ACCOUNT_EMAILS.items():
        await db.execute(text("UPDATE staff_team SET account_email = :e WHERE LOWER(name) = LOWER(:n) AND account_email IS NULL"), {"e": em, "n": nm})
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS staff_swap_requests (
            id SERIAL PRIMARY KEY, week_monday DATE NOT NULL, kind VARCHAR(20) NOT NULL,
            from_name TEXT NOT NULL, to_name TEXT NOT NULL, from_shift_id INT NOT NULL, to_shift_id INT NOT NULL,
            message TEXT DEFAULT '', status VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE',
            created_at TIMESTAMPTZ DEFAULT NOW(), decided_at TIMESTAMPTZ, decided_by TEXT, note TEXT DEFAULT ''
        )
    """))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS staff_match_moves (
            id SERIAL PRIMARY KEY, person TEXT NOT NULL, shift_id INT NOT NULL,
            from_date DATE, from_start TIME, to_date DATE, to_start TIME,
            created_at TIMESTAMPTZ DEFAULT NOW(), created_date DATE NOT NULL
        )
    """))
    await db.commit()
    _ready = True


def _now() -> datetime:
    return datetime.now(BOGOTA).replace(tzinfo=None)


def _hhmm(t: time) -> str:
    return t.strftime("%H:%M")


def _shift_dict(r) -> dict:
    return {"id": r.id, "name": r.psychologist_name, "date": r.shift_date, "start": r.start_time, "end": r.end_time, "type": r.shift_type}


def _public(s: dict) -> dict:
    return {"id": s["id"], "name": s["name"], "date": s["date"].isoformat(), "start": _hhmm(s["start"]), "end": _hhmm(s["end"]), "type": s["type"]}


async def my_staff_name(db: AsyncSession, user: dict) -> Optional[str]:
    """Persona del equipo que corresponde a la cuenta con sesión (por correo de la cuenta; si no, por nombre)."""
    email = str(user.get("email") or "").strip().lower()
    if email:
        row = (await db.execute(text("SELECT name FROM staff_team WHERE LOWER(account_email) = :e AND is_active = true LIMIT 1"), {"e": email})).fetchone()
        if row:
            return row[0]
    emp = str(user.get("employee_name") or "").lower()
    words = {w for w in emp.replace("(", " ").replace(")", " ").split() if len(w) > 2}
    if words:
        for r in (await db.execute(text("SELECT name FROM staff_team WHERE is_active = true AND weekly_hours IS NOT NULL"))).fetchall():
            if len(words & {w for w in r[0].lower().split() if len(w) > 2}) >= 2:
                return r[0]
    return None


async def _require_me(db: AsyncSession, user: dict) -> str:
    me = await my_staff_name(db, user)
    if not me:
        raise HTTPException(status_code=403, detail="Tu cuenta no está asociada a una persona del equipo de matchmaking.")
    return me


async def _week_context(db: AsyncSession, monday: date):
    sunday = monday + timedelta(days=6)
    active = {r[0].lower() for r in (await db.execute(text("SELECT name FROM staff_team WHERE is_active = true AND weekly_hours IS NOT NULL"))).fetchall()}
    shifts = [_shift_dict(r) for r in (await db.execute(text("""
        SELECT id, psychologist_name, shift_date, start_time, end_time, shift_type FROM staff_shifts
        WHERE shift_date BETWEEN :a AND :b ORDER BY shift_date, start_time
    """), {"a": monday, "b": sunday})).fetchall() if r.psychologist_name.lower() in active]
    availability: Dict[str, Dict[int, dict]] = {}
    for r in (await db.execute(text("SELECT LOWER(employee_name) n, weekday, mode, start_time, end_time FROM staff_availability ORDER BY weekday, start_time"))).fetchall():
        slot = availability.setdefault(r.n, {}).setdefault(int(r.weekday), {"mode": r.mode, "ranges": []})
        if r.mode == "RANGES" and r.start_time and r.end_time:
            slot["ranges"].append((_hhmm(r.start_time), _hhmm(r.end_time)))
    off = [{"name": o.psychologist_name, "start": o.start_date, "end": o.end_date} for o in (await db.execute(text("""
        SELECT psychologist_name, start_date, end_date FROM staff_time_off
        WHERE start_date <= :b AND end_date >= :a AND UPPER(COALESCE(status, 'APPROVED')) = 'APPROVED'
    """), {"a": monday, "b": sunday})).fetchall()]
    return shifts, availability, off


async def _moves_today(db: AsyncSession, person: str) -> int:
    return int((await db.execute(text("SELECT COUNT(*) FROM staff_match_moves WHERE LOWER(person) = LOWER(:p) AND created_date = :d"),
                                 {"p": person, "d": _now().date()})).scalar() or 0)


async def _notify(db: AsyncSession, person: str, subject: str, title: str, inner: str) -> None:
    to = await SP.recipient_for(db, person)
    if not to:
        return
    test_mode = bool((await SP.get_setting(db, "email_test_to", SP.TEST_EMAIL_DEFAULT)).strip())
    await SP._send(to, subject, SP._wrap(person, test_mode, title, inner))


def _lbl(s: dict) -> str:
    return f"{RULES.DAY_ES[s['date'].weekday()]} {s['date'].day}/{s['date'].month}, {RULES._fmt(RULES._m(s['start']))}–{RULES._fmt(RULES._m(s['end']))} ({'entrevistas' if s['type'] == 'ENTREVISTAS' else 'matches'})"


def _swap_row(r) -> dict:
    return {"id": r.id, "kind": r.kind, "from_name": r.from_name, "to_name": r.to_name, "from_shift_id": r.from_shift_id,
            "to_shift_id": r.to_shift_id, "message": r.message, "status": r.status, "note": r.note,
            "created_at": r.created_at.isoformat() if r.created_at else None, "week_monday": r.week_monday.isoformat()}


# ------------------------------------------------------------------ consultas

@router.get("/mine")
async def my_week(week_date: Optional[str] = Query(None), db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """Mi semana: mis franjas, cuántos cambios de matches me quedan hoy y mis solicitudes de intercambio."""
    await ensure_change_tables(db)
    try:
        monday = local_monday(datetime.strptime(week_date, "%Y-%m-%d").date()) if week_date else local_monday(_now().date())
    except ValueError:
        raise HTTPException(status_code=422, detail="Fecha inválida.")
    me = await my_staff_name(db, user)
    out: Dict[str, Any] = {"me": me, "week_monday": monday.isoformat(), "shifts": [], "moves_left_today": RULES.MAX_MOVES_PER_DAY,
                           "incoming": [], "outgoing": [], "max_moves_per_day": RULES.MAX_MOVES_PER_DAY}
    if not me:
        return out
    shifts, _, _ = await _week_context(db, monday)
    now = _now()
    sunday = monday + timedelta(days=6)
    st = (await db.execute(text("SELECT status FROM staff_weeks WHERE week_monday = :m"), {"m": monday})).scalar()
    out["week_status"] = st or "SIN_GENERAR"
    out["weekly_hours"] = (await db.execute(text("SELECT weekly_hours FROM staff_team WHERE LOWER(name) = LOWER(:n)"), {"n": me})).scalar()
    out["availability_set"] = bool((await db.execute(text("SELECT COUNT(*) FROM staff_availability WHERE LOWER(employee_name) = LOWER(:n)"), {"n": me})).scalar())
    published = {r[0] for r in (await db.execute(text("SELECT id FROM staff_shifts WHERE shift_date BETWEEN :a AND :b AND is_published = true"), {"a": monday, "b": sunday})).fetchall()}
    out["published"] = bool(published)
    if hides_costs(user):
        shifts = [s for s in shifts if s["id"] in published]
    out["shifts"] = [{**_public(s), "can_move": s["type"] == "MATCHMAKING" and RULES._starts_at(s["date"], RULES._m(s["start"])) > now,
                      "can_swap": RULES._starts_at(s["date"], RULES._m(s["start"])) > now}
                     for s in shifts if s["name"].lower() == me.lower()]
    out["moves_left_today"] = max(0, RULES.MAX_MOVES_PER_DAY - await _moves_today(db, me))
    rows = (await db.execute(text("""
        SELECT * FROM staff_swap_requests WHERE (LOWER(from_name) = LOWER(:p) OR LOWER(to_name) = LOWER(:p))
          AND (status = 'PENDIENTE' OR decided_at > NOW() - INTERVAL '7 days') ORDER BY created_at DESC
    """), {"p": me})).fetchall()
    byid = {s["id"]: s for s in shifts}
    for r in rows:
        d = _swap_row(r)
        d["from_shift"] = _public(byid[r.from_shift_id]) if r.from_shift_id in byid else None
        d["to_shift"] = _public(byid[r.to_shift_id]) if r.to_shift_id in byid else None
        (out["incoming"] if r.to_name.lower() == me.lower() else out["outgoing"]).append(d)
    return out


@router.get("/swap-candidates")
async def swap_candidates(shift_id: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """Franjas de otras personas con las que puedo intercambiar la mía (ya validadas con todas las reglas)."""
    await ensure_change_tables(db)
    me = await _require_me(db, user)
    row = (await db.execute(text("SELECT id, psychologist_name, shift_date, start_time, end_time, shift_type FROM staff_shifts WHERE id = :i"), {"i": shift_id})).fetchone()
    if not row or row.psychologist_name.lower() != me.lower():
        raise HTTPException(status_code=404, detail="Esa franja no es tuya.")
    mine = _shift_dict(row)
    monday = local_monday(mine["date"])
    shifts, av, off = await _week_context(db, monday)
    now = _now()
    published = {r[0] for r in (await db.execute(text("SELECT id FROM staff_shifts WHERE shift_date BETWEEN :a AND :b AND is_published = true"), {"a": monday, "b": monday + timedelta(days=6)})).fetchall()}
    if mine["id"] not in published:
        raise HTTPException(status_code=409, detail="El horario de esa semana todavía no está aprobado, por eso aún no se puede pedir cambios.")
    cands = []
    for s in shifts:
        if s["name"].lower() == me.lower() or s["type"] != mine["type"] or s["id"] not in published:
            continue
        if not RULES.validate_swap(mine, s, all_shifts=shifts, availability=av, time_off=off, now=now):
            cands.append(_public(s))
    return {"shift": _public(mine), "candidates": cands}


@router.get("/swaps")
async def list_swaps(db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """Solicitudes de intercambio recientes (la administración ve todas; cada persona, las suyas)."""
    await ensure_change_tables(db)
    me = await my_staff_name(db, user)
    if hides_costs(user) and not me:
        return {"swaps": []}
    q = "SELECT * FROM staff_swap_requests WHERE (status = 'PENDIENTE' OR decided_at > NOW() - INTERVAL '14 days')"
    params: Dict[str, Any] = {}
    if hides_costs(user):
        q += " AND (LOWER(from_name) = LOWER(:p) OR LOWER(to_name) = LOWER(:p))"; params["p"] = me
    rows = (await db.execute(text(q + " ORDER BY created_at DESC LIMIT 100"), params)).fetchall()
    return {"swaps": [_swap_row(r) for r in rows]}


# ------------------------------------------------------------------ mover matches

class MoveRequest(BaseModel):
    shift_id: int
    new_date: str    # AAAA-MM-DD
    new_start: str   # HH:MM


@router.post("/matches/move")
async def move_match(payload: MoveRequest, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_change_tables(db)
    me = await _require_me(db, user)
    try:
        nd = datetime.strptime(payload.new_date, "%Y-%m-%d").date()
        ns = datetime.strptime(payload.new_start, "%H:%M").time()
    except ValueError:
        raise HTTPException(status_code=422, detail="Fecha u hora inválida.")
    row = (await db.execute(text("SELECT id, psychologist_name, shift_date, start_time, end_time, shift_type FROM staff_shifts WHERE id = :i FOR UPDATE"), {"i": payload.shift_id})).fetchone()
    if not row or row.psychologist_name.lower() != me.lower():
        raise HTTPException(status_code=404, detail="Esa franja no es tuya.")
    shift = _shift_dict(row)
    shifts, av, off = await _week_context(db, local_monday(shift["date"]))
    errs = RULES.validate_match_move(shift, nd, ns, week_shifts=shifts, availability=av, time_off=off, moves_today=await _moves_today(db, me), now=_now())
    if errs:
        await db.rollback()
        raise HTTPException(status_code=422, detail={"code": "MOVE_NOT_ALLOWED", "errors": errs, "message": " ".join(errs)})
    moved = RULES.apply_move([shift], shift["id"], nd, ns)[0]
    await db.execute(text("UPDATE staff_shifts SET shift_date = :d, start_time = :s, end_time = :e, updated_at = NOW() WHERE id = :i"),
                     {"d": moved["date"], "s": moved["start"], "e": moved["end"], "i": shift["id"]})
    await db.execute(text("INSERT INTO staff_match_moves (person, shift_id, from_date, from_start, to_date, to_start, created_date) VALUES (:p, :i, :fd, :fs, :td, :ts, :cd)"),
                     {"p": me, "i": shift["id"], "fd": shift["date"], "fs": shift["start"], "td": moved["date"], "ts": moved["start"], "cd": _now().date()})
    await db.commit()
    return {"status": "success", "shift": _public(moved), "moves_left_today": max(0, RULES.MAX_MOVES_PER_DAY - await _moves_today(db, me))}


# ------------------------------------------------------------------ intercambios

class SwapCreate(BaseModel):
    from_shift_id: int
    to_shift_id: int
    message: Optional[str] = ""


@router.post("/swaps")
async def create_swap(payload: SwapCreate, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_change_tables(db)
    me = await _require_me(db, user)
    rows = {r.id: r for r in (await db.execute(text("SELECT id, psychologist_name, shift_date, start_time, end_time, shift_type FROM staff_shifts WHERE id IN (:a, :b)"),
                                               {"a": payload.from_shift_id, "b": payload.to_shift_id})).fetchall()}
    a_row, b_row = rows.get(payload.from_shift_id), rows.get(payload.to_shift_id)
    if not a_row or not b_row:
        raise HTTPException(status_code=404, detail="Alguna de las franjas ya no existe.")
    if a_row.psychologist_name.lower() != me.lower():
        raise HTTPException(status_code=403, detail="Solo puedes ofrecer tus propias franjas.")
    a, b = _shift_dict(a_row), _shift_dict(b_row)
    shifts, av, off = await _week_context(db, local_monday(a["date"]))
    errs = RULES.validate_swap(a, b, all_shifts=shifts, availability=av, time_off=off, now=_now())
    if errs:
        raise HTTPException(status_code=422, detail={"code": "SWAP_NOT_ALLOWED", "errors": errs, "message": " ".join(errs)})
    busy = (await db.execute(text("""
        SELECT COUNT(*) FROM staff_swap_requests WHERE status = 'PENDIENTE'
          AND (from_shift_id IN (:a, :b) OR to_shift_id IN (:a, :b))
    """), {"a": a["id"], "b": b["id"]})).scalar()
    if busy:
        raise HTTPException(status_code=409, detail="Una de esas franjas ya está en otra solicitud pendiente.")
    new_id = (await db.execute(text("""
        INSERT INTO staff_swap_requests (week_monday, kind, from_name, to_name, from_shift_id, to_shift_id, message)
        VALUES (:w, :k, :f, :t, :fs, :ts, :m) RETURNING id
    """), {"w": local_monday(a["date"]), "k": a["type"], "f": me, "t": b["name"], "fs": a["id"], "ts": b["id"], "m": (payload.message or "")[:300]})).scalar()
    await db.commit()
    await _notify(db, b["name"], f"{me} te propone un cambio de horario", "Propuesta de cambio de horario",
                  f'<p><b>{html.escape(me)}</b> quiere cambiar contigo:</p><ul><li>Te da: <b>{_lbl(a)}</b></li><li>Recibe: <b>{_lbl(b)}</b></li></ul>'
                  + (f'<p>Mensaje: <i>{html.escape((payload.message or "")[:300])}</i></p>' if payload.message else "")
                  + '<p>Entra a <b>Agenda y turnos</b> para aceptar o rechazar.</p>')
    return {"status": "success", "id": new_id}


async def _load_swap(db: AsyncSession, swap_id: int):
    r = (await db.execute(text("SELECT * FROM staff_swap_requests WHERE id = :i FOR UPDATE"), {"i": swap_id})).fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
    if r.status != "PENDIENTE":
        raise HTTPException(status_code=409, detail=f"Esta solicitud ya está {r.status.lower()}.")
    return r


async def _close(db: AsyncSession, swap_id: int, status: str, who: str, note: str = "") -> None:
    await db.execute(text("UPDATE staff_swap_requests SET status = :s, decided_at = NOW(), decided_by = :w, note = :n WHERE id = :i"),
                     {"s": status, "w": who, "n": note[:300], "i": swap_id})
    await db.commit()


@router.post("/swaps/{swap_id}/accept")
async def accept_swap(swap_id: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_change_tables(db)
    me = await _require_me(db, user)
    req = await _load_swap(db, swap_id)
    if req.to_name.lower() != me.lower():
        await db.rollback()
        raise HTTPException(status_code=403, detail="Solo la persona a quien se le propuso puede aceptar.")
    rows = {r.id: r for r in (await db.execute(text("SELECT id, psychologist_name, shift_date, start_time, end_time, shift_type FROM staff_shifts WHERE id IN (:a, :b) FOR UPDATE"),
                                               {"a": req.from_shift_id, "b": req.to_shift_id})).fetchall()}
    a_row, b_row = rows.get(req.from_shift_id), rows.get(req.to_shift_id)
    if (not a_row or not b_row or a_row.psychologist_name.lower() != req.from_name.lower()
            or b_row.psychologist_name.lower() != req.to_name.lower()):
        await _close(db, swap_id, "VENCIDA", me, "Los turnos cambiaron antes de aceptar.")
        raise HTTPException(status_code=409, detail="Los turnos cambiaron y la solicitud ya no es válida.")
    a, b = _shift_dict(a_row), _shift_dict(b_row)
    shifts, av, off = await _week_context(db, local_monday(a["date"]))
    errs = RULES.validate_swap(a, b, all_shifts=shifts, availability=av, time_off=off, now=_now())
    if errs:
        await _close(db, swap_id, "VENCIDA", me, " ".join(errs))
        raise HTTPException(status_code=422, detail={"code": "SWAP_NOT_ALLOWED", "errors": errs, "message": " ".join(errs)})

    moved_appts = 0
    if a["type"] == "ENTREVISTAS":
        # las citas agendadas dentro de cada franja pasan a la nueva persona (por id, para no cruzarlas dos veces)
        async def appts(person: str, s: dict) -> List[int]:
            return [x[0] for x in (await db.execute(text("""
                SELECT id FROM interview_appointments
                WHERE UPPER(psychologist_name) = ANY(:p) AND DATE(appointment_date) = :d AND status != 'CANCELADA'
                  AND LEFT(time_slot, 5) >= :s AND LEFT(time_slot, 5) < :e
            """), {"p": _nombres_cita(person), "d": s["date"], "s": _hhmm(s["start"]), "e": _hhmm(s["end"])})).fetchall()]
        a_ids, b_ids = await appts(a["name"], a), await appts(b["name"], b)
        if a_ids:
            await db.execute(text("UPDATE interview_appointments SET psychologist_name = :n WHERE id = ANY(:ids)"), {"n": b["name"].upper(), "ids": a_ids})
        if b_ids:
            await db.execute(text("UPDATE interview_appointments SET psychologist_name = :n WHERE id = ANY(:ids)"), {"n": a["name"].upper(), "ids": b_ids})
        moved_appts = len(a_ids) + len(b_ids)
    await db.execute(text("UPDATE staff_shifts SET psychologist_name = :n, updated_at = NOW() WHERE id = :i"), {"n": b["name"], "i": a["id"]})
    await db.execute(text("UPDATE staff_shifts SET psychologist_name = :n, updated_at = NOW() WHERE id = :i"), {"n": a["name"], "i": b["id"]})
    await _close(db, swap_id, "ACEPTADA", me)
    await _notify(db, req.from_name, f"{me} aceptó tu cambio de horario", "Cambio de horario aceptado",
                  f'<p><b>{html.escape(me)}</b> aceptó el cambio. Ahora tienes: <b>{_lbl(b)}</b> y {html.escape(me)} tiene: <b>{_lbl(a)}</b>.</p>')
    return {"status": "success", "moved_appointments": moved_appts}


@router.post("/swaps/{swap_id}/reject")
async def reject_swap(swap_id: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_change_tables(db)
    me = await _require_me(db, user)
    req = await _load_swap(db, swap_id)
    if req.to_name.lower() != me.lower():
        await db.rollback()
        raise HTTPException(status_code=403, detail="Solo la persona a quien se le propuso puede rechazar.")
    await _close(db, swap_id, "RECHAZADA", me)
    await _notify(db, req.from_name, f"{me} no pudo aceptar tu cambio", "Cambio de horario rechazado",
                  f'<p><b>{html.escape(me)}</b> no pudo aceptar el cambio de horario que propusiste. Tus turnos siguen igual.</p>')
    return {"status": "success"}


@router.post("/swaps/{swap_id}/cancel")
async def cancel_swap(swap_id: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_change_tables(db)
    me = await my_staff_name(db, user)
    req = await _load_swap(db, swap_id)
    if not (me and req.from_name.lower() == me.lower()) and hides_costs(user):
        await db.rollback()
        raise HTTPException(status_code=403, detail="Solo quien la propuso (o administración) puede cancelarla.")
    await _close(db, swap_id, "CANCELADA", me or str(user.get("email") or "admin"))
    return {"status": "success"}


# ------------------------------------------------------------------ Mi semana: disponibilidad propia y citas

VENTANA = {0: (540, 1200), 1: (540, 1200), 2: (540, 1200), 3: (540, 1200), 4: (540, 1200), 5: (540, 780)}   # minutos desde 00:00


def _min(hhmm: str) -> int:
    h, m = hhmm.strip()[:5].split(":")
    return int(h) * 60 + int(m)


@router.get("/my-availability")
async def my_availability(db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """Mi disponibilidad semanal recurrente (la que usa el generador del horario)."""
    await ensure_shift_tables(db)
    me = await my_staff_name(db, user)
    out: Dict[str, Any] = {"me": me, "days": {k: {"mode": "UNSET", "ranges": []} for k in DAY_KEYS}, "labels": DAY_LABELS_ES,
                           "weekly_hours": None, "updated_at": None, "defined": False}
    if not me:
        return out
    out["weekly_hours"] = (await db.execute(text("SELECT weekly_hours FROM staff_team WHERE LOWER(name) = LOWER(:n)"), {"n": me})).scalar()
    rows = (await db.execute(text("SELECT weekday, mode, start_time, end_time, updated_at FROM staff_availability WHERE LOWER(employee_name) = LOWER(:n) ORDER BY weekday, start_time"), {"n": me})).fetchall()
    for r in rows:
        d = out["days"][DAY_KEYS[int(r.weekday)]]
        d["mode"] = r.mode
        if r.mode == "RANGES" and r.start_time and r.end_time:
            d["ranges"].append({"start_time": _hhmm(r.start_time), "end_time": _hhmm(r.end_time)})
        if r.updated_at and (out["updated_at"] is None or r.updated_at.isoformat() > out["updated_at"]):
            out["updated_at"] = r.updated_at.isoformat()
    out["defined"] = bool(rows)
    return out


class MyAvailabilityDay(BaseModel):
    mode: str = "UNSET"
    ranges: List[Dict[str, str]] = []


class MyAvailability(BaseModel):
    days: Dict[str, MyAvailabilityDay]


@router.put("/my-availability")
async def save_my_availability(payload: MyAvailability, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """Guarda MI disponibilidad. Cada dia de lunes a sabado debe quedar elegido y dentro del horario del equipo."""
    me = await _require_me(db, user)
    days: Dict[str, AvailabilityDay] = {}
    for i, key in enumerate(DAY_KEYS):
        d = payload.days.get(key)
        mode = (d.mode if d else "UNSET").upper()
        if i == 6:
            days[key] = AvailabilityDay(mode="UNAVAILABLE", ranges=[])      # domingo: el equipo no atiende
            continue
        if mode not in ("ALL_DAY", "UNAVAILABLE", "RANGES"):
            raise HTTPException(status_code=422, detail=f"{DAY_LABELS_ES[i]}: elige si puedes o no puedes ese día.")
        ranges: List[ShiftRange] = []
        if mode == "RANGES":
            for r in (d.ranges or []):
                a, b = r.get("start_time", ""), r.get("end_time", "")
                try:
                    ma, mb = _min(a), _min(b)
                except Exception:
                    raise HTTPException(status_code=422, detail=f"{DAY_LABELS_ES[i]}: hora inválida.")
                w0, w1 = VENTANA[i]
                if ma < w0 or mb > w1:
                    raise HTTPException(status_code=422, detail=f"{DAY_LABELS_ES[i]}: el equipo solo atiende de {w0 // 60}:00 a {w1 // 60}:00.")
                ranges.append(ShiftRange(start_time=a, end_time=b))
            if not ranges:
                raise HTTPException(status_code=422, detail=f"{DAY_LABELS_ES[i]}: agrega al menos una franja o elige otra opción.")
        days[key] = AvailabilityDay(mode=mode, ranges=ranges)
    if all(v.mode == "UNAVAILABLE" for v in days.values()):
        raise HTTPException(status_code=422, detail="Marcaste todos los días como no disponible. Elige al menos un día en el que sí puedas.")
    res = await save_availability(AvailabilityRequest(employee_name=me, days=days), db, user)
    return {"status": "success", "me": me, "rows": res.get("rows")}


@router.get("/my-appointments")
async def my_appointments(week_date: Optional[str] = Query(None), db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """Mis entrevistas agendadas por clientes en la semana (por el nombre completo o el codigo corto historico)."""
    try:
        monday = local_monday(datetime.strptime(week_date, "%Y-%m-%d").date()) if week_date else local_monday(_now().date())
    except ValueError:
        raise HTTPException(status_code=422, detail="Fecha inválida.")
    me = await my_staff_name(db, user)
    if not me:
        return {"me": None, "appointments": []}
    rows = (await db.execute(text("""
        SELECT id, appointment_date, time_slot, client_name, client_city, status, meet_link, videocall_token
        FROM interview_appointments
        WHERE UPPER(psychologist_name) = ANY(:n) AND DATE(appointment_date) BETWEEN :a AND :b AND status != 'CANCELADA'
        ORDER BY appointment_date, time_slot
    """), {"n": _nombres_cita(me), "a": monday, "b": monday + timedelta(days=6)})).fetchall()
    out = []
    for r in rows:
        ini = str(r.time_slot).strip()[:5]
        fin = (datetime.combine(r.appointment_date.date(), datetime.strptime(ini, "%H:%M").time()) + timedelta(minutes=45)).strftime("%H:%M")
        out.append({"id": r.id, "date": r.appointment_date.date().isoformat(), "start": ini, "end": fin, "client": r.client_name or "Cliente",
                    "city": r.client_city, "status": r.status, "meet_link": r.meet_link, "token": r.videocall_token})
    return {"me": me, "week_monday": monday.isoformat(), "appointments": out}
