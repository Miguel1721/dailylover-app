from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import get_current_user
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime, timedelta, time
from uuid import uuid4
import asyncio
import json
import re

from app.core.auth_guard import exigir_sesion
router = APIRouter(prefix="/api/v1", tags=["Scheduling, 7shifts & Booking"])

PSYCHOLOGISTS_METADATA = {
    "ANA": {"name": "Ana María", "slug": "ana", "role": "Directora de Matchmaking", "city": "Bogotá", "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150"},
    "SILVI": {"name": "Silvia Gómez", "slug": "silvi", "role": "Psicóloga Senior", "city": "Bogotá", "avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150"},
    "JENN": {"name": "Jennifer R.", "slug": "jenn", "role": "Psicóloga Clínica", "city": "Bogotá", "avatar": "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150"},
    "STEFFY": {"name": "Steffany V.", "slug": "steffy", "role": "Matchmaker Especialista", "city": "Medellín", "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"},
    "SOFI": {"name": "Sofía Morales", "slug": "sofi", "role": "Psicóloga de Admisiones", "city": "Bogotá", "avatar": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150"},
    "MAPE D": {"name": "María Paula D.", "slug": "mape-d", "role": "Coordinadora de Casos", "city": "Bogotá", "avatar": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150"},
    "ALEJA": {"name": "Alejandra C.", "slug": "aleja", "role": "Matchmaker", "city": "Cali", "avatar": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150"},
    "MANU": {"name": "Manuela P.", "slug": "manu", "role": "Psicóloga Evaluadora", "city": "Medellín", "avatar": "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150"},
    "PIA": {"name": "Pía Restrepo", "slug": "pia", "role": "Psicóloga Familiar & Pareja", "city": "Bogotá", "avatar": "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=150"},
    "ISA": {"name": "Isabella V.", "slug": "isa", "role": "Matchmaker", "city": "Barranquilla", "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150"}
}


DEFAULT_AVATAR = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150"


async def person_meta(db: AsyncSession, p_name: str) -> dict:
    """Ficha pública de la persona del turno: claves cortas heredadas, o el equipo real (staff_team)."""
    key = (p_name or "").upper().strip()
    if key in PSYCHOLOGISTS_METADATA:
        return PSYCHOLOGISTS_METADATA[key]
    row = (await db.execute(
        text("SELECT name, slug, role, avatar FROM staff_team WHERE UPPER(name) = :n LIMIT 1"), {"n": key}
    )).fetchone()
    if row:
        role = "Matchmaker" if (row[2] or "").lower() in ("interviewer", "matchmaker") else (row[2] or "Equipo Daily Lover")
        return {"name": row[0], "slug": row[1], "role": role, "city": "Bogotá", "avatar": row[3] or DEFAULT_AVATAR}
    nice = (p_name or "Equipo Daily Lover").strip().title()
    return {"name": nice, "slug": re.sub(r"[^a-z0-9]+", "-", nice.lower()).strip("-"), "role": "Equipo Daily Lover", "city": "Bogotá", "avatar": DEFAULT_AVATAR}

# ==============================================================================
# 1. MÓDULO 7SHIFTS: MATRIZ SEMANAL DE TURNOS & DISPONIBILIDAD
# ==============================================================================

TEAM_ROLE_RE = re.compile(r"psic[oó]log|matchmaker|interview|customer|servicio", re.IGNORECASE)


def hides_costs(user: dict) -> bool:
    """Psicólogas / matchmakers / servicio al cliente no ven tarifas ni presupuesto (solo administración)."""
    return bool(TEAM_ROLE_RE.search(str(user.get("role_name") or "")))


async def require_staff(user: dict = Depends(get_current_user)) -> dict:
    """Solo el equipo (cuentas del panel admin) puede ver o editar turnos y disponibilidad."""
    if user.get("is_client"):
        raise HTTPException(status_code=403, detail="Solo el equipo puede gestionar turnos.")
    return user


DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
DAY_LABELS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
MAX_RANGES_PER_DAY = 6
SHIFT_TYPES = {"ENTREVISTAS", "MATCHMAKING", "CS", "DISPONIBLE"}
AVAIL_MODES = {"UNSET", "ALL_DAY", "UNAVAILABLE", "RANGES"}

# Departamentos, roles y personas que muestra la matriz (misma estructura de 7shifts).
DEPARTMENT_DEFS = [
    {
        "name": "Customer Service",
        "bg_header": "#2b2b2b",
        "roles": [
            {"role_name": "Head of Operations", "color": "#00a4b8", "code": "ho", "allow_add": True, "employee_names": []},
            {
                "role_name": "Customer Service Assistant", "color": "#f38218", "code": "c", "allow_add": False,
                "employee_names": ["Valentina Ospina", "Catalina Cely Rueda", "Valentina Prieto", "Nina Andrade Carrizosa", "Monica Ospina"],
            },
        ],
    },
    {
        "name": "Matchmaking",
        "bg_header": "#2b2b2b",
        "roles": [
            {"role_name": "matchmaker", "color": "#f78a8a", "code": "m", "allow_add": False, "employee_names": ["Maria Pia Cottrino"]},
            {
                "role_name": "interviewer", "color": "#4a6977", "code": "i", "allow_add": False,
                "employee_names": ["Mara Paula de la Espriella", "Estefania Rodriguez", "Jennifer Pimiento", "Ana Maria Tolosa", "Silvana Manrique", "Isabela Marquez"],
            },
            {"role_name": "VIP INTERVIEWER", "color": "#961500", "code": "v", "allow_add": True, "employee_names": []},
            {"role_name": "Horas extra", "color": "#0066ff", "code": "o", "allow_add": True, "employee_names": []},
        ],
    },
]
STAFF_ROSTER = [n for d in DEPARTMENT_DEFS for r in d["roles"] for n in r["employee_names"]]
ROSTER_BY_LOWER = {n.lower(): n for n in STAFF_ROSTER}


# Horas semanales acordadas (Jorge, 30-sep-2026). Solo se siembran si la persona aún no tiene valor.
DEFAULT_WEEKLY_HOURS = {
    "Estefania Rodriguez": 20, "Ana Maria Tolosa": 20, "Isabela Marquez": 17, "Jennifer Pimiento": 15,
    "Silvana Manrique": 15, "Maria Pia Cottrino": 15, "Mara Paula de la Espriella": 15,
}
INTERVIEW_TYPES = ("ENTREVISTAS", "DISPONIBLE")


class ShiftRange(BaseModel):
    start_time: str  # "HH:MM" (24 h) o "7:00 AM"
    end_time: str
    shift_type: Optional[str] = None  # ENTREVISTAS / MATCHMAKING por franja (si falta, usa el del día)


class ShiftDayRequest(BaseModel):
    """Guarda TODOS los turnos (franjas) de una persona en uno o varios días. Sin franjas = borrar el día."""
    psychologist_name: str
    dates: List[str]                      # YYYY-MM-DD
    ranges: List[ShiftRange] = []         # varias franjas = turno partido
    shift_type: Optional[str] = "ENTREVISTAS"
    is_published: Optional[bool] = True
    notes: Optional[str] = ""
    shift_flag: Optional[str] = "None"
    force: Optional[bool] = False         # confirmar aunque queden entrevistas agendadas sin cobertura


class ShiftCreateRequest(BaseModel):
    id: Optional[int] = None
    psychologist_name: str
    shift_date: date
    start_time: str # "HH:MM" or "7:00 AM"
    end_time: str   # "HH:MM" or "2:00 PM"
    shift_type: Optional[str] = "ENTREVISTAS"
    is_published: Optional[bool] = True
    max_interviews: Optional[int] = 5
    notes: Optional[str] = ""
    apply_to_dates: Optional[List[str]] = None
    shift_flag: Optional[str] = "None"


class CopyWeekRequest(BaseModel):
    from_monday: date
    to_monday: date


class PublishWeekRequest(BaseModel):
    week_monday: date


class AvailabilityDay(BaseModel):
    mode: str = "UNSET"                   # UNSET | ALL_DAY | UNAVAILABLE | RANGES
    ranges: List[ShiftRange] = []


class AvailabilityRequest(BaseModel):
    employee_name: str
    days: Dict[str, AvailabilityDay]      # claves mon..sun


class TimeOffRequest(BaseModel):
    psychologist_name: str
    start_date: date
    end_date: date
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    reason: str


# ---------- Utilidades de hora ----------

def parse_time_strict(value: str) -> time:
    s = (value or "").strip().upper().replace(".", "")
    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p", "%I %p", "%I%p"):
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            pass
    raise HTTPException(status_code=422, detail=f"Hora inválida: '{value}'. Usa el formato HH:MM (ej. 09:00) o 6:00 PM.")


def fmt_12(t: time) -> str:
    """9:00 AM / 6:30 PM"""
    return t.strftime("%I:%M %p").lstrip("0")


def fmt_12_short(t: time) -> str:
    """9am / 6:30pm"""
    return t.strftime("%I:%M%p").lstrip("0").lower().replace(":00", "")


def normalize_ranges(raw: List[ShiftRange]) -> List[tuple]:
    """Valida franjas: hora fin > inicio, sin cruces, máximo MAX_RANGES_PER_DAY. Devuelve lista ordenada [(ini, fin)]."""
    out = []
    for r in raw:
        s = parse_time_strict(r.start_time)
        e = parse_time_strict(r.end_time)
        if e <= s:
            raise HTTPException(status_code=422, detail=f"En la franja {fmt_12(s)} → {fmt_12(e)} la hora de fin debe ser posterior a la de inicio.")
        out.append((s, e))
    out.sort()
    for a, b in zip(out, out[1:]):
        if b[0] < a[1]:
            raise HTTPException(status_code=422, detail=f"Las franjas {fmt_12(a[0])}–{fmt_12(a[1])} y {fmt_12(b[0])}–{fmt_12(b[1])} se cruzan.")
    if len(out) > MAX_RANGES_PER_DAY:
        raise HTTPException(status_code=422, detail=f"Máximo {MAX_RANGES_PER_DAY} franjas por día.")
    return out


def canonical_name(name: str) -> str:
    n = (name or "").strip()
    if not n:
        raise HTTPException(status_code=422, detail="Falta el nombre de la persona.")
    return ROSTER_BY_LOWER.get(n.lower(), n)


# ---------- Tablas (se aseguran una sola vez por proceso, sin tocar main.py) ----------

_shift_tables_ready = False
_shift_tables_lock = asyncio.Lock()


async def ensure_shift_tables(db: AsyncSession) -> None:
    """Crea/ajusta tablas de turnos: permite varias franjas por persona y día y agrega disponibilidad semanal."""
    global _shift_tables_ready
    if _shift_tables_ready:
        return
    async with _shift_tables_lock:
        if _shift_tables_ready:
            return
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS staff_shifts (
                id SERIAL PRIMARY KEY,
                psychologist_name VARCHAR(150) NOT NULL,
                shift_date DATE NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                shift_type VARCHAR(30) DEFAULT 'ENTREVISTAS',
                is_published BOOLEAN DEFAULT TRUE,
                max_interviews INT DEFAULT 5,
                notes TEXT DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await db.execute(text("ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS shift_flag VARCHAR(10) DEFAULT 'None'"))
        await db.execute(text("CREATE INDEX IF NOT EXISTS idx_staff_shifts_date ON staff_shifts(shift_date)"))
        # Si alguna vez se creó una restricción UNIQUE (persona, fecha), impediría el turno partido: se elimina.
        await db.execute(text("""
            DO $$
            DECLARE r record;
            BEGIN
              FOR r IN
                SELECT i.relname AS idx, c.conname AS con
                FROM pg_index x
                JOIN pg_class t ON t.oid = x.indrelid
                JOIN pg_class i ON i.oid = x.indexrelid
                LEFT JOIN pg_constraint c ON c.conindid = i.oid AND c.contype = 'u'
                WHERE t.relname = 'staff_shifts' AND x.indisunique AND NOT x.indisprimary
                  AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attnum = ANY (x.indkey) AND a.attname = 'shift_date')
                  AND NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attnum = ANY (x.indkey) AND a.attname IN ('start_time', 'end_time'))
              LOOP
                IF r.con IS NOT NULL THEN
                  EXECUTE format('ALTER TABLE staff_shifts DROP CONSTRAINT %I', r.con);
                ELSE
                  EXECUTE format('DROP INDEX IF EXISTS %I', r.idx);
                END IF;
              END LOOP;
            END $$;
        """))
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS staff_availability (
                id SERIAL PRIMARY KEY,
                employee_name VARCHAR(150) NOT NULL,
                weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
                mode VARCHAR(12) NOT NULL DEFAULT 'RANGES',
                start_time TIME,
                end_time TIME,
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                updated_by TEXT
            )
        """))
        await db.execute(text("CREATE INDEX IF NOT EXISTS idx_staff_availability_emp ON staff_availability(LOWER(employee_name))"))
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS staff_time_off (
                id SERIAL PRIMARY KEY,
                psychologist_name VARCHAR(150) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                reason TEXT,
                status VARCHAR(20) DEFAULT 'APPROVED'
            )
        """))
        await db.execute(text("ALTER TABLE staff_time_off ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()"))
        await db.execute(text("ALTER TABLE staff_time_off ADD COLUMN IF NOT EXISTS requested_by TEXT"))
        await db.execute(text("ALTER TABLE staff_time_off ADD COLUMN IF NOT EXISTS decided_by TEXT"))
        await db.execute(text("ALTER TABLE staff_time_off ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ"))
        await db.execute(text("ALTER TABLE staff_team ADD COLUMN IF NOT EXISTS weekly_hours NUMERIC(5,1)"))
        for nm, hrs in DEFAULT_WEEKLY_HOURS.items():
            await db.execute(text("UPDATE staff_team SET weekly_hours = :h WHERE LOWER(name) = LOWER(:n) AND weekly_hours IS NULL"), {"h": hrs, "n": nm})
        await db.commit()
        _shift_tables_ready = True


def outside_availability(av: Optional[dict], s: time, e: time) -> bool:
    """True si el turno queda fuera de la disponibilidad declarada de esa persona ese día."""
    if not av:
        return False
    if av["mode"] == "UNAVAILABLE":
        return True
    if av["mode"] == "ALL_DAY":
        return False
    return not any(rs <= s and e <= re for rs, re in av["ranges"])


async def load_availability(db: AsyncSession) -> Dict[tuple, dict]:
    res = await db.execute(text("""
        SELECT employee_name, weekday, mode, start_time, end_time
        FROM staff_availability ORDER BY weekday, start_time
    """))
    out: Dict[tuple, dict] = {}
    for r in res.fetchall():
        key = (r.employee_name.lower(), int(r.weekday))
        slot = out.setdefault(key, {"mode": r.mode, "ranges": []})
        if r.mode == "RANGES" and r.start_time and r.end_time:
            slot["ranges"].append((r.start_time, r.end_time))
    return out


def local_monday(target: date) -> date:
    return target - timedelta(days=target.weekday())


async def require_admin(user: dict = Depends(require_staff)) -> dict:
    """Solo administración (no psicólogas / matchmakers / servicio al cliente)."""
    if hides_costs(user):
        raise HTTPException(status_code=403, detail="Solo administración puede cambiar esto.")
    return user


class TeamUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    weekly_hours: Optional[float] = None


@router.get("/shifts/team-config")
async def team_config(db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """Personas de matchmaking con sus horas semanales y si están activas (las inactivas no cuentan para horas ni cobertura)."""
    await ensure_shift_tables(db)
    rows = (await db.execute(text("""
        SELECT id, name, role, is_active, weekly_hours FROM staff_team
        WHERE weekly_hours IS NOT NULL OR LOWER(department) = 'matchmaking'
        ORDER BY id
    """))).fetchall()
    return {"team": [
        {"id": r.id, "name": r.name, "role": r.role, "is_active": bool(r.is_active),
         "weekly_hours": float(r.weekly_hours) if r.weekly_hours is not None else None} for r in rows
    ]}


@router.patch("/shifts/team/{member_id}")
async def update_team_member(member_id: int, payload: TeamUpdateRequest, db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    await ensure_shift_tables(db)
    if payload.weekly_hours is not None and not (0 <= payload.weekly_hours <= 60):
        raise HTTPException(status_code=422, detail="Las horas semanales deben estar entre 0 y 60.")
    sets, params = [], {"id": member_id}
    if payload.is_active is not None:
        sets.append("is_active = :a"); params["a"] = payload.is_active
    if payload.weekly_hours is not None:
        sets.append("weekly_hours = :h"); params["h"] = payload.weekly_hours
    if not sets:
        raise HTTPException(status_code=422, detail="Nada que actualizar.")
    res = await db.execute(text(f"UPDATE staff_team SET {', '.join(sets)} WHERE id = :id RETURNING name, is_active, weekly_hours"), params)
    row = res.fetchone()
    if not row:
        await db.rollback()
        raise HTTPException(status_code=404, detail="Persona no encontrada.")
    await db.commit()
    return {"status": "success", "name": row[0], "is_active": bool(row[1]), "weekly_hours": float(row[2]) if row[2] is not None else None}


# Ventana en la que SIEMPRE debe haber alguien en entrevistas (Jorge, 30-sep-2026). Domingo: sin cobertura.
COVERAGE_WINDOWS = {0: (time(9, 0), time(20, 0)), 1: (time(9, 0), time(20, 0)), 2: (time(9, 0), time(20, 0)),
                    3: (time(9, 0), time(20, 0)), 4: (time(9, 0), time(20, 0)), 5: (time(9, 0), time(13, 0))}
MIN_COVERAGE = 1


@router.get("/shifts/coverage")
async def weekly_coverage(
    week_date: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Tramos de la ventana de entrevistas que quedan sin nadie cubriendo (solo personas activas; descuenta permisos aprobados)."""
    await ensure_shift_tables(db)
    target = date.today()
    if week_date:
        try:
            target = datetime.strptime(week_date, "%Y-%m-%d").date()
        except ValueError:
            pass
    monday = local_monday(target)
    sunday = monday + timedelta(days=6)

    active = {r[0].lower() for r in (await db.execute(text(
        "SELECT name FROM staff_team WHERE is_active = true AND weekly_hours IS NOT NULL"))).fetchall()}
    shifts = (await db.execute(text("""
        SELECT LOWER(psychologist_name) AS p, shift_date, start_time, end_time FROM staff_shifts
        WHERE shift_date BETWEEN :mon AND :sun AND shift_type IN ('ENTREVISTAS', 'DISPONIBLE')
    """), {"mon": monday, "sun": sunday})).fetchall()
    offs = (await db.execute(text("""
        SELECT LOWER(psychologist_name) AS p, start_date, end_date FROM staff_time_off
        WHERE start_date <= :sun AND end_date >= :mon AND UPPER(COALESCE(status, 'APPROVED')) = 'APPROVED'
    """), {"mon": monday, "sun": sunday})).fetchall()

    def on_leave(p: str, d: date) -> bool:
        return any(o.p == p and o.start_date <= d <= o.end_date for o in offs)

    days, total_future = [], 0
    for i in range(7):
        d = monday + timedelta(days=i)
        win = COVERAGE_WINDOWS.get(i)
        gaps = []
        if win:
            cur = datetime.combine(d, win[0])
            end = datetime.combine(d, win[1])
            gap_start = None
            while cur < end:
                nxt = cur + timedelta(minutes=30)
                n = len({sh.p for sh in shifts
                         if sh.shift_date == d and sh.p in active and not on_leave(sh.p, d)
                         and datetime.combine(d, sh.start_time) <= cur and nxt <= datetime.combine(d, sh.end_time)})
                if n < MIN_COVERAGE and gap_start is None:
                    gap_start = cur
                if n >= MIN_COVERAGE and gap_start is not None:
                    gaps.append((gap_start, cur)); gap_start = None
                cur = nxt
            if gap_start is not None:
                gaps.append((gap_start, end))
        is_past = d < date.today()
        if not is_past:
            total_future += len(gaps)
        days.append({
            "date": d.isoformat(), "weekday": DAY_LABELS_ES[i], "is_past": is_past,
            "window": f"{fmt_12_short(win[0])}–{fmt_12_short(win[1])}" if win else None,
            "gaps": [{"start": a.strftime("%H:%M"), "end": b.strftime("%H:%M"),
                      "label": f"{fmt_12_short(a.time())}–{fmt_12_short(b.time())}"} for a, b in gaps],
        })
    return {"min_coverage": MIN_COVERAGE, "week_monday": monday.isoformat(), "total_gaps": total_future, "days": days}


@router.get("/shifts/readiness")
async def generation_readiness(db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """¿Ya pusieron su disponibilidad todas las personas ACTIVAS? El horario solo se genera cuando todas están listas."""
    await ensure_shift_tables(db)
    team = (await db.execute(text("""
        SELECT name, weekly_hours FROM staff_team
        WHERE is_active = true AND weekly_hours IS NOT NULL ORDER BY id
    """))).fetchall()
    days = (await db.execute(text("""
        SELECT LOWER(employee_name) AS n, COUNT(DISTINCT weekday) AS d FROM staff_availability GROUP BY 1
    """))).fetchall()
    defined = {r.n: int(r.d) for r in days}
    people = [{"name": t.name, "weekly_hours": float(t.weekly_hours), "days_defined": defined.get(t.name.lower(), 0),
               "ready": defined.get(t.name.lower(), 0) > 0} for t in team]
    missing = [p["name"] for p in people if not p["ready"]]
    return {"ready": bool(people) and not missing, "active_people": len(people), "missing": missing, "people": people}


# ==============================================================================
# FASE 4: GENERAR LA SEMANA SIGUIENTE, APROBAR Y ENVIAR CORREOS
# ==============================================================================

def next_monday() -> date:
    today = date.today()
    return today + timedelta(days=7 - today.weekday())


def _parse_monday(raw: Optional[str]) -> date:
    if not raw:
        return next_monday()
    try:
        return local_monday(datetime.strptime(raw, "%Y-%m-%d").date())
    except ValueError:
        raise HTTPException(status_code=422, detail="Fecha inválida (usa AAAA-MM-DD).")


def _who(user: dict) -> str:
    return str(user.get("email") or user.get("name") or user.get("full_name") or "admin")


class GenerateRequest(BaseModel):
    week_monday: Optional[str] = None
    replace: Optional[bool] = False


class ApproveRequest(BaseModel):
    week_monday: Optional[str] = None
    resend: Optional[bool] = False


class PlanningSettingsRequest(BaseModel):
    email_test_to: Optional[str] = None       # "" = enviar al correo de cada persona
    reminders_enabled: Optional[bool] = None


@router.get("/shifts/week-status")
async def week_status(week_date: Optional[str] = Query(None), db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    from app.services import shift_planning as SP
    await ensure_shift_tables(db); await SP.ensure_planning_tables(db)
    monday = _parse_monday(week_date) if week_date else local_monday(date.today())
    row = (await db.execute(text("SELECT status, generated_at, generated_by, approved_at, approved_by, emails_sent_at FROM staff_weeks WHERE week_monday = :m"), {"m": monday})).fetchone()
    n = (await db.execute(text("SELECT COUNT(*) FROM staff_shifts WHERE shift_date BETWEEN :a AND :b"), {"a": monday, "b": monday + timedelta(days=6)})).scalar()
    return {
        "week_monday": monday.isoformat(), "status": row[0] if row else "SIN_GENERAR", "shifts": int(n or 0),
        "generated_by": row[2] if row else None, "approved_by": row[4] if row else None,
        "approved_at": row[3].isoformat() if row and row[3] else None,
        "emails_sent_at": row[5].isoformat() if row and row[5] else None,
        "next_monday": next_monday().isoformat(),
    }


@router.get("/shifts/planning-settings")
async def get_planning_settings(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    from app.services import shift_planning as SP
    await SP.ensure_planning_tables(db)
    return {"email_test_to": await SP.get_setting(db, "email_test_to", SP.TEST_EMAIL_DEFAULT),
            "reminders_enabled": (await SP.get_setting(db, "reminders_enabled", "0")) == "1",
            "missing_availability": await SP.missing_availability(db)}


@router.patch("/shifts/planning-settings")
async def patch_planning_settings(payload: PlanningSettingsRequest, db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    from app.services import shift_planning as SP
    await SP.ensure_planning_tables(db)
    if payload.email_test_to is not None:
        v = payload.email_test_to.strip()
        if v and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise HTTPException(status_code=422, detail="Correo de prueba inválido.")
        await SP.set_setting(db, "email_test_to", v)
    if payload.reminders_enabled is not None:
        await SP.set_setting(db, "reminders_enabled", "1" if payload.reminders_enabled else "0")
    return await get_planning_settings(db, user)


@router.post("/shifts/reminders/run")
async def run_reminders_now(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    """Envía ya el recordatorio de disponibilidad a quien falte (máximo uno por persona y día)."""
    from app.services import shift_planning as SP
    return await SP.run_availability_reminders(db, force=True)


@router.post("/shifts/generate")
async def generate_next_week(payload: GenerateRequest, db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    """Genera el BORRADOR (sin publicar) de la semana siguiente. Solo si todas las personas activas ya pusieron su disponibilidad."""
    from app.services import shift_planning as SP
    from app.services.shift_generator import generate_week
    await ensure_shift_tables(db); await SP.ensure_planning_tables(db)
    monday = _parse_monday(payload.week_monday)
    if monday <= local_monday(date.today()):
        raise HTTPException(status_code=422, detail="Solo se puede generar una semana futura.")
    sunday = monday + timedelta(days=6)

    missing = await SP.missing_availability(db)
    if missing:
        raise HTTPException(status_code=409, detail={"code": "MISSING_AVAILABILITY", "missing": missing,
            "message": "No se genera el horario: falta la disponibilidad de " + ", ".join(missing) + "."})

    team = (await db.execute(text("SELECT name, weekly_hours FROM staff_team WHERE is_active = true AND weekly_hours IS NOT NULL ORDER BY id"))).fetchall()
    people = [{"name": t[0], "weekly_hours": float(t[1]), "active": True} for t in team]
    names_lower = [p["name"].lower() for p in people]

    av: Dict[str, dict] = {}
    for r in (await db.execute(text("SELECT LOWER(employee_name) n, weekday, mode, start_time, end_time FROM staff_availability ORDER BY weekday, start_time"))).fetchall():
        slot = av.setdefault(r.n, {}).setdefault(int(r.weekday), {"mode": r.mode, "ranges": []})
        if r.mode == "RANGES" and r.start_time and r.end_time:
            slot["ranges"].append((r.start_time.strftime("%H:%M"), r.end_time.strftime("%H:%M")))
    off = [{"name": o.psychologist_name, "start": o.start_date, "end": o.end_date} for o in (await db.execute(text("""
        SELECT psychologist_name, start_date, end_date FROM staff_time_off
        WHERE start_date <= :b AND end_date >= :a AND UPPER(COALESCE(status, 'APPROVED')) = 'APPROVED'
    """), {"a": monday, "b": sunday})).fetchall()]

    existing = (await db.execute(text("""
        SELECT COUNT(*) FROM staff_shifts WHERE shift_date BETWEEN :a AND :b AND LOWER(psychologist_name) = ANY(:n)
    """), {"a": monday, "b": sunday, "n": names_lower})).scalar()
    if existing and not payload.replace:
        raise HTTPException(status_code=409, detail={"code": "HAS_SHIFTS", "existing": int(existing),
            "message": f"Esa semana ya tiene {existing} turno(s). Generar de nuevo los reemplaza."})
    if existing:
        booked = (await db.execute(text("""
            SELECT COUNT(*) FROM interview_appointments
            WHERE DATE(appointment_date) BETWEEN :a AND :b AND status != 'CANCELADA' AND LOWER(psychologist_name) = ANY(:n)
        """), {"a": monday, "b": sunday, "n": names_lower})).scalar()
        if booked:
            raise HTTPException(status_code=409, detail={"code": "HAS_APPOINTMENTS", "message":
                f"Esa semana ya tiene {booked} entrevista(s) agendada(s); no se puede regenerar sin revisarlas a mano."})

    result = generate_week(monday, people, av, off)
    if result["report"].get("blocked_by_missing_availability"):
        raise HTTPException(status_code=409, detail={"code": "MISSING_AVAILABILITY", "missing": result["report"]["blocked_by_missing_availability"],
            "message": "Falta disponibilidad de alguna persona activa."})

    try:
        if existing:
            await db.execute(text("DELETE FROM staff_shifts WHERE shift_date BETWEEN :a AND :b AND LOWER(psychologist_name) = ANY(:n)"),
                             {"a": monday, "b": sunday, "n": names_lower})
        for sh in result["shifts"]:
            await db.execute(text("""
                INSERT INTO staff_shifts (psychologist_name, shift_date, start_time, end_time, shift_type, is_published, max_interviews, notes)
                VALUES (:p, :d, :s, :e, :t, false, 5, 'Generado automático')
            """), {"p": sh["name"], "d": sh["date"], "s": parse_time_strict(sh["start"]), "e": parse_time_strict(sh["end"]), "t": sh["type"]})
        await db.execute(text("""
            INSERT INTO staff_weeks (week_monday, status, generated_at, generated_by, approved_at, approved_by, emails_sent_at)
            VALUES (:m, 'BORRADOR', NOW(), :u, NULL, NULL, NULL)
            ON CONFLICT (week_monday) DO UPDATE SET status = 'BORRADOR', generated_at = NOW(), generated_by = :u,
                approved_at = NULL, approved_by = NULL, emails_sent_at = NULL
        """), {"m": monday, "u": _who(user)})
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    rep = result["report"]
    return {
        "status": "success", "week_monday": monday.isoformat(), "shifts": len(result["shifts"]),
        "feasible": bool(rep.get("feasible")),
        "uncovered": [{"date": str(u["date"]), "start": u["start"], "end": u["end"]} for u in rep.get("uncovered", [])],
        "warnings": rep.get("warnings", []),
        "per_person": rep.get("per_person", {}),
    }


@router.post("/shifts/week/approve")
async def approve_week(payload: ApproveRequest, db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    """Aprueba la semana: publica los turnos y envía a cada persona activa su horario. Solo administración; una sola vez salvo reenvío."""
    from app.services import shift_planning as SP
    await ensure_shift_tables(db); await SP.ensure_planning_tables(db)
    monday = _parse_monday(payload.week_monday)
    sunday = monday + timedelta(days=6)
    row = (await db.execute(text("SELECT status, emails_sent_at FROM staff_weeks WHERE week_monday = :m"), {"m": monday})).fetchone()
    if row and row[1] and not payload.resend:
        raise HTTPException(status_code=409, detail={"code": "ALREADY_SENT", "message": "Esta semana ya fue aprobada y los correos ya se enviaron."})

    active = {r[0].lower(): r[0] for r in (await db.execute(text("SELECT name FROM staff_team WHERE is_active = true AND weekly_hours IS NOT NULL"))).fetchall()}
    rows = (await db.execute(text("""
        SELECT psychologist_name, shift_date, start_time, end_time, shift_type FROM staff_shifts
        WHERE shift_date BETWEEN :a AND :b ORDER BY shift_date, start_time
    """), {"a": monday, "b": sunday})).fetchall()
    mine = [r for r in rows if r.psychologist_name.lower() in active]
    if not mine:
        raise HTTPException(status_code=422, detail="La semana no tiene turnos del equipo para aprobar.")

    await db.execute(text("UPDATE staff_shifts SET is_published = true WHERE shift_date BETWEEN :a AND :b AND LOWER(psychologist_name) = ANY(:n)"),
                     {"a": monday, "b": sunday, "n": list(active.keys())})
    await db.execute(text("""
        INSERT INTO staff_weeks (week_monday, status, approved_at, approved_by) VALUES (:m, 'APROBADA', NOW(), :u)
        ON CONFLICT (week_monday) DO UPDATE SET status = 'APROBADA', approved_at = NOW(), approved_by = :u
    """), {"m": monday, "u": _who(user)})
    await db.commit()

    by_person: Dict[str, List[dict]] = {}
    for r in mine:
        by_person.setdefault(active[r.psychologist_name.lower()], []).append(
            {"date": r.shift_date, "start": r.start_time, "end": r.end_time, "type": r.shift_type})
    sent = [await SP.send_schedule_email(db, name, monday, sh) for name, sh in by_person.items()]
    await db.execute(text("UPDATE staff_weeks SET emails_sent_at = NOW() WHERE week_monday = :m"), {"m": monday})
    await db.commit()
    return {"status": "success", "week_monday": monday.isoformat(), "approved_by": _who(user), "sent": sent,
            "failed": [x["name"] for x in sent if not x["ok"]]}


@router.get("/shifts/week")
async def get_weekly_shifts(
    week_date: Optional[str] = Query(None, description="Fecha dentro de la semana YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_staff)
):
    """
    Matriz semanal de turnos (estilo 7shifts) con datos reales:
    - varias franjas por persona y día (turno partido),
    - conteo de personas, horas y costo por día calculados de los turnos guardados,
    - aviso por turno cuando queda fuera de la disponibilidad declarada.
    """
    await ensure_shift_tables(db)
    target = date.today()
    if week_date:
        try:
            target = datetime.strptime(week_date, "%Y-%m-%d").date()
        except ValueError:
            pass

    monday = local_monday(target)
    sunday = monday + timedelta(days=6)

    day_names_en = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    month_names_en = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    shift_res = await db.execute(text("""
        SELECT id, psychologist_name, shift_date, start_time, end_time, shift_type, is_published, max_interviews,
               notes, COALESCE(shift_flag, 'None') AS shift_flag
        FROM staff_shifts
        WHERE shift_date >= :mon AND shift_date <= :sun
        ORDER BY shift_date ASC, start_time ASC
    """), {"mon": monday, "sun": sunday})
    shifts_rows = shift_res.fetchall()

    to_res = await db.execute(text("""
        SELECT id, psychologist_name, start_date, end_date, reason, status
        FROM staff_time_off
        WHERE (start_date <= :sun AND end_date >= :mon)
          AND UPPER(COALESCE(status, 'APPROVED')) IN ('APPROVED', 'PENDING')
    """), {"mon": monday, "sun": sunday})
    time_off_rows = to_res.fetchall()

    team_res = await db.execute(text("""
        SELECT id, name, slug, role, department, hourly_rate, avatar, is_active, weekly_hours
        FROM staff_team
        ORDER BY id ASC
    """))
    team_rows = team_res.fetchall()
    team_by_lower = {t.name.lower(): t for t in team_rows}
    availability = await load_availability(db)

    no_costs = hides_costs(user)

    def rate_of(name: str) -> float:
        if no_costs:
            return 0.0
        t = team_by_lower.get(name.lower())
        return float(t.hourly_rate) if t and t.hourly_rate else 0.0

    def hours_of(sh) -> float:
        s_h = sh.start_time.hour + sh.start_time.minute / 60.0
        e_h = sh.end_time.hour + sh.end_time.minute / 60.0
        return max(0.0, e_h - s_h)

    # Totales reales por día (solo personas que aparecen en la matriz)
    day_hours: Dict[str, float] = {}
    day_cost: Dict[str, float] = {}
    day_people: Dict[str, set] = {}
    for sh in shifts_rows:
        nm = ROSTER_BY_LOWER.get(sh.psychologist_name.lower())
        if not nm:
            continue
        d_str = str(sh.shift_date)
        dur = hours_of(sh)
        day_hours[d_str] = day_hours.get(d_str, 0.0) + dur
        day_cost[d_str] = day_cost.get(d_str, 0.0) + dur * rate_of(nm)
        day_people.setdefault(d_str, set()).add(nm)

    week_columns = []
    for i in range(7):
        d = monday + timedelta(days=i)
        d_str = d.strftime("%Y-%m-%d")
        m_name = month_names_en[d.month - 1]
        week_columns.append({
            "date": d_str,
            "day_short": day_names_en[i],
            "day_label": f"{day_names_en[i]} {m_name} {d.day}",
            "day_number": d.day,
            "month_name": m_name,
            "is_today": d == date.today(),
            "scheduled_count": len(day_people.get(d_str, set())),
            "budget_hours": round(day_hours.get(d_str, 0.0), 1),
            "budget_labor": round(day_cost.get(d_str, 0.0), 2)
        })

    total_week_hours = 0.0
    total_week_cost = 0.0
    departments_output = []

    for dept in DEPARTMENT_DEFS:
        dept_obj = {"name": dept["name"], "bg_header": dept["bg_header"], "roles": []}

        for r_def in dept["roles"]:
            role_obj = {
                "role_name": r_def["role_name"],
                "color": r_def["color"],
                "code": r_def["code"],
                "allow_add": r_def.get("allow_add", False),
                "employees": []
            }

            for e_name in r_def["employee_names"]:
                t_info = team_by_lower.get(e_name.lower())
                rate = rate_of(e_name)
                avatar = t_info.avatar if t_info and t_info.avatar else ""

                p_shifts = [s for s in shifts_rows if s.psychologist_name.lower() == e_name.lower()]
                p_time_offs = [to for to in time_off_rows if to.psychologist_name.lower() == e_name.lower()]

                total_emp_hours = 0.0
                interview_hours = 0.0
                matches_hours = 0.0
                days_map = {}

                for col in week_columns:
                    d_str = col["date"]
                    cur_d = datetime.strptime(d_str, "%Y-%m-%d").date()

                    day_shifts = [s for s in p_shifts if str(s.shift_date) == d_str]
                    t_off = next((to for to in p_time_offs if to.start_date <= cur_d <= to.end_date), None)
                    av = availability.get((e_name.lower(), cur_d.weekday()))

                    shifts_data = []
                    corner_flag = None
                    for sh in day_shifts:
                        duration = hours_of(sh)
                        total_emp_hours += duration
                        if sh.shift_type == "MATCHMAKING":
                            matches_hours += duration
                        else:
                            interview_hours += duration

                        time_label = f"{fmt_12_short(sh.start_time)} - {fmt_12_short(sh.end_time)}"
                        code = "c" if dept["name"] == "Customer Service" else ("m" if sh.shift_type == "MATCHMAKING" else "i")
                        if sh.shift_flag in ("red", "yellow") and not corner_flag:
                            corner_flag = sh.shift_flag

                        shifts_data.append({
                            "id": sh.id,
                            "time_label": time_label,
                            "code": code,
                            "start_time": sh.start_time.strftime("%H:%M"),
                            "end_time": sh.end_time.strftime("%H:%M"),
                            "hours": round(duration, 1),
                            "shift_type": sh.shift_type,
                            "is_published": sh.is_published,
                            "is_lightning": "⚡" in (sh.notes or ""),
                            "shift_flag": sh.shift_flag,
                            "outside_availability": outside_availability(av, sh.start_time, sh.end_time),
                            "notes": sh.notes or ""
                        })

                    to_badge = None
                    if t_off:
                        st = (t_off.status or "APPROVED").upper()
                        to_badge = "TIME OFF" if st == "APPROVED" else ("PENDING TIME OFF" if st == "PENDING" else None)

                    days_map[d_str] = {
                        "date": d_str,
                        "has_shifts": len(shifts_data) > 0,
                        "is_split": len(shifts_data) > 1,
                        "day_hours": round(sum(x["hours"] for x in shifts_data), 1),
                        "shifts": shifts_data,
                        "time_off_badge": to_badge,
                        "corner_flag": corner_flag,
                        "overtime_note": None,
                        "is_available_hover": False
                    }

                emp_cost = round(total_emp_hours * rate, 2)
                total_week_hours += total_emp_hours
                total_week_cost += emp_cost

                role_obj["employees"].append({
                    "name": e_name,
                    "role": r_def["role_name"],
                    "avatar": avatar,
                    "hourly_rate": rate,
                    "total_hours": round(total_emp_hours, 2),
                    "interview_hours": round(interview_hours, 2),
                    "matches_hours": round(matches_hours, 2),
                    "weekly_hours": float(t_info.weekly_hours) if t_info and t_info.weekly_hours is not None else None,
                    "is_active": bool(t_info.is_active) if t_info else True,
                    "total_cost": emp_cost,
                    "total_ot_badge": None,
                    "days": days_map
                })

            dept_obj["roles"].append(role_obj)

        departments_output.append(dept_obj)

    return {
        "company_name": "Daily Lover",
        "company_id": 408848,
        "week_monday": monday.strftime("%Y-%m-%d"),
        "week_sunday": sunday.strftime("%Y-%m-%d"),
        "week_label": f"Mon {month_names_en[monday.month-1]} {monday.day} - Sun {month_names_en[sunday.month-1]} {sunday.day}, {sunday.year}",
        "week_columns": week_columns,
        "kpis": {
            "total_scheduled_hours": round(total_week_hours, 1),
            "total_labor_cost": round(total_week_cost, 2),
            "total_employees": len(STAFF_ROSTER)
        },
        "budget_totals": {
            "weekly_hours": round(total_week_hours, 1),
            "weekly_cost": round(total_week_cost, 2),
            "days": [
                {"day": c["day_short"], "hours": c["budget_hours"], "cost": c["budget_labor"]} for c in week_columns
            ]
        },
        "departments": departments_output
    }



# ==============================================================================
# SUB-MÓDULO 7SHIFTS: TIME-OFF (SOLICITUDES REALES)
# ==============================================================================

def _fmt_day(d: date) -> str:
    return d.strftime("%b %d, %Y")


@router.get("/shifts/time-off/requests")
async def get_time_off_requests(db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """Permisos / bloqueos de la gente del equipo (pendientes, aprobados, rechazados)."""
    await ensure_shift_tables(db)
    res = await db.execute(text("""
        SELECT id, psychologist_name, start_date, end_date, reason, status, created_at
        FROM staff_time_off
        ORDER BY start_date DESC, id DESC
        LIMIT 300
    """))
    rows = res.fetchall()
    team_res = await db.execute(text("SELECT name, avatar FROM staff_team"))
    avatars = {t.name.lower(): t.avatar for t in team_res.fetchall()}
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo("America/Bogota")
    except Exception:
        tz = None

    year = date.today().year
    ytd: Dict[str, int] = {}
    for r in rows:
        if (r.status or "APPROVED").upper() == "APPROVED" and r.start_date.year == year:
            k = r.psychologist_name.lower()
            ytd[k] = ytd.get(k, 0) + ((r.end_date - r.start_date).days + 1)

    out = []
    for r in rows:
        when = _fmt_day(r.start_date) if r.start_date == r.end_date else f"{_fmt_day(r.start_date)} - {_fmt_day(r.end_date)}"
        st = (r.status or "APPROVED").upper()
        ca = r.created_at
        if ca and tz and ca.tzinfo:
            ca = ca.astimezone(tz)
        out.append({
            "id": r.id,
            "employee_name": ROSTER_BY_LOWER.get(r.psychologist_name.lower(), r.psychologist_name),
            "avatar": avatars.get(r.psychologist_name.lower()) or "",
            "date_submitted": ca.strftime("%b %d, %Y") if ca else "—",
            "approved_ytd": f"{ytd.get(r.psychologist_name.lower(), 0)} días",
            "time_off_requested": when,
            "reason": r.reason or "",
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat(),
            "status": {"APPROVED": "Approved", "PENDING": "Pending", "DENIED": "Denied"}.get(st, "Pending")
        })
    return {"requests": out, "can_decide": not hides_costs(user)}


# ==============================================================================
# SUB-MÓDULO 7SHIFTS: DISPONIBILIDAD SEMANAL (VARIAS FRANJAS POR DÍA)
# ==============================================================================

def _availability_cell(entry: Optional[dict]) -> dict:
    if not entry:
        return {"mode": "UNSET", "state": "undefined", "text": "Sin definir", "ranges": []}
    if entry["mode"] == "ALL_DAY":
        return {"mode": "ALL_DAY", "state": "available", "text": "Todo el día", "ranges": []}
    if entry["mode"] == "UNAVAILABLE":
        return {"mode": "UNAVAILABLE", "state": "unavailable", "text": "No disponible", "ranges": []}
    ranges = [
        {"start_time": s.strftime("%H:%M"), "end_time": e.strftime("%H:%M"), "label": f"{fmt_12(s)} – {fmt_12(e)}"}
        for s, e in entry["ranges"]
    ]
    if not ranges:
        return {"mode": "UNSET", "state": "undefined", "text": "Sin definir", "ranges": []}
    return {"mode": "RANGES", "state": "hours", "text": " · ".join(r["label"] for r in ranges), "ranges": ranges}


@router.get("/shifts/availability/requests", dependencies=[Depends(require_staff)])
async def get_availability_requests(db: AsyncSession = Depends(get_db)):
    """Personas con disponibilidad semanal registrada y cuándo se actualizó por última vez."""
    await ensure_shift_tables(db)
    res = await db.execute(text("""
        SELECT employee_name, MAX(updated_at) AS last_update, COUNT(DISTINCT weekday) AS days_set
        FROM staff_availability
        GROUP BY employee_name
        ORDER BY MAX(updated_at) DESC
    """))
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo("America/Bogota")
    except Exception:
        tz = None
    out = []
    for i, r in enumerate(res.fetchall(), start=1):
        lu = r.last_update
        if lu and tz and lu.tzinfo:
            lu = lu.astimezone(tz)
        out.append({
            "id": i,
            "employee_name": ROSTER_BY_LOWER.get(r.employee_name.lower(), r.employee_name),
            "type_label": f"Disponibilidad semanal · {r.days_set} de 7 días definidos",
            "effective_dates": "Cada semana",
            "date_submitted": lu.strftime("%b %d, %Y, %I:%M %p") if lu else "—",
            "status": "Activa"
        })
    return {"requests": out}


@router.get("/shifts/availability/glance", dependencies=[Depends(require_staff)])
async def get_availability_glance(db: AsyncSession = Depends(get_db)):
    """Matriz semanal de disponibilidad: por persona y día, todo el día / no disponible / varias franjas."""
    await ensure_shift_tables(db)
    availability = await load_availability(db)
    team_res = await db.execute(text("SELECT name, avatar FROM staff_team"))
    avatars = {t.name.lower(): t.avatar for t in team_res.fetchall()}

    names = list(STAFF_ROSTER)
    for (lower_name, _wd) in availability.keys():
        canon = ROSTER_BY_LOWER.get(lower_name, lower_name)
        if canon not in names:
            names.append(canon)

    matrix = []
    for name in names:
        days = {}
        any_set = False
        for wd, key in enumerate(DAY_KEYS):
            cell = _availability_cell(availability.get((name.lower(), wd)))
            if cell["state"] != "undefined":
                any_set = True
            days[key] = cell
        matrix.append({
            "name": name,
            "type": "Recurring" if any_set else "Sin definir",
            "avatar": avatars.get(name.lower()) or "",
            "days": days
        })

    return {
        "columns": [{"key": k, "label": DAY_LABELS_ES[i]} for i, k in enumerate(DAY_KEYS)],
        "roster": STAFF_ROSTER,
        "glance_matrix": matrix
    }


@router.put("/shifts/availability")
async def save_availability(
    payload: AvailabilityRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_staff)
):
    """Reemplaza la disponibilidad semanal recurrente de una persona (cada día: sin definir, todo el día, no disponible o varias franjas)."""
    await ensure_shift_tables(db)
    name = canonical_name(payload.employee_name)
    if hides_costs(user):
        from app.routers.shift_changes_api import my_staff_name
        mine = await my_staff_name(db, user)
        if not mine or mine.lower() != name.lower():
            raise HTTPException(status_code=403, detail="Solo puedes cambiar tu propia disponibilidad.")

    to_insert = []  # (weekday, mode, start, end)
    for key, day in payload.days.items():
        if key not in DAY_KEYS:
            raise HTTPException(status_code=422, detail=f"Día inválido: {key}")
        mode = (day.mode or "UNSET").upper()
        if mode not in AVAIL_MODES:
            raise HTTPException(status_code=422, detail=f"Modo inválido para {key}: {day.mode}")
        wd = DAY_KEYS.index(key)
        if mode == "RANGES":
            rngs = normalize_ranges(day.ranges)
            if not rngs:
                raise HTTPException(status_code=422, detail=f"{DAY_LABELS_ES[wd]}: agrega al menos una franja o elige otra opción.")
            for s, e in rngs:
                to_insert.append((wd, "RANGES", s, e))
        elif mode in ("ALL_DAY", "UNAVAILABLE"):
            to_insert.append((wd, mode, None, None))

    try:
        await db.execute(text("DELETE FROM staff_availability WHERE LOWER(employee_name) = LOWER(:n)"), {"n": name})
        for wd, mode, s, e in to_insert:
            await db.execute(text("""
                INSERT INTO staff_availability (employee_name, weekday, mode, start_time, end_time, updated_by)
                VALUES (:n, :wd, :m, :s, :e, :u)
            """), {"n": name, "wd": wd, "m": mode, "s": s, "e": e, "u": str(user.get("email") or user.get("id"))})
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return {"status": "success", "employee_name": name, "rows": len(to_insert)}


# ==============================================================================
# SUB-MÓDULO 7SHIFTS: GUARDAR TURNOS (VARIAS FRANJAS POR DÍA)
# ==============================================================================

def _parse_dates(values: List[str], max_n: int = 31) -> List[date]:
    out: List[date] = []
    for v in values or []:
        try:
            d = datetime.strptime(v, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Fecha inválida: {v}")
        if d not in out:
            out.append(d)
    if not out:
        raise HTTPException(status_code=422, detail="Selecciona al menos un día.")
    if len(out) > max_n:
        raise HTTPException(status_code=422, detail=f"Máximo {max_n} días por guardado.")
    return out


@router.put("/shifts/day", dependencies=[Depends(require_staff)])
async def save_shift_day(payload: ShiftDayRequest, db: AsyncSession = Depends(get_db)):
    """
    Guarda los turnos de una persona en uno o varios días. Cada día queda con EXACTAMENTE las franjas enviadas
    (turno partido = varias franjas). Sin franjas se borra el día de esa persona.
    """
    await ensure_shift_tables(db)
    name = canonical_name(payload.psychologist_name)
    dates = _parse_dates(payload.dates)
    ranges = normalize_ranges(payload.ranges)
    stype = (payload.shift_type or "ENTREVISTAS").upper()
    if stype not in SHIFT_TYPES:
        stype = "ENTREVISTAS"
    flag = payload.shift_flag if payload.shift_flag in ("red", "yellow") else "None"
    notes = (payload.notes or "")[:250]
    published = True if payload.is_published is None else bool(payload.is_published)

    # Tipo por franja (Entrevistas / Matches); si una franja no lo trae, usa el del día.
    type_by_start = {}
    for r in payload.ranges:
        t = (r.shift_type or stype).upper()
        type_by_start[parse_time_strict(r.start_time)] = t if t in SHIFT_TYPES else stype
    interview_ranges = [(a, b) for a, b in ranges if type_by_start.get(a, stype) in INTERVIEW_TYPES]

    if not payload.force:
        orphans = []
        for d in dates:
            orphans += await orphaned_appointments(db, name, d, interview_ranges)
        if orphans:
            raise appointments_conflict(orphans)

    try:
        for d in dates:
            await db.execute(text("""
                DELETE FROM staff_shifts WHERE LOWER(psychologist_name) = LOWER(:p) AND shift_date = :d
            """), {"p": name, "d": d})
            for s, e in ranges:
                await db.execute(text("""
                    INSERT INTO staff_shifts (psychologist_name, shift_date, start_time, end_time, shift_type,
                                              is_published, max_interviews, notes, shift_flag)
                    VALUES (:p, :d, :s, :e, :t, :pub, 5, :notes, :flag)
                """), {"p": name, "d": d, "s": s, "e": e, "t": type_by_start.get(s, stype), "pub": published, "notes": notes, "flag": flag})
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return {
        "status": "success",
        "message": "Turnos guardados." if ranges else "Día borrado.",
        "days": len(dates),
        "ranges_per_day": len(ranges)
    }


async def orphaned_appointments(db: AsyncSession, name: str, d: date, ranges) -> list:
    """Entrevistas agendadas (futuras, no canceladas) de esa persona ese día que quedarían fuera de las franjas `ranges`."""
    if d < date.today():
        return []
    rows = (await db.execute(text("""
        SELECT id, time_slot, client_name FROM interview_appointments
        WHERE UPPER(psychologist_name) = UPPER(:p) AND DATE(appointment_date) = :d AND status != 'CANCELADA'
        ORDER BY time_slot
    """), {"p": name, "d": d})).fetchall()
    out = []
    for r in rows:
        try:
            t = datetime.strptime(str(r.time_slot).strip()[:5], "%H:%M").time()
        except ValueError:
            continue
        te = (datetime.combine(d, t) + timedelta(minutes=45)).time()
        if not any(s <= t and e >= te for s, e in ranges):
            out.append({"id": r.id, "date": d.isoformat(), "time": str(r.time_slot).strip()[:5], "client": r.client_name})
    return out


def appointments_conflict(orphans: list) -> HTTPException:
    lines = ", ".join(f"{o['date']} {o['time']} ({o['client'] or 'cliente'})" for o in orphans[:8])
    return HTTPException(status_code=409, detail={
        "code": "HAS_APPOINTMENTS",
        "message": f"Hay {len(orphans)} entrevista(s) agendada(s) que quedarían sin turno: {lines}.",
        "appointments": orphans,
    })


def parse_flexible_time(t_str: str) -> time:
    return parse_time_strict(t_str)


async def _overlapping_shift(db: AsyncSession, name: str, d: date, s: time, e: time, exclude_id: Optional[int]) -> bool:
    res = await db.execute(text("""
        SELECT 1 FROM staff_shifts
        WHERE LOWER(psychologist_name) = LOWER(:p) AND shift_date = :d
          AND start_time < :e AND end_time > :s
          AND (CAST(:ex AS INT) IS NULL OR id <> CAST(:ex AS INT))
        LIMIT 1
    """), {"p": name, "d": d, "s": s, "e": e, "ex": exclude_id})
    return res.fetchone() is not None


@router.post("/shifts", dependencies=[Depends(require_staff)])
async def create_or_update_shift(payload: ShiftCreateRequest, db: AsyncSession = Depends(get_db)):
    """
    Agrega UNA franja (o edita la franja con `id`). Ya no sobrescribe otros turnos del mismo día:
    para turno partido se llama varias veces (o se usa PUT /shifts/day con todas las franjas).
    """
    await ensure_shift_tables(db)
    name = canonical_name(payload.psychologist_name)
    s_time = parse_time_strict(payload.start_time)
    e_time = parse_time_strict(payload.end_time)
    if e_time <= s_time:
        raise HTTPException(status_code=422, detail="La hora de fin debe ser posterior a la de inicio.")

    target_dates = [payload.shift_date]
    for dt_str in (payload.apply_to_dates or []):
        try:
            parsed_d = datetime.strptime(dt_str, "%Y-%m-%d").date()
        except ValueError:
            continue
        if parsed_d not in target_dates:
            target_dates.append(parsed_d)

    stype = (payload.shift_type or "ENTREVISTAS").upper()
    if stype not in SHIFT_TYPES:
        stype = "ENTREVISTAS"
    flag = payload.shift_flag if payload.shift_flag in ("red", "yellow") else "None"
    pub = True if payload.is_published is None else bool(payload.is_published)
    params = {"st": s_time, "et": e_time, "stype": stype, "pub": pub, "max_i": payload.max_interviews or 5,
              "notes": (payload.notes or "")[:250], "flag": flag}

    final_shift_id = payload.id
    try:
        for t_date in target_dates:
            is_main = t_date == payload.shift_date
            exclude = payload.id if (payload.id and is_main) else None
            if await _overlapping_shift(db, name, t_date, s_time, e_time, exclude):
                raise HTTPException(status_code=409, detail=f"{t_date}: ya hay un turno que se cruza con {fmt_12(s_time)}–{fmt_12(e_time)}.")
            if payload.id and is_main:
                await db.execute(text("""
                    UPDATE staff_shifts
                    SET start_time = :st, end_time = :et, shift_type = :stype, is_published = :pub,
                        max_interviews = :max_i, notes = :notes, shift_flag = :flag, updated_at = NOW()
                    WHERE id = :id
                """), {**params, "id": payload.id})
            else:
                ins = await db.execute(text("""
                    INSERT INTO staff_shifts (psychologist_name, shift_date, start_time, end_time, shift_type,
                                              is_published, max_interviews, notes, shift_flag)
                    VALUES (:p, :d, :st, :et, :stype, :pub, :max_i, :notes, :flag) RETURNING id
                """), {**params, "p": name, "d": t_date})
                if is_main:
                    final_shift_id = ins.scalar()
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return {"status": "success", "message": "Turno guardado exitosamente.", "shift_id": final_shift_id}


@router.delete("/shifts/{shift_id}", dependencies=[Depends(require_staff)])
async def delete_shift(shift_id: int, force: bool = False, db: AsyncSession = Depends(get_db)):
    """Elimina una franja de staff_shifts. Avisa (409) si deja entrevistas agendadas sin turno, salvo force=true."""
    if not force:
        cur = (await db.execute(text("SELECT psychologist_name, shift_date FROM staff_shifts WHERE id = :id"), {"id": shift_id})).fetchone()
        if cur:
            rest = (await db.execute(text("""
                SELECT start_time, end_time FROM staff_shifts
                WHERE LOWER(psychologist_name) = LOWER(:p) AND shift_date = :d AND id <> :id
            """), {"p": cur[0], "d": cur[1], "id": shift_id})).fetchall()
            orphans = await orphaned_appointments(db, cur[0], cur[1], [(r[0], r[1]) for r in rest])
            if orphans:
                raise appointments_conflict(orphans)
    await db.execute(text("DELETE FROM staff_shifts WHERE id = :id"), {"id": shift_id})
    await db.commit()
    return {"status": "success", "message": f"Turno {shift_id} eliminado exitosamente."}


@router.post("/shifts/copy-week", dependencies=[Depends(require_staff)])
async def copy_week(payload: CopyWeekRequest, db: AsyncSession = Depends(get_db)):
    """Copia los turnos (con todas sus franjas) de una semana a otra. No toca los días de la semana destino que ya tienen turnos."""
    await ensure_shift_tables(db)
    src = local_monday(payload.from_monday)
    dst = local_monday(payload.to_monday)
    if src == dst:
        raise HTTPException(status_code=422, detail="La semana de origen y la de destino son la misma.")
    delta = dst - src

    rows = (await db.execute(text("""
        SELECT psychologist_name, shift_date, start_time, end_time, shift_type, is_published, max_interviews, notes,
               COALESCE(shift_flag, 'None') AS shift_flag
        FROM staff_shifts WHERE shift_date >= :a AND shift_date <= :b
        ORDER BY shift_date, start_time
    """), {"a": src, "b": src + timedelta(days=6)})).fetchall()
    existing = (await db.execute(text("""
        SELECT LOWER(psychologist_name) AS p, shift_date FROM staff_shifts WHERE shift_date >= :a AND shift_date <= :b
    """), {"a": dst, "b": dst + timedelta(days=6)})).fetchall()
    busy = {(r.p, r.shift_date) for r in existing}

    copied = 0
    skipped_days = set()
    try:
        for r in rows:
            new_date = r.shift_date + delta
            if (r.psychologist_name.lower(), new_date) in busy:
                skipped_days.add((r.psychologist_name.lower(), new_date))
                continue
            await db.execute(text("""
                INSERT INTO staff_shifts (psychologist_name, shift_date, start_time, end_time, shift_type,
                                          is_published, max_interviews, notes, shift_flag)
                VALUES (:p, :d, :s, :e, :t, :pub, :mx, :n, :f)
            """), {"p": r.psychologist_name, "d": new_date, "s": r.start_time, "e": r.end_time, "t": r.shift_type,
                   "pub": r.is_published, "mx": r.max_interviews, "n": r.notes or "", "f": r.shift_flag})
            copied += 1
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return {"status": "success", "copied": copied, "skipped_days": len(skipped_days),
            "message": f"Se copiaron {copied} franjas. {len(skipped_days)} día(s) ya tenían turnos y no se tocaron."}


@router.post("/shifts/publish-week", dependencies=[Depends(require_admin)])
async def publish_week_schedule(
    payload: PublishWeekRequest,
    db: AsyncSession = Depends(get_db)
):
    """Pasa todos los turnos de la semana de modo Borrador a Publicado (sincronizando con Calendly)."""
    monday = payload.week_monday
    sunday = monday + timedelta(days=6)

    res = await db.execute(text("""
        UPDATE staff_shifts
        SET is_published = true, updated_at = NOW()
        WHERE shift_date >= :mon AND shift_date <= :sun
    """), {"mon": monday, "sun": sunday})
    await db.commit()

    return {"status": "success", "message": f"Horario publicado exitosamente. Los turnos ya están disponibles en el agendador de clientes."}



@router.post("/shifts/time-off")
async def request_time_off(
    payload: TimeOffRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_staff)
):
    """
    Pide un permiso (días completos). Si lo registra una psicóloga/matchmaker queda PENDIENTE hasta que María lo
    apruebe; si lo registra administración queda APROBADO. Solo los permisos aprobados bloquean el agendador de clientes.
    """
    await ensure_shift_tables(db)
    name = canonical_name(payload.psychologist_name)
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="La fecha final no puede ser anterior a la inicial.")
    if (payload.end_date - payload.start_date).days > 60:
        raise HTTPException(status_code=422, detail="Un permiso no puede durar más de 60 días; divídelo.")
    reason = (payload.reason or "").strip()[:250]

    dup = await db.execute(text("""
        SELECT 1 FROM staff_time_off
        WHERE LOWER(psychologist_name) = LOWER(:p) AND start_date <= :e AND end_date >= :s
          AND UPPER(COALESCE(status, 'APPROVED')) IN ('APPROVED', 'PENDING')
        LIMIT 1
    """), {"p": name, "s": payload.start_date, "e": payload.end_date})
    if dup.fetchone():
        raise HTTPException(status_code=409, detail="Esa persona ya tiene un permiso que se cruza con esas fechas.")

    status = "PENDING" if hides_costs(user) else "APPROVED"
    actor = str(user.get("email") or user.get("id"))
    ins = await db.execute(text("""
        INSERT INTO staff_time_off (psychologist_name, start_date, end_date, reason, status, requested_by, decided_by, decided_at)
        VALUES (:p, :s, :e, :r, :st, :rb, :db, CASE WHEN :ok THEN NOW() ELSE NULL END)
        RETURNING id
    """), {"p": name, "s": payload.start_date, "e": payload.end_date, "r": reason, "st": status,
           "rb": actor, "db": actor if status == "APPROVED" else None, "ok": status == "APPROVED"})
    new_id = ins.scalar()
    await db.commit()
    msg = "Permiso solicitado: queda pendiente de aprobación." if status == "PENDING" else "Permiso registrado y aprobado."
    return {"status": "success", "id": new_id, "time_off_status": status, "message": msg}


class TimeOffDecision(BaseModel):
    status: str  # APPROVED | DENIED | PENDING


@router.patch("/shifts/time-off/{time_off_id}")
async def decide_time_off(
    time_off_id: int,
    payload: TimeOffDecision,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_staff)
):
    """Aprobar o rechazar un permiso (solo administración)."""
    if hides_costs(user):
        raise HTTPException(status_code=403, detail="Solo administración puede aprobar o rechazar permisos.")
    st = (payload.status or "").upper()
    if st not in ("APPROVED", "DENIED", "PENDING"):
        raise HTTPException(status_code=422, detail="Estado inválido.")
    await ensure_shift_tables(db)
    res = await db.execute(text("""
        UPDATE staff_time_off SET status = :st, decided_by = :u, decided_at = NOW() WHERE id = :id RETURNING id
    """), {"st": st, "u": str(user.get("email") or user.get("id")), "id": time_off_id})
    if not res.fetchone():
        await db.rollback()
        raise HTTPException(status_code=404, detail="Permiso no encontrado.")
    await db.commit()
    return {"status": "success", "time_off_status": st}


@router.delete("/shifts/time-off/{time_off_id}")
async def delete_time_off(
    time_off_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_staff)
):
    """Elimina un permiso. Administración puede eliminar cualquiera; el equipo solo cancela los pendientes."""
    await ensure_shift_tables(db)
    row = (await db.execute(text("SELECT status FROM staff_time_off WHERE id = :id"), {"id": time_off_id})).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Permiso no encontrado.")
    if hides_costs(user) and (row.status or "APPROVED").upper() != "PENDING":
        raise HTTPException(status_code=403, detail="Solo puedes cancelar permisos pendientes. Pídele a administración el cambio.")
    await db.execute(text("DELETE FROM staff_time_off WHERE id = :id"), {"id": time_off_id})
    await db.commit()
    return {"status": "success"}


# ==============================================================================
# 2. MÓDULO CALENDLY: AGENDADOR PÚBLICO PARA CLIENTES
# ==============================================================================

class BookingReserveRequest(BaseModel):
    psychologist_name: Optional[str] = "AUTO"
    date: date
    time_slot: str # "09:00"
    client_name: str
    client_phone: str
    client_email: Optional[str] = ""
    client_city: Optional[str] = "Bogotá"
    intake_answers: Optional[Dict[str, Any]] = None

@router.get("/booking/psychologists")
async def get_booking_psychologists():
    """Retorna la lista de psicólogas disponibles para reserva pública."""
    return {"psychologists": list(PSYCHOLOGISTS_METADATA.values())}

@router.get("/booking/availability")
async def get_global_availability(
    db: AsyncSession = Depends(get_db)
):
    """
    Motor Calendly Unificado:
    El cliente NO escoge la psicóloga; solo escoge día y hora.
    El sistema unifica los turnos publicados de TODAS las psicólogas para los próximos 14 días.
    """
    today = date.today()
    max_date = today + timedelta(days=14)

    # 1. Turnos publicados de todas las psicólogas
    shift_res = await db.execute(text("""
        SELECT psychologist_name, shift_date, start_time, end_time, max_interviews
        FROM staff_shifts
        WHERE shift_date >= :t AND shift_date <= :md
          AND is_published = true
          AND shift_type IN ('ENTREVISTAS', 'DISPONIBLE')
        ORDER BY shift_date ASC, start_time ASC
    """), {"t": today, "md": max_date})
    shifts = shift_res.fetchall()

    # 2. Time-offs
    to_res = await db.execute(text("""
        SELECT UPPER(psychologist_name) as p, start_date, end_date
        FROM staff_time_off
        WHERE end_date >= :t AND start_date <= :md
          AND UPPER(COALESCE(status, 'APPROVED')) = 'APPROVED'
    """), {"t": today, "md": max_date})
    time_offs = to_res.fetchall()

    # 3. Citas ya agendadas
    appt_res = await db.execute(text("""
        SELECT UPPER(psychologist_name) as p, DATE(appointment_date) as d, time_slot
        FROM interview_appointments
        WHERE DATE(appointment_date) >= :t AND DATE(appointment_date) <= :md
          AND status != 'CANCELADA'
    """), {"t": today, "md": max_date})
    booked_slots = set((r.p, r.d.strftime("%Y-%m-%d"), r.time_slot.strip()[:5]) for r in appt_res.fetchall())

    available_days_set = set()
    slots_by_day = {}
    slot_psych_map = {}

    for s in shifts:
        p_name = s.psychologist_name.upper().strip()
        s_date = s.shift_date
        d_str = s_date.strftime("%Y-%m-%d")

        # Verificar si la psicóloga está en time-off
        if any(to.p == p_name and to.start_date <= s_date <= to.end_date for to in time_offs):
            continue

        current_time = datetime.combine(s_date, s.start_time)
        shift_end = datetime.combine(s_date, s.end_time)

        while current_time + timedelta(minutes=45) <= shift_end:
            slot_str = current_time.strftime("%H:%M")
            key = (p_name, d_str, slot_str)

            if key not in booked_slots:
                # Al menos 2 horas de anticipación si es hoy
                if s_date > today or (s_date == today and current_time > datetime.now() + timedelta(hours=2)):
                    if d_str not in slots_by_day:
                        slots_by_day[d_str] = set()
                    slots_by_day[d_str].add(slot_str)
                    available_days_set.add(d_str)

                    slot_key = f"{d_str}_{slot_str}"
                    if slot_key not in slot_psych_map:
                        slot_psych_map[slot_key] = p_name

            current_time += timedelta(minutes=60) # 45 min cita + 15 min buffer

    sorted_days = sorted(list(available_days_set))
    final_slots_by_day = {}
    for d in sorted_days:
        final_slots_by_day[d] = sorted(list(slots_by_day.get(d, [])))

    return {
        "session_duration_minutes": 45,
        "buffer_minutes": 15,
        "available_days": sorted_days,
        "slots_by_day": final_slots_by_day,
        "slot_psych_map": slot_psych_map
    }

@router.get("/booking/psychologist/{slug}/availability")
async def get_psychologist_availability(
    slug: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Motor Calendly:
    Retorna los próximos 14 días con franjas horarias disponibles de 45 minutos
    (con 15 min de buffer obligatorio entre sesiones) basados en turnos publicados.
    """
    p_name = next((k for k, v in PSYCHOLOGISTS_METADATA.items() if v["slug"].lower() == slug.lower()), None)
    if not p_name:
        trow = (await db.execute(text("SELECT UPPER(name) FROM staff_team WHERE LOWER(slug) = :s LIMIT 1"), {"s": slug.lower()})).fetchone()
        p_name = trow[0] if trow else None
    if not p_name:
        raise HTTPException(status_code=404, detail=f"Psicóloga con slug '{slug}' no encontrada.")

    meta = await person_meta(db, p_name)
    today = date.today()
    max_date = today + timedelta(days=14)

    # 1. Turnos publicados activos en los próximos 14 días
    shift_res = await db.execute(text("""
        SELECT shift_date, start_time, end_time, max_interviews
        FROM staff_shifts
        WHERE UPPER(psychologist_name) = :p
          AND shift_date >= :t AND shift_date <= :md
          AND is_published = true
          AND shift_type IN ('ENTREVISTAS', 'DISPONIBLE')
        ORDER BY shift_date ASC
    """), {"p": p_name, "t": today, "md": max_date})
    shifts = shift_res.fetchall()

    # 2. Bloqueos de time-off
    to_res = await db.execute(text("""
        SELECT start_date, end_date
        FROM staff_time_off
        WHERE UPPER(psychologist_name) = :p
          AND end_date >= :t AND start_date <= :md
          AND UPPER(COALESCE(status, 'APPROVED')) = 'APPROVED'
    """), {"p": p_name, "t": today, "md": max_date})
    time_offs = to_res.fetchall()

    # 3. Citas ya agendadas
    appt_res = await db.execute(text("""
        SELECT DATE(appointment_date) as d, time_slot
        FROM interview_appointments
        WHERE UPPER(psychologist_name) = :p
          AND DATE(appointment_date) >= :t AND DATE(appointment_date) <= :md
          AND status != 'CANCELADA'
    """), {"p": p_name, "t": today, "md": max_date})
    booked_slots = set((r.d.strftime("%Y-%m-%d"), r.time_slot.strip()[:5]) for r in appt_res.fetchall())

    available_days = []
    days_map = {}

    for s in shifts:
        s_date = s.shift_date
        d_str = s_date.strftime("%Y-%m-%d")

        # Verificar si está en time-off
        if any(to.start_date <= s_date <= to.end_date for to in time_offs):
            continue

        # Generar slots de 45 min + 15 min buffer (es decir, cada 60 min)
        current_time = datetime.combine(s_date, s.start_time)
        shift_end = datetime.combine(s_date, s.end_time)

        slots = []
        while current_time + timedelta(minutes=45) <= shift_end:
            slot_str = current_time.strftime("%H:%M")
            
            # Verificar si ya está reservado
            if (d_str, slot_str) not in booked_slots:
                # Aviso mínimo: al menos 2 horas en el futuro si es hoy
                if s_date > today or (s_date == today and current_time > datetime.now() + timedelta(hours=2)):
                    slots.append(slot_str)

            current_time += timedelta(minutes=60) # 45 min sesión + 15 min buffer

        if slots:
            available_days.append(d_str)
            days_map[d_str] = slots

    return {
        "psychologist": meta,
        "session_duration_minutes": 45,
        "buffer_minutes": 15,
        "available_days": available_days,
        "slots_by_day": days_map
    }


@router.post("/booking/reserve")
async def reserve_booking_slot(
    payload: BookingReserveRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Reserva formal de un espacio (estilo Calendly).
    1. Registra en interview_appointments con videocall_token.
    2. Genera confirmación, enlace y contenido .ics.
    """
    # Validaciones que la pantalla ya hace y la ruta debe repetir (es pública): hora válida, futura, dentro de 14 días
    try:
        t_start = datetime.strptime(payload.time_slot, "%H:%M").time()
    except ValueError:
        raise HTTPException(status_code=422, detail="Hora inválida.")
    start_dt = datetime.combine(payload.date, t_start)
    end_dt = start_dt + timedelta(minutes=45)
    from zoneinfo import ZoneInfo
    ahora = datetime.now(ZoneInfo("America/Bogota")).replace(tzinfo=None)   # los turnos se guardan en hora de Colombia
    if start_dt < ahora + timedelta(hours=2):
        raise HTTPException(status_code=422, detail="Ese horario ya no está disponible: se reserva con al menos 2 horas de anticipación.")
    if payload.date > ahora.date() + timedelta(days=14):
        raise HTTPException(status_code=422, detail="Solo se puede reservar dentro de los próximos 14 días.")
    # Un candado por día: dos reservas al mismo tiempo no pueden quedar en el mismo horario
    await db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": f"reserva|{payload.date}"})

    # Auto-asignación de psicóloga si no se especifica o viene 'AUTO'
    p_name = (payload.psychologist_name or "").upper().strip()
    if p_name and p_name != "AUTO":
        # psicóloga explícita: debe tener turno publicado de entrevistas que cubra el horario y sin permiso aprobado
        ok = (await db.execute(text("""
            SELECT 1 FROM staff_shifts
            WHERE shift_date = :d AND UPPER(psychologist_name) = :p AND start_time <= :t AND end_time >= :te
              AND is_published = true AND shift_type IN ('ENTREVISTAS', 'DISPONIBLE')
              AND NOT EXISTS (SELECT 1 FROM staff_time_off o WHERE UPPER(o.psychologist_name) = :p AND o.start_date <= :d AND o.end_date >= :d
                              AND UPPER(COALESCE(o.status, 'APPROVED')) = 'APPROVED')
            LIMIT 1
        """), {"d": payload.date, "p": p_name, "t": t_start, "te": end_dt.time()})).fetchone()
        if not ok:
            raise HTTPException(status_code=409, detail="Esa psicóloga no tiene turno de entrevistas en ese horario. Por favor selecciona otro.")
    if not p_name or p_name == "AUTO":
        t_end = end_dt.time()
        
        lookup = await db.execute(text("""
            SELECT psychologist_name
            FROM staff_shifts
            WHERE shift_date = :d
              AND start_time <= :t AND end_time >= :te
              AND is_published = true
              AND shift_type IN ('ENTREVISTAS', 'DISPONIBLE')
              AND UPPER(psychologist_name) NOT IN (
                  SELECT UPPER(psychologist_name) FROM staff_time_off
                  WHERE start_date <= :d AND end_date >= :d
                    AND UPPER(COALESCE(status, 'APPROVED')) = 'APPROVED'
              )
              AND UPPER(psychologist_name) NOT IN (
                  SELECT UPPER(psychologist_name) FROM interview_appointments
                  WHERE status != 'CANCELADA' AND appointment_date < :edt AND appointment_date + INTERVAL '45 minutes' > :sdt
              )
            ORDER BY id ASC
            LIMIT 1
        """), {"d": payload.date, "t": t_start, "te": t_end, "sdt": start_dt, "edt": end_dt})
        row = lookup.fetchone()
        if row:
            p_name = row[0].upper().strip()
        else:
            raise HTTPException(status_code=409, detail="No hay disponibilidad en ese horario. Por favor selecciona otro.")

    # Verificar si el slot específico de esa psicóloga sigue libre
    check = await db.execute(text("""
        SELECT id FROM interview_appointments
        WHERE UPPER(psychologist_name) = :p
          AND status != 'CANCELADA'
          AND appointment_date < :edt AND appointment_date + INTERVAL '45 minutes' > :sdt
    """), {"p": p_name, "sdt": start_dt, "edt": end_dt})
    if check.fetchone():
        raise HTTPException(status_code=409, detail="Este horario acaba de ser ocupado. Por favor selecciona otro.")

    token = f"dl-{uuid4().hex[:12]}"
    appt_dt = datetime.strptime(f"{payload.date} {payload.time_slot}", "%Y-%m-%d %H:%M")
    
    # Buscar si el usuario ya existe en users por teléfono o nombre
    u_res = await db.execute(text("""
        SELECT id FROM users 
        WHERE phone = :ph OR unaccent(lower(name)) = unaccent(lower(:n))
        LIMIT 1
    """), {"ph": payload.client_phone.strip(), "n": payload.client_name.strip()})
    u_row = u_res.fetchone()
    uid = u_row[0] if u_row else None

    # Si no existe, crear usuario preliminar
    if not uid:
        new_u = await db.execute(text("""
            INSERT INTO users (name, phone, email, created_at)
            VALUES (:n, :p, :e, NOW())
            RETURNING id
        """), {
            "n": payload.client_name.strip(),
            "p": payload.client_phone.strip(),
            "e": payload.client_email or ""
        })
        uid = new_u.scalar()
        
        # Perfil base
        await db.execute(text("""
            INSERT INTO profiles (user_id, city, responsable, updated_at)
            VALUES (:uid, :c, :resp, NOW())
        """), {
            "uid": uid,
            "c": payload.client_city or "Bogotá",
            "resp": f"MATCHES {p_name}"
        })

    # Guardar cita
    ins_res = await db.execute(text("""
        INSERT INTO interview_appointments (
            user_id, psychologist_name, appointment_date, time_slot, status,
            videocall_token, client_name, client_phone, client_email, client_city,
            intake_answers, created_at
        ) VALUES (
            :uid, :p, :dt, :ts, 'CONFIRMADA',
            :tok, :cn, :cp, :ce, :cc,
            :ia, NOW()
        ) RETURNING id
    """), {
        "uid": uid,
        "p": p_name,
        "dt": appt_dt,
        "ts": payload.time_slot,
        "tok": token,
        "cn": payload.client_name.strip(),
        "cp": payload.client_phone.strip(),
        "ce": payload.client_email or "",
        "cc": payload.client_city or "Bogotá",
        "ia": json.dumps(payload.intake_answers or {})
    })
    appt_id = ins_res.scalar()
    from app.routers.calls import ensure_call_for_appointment, APP_BASE_URL
    await ensure_call_for_appointment(db, appt_id)          # una sola videollamada por cita (la nueva)
    await db.commit()

    meta = await person_meta(db, p_name)
    videocall_url = f"{APP_BASE_URL}/admin/llamada/{token}"

    # Contenido de archivo .ICS (Google / Apple Calendar)
    ics_content = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Daily Lover//Matchmaking Calendar//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:{token}@dailylover.co
DTSTAMP:{datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")}
DTSTART:{appt_dt.strftime("%Y%m%dT%H%M%S")}
DTEND:{(appt_dt + timedelta(minutes=45)).strftime("%Y%m%dT%H%M%S")}
SUMMARY:Entrevista Clínica de Compatibilidad - Daily Lover ({meta['name']})
DESCRIPTION:Tu entrevista con {meta['name']} ({meta['role']}). Enlace directo de videollamada: {videocall_url}
LOCATION:{videocall_url}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR"""

    return {
        "status": "success",
        "appointment_id": appt_id,
        "videocall_token": token,
        "videocall_url": videocall_url,
        "client_name": payload.client_name,
        "psychologist": meta,
        "date": payload.date.strftime("%Y-%m-%d"),
        "time_slot": payload.time_slot,
        "ics_data": ics_content,
        "whatsapp_preview": f"¡Hola {payload.client_name}! Tu entrevista clínica de compatibilidad con {meta['name']} ha sido confirmada para el {payload.date.strftime('%d/%m/%Y')} a las {payload.time_slot}. Puedes unirte directamente en este enlace: {videocall_url}"
    }


# ==============================================================================
# 3. SALA DE VIDEOLLAMADA EMBEBIDA & COPILOTO CLÍNICO IA
# ==============================================================================

class CompleteCallRequest(BaseModel):
    transcript_text: str
    duration_seconds: Optional[int] = 2700
    psychologist_observations: Optional[str] = ""

INJECT_DEMO_ANALYSIS = False


@router.get("/videocall/session/{token_or_id}")
async def get_videocall_session(
    token_or_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """
    Retorna el expediente clínico del cliente y el estado de la sesión de videollamada.
    """
    # Buscar por token o por ID
    if token_or_id.isdigit():
        res = await db.execute(text("SELECT * FROM interview_appointments WHERE id = :x"), {"x": int(token_or_id)})
    else:
        res = await db.execute(text("SELECT * FROM interview_appointments WHERE videocall_token = :x"), {"x": token_or_id})
    appt = res.fetchone()

    if not appt:
        # Fallback de prueba para simulación
        return {
            "session_id": 999,
            "token": token_or_id,
            "client_name": "Samuel Moreno Díaz",
            "psychologist_name": "ANA",
            "appointment_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "status": "EN_VIVO",
            "client": {
                "user_id": 7810,
                "name": "Samuel Moreno Díaz",
                "age": 31,
                "city": "Bogotá",
                "occupation": "Arquitecto & Diseñador",
                "plan_tier": "Estándar 65k (2 citas)",
                "intake_notes": "Quiere soltar el rol masculino de control. Busca mujer con vida propia, no tacaña. Fundamental que le gusten los perros.",
                "dealbreakers": ["No fumadores", "Gusto por perros (innegociable)", "Edad: 24 a 30 años", "Bogotá"]
            }
        }

    d = dict(appt._mapping)
    uid = d.get("user_id")

    client_data = {
        "user_id": uid,
        "name": d.get("client_name") or "Cliente",
        "city": d.get("client_city") or "Bogotá",
        "phone": d.get("client_phone") or "",
        "email": d.get("client_email") or "",
        "intake_answers": d.get("intake_answers") or {},
        "bio_notes": "",
        "extended": None
    }

    if uid:
        prof_res = await db.execute(text("SELECT * FROM profiles WHERE user_id = :uid LIMIT 1"), {"uid": uid})
        prof = prof_res.fetchone()
        if prof:
            p_dict = dict(prof._mapping)
            client_data["age"] = p_dict.get("age") or 30
            client_data["occupation"] = p_dict.get("occupation") or "Profesional"
            client_data["plan_tier"] = p_dict.get("plan_tier") or "Estándar"
            client_data["bio_notes"] = p_dict.get("bio_notes") or ""

        ext_res = await db.execute(text("SELECT * FROM client_extended_profile WHERE user_id = :uid LIMIT 1"), {"uid": uid})
        ext = ext_res.fetchone()
        if ext:
            client_data["extended"] = dict(ext._mapping)

    return {
        "session_id": d.get("id"),
        "token": d.get("videocall_token"),
        "client_name": d.get("client_name"),
        "psychologist_name": d.get("psychologist_name"),
        "appointment_date": d.get("appointment_date").strftime("%Y-%m-%d %H:%M") if d.get("appointment_date") else "",
        "status": d.get("status") or "CONFIRMADA",
        "transcript_text": d.get("transcript_text") or "",
        "quick_notes_ai": d.get("quick_notes_ai") or "",
        "dealbreakers_ai": d.get("dealbreakers_ai") or {},
        "client": client_data
    }


@router.post("/videocall/{session_id}/complete-and-analyze")
async def complete_and_analyze_session(
    session_id: int,
    payload: CompleteCallRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """
    COPILOTO CLÍNICO IA:
    Toma la conversación (transcripción) de la videollamada y:
    1. Extrae dealbreakers innegociables (Hijos, Religión, Política, Mascotas, Ingresos, Hábitos).
    2. Identifica dinámica relacional y estilo de apego.
    3. Redacta las 'Quick Notes' clínicas profesionales.
    4. Inyecta todo en el perfil del cliente en base de datos.
    """
    # Obtener cita
    res = await db.execute(text("SELECT * FROM interview_appointments WHERE id = :id"), {"id": session_id})
    appt = res.fetchone()
    if not appt:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")

    appt_dict = dict(appt._mapping)
    uid = appt_dict.get("user_id")
    client_name = appt_dict.get("client_name") or "Cliente"
    psyc = appt_dict.get("psychologist_name") or "Psicóloga"

    text_to_analyze = payload.transcript_text or payload.psychologist_observations or "Entrevista clínica regular."

    # Parser e Inteligencia Clínica de Extracción
    # 1. Extracción de Dealbreakers
    t_lower = text_to_analyze.lower()

    # Perros / Mascotas
    likes_dogs = any(w in t_lower for w in ["perro", "perros", "mascotas", "canino", "alergia"])
    # Hijos
    wants_kids = "no hijos" not in t_lower and "sin hijos" not in t_lower and any(w in t_lower for w in ["hijos", "familia", "ser papá", "ser mamá"])
    # Cigarrillo / Vape
    smokes = any(w in t_lower for w in ["fuma", "cigarrillo", "vape", "fumador"])
    # Dinámica relacional
    independent = any(w in t_lower for w in ["vida propia", "independiente", "hobbies", "tiempo de calidad", "trabajo"])
    control_role = any(w in t_lower for w in ["rol", "proveedor", "control", "soltar", "hombre de la relación"])

    dealbreakers = {
        "mascotas": "Ama y convive con perros (Innegociable)" if likes_dogs else "Flexible con mascotas",
        "hijos": "Desea formar familia / hijos a futuro" if wants_kids else "No desea hijos o prefiere sin hijos por ahora",
        "fumador": "No tolera cigarrillo / humo" if not smokes else "Fumador social o tolerante",
        "edad_rango": "24 a 32 años",
        "politica": "Centro / Moderado - No extremismos",
        "religion": "Valores espirituales / Flexible"
    }

    # 2. Análisis Dinámico
    apego = "Apego Seguro" if independent and not control_role else "Apego con Tendencia a la Sobre-responsabilidad"
    dinamica = "Busca reciprocidad emocional y una pareja con proyecto de vida propio. Desea soltar el rol de hiper-control o proveedor único y disfrutar de complicidad sana y viajes."

    # 3. Quick Notes Generadas
    quick_notes = f"""[SÍNTESIS CLÍNICA - ENTREVISTA CON PSIC. {psyc.upper()}]
{client_name} se presenta con excelente presencia y articulación verbal clara. Demuestra una madurez emocional desarrollada y conciencia sobre los patrones de sus vínculos anteriores. 

DINÁMICA DE PAREJA: Valora el equilibrio entre el espacio individual y el tiempo de calidad compartido. Expresa con énfasis que no desea asumir roles tradicionales de sobre-control o proveedor unilateral; busca una mujer con ambición propia, buen sentido del humor y disposición a viajar.

INNEGOCIABLES & DEALBREAKERS: Conexión mandatoria con el amor hacia los animales (perros). Cero tolerancia a actitudes de tacañería emocional o económica. Apertura religiosa flexible pero con principios familiares sólidos."""

    # Actualizar interview_appointments
    await db.execute(text("""
        UPDATE interview_appointments
        SET status = 'COMPLETADA',
            transcript_text = :tr,
            quick_notes_ai = :qn,
            dealbreakers_ai = :db,
            duration_seconds = :dur,
            notes = :obs
        WHERE id = :id
    """), {
        "tr": payload.transcript_text,
        "qn": "",                      # no se guardan notas ni "innegociables" inventados por palabras clave
        "db": json.dumps({}),
        "dur": payload.duration_seconds or 2700,
        "obs": payload.psychologist_observations or "",
        "id": session_id
    })

    # Si hay usuario vinculado, inyectar directamente en profiles y client_extended_profile.
    # DESACTIVADO (30-sep-2026): este "análisis" son palabras clave con texto enlatado y puntajes fijos, no IA real;
    # escribirlo en el perfil del cliente inventa datos. Se reemplaza por la extracción con evidencia y revisión humana.
    if uid and INJECT_DEMO_ANALYSIS:
        await db.execute(text("""
            UPDATE profiles
            SET bio_notes = :qn,
                search_preferences = :sp,
                updated_at = NOW()
            WHERE user_id = :uid
        """), {
            "qn": quick_notes,
            "sp": json.dumps(dealbreakers),
            "uid": uid
        })

        # Extended profile
        await db.execute(text("""
            INSERT INTO client_extended_profile (
                user_id, traditionalism_level, self_awareness, non_negotiables,
                synthesis_who_really_is, synthesis_first_date_behavior, synthesis_best_match_type, updated_at, updated_by
            ) VALUES (
                :uid, 5, 8, :nn,
                :sw, :sfd, :sbm, NOW(), :psyc
            )
            ON CONFLICT (user_id) DO UPDATE SET
                non_negotiables = EXCLUDED.non_negotiables,
                synthesis_who_really_is = EXCLUDED.synthesis_who_really_is,
                synthesis_first_date_behavior = EXCLUDED.synthesis_first_date_behavior,
                synthesis_best_match_type = EXCLUDED.synthesis_best_match_type,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by;
        """), {
            "uid": uid,
            "nn": json.dumps(dealbreakers),
            "sw": f"{client_name}: Profesional estructurado, apego seguro, valora reciprocidad.",
            "sfd": "Conversador natural, generoso, atento al lenguaje corporal.",
            "sbm": "Mujer independiente, alegre, afín a planes culturales y perros.",
            "psyc": psyc
        })

    await db.commit()

    return {
        "status": "success",
        "message": "Entrevista cerrada. El perfil del cliente se actualiza con las propuestas de la llamada que la psicóloga revisa y aprueba (Videollamadas), no con un resumen automático.",
        "quick_notes_ai": "",
        "dealbreakers_ai": {},
        "dinamica": "",
        "apego": "",
        "client_name": client_name,
        "user_id": uid
    }


@router.get("/scheduling/appointments", dependencies=[Depends(exigir_sesion)])
async def list_interview_appointments(
    status: Optional[str] = Query(None),
    psychologist: Optional[str] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna la lista de citas de entrevista clínica agendadas (interview_appointments),
    con información del cliente, psicóloga asignada, token de videollamada y estado clínico.
    """
    conditions = ["1=1"]
    params = {"lim": limit}
    
    if status:
        conditions.append("ia.status ILIKE :status")
        params["status"] = f"%{status}%"
        
    if psychologist:
        conditions.append("UPPER(ia.psychologist_name) = UPPER(:psyc)")
        params["psyc"] = psychologist
        
    where_clause = " AND ".join(conditions)
    
    query = text(f"""
        SELECT ia.id, ia.user_id, ia.client_name, ia.psychologist_name, ia.appointment_date,
               ia.time_slot, ia.status, ia.videocall_token, ia.client_phone, ia.client_city,
               ia.intake_answers, ia.quick_notes_ai,
               EXISTS(SELECT 1 FROM client_extended_profile cep WHERE cep.user_id = ia.user_id) as has_extended
        FROM interview_appointments ia
        WHERE {where_clause}
        ORDER BY ia.appointment_date ASC, ia.id DESC
        LIMIT :lim
    """)
    
    res = await db.execute(query, params)
    rows = res.fetchall()
    
    appts = []
    for r in rows:
        m = dict(r._mapping)
        appts.append({
            "id": m["id"],
            "user_id": m["user_id"],
            "client_name": m["client_name"],
            "psychologist_name": m["psychologist_name"],
            "appointment_date": m["appointment_date"].strftime("%Y-%m-%d %H:%M") if m.get("appointment_date") else "",
            "date": m["appointment_date"].strftime("%Y-%m-%d") if m.get("appointment_date") else "",
            "time_slot": m.get("time_slot") or "",
            "status": m.get("status") or "CONFIRMADA",
            "videocall_token": m.get("videocall_token") or "",
            "client_phone": m.get("client_phone") or "",
            "client_city": m.get("client_city") or "Bogotá",
            "has_extended": bool(m.get("has_extended")),
            "quick_notes_ai": m.get("quick_notes_ai") or ""
        })
        
    return {"appointments": appts, "total": len(appts)}


# ─── MÓDULO 6: CS AUTOMATED METRICS (LINA & CUSTOMER SERVICE) ─────────────────

def classify_cs_city(raw_city: Optional[str]) -> str:
    """Clasifica la ciudad para las métricas de servicio al cliente con agrupación de Eje Cafetero."""
    if not raw_city:
        return "Bogotá"
    c = raw_city.lower().strip()
    if any(k in c for k in ["bogot", "chía", "chia", "cajic", "soacha", "zipaquir"]):
        return "Bogotá"
    if any(k in c for k in ["medell", "envigado", "sabaneta", "itagui", "itaguí", "bello"]):
        return "Medellín"
    if "cali" in c:
        return "Cali"
    if any(k in c for k in ["miami", "florida", "hollywood"]):
        return "Miami"
    if any(k in c for k in ["pereira", "manizales", "armenia", "dosquebradas"]):
        return "Eje Cafetero"
    return "Otras"


@router.get("/scheduling/cs-daily-metrics", dependencies=[Depends(exigir_sesion)])
async def get_cs_daily_metrics(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    city: Optional[str] = Query(None),
    days: Optional[int] = Query(None, description="Últimos N días"),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna métricas automatizadas de Customer Service (CS):
    - Citas agendadas y citas reprogramadas por fecha y ciudad.
    - Reservas de restaurantes confirmadas y distribución por ciudad.
    - Tasa de reprogramación y métricas de soporte operacional para Lina.
    """
    if hasattr(start_date, 'default'):
        start_date = start_date.default
    if hasattr(end_date, 'default'):
        end_date = end_date.default
    if hasattr(city, 'default'):
        city = city.default
    if hasattr(days, 'default'):
        days = days.default

    if days and not start_date:
        start_date = (date.today() - timedelta(days=days)).strftime("%Y-%m-%d")

    where_parts = []
    params = {}

    if start_date and isinstance(start_date, str) and start_date.strip():
        where_parts.append("sd.created_at >= :start_date")
        params["start_date"] = datetime.strptime(start_date.strip()[:10], "%Y-%m-%d").replace(hour=0, minute=0, second=0)
    elif isinstance(start_date, (datetime, date)):
        where_parts.append("sd.created_at >= :start_date")
        params["start_date"] = start_date

    if end_date and isinstance(end_date, str) and end_date.strip():
        where_parts.append("sd.created_at <= :end_date")
        params["end_date"] = datetime.strptime(end_date.strip()[:10], "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    elif isinstance(end_date, (datetime, date)):
        where_parts.append("sd.created_at <= :end_date")
        params["end_date"] = end_date

    where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

    # 1. Agrupación por día y ciudad
    query = f"""
        SELECT 
            TO_CHAR(sd.created_at, 'YYYY-MM-DD') as date_str,
            sd.city as raw_city,
            count(*) as total_scheduled,
            count(*) FILTER (WHERE sd.reschedule = true) as total_rescheduled,
            count(*) FILTER (WHERE sd.reservation_confirmed = true) as total_reservations
        FROM scheduled_dates sd
        {where_sql}
        GROUP BY date_str, raw_city
        ORDER BY date_str DESC, raw_city ASC
    """
    rows = (await db.execute(text(query), params)).mappings().all()

    # Consolidar por día
    daily_map = {}
    city_totals = {"Bogotá": 0, "Medellín": 0, "Cali": 0, "Miami": 0, "Eje Cafetero": 0, "Otras": 0}
    reservations_by_city = {"Bogotá": 0, "Medellín": 0, "Cali": 0, "Miami": 0, "Eje Cafetero": 0, "Otras": 0}
    total_dates = 0
    total_rescheduled = 0
    total_reservations = 0

    for r in rows:
        d_str = r["date_str"] or "Sin fecha"
        c_bucket = classify_cs_city(r["raw_city"])
        sched = int(r["total_scheduled"] or 0)
        resched = int(r["total_rescheduled"] or 0)
        resv = int(r["total_reservations"] or 0)

        total_dates += sched
        total_rescheduled += resched
        total_reservations += resv

        city_totals[c_bucket] = city_totals.get(c_bucket, 0) + sched
        reservations_by_city[c_bucket] = reservations_by_city.get(c_bucket, 0) + resv

        if d_str not in daily_map:
            daily_map[d_str] = {
                "date": d_str,
                "total_scheduled": 0,
                "total_rescheduled": 0,
                "total_reservations": 0,
                "by_city": {"Bogotá": 0, "Medellín": 0, "Cali": 0, "Miami": 0, "Eje Cafetero": 0, "Otras": 0},
                "reservations_by_city": {"Bogotá": 0, "Medellín": 0, "Cali": 0, "Miami": 0, "Eje Cafetero": 0, "Otras": 0}
            }

        daily_map[d_str]["total_scheduled"] += sched
        daily_map[d_str]["total_rescheduled"] += resched
        daily_map[d_str]["total_reservations"] += resv
        daily_map[d_str]["by_city"][c_bucket] = daily_map[d_str]["by_city"].get(c_bucket, 0) + sched
        daily_map[d_str]["reservations_by_city"][c_bucket] = daily_map[d_str]["reservations_by_city"].get(c_bucket, 0) + resv

    days_list = list(daily_map.values())
    reschedule_rate = round(total_rescheduled / total_dates * 100.0, 1) if total_dates > 0 else 0.0

    return {
        "summary": {
            "total_scheduled_dates": total_dates,
            "total_rescheduled": total_rescheduled,
            "reschedule_rate_pct": reschedule_rate,
            "total_confirmed_reservations": total_reservations,
            "scheduled_by_city": city_totals,
            "reservations_by_city": reservations_by_city
        },
        "daily_breakdown": days_list,
        "total_days": len(days_list)
    }


# ==============================================================================
# CANCELAR Y REAGENDAR ENTREVISTAS (equipo y cliente con su enlace)
# ==============================================================================

def _ahora_col() -> datetime:
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("America/Bogota")).replace(tzinfo=None)


async def _slots_libres_psicologa(db: AsyncSession, p_name: str, ignore_id: Optional[int] = None) -> Dict[str, List[str]]:
    """Horarios libres de UNA psicóloga en los próximos 14 días (mismas reglas que la reserva pública: turnos publicados, sin permisos aprobados, 45 min cada 60, 2 h de anticipación)."""
    ahora = _ahora_col()
    hasta = ahora.date() + timedelta(days=14)
    p = (p_name or "").upper().strip()
    shifts = (await db.execute(text("""
        SELECT shift_date, start_time, end_time FROM staff_shifts
        WHERE UPPER(psychologist_name) = :p AND is_published = true AND shift_type IN ('ENTREVISTAS', 'DISPONIBLE')
          AND shift_date >= :a AND shift_date <= :b ORDER BY shift_date, start_time
    """), {"p": p, "a": ahora.date(), "b": hasta})).fetchall()
    offs = (await db.execute(text("""
        SELECT start_date, end_date FROM staff_time_off WHERE UPPER(psychologist_name) = :p AND end_date >= :a AND start_date <= :b
          AND UPPER(COALESCE(status, 'APPROVED')) = 'APPROVED'
    """), {"p": p, "a": ahora.date(), "b": hasta})).fetchall()
    booked = [r[0] for r in (await db.execute(text("""
        SELECT appointment_date FROM interview_appointments
        WHERE UPPER(psychologist_name) = :p AND status != 'CANCELADA' AND appointment_date >= :a AND (:ig IS NULL OR id <> :ig)
    """), {"p": p, "a": ahora - timedelta(hours=1), "ig": ignore_id})).fetchall()]
    out: Dict[str, List[str]] = {}
    for sh in shifts:
        if any(o.start_date <= sh.shift_date <= o.end_date for o in offs):
            continue
        cur = datetime.combine(sh.shift_date, sh.start_time)
        fin = datetime.combine(sh.shift_date, sh.end_time)
        while cur + timedelta(minutes=45) <= fin:
            if cur >= ahora + timedelta(hours=2) and not any(b < cur + timedelta(minutes=45) and b + timedelta(minutes=45) > cur for b in booked):
                out.setdefault(cur.strftime("%Y-%m-%d"), []).append(cur.strftime("%H:%M"))
            cur += timedelta(minutes=60)
    return out


async def _cita_o_404(db: AsyncSession, appt_id: int):
    a = (await db.execute(text("""SELECT id, psychologist_name, appointment_date, time_slot, status, client_name, videocall_token, notes
                                  FROM interview_appointments WHERE id = :i"""), {"i": appt_id})).fetchone()
    if not a:
        raise HTTPException(status_code=404, detail="Cita no encontrada.")
    return a


async def _puede_gestionar(db: AsyncSession, user: dict, a) -> bool:
    if not hides_costs(user):
        return True                                  # administración
    from app.routers.shift_changes_api import my_staff_name, _nombres_cita
    me = await my_staff_name(db, user)
    return bool(me) and (a.psychologist_name or "").upper().strip() in _nombres_cita(me)


async def _cancelar(db: AsyncSession, a, quien: str, motivo: str) -> None:
    if a.status not in ("CONFIRMADA", "PROGRAMADA"):
        raise HTTPException(status_code=409, detail=f"La cita está en '{a.status}': ya no se puede cancelar.")
    marca = f" [CANCELADA por {quien}: {motivo or 'sin motivo'} | {_ahora_col().strftime('%Y-%m-%d %H:%M')}]"
    await db.execute(text("UPDATE interview_appointments SET status = 'CANCELADA', notes = COALESCE(notes, '') || :m WHERE id = :i"), {"m": marca, "i": a.id})
    await db.execute(text("UPDATE call_sessions SET status = 'FINALIZADA' WHERE appointment_id = :i AND status = 'PROGRAMADA'"), {"i": a.id})


async def _reagendar(db: AsyncSession, a, quien: str, d: date, slot: str) -> Dict[str, Any]:
    if a.status not in ("CONFIRMADA", "PROGRAMADA"):
        raise HTTPException(status_code=409, detail=f"La cita está en '{a.status}': ya no se puede reagendar.")
    try:
        hh = datetime.strptime(slot, "%H:%M").time()
    except ValueError:
        raise HTTPException(status_code=422, detail="Hora inválida.")
    await db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": f"reserva|{d}"})
    libres = await _slots_libres_psicologa(db, a.psychologist_name, ignore_id=a.id)
    if slot not in libres.get(str(d), []):
        raise HTTPException(status_code=409, detail="Ese horario no está disponible. Elige otro de la lista.")
    nueva = datetime.combine(d, hh)
    marca = f" [REAGENDADA de {a.appointment_date.strftime('%Y-%m-%d %H:%M')} a {nueva.strftime('%Y-%m-%d %H:%M')} por {quien}]"
    await db.execute(text("UPDATE interview_appointments SET appointment_date = :d, time_slot = :t, notes = COALESCE(notes, '') || :m WHERE id = :i"),
                     {"d": nueva, "t": slot, "m": marca, "i": a.id})
    return {"appointment_id": a.id, "date": str(d), "time_slot": slot}


class CitaCancelReq(BaseModel):
    reason: Optional[str] = None


class CitaReagendarReq(BaseModel):
    date: date
    time_slot: str


@router.get("/scheduling/appointments/{appt_id}/slots")
async def slots_para_reagendar(appt_id: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    a = await _cita_o_404(db, appt_id)
    if not await _puede_gestionar(db, user, a):
        raise HTTPException(status_code=403, detail="Solo la psicóloga de la cita o administración pueden cambiarla.")
    return {"appointment_id": a.id, "psychologist": a.psychologist_name, "slots_by_day": await _slots_libres_psicologa(db, a.psychologist_name, ignore_id=a.id)}


@router.post("/scheduling/appointments/{appt_id}/cancel")
async def cancelar_cita_equipo(appt_id: int, payload: CitaCancelReq, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    a = await _cita_o_404(db, appt_id)
    if not await _puede_gestionar(db, user, a):
        raise HTTPException(status_code=403, detail="Solo la psicóloga de la cita o administración pueden cancelarla.")
    await _cancelar(db, a, str(user.get("email") or "equipo"), (payload.reason or "").strip())
    await db.commit()
    return {"status": "success", "appointment_id": a.id}


@router.post("/scheduling/appointments/{appt_id}/reschedule")
async def reagendar_cita_equipo(appt_id: int, payload: CitaReagendarReq, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    a = await _cita_o_404(db, appt_id)
    if not await _puede_gestionar(db, user, a):
        raise HTTPException(status_code=403, detail="Solo la psicóloga de la cita o administración pueden reagendarla.")
    r = await _reagendar(db, a, str(user.get("email") or "equipo"), payload.date, payload.time_slot)
    await db.commit()
    return {"status": "success", **r}


# --- la clienta, con el enlace de su cita (el token es la credencial) ---
async def _cita_por_token(db: AsyncSession, token: str):
    a = (await db.execute(text("""SELECT id, psychologist_name, appointment_date, time_slot, status, client_name, videocall_token, notes
                                  FROM interview_appointments WHERE videocall_token = :t"""), {"t": token})).fetchone()
    if not a:
        raise HTTPException(status_code=404, detail="Enlace inválido.")
    return a


@router.get("/booking/manage/{token}")
async def ver_mi_cita(token: str, db: AsyncSession = Depends(get_db)):
    a = await _cita_por_token(db, token)
    editable = a.status in ("CONFIRMADA", "PROGRAMADA") and a.appointment_date >= _ahora_col() + timedelta(hours=2)
    meta = await person_meta(db, (a.psychologist_name or "").upper().strip())
    return {"client_name": a.client_name, "psychologist": meta, "date": a.appointment_date.strftime("%Y-%m-%d"), "time_slot": a.time_slot, "status": a.status,
            "editable": editable, "slots_by_day": (await _slots_libres_psicologa(db, a.psychologist_name, ignore_id=a.id)) if editable else {},
            "motivo_no_editable": None if editable else ("La cita ya pasó o está cancelada." if a.status != "CONFIRMADA" and a.status != "PROGRAMADA" else "Faltan menos de 2 horas: escríbenos para cambiarla.")}


@router.post("/booking/manage/{token}/cancel")
async def cancelar_mi_cita(token: str, payload: CitaCancelReq, db: AsyncSession = Depends(get_db)):
    a = await _cita_por_token(db, token)
    if a.appointment_date < _ahora_col() + timedelta(hours=2):
        raise HTTPException(status_code=409, detail="Faltan menos de 2 horas: escríbenos para cancelarla.")
    await _cancelar(db, a, "la clienta", (payload.reason or "").strip())
    await db.commit()
    return {"status": "success"}


@router.post("/booking/manage/{token}/reschedule")
async def reagendar_mi_cita(token: str, payload: CitaReagendarReq, db: AsyncSession = Depends(get_db)):
    a = await _cita_por_token(db, token)
    if a.appointment_date < _ahora_col() + timedelta(hours=2):
        raise HTTPException(status_code=409, detail="Faltan menos de 2 horas: escríbenos para cambiarla.")
    r = await _reagendar(db, a, "la clienta", payload.date, payload.time_slot)
    await db.commit()
    return {"status": "success", **r}
