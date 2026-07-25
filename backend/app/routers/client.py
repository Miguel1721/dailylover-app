from fastapi import APIRouter, Depends, HTTPException, status
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

@router.post("/match-feedback")
async def submit_match_feedback(req: MatchFeedbackRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    feedback_note = f"\n[FEEDBACK CLIENTE ({req.rating}/5 estrellas)]: Química: {req.chemistry} | ¿Repetiría?: {'Sí' if req.would_repeat else 'No'}. Comentario: {req.comments or 'Sin comentarios'}"
    
    await db.execute(text("""
        UPDATE historical_matches
        SET notes = COALESCE(notes, '') || :feedback_note
        WHERE id = :match_id
    """), {"match_id": req.match_id, "feedback_note": feedback_note})
    await db.commit()
    
    return {"message": "Retroalimentación enviada con éxito. ¡Gracias por compartir tu experiencia!"}
