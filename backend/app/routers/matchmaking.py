"""
Matchmaking Operational Router — Single Source of Truth (SSOT)
Implements:
1. Mis Matches (Psychologist view with 3 slots, CRM autocompletion & lock on approval)
2. Cola de Aprobación (María 1-click approval)
3. Servicio al Cliente (Pendientes, En Pausa, En Pausa Indefinida, Trouble Matches with automated transition matrix)
4. Calendario de Citas (WhatsApp message generator templates, feedback & reschedule)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import os
import re

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.config import get_settings
from app.core.permissions import require_permission

router = APIRouter(prefix="/api/v1/matchmaking", tags=["Matchmaking Operational"])

# ─── COLOR & CATALOG CONSTANTS ───────────────────────────────────────────────

PREF_COLORS = {
    "hetero": "#CFE2F3",
    "gay": "#FCE5CD",
    "lesb": "#D9D2E9",
    "bi": "#D9D9D9",
}

PLAN_COLORS = {
    "Básico 40k": "#F3F3F3",
    "Estándar 65k (1 cita)": "#D9EAD3",
    "Estándar 65k (2 citas)": "#B6D7A8",
    "Estándar Plus 98k": "#A2C4C9",
    "Premium 150k": "#C9DAF8",
    "VIP 195k": "#FFE599",
}

STATUS_COLORS = {
    "APROBADO": "#B6D7A8",
    "HECHO": "#A2C4C9",
    "CITA COMPLETADA": "#6AA84F",
    "Listo para match": "#FFE599",
    "EN PAUSA": "#F9CB9C",
    "EN PAUSA INDEFINIDA": "#B4A7D6",
    "TROUBLE": "#FF6B35",
    "TROUBLEMAKER": "#FF6B35",
    "DESCALIFICADO": "#CCCCCC",
    "EN ESPERA": "#D9D2E9",
    "PENDIENTE": "#FFF2CC",
    "REFUND": "#EA9999",
    "NO MATCH/CAMBIAR": "#F4CCCC",
    "REQUEST PROFILE UPDATE": "#C9DAF8",
    "REVISAR": "#D5A6BD",
    "HACER OTRO MATCH": "#B4A7D6",
    "NO HAY GENTE": "#E69138",
}

ALLOWED_STATUSES = [
    "HECHO", "DESCALIFICADO", "TROUBLE", "TROUBLEMAKER", "Listo para match",
    "EN PAUSA", "EN PAUSA INDEFINIDA", "CITA COMPLETADA", "EN ESPERA", "PENDIENTE",
    "REFUND", "NO MATCH/CAMBIAR", "REQUEST PROFILE UPDATE", "REVISAR",
    "HACER OTRO MATCH", "NO HAY GENTE"
]

CONFIRMATION_OPTIONS = [
    "Pendiente", "Listo para escribir", "No contesta", "De viaje",
    "Problema personal", "Reprogramar", "Viaje largo / indefinido",
    "Aceptó", "Rechazó"
]

# ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

def normalize_pref(val: Optional[str]) -> str:
    if not val:
        return "hetero"
    v = val.lower().strip()
    if "bi" in v:
        return "bi"
    if "lesb" in v:
        return "lesb"
    if "gay" in v or "homo" in v:
        return "gay"
    return "hetero"

def normalize_city(raw_city: Optional[str]) -> str:
    if not raw_city:
        return ""
    c = str(raw_city).strip()
    if not c or c in (",", "2 Dates", "Todo El Mundo"):
        return ""
    mapping = {
        "bgota": "Bogotá", "bogota": "Bogotá", "medellin": "Medellín",
        "baq": "Barranquilla", "bquilla": "Barranquilla", "quilla": "Barranquilla",
        "bmanga": "Bucaramanga", "buc": "Bucaramanga", "buca": "Bucaramanga",
        "ctg": "Cartagena", "mad": "Madrid", "mia": "Miami", "cdmx": "CDMX",
        "peira": "Pereira", "ibag": "Ibagué", "caqu": "Caquetá"
    }
    return mapping.get(c.lower(), c.title())


# ─── SCHEMAS ──────────────────────────────────────────────────────────────────

class IntakeClientRequest(BaseModel):
    person_a: str
    psychologist_name: str
    city: Optional[str] = None
    pref: Optional[str] = None
    plan_tier: Optional[str] = None
    observations: Optional[str] = None

class UpdateMatchRequest(BaseModel):
    person_b: Optional[str] = None
    status: Optional[str] = None
    observations: Optional[str] = None

class UpdateConfirmationRequest(BaseModel):
    person_a_confirmation: Optional[str] = None
    person_b_confirmation: Optional[str] = None
    pause_reason: Optional[str] = None

class UpdateCalendarDateRequest(BaseModel):
    date_time: Optional[str] = None
    venue: Optional[str] = None
    city: Optional[str] = None
    had_date: Optional[bool] = None
    feedback: Optional[str] = None
    reschedule: Optional[bool] = None


# ─── 1. PANTALLA 1: MIS MATCHES (VISTA PSICÓLOGA) ────────────────────────────

@router.get("/my-matches")
async def get_my_matches(
    psychologist: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna la lista de matches operativos.
    Si el match aún no ha sido aprobado por María, autocompleta/refresca dinámicamente
    CITY, PREF y PLAN desde la base de datos de perfiles.
    """
    query = """
        SELECT 
            m.id, m.person_a, m.person_b, m.psychologist_name, m.psychologist_id,
            m.city, m.pref, m.plan_tier, m.status, m.approved_by_maria, m.approved_at,
            m.observations, m.slot_number, m.created_at, m.updated_at,
            p.city AS profile_city, p.orientation AS profile_orientation, 
            p.gender AS profile_gender, p.plan_tier AS profile_plan_tier
        FROM operational_matches m
        LEFT JOIN users u ON LOWER(TRIM(u.name)) = LOWER(TRIM(m.person_a))
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE 1=1
    """
    params = {}

    if psychologist and psychologist.lower() not in ("all", "todas"):
        query += " AND (UPPER(m.psychologist_name) = UPPER(:psyc) OR UPPER(m.psychologist_name) LIKE UPPER(:psyc_like))"
        params["psyc"] = psychologist.strip()
        params["psyc_like"] = f"%{psychologist.strip()}%"

    if status_filter and status_filter.lower() not in ("all", "todos"):
        query += " AND UPPER(m.status) = UPPER(:st)"
        params["st"] = status_filter.strip()

    if search:
        query += " AND (m.person_a ILIKE :srch OR m.person_b ILIKE :srch OR m.city ILIKE :srch OR m.observations ILIKE :srch)"
        params["srch"] = f"%{search.strip()}%"

    query += " ORDER BY m.created_at DESC, m.id DESC"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    matches = []
    for r in rows:
        # Autocompletado CRM si no está aprobado
        is_approved = bool(r.approved_by_maria)
        
        final_city = r.city or ""
        final_pref = r.pref or "hetero"
        final_plan = r.plan_tier or ""

        if not is_approved:
            if r.profile_city:
                final_city = normalize_city(r.profile_city)
            if r.profile_orientation or r.profile_gender:
                final_pref = normalize_pref(r.profile_orientation)
            if r.profile_plan_tier:
                final_plan = r.profile_plan_tier

        matches.append({
            "id": r.id,
            "city": normalize_city(final_city),
            "pref": normalize_pref(final_pref),
            "plan_tier": final_plan,
            "person_a": r.person_a,
            "person_b": r.person_b or "",
            "fecha": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
            "status": r.status or "Listo para match",
            "approved_by_maria": is_approved,
            "approved_at": r.approved_at.isoformat() if r.approved_at else None,
            "observations": r.observations or "",
            "psychologist_name": r.psychologist_name,
            "slot_number": r.slot_number or 1,
            "status_color": STATUS_COLORS.get(r.status, "#FFF2CC"),
            "plan_color": PLAN_COLORS.get(final_plan, "#F3F3F3"),
            "pref_color": PREF_COLORS.get(final_pref, "#CFE2F3"),
            "is_locked": is_approved
        })

    return {"matches": matches, "total": len(matches)}


@router.post("/intake-client")
async def intake_client(payload: IntakeClientRequest, db: AsyncSession = Depends(get_db)):
    """
    Crea automáticamente las 3 filas idénticas (slots) para Persona A asignada a la psicóloga.
    Cruza con profiles para autocompletar CITY, PREF y PLAN.
    """
    person_a_clean = payload.person_a.strip()
    psyc_clean = payload.psychologist_name.strip()

    # Buscar datos del perfil en CRM
    prof_res = await db.execute(text("""
        SELECT p.city, p.orientation, p.gender, p.plan_tier, u.id AS user_id
        FROM users u
        JOIN profiles p ON p.user_id = u.id
        WHERE LOWER(TRIM(u.name)) = LOWER(TRIM(:n))
        LIMIT 1
    """), {"n": person_a_clean})
    prof_row = prof_res.fetchone()

    city_val = payload.city or (normalize_city(prof_row.city) if prof_row and prof_row.city else "")
    pref_val = payload.pref or (normalize_pref(prof_row.orientation) if prof_row and prof_row.orientation else "hetero")
    plan_val = payload.plan_tier or (prof_row.plan_tier if prof_row and prof_row.plan_tier else "Estándar 65k (2 citas)")
    user_id_a = prof_row.user_id if prof_row else None

    created_ids = []
    for slot in [1, 2, 3]:
        ins_res = await db.execute(text("""
            INSERT INTO operational_matches (
                person_a, user_id_a, psychologist_name, city, pref, plan_tier,
                status, approved_by_maria, observations, slot_number, created_at, updated_at
            )
            VALUES (
                :pA, :uidA, :psyc, :city, :pref, :plan,
                'Listo para match', false, :obs, :slot, NOW(), NOW()
            )
            RETURNING id
        """), {
            "pA": person_a_clean,
            "uidA": user_id_a,
            "psyc": psyc_clean,
            "city": city_val,
            "pref": pref_val,
            "plan": plan_val,
            "obs": payload.observations or "",
            "slot": slot
        })
        created_ids.append(ins_res.scalar())

    # Registrar en person_history
    await db.execute(text("""
        INSERT INTO person_history (person_name, event_type, details, created_at)
        VALUES (:name, 'INTAKE_CREATED', :det, NOW())
    """), {
        "name": person_a_clean,
        "det": f"Cliente ingresado con 3 slots asignados a psicóloga {psyc_clean} (Plan: {plan_val}, Ciudad: {city_val})"
    })

    await db.commit()
    return {"status": "success", "created_ids": created_ids, "person_a": person_a_clean, "slots": 3}


@router.get("/intake-list")
async def get_intake_list(
    psychologist: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna la lista agregada de clientes en Intake (PROFILES), agrupados por Persona A
    con la cantidad de slots asignados, psicóloga asignada, ciudad, preferencia y plan.
    """
    query = """
        SELECT 
            person_a,
            psychologist_name,
            city,
            pref,
            plan_tier,
            COUNT(id) as total_slots,
            COUNT(CASE WHEN person_b IS NOT NULL AND person_b != '' THEN 1 END) as filled_slots,
            COUNT(CASE WHEN approved_by_maria = true THEN 1 END) as approved_slots,
            MAX(created_at) as created_at
        FROM operational_matches
        WHERE 1=1
    """
    params = {}
    if psychologist and psychologist.lower() != 'all':
        query += " AND UPPER(psychologist_name) = UPPER(:psyc)"
        params["psyc"] = psychologist.strip()
    if search:
        query += " AND (person_a ILIKE :s OR city ILIKE :s OR psychologist_name ILIKE :s)"
        params["s"] = f"%{search.strip()}%"

    query += """
        GROUP BY person_a, psychologist_name, city, pref, plan_tier
        ORDER BY MAX(created_at) DESC
    """

    res = await db.execute(text(query), params)
    rows = res.fetchall()

    clients = []
    for r in rows:
        clients.append({
            "person_a": r.person_a,
            "psychologist_name": r.psychologist_name,
            "city": r.city or "Bogotá",
            "pref": r.pref or "hetero",
            "plan_tier": r.plan_tier or "Estándar 65k (2 citas)",
            "total_slots": r.total_slots,
            "filled_slots": r.filled_slots,
            "approved_slots": r.approved_slots,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
            "pref_color": PREF_COLORS.get(r.pref, "#CFE2F3"),
            "plan_color": PLAN_COLORS.get(r.plan_tier, "#B6D7A8")
        })

    return {"clients": clients, "total": len(clients)}



@router.patch("/matches/{match_id}")
async def update_match(match_id: int, payload: UpdateMatchRequest, db: AsyncSession = Depends(get_db)):
    """
    Actualiza Persona B, Status y Observaciones.
    REGLA: Si approved_by_maria = true, la fila está 100% bloqueada contra edición.
    REGLA: El estado 'APROBADO' no es seleccionable.
    """
    exist_res = await db.execute(text("SELECT id, person_a, approved_by_maria, status FROM operational_matches WHERE id = :id"), {"id": match_id})
    match_row = exist_res.fetchone()

    if not match_row:
        raise HTTPException(status_code=404, detail="Match no encontrado")

    if match_row.approved_by_maria:
        raise HTTPException(
            status_code=403,
            detail="Fila bloqueada: este match ya fue aprobado por María y no puede ser modificado por la psicóloga."
        )

    if payload.status and payload.status.upper() == "APROBADO":
        raise HTTPException(
            status_code=400,
            detail="El estado APROBADO solo puede ser asignado por María en la Cola de Aprobación."
        )

    updates = []
    params = {"id": match_id}

    if payload.person_b is not None:
        updates.append("person_b = :pb")
        params["pb"] = payload.person_b.strip()

    if payload.status is not None:
        st_clean = payload.status.strip()
        if st_clean not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail=f"Estado no válido: {st_clean}")
        updates.append("status = :st")
        params["st"] = st_clean

    if payload.observations is not None:
        updates.append("observations = :obs")
        params["obs"] = payload.observations.strip()

    updates.append("updated_at = NOW()")

    await db.execute(text(f"UPDATE operational_matches SET {', '.join(updates)} WHERE id = :id"), params)

    if payload.status == "HECHO":
        await db.execute(text("""
            INSERT INTO person_history (person_name, match_id, event_type, details, created_at)
            VALUES (:name, :mid, 'MARKED_HECHO', 'Psicóloga marcó el match como HECHO (enviado a revisión)', NOW())
        """), {"name": match_row.person_a, "mid": match_id})

    await db.commit()
    return {"status": "success", "message": f"Match {match_id} actualizado exitosamente"}


# ─── 2. PANTALLA 2: COLA DE APROBACIÓN (MARÍA) ──────────────────────────────

@router.get("/approval-queue")
async def get_approval_queue(
    psychologist: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna todos los matches en estado 'HECHO' que aún no han sido aprobados por María.
    """
    query = """
        SELECT 
            id, psychologist_name, person_a, person_b, city, plan_tier, pref,
            created_at, updated_at, observations
        FROM operational_matches
        WHERE status = 'HECHO' AND approved_by_maria = false
    """
    params = {}

    if psychologist and psychologist.lower() not in ("all", "todas"):
        query += " AND UPPER(psychologist_name) = UPPER(:psyc)"
        params["psyc"] = psychologist.strip()

    query += " ORDER BY updated_at DESC"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    queue = [
        {
            "id": r.id,
            "psychologist_name": r.psychologist_name,
            "person_a": r.person_a,
            "person_b": r.person_b or "",
            "city": normalize_city(r.city),
            "plan_tier": r.plan_tier or "Estándar 65k",
            "pref": normalize_pref(r.pref),
            "fecha_hecho": r.updated_at.strftime("%Y-%m-%d %H:%M") if r.updated_at else "",
            "observations": r.observations or "",
            "plan_color": PLAN_COLORS.get(r.plan_tier, "#F3F3F3")
        }
        for r in rows
    ]

    return {"queue": queue, "total": len(queue)}


@router.post("/matches/{match_id}/approve")
async def approve_match_by_maria(match_id: int, db: AsyncSession = Depends(get_db)):
    """
    ACCIÓN ÚNICA DE MARÍA:
    1. Marca status = 'APROBADO', approved_by_maria = true, approved_at = now().
    2. Bloquea la fila en la vista de psicóloga para siempre.
    3. Copia el match a match_confirmations (Servicio al Cliente - Pendientes).
    4. Registra en person_history para Persona A y Persona B.
    """
    exist_res = await db.execute(text("""
        SELECT id, person_a, person_b, psychologist_name, city, plan_tier, pref, approved_by_maria
        FROM operational_matches
        WHERE id = :id
    """), {"id": match_id})
    match_row = exist_res.fetchone()

    if not match_row:
        raise HTTPException(status_code=404, detail="Match no encontrado")

    if match_row.approved_by_maria:
        return {"status": "already_approved", "message": f"Match {match_id} ya fue aprobado previamente."}

    # 1. Actualizar estado y bloquear fila
    await db.execute(text("""
        UPDATE operational_matches
        SET status = 'APROBADO', approved_by_maria = true, approved_at = NOW(), updated_at = NOW()
        WHERE id = :id
    """), {"id": match_id})

    # 2. Copiar hacia match_confirmations (Pendientes)
    await db.execute(text("""
        INSERT INTO match_confirmations (match_id, person_a_confirmation, person_b_confirmation, stage, created_at, updated_at)
        VALUES (:mid, 'Pendiente', 'Pendiente', 'pendientes', NOW(), NOW())
        ON CONFLICT (match_id) DO NOTHING
    """), {"mid": match_id})

    # 3. Registrar trazabilidad
    pA = match_row.person_a
    pB = match_row.person_b or "Candidato B"

    det = f"Match aprobado por María ({pA} x {pB}, Psicóloga: {match_row.psychologist_name}) — transferido a Pendientes de confirmación"
    await db.execute(text("INSERT INTO person_history (person_name, match_id, event_type, details, created_at) VALUES (:n, :mid, 'MATCH_APPROVED', :d, NOW())"), {"n": pA, "mid": match_id, "d": det})
    if pB and pB != "Candidato B":
        await db.execute(text("INSERT INTO person_history (person_name, match_id, event_type, details, created_at) VALUES (:n, :mid, 'MATCH_APPROVED', :d, NOW())"), {"n": pB, "mid": match_id, "d": det})

    await db.commit()
    return {"status": "success", "match_id": match_id, "message": f"Match {match_id} aprobado exitosamente y transferido a Pendientes."}


# ─── 3. PANTALLA 3: SERVICIO AL CLIENTE (PENDIENTES & PAUSAS) ────────────────

@router.get("/confirmations")
async def get_confirmations(
    stage: str = Query("pendientes", regex="^(pendientes|en_pausa|en_pausa_indefinida|trouble)$"),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna la lista de matches según la pestaña seleccionada:
    - 'pendientes'
    - 'en_pausa'
    - 'en_pausa_indefinida'
    - 'trouble'
    """
    query = """
        SELECT 
            c.id AS confirmation_id, c.match_id, c.person_a_confirmation, c.person_b_confirmation,
            c.stage, c.pause_reason, c.created_at AS date_approved, c.updated_at,
            m.person_a, m.person_b, m.psychologist_name, m.city, m.plan_tier, m.pref,
            uA.phone AS phone_a, uB.phone AS phone_b
        FROM match_confirmations c
        JOIN operational_matches m ON m.id = c.match_id
        LEFT JOIN users uA ON LOWER(TRIM(uA.name)) = LOWER(TRIM(m.person_a))
        LEFT JOIN users uB ON LOWER(TRIM(uB.name)) = LOWER(TRIM(m.person_b))
        WHERE c.stage = :st
    """
    params = {"st": stage}

    if search:
        query += " AND (m.person_a ILIKE :srch OR m.person_b ILIKE :srch OR m.city ILIKE :srch OR m.psychologist_name ILIKE :srch)"
        params["srch"] = f"%{search.strip()}%"

    query += " ORDER BY c.updated_at DESC, c.id DESC"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    confirmations = [
        {
            "confirmation_id": r.confirmation_id,
            "match_id": r.match_id,
            "person_a": r.person_a,
            "phone_a": r.phone_a or "+573000000000",
            "person_a_confirmation": r.person_a_confirmation or "Pendiente",
            "person_b": r.person_b or "",
            "phone_b": r.phone_b or "+573000000000",
            "person_b_confirmation": r.person_b_confirmation or "Pendiente",
            "psychologist_name": r.psychologist_name,
            "city": normalize_city(r.city),
            "plan_tier": r.plan_tier or "Estándar 65k",
            "pref": normalize_pref(r.pref),
            "stage": r.stage,
            "pause_reason": r.pause_reason or "",
            "fecha_aprobado": r.date_approved.strftime("%Y-%m-%d %H:%M") if r.date_approved else ""
        }
        for r in rows
    ]

    return {"confirmations": confirmations, "stage": stage, "total": len(confirmations)}


@router.patch("/confirmations/{confirmation_id}")
async def update_confirmation(
    confirmation_id: int,
    payload: UpdateConfirmationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza la confirmación de Persona A y/o Persona B en la fila actual.
    
    PRINCIPIO DEL EXCEL (NUNCA SE BORRA / COPIA HACIA ADELANTE):
    1. La fila original se actualiza con sus confirmaciones, pero NUNCA cambia su stage (permanece en 'pendientes' o 'en_pausa' como historial permanente).
    2. Cuando la matriz de transición determina un nuevo destino (Calendario, Trouble, En Pausa, En Pausa Indefinida),
       se realiza un INSERT de una fila NUEVA en la tabla/pestaña correspondiente (copiando match_id, confirmaciones y motivo),
       manteniendo el registro de origen intacto y visible.
    """
    res = await db.execute(text("""
        SELECT c.id, c.match_id, c.person_a_confirmation, c.person_b_confirmation, c.stage, c.pause_reason,
               m.person_a, m.person_b, m.city, m.psychologist_name
        FROM match_confirmations c
        JOIN operational_matches m ON m.id = c.match_id
        WHERE c.id = :id
    """), {"id": confirmation_id})
    row = res.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Confirmación no encontrada")

    conf_a = payload.person_a_confirmation if payload.person_a_confirmation is not None else (row.person_a_confirmation or "Pendiente")
    conf_b = payload.person_b_confirmation if payload.person_b_confirmation is not None else (row.person_b_confirmation or "Pendiente")
    reason = payload.pause_reason or row.pause_reason

    # 1. Actualizar confirmaciones en la fila original SIN modificar su stage (se queda en su pestaña de origen para siempre)
    await db.execute(text("""
        UPDATE match_confirmations
        SET person_a_confirmation = :cA,
            person_b_confirmation = :cB,
            pause_reason = :pr,
            updated_at = NOW()
        WHERE id = :id
    """), {"id": confirmation_id, "cA": conf_a, "cB": conf_b, "pr": reason})

    # 2. Evaluar matriz de transición y COPIAR HACIA ADELANTE (INSERT nueva fila)
    target_stage = None

    if conf_a == "Aceptó" and conf_b == "Aceptó":
        target_stage = "calendario"
        # Verificar si ya existe una cita para este match_id en Calendario para evitar duplicados
        existing_cal = await db.execute(text("""
            SELECT id FROM scheduled_dates WHERE match_id = :mid LIMIT 1
        """), {"mid": row.match_id})
        if not existing_cal.fetchone():
            # Copiar hacia Calendario (scheduled_dates)
            await db.execute(text("""
                INSERT INTO scheduled_dates (
                    match_id, person_a, person_b, date_time, venue, city, reservation_name, created_at, updated_at
                ) VALUES (
                    :mid, :pA, :pB, 'Por definir', 'Restaurante Por definir', :city, 'María Paula Salinas', NOW(), NOW()
                )
            """), {
                "mid": row.match_id,
                "pA": row.person_a,
                "pB": row.person_b,
                "city": normalize_city(row.city)
            })
            
            await db.execute(text("""
                INSERT INTO person_history (person_name, match_id, event_type, details, created_at)
                VALUES (:name, :mid, 'DATE_SCHEDULED', 'Ambas partes aceptaron — copiado a Calendario (registro conservado en Pendientes)', NOW())
            """), {"name": row.person_a, "mid": row.match_id})

    elif conf_a == "Rechazó" or conf_b == "Rechazó":
        target_stage = "trouble"
        who = "Persona A" if conf_a == "Rechazó" else "Persona B"
        # Verificar si ya existe en Trouble Matches para este match_id
        existing_trouble = await db.execute(text("""
            SELECT id FROM match_confirmations WHERE match_id = :mid AND stage = 'trouble' LIMIT 1
        """), {"mid": row.match_id})
        if row.stage != "trouble" and not existing_trouble.fetchone():
            await db.execute(text("""
                INSERT INTO match_confirmations (
                    match_id, person_a_confirmation, person_b_confirmation, stage, pause_reason, created_at, updated_at
                ) VALUES (
                    :mid, :cA, :cB, 'trouble', :pr, NOW(), NOW()
                )
            """), {
                "mid": row.match_id,
                "cA": conf_a,
                "cB": conf_b,
                "pr": reason or f"Rechazado por {who}"
            })
        
            await db.execute(text("""
                INSERT INTO person_history (person_name, match_id, event_type, details, created_at)
                VALUES (:name, :mid, 'TROUBLE_REJECTED', :det, NOW())
            """), {"name": row.person_a, "mid": row.match_id, "det": f"Match rechazado por {who} — copiado a Trouble Matches"})

    elif conf_a == "Viaje largo / indefinido" or conf_b == "Viaje largo / indefinido":
        target_stage = "en_pausa_indefinida"
        existing_pi = await db.execute(text("""
            SELECT id FROM match_confirmations WHERE match_id = :mid AND stage = 'en_pausa_indefinida' LIMIT 1
        """), {"mid": row.match_id})
        if row.stage != "en_pausa_indefinida" and not existing_pi.fetchone():
            await db.execute(text("""
                INSERT INTO match_confirmations (
                    match_id, person_a_confirmation, person_b_confirmation, stage, pause_reason, created_at, updated_at
                ) VALUES (
                    :mid, :cA, :cB, 'en_pausa_indefinida', 'Viaje largo / indefinido', NOW(), NOW()
                )
            """), {
                "mid": row.match_id,
                "cA": conf_a,
                "cB": conf_b
            })

    elif any(c in ["No contesta", "De viaje", "Problema personal", "Reprogramar"] for c in [conf_a, conf_b]):
        target_stage = "en_pausa"
        pause_r = reason or next((c for c in [conf_a, conf_b] if c in ["No contesta", "De viaje", "Problema personal", "Reprogramar"]), "Pausa temporal")
        existing_p = await db.execute(text("""
            SELECT id FROM match_confirmations WHERE match_id = :mid AND stage = 'en_pausa' LIMIT 1
        """), {"mid": row.match_id})
        if row.stage != "en_pausa" and not existing_p.fetchone():
            await db.execute(text("""
                INSERT INTO match_confirmations (
                    match_id, person_a_confirmation, person_b_confirmation, stage, pause_reason, created_at, updated_at
                ) VALUES (
                    :mid, :cA, :cB, 'en_pausa', :pr, NOW(), NOW()
                )
            """), {
                "mid": row.match_id,
                "cA": conf_a,
                "cB": conf_b,
                "pr": pause_r
            })

    await db.commit()
    return {
        "status": "success",
        "original_stage": row.stage,
        "copied_to_stage": target_stage,
        "person_a_confirmation": conf_a,
        "person_b_confirmation": conf_b
    }


# ─── 4. PANTALLA 4: CALENDARIO DE CITAS & WHATSAPP ──────────────────────────

@router.get("/calendar")
async def get_calendar_dates(db: AsyncSession = Depends(get_db)):
    """
    Retorna la lista de citas agendadas con los datos formateados para los mensajes de WhatsApp.
    """
    res = await db.execute(text("""
        SELECT 
            id, match_id, person_a, person_b, date_time, venue, city,
            reservation_name, had_date, feedback, reschedule, created_at, updated_at
        FROM scheduled_dates
        ORDER BY updated_at DESC, id DESC
    """))
    rows = res.fetchall()

    dates = []
    for r in rows:
        dt_val = r.date_time or "Fecha por definir"
        ven_val = r.venue or "Lugar por definir"
        
        # Plantillas de WhatsApp con textos exactos del SSOT
        msg_confirmacion = (
            f"Para confirmarte tu date! 💛 Fecha y hora: {dt_val} en {ven_val}\n"
            f"La reserva estará a nombre de {r.reservation_name}.\n"
            f"El restaurante estará atento para ayudarte a ubicarte y acompañarte con cualquier detalle logístico o de seguridad.\n\n"
            f"Además, ese mismo día en la mañana te escribiremos para estar pendientes de ti y acompañarte *antes, durante y después de la cita*, para que solo tengas que disfrutar la experiencia.💌💌\n"
            f"Gracias por confiar en nosotras y por permitirnos ser parte de este momento💓"
        )

        msg_dia_antes = (
            f"Para recordarte tu date de mañana! 💛 Fecha y hora: {dt_val} en {ven_val} "
            f"Esperamos tu confirmación para asegurarnos de que la cita este en pie!"
        )

        msg_hoy = (
            f"Para recordarte tu date de hoy! 💛 Fecha y hora: {dt_val} en {ven_val}\n"
            f"La reserva estará a nombre de {r.reservation_name}!! Por favor avisanos cuando vayas en camino para estar pendiente de ti! "
            f"Recuerda que hay alguien que te esta esperando, y la puntualidas vale X2!! Disfrútalo muchísimo, es solo una cita!! "
            f"Avísanos cuando vayas en camino para estar pendiente de tiii!"
        )

        row_status_color = "#FFF2CC" # Amarillo pendiente
        if r.had_date:
            row_status_color = "#6AA84F" # Verde completada
        elif r.reschedule:
            row_status_color = "#F9CB9C" # Naranja reprogramar

        dates.append({
            "id": r.id,
            "match_id": r.match_id,
            "person_a": r.person_a,
            "person_b": r.person_b,
            "date_time": dt_val,
            "venue": ven_val,
            "city": normalize_city(r.city),
            "reservation_name": r.reservation_name,
            "had_date": bool(r.had_date),
            "feedback": r.feedback or "",
            "reschedule": bool(r.reschedule),
            "whatsapp_confirmacion": msg_confirmacion,
            "whatsapp_dia_antes": msg_dia_antes,
            "whatsapp_hoy": msg_hoy,
            "status_color": row_status_color
        })

    return {"calendar": dates, "total": len(dates)}


@router.patch("/calendar/{calendar_id}")
async def update_calendar_date(
    calendar_id: int,
    payload: UpdateCalendarDateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza fecha, lugar, feedback o reprogramación.
    REGLA: Si had_date = true y hay feedback, el STATUS del match original cambia a 'CITA COMPLETADA'.
    REGLA: Si reschedule = true, clona la pareja a 'En Pausa' con motivo 'Reprogramar'.
    """
    res = await db.execute(text("SELECT id, match_id, person_a, person_b FROM scheduled_dates WHERE id = :id"), {"id": calendar_id})
    cal_row = res.fetchone()

    if not cal_row:
        raise HTTPException(status_code=404, detail="Cita en calendario no encontrada")

    updates = []
    params = {"id": calendar_id}

    if payload.date_time is not None:
        updates.append("date_time = :dt")
        params["dt"] = payload.date_time.strip()

    if payload.venue is not None:
        updates.append("venue = :ven")
        params["ven"] = payload.venue.strip()

    if payload.city is not None:
        updates.append("city = :c")
        params["c"] = normalize_city(payload.city)

    if payload.had_date is not None:
        updates.append("had_date = :hd")
        params["hd"] = payload.had_date

    if payload.feedback is not None:
        updates.append("feedback = :fb")
        params["fb"] = payload.feedback.strip()

    if payload.reschedule is not None:
        updates.append("reschedule = :rs")
        params["rs"] = payload.reschedule

    updates.append("updated_at = NOW()")

    await db.execute(text(f"UPDATE scheduled_dates SET {', '.join(updates)} WHERE id = :id"), params)

    # 1. Cita completada con feedback -> actualiza match original a 'CITA COMPLETADA'
    if payload.had_date and payload.feedback and cal_row.match_id:
        await db.execute(text("""
            UPDATE operational_matches
            SET status = 'CITA COMPLETADA', updated_at = NOW()
            WHERE id = :mid
        """), {"mid": cal_row.match_id})

        await db.execute(text("""
            INSERT INTO person_history (person_name, match_id, event_type, details, created_at)
            VALUES (:name, :mid, 'DATE_COMPLETED', :det, NOW())
        """), {"name": cal_row.person_a, "mid": cal_row.match_id, "det": f"Cita completada — {payload.feedback}"})

    # 2. Reprogramación -> COPIA HACIA ADELANTE (INSERT) a 'en_pausa' con motivo 'Reprogramar'
    if payload.reschedule and cal_row.match_id:
        await db.execute(text("""
            INSERT INTO match_confirmations (
                match_id, person_a_confirmation, person_b_confirmation, stage, pause_reason, created_at, updated_at
            ) VALUES (
                :mid, 'Aceptó', 'Aceptó', 'en_pausa', 'Reprogramar', NOW(), NOW()
            )
        """), {"mid": cal_row.match_id})

        await db.execute(text("""
            INSERT INTO person_history (person_name, match_id, event_type, details, created_at)
            VALUES (:name, :mid, 'DATE_RESCHEDULED', 'Cita marcada para reprogramar — copiada a En Pausa (registro original conservado en Calendario)', NOW())
        """), {"name": cal_row.person_a, "mid": cal_row.match_id})

    await db.commit()
    return {"status": "success", "message": f"Cita {calendar_id} actualizada correctamente"}


# ─── 5. HISTORIAL DE PERSONA & PSICÓLOGAS ACTIVAS ────────────────────────────

@router.get("/psychologists")
async def get_active_psychologists(db: AsyncSession = Depends(get_db)):
    """
    Retorna la lista de psicólogas dinámicamente desde la base de datos (con conteos reales),
    asegurando la presencia de las psicólogas activas oficiales (JENN, ANA, SILVI, STEFFY, SOFI, MAPE D, ALEJA, MANU 1, MANU 2, PIA).
    """
    OFFICIAL_PSYCHOLOGISTS = [
        "JENN", "ANA", "SILVI", "STEFFY", "SOFI", "MAPE D", "ALEJA", "MANU 1", "MANU 2", "PIA"
    ]
    res = await db.execute(text("""
        SELECT UPPER(TRIM(psychologist_name)) as psyc_name, 
               COUNT(*) as match_count,
               COUNT(DISTINCT person_a) as client_count
        FROM operational_matches
        WHERE psychologist_name IS NOT NULL AND TRIM(psychologist_name) != ''
        GROUP BY UPPER(TRIM(psychologist_name))
        ORDER BY match_count DESC
    """))
    db_rows = res.fetchall()
    counts = {r[0]: {"name": r[0], "match_count": r[1], "client_count": r[2]} for r in db_rows}

    result = []
    # 1. Official list first in canonical order
    for name in OFFICIAL_PSYCHOLOGISTS:
        key = name.upper()
        match_c = counts.get(key, {}).get("match_count", 0)
        client_c = counts.get(key, {}).get("client_count", 0)
        result.append({
            "name": name,
            "match_count": match_c,
            "client_count": client_c
        })

    # 2. Any additional active names in DB
    for key, val in counts.items():
        if key not in [p.upper() for p in OFFICIAL_PSYCHOLOGISTS]:
            result.append({
                "name": val["name"],
                "match_count": val["match_count"],
                "client_count": val["client_count"]
            })

    return {"psychologists": result, "names": [p["name"] for p in result]}


@router.get("/history/{person_name}")
async def get_person_history(person_name: str, db: AsyncSession = Depends(get_db)):
    """
    Retorna la trazabilidad completa y permanente de todas las citas y eventos de una persona.
    """
    clean_name = person_name.strip()
    res = await db.execute(text("""
        SELECT id, person_name, match_id, event_type, details, created_at
        FROM person_history
        WHERE LOWER(TRIM(person_name)) = LOWER(TRIM(:n))
        ORDER BY created_at DESC
    """), {"n": clean_name})
    rows = res.fetchall()

    history = [
        {
            "id": r.id,
            "person_name": r.person_name,
            "match_id": r.match_id,
            "event_type": r.event_type,
            "details": r.details,
            "fecha": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else ""
        }
        for r in rows
    ]

    return {"person_name": clean_name, "events": history, "total": len(history)}

