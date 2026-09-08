"""
Calendly Sync Service for Daily Lover.
Processes completed Calendly interview events, matches the person against SmartMatchApp CRM,
and safely appends them into Google Sheets 'PROFILES' tab via Service Account if not already present.
Ensures 'Responsable' is left empty in yellow (#FFF2CC) for manual assignment.
"""

import os
import re
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.services.google_sheets import (
    check_person_exists_in_profiles,
    append_profile_to_profiles_tab
)

logger = logging.getLogger(__name__)

# Mapa oficial de aliases para normalizar las 10 opciones de psicólogas de Calendly
PSYCHOLOGIST_ALIASES = {
    "jenn": "JENN",
    "jennifer": "JENN",
    "ana": "ANA",
    "silvi": "SILVI",
    "silvia": "SILVI",
    "steff": "STEFFY",
    "steffy": "STEFFY",
    "estefania": "STEFFY",
    "estefanía": "STEFFY",
    "sofi": "SOFI",
    "sofia": "SOFI",
    "sofía": "SOFI",
    "sofi arias": "SOFI",
    "sofia arias": "SOFI",
    "sofía arias": "SOFI",
    "mape": "MAPE D",
    "mape d": "MAPE D",
    "maria paula": "MAPE D",
    "maría paula": "MAPE D",
    "aleja": "ALEJA",
    "alejandra": "ALEJA",
    "manu": "MANU",
    "manuela": "MANU",
    "pia": "PIA",
    "pía": "PIA",
    "isa": "ISA",
    "isabella": "ISA",
    "isa marquez": "ISA",
    "isabella marquez": "ISA",
    "mps": "MPS",
    "maria": "MPS",
    "maría": "MPS"
}


def extract_psychologist_from_calendly(event_data: Dict[str, Any]) -> Optional[str]:
    """
    Extrae la psicóloga seleccionada en la pregunta de Calendly:
    '¿Qué psicóloga te va a entrevistar?'
    Busca en 'questions_and_answers' de forma flexible (mayúsculas, minúsculas, tildes).
    Retorna el nombre canónico oficial (ej: 'SOFI', 'MANU', 'MAPE D') o None si no se especificó.
    """
    q_and_a = event_data.get("questions_and_answers") or []
    for qa in q_and_a:
        question = str(qa.get("question") or "").lower()
        answer = str(qa.get("answer") or "").strip()
        if not answer:
            continue

        # Si la pregunta se refiere a la psicóloga o entrevistadora
        if "psic" in question or "entrevist" in question:
            clean_ans = answer.lower().strip()
            # 1. Coincidencia directa en aliases
            if clean_ans in PSYCHOLOGIST_ALIASES:
                return PSYCHOLOGIST_ALIASES[clean_ans]
            # 2. Coincidencia por subcadena
            for alias_key, canon_name in PSYCHOLOGIST_ALIASES.items():
                if alias_key in clean_ans:
                    return canon_name
            # 3. Fallback: retornar en mayúsculas limpio
            return answer.upper()

    return None


async def match_person_in_crm_or_db(
    db: AsyncSession,
    name: str,
    email: Optional[str] = None,
    phone: Optional[str] = None
) -> Dict[str, Any]:
    """
    Busca al entrevistado en la base de datos local y/o SmartMatchApp CRM.
    Retorna diccionario con name, crm_id, city, age, plan_tier.
    """
    clean_name = (name or "").strip()
    clean_email = (email or "").strip().lower() if email else None

    # 1. Búsqueda por Email en DB local (máxima precisión)
    if clean_email:
        res = await db.execute(text("""
            SELECT u.id, u.name, u.email, u.phone, u.crm_id,
                   p.city, p.age, p.plan_tier, p.responsable
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE LOWER(TRIM(u.email)) = :email
            ORDER BY u.id DESC
            LIMIT 1
        """), {"email": clean_email})
        row = res.fetchone()
        if row:
            return {
                "name": row[1] or clean_name,
                "crm_id": row[4],
                "email": row[2],
                "city": row[5] or "",
                "age": str(row[6]) if row[6] is not None else "",
                "plan_tier": row[7] or "",
                "found_source": "db_email"
            }

    # 2. Búsqueda por Nombre en DB local
    if clean_name:
        res = await db.execute(text("""
            SELECT u.id, u.name, u.email, u.phone, u.crm_id,
                   p.city, p.age, p.plan_tier, p.responsable
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE LOWER(TRIM(u.name)) = LOWER(:name)
               OR LOWER(u.name) ILIKE :name_like
            ORDER BY u.id DESC
            LIMIT 1
        """), {"name": clean_name, "name_like": f"%{clean_name}%"})
        row = res.fetchone()
        if row:
            return {
                "name": row[1] or clean_name,
                "crm_id": row[4],
                "email": row[2],
                "city": row[5] or "",
                "age": str(row[6]) if row[6] is not None else "",
                "plan_tier": row[7] or "",
                "found_source": "db_name"
            }

    # 3. Fallback: Datos directos de Calendly
    return {
        "name": clean_name,
        "crm_id": None,
        "email": clean_email,
        "city": "",
        "age": "",
        "plan_tier": "",
        "found_source": "calendly_direct"
    }


async def process_calendly_interview_completed(
    payload: Dict[str, Any],
    db: AsyncSession
) -> Dict[str, Any]:
    """
    Procesa el evento de entrevista completada proveniente de Calendly:
    1. Filtra cancelaciones e inasistencias ('no-show').
    2. Extrae datos del invitado y fecha de la entrevista.
    3. Cruza contra SmartMatchApp CRM / BD local para obtener su crm_id.
    4. Comprueba si ya existe en PROFILES (idempotencia).
    5. Si no existe, crea la fila con el enlace canónico y Responsable en amarillo (#FFF2CC).
    """
    event_type = payload.get("event") or payload.get("event_type") or ""
    event_data = payload.get("payload") or payload

    # 1. Filtro: Descartar eventos de cancelación o no-show
    status = (event_data.get("status") or "").lower().strip()
    is_canceled = (
        event_data.get("canceled") is True or
        status in ["canceled", "cancelled", "no_show", "noshow"] or
        "canceled" in event_type.lower()
    )
    if is_canceled:
        logger.info(f"Evento Calendly ignorado (Cita cancelada o no-show): {event_type}, status='{status}'")
        return {
            "status": "ignored",
            "reason": "La cita fue cancelada o marcada como no-show."
        }

    # 2. Extracción de Nombre, Email y Fecha
    invitee_name = event_data.get("name") or event_data.get("invitee_name") or ""
    invitee_email = event_data.get("email") or event_data.get("invitee_email") or ""
    
    if not invitee_name and "scheduled_event" in event_data:
        invitees = event_data.get("scheduled_event", {}).get("event_guests", [])
        if invitees:
            invitee_name = invitees[0].get("name", "")
            invitee_email = invitees[0].get("email", "")

    if not invitee_name:
        logger.warning(f"Payload de Calendly sin nombre de persona: {payload}")
        return {
            "status": "error",
            "reason": "No se encontró el nombre de la persona en el evento de Calendly."
        }

    # Fecha de la entrevista
    start_time_raw = (
        event_data.get("start_time") or
        event_data.get("scheduled_event", {}).get("start_time") or
        event_data.get("event_start_time") or ""
    )
    interview_date = ""
    if start_time_raw:
        try:
            dt = datetime.fromisoformat(start_time_raw.replace("Z", "+00:00"))
            interview_date = dt.strftime("%Y-%m-%d")
        except Exception:
            interview_date = str(start_time_raw)[:10]

    if not interview_date:
        interview_date = datetime.now().strftime("%Y-%m-%d")

    logger.info(f"Procesando entrevista completada Calendly para: '{invitee_name}' (Email: {invitee_email}, Fecha: {interview_date})")

    # 3. Cruzar contra CRM / DB Local
    crm_profile = await match_person_in_crm_or_db(db, invitee_name, invitee_email)
    crm_id = crm_profile.get("crm_id")
    final_name = crm_profile.get("name") or invitee_name
    city = crm_profile.get("city") or ""
    age = crm_profile.get("age") or ""

    # 4. Extraer psicóloga seleccionada en el formulario de Calendly
    responsable = extract_psychologist_from_calendly(event_data)
    if not responsable and crm_profile.get("responsable"):
        responsable = crm_profile.get("responsable")

    # 5. Verificar si ya existe en PROFILES (Idempotencia absoluta)
    already_exists = check_person_exists_in_profiles(final_name, crm_id)
    if already_exists:
        logger.info(f"Idempotencia: '{final_name}' (CRM: {crm_id}) ya existe en PROFILES. No se duplica.")
        return {
            "status": "skipped",
            "reason": f"'{final_name}' ya existe en la pestaña PROFILES.",
            "name": final_name,
            "crm_id": crm_id
        }

    # 6. Insertar en PROFILES (con Responsable asignado, o vacío/amarillo si no se especificó)
    insert_payload = {
        "name": final_name,
        "crm_id": crm_id,
        "interview_date": interview_date,
        "responsable": responsable or "",
        "city": city,
        "age": age
    }

    result = append_profile_to_profiles_tab(insert_payload)
    if result.get("success"):
        logger.info(f"🎉 Persona de Calendly creada exitosamente en PROFILES fila {result.get('row')}: {final_name} (Responsable: {responsable or 'Vacío/Amarillo'})")
        return {
            "status": "created",
            "row": result.get("row"),
            "name": final_name,
            "crm_id": crm_id,
            "interview_date": interview_date,
            "responsable": responsable or "PENDIENTE_MANUAL"
        }
    else:
        logger.error(f"Error al insertar en PROFILES: {result.get('error')}")
        return {
            "status": "error",
            "reason": result.get("error")
        }


CALENDLY_USER_URI = "https://api.calendly.com/users/cba1f544-e8d9-4a59-a31e-65c16371eae0"


async def poll_calendly_scheduled_events(
    db: AsyncSession,
    limit: int = 5,
    event_uuid: Optional[str] = None
) -> Dict[str, Any]:
    """
    Consulta la API de Calendly (Polling) para procesar eventos recientes o un evento específico:
    1. Si se provee event_uuid, consulta ese evento directamente.
    2. Si no, consulta los eventos activos ordenados por start_time.
    3. Para cada evento, obtiene sus invitados (invitees), extrae Q&A y procesa la inserción en PROFILES.
    """
    import urllib.request
    import json
    from app.config import get_settings

    settings = get_settings()
    token = settings.calendly_api_token or os.environ.get("CALENDLY_API_TOKEN")
    if not token:
        return {"status": "error", "message": "CALENDLY_API_TOKEN no configurado"}

    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/json"
    }

    results = []

    try:
        events_to_process = []
        if event_uuid:
            clean_uuid = event_uuid.split("/")[-1]
            url = f"https://api.calendly.com/scheduled_events/{clean_uuid}"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode())
                if data.get("resource"):
                    events_to_process.append(data["resource"])
        else:
            url = f"https://api.calendly.com/scheduled_events?user={CALENDLY_USER_URI}&status=active&count={limit}"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode())
                events_to_process = data.get("collection", [])

        logger.info(f"Calendly Polling: {len(events_to_process)} evento(s) a revisar.")

        for ev in events_to_process:
            ev_uri = ev.get("uri", "")
            ev_uuid = ev_uri.split("/")[-1] if ev_uri else ""
            if not ev_uuid:
                continue

            # Obtener los invitados
            inv_url = f"https://api.calendly.com/scheduled_events/{ev_uuid}/invitees"
            inv_req = urllib.request.Request(inv_url, headers=headers)
            with urllib.request.urlopen(inv_req, timeout=15) as inv_resp:
                inv_data = json.loads(inv_resp.read().decode())
                invitees = inv_data.get("collection", [])

            for inv in invitees:
                payload = {
                    "event": "invitee.created",
                    "payload": {
                        "event_type": {"name": ev.get("name")},
                        "event": ev_uri,
                        "name": inv.get("name"),
                        "email": inv.get("email"),
                        "status": inv.get("status"),
                        "start_time": ev.get("start_time"),
                        "questions_and_answers": inv.get("questions_and_answers", [])
                    }
                }
                res = await process_calendly_interview_completed(payload, db)
                results.append({
                    "event_uuid": ev_uuid,
                    "invitee_name": inv.get("name"),
                    "result": res
                })

        return {
            "status": "success",
            "total_events_checked": len(events_to_process),
            "processed": results
        }

    except Exception as e:
        logger.error(f"Error durante polling de Calendly: {e}")
        return {
            "status": "error",
            "error": str(e),
            "processed": results
        }

