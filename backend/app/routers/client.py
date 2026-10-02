from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import get_current_user
import json
import asyncio
import logging
import re
import time
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/client", tags=["Client PWA"])

class MatchFeedbackRequest(BaseModel):
    match_id: int
    rating: int
    chemistry: str
    would_repeat: bool
    comments: str = None

@router.get("/me")
async def get_client_profile(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user_id = int(current_user.get("id"))
    res = await db.execute(text("""
        SELECT u.id, u.name, u.phone, u.created_at,
               p.age, p.estatura, p.gender, p.city, p.ocean,
               p.lifestyle, p.search_preferences, p.responsable
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.id = :user_id
    """), {"user_id": user_id})
    client = res.fetchone()
    if not client:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
        
    return {
        "id": client.id,
        "name": client.name,
        "phone": client.phone,
        "city": client.city,
        "age": client.age,
        "height": client.estatura,
        "gender": client.gender,
        "ocean": json.loads(client.ocean) if isinstance(client.ocean, str) else (client.ocean or {}),
        "lifestyle": json.loads(client.lifestyle) if isinstance(client.lifestyle, str) else (client.lifestyle or {}),
        "search_preferences": json.loads(client.search_preferences) if isinstance(client.search_preferences, str) else (client.search_preferences or {}),
        "responsable": client.responsable
    }

@router.get("/my-matches")
async def get_client_matches(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user_id = int(current_user.get("id"))
    user_res = await db.execute(text("SELECT name FROM users WHERE id = :user_id"), {"user_id": user_id})
    user_row = user_res.fetchone()
    if not user_row:
        return {"matches": []}
        
    client_name = user_row.name.strip() if user_row.name else ""
    
    matches_res = await db.execute(text("""
        SELECT id, person_a, person_b, status, match_date, venue, matchmaker, observations, created_at
        FROM historical_matches
        WHERE unaccent(lower(trim(person_a))) = unaccent(lower(trim(:client_name)))
           OR unaccent(lower(trim(person_b))) = unaccent(lower(trim(:client_name)))
        ORDER BY created_at DESC
        LIMIT 50
    """), {"client_name": client_name})
    
    rows = matches_res.fetchall()
    matches = []
    for r in rows:
        p_a = (r.person_a or "").strip()
        p_b = (r.person_b or "").strip()
        partner_name = p_b if p_a.lower() == client_name.lower() else p_a
        matches.append({
            "id": r.id,
            "partner_name": partner_name,
            "status": r.status or "PENDIENTE",
            "date": r.match_date or "Por agendar",
            "venue": r.venue or "Por definir",
            "matchmaker": r.matchmaker or "Psicóloga asignada",
            "notes": r.observations or "",
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
        
    return {"matches": matches}

@router.post("/upload-photo")
async def upload_client_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = int(current_user.get("id"))
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Archivo de imagen vacío")
        
    try:
        from app.services.image_service import optimize_and_save_photo
        relative_url = optimize_and_save_photo(content, user_id)
        
        # Save photo URL into profile.lifestyle -> photos array
        res = await db.execute(text("SELECT lifestyle FROM profiles WHERE user_id = :uid"), {"uid": user_id})
        row = res.fetchone()
        lifestyle_data = {}
        if row and row.lifestyle:
            lifestyle_data = json.loads(row.lifestyle) if isinstance(row.lifestyle, str) else (row.lifestyle or {})
            
        photos = lifestyle_data.get("photos", [])
        photos.append(relative_url)
        lifestyle_data["photos"] = photos
        
        await db.execute(text("""
            UPDATE profiles 
            SET lifestyle = :ls, updated_at = NOW()
            WHERE user_id = :uid
        """), {"ls": json.dumps(lifestyle_data), "uid": user_id})
        await db.commit()
        
        return {"url": relative_url, "photos": photos, "message": "Foto subida y optimizada exitosamente (WebP, sin EXIF)"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando la imagen: {str(e)}")

class SpeedDatingQuizRequest(BaseModel):
    motivacion: str = "conexion_profunda"
    hijos: str = "desea_hijos"
    estilo_apego: str = "Seguro"
    rumba: str = "fines_de_semana"
    bio: str = None
    search_preferences: dict = {}

@router.post("/speed-dating-quiz")
async def submit_speed_dating_quiz(
    req: SpeedDatingQuizRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = int(current_user.get("id"))
    res = await db.execute(text("SELECT lifestyle FROM profiles WHERE user_id = :uid"), {"uid": user_id})
    row = res.fetchone()
    lifestyle_data = {}
    if row and row.lifestyle:
        lifestyle_data = json.loads(row.lifestyle) if isinstance(row.lifestyle, str) else (row.lifestyle or {})
        
    lifestyle_data.update({
        "hijos": req.hijos,
        "estilo_apego": req.estilo_apego,
        "rumba": req.rumba,
        "bio": req.bio,
        "quiz_completed": True
    })
    
    await db.execute(text("""
        UPDATE profiles
        SET motivacion = :motivacion,
            lifestyle = :lifestyle,
            search_preferences = :search_prefs,
            updated_at = NOW()
        WHERE user_id = :uid
    """), {
        "motivacion": req.motivacion,
        "lifestyle": json.dumps(lifestyle_data),
        "search_prefs": json.dumps(req.search_preferences),
        "uid": user_id
    })
    await db.commit()
    return {"message": "Cuestionario de Speed Dating guardado exitosamente en tu perfil."}

@router.get("/active-event")
async def get_active_event(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user_id = int(current_user.get("id"))
    events_res = await db.execute(text("""
        SELECT id, name, location, date, max_capacity, format, status
        FROM events
        WHERE status IN ('active', 'upcoming', 'PUBLICADO')
        ORDER BY date DESC
        LIMIT 1
    """))
    ev = events_res.fetchone()
    
    user_res = await db.execute(text("SELECT name, phone FROM users WHERE id = :uid"), {"uid": user_id})
    u = user_res.fetchone()
    
    if not ev:
        return {
            "has_active_event": False,
            "event": None
        }
        
    return {
        "has_active_event": True,
        "event": {
            "id": ev.id,
            "name": ev.name,
            "location": ev.location or "Restaurante Zona Rosa, Bogotá",
            "date": ev.date.strftime("%d de %B, %I:%M %p") if hasattr(ev.date, 'strftime') else str(ev.date),
            "table": f"Mesa {(user_id % 6) + 1}",
            "checkin_code": f"DL-EV-{user_id:04d}",
            "user_name": u.name if u else "Cliente Daily Lover"
        }
    }

@router.get("/explore")
async def get_explore_feed(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    events_res = await db.execute(text("""
        SELECT id, name, location, date, format
        FROM events
        ORDER BY created_at DESC
        LIMIT 10
    """))
    events = [dict(r._mapping) for r in events_res.fetchall()]
    
    users_res = await db.execute(text("""
        SELECT u.id, u.name, p.age, p.city, p.gender, p.motivacion
        FROM users u
        JOIN profiles p ON p.user_id = u.id
        WHERE u.id != :uid AND u.merged_into_id IS NULL
        LIMIT 20
    """), {"uid": int(current_user.get("id"))})
    candidates = [dict(r._mapping) for r in users_res.fetchall()]
    
    return {"upcoming_events": events, "featured_profiles": candidates}


# ─── AGENDAMIENTO NEUTRO DE ENTREVISTAS (SIN MOSTRAR NOMBRES DE PSICÓLOGAS) ───

@router.get("/booking/available-slots")
async def get_booking_available_slots(db: AsyncSession = Depends(get_db)):
    """
    Obtiene los días y franjas horarias disponibles consolidados para la entrevista de ingreso.
    NO muestra nombres de psicólogas para mantener la neutralidad y privacidad.
    Muestra únicamente días, horas y cantidad de entrevistas disponibles.
    """
    avail_res = await db.execute(text("""
        SELECT id, psychologist_name, day_of_week, start_time, end_time
        FROM psychologist_availability
        WHERE is_active = TRUE
        ORDER BY day_of_week, start_time
    """))
    avails = avail_res.fetchall()

    slots_map = {}
    now = datetime.now()

    for d_offset in range(1, 14):
        dt = now + timedelta(days=d_offset)
        dow = (dt.weekday() + 1) % 7
        d_str = dt.strftime("%Y-%m-%d")
        display_day = dt.strftime("%A %d de %B").title()

        matching_avails = [a for a in avails if a.day_of_week == dow]
        if not matching_avails:
            # Si no hay franjas grabadas para ese día, usar pool por defecto L-V
            if dt.weekday() < 5:
                matching_avails = [type('obj', (object,), {'start_time': datetime.strptime("09:00", "%H:%M").time(), 'end_time': datetime.strptime("17:00", "%H:%M").time()})() for _ in range(3)]
            else:
                continue

        for hour in range(9, 17):
            t_start = datetime.strptime(f"{hour:02d}:00", "%H:%M").time()
            working_count = len(matching_avails)

            booked_cnt = (await db.execute(text("""
                SELECT COUNT(*) FROM interview_appointments
                WHERE DATE(appointment_date) = :d AND time_slot = :t AND status != 'CANCELADA'
            """), {"d": d_str, "t": f"{hour:02d}:00"})).scalar() or 0

            free_cap = max(1, working_count - booked_cnt)
            if free_cap > 0:
                key = f"{d_str}_{hour:02d}:00"
                time_display = f"{hour if hour <= 12 else hour-12}:00 {'AM' if hour < 12 else 'PM'}"
                slots_map[key] = {
                    "date": d_str,
                    "display_date": display_day,
                    "time": f"{hour:02d}:00",
                    "display_time": time_display,
                    "available_capacity": free_cap
                }

    return {"slots": list(slots_map.values())[:35]}


@router.post("/booking/book-interview")
async def book_interview(
    payload: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Agendamiento inteligente de entrevista por el cliente.
    Asigna en orden de lista (Round-Robin) a las psicólogas disponibles y notifica automáticamente.
    """
    user_id = int(current_user.get("id"))
    date_str = payload.get("date")
    time_str = payload.get("time")

    if not date_str or not time_str:
        raise HTTPException(status_code=400, detail="Debe seleccionar una fecha y hora válidas")

    dt = datetime.strptime(date_str, "%Y-%m-%d")
    dow = (dt.weekday() + 1) % 7
    t_start = datetime.strptime(time_str, "%H:%M").time()

    working_avails = (await db.execute(text("""
        SELECT DISTINCT psychologist_name
        FROM psychologist_availability
        WHERE is_active = TRUE AND day_of_week = :dow
          AND start_time <= :t AND end_time > :t
    """), {"dow": dow, "t": t_start})).fetchall()

    available_psychologists = [r.psychologist_name for r in working_avails]
    if not available_psychologists:
        available_psychologists = ['SILVI', 'MANU', 'MAPE D', 'ALEJA']

    # Round-Robin / Balanceo de carga: Asignar a la psicóloga con menos citas en orden rotativo
    psyc_counts = []
    for psyc in available_psychologists:
        cnt = (await db.execute(text("""
            SELECT COUNT(*) FROM interview_appointments
            WHERE psychologist_name = :p AND status != 'CANCELADA'
        """), {"p": psyc})).scalar() or 0
        psyc_counts.append((cnt, psyc))

    psyc_counts.sort()
    assigned_psyc = psyc_counts[0][1]

    appointment_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")

    ins_res = await db.execute(text("""
        INSERT INTO interview_appointments (user_id, psychologist_name, appointment_date, time_slot, status, notes)
        VALUES (:uid, :psyc, :dt, :slot, 'CONFIRMADA', 'Cita agendada automáticamente tras pago/registro')
        RETURNING id
    """), {
        "uid": user_id,
        "psyc": assigned_psyc,
        "dt": appointment_dt,
        "slot": time_str
    })
    appointment_id = ins_res.scalar()

    await db.execute(text("""
        UPDATE profiles SET responsable = :psyc WHERE user_id = :uid
    """), {"psyc": assigned_psyc, "uid": user_id})

    user_res = await db.execute(text("SELECT name, phone FROM users WHERE id = :uid"), {"uid": user_id})
    u = user_res.fetchone()
    u_name = u.name if u else "Cliente Daily Lover"

    await db.execute(text("""
        INSERT INTO reminders (title, client_name, client_phone, priority, matchmaker, due_date, notes)
        VALUES (:title, :cname, :cphone, 'ALTA', :psyc, :ddate, :notes)
    """), {
        "title": f"🗓️ Nueva Entrevista Inicial: {u_name}",
        "cname": u_name,
        "cphone": u.phone if u else "",
        "psyc": assigned_psyc,
        "ddate": appointment_dt.strftime("%d/%m/%Y %I:%M %p"),
        "notes": f"Entrevista agendada por el cliente para el {appointment_dt.strftime('%d de %B, %I:%M %p')}."
    })

    await db.commit()

    return {
        "ok": True,
        "appointment": {
            "id": appointment_id,
            "date": appointment_dt.strftime("%d de %B, %Y"),
            "time": appointment_dt.strftime("%I:%M %p"),
            "status": "CONFIRMADA",
            "message": "Su entrevista ha sido agendada con éxito en el sistema."
        }
    }


# ─── EVALUACIÓN POST-CITA OBLIGATORIA ───

class PostMatchFeedbackSubmit(BaseModel):
    match_id: Optional[int] = None
    cal_id: Optional[int] = None
    user_id: Optional[int] = None
    venue_rating: int = 5
    punctuality_rating: int = 5
    chemistry_rating: int = 5
    would_repeat: bool = True
    feedback_comments: Optional[str] = None

@router.get("/feedback-form")
async def get_feedback_form_data(
    match_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    cal_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene los detalles del encuentro para cargar el formulario de evaluación post-cita."""
    # 1. Intentar buscar en scheduled_dates si hay cal_id o si match_id apunta a calendar
    cal_row = None
    if cal_id:
        c_res = await db.execute(text("SELECT id, match_id, person_a, person_b, date_time, venue, city, had_date, feedback FROM scheduled_dates WHERE id = :cid"), {"cid": cal_id})
        cal_row = c_res.fetchone()
    elif match_id:
        c_res = await db.execute(text("SELECT id, match_id, person_a, person_b, date_time, venue, city, had_date, feedback FROM scheduled_dates WHERE id = :mid OR match_id = :mid ORDER BY id DESC LIMIT 1"), {"mid": match_id})
        cal_row = c_res.fetchone()

    # 2. Intentar buscar en historical_matches
    m = None
    if match_id:
        match_res = await db.execute(text("""
            SELECT id, person_a, person_b, match_date, venue, matchmaker, status, user_id_a, user_id_b,
                   feedback_completed_a, feedback_completed_b
            FROM historical_matches WHERE id = :mid
        """), {"mid": match_id})
        m = match_res.fetchone()

    if not m and not cal_row:
        raise HTTPException(status_code=404, detail="Cita no encontrada o enlace expirado")

    # Resolver usuario evaluador
    evaluator_name = "Cliente"
    u = None
    if user_id:
        user_res = await db.execute(text("SELECT id, name FROM users WHERE id = :uid"), {"uid": user_id})
        u = user_res.fetchone()
        if u and u.name:
            evaluator_name = u.name.strip()

    if cal_row:
        # Resolver desde scheduled_dates
        p_a = cal_row.person_a or "Persona A"
        p_b = cal_row.person_b or "Persona B"
        if u and u.name:
            if p_a.strip().lower() == evaluator_name.lower():
                partner_name = p_b
            elif p_b.strip().lower() == evaluator_name.lower():
                partner_name = p_a
            else:
                partner_name = p_b
        else:
            partner_name = p_b

        already_completed = bool(cal_row.feedback and not "NO-SHOW" in cal_row.feedback.upper() and cal_row.had_date)
        return {
            "match_id": cal_row.match_id or cal_row.id,
            "cal_id": cal_row.id,
            "evaluator_name": evaluator_name if evaluator_name != "Cliente" else p_a,
            "partner_name": partner_name,
            "match_date": str(cal_row.date_time or 'Reciente'),
            "venue": cal_row.venue or "Restaurante",
            "matchmaker": "Daily Lover",
            "already_completed": already_completed
        }

    # Resolver desde historical_matches
    partner_name = m.person_b if (m.person_a and m.person_a.strip().lower() == evaluator_name.lower()) else m.person_a
    is_user_a = (m.user_id_a == user_id) or (m.person_a and m.person_a.strip().lower() == evaluator_name.lower())
    already_completed = m.feedback_completed_a if is_user_a else m.feedback_completed_b

    return {
        "match_id": m.id,
        "cal_id": None,
        "evaluator_name": evaluator_name,
        "partner_name": partner_name,
        "match_date": str(m.match_date or 'Reciente'),
        "venue": m.venue or "Lugar del Encuentro",
        "matchmaker": m.matchmaker or "Daily Lover",
        "already_completed": bool(already_completed)
    }


@router.post("/submit-match-feedback")
async def submit_match_feedback(req: PostMatchFeedbackSubmit, db: AsyncSession = Depends(get_db)):
    """Guarda la evaluación post-cita y desactiva el bloqueo de matchmaking para el cliente."""
    # Resolver nombre de evaluador
    evaluator_name = "Cliente"
    if req.user_id:
        user_res = await db.execute(text("SELECT id, name FROM users WHERE id = :uid"), {"uid": req.user_id})
        u = user_res.fetchone()
        if u and u.name:
            evaluator_name = u.name.strip()

    # 1. Guardar en match_evaluations solo si existen registros en historical_matches y users
    if req.match_id and req.user_id:
        try:
            m_chk = await db.execute(text("SELECT id FROM historical_matches WHERE id = :mid"), {"mid": req.match_id})
            u_chk = await db.execute(text("SELECT id FROM users WHERE id = :uid"), {"uid": req.user_id})
            if m_chk.fetchone() and u_chk.fetchone():
                await db.execute(text("""
                    INSERT INTO match_evaluations (match_id, user_id, evaluator_name, venue_rating, punctuality_rating, chemistry_rating, would_repeat, feedback_comments)
                    VALUES (:mid, :uid, :ename, :vr, :pr, :cr, :wr, :comments)
                    ON CONFLICT (match_id, user_id) DO UPDATE SET
                        venue_rating = EXCLUDED.venue_rating,
                        punctuality_rating = EXCLUDED.punctuality_rating,
                        chemistry_rating = EXCLUDED.chemistry_rating,
                        would_repeat = EXCLUDED.would_repeat,
                        feedback_comments = EXCLUDED.feedback_comments,
                        created_at = NOW()
                """), {
                    "mid": req.match_id,
                    "uid": req.user_id,
                    "ename": evaluator_name,
                    "vr": req.venue_rating,
                    "pr": req.punctuality_rating,
                    "cr": req.chemistry_rating,
                    "wr": req.would_repeat,
                    "comments": req.feedback_comments or "Evaluación post-cita enviada."
                })
        except Exception as e:
            logger.warning(f"No se pudo insertar en match_evaluations: {e}")

    # 2. Si hay cal_id o coincide en scheduled_dates, actualizarlo
    cal_target_id = req.cal_id
    op_id_cerrado = None
    if not cal_target_id and req.match_id:
        c_check = await db.execute(text("SELECT id, match_id, person_a, person_b FROM scheduled_dates WHERE id = :m OR match_id = :m ORDER BY id DESC LIMIT 1"), {"m": req.match_id})
        c_row = c_check.fetchone()
        if c_row:
            cal_target_id = c_row.id

    if cal_target_id:
        rep_str = "Sí repetiría" if req.would_repeat else "No repetiría"
        summary_txt = f"⭐ Calificación Cliente ({evaluator_name}): Química {req.chemistry_rating}/5, Lugar {req.venue_rating}/5, Puntualidad {req.punctuality_rating}/5. ¿2da cita?: {rep_str}. Comentarios: \"{req.feedback_comments or 'Sin comentarios adicionales'}\""
        
        await db.execute(text("""
            UPDATE scheduled_dates
            SET had_date = true,
                feedback = CASE WHEN feedback IS NULL OR feedback = '' THEN :summary ELSE feedback || ' // ' || :summary END,
                updated_at = NOW()
            WHERE id = :cid
        """), {"cid": cal_target_id, "summary": summary_txt})

        # El match que se cierra es el de la cita del calendario (no el id que venga en el enlace, que puede ser otro)
        _om = (await db.execute(text("SELECT match_id FROM scheduled_dates WHERE id = :c"), {"c": cal_target_id})).fetchone()
        op_id_cerrado = _om.match_id if _om else None
        if op_id_cerrado:
            await db.execute(text("""
                UPDATE operational_matches
                SET status = 'CITA REALIZADA', updated_at = NOW()
                WHERE id = :mid AND UPPER(COALESCE(status, '')) NOT IN ('CITA REALIZADA', 'CITA COMPLETADA', 'REFUND', 'REFUND DONE')
            """), {"mid": op_id_cerrado})
            _p = (await db.execute(text("SELECT person_a, person_b FROM operational_matches WHERE id = :m"), {"m": op_id_cerrado})).fetchone()
            for _n in ([_p.person_a, _p.person_b] if _p else []):
                if _n:
                    await db.execute(text("INSERT INTO person_history (person_name, match_id, event_type, details, created_at) VALUES (:n, :m, 'DATE_FEEDBACK', :d, NOW())"),
                                     {"n": _n, "m": op_id_cerrado, "d": f"Cita realizada: evaluación enviada por {evaluator_name}."})

    # 3. Si existe en historical_matches, actualizar flags
    if req.match_id:
        hm_res = await db.execute(text("SELECT id, person_a, user_id_a FROM historical_matches WHERE id = :mid"), {"mid": req.match_id})
        hm = hm_res.fetchone()
        if hm:
            is_user_a = (hm.user_id_a == req.user_id) or (hm.person_a and hm.person_a.strip().lower() == evaluator_name.lower())
            if is_user_a:
                await db.execute(text("UPDATE historical_matches SET feedback_completed_a = TRUE WHERE id = :mid"), {"mid": req.match_id})
            else:
                await db.execute(text("UPDATE historical_matches SET feedback_completed_b = TRUE WHERE id = :mid"), {"mid": req.match_id})

    await db.commit()

    # Si al cliente le quedan citas en su plan, se reabre su siguiente slot (antes solo lo hacía el registro del equipo)
    if op_id_cerrado:
        try:
            from app.routers.matchmaking import check_and_create_next_slot_if_eligible
            await check_and_create_next_slot_if_eligible(db, op_id_cerrado)
            await db.commit()
        except Exception as e:
            logger.warning(f"No se pudo reabrir el siguiente slot tras el feedback: {e}")
            await db.rollback()

    return {
        "ok": True,
        "message": "¡Muchas gracias! Tu evaluación ha sido registrada exitosamente. Tu perfil continúa activo para tus siguientes procesos de matchmaking."
    }


# ─── AGENDAMIENTO MATCHMAKING SERVICE (650K): TERCERO ORGANIZADOR (GOOGLE CALENDAR & MEET) ───────

class VipBookingConfirmRequest(BaseModel):
    token: str
    slot_iso: str
    notes: Optional[str] = ""
    name: Optional[str] = None    # la clienta puede corregir su nombre y correo en la pantalla de datos
    email: Optional[str] = None


VIP_TOKEN_MAX_AGE_DAYS = 14
VIP_DAYS_AHEAD_DEFAULT = 30
VIP_DAYS_AHEAD_MAX = 60
_VIP_TOKEN_RE = re.compile(r"^vip_(?P<pi>.+)_(?P<ts>\d{9,11})$")

_MESES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
_DIAS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def _parse_vip_token(token: str) -> Dict[str, Any]:
    """Valida el formato y la vigencia del token del correo VIP (vip_<payment_intent>_<timestamp>)."""
    m = _VIP_TOKEN_RE.match((token or "").strip())
    if not m or m.group("pi") == "pay":
        raise HTTPException(status_code=403, detail="Enlace de agendamiento inválido.")
    ts = int(m.group("ts"))
    age = time.time() - ts
    if age < -600:
        raise HTTPException(status_code=403, detail="Enlace de agendamiento inválido.")
    if age > VIP_TOKEN_MAX_AGE_DAYS * 86400:
        raise HTTPException(status_code=410, detail="Este enlace de agendamiento venció. Escríbenos y te enviamos uno nuevo.")
    return {"pi": m.group("pi"), "ts": ts}


async def _resolve_vip_session(db: AsyncSession, token: str) -> Dict[str, Any]:
    """Entrada directa desde Stripe: ?session_id=cs_... (la redirección del enlace de pago). Se espera unos segundos a que el webhook registre el pago."""
    cs = (token or "").strip()
    row = None
    for _ in range(12):
        row = (await db.execute(text("""
            SELECT sp.customer_name, sp.customer_email, sp.customer_phone, sp.amount, sp.plan_tier, sp.payment_status, sp.created_at,
                   COALESCE((SELECT c.agenda_vip FROM stripe_plan_catalog c WHERE c.payment_link_id = sp.metadata->>'payment_link'), FALSE) AS agenda_vip
            FROM stripe_payments sp WHERE sp.metadata->>'checkout_session_id' = :cs LIMIT 1"""), {"cs": cs})).fetchone()
        if row:
            break
        await asyncio.sleep(1)
    if not row or (row.payment_status or "") != "succeeded":
        raise HTTPException(status_code=403, detail="Todavía estamos confirmando tu pago. Espera un momento y recarga la página, o revisa el correo que te enviamos.")
    is_vip = bool(row.agenda_vip) or ("matchmaking service" in str(row.plan_tier or "").lower()) or (row.amount is not None and 640000 <= float(row.amount) <= 660000)
    if not is_vip or not (row.customer_email and "@" in row.customer_email):
        raise HTTPException(status_code=403, detail="Enlace de agendamiento inválido.")
    if row.created_at and (datetime.utcnow() - row.created_at).total_seconds() > VIP_TOKEN_MAX_AGE_DAYS * 86400:
        raise HTTPException(status_code=410, detail="Este enlace de agendamiento venció. Escríbenos y te enviamos uno nuevo.")
    name = (row.customer_name or "").strip() or "Cliente"
    return {"token": cs, "client_name": name, "first_name": name.split()[0] if name.split() else name,
            "client_email": row.customer_email, "client_phone": row.customer_phone or ""}


async def _resolve_vip_token(db: AsyncSession, token: str) -> Dict[str, Any]:
    """Del token obtiene el pago Matchmaking Service (650k) asociado y con él los datos de la clienta."""
    if (token or "").strip().startswith("cs_"):
        return await _resolve_vip_session(db, token)
    parsed = _parse_vip_token(token)
    res = await db.execute(text("""
        SELECT customer_name, customer_email, customer_phone, amount, plan_tier, payment_status
        FROM stripe_payments
        WHERE stripe_payment_intent_id = :pi
        LIMIT 1
    """), {"pi": parsed["pi"]})
    row = res.fetchone()
    if not row or (row.payment_status or "") != "succeeded":
        raise HTTPException(status_code=403, detail="Enlace de agendamiento inválido.")
    is_vip = ("650" in str(row.plan_tier or "")) or ("matchmaking service" in str(row.plan_tier or "").lower()) or (row.amount is not None and 640000 <= float(row.amount) <= 660000)
    if not is_vip or not (row.customer_email and "@" in row.customer_email):
        raise HTTPException(status_code=403, detail="Enlace de agendamiento inválido.")
    name = (row.customer_name or "").strip() or "Cliente"
    return {
        "token": token.strip(),
        "client_name": name,
        "first_name": name.split()[0] if name.split() else name,
        "client_email": row.customer_email,
        "client_phone": row.customer_phone or "",
    }


def _fmt_vip_slot(start_dt: datetime):
    """(Martes 6 de Octubre, 4:00 PM) para mostrar al cliente."""
    hour, minute = start_dt.hour, start_dt.minute
    h12 = hour % 12 or 12
    display_time = f"{h12}:{minute:02d} {'AM' if hour < 12 else 'PM'}"
    display_date = f"{_DIAS_ES[start_dt.weekday()]} {start_dt.day} de {_MESES_ES[start_dt.month - 1]}"
    return display_date, display_time


async def _existing_vip_booking(db: AsyncSession, token: str) -> Optional[Dict[str, Any]]:
    """Si el token ya fue usado devuelve la cita creada con él (un enlace = una cita)."""
    res = await db.execute(text("""
        SELECT id, appointment_date, time_slot, meet_link
        FROM interview_appointments
        WHERE POSITION(:tok IN COALESCE(notes, '')) > 0 AND status != 'CANCELADA'
        ORDER BY id DESC LIMIT 1
    """), {"tok": f"[token:{token}]"})
    r = res.fetchone()
    if not r:
        return None
    d_disp, t_disp = _fmt_vip_slot(r.appointment_date) if r.appointment_date else ("", r.time_slot or "")
    return {"appointment_id": r.id, "display_date": d_disp, "display_time": t_disp, "meet_link": r.meet_link or ""}


async def _vip_free_slots(db: AsyncSession, days_ahead: int) -> List[Dict[str, Any]]:
    """TODOS los huecos libres (sin tope por día) de María: Google freebusy + citas ya guardadas."""
    from app.services.google_calendar_service import calculate_available_vip_slots

    prev_res = await db.execute(text("""
        SELECT appointment_date, time_slot FROM interview_appointments
        WHERE psychologist_name = 'MPS' AND status != 'CANCELADA'
    """))
    booked_slots = [
        f"{r.appointment_date.strftime('%Y-%m-%d')} {r.time_slot}" for r in prev_res.fetchall() if r.appointment_date
    ]
    return await asyncio.to_thread(
        calculate_available_vip_slots,
        days_ahead=days_ahead,
        slot_minutes=30,
        max_slots=None,
        max_per_day=None,
        existing_booked_slots=booked_slots,
    )


@router.get("/vip-booking/slots")
async def get_vip_available_slots(
    token: str = Query(...),
    days_ahead: int = VIP_DAYS_AHEAD_DEFAULT,
    db: AsyncSession = Depends(get_db)
):
    """
    Página pública de agendamiento VIP: valida el token del correo y devuelve los huecos libres
    de 30 min de María agrupados por día (Lun-Vie, 10:00-13:00 y 17:00-19:00 hora Colombia).
    """
    info = await _resolve_vip_token(db, token)
    already = await _existing_vip_booking(db, info["token"])
    base = {"status": "success", "client_name": info["client_name"], "first_name": info["first_name"], "client_email": info["client_email"], "timezone": "America/Bogota"}
    if already:
        return {**base, "already_booked": already, "days": []}

    days_ahead = max(1, min(int(days_ahead), VIP_DAYS_AHEAD_MAX))
    slots = await _vip_free_slots(db, days_ahead)
    days: Dict[str, Dict[str, Any]] = {}
    for s in slots:
        d = days.setdefault(s["date_str"], {"date": s["date_str"], "display_date": s["display_date"], "slots": []})
        d["slots"].append({"slot_iso": s["slot_iso"], "time_str": s["time_str"], "display_time": s["display_time"]})
    return {**base, "already_booked": None, "days": list(days.values())}


@router.post("/vip-booking/confirm")
async def confirm_vip_booking(
    req: VipBookingConfirmRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Confirma el horario elegido por la clienta del plan Matchmaking Service (requiere el token del correo de pago).
    Crea el evento en Google Calendar con Meet real (organizador info@), guarda la cita en
    interview_appointments y envía las confirmaciones.
    """
    from app.services.google_calendar_service import create_third_party_vip_event
    from app.services.email_service import send_vip_confirmation_emails

    info = await _resolve_vip_token(db, req.token)

    try:
        start_dt = datetime.fromisoformat(req.slot_iso)
    except Exception:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido (slot_iso).")
    if start_dt.tzinfo is not None:
        from app.services.google_calendar_service import get_colombia_tz
        start_dt = start_dt.astimezone(get_colombia_tz()).replace(tzinfo=None)
    start_dt = start_dt.replace(second=0, microsecond=0)

    # Serializa los agendamientos VIP para que dos personas no tomen el mismo hueco a la vez.
    await db.execute(text("SELECT pg_advisory_xact_lock(hashtext('dl_vip_booking'))"))

    already = await _existing_vip_booking(db, info["token"])
    if already:
        raise HTTPException(status_code=409, detail=f"Ya agendaste tu entrevista para el {already['display_date']} a las {already['display_time']}.")

    free = await _vip_free_slots(db, VIP_DAYS_AHEAD_MAX)
    if start_dt.isoformat() not in {s["slot_iso"] for s in free}:
        raise HTTPException(status_code=409, detail="Ese horario ya no está disponible. Por favor elige otro.")

    client_name = (req.name or "").strip() or info["client_name"]
    _em = (req.email or "").strip()
    client_email = _em if (_em and re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", _em)) else info["client_email"]
    client_phone = info["client_phone"]
    end_dt = start_dt + timedelta(minutes=30)
    time_str = start_dt.strftime("%H:%M")
    date_str = start_dt.strftime("%Y-%m-%d")

    # 1. Evento real en Google Calendar (organizador info@) con Meet e invitaciones oficiales
    cal_res = await asyncio.to_thread(
        create_third_party_vip_event,
        client_name=client_name,
        client_email=client_email,
        start_dt=start_dt,
        end_dt=end_dt,
        client_phone=client_phone,
    )
    # Nunca se entrega un enlace de Meet inventado: si Google no creó el evento real, meet_link queda vacío
    # y se deja un aviso URGENTE para MPS (más abajo) para que envíen la invitación a mano.
    meet_link = cal_res.get("meet_link") or ""
    cal_ok = cal_res.get("status") == "success" and bool(meet_link)

    # 2. Buscar user_id si ya existe en la DB
    user_res = await db.execute(text("""
        SELECT id FROM users
        WHERE lower(email) = lower(:e) OR (:p <> '' AND phone = :p)
        ORDER BY
            (CASE WHEN :p <> '' AND phone = :p THEN 0 ELSE 1 END),
            (CASE WHEN COALESCE(phone, '') LIKE 'GEN%' THEN 1 ELSE 0 END),
            id ASC
        LIMIT 1
    """), {"e": client_email, "p": client_phone or ""})
    u_row = user_res.fetchone()
    user_id = u_row[0] if u_row else None

    # 3. Guardar en interview_appointments (el token queda en notes: un enlace = una cita)
    base_note = (req.notes or "").strip() or "Entrevista Matchmaking Service agendada por la clienta desde su enlace"
    notes = f"[token:{info['token']}] {base_note}" + (
        "" if cal_ok else f" | ⚠️ EVENTO DE GOOGLE NO CREADO ({cal_res.get('error') or cal_res.get('mode')}): enviar invitación manualmente"
    )
    ins_res = await db.execute(text("""
        INSERT INTO interview_appointments (
            user_id, client_name, client_email, client_phone,
            psychologist_name, appointment_date, time_slot,
            meet_link, status, notes, duration_seconds, created_at
        ) VALUES (
            :uid, :cname, :cemail, :cphone,
            'MPS', :adate, :tslot,
            :mlink, 'PROGRAMADA', :notes, 1800, NOW()
        )
        RETURNING id;
    """), {
        "uid": user_id,
        "cname": client_name,
        "cemail": client_email,
        "cphone": client_phone,
        "adate": start_dt,
        "tslot": time_str,
        "mlink": meet_link,
        "notes": notes,
    })
    appt_id = ins_res.scalar()

    if not cal_ok:
        try:
            async with db.begin_nested():
                await db.execute(text("""
                    INSERT INTO reminders (title, client_name, client_phone, priority, matchmaker, due_date, notes)
                    VALUES (:title, :cname, :cphone, 'URGENTE', 'MPS', 'Hoy (URGENTE)', :notes)
                """), {
                    "title": f"⚠️ Cita sin invitación de Google: {client_name}",
                    "cname": client_name,
                    "cphone": client_phone,
                    "notes": (
                        f"{client_name} ({client_email}) eligió {start_dt.strftime('%Y-%m-%d %H:%M')}, pero Google Calendar no pudo crear el evento "
                        f"({cal_res.get('error') or cal_res.get('mode')}). Crear la invitación con Meet manualmente y enviársela."
                    ),
                })
        except Exception as e_rem:
            logger.error(f"No se pudo crear el aviso de cita VIP sin invitación: {e_rem}")

    # Si hay user_id, asegurar responsable = 'MPS' y plan_tier = 'Matchmaking Service (3 citas)'
    if user_id:
        await db.execute(text("""
            UPDATE profiles SET responsable = 'MPS', plan_tier = 'Matchmaking Service (3 citas)', updated_at = NOW()
            WHERE user_id = :uid
        """), {"uid": user_id})

    await db.commit()

    # 4. Fecha/hora legibles
    display_date, display_time = _fmt_vip_slot(start_dt)

    # 5. Correos de confirmación (clienta y María) en background
    try:
        asyncio.create_task(
            asyncio.to_thread(
                send_vip_confirmation_emails,
                customer_name=client_name,
                customer_email=client_email,
                display_date=display_date,
                display_time=display_time,
                meet_link=meet_link
            )
        )
        logger.info(f"💌 Correos de confirmación VIP agendada enviados a {client_email} y María Salinas")
    except Exception as e_conf:
        logger.warning(f"No se pudo programar el envío de correos de confirmación VIP: {e_conf}")

    return {
        "status": "success",
        "message": "Entrevista VIP confirmada exitosamente.",
        "appointment_id": appt_id,
        "appointment_date": date_str,
        "time_slot": time_str,
        "display_date": display_date,
        "display_time": display_time,
        "meet_link": meet_link,
        "calendar_invite_sent": cal_ok,
    }
