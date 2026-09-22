import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.core.permissions import require_permission, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/work-time", tags=["Work Time & Productivity Tracking"])

COLOMBIA_TZ = timezone(timedelta(hours=-5))

# ─── DEFAULT PSYCHOLOGIST RATES & CONFIG ─────────────────────────────────────
DEFAULT_RATES = [
    {"key": "JENN", "name": "Jenn", "role": "Psicóloga Matchmaker", "hourly_rate": 30000.0, "idle_timeout": 10},
    {"key": "ANA", "name": "Ana", "role": "Psicóloga Matchmaker", "hourly_rate": 30000.0, "idle_timeout": 10},
    {"key": "SILVI", "name": "Silvi", "role": "Psicóloga Matchmaker Senior", "hourly_rate": 30000.0, "idle_timeout": 10},
    {"key": "STEFFY", "name": "Steffy", "role": "Psicóloga & Evaluadora Clínica", "hourly_rate": 30000.0, "idle_timeout": 10},
    {"key": "SOFI", "name": "Sofi", "role": "Psicóloga Matchmaker", "hourly_rate": 30000.0, "idle_timeout": 10},
    {"key": "ALEJA", "name": "Aleja", "role": "Psicóloga Matchmaker", "hourly_rate": 30000.0, "idle_timeout": 10},
    {"key": "MANU", "name": "Manu", "role": "Matchmaker & Asesora de Pareja", "hourly_rate": 30000.0, "idle_timeout": 10},
    {"key": "PIA", "name": "Pia", "role": "Psicóloga Matchmaker", "hourly_rate": 30000.0, "idle_timeout": 10},
    {"key": "ISA", "name": "Isa", "role": "Psicóloga Matchmaker", "hourly_rate": 30000.0, "idle_timeout": 10},
    {"key": "GLOBAL", "name": "Tarifa Estándar Global", "role": "Tarifa por Defecto", "hourly_rate": 30000.0, "idle_timeout": 10}
]

# ─── SCHEMAS ──────────────────────────────────────────────────────────────────
class SessionStartRequest(BaseModel):
    user_name: str
    user_role: Optional[str] = "Psicóloga Matchmaker"
    psychologist_key: Optional[str] = None
    hourly_rate_override: Optional[float] = None

class HeartbeatRequest(BaseModel):
    session_id: str
    is_active: bool = True

class PauseResumeRequest(BaseModel):
    session_id: str
    reason: Optional[str] = None

class SessionStopRequest(BaseModel):
    session_id: str
    reason: Optional[str] = "manual_stop"

class RateUpdateRequest(BaseModel):
    hourly_rate: float
    idle_timeout_minutes: Optional[int] = 15
    auto_clock_in: Optional[bool] = True
    active: Optional[bool] = True

class ActivityLogCreate(BaseModel):
    session_id: Optional[str] = None
    user_name: str
    action_category: str  # 'entrevista', 'matchmaking', 'clientes', 'citas', 'trouble', 'sistema'
    action_type: str      # 'MATCH_HECHO', 'INTERVIEW_SAVED', 'NOTE_ADDED', etc.
    title: str
    entity_type: Optional[str] = None
    entity_name: Optional[str] = None
    entity_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

# ─── TABLE INITIALIZATION ────────────────────────────────────────────────────
_tables_initialized = False

async def ensure_work_time_tables(db: AsyncSession):
    """Ensure work_sessions, work_activity_logs and psychologist_rates tables exist."""
    global _tables_initialized
    if _tables_initialized:
        return
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS psychologist_rates (
            psychologist_key VARCHAR(50) PRIMARY KEY,
            full_name VARCHAR(100) NOT NULL,
            role VARCHAR(100) NOT NULL,
            hourly_rate NUMERIC(12,2) NOT NULL DEFAULT 30000.00,
            currency VARCHAR(10) NOT NULL DEFAULT 'COP',
            idle_timeout_minutes INT NOT NULL DEFAULT 10,
            auto_clock_in BOOLEAN NOT NULL DEFAULT TRUE,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """))

    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS work_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_name VARCHAR(100) NOT NULL,
            user_role VARCHAR(100) DEFAULT 'Psicóloga Matchmaker',
            psychologist_key VARCHAR(50),
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ended_at TIMESTAMPTZ,
            last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            active_seconds INT NOT NULL DEFAULT 0,
            idle_seconds INT NOT NULL DEFAULT 0,
            hourly_rate NUMERIC(12,2) NOT NULL DEFAULT 30000.00,
            total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
            status VARCHAR(30) NOT NULL DEFAULT 'active',
            close_reason VARCHAR(50),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """))

    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS work_activity_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID,
            user_name VARCHAR(100) NOT NULL,
            action_category VARCHAR(50) NOT NULL,
            action_type VARCHAR(100) NOT NULL,
            title VARCHAR(255) NOT NULL,
            entity_type VARCHAR(50),
            entity_name VARCHAR(200),
            entity_id VARCHAR(100),
            details JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """))

    await db.execute(text("CREATE INDEX IF NOT EXISTS idx_work_sessions_user ON work_sessions(user_name)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS idx_work_sessions_status ON work_sessions(status)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS idx_work_sessions_started ON work_sessions(started_at)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS idx_work_act_session ON work_activity_logs(session_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS idx_work_act_user ON work_activity_logs(user_name)"))

    # Seed default psychologist rates if table is empty
    count_res = await db.execute(text("SELECT count(*) FROM psychologist_rates"))
    if (count_res.scalar() or 0) == 0:
        for r in DEFAULT_RATES:
            await db.execute(text("""
                INSERT INTO psychologist_rates (psychologist_key, full_name, role, hourly_rate, idle_timeout_minutes, auto_clock_in, active)
                VALUES (:key, :name, :role, :rate, :idle, true, true)
                ON CONFLICT (psychologist_key) DO NOTHING;
            """), {
                "key": r["key"],
                "name": r["name"],
                "role": r["role"],
                "rate": r["hourly_rate"],
                "idle": r["idle_timeout"]
            })
        await db.commit()
    _tables_initialized = True


# ─── ENDPOINTS: WORK SESSIONS & TIMERS ───────────────────────────────────────

@router.post("/session/start")
async def start_work_session(req: SessionStartRequest, db: AsyncSession = Depends(get_db)):
    """Inicia un turno de trabajo (Clock-In) para la psicóloga."""
    await ensure_work_time_tables(db)

    # 0. Excluir a María Paula y cuentas administrativas / dirección de facturar por horas
    name_clean = req.user_name.strip().upper()
    role_clean = (req.user_role or "").strip().upper()
    EXCLUDED_PATTERNS = ["MARIA PAULA", "MARIAPAULA", "MARIA", "MARÍA", "ADMIN", "SUPER ADMIN", "DIRECCION", "DIRECCIÓN"]
    if any(p in name_clean for p in EXCLUDED_PATTERNS) or any(p in role_clean for p in ["ADMIN", "SUPER ADMIN", "DIRECCION", "DIRECCIÓN"]):
        return {
            "status": "skipped",
            "message": f"El usuario {req.user_name} no factura por horas. Seguimiento omitido.",
            "session_id": None
        }

    # 1. Resolver clave de psicóloga si no se proveyó
    pkey = req.psychologist_key
    if not pkey:
        name_clean = req.user_name.strip().upper()
        for r in DEFAULT_RATES:
            if r["key"] in name_clean or name_clean in r["name"].upper():
                pkey = r["key"]
                break
        if not pkey:
            pkey = "GLOBAL"

    # 2. Consultar tarifa configurada
    rate_res = await db.execute(text("""
        SELECT hourly_rate, idle_timeout_minutes FROM psychologist_rates
        WHERE psychologist_key = :key AND active = true
    """), {"key": pkey})
    rate_row = rate_res.fetchone()
    
    hourly_rate = float(req.hourly_rate_override) if req.hourly_rate_override is not None else (float(rate_row.hourly_rate) if rate_row else 30000.0)

    # 3. Si ya tiene una sesión 'active' o 'paused' iniciada hace menos de 12 horas, reanudarla
    existing_res = await db.execute(text("""
        SELECT id, active_seconds, idle_seconds, status, started_at, hourly_rate
        FROM work_sessions
        WHERE user_name = :uname AND status IN ('active', 'paused')
        AND started_at >= NOW() - INTERVAL '12 hours'
        ORDER BY started_at DESC LIMIT 1
    """), {"uname": req.user_name})
    existing = existing_res.fetchone()

    if existing:
        # Reanudar sesión existente
        await db.execute(text("""
            UPDATE work_sessions
            SET status = 'active', last_heartbeat = NOW()
            WHERE id = :sid
        """), {"sid": existing.id})
        await db.commit()

        return {
            "status": "resumed",
            "session_id": str(existing.id),
            "user_name": req.user_name,
            "started_at": existing.started_at.isoformat() if existing.started_at else None,
            "active_seconds": existing.active_seconds,
            "idle_seconds": existing.idle_seconds,
            "hourly_rate": float(existing.hourly_rate),
            "session_status": "active",
            "message": f"Sesión activa reanudada para {req.user_name}"
        }

    # 4. Crear nueva sesión
    res = await db.execute(text("""
        INSERT INTO work_sessions (user_name, user_role, psychologist_key, started_at, last_heartbeat, active_seconds, idle_seconds, hourly_rate, total_amount, status)
        VALUES (:uname, :urole, :pkey, NOW(), NOW(), 0, 0, :rate, 0.0, 'active')
        RETURNING id, started_at, hourly_rate
    """), {
        "uname": req.user_name,
        "urole": req.user_role or "Psicóloga Matchmaker",
        "pkey": pkey,
        "rate": hourly_rate
    })
    new_sess = res.fetchone()
    await db.commit()

    # Log initial activity
    await db.execute(text("""
        INSERT INTO work_activity_logs (session_id, user_name, action_category, action_type, title, entity_type, entity_name)
        VALUES (:sid, :uname, 'sistema', 'CLOCK_IN', 'Inicio de Turno de Trabajo', 'session', :sid_str)
    """), {
        "sid": new_sess.id,
        "uname": req.user_name,
        "sid_str": str(new_sess.id)
    })
    await db.commit()

    return {
        "status": "started",
        "session_id": str(new_sess.id),
        "user_name": req.user_name,
        "started_at": new_sess.started_at.isoformat() if new_sess.started_at else None,
        "active_seconds": 0,
        "idle_seconds": 0,
        "hourly_rate": hourly_rate,
        "session_status": "active",
        "message": f"Turno de trabajo iniciado exitosamente para {req.user_name}"
    }


@router.post("/session/heartbeat")
async def process_heartbeat(req: HeartbeatRequest, db: AsyncSession = Depends(get_db)):
    """Latido enviado cada 60s desde el navegador. Acumula tiempo activo o inactivo."""
    await ensure_work_time_tables(db)

    try:
        sid = UUID(req.session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="session_id inválido")

    sess_res = await db.execute(text("""
        SELECT id, user_name, last_heartbeat, active_seconds, idle_seconds, hourly_rate, status
        FROM work_sessions WHERE id = :sid
    """), {"sid": sid})
    sess = sess_res.fetchone()
    if not sess:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    if sess.status in ('completed', 'auto_closed'):
        return {
            "status": "closed",
            "session_id": str(sess.id),
            "session_status": sess.status,
            "message": "La sesión ya ha finalizado"
        }

    now = datetime.now(timezone.utc)
    last_hb = sess.last_heartbeat
    if last_hb.tzinfo is None:
        last_hb = last_hb.replace(tzinfo=timezone.utc)

    # Calcular segundos transcurridos desde el último latido (tope en 120s para evitar saltos irreales)
    diff = min(int((now - last_hb).total_seconds()), 120)
    if diff < 0:
        diff = 0

    new_active = sess.active_seconds
    new_idle = sess.idle_seconds
    new_status = sess.status

    if req.is_active:
        new_active += diff
        new_status = 'active'
    else:
        new_idle += diff
        new_status = 'paused'

    rate = float(sess.hourly_rate or 30000.0)
    new_total = round((new_active / 3600.0) * rate, 2)

    await db.execute(text("""
        UPDATE work_sessions
        SET active_seconds = :act,
            idle_seconds = :idl,
            total_amount = :amt,
            last_heartbeat = NOW(),
            status = :st
        WHERE id = :sid
    """), {
        "act": new_active,
        "idl": new_idle,
        "amt": new_total,
        "st": new_status,
        "sid": sid
    })
    await db.commit()

    return {
        "status": "ok",
        "session_id": str(sess.id),
        "active_seconds": new_active,
        "idle_seconds": new_idle,
        "total_amount": new_total,
        "session_status": new_status,
        "hourly_rate": rate
    }


@router.post("/session/pause")
async def pause_work_session(req: PauseResumeRequest, db: AsyncSession = Depends(get_db)):
    """Pone en pausa manual un turno de trabajo (ej: descanso, almuerzo)."""
    await ensure_work_time_tables(db)
    try:
        sid = UUID(req.session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="session_id inválido")

    await db.execute(text("""
        UPDATE work_sessions
        SET status = 'paused', last_heartbeat = NOW()
        WHERE id = :sid AND status = 'active'
    """), {"sid": sid})

    # Log de pausa
    await db.execute(text("""
        INSERT INTO work_activity_logs (session_id, user_name, action_category, action_type, title, entity_type)
        SELECT id, user_name, 'sistema', 'PAUSE', :reason, 'session'
        FROM work_sessions WHERE id = :sid
    """), {"sid": sid, "reason": req.reason or "Pausa manual del turno"})
    await db.commit()

    return {"status": "paused", "session_id": str(sid)}


@router.post("/session/resume")
async def resume_work_session(req: PauseResumeRequest, db: AsyncSession = Depends(get_db)):
    """Reanuda un turno de trabajo que estaba en pausa."""
    await ensure_work_time_tables(db)
    try:
        sid = UUID(req.session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="session_id inválido")

    await db.execute(text("""
        UPDATE work_sessions
        SET status = 'active', last_heartbeat = NOW()
        WHERE id = :sid AND status = 'paused'
    """), {"sid": sid})

    await db.execute(text("""
        INSERT INTO work_activity_logs (session_id, user_name, action_category, action_type, title, entity_type)
        SELECT id, user_name, 'sistema', 'RESUME', 'Reanudación de turno de trabajo', 'session'
        FROM work_sessions WHERE id = :sid
    """), {"sid": sid})
    await db.commit()

    return {"status": "resumed", "session_id": str(sid)}


@router.post("/session/stop")
async def stop_work_session(req: SessionStopRequest, db: AsyncSession = Depends(get_db)):
    """Finaliza el turno de trabajo (Clock-Out) y liquida el total a pagar."""
    await ensure_work_time_tables(db)
    try:
        sid = UUID(req.session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="session_id inválido")

    sess_res = await db.execute(text("""
        SELECT id, user_name, active_seconds, hourly_rate
        FROM work_sessions WHERE id = :sid
    """), {"sid": sid})
    sess = sess_res.fetchone()
    if not sess:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    rate = float(sess.hourly_rate or 30000.0)
    final_amount = round((sess.active_seconds / 3600.0) * rate, 2)

    await db.execute(text("""
        UPDATE work_sessions
        SET status = 'completed',
            ended_at = NOW(),
            total_amount = :amt,
            close_reason = :reason
        WHERE id = :sid
    """), {
        "amt": final_amount,
        "reason": req.reason or "manual_stop",
        "sid": sid
    })

    # Log de fin
    await db.execute(text("""
        INSERT INTO work_activity_logs (session_id, user_name, action_category, action_type, title, entity_type)
        VALUES (:sid, :uname, 'sistema', 'CLOCK_OUT', 'Fin de Turno de Trabajo', 'session')
    """), {"sid": sid, "uname": sess.user_name})
    await db.commit()

    return {
        "status": "completed",
        "session_id": str(sid),
        "user_name": sess.user_name,
        "active_seconds": sess.active_seconds,
        "active_hours": round(sess.active_seconds / 3600.0, 2),
        "hourly_rate": rate,
        "total_amount": final_amount,
        "message": f"Turno finalizado. Total liquidado: ${final_amount:,.0f} COP"
    }


@router.get("/session/current")
async def get_current_session(
    user_name: str = Query(..., description="Nombre de la psicóloga"),
    db: AsyncSession = Depends(get_db)
):
    """Consulta si la psicóloga tiene una sesión activa o en pausa en este momento."""
    name_clean = user_name.strip().upper()
    EXCLUDED_PATTERNS = ["MARIA PAULA", "MARIAPAULA", "MARIA", "MARÍA", "ADMIN", "SUPER ADMIN", "DIRECCION", "DIRECCIÓN"]
    if any(p in name_clean for p in EXCLUDED_PATTERNS):
        return {
            "has_active_session": False,
            "session": None,
            "tracking_enabled": False,
            "message": "Usuario no habilitado para facturación de horas."
        }

    await ensure_work_time_tables(db)

    # Auto-cerrar sesiones abandonadas (sin heartbeat hace > 45 mins)
    await db.execute(text("""
        UPDATE work_sessions
        SET status = 'auto_closed',
            ended_at = last_heartbeat,
            close_reason = 'idle_timeout'
        WHERE status IN ('active', 'paused')
        AND last_heartbeat < NOW() - INTERVAL '45 minutes'
    """))
    await db.commit()

    sess_res = await db.execute(text("""
        SELECT id, user_name, user_role, psychologist_key, started_at, last_heartbeat,
               active_seconds, idle_seconds, hourly_rate, total_amount, status
        FROM work_sessions
        WHERE user_name = :uname AND status IN ('active', 'paused')
        ORDER BY started_at DESC LIMIT 1
    """), {"uname": user_name})
    sess = sess_res.fetchone()

    if not sess:
        # Obtener tarifa configurada para mostrarla predeterminada
        pkey = "GLOBAL"
        for r in DEFAULT_RATES:
            if r["key"] in user_name.upper() or user_name.upper() in r["name"].upper():
                pkey = r["key"]
                break
        rate_res = await db.execute(text("SELECT hourly_rate, idle_timeout_minutes FROM psychologist_rates WHERE psychologist_key = :k"), {"k": pkey})
        r_row = rate_res.fetchone()

        return {
            "has_active_session": False,
            "session": None,
            "configured_rate": float(r_row.hourly_rate) if r_row else 30000.0,
            "idle_timeout_minutes": r_row.idle_timeout_minutes if r_row else 15
        }

    return {
        "has_active_session": True,
        "session": {
            "id": str(sess.id),
            "user_name": sess.user_name,
            "user_role": sess.user_role,
            "psychologist_key": sess.psychologist_key,
            "started_at": sess.started_at.isoformat() if sess.started_at else None,
            "active_seconds": sess.active_seconds,
            "idle_seconds": sess.idle_seconds,
            "hourly_rate": float(sess.hourly_rate),
            "total_amount": float(sess.total_amount),
            "status": sess.status
        }
    }


# ─── ENDPOINTS: AUDITORÍA & LIQUIDACIÓN PARA DIRECCIÓN ───────────────────────

@router.get("/sessions")
async def list_work_sessions(
    psychologist: Optional[str] = Query(None, description="Filtro por psicóloga"),
    start_date: Optional[str] = Query(None, description="Fecha inicio YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Fecha fin YYYY-MM-DD"),
    status_filter: Optional[str] = Query(None, description="active, paused, completed, auto_closed"),
    db: AsyncSession = Depends(get_db)
):
    """Módulo de Control de Horas & Liquidación para María Paula / Dirección."""
    await ensure_work_time_tables(db)

    # 1. Auto-cerrar sesiones abandonadas antes de listar
    await db.execute(text("""
        UPDATE work_sessions
        SET status = 'auto_closed',
            ended_at = last_heartbeat,
            close_reason = 'idle_timeout'
        WHERE status IN ('active', 'paused')
        AND last_heartbeat < NOW() - INTERVAL '45 minutes'
    """))
    await db.commit()

    # 2. Construir filtros dinámicos
    conds = ["1=1"]
    params: Dict[str, Any] = {}

    if psychologist and psychologist.strip() and psychologist.lower() != 'todas':
        conds.append("(LOWER(user_name) LIKE :psyc OR LOWER(psychologist_key) = :psyc_key)")
        params["psyc"] = f"%{psychologist.strip().lower()}%"
        params["psyc_key"] = psychologist.strip().lower()

    if start_date and start_date.strip():
        conds.append("started_at >= :start_dt")
        params["start_dt"] = datetime.strptime(start_date.strip(), "%Y-%m-%d").replace(tzinfo=COLOMBIA_TZ)

    if end_date and end_date.strip():
        conds.append("started_at <= :end_dt")
        params["end_dt"] = (datetime.strptime(end_date.strip(), "%Y-%m-%d") + timedelta(days=1, microseconds=-1)).replace(tzinfo=COLOMBIA_TZ)

    if status_filter and status_filter.strip() and status_filter.lower() != 'todos':
        conds.append("status = :status_filter")
        params["status_filter"] = status_filter.strip()

    where_clause = " AND ".join(conds)

    # 3. Query sesiones
    query = f"""
        SELECT 
            ws.id, ws.user_name, ws.user_role, ws.psychologist_key,
            ws.started_at, ws.ended_at, ws.last_heartbeat,
            ws.active_seconds, ws.idle_seconds, ws.hourly_rate, ws.total_amount,
            ws.status, ws.close_reason,
            (SELECT COUNT(*) FROM work_activity_logs wal WHERE wal.session_id = ws.id) as activities_count
        FROM work_sessions ws
        WHERE {where_clause}
        ORDER BY ws.started_at DESC
        LIMIT 200
    """
    res = await db.execute(text(query), params)
    rows = res.fetchall()

    sessions = []
    total_active_seconds = 0
    total_idle_seconds = 0
    total_amount_sum = 0.0
    active_now_count = 0

    for r in rows:
        act_sec = int(r.active_seconds or 0)
        idl_sec = int(r.idle_seconds or 0)
        tot_amt = float(r.total_amount or 0.0)

        total_active_seconds += act_sec
        total_idle_seconds += idl_sec
        total_amount_sum += tot_amt

        if r.status == 'active':
            active_now_count += 1

        # Formatear horas y minutos
        act_hours = act_sec // 3600
        act_mins = (act_sec % 3600) // 60
        act_formatted = f"{act_hours}h {act_mins:02d}m"

        idl_hours = idl_sec // 3600
        idl_mins = (idl_sec % 3600) // 60
        idl_formatted = f"{idl_hours}h {idl_mins:02d}m"

        sessions.append({
            "id": str(r.id),
            "user_name": r.user_name,
            "user_role": r.user_role,
            "psychologist_key": r.psychologist_key,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "ended_at": r.ended_at.isoformat() if r.ended_at else None,
            "active_seconds": act_sec,
            "idle_seconds": idl_sec,
            "active_formatted": act_formatted,
            "idle_formatted": idl_formatted,
            "active_hours_decimal": round(act_sec / 3600.0, 2),
            "hourly_rate": float(r.hourly_rate or 0),
            "total_amount": tot_amt,
            "status": r.status,
            "close_reason": r.close_reason,
            "activities_count": int(r.activities_count or 0)
        })

    total_hours_decimal = round(total_active_seconds / 3600.0, 2)
    total_idle_decimal = round(total_idle_seconds / 3600.0, 2)

    return {
        "status": "success",
        "total_sessions": len(sessions),
        "kpis": {
            "total_active_hours": total_hours_decimal,
            "total_active_formatted": f"{total_active_seconds // 3600}h {(total_active_seconds % 3600) // 60:02d}m",
            "total_idle_hours": total_idle_decimal,
            "total_idle_formatted": f"{total_idle_seconds // 3600}h {(total_idle_seconds % 3600) // 60:02d}m",
            "total_liquidation_cop": round(total_amount_sum, 2),
            "total_liquidation_formatted": f"${total_amount_sum:,.0f} COP",
            "active_now_count": active_now_count
        },
        "sessions": sessions
    }


@router.get("/sessions/{session_id}/activities")
async def get_session_activities(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Retorna la bitácora cronológica minuto a minuto de todo lo que hizo en el turno."""
    await ensure_work_time_tables(db)

    # 1. Obtener la sesión
    sess_res = await db.execute(text("""
        SELECT id, user_name, started_at, ended_at, last_heartbeat, active_seconds, hourly_rate, total_amount, status
        FROM work_sessions WHERE id = :sid
    """), {"sid": session_id})
    sess = sess_res.fetchone()
    if not sess:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    # 2. Consultar logs explícitos en work_activity_logs
    logs_res = await db.execute(text("""
        SELECT id, action_category, action_type, title, entity_type, entity_name, entity_id, details, created_at
        FROM work_activity_logs
        WHERE session_id = :sid
        ORDER BY created_at ASC
    """), {"sid": session_id})
    raw_logs = logs_res.fetchall()

    activities = []
    for l in raw_logs:
        activities.append({
            "id": str(l.id),
            "category": l.action_category,
            "type": l.action_type,
            "title": l.title,
            "entity_type": l.entity_type,
            "entity_name": l.entity_name,
            "entity_id": l.entity_id,
            "details": l.details or {},
            "time": l.created_at.strftime("%I:%M %p") if l.created_at else "",
            "created_at": l.created_at.isoformat() if l.created_at else None
        })

    # 3. Complementar automáticamente con eventos reales de la base de datos en esa ventana de tiempo
    # (por si se hicieron matches o notas mientras el turno estaba activo)
    start_time = sess.started_at
    end_time = sess.ended_at or sess.last_heartbeat or datetime.now(timezone.utc)
    user_name_lower = sess.user_name.strip().lower()

    # Matches creados/tocados por esta psicóloga durante el turno
    try:
        matches_res = await db.execute(text("""
            SELECT id, person_a, person_b, status, matchmaker, created_at
            FROM historical_matches
            WHERE (LOWER(COALESCE(matchmaker, '')) LIKE :uname)
            AND created_at >= :st AND created_at <= :et
            ORDER BY created_at ASC
            LIMIT 30
        """), {
            "uname": f"%{user_name_lower}%",
            "st": start_time,
            "et": end_time
        })
        for m in matches_res.fetchall():
            proposal = f"{m.person_a or ''} & {m.person_b or ''}".strip(' &')
            if not any(a.get("entity_id") == str(m.id) for a in activities):
                activities.append({
                    "id": f"match-{m.id}",
                    "category": "matchmaking",
                    "type": "MATCH_RECORD",
                    "title": f"Match: {proposal or 'Propuesta de Pareja'}",
                    "entity_type": "match",
                    "entity_name": proposal,
                    "entity_id": str(m.id),
                    "details": {"status": m.status},
                    "time": m.created_at.strftime("%I:%M %p") if m.created_at else "",
                    "created_at": m.created_at.isoformat() if m.created_at else None
                })
    except Exception as ex_m:
        logger.warning(f"Notice: historical matches lookup skipped: {ex_m}")

    # Ordenar todas las actividades cronológicamente
    activities.sort(key=lambda x: x.get("created_at") or "")

    return {
        "session_id": str(sess.id),
        "user_name": sess.user_name,
        "started_at": sess.started_at.isoformat() if sess.started_at else None,
        "ended_at": sess.ended_at.isoformat() if sess.ended_at else None,
        "active_seconds": sess.active_seconds,
        "total_amount": float(sess.total_amount or 0),
        "total_activities": len(activities),
        "activities": activities
    }


@router.post("/activity/log")
async def log_work_activity(req: ActivityLogCreate, db: AsyncSession = Depends(get_db)):
    """Registra una acción de valor realizada por una psicóloga (para auditoría)."""
    await ensure_work_time_tables(db)

    # Si no envió session_id, buscar la sesión activa actual de la usuaria
    sid = None
    if req.session_id:
        try:
            sid = UUID(req.session_id)
        except Exception:
            sid = None

    if not sid:
        cur_res = await db.execute(text("""
            SELECT id FROM work_sessions
            WHERE user_name = :uname AND status IN ('active', 'paused')
            ORDER BY started_at DESC LIMIT 1
        """), {"uname": req.user_name})
        cur_row = cur_res.fetchone()
        if cur_row:
            sid = cur_row.id

    await db.execute(text("""
        INSERT INTO work_activity_logs (
            session_id, user_name, action_category, action_type, title,
            entity_type, entity_name, entity_id, details
        ) VALUES (
            :sid, :uname, :cat, :atype, :title,
            :etype, :ename, :eid, CAST(:details AS jsonb)
        )
    """), {
        "sid": sid,
        "uname": req.user_name,
        "cat": req.action_category,
        "atype": req.action_type,
        "title": req.title,
        "etype": req.entity_type,
        "ename": req.entity_name,
        "eid": req.entity_id,
        "details": json_dumps_safe(req.details or {})
    })
    await db.commit()

    return {"status": "logged", "session_id": str(sid) if sid else None}


def json_dumps_safe(obj):
    import json
    try:
        return json.dumps(obj)
    except Exception:
        return "{}"


# ─── ENDPOINTS: CONFIGURACIÓN DE TARIFAS ($ / HORA) ──────────────────────────

@router.get("/rates")
async def get_psychologist_rates(db: AsyncSession = Depends(get_db)):
    """Obtiene la lista de tarifas por hora configuradas para cada psicóloga."""
    await ensure_work_time_tables(db)

    res = await db.execute(text("""
        SELECT psychologist_key, full_name, role, hourly_rate, currency, idle_timeout_minutes, auto_clock_in, active, updated_at
        FROM psychologist_rates
        ORDER BY hourly_rate DESC, full_name ASC
    """))
    rates = []
    for r in res.fetchall():
        rates.append({
            "key": r.psychologist_key,
            "name": r.full_name,
            "role": r.role,
            "hourly_rate": float(r.hourly_rate),
            "currency": r.currency,
            "idle_timeout_minutes": r.idle_timeout_minutes,
            "auto_clock_in": r.auto_clock_in,
            "active": r.active,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None
        })
    return {"status": "success", "rates": rates, "total": len(rates)}


@router.put("/rates/{psychologist_key}")
async def update_psychologist_rate(
    psychologist_key: str,
    req: RateUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Actualiza la tarifa por hora ($/hora) o parámetros de una psicóloga."""
    await ensure_work_time_tables(db)

    pkey = psychologist_key.strip().upper()
    res = await db.execute(text("""
        UPDATE psychologist_rates
        SET hourly_rate = :rate,
            idle_timeout_minutes = COALESCE(:idle, idle_timeout_minutes),
            auto_clock_in = COALESCE(:auto_ci, auto_clock_in),
            active = COALESCE(:act, active),
            updated_at = NOW()
        WHERE psychologist_key = :k
        RETURNING psychologist_key, full_name, hourly_rate, idle_timeout_minutes
    """), {
        "rate": req.hourly_rate,
        "idle": req.idle_timeout_minutes,
        "auto_ci": req.auto_clock_in,
        "act": req.active,
        "k": pkey
    })
    updated = res.fetchone()
    if not updated:
        raise HTTPException(status_code=404, detail="Psicóloga no encontrada en la configuración de tarifas")
    await db.commit()

    return {
        "status": "updated",
        "psychologist_key": updated.psychologist_key,
        "full_name": updated.full_name,
        "hourly_rate": float(updated.hourly_rate),
        "idle_timeout_minutes": updated.idle_timeout_minutes,
        "message": f"Tarifa actualizada a ${float(updated.hourly_rate):,.0f} COP/hora"
    }


# ─── MÓDULO 5: EFICIENCIA DE TURNOS Y PUNTAJE DE COMPROMISO MATCHMAKERS ───────

class CommitmentScoreUpsertRequest(BaseModel):
    year: int
    month: int
    matchmaker_name: str
    cumplimiento: int = Field(3, ge=1, le=5)
    puntualidad: int = Field(3, ge=1, le=5)
    gestion_perfiles: int = Field(3, ge=1, le=5)
    calidad_entrevistas: int = Field(3, ge=1, le=5)
    seguimiento: int = Field(3, ge=1, le=5)
    compromiso: int = Field(3, ge=1, le=5)
    missed_miguel_meetings: int = Field(0, ge=0)
    observations: Optional[str] = ""


async def ensure_commitment_table(db: AsyncSession):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS matchmaker_commitment_evaluations (
            id SERIAL PRIMARY KEY,
            period_year INT NOT NULL,
            period_month INT NOT NULL,
            matchmaker_name VARCHAR(100) NOT NULL,
            cumplimiento INT NOT NULL DEFAULT 3,
            puntualidad INT NOT NULL DEFAULT 3,
            gestion_perfiles INT NOT NULL DEFAULT 3,
            calidad_entrevistas INT NOT NULL DEFAULT 3,
            seguimiento INT NOT NULL DEFAULT 3,
            compromiso INT NOT NULL DEFAULT 3,
            missed_miguel_meetings INT NOT NULL DEFAULT 0,
            final_score_100 NUMERIC(5,2) NOT NULL DEFAULT 60.0,
            average_5 NUMERIC(3,2) NOT NULL DEFAULT 3.0,
            observations TEXT DEFAULT '',
            evaluated_by VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(period_year, period_month, matchmaker_name)
        );
    """))


@router.get("/matchmaker-shift-efficiency")
async def get_matchmaker_shift_efficiency(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user)
):
    """
    Cruza los turnos de trabajo registrados (horas en línea) con los matches producidos
    en operational_matches para determinar la velocidad real (minutos por match),
    tasa de aprobación de María y cuellos de botella del equipo de matchmakers.
    """
    if hasattr(year, 'default'):
        year = year.default
    if hasattr(month, 'default'):
        month = month.default
    await ensure_work_time_tables(db)
    now = datetime.now()
    t_year = year or now.year
    t_month = month or now.month

    # 1. Matches creados y aprobados por cada psicóloga en el mes
    matches_q = """
        SELECT 
            UPPER(TRIM(psychologist_name)) as psyc_name,
            count(*) as total_matches,
            count(*) FILTER (WHERE approved_by_maria = true) as approved_matches,
            count(*) FILTER (WHERE status = 'DESCARTADO' OR status ILIKE '%RECHAZ%') as rejected_matches
        FROM operational_matches
        WHERE EXTRACT(YEAR FROM created_at) = :year
          AND EXTRACT(MONTH FROM created_at) = :month
        GROUP BY psyc_name
    """
    m_rows = (await db.execute(text(matches_q), {"year": t_year, "month": t_month})).mappings().all()
    m_map = {r["psyc_name"]: r for r in m_rows}

    # 2. Horas trabajadas (active_seconds) en el mes
    sessions_q = """
        SELECT 
            UPPER(TRIM(user_name)) as u_name,
            COALESCE(SUM(active_seconds), 0) as total_active_sec,
            count(*) as sessions_count
        FROM work_sessions
        WHERE EXTRACT(YEAR FROM started_at) = :year
          AND EXTRACT(MONTH FROM started_at) = :month
        GROUP BY u_name
    """
    s_rows = (await db.execute(text(sessions_q), {"year": t_year, "month": t_month})).mappings().all()
    s_map = {r["u_name"]: r for r in s_rows}

    # 3. Consolidar por lista oficial de psicólogas + cualquier otra en BD
    results = []
    seen_names = set()

    for dr in DEFAULT_RATES:
        k = dr["key"]
        if k == "GLOBAL":
            continue
        name_clean = dr["name"]
        key_upper = k.upper()
        seen_names.add(key_upper)

        # Buscar en matches (por key o por substring)
        m_stat = None
        for mk, mv in m_map.items():
            if key_upper in mk or mk in key_upper:
                m_stat = mv
                break

        # Buscar en sessions
        s_stat = None
        for sk, sv in s_map.items():
            if key_upper in sk or sk in key_upper:
                s_stat = sv
                break

        matches_count = m_stat["total_matches"] if m_stat else 0
        approved_count = m_stat["approved_matches"] if m_stat else 0
        rejected_count = m_stat["rejected_matches"] if m_stat else 0
        active_sec = s_stat["total_active_sec"] if s_stat else 0
        sessions_cnt = s_stat["sessions_count"] if s_stat else 0

        active_hours = round(active_sec / 3600.0, 2)
        total_active_min = active_sec / 60.0

        if matches_count > 0:
            avg_min_per_match = round(total_active_min / matches_count, 1) if active_sec > 0 else 25.0
            approval_rate = round(approved_count / matches_count * 100.0, 1)
        else:
            avg_min_per_match = 0.0
            approval_rate = 0.0

        # Diagnóstico de eficiencia basado en datos
        if matches_count == 0 and active_hours == 0:
            speed_diag = "Sin actividad registrada"
            badge_color = "gray"
        elif avg_min_per_match <= 20.0 and matches_count >= 5:
            speed_diag = "Alta eficiencia (< 20 min/match)"
            badge_color = "emerald"
        elif avg_min_per_match <= 35.0:
            speed_diag = "Velocidad estándar (20-35 min/match)"
            badge_color = "blue"
        else:
            speed_diag = "Alerta cuello de botella (> 35 min/match)"
            badge_color = "rose"

        results.append({
            "key": k,
            "name": name_clean,
            "role": dr["role"],
            "sessions_count": sessions_cnt,
            "active_hours": active_hours,
            "matches_count": matches_count,
            "approved_count": approved_count,
            "rejected_count": rejected_count,
            "approval_rate": approval_rate,
            "avg_minutes_per_match": avg_min_per_match,
            "speed_diagnosis": speed_diag,
            "badge_color": badge_color
        })

    # Ordenar por matches_count DESC
    results.sort(key=lambda x: (x["matches_count"], x["active_hours"]), reverse=True)

    # Totales globales del equipo
    tot_matches = sum(r["matches_count"] for r in results)
    tot_approved = sum(r["approved_count"] for r in results)
    tot_hours = round(sum(r["active_hours"] for r in results), 2)
    overall_approval_pct = round(tot_approved / tot_matches * 100.0, 1) if tot_matches > 0 else 0.0
    overall_avg_speed = round((tot_hours * 60) / tot_matches, 1) if tot_matches > 0 and tot_hours > 0 else 0.0

    return {
        "year": t_year,
        "month": t_month,
        "team_summary": {
            "total_team_hours": tot_hours,
            "total_matches_produced": tot_matches,
            "total_matches_approved": tot_approved,
            "overall_approval_rate": overall_approval_pct,
            "overall_avg_minutes_per_match": overall_avg_speed
        },
        "matchmakers": results
    }


@router.get("/commitment-scores")
async def get_commitment_scores(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """
    Retorna la matriz de puntaje de compromiso mensual de las matchmakers (Puntaje sobre 100).
    Fórmula de Lina: Asistencia/Puntualidad, Gestión de perfiles, Calidad entrevistas,
    Seguimiento, Compromiso, y penalización directa de -5 pts por reunión con Miguel perdida.
    """
    await ensure_commitment_table(db)
    now = datetime.now()
    t_year = year or now.year
    t_month = month or now.month

    res = await db.execute(text("""
        SELECT 
            id, period_year, period_month, matchmaker_name,
            cumplimiento, puntualidad, gestion_perfiles, calidad_entrevistas,
            seguimiento, compromiso, missed_miguel_meetings,
            final_score_100, average_5, observations, evaluated_by, updated_at
        FROM matchmaker_commitment_evaluations
        WHERE period_year = :year AND period_month = :month
        ORDER BY final_score_100 DESC, matchmaker_name ASC
    """), {"year": t_year, "month": t_month})

    rows = res.mappings().all()
    evals = []
    for r in rows:
        evals.append({
            "id": r["id"],
            "year": r["period_year"],
            "month": r["period_month"],
            "matchmaker_name": r["matchmaker_name"],
            "cumplimiento": r["cumplimiento"],
            "puntualidad": r["puntualidad"],
            "gestion_perfiles": r["gestion_perfiles"],
            "calidad_entrevistas": r["calidad_entrevistas"],
            "seguimiento": r["seguimiento"],
            "compromiso": r["compromiso"],
            "missed_miguel_meetings": r["missed_miguel_meetings"],
            "final_score_100": float(r["final_score_100"]),
            "average_5": float(r["average_5"]),
            "observations": r["observations"] or "",
            "evaluated_by": r["evaluated_by"],
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None
        })

    return {
        "year": t_year,
        "month": t_month,
        "evaluations": evals,
        "total": len(evals)
    }


@router.post("/commitment-scores")
async def upsert_commitment_score(
    req: CommitmentScoreUpsertRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """
    Registra o actualiza la evaluación de compromiso de una matchmaker para un mes específico.
    Calcula automáticamente el promedio (1-5) y el puntaje sobre 100 con penalizaciones de Miguel.
    """
    await ensure_commitment_table(db)

    # 1. Promedio escala 1 a 5
    avg_5 = (
        req.cumplimiento +
        req.puntualidad +
        req.gestion_perfiles +
        req.calidad_entrevistas +
        req.seguimiento +
        req.compromiso
    ) / 6.0

    # 2. Puntaje base sobre 100 = (avg_5 / 5.0) * 100
    base_100 = (avg_5 / 5.0) * 100.0

    # 3. Penalización de Miguel: -5 puntos por reunión no asistida
    penalty = req.missed_miguel_meetings * 5.0
    final_score = max(0.0, min(100.0, base_100 - penalty))

    evaluator = user.get("employee_name") or user.get("email") or "Dirección"

    query = """
        INSERT INTO matchmaker_commitment_evaluations (
            period_year, period_month, matchmaker_name,
            cumplimiento, puntualidad, gestion_perfiles, calidad_entrevistas,
            seguimiento, compromiso, missed_miguel_meetings,
            final_score_100, average_5, observations, evaluated_by, updated_at
        ) VALUES (
            :year, :month, :name,
            :cump, :punt, :gest, :cal,
            :seg, :comp, :missed,
            :fscore, :avg5, :obs, :eval_by, NOW()
        )
        ON CONFLICT (period_year, period_month, matchmaker_name)
        DO UPDATE SET
            cumplimiento = EXCLUDED.cumplimiento,
            puntualidad = EXCLUDED.puntualidad,
            gestion_perfiles = EXCLUDED.gestion_perfiles,
            calidad_entrevistas = EXCLUDED.calidad_entrevistas,
            seguimiento = EXCLUDED.seguimiento,
            compromiso = EXCLUDED.compromiso,
            missed_miguel_meetings = EXCLUDED.missed_miguel_meetings,
            final_score_100 = EXCLUDED.final_score_100,
            average_5 = EXCLUDED.average_5,
            observations = EXCLUDED.observations,
            evaluated_by = EXCLUDED.evaluated_by,
            updated_at = NOW()
        RETURNING id, final_score_100, average_5;
    """
    res = await db.execute(text(query), {
        "year": req.year,
        "month": req.month,
        "name": req.matchmaker_name.strip(),
        "cump": req.cumplimiento,
        "punt": req.puntualidad,
        "gest": req.gestion_perfiles,
        "cal": req.calidad_entrevistas,
        "seg": req.seguimiento,
        "comp": req.compromiso,
        "missed": req.missed_miguel_meetings,
        "fscore": round(final_score, 2),
        "avg5": round(avg_5, 2),
        "obs": req.observations or "",
        "eval_by": evaluator
    })
    await db.commit()
    r = res.fetchone()

    return {
        "status": "success",
        "id": r.id,
        "matchmaker_name": req.matchmaker_name,
        "period": f"{req.month:02d}/{req.year}",
        "average_5": float(r.average_5),
        "final_score_100": float(r.final_score_100),
        "missed_miguel_penalty_pts": penalty,
        "message": f"Evaluación guardada: {float(r.final_score_100):.1f} / 100 pts ({float(r.average_5):.2f}/5)"
    }

