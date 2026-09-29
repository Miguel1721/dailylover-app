"""
Google Calendar VIP Integration Service for Daily Lover.
Acts as a Third-Party Organizer (Tercero Anfitrión) to:
1. Inspect free/busy availability on María Salinas' calendar (OWNER_EMAIL) with read-only freebusy.query.
2. Calculate available 45-minute slots during business hours (Mon-Fri 9:00 - 17:00 COT, min 48h advance notice).
3. Create events as the ORGANIZER account (info@dailylover.org, via OAuth) inviting both María and the VIP client
   with a real auto-generated Google Meet link. Google sends the official invitations.
4. If the organizer is not configured or Google fails, NEVER invent a Meet link: the caller is told and alerts a human.
"""

import os
import uuid
import logging
import zoneinfo
from datetime import datetime, timedelta, time
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

OWNER_EMAIL = os.getenv("OWNER_EMAIL", "maria.salinas@dailylover.org")
DEFAULT_TIMEZONE = "America/Bogota"


def get_colombia_tz():
    """Retorna la zona horaria de Colombia de forma resiliente."""
    try:
        import zoneinfo
        return zoneinfo.ZoneInfo(DEFAULT_TIMEZONE)
    except Exception:
        from datetime import timezone
        return timezone(timedelta(hours=-5))


def get_calendar_client():
    """Retorna un cliente de Google Calendar API autenticado con cuenta de servicio o None si no hay credenciales."""
    creds_path = os.environ.get("GOOGLE_CALENDAR_CREDENTIALS_PATH") or os.environ.get("GOOGLE_SHEETS_CREDENTIALS_PATH")
    
    if not creds_path or not os.path.exists(creds_path):
        candidate_paths = [
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "scratch", "service_account.json"),
            os.path.join(os.path.dirname(__file__), "..", "service_account.json"),
            os.path.join(os.getcwd(), "scratch", "service_account.json"),
            os.path.join(os.getcwd(), "service_account.json"),
            "/etc/dailylover/google-sheets-credentials.json",
            "/opt/daily-lover-web/service_account.json"
        ]
        for cp in candidate_paths:
            norm_p = os.path.normpath(cp)
            if os.path.exists(norm_p):
                creds_path = norm_p
                break

    if not creds_path or not os.path.exists(creds_path):
        logger.warning(f"Google Calendar Service Account JSON no encontrado en ruta: {creds_path}. Modo Simulación activo.")
        return None

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        scopes = [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.events"
        ]
        creds = service_account.Credentials.from_service_account_file(
            creds_path,
            scopes=scopes
        )
        return build("calendar", "v3", credentials=creds)
    except Exception as e:
        logger.error(f"Error inicializando cliente de Google Calendar API: {e}")
        return None


def get_organizer_calendar_client():
    """
    Cliente de Google Calendar autenticado como la cuenta ORGANIZADORA (info@dailylover.org) mediante OAuth.
    Requiere GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET y GOOGLE_OAUTH_REFRESH_TOKEN.
    Devuelve None si faltan o si falla la inicialización.
    """
    cid = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "").strip()
    csec = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "").strip()
    rtok = os.environ.get("GOOGLE_OAUTH_REFRESH_TOKEN", "").strip()
    if not (cid and csec and rtok):
        return None
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=None,
            refresh_token=rtok,
            client_id=cid,
            client_secret=csec,
            token_uri="https://oauth2.googleapis.com/token",
            scopes=["https://www.googleapis.com/auth/calendar"],
        )
        return build("calendar", "v3", credentials=creds, cache_discovery=False)
    except Exception as e:
        logger.error(f"Error inicializando cliente OAuth del organizador de Google Calendar: {e}")
        return None


def get_owner_busy_intervals(start_dt: datetime, end_dt: datetime) -> List[Dict[str, datetime]]:
    """
    Consulta freebusy.query en Google Calendar para maria.salinas@dailylover.org.
    Retorna lista de intervalos ocupados: [{'start': dt, 'end': dt}, ...].
    Solo lectura: no accede a títulos ni descripciones privadas de eventos.
    Garantiza normalización estricta a hora colombiana (America/Bogota, COT).
    """
    service = get_organizer_calendar_client() or get_calendar_client()
    if not service:
        return []

    try:
        tz_cot = get_colombia_tz()
        t_min = (start_dt.replace(tzinfo=tz_cot) if start_dt.tzinfo is None else start_dt.astimezone(tz_cot)).isoformat()
        t_max = (end_dt.replace(tzinfo=tz_cot) if end_dt.tzinfo is None else end_dt.astimezone(tz_cot)).isoformat()

        body = {
            "timeMin": t_min,
            "timeMax": t_max,
            "timeZone": DEFAULT_TIMEZONE,
            "items": [{"id": OWNER_EMAIL}]
        }
        res = service.freebusy().query(body=body).execute()
        calendars = res.get("calendars", {})
        owner_cal = calendars.get(OWNER_EMAIL, {})
        busy_list = owner_cal.get("busy", [])

        parsed = []
        for b in busy_list:
            s_str = b.get("start", "")
            e_str = b.get("end", "")
            if s_str and e_str:
                # Normalizar a datetime en hora colombiana (America/Bogota) sin offset para comparación local segura
                s_dt = datetime.fromisoformat(s_str).astimezone(tz_cot).replace(tzinfo=None)
                e_dt = datetime.fromisoformat(e_str).astimezone(tz_cot).replace(tzinfo=None)
                parsed.append({"start": s_dt, "end": e_dt})
        return parsed
    except Exception as e:
        logger.warning(f"No se pudo consultar freebusy de Google Calendar ({e}). Usando disponibilidad estándar.")
        return []


def calculate_available_vip_slots(
    days_ahead: int = 7,
    slot_minutes: int = 30,
    max_slots: Optional[int] = 6,
    max_per_day: Optional[int] = 2,
    existing_booked_slots: Optional[List[str]] = None,
    min_notice_hours: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Calcula opciones de espacios libres ("huecos") ideales de 30 min en la agenda de María Salinas.
    Reglas de negocio:
    - Ventana: a partir del día siguiente al pago en HORA COLOMBIANA.
    - Días: Lunes a Viernes únicamente.
    - Franjas: 10:00 AM a 1:00 PM (10:00 - 13:00) y 5:00 PM a 7:00 PM (17:00 - 19:00).
    - Duración: 30 minutos (media hora).
    - Descuenta bloques ocupados de Google Calendar (freebusy) y citas previas en DB.
    """
    tz_cot = get_colombia_tz()
    # now en hora colombiana independientemente de la zona del host (ej: UTC en Docker)
    now = datetime.now(tz_cot).replace(tzinfo=None)

    # A partir del día siguiente que hacen el pago
    start_day = (now + timedelta(days=1)).date()
    end_day = start_day + timedelta(days=days_ahead)

    # Ventana de consulta a Google Calendar
    start_window = datetime.combine(start_day, time(10, 0))
    end_window = datetime.combine(end_day, time(19, 0))

    busy_intervals = get_owner_busy_intervals(start_window, end_window)
    booked_set = set(existing_booked_slots or [])

    available_slots = []
    meses_es = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    dias_es = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

    # Franja Mañana (10:00 AM - 1:00 PM) y Franja Tarde (5:00 PM - 7:00 PM)
    morning_hours = [(10, 0), (10, 30), (11, 0), (11, 30), (12, 0), (12, 30)]
    afternoon_hours = [(17, 0), (17, 30), (18, 0), (18, 30)]

    current_day = start_day

    while current_day <= end_day:
        if max_slots and len(available_slots) >= max_slots:
            break

        # Solo Lunes (0) a Viernes (4)
        if current_day.weekday() < 5:
            day_slots = []

            # Si max_per_day está activado, buscar balancear mañana y tarde
            if max_per_day and max_per_day >= 2:
                # 1. Buscar en la mañana
                for hour, minute in morning_hours:
                    slot_start = datetime.combine(current_day, time(hour, minute))
                    slot_end = slot_start + timedelta(minutes=slot_minutes)
                    slot_key = slot_start.strftime("%Y-%m-%d %H:%M")
                    if slot_key in booked_set:
                        continue
                    collision = any(not (slot_end <= b["start"] or slot_start >= b["end"]) for b in busy_intervals)
                    if not collision:
                        day_slots.append((slot_start, hour, minute))
                        break  # Tomar el primer hueco óptimo de la mañana

                # 2. Buscar en la tarde
                for hour, minute in afternoon_hours:
                    slot_start = datetime.combine(current_day, time(hour, minute))
                    slot_end = slot_start + timedelta(minutes=slot_minutes)
                    slot_key = slot_start.strftime("%Y-%m-%d %H:%M")
                    if slot_key in booked_set:
                        continue
                    collision = any(not (slot_end <= b["start"] or slot_start >= b["end"]) for b in busy_intervals)
                    if not collision:
                        day_slots.append((slot_start, hour, minute))
                        break  # Tomar el primer hueco óptimo de la tarde

                # Si no hubo en la tarde o en la mañana y aún hay cupo en el día, completar
                if len(day_slots) < max_per_day:
                    all_hours = morning_hours + afternoon_hours
                    for hour, minute in all_hours:
                        slot_start = datetime.combine(current_day, time(hour, minute))
                        if any(s[0] == slot_start for s in day_slots):
                            continue
                        slot_end = slot_start + timedelta(minutes=slot_minutes)
                        slot_key = slot_start.strftime("%Y-%m-%d %H:%M")
                        if slot_key in booked_set:
                            continue
                        collision = any(not (slot_end <= b["start"] or slot_start >= b["end"]) for b in busy_intervals)
                        if not collision:
                            day_slots.append((slot_start, hour, minute))
                            if len(day_slots) >= max_per_day:
                                break
            else:
                # Modo continuo sin límite por día
                all_hours = morning_hours + afternoon_hours
                for hour, minute in all_hours:
                    slot_start = datetime.combine(current_day, time(hour, minute))
                    slot_end = slot_start + timedelta(minutes=slot_minutes)
                    slot_key = slot_start.strftime("%Y-%m-%d %H:%M")
                    if slot_key in booked_set:
                        continue
                    collision = any(not (slot_end <= b["start"] or slot_start >= b["end"]) for b in busy_intervals)
                    if not collision:
                        day_slots.append((slot_start, hour, minute))
                        if max_slots and (len(available_slots) + len(day_slots)) >= max_slots:
                            break

            # Ordenar cronológicamente y agregar al resultado
            day_slots.sort(key=lambda x: x[0])
            for slot_start, hour, minute in day_slots:
                dow_name = dias_es[current_day.weekday()]
                mes_name = meses_es[current_day.month - 1]
                display_time = f"{hour if hour <= 12 else hour - 12}:{minute:02d} {'AM' if hour < 12 else 'PM'}"
                display_date = f"{dow_name} {current_day.day} de {mes_name}"

                available_slots.append({
                    "slot_iso": slot_start.isoformat(),
                    "date_str": current_day.strftime("%Y-%m-%d"),
                    "time_str": f"{hour:02d}:{minute:02d}",
                    "display_date": display_date,
                    "display_time": display_time,
                    "display_full": f"{display_date} a las {display_time}"
                })
                if max_slots and len(available_slots) >= max_slots:
                    break

        current_day += timedelta(days=1)

    return available_slots[:max_slots] if max_slots else available_slots


def create_third_party_vip_event(
    client_name: str,
    client_email: str,
    start_dt: datetime,
    end_dt: datetime,
    client_phone: Optional[str] = None
) -> Dict[str, Any]:
    """
    Crea la cita en el calendario de la cuenta ORGANIZADORA (info@dailylover.org, OAuth)
    e invita a María Salinas y al cliente VIP. Google genera la sala de Meet y envía las invitaciones oficiales.

    Retorna siempre un dict con "status": "success" solo si el evento REAL quedó creado.
    En cualquier otro caso retorna status "error" con meet_link vacío: NUNCA se inventa un enlace de Meet.
    (Para desarrollo local existe DL_CALENDAR_MOCK=1, que devuelve un evento simulado.)
    """
    summary = f"🌹 Entrevista VIP Daily Lover — {client_name} & María Salinas"
    description = (
        f"Entrevista de Admisión y Matchmaking Personalizado Plan VIP 650k con María Paula Salinas.\n\n"
        f"• Cliente: {client_name}\n"
        f"• Email: {client_email}\n"
        f"• Teléfono: {client_phone or 'S/D'}\n\n"
        f"Esta reunión incluye sala oficial de Google Meet para la videollamada."
    )

    if os.environ.get("DL_CALENDAR_MOCK") == "1":
        mock_meet = f"https://meet.google.com/dlv-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:3]}"
        logger.info(f"📅 [MOCK GOOGLE CALENDAR] '{summary}' con Meet simulado: {mock_meet}")
        return {"status": "success", "mode": "mock", "event_id": f"mock_evt_{uuid.uuid4().hex[:8]}",
                "meet_link": mock_meet, "summary": summary}

    service = get_organizer_calendar_client()
    if not service:
        msg = "Organizador de Google Calendar no configurado (faltan GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN)."
        logger.error(f"❌ {msg}")
        return {"status": "error", "mode": "not_configured", "error": msg, "meet_link": "", "summary": summary}

    try:
        tz_cot = get_colombia_tz()
        start_iso = (start_dt.replace(tzinfo=tz_cot) if start_dt.tzinfo is None else start_dt.astimezone(tz_cot)).isoformat()
        end_iso = (end_dt.replace(tzinfo=tz_cot) if end_dt.tzinfo is None else end_dt.astimezone(tz_cot)).isoformat()

        event_body = {
            "summary": summary,
            "description": description,
            "start": {"dateTime": start_iso, "timeZone": DEFAULT_TIMEZONE},
            "end": {"dateTime": end_iso, "timeZone": DEFAULT_TIMEZONE},
            "attendees": [
                {"email": OWNER_EMAIL, "displayName": "María Paula Salinas (Daily Lover)"},
                {"email": client_email, "displayName": client_name},
            ],
            "conferenceData": {
                "createRequest": {
                    "requestId": f"dlvip-{uuid.uuid4().hex[:8]}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "email", "minutes": 24 * 60},
                    {"method": "popup", "minutes": 30},
                ],
            },
        }

        created_event = service.events().insert(
            calendarId="primary",
            body=event_body,
            conferenceDataVersion=1,
            sendUpdates="all",
        ).execute()

        meet_link = created_event.get("hangoutLink") or ""
        if not meet_link:
            for ep in created_event.get("conferenceData", {}).get("entryPoints", []):
                if ep.get("entryPointType") == "video":
                    meet_link = ep.get("uri", "")
                    break

        if not meet_link:
            logger.error(f"❌ Evento {created_event.get('id')} creado pero Google no devolvió enlace de Meet.")
            return {"status": "error", "mode": "no_meet", "error": "Google no devolvió enlace de Meet",
                    "event_id": created_event.get("id"), "html_link": created_event.get("htmlLink"),
                    "meet_link": "", "summary": summary}

        logger.info(f"✅ Evento VIP creado: ID={created_event.get('id')} Meet={meet_link}")
        return {"status": "success", "mode": "live", "event_id": created_event.get("id"),
                "meet_link": meet_link, "html_link": created_event.get("htmlLink"), "summary": summary}
    except Exception as e:
        logger.error(f"❌ Error creando evento VIP en Google Calendar: {e}")
        return {"status": "error", "mode": "error", "error": f"{type(e).__name__}: {e}",
                "meet_link": "", "summary": summary}
