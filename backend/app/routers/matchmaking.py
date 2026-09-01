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
    "HECHO POR MAPE": "#A2C4C9",
    "NOT APPROVED": "#F4CCCC",
    "TROUBLE": "#FF6B35",
    "TROUBLEMAKER": "#FF6B35",
    "REFUND": "#EA9999",
    "REFUND DONE": "#D9EAD3",
    "REFUND APROBADO": "#B6D7A8",
    "REFUND RECHAZADO": "#F4CCCC",
    "REFUND PENDIENTE": "#FFF2CC",
    "REFUND PROCESADO": "#D9EAD3",
    "DESCALIFICADO": "#CCCCCC",
    "NO HAY GENTE": "#FCE5CD",
    "ESPERA O REFUND": "#F4CCCC",
    "REVISAR": "#D5A6BD",
    "REVISAR POR SI TOCA OTRO MATCH": "#B4A7D6",
    "MATCH DONE": "#6AA84F",
    "RESUELTO": "#D9EAD3",
    "Pendiente": "#E8EAED",
    "PENDIENTE": "#E8EAED",
    "Urgente": "#E06666",
    "Listo para match": "#FFE599",
    "REQUEST PROFILE UPDATE": "#C9DAF8",
    "EN PAUSA": "#F9CB9C",
    "EN PAUSA INDEFINIDA": "#B4A7D6",
    "CITA COMPLETADA": "#6AA84F",
    "EN ESPERA": "#D9D2E9",
    "RECHAZADA POR PSICÓLOGA B": "#F4CCCC",
    "RECHAZADO POR PSICÓLOGA B": "#F4CCCC",
}

ALLOWED_STATUSES = [
    "HECHO", "HECHO POR MAPE", "NOT APPROVED", "TROUBLE", "TROUBLEMAKER",
    "REFUND", "REFUND DONE", "REFUND APROBADO", "REFUND RECHAZADO", "REFUND PENDIENTE", "REFUND PROCESADO",
    "DESCALIFICADO", "NO HAY GENTE", "ESPERA O REFUND", "REVISAR",
    "REVISAR POR SI TOCA OTRO MATCH", "MATCH DONE", "RESUELTO", "Pendiente",
    "Urgente", "Listo para match", "REQUEST PROFILE UPDATE",
    "EN PAUSA", "EN PAUSA INDEFINIDA", "CITA COMPLETADA", "EN ESPERA",
    "RECHAZADA POR PSICÓLOGA B", "RECHAZADO POR PSICÓLOGA B"
]

def get_slots_by_plan(plan_str: Optional[str]) -> Optional[int]:
    """
    Retorna la cantidad exacta de slots según el plan activo (SSOT v2):
    - Básico 40k (1 cita) -> 2 slots
    - Estándar 65k (2 citas) -> 3 slots
    - VIP 195k -> 4 slots
    Si el plan está vacío o no es reconocido, retorna None para obligar a validación explícita.
    """
    if not plan_str or not str(plan_str).strip():
        return None
    p = str(plan_str).lower().strip()
    if "vip" in p:
        return 4
    elif "40k" in p or "básico" in p or "basico" in p or "1 cita" in p:
        return 2
    elif "65k" in p or "estándar" in p or "estandar" in p or "2 citas" in p or "98k" in p:
        return 3
    return None

CONFIRMATION_OPTIONS = [
    "Pendiente", "Listo para escribir", "No contesta", "De viaje",
    "Problema personal", "Reprogramar", "Viaje largo / indefinido",
    "Aceptó", "Rechazó"
]

# ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

def normalize_pref(val: Optional[str]) -> str:
    if not val:
        return ""
    v = val.lower().strip()
    if "bi" in v:
        return "bi"
    if "lesb" in v:
        return "lesb"
    if "gay" in v or "homo" in v:
        return "gay"
    if "hetero" in v or "straight" in v:
        return "hetero"
    return ""

def normalize_city(raw_city: Optional[str]) -> str:
    if not raw_city:
        return ""
    c = str(raw_city).strip()
    if not c:
        return ""
    c_lower = c.lower()
    # Descartar ruidos, textos de estado, encabezados o comentarios de slots
    if any(noise in c_lower for noise in [
        "slot", "exist", "hist", "jenn", "silvi", "ana", "steffy", "sofi", "aleja", "pia", "manu", "mape",
        "none", "null", "nan", ",", "2 dates", "todo el mundo", "refound", "refund", "true", "false", "status", "revisar"
    ]):
        return ""
    mapping = {
        "bgota": "Bogotá", "bogota": "Bogotá", "bog": "Bogotá",
        "medellin": "Medellín", "med": "Medellín",
        "baq": "Barranquilla", "bquilla": "Barranquilla", "quilla": "Barranquilla",
        "bmanga": "Bucaramanga", "buc": "Bucaramanga", "buca": "Bucaramanga",
        "ctg": "Cartagena", "cartagena": "Cartagena",
        "mad": "Madrid", "madrid": "Madrid",
        "mia": "Miami", "miami": "Miami",
        "cdmx": "CDMX", "mexico": "CDMX", "méxico": "CDMX",
        "peira": "Pereira", "pereira": "Pereira",
        "ibag": "Ibagué", "ibague": "Ibagué", "cali": "Cali", "caqu": "Caquetá"
    }
    # Si viene con texto extra como 'Bogotá 28 años'
    for k, v in mapping.items():
        if k in c_lower:
            return v
    return c.title()


def is_valid_person_name(val: Optional[str]) -> bool:
    """
    Valida si una cadena corresponde a un nombre real de persona.
    Descarta fechas, notas clínicas, estados ('PIDIO REFOUND', 'SLOTS...', etc.).
    """
    if not val:
        return False
    s = str(val).strip()
    if not s or len(s) < 3:
        return False
    # Descartar fechas ISO o formatos de fecha
    if re.match(r'^\d{4}-\d{2}-\d{2}', s) or re.match(r'^\d{1,2}/\d{1,2}/\d{4}', s):
        return False
    s_upper = s.upper()
    invalid_keywords = [
        "PIDIO REFOUND", "REFOUND", "REFUND", "SLOT", "SLOTS", "HISTÓRICO", "HISTORICO",
        "NAME", "NOMBRE", "PERSONA A", "PERSONA B", "STATUS", "NO TIENE",
        "DESCALIFICADO", "TROUBLE", "SIN GENTE", "TRUE", "FALSE", "VERDADERO", "NO MATCH"
    ]
    if any(k in s_upper for k in invalid_keywords):
        return False
    # Debe contener caracteres alfabéticos
    if not re.search(r'[a-zA-ZáéíóúÁÉÍÓÚñÑ]', s):
        return False
    return True


# ─── SCHEMAS ──────────────────────────────────────────────────────────────────

class IntakeClientRequest(BaseModel):
    person_a: str
    psychologist_name: str
    city: Optional[str] = None
    pref: Optional[str] = None
    plan_tier: Optional[str] = None
    crm_id: Optional[str] = None
    observations: Optional[str] = None
    is_priority: Optional[bool] = False

class UpdateMatchRequest(BaseModel):
    person_b: Optional[str] = None
    status: Optional[str] = None
    status_a: Optional[str] = None
    status_b: Optional[str] = None
    observations: Optional[str] = None

class CheckCompatibilityRequest(BaseModel):
    person_a_crm_id: Optional[str] = None
    person_a_name: Optional[str] = None
    person_b_crm_id: Optional[str] = None
    person_b_name: Optional[str] = None
    person_b_url: Optional[str] = None

class UpdateConfirmationRequest(BaseModel):
    person_a_confirmation: Optional[str] = None
    person_b_confirmation: Optional[str] = None
    pause_reason: Optional[str] = None

class UpdateCalendarDateRequest(BaseModel):
    date_time: Optional[str] = None
    venue: Optional[str] = None
    city: Optional[str] = None
    reservation_confirmed: Optional[bool] = None
    had_date: Optional[bool] = None
    feedback: Optional[str] = None
    feedback_ella: Optional[str] = None
    feedback_el: Optional[str] = None
    reschedule: Optional[bool] = None

class ResolveProfileRequest(BaseModel):
    url_or_query: str

class RejectMatchRequest(BaseModel):
    reason: Optional[str] = "Rechazado"

class ManualRefundRequest(BaseModel):
    person_name: str
    psychologist_name: Optional[str] = "General"
    plan_tier: Optional[str] = ""
    reason: Optional[str] = "Solicitud de refund vía Servicio al Cliente / WhatsApp"


# ─── 1. PANTALLA 1: MIS MATCHES (VISTA PSICÓLOGA) ────────────────────────────

@router.get("/my-matches")
async def get_my_matches(
    psychologist: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    plan_tier: Optional[str] = Query(None),
    approved: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna la lista de matches operativos con soporte para multifiltros combinables, CRM IDs,
    detección de prioridad y cruce de psicóloga en Persona B.
    """
    query = """
        SELECT 
            m.id, m.person_a, m.person_b, m.psychologist_name, m.psychologist_id,
            m.city, m.pref, m.plan_tier, m.status, m.status_a, m.status_b, m.approved_by_maria, m.approved_at,
            m.observations, m.slot_number, m.is_priority, m.created_at, m.updated_at,
            m.person_a_crm_id, m.person_b_crm_id,
            uA.crm_id AS ua_crm_id, uB.crm_id AS ub_crm_id,
            p.city AS profile_city, p.orientation AS profile_orientation, 
            p.gender AS profile_gender, p.plan_tier AS profile_plan_tier,
            (
                SELECT mOwner.psychologist_name 
                FROM operational_matches mOwner 
                WHERE LOWER(TRIM(mOwner.person_a)) = LOWER(TRIM(m.person_b)) 
                  AND mOwner.psychologist_name IS NOT NULL 
                  AND mOwner.psychologist_name != ''
                LIMIT 1
            ) AS psyc_of_b
        FROM operational_matches m
        LEFT JOIN users uA ON LOWER(TRIM(uA.name)) = LOWER(TRIM(m.person_a))
        LEFT JOIN users uB ON LOWER(TRIM(uB.name)) = LOWER(TRIM(m.person_b))
        LEFT JOIN profiles p ON p.user_id = uA.id
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

    if city and city.lower() not in ("all", "todas"):
        query += " AND (m.city ILIKE :city OR p.city ILIKE :city)"
        params["city"] = f"%{city.strip()}%"

    if plan_tier and plan_tier.lower() not in ("all", "todos"):
        query += " AND (m.plan_tier ILIKE :plan OR p.plan_tier ILIKE :plan)"
        params["plan"] = f"%{plan_tier.strip()}%"

    if approved and approved.lower() not in ("all", "todos"):
        if approved.lower() in ("yes", "si", "sí", "true", "1", "aprobado"):
            query += " AND m.approved_by_maria = true"
        elif approved.lower() in ("no", "false", "0", "pendiente"):
            query += " AND m.approved_by_maria = false"

    if search:
        query += " AND (m.person_a ILIKE :srch OR m.person_b ILIKE :srch OR m.city ILIKE :srch OR m.observations ILIKE :srch)"
        params["srch"] = f"%{search.strip()}%"

    query += " ORDER BY m.is_priority DESC, m.created_at DESC, m.id DESC"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    matches = []
    for r in rows:
        d = dict(r._mapping)
        pA_name = d.get("person_a")
        if not is_valid_person_name(pA_name):
            continue

        is_approved = bool(d.get("approved_by_maria"))
        
        final_city = d.get("city") or ""
        final_pref = d.get("pref") or ""
        final_plan = d.get("plan_tier") or ""

        if not is_approved:
            if d.get("profile_city"):
                final_city = normalize_city(d.get("profile_city"))
            if d.get("profile_orientation") or d.get("profile_gender"):
                final_pref = normalize_pref(d.get("profile_orientation"))
            if d.get("profile_plan_tier"):
                final_plan = normalize_plan(d.get("profile_plan_tier"))

        p_b_psyc = normalize_psychologist(d.get("psyc_of_b")) or ""
        curr_psyc = normalize_psychologist(d.get("psychologist_name")) or d.get("psychologist_name")
        is_cross_locked = bool(p_b_psyc and p_b_psyc != curr_psyc and (d.get("status") in ("HECHO", "HECHO POR MAPE", "REVISAR", "PROPUESTO")))

        matches.append({
            "id": d.get("id"),
            "city": normalize_city(final_city),
            "pref": normalize_pref(final_pref),
            "plan_tier": normalize_plan(final_plan),
            "person_a": pA_name,
            "person_a_crm_id": d.get("person_a_crm_id") or d.get("ua_crm_id") or "",
            "person_b": d.get("person_b") or "",
            "person_b_crm_id": d.get("person_b_crm_id") or d.get("ub_crm_id") or "",
            "psychologist_b": p_b_psyc,
            "is_priority": bool(d.get("is_priority")),
            "fecha": d.get("created_at").strftime("%Y-%m-%d %H:%M") if d.get("created_at") else "",
            "status": d.get("status") or "Listo para match",
            "status_a": d.get("status_a") or "Listo para match",
            "status_b": d.get("status_b") or "",
            "approved_by_maria": is_approved,
            "approved_at": d.get("approved_at").isoformat() if d.get("approved_at") else None,
            "observations": d.get("observations") or "",
            "psychologist_name": curr_psyc,
            "slot_number": d.get("slot_number") or 1,
            "status_color": STATUS_COLORS.get(d.get("status"), "#FFF2CC"),
            "plan_color": PLAN_COLORS.get(final_plan, "#F3F3F3"),
            "pref_color": PREF_COLORS.get(final_pref, "#CFE2F3"),
            "is_locked": is_approved or is_cross_locked,
            "has_compatibility_alert": bool(
                "COMPATIBILIDAD FORZADA" in (d.get("observations") or "").upper() or
                "ALERTA COMPATIBILIDAD" in (d.get("observations") or "").upper() or
                "INCOMPATIBILIDAD" in (d.get("observations") or "").upper()
            ),
            "is_overdue_15d": bool(
                is_approved and d.get("approved_at") and 
                (datetime.utcnow() - d.get("approved_at")).days >= 15
            ),
            "days_in_cs": (
                (datetime.utcnow() - d.get("approved_at")).days 
                if is_approved and d.get("approved_at") else 0
            )
        })

    return {"matches": matches, "total": len(matches)}


@router.post("/intake-client")
async def intake_client(payload: IntakeClientRequest, db: AsyncSession = Depends(get_db)):
    """
    Crea automáticamente las filas de slots para Persona A asignada a la psicóloga según su plan.
    Cruza con profiles para autocompletar CITY, PREF y PLAN.
    Soporta Profile Prioritario y estados no bloqueantes (amarillo PENDIENTE PLAN).
    """
    person_a_clean = payload.person_a.strip()
    psyc_clean = payload.psychologist_name.strip()

    # Buscar datos del perfil en CRM si no vienen completos
    prof_res = await db.execute(text("""
        SELECT p.city, p.orientation, p.gender, p.plan_tier, u.id AS user_id, u.crm_id
        FROM users u
        JOIN profiles p ON p.user_id = u.id
        WHERE LOWER(TRIM(u.name)) = LOWER(TRIM(:n))
        LIMIT 1
    """), {"n": person_a_clean})
    prof_row = prof_res.fetchone()

    city_val = payload.city or (prof_row.city if prof_row else "")
    pref_val = payload.pref or (prof_row.orientation if prof_row else "")
    raw_plan = payload.plan_tier or (prof_row.plan_tier if prof_row else "")
    plan_val = normalize_plan(raw_plan)
    crm_id_val = payload.crm_id or (prof_row.crm_id if prof_row else None)

    # Si falta el plan
    if not plan_val:
        # Estado NO BLOQUEANTE: Se crea 1 fila pendiente en amarillo
        ins_res = await db.execute(text("""
            INSERT INTO operational_matches 
            (city, pref, plan_tier, person_a, psychologist_name, slot_number, is_priority, status, observations, person_a_crm_id, created_at, updated_at)
            VALUES (:city, :pref, '', :person_a, :psyc, 1, :is_prio, 'PENDIENTE PLAN', :obs, :cid, NOW(), NOW())
            RETURNING id
        """), {
            "city": normalize_city(city_val),
            "pref": normalize_pref(pref_val),
            "person_a": person_a_clean,
            "psyc": psyc_clean,
            "is_prio": bool(payload.is_priority),
            "obs": (payload.observations or "").strip() or "Falta plan — María o Servicio al Cliente lo completa",
            "cid": crm_id_val
        })
        new_id = ins_res.scalar()

        await db.execute(text("""
            INSERT INTO person_history (person_name, match_id, event_type, details, created_at)
            VALUES (:name, :mid, 'INTAKE_PENDING_PLAN', :details, NOW())
        """), {
            "name": person_a_clean,
            "mid": new_id,
            "details": f"Cliente registrado sin plan. Marcado en amarillo PENDIENTE PLAN ({psyc_clean})."
        })

        await db.commit()
        return {
            "status": "warning",
            "message": f"Cliente {person_a_clean} registrado como PENDIENTE PLAN (marcado en amarillo). Los slots se autogenerarán al completar el plan.",
            "slot_ids": [new_id]
        }

    # Calcular slots según el plan normalizado (Básico: 2, Estándar: 3, VIP: 4)
    num_slots = get_slots_by_plan(plan_val) or 3

    # Insertar los slots en operational_matches
    created_ids = []
    for slot_num in range(1, num_slots + 1):
        ins_res = await db.execute(text("""
            INSERT INTO operational_matches 
            (city, pref, plan_tier, person_a, psychologist_name, slot_number, is_priority, status, observations, person_a_crm_id, created_at, updated_at)
            VALUES (:city, :pref, :plan, :person_a, :psyc, :slot, :is_prio, 'Listo para match', :obs, :cid, NOW(), NOW())
            RETURNING id
        """), {
            "city": normalize_city(city_val),
            "pref": normalize_pref(pref_val),
            "plan": plan_val,
            "person_a": person_a_clean,
            "psyc": psyc_clean,
            "slot": slot_num,
            "is_prio": bool(payload.is_priority),
            "obs": payload.observations.strip() if payload.observations else None,
            "cid": crm_id_val
        })
        new_id = ins_res.scalar()
        created_ids.append(new_id)

    # Registrar evento en person_history
    await db.execute(text("""
        INSERT INTO person_history (person_name, match_id, event_type, details, created_at)
        VALUES (:name, :mid, 'INTAKE_CREATED', :details, NOW())
    """), {
        "name": person_a_clean,
        "mid": created_ids[0],
        "details": f"Cliente {'PRIORITARIO ' if payload.is_priority else ''}registrado en Intake por {psyc_clean}. {num_slots} slots generados ({plan_val})."
    })

    await db.commit()
    return {
        "status": "success",
        "message": f"Cliente {person_a_clean} registrado con éxito y {num_slots} slots asignados a {psyc_clean}.",
        "slot_ids": created_ids
    }


@router.get("/intake-list")
async def get_intake_list(
    psychologist: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    plan_tier: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna la lista agregada de clientes en Intake (PROFILES), agrupados por Persona A
    con la cantidad de slots asignados, psicóloga asignada, ciudad, preferencia, plan y CRM ID.
    """
    query = """
        SELECT 
            m.person_a,
            m.psychologist_name,
            m.city,
            m.pref,
            m.plan_tier,
            MAX(COALESCE(m.person_a_crm_id, u.crm_id)) as crm_id,
            COUNT(m.id) as total_slots,
            COUNT(CASE WHEN m.person_b IS NOT NULL AND m.person_b != '' THEN 1 END) as filled_slots,
            COUNT(CASE WHEN m.approved_by_maria = true THEN 1 END) as approved_slots,
            MAX(m.created_at) as created_at
        FROM operational_matches m
        LEFT JOIN users u ON LOWER(TRIM(u.name)) = LOWER(TRIM(m.person_a))
        WHERE 1=1
    """
    params = {}
    if psychologist and psychologist.lower() not in ('all', 'todas'):
        query += " AND UPPER(m.psychologist_name) = UPPER(:psyc)"
        params["psyc"] = psychologist.strip()
    if city and city.lower() not in ('all', 'todas'):
        query += " AND m.city ILIKE :city"
        params["city"] = f"%{city.strip()}%"
    if plan_tier and plan_tier.lower() not in ('all', 'todos'):
        query += " AND m.plan_tier ILIKE :plan"
        params["plan"] = f"%{plan_tier.strip()}%"
    if search:
        query += " AND (m.person_a ILIKE :s OR m.city ILIKE :s OR m.psychologist_name ILIKE :s)"
        params["s"] = f"%{search.strip()}%"

    query += """
        GROUP BY m.person_a, m.psychologist_name, m.city, m.pref, m.plan_tier
        ORDER BY MAX(m.created_at) DESC
    """

    res = await db.execute(text(query), params)
    rows = res.fetchall()

    clients = []
    for r in rows:
        if not is_valid_person_name(r.person_a):
            continue
        clients.append({
            "person_a": r.person_a,
            "crm_id": r.crm_id or "",
            "psychologist_name": normalize_psychologist(r.psychologist_name) or r.psychologist_name,
            "city": normalize_city(r.city),
            "pref": normalize_pref(r.pref),
            "plan_tier": normalize_plan(r.plan_tier),
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
    exist_res = await db.execute(text("SELECT id, person_a, person_b, approved_by_maria, status, status_a, status_b FROM operational_matches WHERE id = :id"), {"id": match_id})
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
        pb_clean = payload.person_b.strip()
        if match_row.person_b and not pb_clean:
            raise HTTPException(status_code=400, detail="Prohibido borrar Persona B una vez asignada.")

        if pb_clean:
            if "http" in pb_clean or "smartmatchapp" in pb_clean or "client/" in pb_clean:
                extracted_cid = None
                m = re.search(r"(?:client|profile|view)[/=#!]+(\d+)", pb_clean, re.IGNORECASE) or re.search(r"[?&]id=(\d+)", pb_clean, re.IGNORECASE)
                if m:
                    extracted_cid = m.group(1)

                resolved_user = None
                if extracted_cid:
                    u_res = await db.execute(text("SELECT u.name, p.responsable FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.crm_id = :cid LIMIT 1"), {"cid": extracted_cid})
        effective_b = payload.person_b.strip()
        updates.append("person_b = :pb")
        params["pb"] = effective_b

    if payload.status is not None:
        st_clean = payload.status.strip()
        if st_clean not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail=f"Estado no válido: {st_clean}")

        # Validación estricta para HECHO: Persona A y Persona B requeridas
        if st_clean in ("HECHO", "HECHO POR MAPE"):
            effective_person_b = params.get("pb") or match_row.person_b
            if not match_row.person_a or not effective_person_b:
                raise HTTPException(
                    status_code=400,
                    detail="Operación Bloqueada: No se puede marcar como HECHO. Persona A y Persona B deben tener un perfil válido de SmartMatchApp asignado."
                )

        updates.append("status = :st")
        params["st"] = st_clean

    if payload.status_a is not None:
        updates.append("status_a = :sta")
        params["sta"] = payload.status_a.strip()

    if payload.status_b is not None:
        updates.append("status_b = :stb")
        params["stb"] = payload.status_b.strip()

    # Regla: Si Estado Persona A y Estado Persona B coinciden exactamente, sincronizar Estado Total (status)
    effective_sta = (payload.status_a.strip() if payload.status_a is not None else (match_row.status_a or "")).strip()
    effective_stb = (payload.status_b.strip() if payload.status_b is not None else (match_row.status_b or "")).strip()

    if effective_sta and effective_stb and effective_sta.lower() == effective_stb.lower() and not payload.status:
        updates.append("status = :synced_st")
        params["synced_st"] = effective_sta
        
        # Si es un estado de éxito de RESULTADO_CITA, promover a citas activas
        if effective_sta.upper() in ("CITA CONFIRMADA", "DATE PROGRAMADO", "CITA REALIZADA", "MATCH", "MATCH DONE"):
            updates.append("approved_by_maria = true")

    if payload.observations is not None:
        updates.append("observations = :obs")
        params["obs"] = payload.observations.strip()

    updates.append("updated_at = NOW()")

    await db.execute(text(f"UPDATE operational_matches SET {', '.join(updates)} WHERE id = :id"), params)

    # 1. Registro de evento al pasar a HECHO / HECHO POR MAPE
    if payload.status in ("HECHO", "HECHO POR MAPE"):
        await db.execute(text("""
            INSERT INTO person_history (person_name, match_id, event_type, details, created_at)
            VALUES (:name, :mid, 'MARKED_HECHO', 'Psicóloga marcó el match como HECHO (enviado a revisión)', NOW())
        """), {"name": match_row.person_a, "mid": match_id})

    # 2. Flujo SSOT v2: Si pasa a NOT APPROVED, TROUBLEMAKER o RECHAZADA POR PSICÓLOGA B:
    # La fila original queda INTACTA con su status y se genera una nueva fila de reintento para Persona A
    if payload.status in ("NOT APPROVED", "TROUBLEMAKER", "RECHAZADA POR PSICÓLOGA B", "RECHAZADO POR PSICÓLOGA B"):
        curr_res = await db.execute(text("""
            SELECT city, pref, plan_tier, person_a, psychologist_name, person_a_crm_id,
                   (SELECT COALESCE(MAX(slot_number), 0) + 1 FROM operational_matches WHERE LOWER(TRIM(person_a)) = LOWER(TRIM(:pa))) AS next_slot
            FROM operational_matches
            WHERE id = :id
        """), {"id": match_id, "pa": match_row.person_a})
        curr_row = curr_res.fetchone()

        if curr_row:
            await db.execute(text("""
                INSERT INTO operational_matches
                (city, pref, plan_tier, person_a, psychologist_name, slot_number, status, observations, person_a_crm_id, created_at, updated_at)
                VALUES (:city, :pref, :plan, :person_a, :psyc, :slot, 'Listo para match', :obs, :cid, NOW(), NOW())
            """), {
                "city": curr_row.city,
                "pref": curr_row.pref,
                "plan": curr_row.plan_tier,
                "person_a": curr_row.person_a,
                "psyc": curr_row.psychologist_name,
                "slot": curr_row.next_slot or 1,
                "obs": f"Reintento automático tras {payload.status.strip()}",
                "cid": curr_row.person_a_crm_id
            })

            await db.execute(text("""
                INSERT INTO person_history (person_name, match_id, event_type, details, created_at)
                VALUES (:name, :mid, 'RETRY_SLOT_CREATED', :details, NOW())
            """), {
                "name": curr_row.person_a,
                "mid": match_id,
                "details": f"Fila de reintento generada tras estado {payload.status.strip()} (fila original preservada)."
            })

    await db.commit()

    # 3. Notificar a Apps Script Web App si está configurado (Webhook instantáneo con metadatos completos)
    if payload.status:
        try:
            from app.services.google_sheets import notify_apps_script_status_change, get_canonical_tab_name
            psyc_name = match_row.psychologist_name
            tab_name = get_canonical_tab_name(psyc_name)
            asyncio.create_task(notify_apps_script_status_change(
                tab=tab_name,
                match_id=match_id,
                slot_number=getattr(match_row, 'slot_number', 1) or 1,
                new_status=payload.status.strip(),
                role="psicologa",
                person_a=match_row.person_a,
                person_b=payload.person_b or match_row.person_b,
                person_a_crm_id=getattr(match_row, 'person_a_crm_id', None),
                person_b_crm_id=getattr(match_row, 'person_b_crm_id', None)
            ))
        except Exception:
            pass

    return {"status": "success", "message": f"Match {match_id} actualizado exitosamente"}


# ─── 2. PANTALLA 2: COLA DE APROBACIÓN (MARÍA) ──────────────────────────────

@router.get("/approval-queue")
async def get_approval_queue(
    psychologist: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    plan_tier: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna todos los matches en estado 'HECHO' que aún no han sido aprobados por María,
    con soporte para multifiltros y CRM IDs.
    """
    query = """
        SELECT 
            m.id, m.psychologist_name, m.person_a, m.person_b, m.city, m.plan_tier, m.pref,
            m.created_at, m.updated_at, m.observations,
            m.person_a_crm_id, m.person_b_crm_id,
            uA.crm_id AS ua_crm_id, uB.crm_id AS ub_crm_id
        FROM operational_matches m
        LEFT JOIN users uA ON LOWER(TRIM(uA.name)) = LOWER(TRIM(m.person_a))
        LEFT JOIN users uB ON LOWER(TRIM(uB.name)) = LOWER(TRIM(m.person_b))
        WHERE m.status = 'HECHO' AND m.approved_by_maria = false
    """
    params = {}

    if psychologist and psychologist.lower() not in ("all", "todas"):
        query += " AND UPPER(m.psychologist_name) = UPPER(:psyc)"
        params["psyc"] = psychologist.strip()

    if city and city.lower() not in ("all", "todas"):
        query += " AND m.city ILIKE :city"
        params["city"] = f"%{city.strip()}%"

    if plan_tier and plan_tier.lower() not in ("all", "todos"):
        query += " AND m.plan_tier ILIKE :plan"
        params["plan"] = f"%{plan_tier.strip()}%"

    if search:
        query += " AND (m.person_a ILIKE :srch OR m.person_b ILIKE :srch OR m.city ILIKE :srch OR m.observations ILIKE :srch)"
        params["srch"] = f"%{search.strip()}%"

    query += " ORDER BY m.updated_at DESC"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    queue = []
    for r in rows:
        d = dict(r._mapping)
        queue.append({
            "id": d.get("id"),
            "psychologist_name": d.get("psychologist_name"),
            "person_a": d.get("person_a"),
            "person_a_crm_id": d.get("person_a_crm_id") or d.get("ua_crm_id") or "",
            "person_b": d.get("person_b") or "",
            "person_b_crm_id": d.get("person_b_crm_id") or d.get("ub_crm_id") or "",
            "city": normalize_city(d.get("city")),
            "plan_tier": normalize_plan(d.get("plan_tier")),
            "pref": normalize_pref(d.get("pref")),
            "fecha_hecho": d.get("updated_at").strftime("%Y-%m-%d %H:%M") if d.get("updated_at") else "",
            "observations": d.get("observations") or "",
            "plan_color": PLAN_COLORS.get(d.get("plan_tier"), "#F3F3F3")
        })

    return {"queue": queue, "total": len(queue)}


@router.post("/matches/{match_id}/approve")
async def approve_match_by_maria(match_id: int, db: AsyncSession = Depends(get_db)):
    """
    ACCIÓN ÚNICA DE MARÍA (SPEC v2):
    1. Marca status = 'APROBADO', approved_by_maria = true, approved_at = now().
    2. Bloquea la fila en la vista de psicóloga directamente en operational_matches.
    3. NO COPIA a otra tabla — todo vive y se gestiona en operational_matches.
    4. Registra en person_history para Persona A y Persona B.
    """
    exist_res = await db.execute(text("""
        SELECT id, person_a, person_b, psychologist_name, city, plan_tier, pref, slot_number, person_a_crm_id, person_b_crm_id, approved_by_maria
        FROM operational_matches
        WHERE id = :id
    """), {"id": match_id})
    match_row = exist_res.fetchone()

    if not match_row:
        raise HTTPException(status_code=404, detail="Match no encontrado")

    if match_row.approved_by_maria:
        return {"status": "already_approved", "message": f"Match {match_id} ya fue aprobado previamente."}

    # ── HARD-BLOCKING DE DOBLE APROBACIÓN PREVIA ─────────────────────────
    # Si el match involucra a un candidato B de otra psicóloga, debe estar validado previamente por ella
    psyc_a = normalize_psychologist(match_row.psychologist_name)
    psyc_b = None
    if match_row.person_b:
        psyc_b_res = await db.execute(text("""
            SELECT p.responsable
            FROM users u
            JOIN profiles p ON p.user_id = u.id
            WHERE LOWER(TRIM(u.name)) = LOWER(TRIM(:b_name))
            LIMIT 1
        """), {"b_name": match_row.person_b.strip()})
        psyc_b_row = psyc_b_res.fetchone()
        if psyc_b_row and psyc_b_row.responsable:
            psyc_b = normalize_psychologist(psyc_b_row.responsable)

    is_cross = (psyc_b and psyc_b != psyc_a)
    if is_cross and match_row.status not in ('APROBADO POR PSICÓLOGAS', 'APROBADO POR AMBAS PSICÓLOGAS'):
        raise HTTPException(
            status_code=400,
            detail=f"⚠️ BLOQUEADO: Este match es cruzado entre {psyc_a} y {psyc_b}. Aún espera la validación de la Psicóloga B ({psyc_b}) antes de que María pueda aprobarlo."
        )

    # 1. Actualizar estado y bloquear fila in-situ en operational_matches
    await db.execute(text("""
        UPDATE operational_matches
        SET status = 'APROBADO', approved_by_maria = true, approved_at = NOW(), updated_at = NOW()
        WHERE id = :id
    """), {"id": match_id})

    # 2. Registrar trazabilidad
    pA = match_row.person_a
    pB = match_row.person_b or "Candidato B"

    det = f"Match aprobado directamente por María ({pA} x {pB}, Psicóloga: {match_row.psychologist_name})."
    await db.execute(text("INSERT INTO person_history (person_name, match_id, event_type, details, created_at) VALUES (:n, :mid, 'MATCH_APPROVED', :d, NOW())"), {"n": pA, "mid": match_id, "d": det})
    if pB and pB != "Candidato B":
        await db.execute(text("INSERT INTO person_history (person_name, match_id, event_type, details, created_at) VALUES (:n, :mid, 'MATCH_APPROVED', :d, NOW())"), {"n": pB, "mid": match_id, "d": det})

    await db.commit()

    # 3. Notificar a Apps Script Web App si está configurado (Webhook instantáneo con metadatos completos)
    try:
        from app.services.google_sheets import notify_apps_script_status_change, get_canonical_tab_name
        psyc_name = match_row.psychologist_name
        tab_name = get_canonical_tab_name(psyc_name)
        asyncio.create_task(notify_apps_script_status_change(
            tab=tab_name,
            match_id=match_id,
            slot_number=getattr(match_row, 'slot_number', 1) or 1,
            new_status="APROBADO",
            role="maria",
            person_a=match_row.person_a,
            person_b=match_row.person_b,
            person_a_crm_id=getattr(match_row, 'person_a_crm_id', None),
            person_b_crm_id=getattr(match_row, 'person_b_crm_id', None)
        ))
    except Exception:
        pass

    return {"status": "success", "match_id": match_id, "message": f"Match {match_id} aprobado exitosamente por María Paula (fila actualizada in-situ)."}


@router.post("/matches/{match_id}/refund-by-maria")
async def refund_match_by_maria(
    match_id: int,
    payload: Optional[RejectMatchRequest] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    ACCIÓN DIRECTA DE MARÍA: Refund de un match directo desde la cola de revisión.
    1. Marca status = 'REFUND', approved_by_maria = false, updated_at = now().
    2. Registra en person_history para Persona A y Persona B.
    3. Enruta a la cola de Lina (REFUNDS PENDIENTES).
    """
    exist_res = await db.execute(text("""
        SELECT id, person_a, person_b, psychologist_name, city, plan_tier, pref, slot_number, person_a_crm_id, person_b_crm_id
        FROM operational_matches
        WHERE id = :id
    """), {"id": match_id})
    match_row = exist_res.fetchone()

    if not match_row:
        raise HTTPException(status_code=404, detail="Match no encontrado")

    reason = (payload.reason if payload and payload.reason else "Refund directo ordenado por María").strip()

    await db.execute(text("""
        UPDATE operational_matches
        SET status = 'REFUND', observations = :obs, updated_at = NOW()
        WHERE id = :id
    """), {"id": match_id, "obs": f"[REFUND MARÍA] {reason}"})

    pA = match_row.person_a
    pB = match_row.person_b or "Candidato B"
    det = f"Match marcado para REFUND por María ({pA} x {pB}, Psicóloga: {match_row.psychologist_name}). Motivo: {reason}"
    await db.execute(text("INSERT INTO person_history (person_name, match_id, event_type, details, created_at) VALUES (:n, :mid, 'REFUND', :d, NOW())"), {"n": pA, "mid": match_id, "d": det})
    if pB and pB != "Candidato B":
        await db.execute(text("INSERT INTO person_history (person_name, match_id, event_type, details, created_at) VALUES (:n, :mid, 'REFUND', :d, NOW())"), {"n": pB, "mid": match_id, "d": det})

    await db.commit()
    return {"status": "success", "match_id": match_id, "message": f"Match {match_id} marcado como REFUND por María y enrutado a Lina."}


@router.post("/refunds/manual")
async def create_manual_refund(
    payload: ManualRefundRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Permite a cualquier miembro de Servicio al Cliente registrar un refund manualmente en la cola de Lina.
    """
    clean_name = payload.person_name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Nombre del cliente requerido")

    psyc = payload.psychologist_name.strip() if payload.psychologist_name else "General"
    plan = payload.plan_tier.strip() if payload.plan_tier else ""
    reason = payload.reason.strip() if payload.reason else "Solicitud de refund vía Servicio al Cliente / WhatsApp"

    # Insertar en operational_matches con status REFUND
    insert_res = await db.execute(text("""
        INSERT INTO operational_matches (person_a, psychologist_name, plan_tier, status, observations, created_at, updated_at)
        VALUES (:pa, :psyc, :plan, 'REFUND', :obs, NOW(), NOW())
        RETURNING id
    """), {"pa": clean_name, "psyc": psyc, "plan": plan, "obs": f"[SERVICIO AL CLIENTE] {reason}"})
    new_id = insert_res.scalar()

    # Registrar en person_history
    await db.execute(text("""
        INSERT INTO person_history (person_name, match_id, event_type, details, created_at)
        VALUES (:n, :mid, 'REFUND_REQUESTED', :d, NOW())
    """), {"n": clean_name, "mid": new_id, "d": f"Solicitud de refund ingresada por Servicio al Cliente. Motivo: {reason}"})

    await db.commit()
    return {"status": "success", "match_id": new_id, "message": f"Solicitud de refund para {clean_name} registrada en la cola de Lina."}


# ─── 2B. COLA DE REFUNDS (LINA - SERVICIO AL CLIENTE) ───────────────────────

@router.get("/refunds")
async def get_refunds_queue(
    status: Optional[str] = Query("REFUND"),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna la cola de refunds para Lina (Servicio al Cliente).
    Filtra por REFUND (pendientes de procesar) o REFUND DONE (procesados en Stripe/Nequi).
    """
    target_status = "REFUND DONE" if status and status.upper() == "REFUND DONE" else "REFUND"
    query = """
        SELECT 
            m.id, m.person_a, m.person_b, m.psychologist_name, m.city, m.plan_tier,
            m.status, m.observations, m.created_at, m.updated_at,
            m.person_a_crm_id, uA.crm_id AS ua_crm_id
        FROM operational_matches m
        LEFT JOIN users uA ON LOWER(TRIM(uA.name)) = LOWER(TRIM(m.person_a))
        WHERE m.status = :st
    """
    params = {"st": target_status}

    if search:
        query += " AND (m.person_a ILIKE :srch OR m.psychologist_name ILIKE :srch OR m.observations ILIKE :srch OR m.city ILIKE :srch)"
        params["srch"] = f"%{search.strip()}%"

    query += " ORDER BY m.updated_at DESC"
    res = await db.execute(text(query), params)
    rows = res.fetchall()

    refunds = []
    for r in rows:
        d = dict(r._mapping)
        refunds.append({
            "id": d.get("id"),
            "person_a": d.get("person_a"),
            "person_a_crm_id": d.get("person_a_crm_id") or d.get("ua_crm_id") or "",
            "psychologist_name": d.get("psychologist_name"),
            "city": normalize_city(d.get("city")),
            "plan_tier": normalize_plan(d.get("plan_tier")),
            "status": d.get("status"),
            "observations": d.get("observations") or "",
            "fecha": d.get("updated_at").strftime("%Y-%m-%d %H:%M") if d.get("updated_at") else ""
        })

    return {"refunds": refunds, "total": len(refunds)}


@router.patch("/refunds/{match_id}/process")
async def process_refund(match_id: int, db: AsyncSession = Depends(get_db)):
    """
    Acción exclusiva de Lina: Marca el match como REFUND DONE tras procesar el reembolso en Stripe/Nequi.
    """
    res = await db.execute(text("SELECT id, person_a, person_b, psychologist_name, slot_number, person_a_crm_id, person_b_crm_id, observations FROM operational_matches WHERE id = :id"), {"id": match_id})
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Match no encontrado")

    obs = (row.observations or "") + f" | [REFUND PROCESADO POR LINA]"
    await db.execute(text("""
        UPDATE operational_matches
        SET status = 'REFUND DONE', observations = :obs, updated_at = NOW()
        WHERE id = :id
    """), {"id": match_id, "obs": obs})

    await db.execute(text("""
        INSERT INTO person_history (person_name, match_id, event_type, details, created_at)
        VALUES (:name, :mid, 'REFUND_PROCESSED', 'Reembolso aprobado y procesado por Lina en pasarela/banco.', NOW())
    """), {"name": row.person_a, "mid": match_id})

    await db.commit()

    # Notificar a Apps Script Web App (Webhook instantáneo con metadatos completos)
    try:
        from app.services.google_sheets import notify_apps_script_status_change, get_canonical_tab_name
        psyc_name = row.psychologist_name
        tab_name = get_canonical_tab_name(psyc_name)
        asyncio.create_task(notify_apps_script_status_change(
            tab=tab_name,
            match_id=match_id,
            slot_number=getattr(row, 'slot_number', 1) or 1,
            new_status="REFUND DONE",
            role="servicio_al_cliente",
            person_a=row.person_a,
            person_b=row.person_b,
            person_a_crm_id=getattr(row, 'person_a_crm_id', None),
            person_b_crm_id=getattr(row, 'person_b_crm_id', None)
        ))
    except Exception:
        pass

    return {"status": "success", "message": f"Reembolso #{match_id} marcado como REFUND DONE exitosamente."}


# ─── 3. PANTALLA 3: SERVICIO AL CLIENTE (PENDIENTES & PAUSAS) ────────────────

@router.get("/confirmations")
async def get_confirmations(
    stage: Optional[str] = Query("all"),
    psychologist: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    confirmation_a: Optional[str] = Query(None),
    confirmation_b: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna la lista unificada de matches de Servicio al Cliente con soporte para multifiltros y búsqueda global.
    """
    query = """
        SELECT 
            c.id AS confirmation_id, c.match_id, c.person_a_confirmation, c.person_b_confirmation,
            c.stage, c.pause_reason, c.created_at AS date_approved, c.updated_at,
            m.person_a, m.person_b, m.psychologist_name, m.city, m.plan_tier, m.pref,
            m.person_a_crm_id, m.person_b_crm_id,
            uA.phone AS phone_a, uB.phone AS phone_b,
            uA.crm_id AS ua_crm_id, uB.crm_id AS ub_crm_id
        FROM match_confirmations c
        JOIN operational_matches m ON m.id = c.match_id
        LEFT JOIN users uA ON LOWER(TRIM(uA.name)) = LOWER(TRIM(m.person_a))
        LEFT JOIN users uB ON LOWER(TRIM(uB.name)) = LOWER(TRIM(m.person_b))
        WHERE 1=1
    """
    params = {}

    if stage and stage.lower() not in ("all", "todos", "todas"):
        query += " AND c.stage = :st"
        params["st"] = stage.strip()

    if psychologist and psychologist.lower() not in ("all", "todas"):
        query += " AND UPPER(m.psychologist_name) = UPPER(:psyc)"
        params["psyc"] = psychologist.strip()

    if city and city.lower() not in ("all", "todas"):
        query += " AND m.city ILIKE :city"
        params["city"] = f"%{city.strip()}%"

    if confirmation_a and confirmation_a.lower() not in ("all", "todas", "todos"):
        query += " AND c.person_a_confirmation = :conf_a"
        params["conf_a"] = confirmation_a.strip()

    if confirmation_b and confirmation_b.lower() not in ("all", "todas", "todos"):
        query += " AND c.person_b_confirmation = :conf_b"
        params["conf_b"] = confirmation_b.strip()

    if search:
        query += " AND (m.person_a ILIKE :srch OR m.person_b ILIKE :srch OR m.city ILIKE :srch OR m.psychologist_name ILIKE :srch)"
        params["srch"] = f"%{search.strip()}%"

    query += " ORDER BY c.updated_at DESC, c.id DESC"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    confirmations = []
    for r in rows:
        d = dict(r._mapping)
        confirmations.append({
            "confirmation_id": d.get("confirmation_id"),
            "match_id": d.get("match_id"),
            "person_a": d.get("person_a"),
            "person_a_crm_id": d.get("person_a_crm_id") or d.get("ua_crm_id") or "",
            "phone_a": d.get("phone_a") or "+573000000000",
            "person_a_confirmation": d.get("person_a_confirmation") or "Pendiente",
            "person_b": d.get("person_b") or "",
            "person_b_crm_id": d.get("person_b_crm_id") or d.get("ub_crm_id") or "",
            "phone_b": d.get("phone_b") or "+573000000000",
            "person_b_confirmation": d.get("person_b_confirmation") or "Pendiente",
            "psychologist_name": d.get("psychologist_name"),
            "city": normalize_city(d.get("city")),
            "plan_tier": normalize_plan(d.get("plan_tier")),
            "pref": normalize_pref(d.get("pref")),
            "stage": d.get("stage"),
            "pause_reason": d.get("pause_reason") or "",
            "fecha_aprobado": d.get("date_approved").strftime("%Y-%m-%d %H:%M") if d.get("date_approved") else ""
        })

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
    2. Si los valores cumplen las condiciones para avanzar (Aceptó+Aceptó, o Trouble, o Pausa), se crea un NUEVO registro (INSERT) hacia la tabla/pestaña de destino correspondiente.
    """
    res = await db.execute(text("""
        SELECT 
            c.id, c.match_id, c.person_a_confirmation, c.person_b_confirmation, c.stage,
            m.person_a, m.person_b, m.psychologist_name, m.city
        FROM match_confirmations c
        JOIN operational_matches m ON m.id = c.match_id
        WHERE c.id = :id
    """), {"id": confirmation_id})
    row = res.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Confirmación no encontrada")

    conf_a = payload.person_a_confirmation or row.person_a_confirmation
    conf_b = payload.person_b_confirmation or row.person_b_confirmation
    reason = payload.pause_reason

    # 1. SIEMPRE actualizar la fila original in-place
    await db.execute(text("""
        UPDATE match_confirmations
        SET person_a_confirmation = :cA, person_b_confirmation = :cB, updated_at = NOW()
        WHERE id = :id
    """), {"id": confirmation_id, "cA": conf_a, "cB": conf_b})

    target_stage = row.stage

    # 2. EVALUAR TRANSICIÓN A CALENDARIO
    if conf_a == "Aceptó" and conf_b == "Aceptó":
        target_stage = "calendario"
        existing_cal = await db.execute(text("""
            SELECT id FROM scheduled_dates WHERE match_id = :mid LIMIT 1
        """), {"mid": row.match_id})
        
        if not existing_cal.fetchone():
            await db.execute(text("""
                INSERT INTO scheduled_dates (
                    match_id, person_a, person_b, date_time, venue, city,
                    reservation_name, had_date, reschedule, created_at, updated_at
                ) VALUES (
                    :mid, :pA, :pB, 'Por definir', 'Por definir', :city,
                    'María Paula Salinas', false, false, NOW(), NOW()
                )
            """), {
                "mid": row.match_id,
                "pA": row.person_a,
                "pB": row.person_b,
                "city": row.city or "Bogotá"
            })

            det = f"¡Ambos aceptaron! Match {row.person_a} x {row.person_b} transferido a Calendario."
            await db.execute(text("INSERT INTO person_history (person_name, match_id, event_type, details, created_at) VALUES (:n, :mid, 'BOTH_ACCEPTED', :d, NOW())"), {"n": row.person_a, "mid": row.match_id, "d": det})
            if row.person_b:
                await db.execute(text("INSERT INTO person_history (person_name, match_id, event_type, details, created_at) VALUES (:n, :mid, 'BOTH_ACCEPTED', :d, NOW())"), {"n": row.person_b, "mid": row.match_id, "d": det})

    elif any(c == "Rechazó" for c in [conf_a, conf_b]):
        target_stage = "trouble"
        existing_t = await db.execute(text("""
            SELECT id FROM match_confirmations WHERE match_id = :mid AND stage = 'trouble' LIMIT 1
        """), {"mid": row.match_id})
        if row.stage != "trouble" and not existing_t.fetchone():
            await db.execute(text("""
                INSERT INTO match_confirmations (
                    match_id, person_a_confirmation, person_b_confirmation, stage, pause_reason, created_at, updated_at
                ) VALUES (
                    :mid, :cA, :cB, 'trouble', 'Rechazado por una o ambas partes', NOW(), NOW()
                )
            """), {
                "mid": row.match_id,
                "cA": conf_a,
                "cB": conf_b
            })

    elif any(c == "Viaje largo / indefinido" for c in [conf_a, conf_b]):
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
async def get_calendar_dates(
    had_date: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna la lista de citas agendadas con soporte para multifiltros y CRM IDs.
    """
    query = """
        SELECT 
            s.id, s.match_id, s.person_a, s.person_b, s.date_time, s.venue, s.city,
            s.reservation_name, s.reservation_confirmed, s.had_date, s.feedback, s.feedback_ella, s.feedback_el, s.reschedule, s.created_at, s.updated_at,
            uA.crm_id AS ua_crm_id, uB.crm_id AS ub_crm_id
        FROM scheduled_dates s
        LEFT JOIN users uA ON LOWER(TRIM(uA.name)) = LOWER(TRIM(s.person_a))
        LEFT JOIN users uB ON LOWER(TRIM(uB.name)) = LOWER(TRIM(s.person_b))
        WHERE 1=1
    """
    params = {}

    if had_date and had_date.lower() not in ("all", "todos", "todas"):
        if had_date.lower() in ("yes", "si", "sí", "true", "completada"):
            query += " AND s.had_date = true"
        elif had_date.lower() in ("no", "false", "pendiente"):
            query += " AND s.had_date = false AND s.reschedule = false"
        elif had_date.lower() in ("reschedule", "reprogramar"):
            query += " AND s.reschedule = true"

    if city and city.lower() not in ("all", "todas"):
        query += " AND s.city ILIKE :city"
        params["city"] = f"%{city.strip()}%"

    if date_from:
        query += " AND s.created_at >= :d_from"
        params["d_from"] = date_from

    if date_to:
        query += " AND s.created_at <= :d_to"
        params["d_to"] = f"{date_to} 23:59:59"

    if search:
        query += " AND (s.person_a ILIKE :srch OR s.person_b ILIKE :srch OR s.venue ILIKE :srch OR s.city ILIKE :srch)"
        params["srch"] = f"%{search.strip()}%"

    query += " ORDER BY s.updated_at DESC, s.id DESC"

    res = await db.execute(text(query), params)
    rows = res.fetchall()

    dates = []
    for r in rows:
        d = dict(r._mapping)
        dt_val = d.get("date_time") or "Fecha por definir"
        ven_val = d.get("venue") or "Lugar por definir"
        res_name = d.get("reservation_name") or "María Paula Salinas"
        
        # Plantillas de WhatsApp con textos exactos del SSOT
        msg_confirmacion = (
            f"Para confirmarte tu date! 💛 Fecha y hora: {dt_val} en {ven_val}\n"
            f"La reserva estará a nombre de {res_name}.\n"
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
            f"La reserva estará a nombre de {res_name}!! Por favor avisanos cuando vayas en camino para estar pendiente de ti! "
            f"Recuerda que hay alguien que te esta esperando, y la puntualidas vale X2!! Disfrútalo muchísimo, es solo una cita!! "
            f"Avísanos cuando vayas en camino para estar pendiente de tiii!"
        )

        row_status_color = "#FFF2CC" # Amarillo pendiente
        if d.get("had_date"):
            row_status_color = "#6AA84F" # Verde completada
        elif d.get("reschedule"):
            row_status_color = "#F9CB9C" # Naranja reprogramar

        dates.append({
            "id": d.get("id"),
            "match_id": d.get("match_id"),
            "person_a": d.get("person_a"),
            "person_a_crm_id": d.get("ua_crm_id") or "",
            "person_b": d.get("person_b"),
            "person_b_crm_id": d.get("ub_crm_id") or "",
            "date_time": dt_val,
            "venue": ven_val,
            "city": normalize_city(d.get("city")),
            "reservation_name": res_name,
            "reservation_confirmed": bool(d.get("reservation_confirmed")),
            "had_date": bool(d.get("had_date")),
            "feedback": d.get("feedback") or "",
            "feedback_ella": d.get("feedback_ella") or "",
            "feedback_el": d.get("feedback_el") or "",
            "reschedule": bool(d.get("reschedule")),
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
    Actualiza fecha, lugar, reserva confirmada, feedback separado (ELLA / ÉL) o reprogramación.
    REGLA: Si had_date = true y hay feedback, el STATUS del match original cambia a 'CITA COMPLETADA'.
    REGLA REPROGRAMAR: Si reschedule = true, genera una FILA NUEVA de reintento en el calendario.
    """
    res = await db.execute(text("SELECT id, match_id, person_a, person_b, city, venue FROM scheduled_dates WHERE id = :id"), {"id": calendar_id})
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

    if payload.reservation_confirmed is not None:
        updates.append("reservation_confirmed = :rc")
        params["rc"] = payload.reservation_confirmed

    if payload.had_date is not None:
        updates.append("had_date = :hd")
        params["hd"] = payload.had_date

    if payload.feedback is not None:
        updates.append("feedback = :fb")
        params["fb"] = payload.feedback.strip()

    if payload.feedback_ella is not None:
        updates.append("feedback_ella = :fbe")
        params["fbe"] = payload.feedback_ella.strip()

    if payload.feedback_el is not None:
        updates.append("feedback_el = :fbel")
        params["fbel"] = payload.feedback_el.strip()

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

    # 2. Reprogramación -> CREAR NUEVA FILA EN CALENDARIO + COPIA EN PAUSA
    if payload.reschedule:
        # A. Crear nueva fila en scheduled_dates para agendar de nuevo
        await db.execute(text("""
            INSERT INTO scheduled_dates (
                match_id, person_a, person_b, date_time, venue, city, reservation_name, reservation_confirmed, had_date, reschedule, created_at, updated_at
            ) VALUES (
                :mid, :pa, :pb, 'Fecha por definir', :ven, :city, 'María Paula Salinas', false, false, false, NOW(), NOW()
            )
        """), {
            "mid": cal_row.match_id,
            "pa": cal_row.person_a,
            "pb": cal_row.person_b,
            "ven": cal_row.venue or "Lugar por definir",
            "city": cal_row.city or ""
        })

        if cal_row.match_id:
            await db.execute(text("""
                INSERT INTO match_confirmations (
                    match_id, person_a_confirmation, person_b_confirmation, stage, pause_reason, created_at, updated_at
                ) VALUES (
                    :mid, 'Aceptó', 'Aceptó', 'en_pausa', 'Reprogramar', NOW(), NOW()
                )
            """), {"mid": cal_row.match_id})

            await db.execute(text("""
                INSERT INTO person_history (person_name, match_id, event_type, details, created_at)
                VALUES (:name, :mid, 'DATE_RESCHEDULED', 'Cita reprogramada — nueva fila creada en Calendario y transferida a En Pausa', NOW())
            """), {"name": cal_row.person_a, "mid": cal_row.match_id})

    await db.commit()
    return {"status": "success", "message": f"Cita {calendar_id} actualizada correctamente"}


# ─── 5. HISTORIAL DE PERSONA & PSICÓLOGAS ACTIVAS ────────────────────────────

@router.get("/psychologists")
async def get_active_psychologists(db: AsyncSession = Depends(get_db)):
    """
    Retorna la lista de psicólogas dinámicamente desde la base de datos (con conteos reales),
    asegurando la presencia de las 10 psicólogas activas oficiales (JENN, ANA, SILVI, STEFFY, SOFI, MAPE D, ALEJA, MANU, PIA, ISA).
    """
    OFFICIAL_PSYCHOLOGISTS = [
        "JENN", "ANA", "SILVI", "STEFFY", "SOFI", "MAPE D", "ALEJA", "MANU", "PIA", "ISA"
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


@router.get("/check-duplicate-match")
async def check_duplicate_match(
    person_a: str = Query(...),
    person_b: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Verifica si ya existe un match previo o activo entre Persona A y Persona B,
    o si Persona B ya tiene citas agendadas o matches activos con otra persona.
    """
    pa = person_a.strip()
    pb = person_b.strip()

    if not pa or not pb:
        return {"duplicate": False, "active_conflicts": []}

    # 1. Match previo entre exactamente estas dos personas
    res_pair = await db.execute(text("""
        SELECT id, person_a, person_b, psychologist_name, status, created_at
        FROM operational_matches
        WHERE (LOWER(TRIM(person_a)) = LOWER(TRIM(:pa)) AND LOWER(TRIM(person_b)) = LOWER(TRIM(:pb)))
           OR (LOWER(TRIM(person_a)) = LOWER(TRIM(:pb)) AND LOWER(TRIM(person_b)) = LOWER(TRIM(:pa)))
        ORDER BY created_at DESC
    """), {"pa": pa, "pb": pb})
    pair_rows = res_pair.fetchall()

    # 2. Matches activos de Persona B con otras personas
    res_b_active = await db.execute(text("""
        SELECT id, person_a, person_b, psychologist_name, status
        FROM operational_matches
        WHERE (LOWER(TRIM(person_a)) = LOWER(TRIM(:pb)) OR LOWER(TRIM(person_b)) = LOWER(TRIM(:pb)))
          AND status IN ('APROBADO', 'HECHO', 'HECHO POR MAPE', 'Listo para match')
          AND LOWER(TRIM(person_a)) != LOWER(TRIM(:pa)) AND LOWER(TRIM(person_b)) != LOWER(TRIM(:pa))
        LIMIT 3
    """), {"pa": pa, "pb": pb})
    b_active_rows = res_b_active.fetchall()

    # 3. Citas agendadas en calendario para Persona B
    res_b_dates = await db.execute(text("""
        SELECT id, person_a, person_b, date_time, venue, had_date, reschedule
        FROM scheduled_dates
        WHERE (LOWER(TRIM(person_a)) = LOWER(TRIM(:pb)) OR LOWER(TRIM(person_b)) = LOWER(TRIM(:pb)))
          AND had_date = false AND reschedule = false
        LIMIT 3
    """), {"pb": pb})
    b_dates_rows = res_b_dates.fetchall()

    is_duplicate = len(pair_rows) > 0
    has_active_conflict = len(b_active_rows) > 0 or len(b_dates_rows) > 0

    return {
        "duplicate": is_duplicate,
        "previous_matches_count": len(pair_rows),
        "previous_matches": [
            {
                "id": r.id,
                "person_a": r.person_a,
                "person_b": r.person_b,
                "psychologist": r.psychologist_name,
                "status": r.status,
                "date": r.created_at.strftime("%Y-%m-%d") if r.created_at else ""
            }
            for r in pair_rows
        ],
        "has_active_conflict": has_active_conflict,
        "active_matches": [
            {"id": r.id, "person_a": r.person_a, "person_b": r.person_b, "psychologist": r.psychologist_name, "status": r.status}
            for r in b_active_rows
        ],
        "scheduled_dates": [
            {"id": r.id, "person_a": r.person_a, "person_b": r.person_b, "date_time": r.date_time, "venue": r.venue}
            for r in b_dates_rows
        ]
    }


@router.get("/history/{query_or_name}")
async def get_person_history(query_or_name: str, db: AsyncSession = Depends(get_db)):
    """
    Retorna la trazabilidad completa y permanente de todas las citas y eventos de una persona
    buscando por CRM ID o por nombre (candidatos presentados, feedback, notas internas y perfil psicográfico).
    """
    clean_q = query_or_name.strip()
    
    # 1. Buscar usuario y perfil por crm_id o por nombre
    user_row = None
    if clean_q.isdigit():
        res_u = await db.execute(text("""
            SELECT u.id, u.name, u.phone, u.email, u.crm_id,
                   p.city, p.orientation, p.plan_tier, p.responsable,
                   p.age, p.occupation, p.motivacion, p.bio_notes, p.difficult_notes, p.is_difficult
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.crm_id = :cid
            LIMIT 1
        """), {"cid": clean_q})
        user_row = res_u.fetchone()
    
    if not user_row:
        res_u = await db.execute(text("""
            SELECT u.id, u.name, u.phone, u.email, u.crm_id,
                   p.city, p.orientation, p.plan_tier, p.responsable,
                   p.age, p.occupation, p.motivacion, p.bio_notes, p.difficult_notes, p.is_difficult
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE LOWER(TRIM(u.name)) = LOWER(TRIM(:n))
               OR u.name ILIKE :n_like
            ORDER BY CASE WHEN LOWER(TRIM(u.name)) = LOWER(TRIM(:n)) THEN 1 ELSE 2 END
            LIMIT 1
        """), {"n": clean_q, "n_like": f"%{clean_q}%"})
        user_row = res_u.fetchone()

    target_name = user_row.name if user_row else clean_q
    target_crm_id = user_row.crm_id if user_row else (clean_q if clean_q.isdigit() else "")

    # 2. Conteo de citas completadas en calendario
    res_dates = await db.execute(text("""
        SELECT COUNT(*) 
        FROM scheduled_dates
        WHERE (LOWER(TRIM(person_a)) = LOWER(TRIM(:n)) OR LOWER(TRIM(person_b)) = LOWER(TRIM(:n)))
          AND had_date = true
    """), {"n": target_name})
    dates_had_count = res_dates.scalar() or 0

    # 3. Historial cronológico de eventos
    res_hist = await db.execute(text("""
        SELECT id, person_name, match_id, event_type, details, created_at
        FROM person_history
        WHERE LOWER(TRIM(person_name)) = LOWER(TRIM(:n))
        ORDER BY created_at DESC
    """), {"n": target_name})
    hist_rows = res_hist.fetchall()

    # 4. Lista de todos los matches históricos con candidatos presentados y feedback
    res_matches = await db.execute(text("""
        SELECT m.id, m.person_a, m.person_b, m.psychologist_name, m.status, m.plan_tier, m.city,
               m.observations, m.created_at, m.person_a_crm_id, m.person_b_crm_id,
               d.feedback, d.feedback_ella, d.feedback_el, d.had_date, d.venue, d.date_time
        FROM operational_matches m
        LEFT JOIN scheduled_dates d ON d.match_id = m.id
        WHERE LOWER(TRIM(m.person_a)) = LOWER(TRIM(:n)) OR LOWER(TRIM(m.person_b)) = LOWER(TRIM(:n))
        ORDER BY m.created_at DESC
    """), {"n": target_name})
    match_rows = res_matches.fetchall()

    # 5. Categorización de matches
    completed_count = 0
    trouble_count = 0
    in_progress_count = 0
    closed_count = 0

    COMPLETED_STATUSES = {"APROBADO", "MATCH DONE", "CITA COMPLETADA"}
    CLOSED_STATUSES = {"DESCALIFICADO", "REFUND", "REFUND DONE", "NOT APPROVED", "NO HAY GENTE", "RESUELTO"}

    formatted_matches = []
    for r in match_rows:
        st = (r.status or "").strip().upper()
        if st in COMPLETED_STATUSES:
            completed_count += 1
        elif "TROUBLE" in st:
            trouble_count += 1
        elif st in CLOSED_STATUSES:
            closed_count += 1
        else:
            in_progress_count += 1

        is_person_a = target_name.lower() in (r.person_a or "").lower()
        candidate = r.person_b if is_person_a else r.person_a
        candidate_crm = r.person_b_crm_id if is_person_a else r.person_a_crm_id

        # Feedback consolidado
        fb = r.feedback or ""
        if r.feedback_ella or r.feedback_el:
            fb = f"Ella: {r.feedback_ella or 'Sin comentario'} | Él: {r.feedback_el or 'Sin comentario'}"

        formatted_matches.append({
            "id": r.id,
            "role": "Persona A" if is_person_a else "Persona B",
            "candidate_name": candidate or "Por definir",
            "candidate_crm_id": candidate_crm or "",
            "psychologist": normalize_psychologist(r.psychologist_name),
            "status": r.status or "PENDIENTE",
            "plan_tier": normalize_plan(r.plan_tier),
            "city": normalize_city(r.city),
            "observations": r.observations or "",
            "feedback": fb,
            "venue": r.venue or "",
            "date_time": r.date_time or "",
            "had_date": bool(r.had_date),
            "fecha": r.created_at.strftime("%Y-%m-%d") if r.created_at else ""
        })

    if dates_had_count > completed_count:
        completed_count = dates_had_count

    return {
        "person_name": target_name,
        "crm_id": target_crm_id,
        "city": normalize_city(user_row.city) if user_row else "",
        "pref": normalize_pref(user_row.orientation) if user_row else "",
        "plan_tier": normalize_plan(user_row.plan_tier) if user_row else "",
        "psychologist": normalize_psychologist(user_row.responsable) if user_row else "",
        "age": user_row.age if user_row and user_row.age else "",
        "occupation": user_row.occupation if user_row and user_row.occupation else "",
        "motivacion": user_row.motivacion if user_row and user_row.motivacion else "",
        "bio_notes": user_row.bio_notes if user_row and user_row.bio_notes else "",
        "difficult_notes": user_row.difficult_notes if user_row and user_row.difficult_notes else "",
        "is_difficult": bool(user_row.is_difficult) if user_row else False,
        "phone": user_row.phone if user_row and user_row.phone else "",
        "email": user_row.email if user_row and user_row.email else "",
        "dates_completed_count": completed_count,
        "completed_count": completed_count,
        "rejections_count": trouble_count,
        "trouble_count": trouble_count,
        "in_progress_count": in_progress_count,
        "closed_count": closed_count,
        "total_matches_count": len(match_rows),
        "events": [
            {
                "id": r.id,
                "person_name": r.person_name,
                "match_id": r.match_id,
                "event_type": r.event_type,
                "details": r.details,
                "fecha": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else ""
            }
            for r in hist_rows
        ],
        "matches": formatted_matches
    }


def normalize_plan(raw_plan: Optional[str]) -> str:
    """
    Normaliza valores crudos del CRM o etiquetas a los 3 planes oficiales:
    - VIP 195k (VIP, 195k, 295k, VIP client) -> 4 slots
    - Estándar 65k (2 citas) (2 dates, 2 citas, standard, 65k, 98k, 150k) -> 3 slots
    - Básico 40k (1 date, 1 cita, basic, 40k) -> 2 slots
    """
    if not raw_plan:
        return ""
    p = raw_plan.lower().strip()
    
    # 1. VIP (máxima prioridad de match si tiene 'vip')
    if "vip" in p or "195k" in p or "295k" in p:
        return "VIP 195k"
    
    # 2. Estándar (2 dates / standard / 65k / 98k / 150k)
    if "2 date" in p or "2 cita" in p or "standard" in p or "estandar" in p or "estándar" in p or "65k" in p or "98k" in p or "150k" in p or "premium" in p:
        return "Estándar 65k (2 citas)"
    
    # 3. Básico (1 date / basic / 40k)
    if "1 date" in p or "1 cita" in p or "basic" in p or "basico" in p or "básico" in p or "40k" in p:
        return "Básico 40k"
        
    return ""


ACTIVE_PSYCHOLOGISTS_SET = {
    "JENN", "ANA", "SILVI", "STEFFY", "SOFI", "MAPE D", "ALEJA", "MANU 1", "MANU 2", "MANU", "PIA"
}

def normalize_psychologist(raw_psyc: Optional[str]) -> str:
    """
    Normaliza el nombre de psicóloga a la lista oficial de 10 psicólogas activas.
    Si no coincide con una psicóloga activa oficial (por ejemplo 'MARI PAZ', roles administrativos o texto legado),
    retorna cadena vacía "" para evitar falsos positivos y aprobaciones cruzadas indebidas.
    """
    if not raw_psyc:
        return ""
    p = raw_psyc.upper().strip()
    
    # Exclusiones explícitas de valores que NO son psicólogas activas
    if p in ["MARI PAZ", "MARIPAZ", "CARO", "LINA", "ADMIN", "SERVICIO AL CLIENTE", "CUSTOMER SERVICE", "GENERAL", "NO ASIGNADA"]:
        return ""

    aliases = {
        "MAPE D": "MAPE D",
        "MAPE": "MAPE D",
        "MARIA PAULA": "MAPE D",
        "MARÍA PAULA": "MAPE D",
        "STEFFY": "STEFFY",
        "STEFF": "STEFFY",
        "MANU 1": "MANU",
        "MANU 2": "MANU",
        "MANU": "MANU",
        "SILVI": "SILVI",
        "SILVANA": "SILVI",
        "ANA MARIA": "ANA",
        "ANA": "ANA",
        "JENNIFER": "JENN",
        "JENN": "JENN",
        "SOFIA": "SOFI",
        "SOFI": "SOFI",
        "ALEJA": "ALEJA",
        "PIA": "PIA"
    }
    for k, v in aliases.items():
        if k == p or k in p.split():
            return v
            
    if p in ACTIVE_PSYCHOLOGISTS_SET:
        return p
        
    return ""


@router.get("/resolve-profile")
@router.post("/resolve-profile")
async def resolve_profile(
    payload: Optional[ResolveProfileRequest] = None,
    query: Optional[str] = None,
    url_or_query: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Resuelve una URL de perfil del CRM SmartMatchApp, un CRM ID o un nombre.
    Extrae el ID numérico y busca el usuario y perfil correspondiente.
    """
    raw_input = ""
    if payload and payload.url_or_query:
        raw_input = payload.url_or_query.strip()
    elif url_or_query:
        raw_input = url_or_query.strip()
    elif query:
        raw_input = query.strip()
    if not raw_input:
        raise HTTPException(status_code=400, detail="Entrada vacía")

    # 1. Intentar extraer CRM ID por regex de URL o número directo
    extracted_crm_id = None
    url_match = re.search(r"(?:client|profile|view)[/=#!]+(\d+)", raw_input, re.IGNORECASE) or re.search(r"(?:client|profile|view)/(\d+)", raw_input, re.IGNORECASE)
    if url_match:
        extracted_crm_id = url_match.group(1)
    elif re.search(r"[?&]id=(\d+)", raw_input, re.IGNORECASE):
        extracted_crm_id = re.search(r"[?&]id=(\d+)", raw_input, re.IGNORECASE).group(1)
    elif raw_input.isdigit():
        extracted_crm_id = raw_input

    # 2. Búsqueda en DB por crm_id o user id
    row = None
    if extracted_crm_id:
        res = await db.execute(text("""
            SELECT u.id, u.name, u.email, u.phone, u.crm_id,
                   p.city, p.orientation, p.gender, p.plan_tier, p.responsable
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.crm_id = :cid
            ORDER BY u.id DESC
            LIMIT 1
        """), {"cid": extracted_crm_id})
        row = res.fetchone()

        if not row and extracted_crm_id.isdigit():
            res = await db.execute(text("""
                SELECT u.id, u.name, u.email, u.phone, u.crm_id,
                       p.city, p.orientation, p.gender, p.plan_tier, p.responsable
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                WHERE u.id = :uid
                LIMIT 1
            """), {"uid": int(extracted_crm_id)})
            row = res.fetchone()

    # Si no se encontró por ID o no era ID, buscar por nombre
    if not row:
        clean_name = re.sub(r'https?://\S+', '', raw_input).strip()
        if clean_name:
            res = await db.execute(text("""
                SELECT u.id, u.name, u.email, u.phone, u.crm_id,
                       p.city, p.orientation, p.gender, p.plan_tier, p.responsable
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                WHERE LOWER(TRIM(u.name)) = LOWER(TRIM(:n))
                   OR u.name ILIKE :n_like
                ORDER BY CASE WHEN LOWER(TRIM(u.name)) = LOWER(TRIM(:n)) THEN 1 ELSE 2 END
                LIMIT 1
            """), {"n": clean_name, "n_like": f"%{clean_name}%"})
            row = res.fetchone()

    if not row:
        return {
            "found": False,
            "crm_id": extracted_crm_id or "",
            "name": "",
            "city": "",
            "pref": "",
            "plan_tier": "",
            "psychologist": "",
            "phone": "",
            "email": ""
        }

    orientation_val = (row.orientation or "").strip()
    pref_val = ""
    if orientation_val:
        if "gay" in orientation_val.lower() or "homo" in orientation_val.lower():
            pref_val = "gay"
        elif "lesb" in orientation_val.lower():
            pref_val = "lesb"
        elif "bi" in orientation_val.lower():
            pref_val = "bi"
        elif "hetero" in orientation_val.lower():
            pref_val = "hetero"
        else:
            pref_val = normalize_pref(orientation_val)

    final_cid = row.crm_id or extracted_crm_id or str(row.id)
    canonical_crm_url = f"https://dailylover.smartmatchapp.com/#!/client/{final_cid}/" if final_cid else raw_input

    return {
        "found": True,
        "crm_id": final_cid,
        "crm_url": canonical_crm_url,
        "name": row.name or "",
        "city": normalize_city(row.city),
        "pref": pref_val,
        "gender": row.gender or "",
        "plan_tier": normalize_plan(row.plan_tier),
        "psychologist": normalize_psychologist(row.responsable),
        "phone": row.phone or "",
        "email": row.email or ""
    }


@router.post("/check-compatibility")
async def check_compatibility(payload: CheckCompatibilityRequest, db: AsyncSession = Depends(get_db)):
    """
    Valida la compatibilidad entre Persona A y Persona B antes de asignarlas:
    1. Cita previa completada juntos en el historial.
    2. Compatibilidad de orientación/preferencia sexual.
    3. Compatibilidad de ciudad.
    """
    issues = []
    
    # 1. Obtener perfil de Persona A
    prof_a = None
    if payload.person_a_crm_id:
        res = await db.execute(text("""
            SELECT u.name, u.crm_id, p.city, p.orientation, p.gender, p.responsable
            FROM users u LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.crm_id = :cid LIMIT 1
        """), {"cid": str(payload.person_a_crm_id)})
        prof_a = res.fetchone()
    if not prof_a and payload.person_a_name:
        res = await db.execute(text("""
            SELECT u.name, u.crm_id, p.city, p.orientation, p.gender, p.responsable
            FROM users u LEFT JOIN profiles p ON p.user_id = u.id
            WHERE LOWER(TRIM(u.name)) = LOWER(TRIM(:n)) LIMIT 1
        """), {"n": payload.person_a_name.strip()})
        prof_a = res.fetchone()

    # 2. Obtener perfil de Persona B
    prof_b = None
    b_cid = payload.person_b_crm_id
    if not b_cid and payload.person_b_url:
        m = re.search(r"(?:client|profile|view)[/=#!]+(\d+)", payload.person_b_url, re.IGNORECASE) or re.search(r"[?&]id=(\d+)", payload.person_b_url, re.IGNORECASE)
        if m:
            b_cid = m.group(1)
            
    if b_cid:
        res = await db.execute(text("""
            SELECT u.name, u.crm_id, p.city, p.orientation, p.gender, p.responsable
            FROM users u LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.crm_id = :cid LIMIT 1
        """), {"cid": str(b_cid)})
        prof_b = res.fetchone()
    if not prof_b and payload.person_b_name:
        res = await db.execute(text("""
            SELECT u.name, u.crm_id, p.city, p.orientation, p.gender, p.responsable
            FROM users u LEFT JOIN profiles p ON p.user_id = u.id
            WHERE LOWER(TRIM(u.name)) = LOWER(TRIM(:n)) LIMIT 1
        """), {"n": payload.person_b_name.strip()})
        prof_b = res.fetchone()

    name_a = prof_a.name if prof_a else (payload.person_a_name or "Persona A")
    name_b = prof_b.name if prof_b else (payload.person_b_name or "Persona B")

    # Regla 1: Cita previa realizada juntos
    if name_a and name_b:
        res_date = await db.execute(text("""
            SELECT COUNT(*) FROM operational_matches
            WHERE ((LOWER(TRIM(person_a)) = LOWER(TRIM(:a)) AND LOWER(TRIM(person_b)) = LOWER(TRIM(:b)))
               OR  (LOWER(TRIM(person_a)) = LOWER(TRIM(:b)) AND LOWER(TRIM(person_b)) = LOWER(TRIM(:a))))
              AND status IN ('HECHO', 'APROBADO', 'cita realizada', 'DATE REALIZADO', 'MATCH DONE', 'cita confirmada')
        """), {"a": name_a, "b": name_b})
        count_dates = res_date.scalar() or 0
        if count_dates > 0:
            issues.append(f"Cita previa existente: {name_a} y {name_b} ya tuvieron una cita registrada en el historial ({count_dates} cita/s).")

    # Regla 2: Orientación / Preferencia (Comparación Simétrica)
    if prof_a and prof_b:
        pref_a = (prof_a.orientation or "").lower().strip()
        pref_b = (prof_b.orientation or "").lower().strip()
        gender_a = (prof_a.gender or "").lower().strip()
        gender_b = (prof_b.gender or "").lower().strip()

        norm_a = "gay" if ("gay" in pref_a or "homo" in pref_a) else ("lesb" if "lesb" in pref_a else ("bi" if "bi" in pref_a else ("hetero" if "hetero" in pref_a else pref_a)))
        norm_b = "gay" if ("gay" in pref_b or "homo" in pref_b) else ("lesb" if "lesb" in pref_b else ("bi" if "bi" in pref_b else ("hetero" if "hetero" in pref_b else pref_b)))

        if norm_a and norm_b and norm_a != norm_b and norm_a != "bi" and norm_b != "bi":
            label_a = "LESBIANA" if norm_a == "lesb" else norm_a.upper()
            label_b = "LESBIANA" if norm_b == "lesb" else norm_b.upper()
            issues.append(f"Incompatibilidad de orientación: {name_a} es {label_a} y {name_b} es {label_b}.")
        elif gender_a and gender_b and norm_a == "hetero" and norm_b == "hetero" and gender_a == gender_b:
            issues.append(f"Incompatibilidad de género para pareja hetero: Ambos perfiles tienen género '{gender_a}'.")

    # Regla 3: Ciudad (SOLO AVISO NO BLOQUEANTE)
    warnings = []
    if prof_a and prof_b:
        city_a = normalize_city(prof_a.city) if prof_a.city else ""
        city_b = normalize_city(prof_b.city) if prof_b.city else ""
        if city_a and city_b and city_a.lower() != city_b.lower():
            warnings.append(f"Ciudades distintas: {name_a} está en {city_a} y {name_b} está en {city_b}.")

    return {
        "compatible": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "name_a": name_a,
        "name_b": name_b,
        "city_a": prof_a.city if prof_a else "",
        "city_b": prof_b.city if prof_b else "",
        "pref_a": prof_a.orientation if prof_a else "",
        "pref_b": prof_b.orientation if prof_b else ""
    }


# ─── 10. ENDPOINTS DE VISTA DUAL DE MATCHES (ZONA INFERIOR & ZONA SUPERIOR) ──

@router.get("/matches/pending-service")
async def get_matches_pending_service(
    search: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna los matches aprobados por María que están en la Zona Inferior
    (esperando contacto de Servicio al Cliente, sin fecha agendada).
    """
    query = """
        SELECT 
            m.id, m.person_a, m.person_b, m.psychologist_name, m.city, m.plan_tier, m.pref,
            m.status, m.observations, m.created_at, m.updated_at,
            m.person_a_crm_id, m.person_b_crm_id,
            COALESCE(c.stage, 'pendiente') AS cs_stage,
            c.person_a_confirmation, c.person_b_confirmation,
            uA.phone AS phone_a, uB.phone AS phone_b
        FROM operational_matches m
        LEFT JOIN match_confirmations c ON c.match_id = m.id
        LEFT JOIN users uA ON LOWER(TRIM(uA.name)) = LOWER(TRIM(m.person_a))
        LEFT JOIN users uB ON LOWER(TRIM(uB.name)) = LOWER(TRIM(m.person_b))
        WHERE (m.status = 'APROBADO' OR m.approved_by_maria = true)
          AND (c.stage IS NULL OR c.stage IN ('pendiente', 'agendando', 'por confirmar', 'esperar', 'de viaje', 'problemas personales', 'no contestan', 'reprogramar'))
          AND (c.scheduled_date IS NULL)
    """
    params = {}
    if city and city.lower() not in ("all", "todas"):
        query += " AND m.city ILIKE :city"
        params["city"] = f"%{city.strip()}%"
    if status and status.lower() not in ("all", "todos"):
        query += " AND COALESCE(c.stage, 'pendiente') = :st"
        params["st"] = status.strip()
    if search:
        query += " AND (m.person_a ILIKE :srch OR m.person_b ILIKE :srch OR m.city ILIKE :srch OR m.observations ILIKE :srch)"
        params["srch"] = f"%{search.strip()}%"

    query += " ORDER BY m.updated_at DESC"
    res = await db.execute(text(query), params)
    rows = res.fetchall()

    matches = []
    for r in rows:
        d = dict(r._mapping)
        created_dt = d.get("updated_at") or d.get("created_at")
        days_pending = (datetime.utcnow() - created_dt).days if created_dt else 0
        obs_text = d.get("observations") or ""
        has_comp_alert = bool(
            "COMPATIBILIDAD FORZADA" in obs_text.upper() or
            "ALERTA COMPATIBILIDAD" in obs_text.upper() or
            "INCOMPATIBILIDAD" in obs_text.upper()
        )

        matches.append({
            "id": d.get("id"),
            "person_a": d.get("person_a"),
            "person_b": d.get("person_b"),
            "phone_a": d.get("phone_a") or "",
            "phone_b": d.get("phone_b") or "",
            "psychologist_name": d.get("psychologist_name"),
            "city": normalize_city(d.get("city")),
            "plan_tier": normalize_plan(d.get("plan_tier")),
            "cs_stage": d.get("cs_stage") or "pendiente",
            "confirmation_a": d.get("person_a_confirmation") or "Pendiente",
            "confirmation_b": d.get("person_b_confirmation") or "Pendiente",
            "observations": obs_text,
            "date": d.get("updated_at").strftime("%Y-%m-%d") if d.get("updated_at") else "",
            "days_pending": days_pending,
            "is_overdue": days_pending >= 15,
            "has_compatibility_alert": has_comp_alert
        })

    return {"matches": matches, "total": len(matches)}


@router.get("/matches/scheduled")
async def get_matches_scheduled(
    search: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    timeframe: Optional[str] = Query("all"),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna los matches agendados y confirmados (Zona Superior de MATCHES),
    con clasificación de citas pasadas, de hoy y futuras.
    """
    query = """
        SELECT 
            m.id, m.person_a, m.person_b, m.psychologist_name, m.city, m.plan_tier,
            c.scheduled_date, c.venue_name, c.stage, c.observations AS cs_notes,
            uA.phone AS phone_a, uB.phone AS phone_b
        FROM match_confirmations c
        JOIN operational_matches m ON m.id = c.match_id
        LEFT JOIN users uA ON LOWER(TRIM(uA.name)) = LOWER(TRIM(m.person_a))
        LEFT JOIN users uB ON LOWER(TRIM(uB.name)) = LOWER(TRIM(m.person_b))
        WHERE c.scheduled_date IS NOT NULL
           OR c.stage IN ('cita confirmada', 'DATE PROGRAMADO', 'cita realizada', 'match', 'MATCH DONE')
    """
    params = {}
    if city and city.lower() not in ("all", "todas"):
        query += " AND m.city ILIKE :city"
        params["city"] = f"%{city.strip()}%"
    if search:
        query += " AND (m.person_a ILIKE :srch OR m.person_b ILIKE :srch OR m.city ILIKE :srch OR c.venue_name ILIKE :srch)"
        params["srch"] = f"%{search.strip()}%"

    query += " ORDER BY c.scheduled_date ASC, c.id DESC"
    res = await db.execute(text(query), params)
    rows = res.fetchall()

    today_str = datetime.now().strftime("%Y-%m-%d")
    scheduled = []
    for r in rows:
        d = dict(r._mapping)
        sched_date = d.get("scheduled_date")
        date_str = sched_date.strftime("%Y-%m-%d") if sched_date else ""
        
        timing = "future"
        if date_str:
            if date_str < today_str:
                timing = "past"
            elif date_str == today_str:
                timing = "today"

        scheduled.append({
            "id": d.get("id"),
            "person_a": d.get("person_a"),
            "person_b": d.get("person_b"),
            "phone_a": d.get("phone_a") or "",
            "phone_b": d.get("phone_b") or "",
            "psychologist_name": d.get("psychologist_name"),
            "city": normalize_city(d.get("city")),
            "scheduled_date": date_str or "Por confirmar",
            "venue_name": d.get("venue_name") or "Por definir",
            "stage": d.get("stage") or "cita confirmada",
            "timing": timing,
            "cs_notes": d.get("cs_notes") or ""
        })

    return {"matches": scheduled, "total": len(scheduled)}


@router.get("/matches/cross-approvals")
async def get_cross_approvals(
    psychologist: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna los matches cruzados entre psicólogas (Psicóloga A ↔ Psicóloga B)
    pendientes de aprobación por parte de la Psicóloga de B.
    """
    query = """
        SELECT 
            m.id, m.person_a, m.person_b, m.psychologist_name AS psyc_a,
            m.city, m.plan_tier, m.pref, m.observations, m.created_at,
            uB.name AS ub_name, p.responsable AS psyc_b
        FROM operational_matches m
        LEFT JOIN users uB ON LOWER(TRIM(uB.name)) = LOWER(TRIM(m.person_b))
        LEFT JOIN profiles p ON p.user_id = uB.id
        WHERE m.status IN ('HECHO', 'REVISAR', 'PROPUESTO')
          AND m.approved_by_maria = false
    """
    res = await db.execute(text(query))
    rows = res.fetchall()

    seen_match_ids = set()
    cross_list = []
    for r in rows:
        d = dict(r._mapping)
        mid = d.get("id")
        if mid in seen_match_ids:
            continue
            
        pA_name = d.get("person_a")
        pB_name = d.get("person_b")
        
        # Validar que los nombres de las personas sean reales (no fechas ni notas)
        if not is_valid_person_name(pA_name) or not is_valid_person_name(pB_name):
            continue

        p_b = normalize_psychologist(d.get("psyc_b"))
        p_a = normalize_psychologist(d.get("psyc_a"))
        
        # Debe tener Psicóloga A y B activas y distintas
        if p_a and p_b and p_b != p_a:
            seen_match_ids.add(mid)
            cross_list.append({
                "id": mid,
                "person_a": pA_name,
                "person_b": pB_name,
                "psychologist_a": p_a,
                "psychologist_b": p_b,
                "city": normalize_city(d.get("city")),
                "plan_tier": normalize_plan(d.get("plan_tier")),
                "observations": d.get("observations") or "",
                "status": "ESPERANDO APROBACIÓN DE PSICÓLOGA B"
            })

    return {"cross_matches": cross_list, "total": len(cross_list)}


class ApproveCrossMatchRequest(BaseModel):
    observations_b: Optional[str] = None

class RejectCrossMatchRequest(BaseModel):
    rejection_reason: Optional[str] = None
    psychologist_b: Optional[str] = None


@router.post("/matches/{match_id}/approve-cross")
async def approve_cross_match_by_psyc_b(
    match_id: int,
    payload: Optional[ApproveCrossMatchRequest] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    La Psicóloga B aprueba la propuesta de match enviada por la Psicóloga A.
    El match queda con 'APROBADO POR PSICÓLOGAS (LISTO PARA MARÍA)'.
    """
    exist_res = await db.execute(text("""
        SELECT id, person_a, person_b, psychologist_name, observations
        FROM operational_matches
        WHERE id = :id
    """), {"id": match_id})
    match_row = exist_res.fetchone()
    if not match_row:
        raise HTTPException(status_code=404, detail="Match no encontrado")

    b_obs = payload.observations_b.strip() if payload and payload.observations_b else ""
    note = f" [Obs. Psicóloga B: {b_obs}]" if b_obs else " [Doble aprobación confirmada por Psicóloga B]"
    updated_obs = (match_row.observations or "") + note
    
    await db.execute(text("""
        UPDATE operational_matches
        SET status = 'APROBADO POR PSICÓLOGAS', observations = :obs, updated_at = NOW()
        WHERE id = :id
    """), {"id": match_id, "obs": updated_obs})
    await db.commit()

    return {"status": "success", "message": f"Match {match_id} validado por Psicóloga B. Ahora está listo para la aprobación final de María."}


@router.post("/matches/{match_id}/reject-cross")
async def reject_cross_match_by_psyc_b(
    match_id: int,
    payload: Optional[RejectCrossMatchRequest] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    La Psicóloga B rechaza la propuesta de match enviada por la Psicóloga A.
    1. Marca el match como 'RECHAZADA POR PSICÓLOGA B'.
    2. Crea automáticamente una nueva fila para Persona A en el pool de Psicóloga A ('Listo para match').
    """
    exist_res = await db.execute(text("""
        SELECT id, person_a, person_b, psychologist_name, city, pref, plan_tier, person_a_crm_id, observations
        FROM operational_matches
        WHERE id = :id
    """), {"id": match_id})
    match_row = exist_res.fetchone()
    if not match_row:
        raise HTTPException(status_code=404, detail="Match no encontrado")

    reason = payload.rejection_reason.strip() if payload and payload.rejection_reason else "Rechazado sin comentarios"
    updated_obs = (match_row.observations or "") + f" [Rechazado por Psicóloga B: {reason}]"

    # 1. Marcar como RECHAZADA POR PSICÓLOGA B
    await db.execute(text("""
        UPDATE operational_matches
        SET status = 'RECHAZADA POR PSICÓLOGA B', observations = :obs, updated_at = NOW()
        WHERE id = :id
    """), {"id": match_id, "obs": updated_obs})

    # 2. Crear nueva fila de reintento para Persona A en el pool de Psicóloga A
    next_slot_res = await db.execute(text("""
        SELECT COALESCE(MAX(slot_number), 0) + 1 AS next_slot
        FROM operational_matches
        WHERE LOWER(TRIM(person_a)) = LOWER(TRIM(:pa))
    """), {"pa": match_row.person_a})
    next_slot = next_slot_res.scalar() or 1

    retry_obs = f"Reintento automático tras propuesta rechazada por Psicóloga B ({reason})"
    await db.execute(text("""
        INSERT INTO operational_matches
        (city, pref, plan_tier, person_a, psychologist_name, slot_number, status, observations, person_a_crm_id, created_at, updated_at)
        VALUES (:city, :pref, :plan, :person_a, :psyc, :slot, 'Listo para match', :obs, :cid, NOW(), NOW())
    """), {
        "city": match_row.city,
        "pref": match_row.pref,
        "plan": match_row.plan_tier,
        "person_a": match_row.person_a,
        "psyc": match_row.psychologist_name,
        "slot": next_slot,
        "obs": retry_obs,
        "cid": match_row.person_a_crm_id
    })

    await db.commit()
    return {
        "status": "success",
        "message": f"Propuesta {match_id} rechazada. Se creó automáticamente una nueva fila para {match_row.person_a} en la cola de {match_row.psychologist_name}."
    }


# ─── 13. CATÁLOGO DE RESTAURANTES (⚙️ RESTAURANTES) Y CITAS ACEPTADAS ────────

OFFICIAL_VENUES = [
    "80 Sillas", "Amalfi", "Amarti", "Antigua Contemporánea", "Astoria", "Astrosoda", "Attic & Keller",
    "Bandido Bistro", "Bárbaro Cocina Primitiva (Poblado)", "Black Bear", "Brera", "Cacio & Pepe",
    "Café Bar Universal", "Café Cultor", "Café Dragón", "Café Moreno", "Café Otraparte", "Café Zorba",
    "Cantina La 15", "Casa", "Cassette Salitre", "Cecilia 93", "Cecilia Chapinero", "Cecilia Usaquén",
    "Celestina", "Central Cevichería Salitre", "Cossette 109", "Criterión", "Cuzco", "Da Quei Matti Cedritos",
    "El Chato", "El Francés", "Gamberro", "Harry Sasson", "Ideal", "Juana La Loca", "La Brasserie",
    "La Cabrera", "La Causa (Poblado)", "La Fabbrica", "Libertario 70", "Libertario 79", "Libertario 85",
    "Libertario 93", "Libertario 109", "Libertario 122", "Libertario Chapinero", "Libertario Usaquén 119",
    "Local by Rausch", "Luna", "Mala Flor", "Marzzano", "Misia", "Nezia", "Nueve", "Oficial", "Osaka",
    "Osaki 71", "Osaki 72", "Osaki 85", "Osaki 89", "Osaki 90", "Osaki 93", "Osaki 118", "Osaki Artisan",
    "Osaki Bazar Chía", "Osaki Usaquén", "Parmessano Atlantis", "Pergamino 10B", "Pergamino Laureles",
    "Pianta", "Piazza by Storia D'Amore", "Punto Baja", "Romeo", "Romero Arkadia", "Romero Laureles",
    "Romero Poblado", "Santorini", "Segundo", "Semolina", "Sexy Seoul", "Siga", "Storia D'Amore", "Susurro",
    "Tagliata", "The Winston", "Ushin Japanese Grill", "Veccina 85", "Voraz Laureles", "Voraz Poblado",
    "Wok 93", "Otro"
]

@router.get("/venues")
async def get_venues():
    """
    Retorna el catálogo oficial de restaurantes y lugares aliados (⚙️ RESTAURANTES).
    """
    return {
        "venues": sorted(OFFICIAL_VENUES),
        "total": len(OFFICIAL_VENUES)
    }

@router.get("/accepted-dates")
async def get_accepted_dates(
    city: Optional[str] = Query(None),
    venue: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna la lista de 'Citas Aceptadas' (piloto en paralelo con MATCHES).
    """
    query = """
        SELECT 
            s.id, s.match_id, s.person_a, s.person_b, s.date_time, s.venue, s.city,
            s.reservation_name, s.reservation_confirmed, s.had_date, s.feedback, s.reschedule,
            s.created_at, s.updated_at,
            m.psychologist_name, m.status as match_status
        FROM scheduled_dates s
        LEFT JOIN operational_matches m ON m.id = s.match_id
        WHERE 1=1
    """
    params = {}
    if city and city.lower() not in ("all", "todas"):
        query += " AND s.city ILIKE :city"
        params["city"] = f"%{city.strip()}%"
    if venue and venue.lower() not in ("all", "todos"):
        query += " AND s.venue ILIKE :ven"
        params["ven"] = f"%{venue.strip()}%"
    if search:
        query += " AND (s.person_a ILIKE :srch OR s.person_b ILIKE :srch OR s.venue ILIKE :srch)"
        params["srch"] = f"%{search.strip()}%"

    query += " ORDER BY s.updated_at DESC, s.id DESC"
    res = await db.execute(text(query), params)
    rows = res.fetchall()

    items = []
    for r in rows:
        d = dict(r._mapping)
        items.append({
            "id": d.get("id"),
            "match_id": d.get("match_id"),
            "person_a": d.get("person_a"),
            "person_b": d.get("person_b"),
            "date_time": d.get("date_time") or "",
            "venue": d.get("venue") or "",
            "city": normalize_city(d.get("city")),
            "psychologist_name": d.get("psychologist_name") or "",
            "status": "Cita Confirmada" if d.get("had_date") is False and not d.get("reschedule") else ("Cita Realizada" if d.get("had_date") else ("Reprogramar" if d.get("reschedule") else "Agendada")),
            "had_date": bool(d.get("had_date")),
            "reschedule": bool(d.get("reschedule")),
            "feedback": d.get("feedback") or ""
        })

    return {
        "dates": items,
        "total": len(items)
    }


@router.post("/check-inactivity-alerts")
async def check_inactivity_alerts(
    db: AsyncSession = Depends(get_db)
):
    """
    🚨 REGLA DE INACTIVIDAD 15+ DÍAS EN CLIENTES:
    Evalúa a todos los clientes registrados y su última fecha de actividad (citas, matches, slots).
    Si llevan 15 días o más sin actividad:
    1. Cierra filas abiertas anteriores en 'Listo para match' sin candidato como 'NO HAY GENTE'.
    2. Crea un nuevo slot de reactivación para su psicóloga asignada.
    """
    # 1. Obtener clientes con última actividad mayor o igual a 15 días mediante CTE pre-agregada
    inactive_query = text("""
        WITH all_activities AS (
            SELECT LOWER(TRIM(person_a)) AS person_name, MAX(created_at) AS max_act FROM operational_matches WHERE person_a IS NOT NULL GROUP BY LOWER(TRIM(person_a))
            UNION ALL
            SELECT LOWER(TRIM(person_b)) AS person_name, MAX(created_at) AS max_act FROM operational_matches WHERE person_b IS NOT NULL GROUP BY LOWER(TRIM(person_b))
            UNION ALL
            SELECT LOWER(TRIM(person_a)) AS person_name, MAX(created_at) AS max_act FROM scheduled_dates WHERE person_a IS NOT NULL GROUP BY LOWER(TRIM(person_a))
            UNION ALL
            SELECT LOWER(TRIM(person_b)) AS person_name, MAX(created_at) AS max_act FROM scheduled_dates WHERE person_b IS NOT NULL GROUP BY LOWER(TRIM(person_b))
            UNION ALL
            SELECT LOWER(TRIM(person_a)) AS person_name, MAX(created_at) AS max_act FROM historical_matches WHERE person_a IS NOT NULL GROUP BY LOWER(TRIM(person_a))
            UNION ALL
            SELECT LOWER(TRIM(person_b)) AS person_name, MAX(created_at) AS max_act FROM historical_matches WHERE person_b IS NOT NULL GROUP BY LOWER(TRIM(person_b))
        ),
        max_activity_per_person AS (
            SELECT person_name, MAX(max_act) AS last_match_act
            FROM all_activities
            GROUP BY person_name
        ),
        user_activities AS (
            SELECT 
                u.id AS user_id,
                u.name,
                u.crm_id,
                p.responsable,
                p.city,
                p.plan_tier,
                COALESCE(m.last_match_act, u.created_at) AS last_activity,
                EXTRACT(DAY FROM (NOW() - COALESCE(m.last_match_act, u.created_at)))::int AS diff_days
            FROM users u
            JOIN profiles p ON p.user_id = u.id
            LEFT JOIN max_activity_per_person m ON m.person_name = LOWER(TRIM(u.name))
            WHERE u.name IS NOT NULL AND TRIM(u.name) != '' AND p.responsable IS NOT NULL AND TRIM(p.responsable) != ''
        )
        SELECT * FROM user_activities
        WHERE last_activity IS NOT NULL AND diff_days >= 15
    """)

    res = await db.execute(inactive_query)
    inactive_users = res.fetchall()

    reactivated_count = 0
    closed_old_count = 0

    for u in inactive_users:
        u_name = u.name.strip()
        psyc = normalize_psychologist(u.responsable)
        if not psyc:
            continue

        diff_days = u.diff_days or 15
        max_act_str = u.last_activity.strftime('%Y-%m-%d') if u.last_activity else "hace >15 días"

        # 2. Cerrar slots viejos abiertos sin candidato
        old_slots_res = await db.execute(text("""
            UPDATE operational_matches
            SET status = 'NO HAY GENTE',
                observations = COALESCE(observations, '') || ' [CERRADO POR INACTIVIDAD] Slot cerrado automáticamente tras 15+ días sin candidato.',
                updated_at = NOW()
            WHERE LOWER(TRIM(person_a)) = LOWER(TRIM(:uname))
              AND (person_b IS NULL OR TRIM(person_b) = '' OR LOWER(TRIM(person_b)) = 'por definir')
              AND status IN ('Listo para match', 'En búsqueda', 'Esperando...')
            RETURNING id
        """), {"uname": u_name})
        
        closed_slots = old_slots_res.fetchall()
        closed_old_count += len(closed_slots)

        # 3. Crear nuevo slot de reactivación
        next_slot_res = await db.execute(text("""
            SELECT COALESCE(MAX(slot_number), 0) + 1 AS next_slot
            FROM operational_matches
            WHERE LOWER(TRIM(person_a)) = LOWER(TRIM(:uname))
        """), {"uname": u_name})
        next_slot = next_slot_res.scalar() or 1

        obs_inactivity = f"[INACTIVIDAD 15+ DÍAS] Sin match ni cita desde {max_act_str} ({diff_days} días sin actividad). Reactivación automática."

        await db.execute(text("""
            INSERT INTO operational_matches
            (city, pref, plan_tier, person_a, psychologist_name, slot_number, status, observations, person_a_crm_id, is_priority, created_at, updated_at)
            VALUES (:city, '', :plan, :person_a, :psyc, :slot, 'Listo para match', :obs, :cid, true, NOW(), NOW())
        """), {
            "city": u.city or "Bogotá",
            "plan": u.plan_tier or "Estándar",
            "person_a": u_name,
            "psyc": psyc,
            "slot": next_slot,
            "obs": obs_inactivity,
            "cid": u.crm_id or ""
        })

        await db.execute(text("""
            INSERT INTO person_history (person_name, event_type, details, created_at)
            VALUES (:name, 'INACTIVITY_REACTIVATION', :det, NOW())
        """), {"name": u_name, "det": obs_inactivity})

        reactivated_count += 1

    await db.commit()

    return {
        "status": "success",
        "inactive_clients_found": len(inactive_users),
        "reactivated_clients": reactivated_count,
        "closed_old_slots": closed_old_count
    }






