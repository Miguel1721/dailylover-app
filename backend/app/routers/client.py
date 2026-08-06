from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import get_current_user
import json

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
    match_id: int
    user_id: int
    venue_rating: int = 5
    punctuality_rating: int = 5
    chemistry_rating: int = 5
    would_repeat: bool = True
    feedback_comments: str = None

@router.get("/feedback-form")
async def get_feedback_form_data(match_id: int, user_id: int, db: AsyncSession = Depends(get_db)):
    """Obtiene los detalles del encuentro para cargar el formulario de evaluación post-cita."""
    match_res = await db.execute(text("""
        SELECT id, person_a, person_b, match_date, venue, matchmaker, status, user_id_a, user_id_b,
               feedback_completed_a, feedback_completed_b
        FROM historical_matches WHERE id = :mid
    """), {"mid": match_id})
    m = match_res.fetchone()
    if not m:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    user_res = await db.execute(text("SELECT id, name FROM users WHERE id = :uid"), {"uid": user_id})
    u = user_res.fetchone()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    evaluator_name = u.name.strip()
    partner_name = m.person_b if (m.person_a and m.person_a.strip().lower() == evaluator_name.lower()) else m.person_a

    is_user_a = (m.user_id_a == user_id) or (m.person_a and m.person_a.strip().lower() == evaluator_name.lower())
    already_completed = m.feedback_completed_a if is_user_a else m.feedback_completed_b

    return {
        "match_id": m.id,
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
    match_res = await db.execute(text("""
        SELECT id, person_a, person_b, user_id_a, user_id_b FROM historical_matches WHERE id = :mid
    """), {"mid": req.match_id})
    m = match_res.fetchone()
    if not m:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    user_res = await db.execute(text("SELECT id, name FROM users WHERE id = :uid"), {"uid": req.user_id})
    u = user_res.fetchone()
    evaluator_name = u.name if u else "Cliente"

    # 1. Guardar evaluación en match_evaluations
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

    # 2. Actualizar estado de feedback en historical_matches
    is_user_a = (m.user_id_a == req.user_id) or (m.person_a and m.person_a.strip().lower() == evaluator_name.lower())
    if is_user_a:
        await db.execute(text("UPDATE historical_matches SET feedback_completed_a = TRUE WHERE id = :mid"), {"mid": req.match_id})
    else:
        await db.execute(text("UPDATE historical_matches SET feedback_completed_b = TRUE WHERE id = :mid"), {"mid": req.match_id})

    await db.commit()

    return {
        "ok": True,
        "message": "¡Muchas gracias! Tu evaluación ha sido registrada. Tu perfil ha sido desbloqueado para continuar en nuevos procesos de matchmaking."
    }


