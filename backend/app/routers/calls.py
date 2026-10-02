"""Videollamadas propias (LiveKit) con consentimiento y grabación de SOLO AUDIO por pista (una por persona).

Flujo: la psicóloga crea la llamada -> la cliente abre el enlace público -> acepta o no el consentimiento -> entra a la sala.
Cada persona graba su propio micrófono en su navegador y sube fragmentos; el servidor los guarda en una carpeta privada.
Sin consentimiento aceptado NO se acepta ningún audio.
"""
import hashlib
import os
import secrets
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from jose import jwt
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.scheduling import require_staff

router = APIRouter(prefix="/api/v1/calls", tags=["Videollamadas"])

AUDIO_DIR = Path(os.environ.get("CALL_AUDIO_DIR", "/app/private_call_audio"))
MAX_CHUNK_BYTES = 8 * 1024 * 1024
APP_BASE_URL = os.environ.get("APP_BASE_URL", "https://daily-lover.agentesia.cloud").rstrip("/")
CONSENT_VERSION = "2026-10-02-borrador-nvidia"
# BORRADOR: debe revisarlo un abogado antes de usarse con clientes reales (Ley 1581 de 2012, habeas data).
CONSENT_TEXT = (
    "Autorizo a Daily Lover a grabar únicamente el AUDIO de esta videollamada y a transcribirlo, con el fin de "
    "completar mi perfil y encontrar personas más compatibles conmigo. Entiendo que: (1) la grabación es voluntaria y "
    "puedo negarme: si no acepto, la entrevista se realiza igual y no se graba nada; (2) la psicóloga revisa lo que se "
    "extraiga antes de que entre a mi perfil; (3) puedo pedir en cualquier momento consultar, corregir o eliminar mi "
    "audio, mi transcripción y mis datos; (4) solo personal autorizado de Daily Lover accede a ellos; (5) para transcribir y "
    "analizar la conversación Daily Lover usa proveedores tecnológicos externos (NVIDIA, en Estados Unidos), que reciben el audio y "
    "el texto únicamente para prestarnos ese servicio, por lo que mis datos pueden ser tratados fuera de Colombia."
)
_ready = False


async def ensure_call_tables(db: AsyncSession) -> None:
    global _ready
    if _ready:
        return
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS call_sessions (
            id SERIAL PRIMARY KEY, public_token TEXT UNIQUE NOT NULL, room_name TEXT UNIQUE NOT NULL,
            appointment_id INT, psychologist_name TEXT, client_name TEXT, is_test BOOLEAN DEFAULT FALSE,
            status TEXT NOT NULL DEFAULT 'PROGRAMADA', consent TEXT NOT NULL DEFAULT 'PENDIENTE',
            consent_at TIMESTAMPTZ, consent_version TEXT, consent_ip_hash TEXT, recording_enabled BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(), created_by TEXT, started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ
        )"""))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS call_audio_chunks (
            id SERIAL PRIMARY KEY, session_id INT NOT NULL, role TEXT NOT NULL, seq INT NOT NULL, size INT NOT NULL,
            path TEXT NOT NULL, recorded_start_ms BIGINT, created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (session_id, role, seq)
        )"""))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS call_access_log (
            id SERIAL PRIMARY KEY, session_id INT, actor TEXT, action TEXT, at TIMESTAMPTZ DEFAULT NOW()
        )"""))
    await db.commit()
    _ready = True


def _who(user: dict) -> str:
    return str(user.get("email") or user.get("employee_name") or "staff")


def _livekit_token(identity: str, name: str, room: str, can_publish: bool = True) -> Dict[str, str]:
    url, key, secret = os.environ.get("LIVEKIT_URL", "").strip(), os.environ.get("LIVEKIT_API_KEY", "").strip(), os.environ.get("LIVEKIT_API_SECRET", "").strip()
    if not (url and key and secret):
        raise HTTPException(status_code=503, detail="El servicio de video no está configurado.")
    now = int(time.time())
    claims = {"iss": key, "sub": identity, "name": name, "nbf": now, "exp": now + 3 * 3600,
              "video": {"room": room, "roomJoin": True, "canPublish": can_publish, "canSubscribe": True, "canPublishData": True}}
    return {"livekit_url": url, "token": jwt.encode(claims, secret, algorithm="HS256")}


async def _by_token(db: AsyncSession, token: str):
    row = (await db.execute(text("SELECT * FROM call_sessions WHERE public_token = :t"), {"t": token})).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Enlace inválido o vencido.")
    return row


async def _by_id(db: AsyncSession, sid: int):
    row = (await db.execute(text("SELECT * FROM call_sessions WHERE id = :i"), {"i": sid})).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Llamada no encontrada.")
    return row


def _first_name(n: Optional[str]) -> str:
    return (n or "").strip().split(" ")[0] if n else ""


async def _store_chunk(db: AsyncSession, session, role: str, seq: int, start_ms: Optional[int], request: Request) -> Dict[str, Any]:
    if not session.recording_enabled or session.consent != "ACEPTADO":
        raise HTTPException(status_code=403, detail="Sin consentimiento no se guarda audio.")
    if seq < 0 or seq > 100000:
        raise HTTPException(status_code=422, detail="Número de fragmento inválido.")
    declared = int(request.headers.get("content-length") or 0)
    if declared > MAX_CHUNK_BYTES:
        raise HTTPException(status_code=413, detail="Fragmento demasiado grande.")
    data = await request.body()
    if not data or len(data) > MAX_CHUNK_BYTES:
        raise HTTPException(status_code=422, detail="Fragmento vacío o demasiado grande.")
    d = AUDIO_DIR / str(session.id) / role
    d.mkdir(parents=True, exist_ok=True)
    path = d / f"{seq:06d}.part"
    path.write_bytes(data)
    os.chmod(path, 0o600)
    await db.execute(text("""
        INSERT INTO call_audio_chunks (session_id, role, seq, size, path, recorded_start_ms) VALUES (:s, :r, :q, :z, :p, :m)
        ON CONFLICT (session_id, role, seq) DO UPDATE SET size = EXCLUDED.size, path = EXCLUDED.path, recorded_start_ms = COALESCE(EXCLUDED.recorded_start_ms, call_audio_chunks.recorded_start_ms)
    """), {"s": session.id, "r": role, "q": seq, "z": len(data), "p": str(path), "m": start_ms})
    await db.commit()
    return {"status": "ok", "seq": seq, "size": len(data)}


def assemble_audio(session_id: int, role: str) -> Optional[Path]:
    """Une los fragmentos de una pista, en orden, en un solo archivo .webm."""
    d = AUDIO_DIR / str(session_id) / role
    parts = sorted(d.glob("*.part")) if d.exists() else []
    if not parts:
        return None
    out = AUDIO_DIR / str(session_id) / f"{role}.webm"
    with open(out, "wb") as fh:
        for p in parts:
            fh.write(p.read_bytes())
    os.chmod(out, 0o600)
    return out


# ------------------------------------------------------------------ equipo (con sesión)

async def ensure_call_for_appointment(db: AsyncSession, ref) -> Dict[str, Any]:
    """UNA sola videollamada por cita de entrevista: la crea si no existe y deja el mismo token en la cita.
    `ref` = id de la cita o su videocall_token. No hace commit (lo hace quien llama)."""
    await ensure_call_tables(db)
    q = "SELECT id, user_id, psychologist_name, client_name, videocall_token FROM interview_appointments WHERE "
    if isinstance(ref, int) or str(ref).isdigit():
        a = (await db.execute(text(q + "id = :r"), {"r": int(ref)})).fetchone()
    else:
        a = (await db.execute(text(q + "videocall_token = :r"), {"r": str(ref)})).fetchone()
    if not a:
        raise HTTPException(status_code=404, detail="Cita no encontrada.")
    ya = (await db.execute(text("SELECT id, public_token FROM call_sessions WHERE appointment_id = :a ORDER BY id LIMIT 1"), {"a": a.id})).fetchone()
    if ya:
        return {"id": ya.id, "public_token": ya.public_token, "public_url": f"{APP_BASE_URL}/admin/llamada/{ya.public_token}", "appointment_id": a.id, "creada": False}
    token = a.videocall_token or secrets.token_urlsafe(24)
    room = "dl-" + secrets.token_hex(8)
    sid = (await db.execute(text("""
        INSERT INTO call_sessions (public_token, room_name, appointment_id, psychologist_name, client_name, user_id, is_test, created_by)
        VALUES (:t, :r, :a, :p, :c, :u, false, 'cita') RETURNING id
    """), {"t": token, "r": room, "a": a.id, "p": a.psychologist_name, "c": a.client_name or "Cliente", "u": a.user_id})).scalar()
    if not a.videocall_token:
        await db.execute(text("UPDATE interview_appointments SET videocall_token = :t WHERE id = :a"), {"t": token, "a": a.id})
    return {"id": sid, "public_token": token, "public_url": f"{APP_BASE_URL}/admin/llamada/{token}", "appointment_id": a.id, "creada": True}


class CreateCall(BaseModel):
    client_name: str
    psychologist_name: Optional[str] = None
    appointment_id: Optional[int] = None
    is_test: Optional[bool] = False


def _public(row) -> Dict[str, Any]:
    return {"id": row.id, "appointment_id": row.appointment_id, "user_id": row.user_id, "client_name": row.client_name, "psychologist_name": row.psychologist_name, "status": row.status,
            "consent": row.consent, "recording_enabled": bool(row.recording_enabled), "is_test": bool(row.is_test),
            "public_url": f"{APP_BASE_URL}/admin/llamada/{row.public_token}",
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "started_at": row.started_at.isoformat() if row.started_at else None,
            "ended_at": row.ended_at.isoformat() if row.ended_at else None}


@router.post("/for-appointment/{ref}")
async def call_for_appointment(ref: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """El equipo abre la videollamada de una cita (la crea si falta). `ref` = id de la cita o su token."""
    r = await ensure_call_for_appointment(db, ref)
    await db.commit()
    return _public(await _by_id(db, r["id"]))


@router.post("")
async def create_call(payload: CreateCall, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_call_tables(db)
    name = payload.client_name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Falta el nombre de la cliente.")
    psy = (payload.psychologist_name or "").strip()
    if not psy:
        try:
            from app.routers.shift_changes_api import my_staff_name
            psy = await my_staff_name(db, user) or ""
        except Exception:
            psy = ""
    psy = psy or str(user.get("employee_name") or "Psicóloga")
    token = secrets.token_urlsafe(24)
    room = "dl-" + secrets.token_hex(8)
    sid = (await db.execute(text("""
        INSERT INTO call_sessions (public_token, room_name, appointment_id, psychologist_name, client_name, is_test, created_by)
        VALUES (:t, :r, :a, :p, :c, :x, :u) RETURNING id
    """), {"t": token, "r": room, "a": payload.appointment_id, "p": psy, "c": name, "x": bool(payload.is_test), "u": _who(user)})).scalar()
    await db.commit()
    return _public(await _by_id(db, sid))


@router.get("")
async def list_calls(db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_call_tables(db)
    rows = (await db.execute(text("SELECT * FROM call_sessions ORDER BY id DESC LIMIT 50"))).fetchall()
    out = []
    for r in rows:
        d = _public(r)
        ch = (await db.execute(text("SELECT role, count(*), coalesce(sum(size),0) FROM call_audio_chunks WHERE session_id=:i GROUP BY role"), {"i": r.id})).fetchall()
        d["audio"] = {c[0]: {"fragmentos": int(c[1]), "bytes": int(c[2])} for c in ch}
        if r.appointment_id:
            ap = (await db.execute(text("SELECT appointment_date, status FROM interview_appointments WHERE id = :a"), {"a": r.appointment_id})).fetchone()
            if ap:
                d["cita"] = ap.appointment_date.strftime("%Y-%m-%d %H:%M")
                d["cita_estado"] = ap.status
        out.append(d)
    return {"calls": out}


@router.get("/{sid}")
async def get_call(sid: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_call_tables(db)
    return _public(await _by_id(db, sid))


@router.post("/{sid}/join")
async def staff_join(sid: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_call_tables(db)
    s = await _by_id(db, sid)
    if s.status == "FINALIZADA":
        raise HTTPException(status_code=409, detail="Esta llamada ya finalizó.")
    await db.execute(text("UPDATE call_sessions SET status = 'EN_CURSO', started_at = COALESCE(started_at, NOW()) WHERE id = :i"), {"i": sid})
    await db.commit()
    lk = _livekit_token(f"psicologa-{sid}", s.psychologist_name or "Psicóloga", s.room_name)
    return {**lk, "role": "PSICOLOGA", "recording_enabled": bool(s.recording_enabled), "consent": s.consent}


@router.post("/{sid}/end")
async def end_call(sid: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_call_tables(db)
    await _by_id(db, sid)
    await db.execute(text("UPDATE call_sessions SET status = 'FINALIZADA', ended_at = COALESCE(ended_at, NOW()) WHERE id = :i"), {"i": sid})
    # la entrevista de la cita queda realizada (antes nada la cerraba)
    await db.execute(text("""
        UPDATE interview_appointments a SET status = 'COMPLETADA',
               duration_seconds = COALESCE(NULLIF(a.duration_seconds, 0), GREATEST(0, EXTRACT(EPOCH FROM (c.ended_at - COALESCE(c.started_at, c.ended_at)))::int))
        FROM call_sessions c
        WHERE c.id = :i AND c.appointment_id = a.id AND a.status IN ('CONFIRMADA', 'PROGRAMADA')
    """), {"i": sid})
    await db.commit()
    return _public(await _by_id(db, sid))


@router.post("/{sid}/audio")
async def staff_audio(sid: int, request: Request, seq: int = Query(...), start_ms: Optional[int] = Query(None),
                      db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_call_tables(db)
    return await _store_chunk(db, await _by_id(db, sid), "PSICOLOGA", seq, start_ms, request)


@router.post("/{sid}/assemble")
async def assemble(sid: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_call_tables(db)
    await _by_id(db, sid)
    res = {}
    for role in ("PSICOLOGA", "CLIENTE"):
        p = assemble_audio(sid, role)
        res[role] = {"archivo": p.name, "bytes": p.stat().st_size} if p else None
    await db.execute(text("INSERT INTO call_access_log (session_id, actor, action) VALUES (:i, :a, 'ensamblar_audio')"), {"i": sid, "a": _who(user)})
    await db.commit()
    return res


@router.get("/{sid}/audio/{role}")
async def download_audio(sid: int, role: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """Escuchar la pista ya ensamblada (queda registrado quién la abrió)."""
    await ensure_call_tables(db)
    if role not in ("PSICOLOGA", "CLIENTE"):
        raise HTTPException(status_code=404, detail="Pista desconocida.")
    await _by_id(db, sid)
    p = AUDIO_DIR / str(sid) / f"{role}.webm"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Esa pista no está ensamblada o no hay audio.")
    await db.execute(text("INSERT INTO call_access_log (session_id, actor, action) VALUES (:i, :a, :x)"), {"i": sid, "a": _who(user), "x": f"escuchar_{role}"})
    await db.commit()
    return FileResponse(str(p), media_type="audio/webm")


# ------------------------------------------------------------------ cliente (enlace público, sin cuenta)

class ConsentBody(BaseModel):
    accept: bool


@router.get("/public/{token}")
async def public_info(token: str, db: AsyncSession = Depends(get_db)):
    await ensure_call_tables(db)
    s = await _by_token(db, token)
    return {"client_first_name": _first_name(s.client_name), "psychologist_name": s.psychologist_name, "status": s.status,
            "consent": s.consent, "consent_text": CONSENT_TEXT, "consent_version": CONSENT_VERSION}


@router.post("/public/{token}/consent")
async def public_consent(token: str, body: ConsentBody, request: Request, db: AsyncSession = Depends(get_db)):
    await ensure_call_tables(db)
    s = await _by_token(db, token)
    if s.status == "FINALIZADA":
        raise HTTPException(status_code=409, detail="Esta llamada ya finalizó.")
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()
    ip_hash = hashlib.sha256((ip + "|dl-consent").encode()).hexdigest()[:32]
    await db.execute(text("""
        UPDATE call_sessions SET consent = :c, consent_at = NOW(), consent_version = :v, consent_ip_hash = :h, recording_enabled = :r WHERE id = :i
    """), {"c": "ACEPTADO" if body.accept else "RECHAZADO", "v": CONSENT_VERSION, "h": ip_hash, "r": bool(body.accept), "i": s.id})
    await db.commit()
    return {"consent": "ACEPTADO" if body.accept else "RECHAZADO", "recording_enabled": bool(body.accept)}


@router.post("/public/{token}/join")
async def public_join(token: str, db: AsyncSession = Depends(get_db)):
    await ensure_call_tables(db)
    s = await _by_token(db, token)
    if s.status == "FINALIZADA":
        raise HTTPException(status_code=409, detail="Esta llamada ya finalizó.")
    if s.consent == "PENDIENTE":
        raise HTTPException(status_code=403, detail="Primero debes responder el consentimiento.")
    await db.execute(text("UPDATE call_sessions SET status = 'EN_CURSO', started_at = COALESCE(started_at, NOW()) WHERE id = :i"), {"i": s.id})
    await db.commit()
    lk = _livekit_token(f"cliente-{s.id}", _first_name(s.client_name) or "Cliente", s.room_name)
    return {**lk, "role": "CLIENTE", "recording_enabled": bool(s.recording_enabled), "consent": s.consent}


@router.post("/public/{token}/audio")
async def public_audio(token: str, request: Request, seq: int = Query(...), start_ms: Optional[int] = Query(None), db: AsyncSession = Depends(get_db)):
    await ensure_call_tables(db)
    return await _store_chunk(db, await _by_token(db, token), "CLIENTE", seq, start_ms, request)


# ------------------------------------------------------------------ transcripción (equipo)

@router.post("/{sid}/transcribe")
async def transcribe(sid: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """Transcribe la entrevista (una pista por persona). Solo si la cliente autorizó la grabación."""
    await ensure_call_tables(db)
    s = await _by_id(db, sid)
    if s.consent != "ACEPTADO":
        raise HTTPException(status_code=403, detail="La cliente no autorizó la grabación: no se transcribe.")
    for role in ("PSICOLOGA", "CLIENTE"):
        assemble_audio(sid, role)
    from app.services.call_transcription import transcribe_session
    try:
        res = await transcribe_session(db, sid, AUDIO_DIR)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=502, detail="El servicio de transcripción falló. Intenta de nuevo en unos minutos.")
    await db.execute(text("INSERT INTO call_access_log (session_id, actor, action) VALUES (:i, :a, 'transcribir')"), {"i": sid, "a": _who(user)})
    await db.commit()
    return res


@router.get("/{sid}/transcript")
async def get_transcript(sid: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_call_tables(db)
    await _by_id(db, sid)
    from app.services.call_transcription import ensure_transcript_tables
    await ensure_transcript_tables(db)
    row = (await db.execute(text("SELECT status, model, segments, error, updated_at FROM call_transcripts WHERE session_id = :i"), {"i": sid})).fetchone()
    await db.execute(text("INSERT INTO call_access_log (session_id, actor, action) VALUES (:i, :a, 'leer_transcripcion')"), {"i": sid, "a": _who(user)})
    await db.commit()
    if not row:
        return {"status": "SIN_TRANSCRIPCION", "segmentos": []}
    return {"status": row.status, "modelo": row.model, "segmentos": row.segments or [], "error": row.error,
            "actualizada": row.updated_at.isoformat() if row.updated_at else None}


# ------------------------------------------------------------------ extracción de datos y revisión (equipo)

class LinkClient(BaseModel):
    user_id: int


class Decision(BaseModel):
    accion: str               # aprobar | editar | rechazar
    valor: Optional[Any] = None


@router.post("/{sid}/link-client")
async def link_client(sid: int, body: LinkClient, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """Asocia la llamada al cliente del sistema (necesario para guardar lo aprobado en su perfil)."""
    from app.services.call_extraction import ensure_proposal_tables
    await ensure_call_tables(db)
    await ensure_proposal_tables(db)
    await _by_id(db, sid)
    name = (await db.execute(text("SELECT name FROM users WHERE id = :u"), {"u": body.user_id})).scalar()
    if not name:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    await db.execute(text("UPDATE call_sessions SET user_id = :u WHERE id = :i"), {"u": body.user_id, "i": sid})
    await db.execute(text("UPDATE profile_field_proposals SET user_id = :u WHERE session_id = :i AND estado = 'PROPUESTA'"), {"u": body.user_id, "i": sid})
    await db.commit()
    return {"user_id": body.user_id, "nombre": name}


@router.post("/{sid}/extract")
async def extract(sid: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    await ensure_call_tables(db)
    s = await _by_id(db, sid)
    if s.consent != "ACEPTADO":
        raise HTTPException(status_code=403, detail="La cliente no autorizó la grabación.")
    from app.services.call_extraction import extract_session
    try:
        res = await extract_session(db, sid)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=502, detail="El servicio de extracción falló. Intenta de nuevo en unos minutos.")
    await db.execute(text("INSERT INTO call_access_log (session_id, actor, action) VALUES (:i, :a, 'extraer_datos')"), {"i": sid, "a": _who(user)})
    await db.commit()
    return res


@router.get("/{sid}/proposals")
async def list_proposals(sid: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    from app.services.call_extraction import ensure_proposal_tables
    await ensure_call_tables(db)
    await ensure_proposal_tables(db)
    s = await _by_id(db, sid)
    rows = (await db.execute(text("""SELECT id, campo, etiqueta, destino, valor, cita, minuto, confianza, solo_sugerencia, valor_actual,
        conflicto, estado, valor_final, revisado_por, revisado_at FROM profile_field_proposals WHERE session_id = :i ORDER BY conflicto DESC, id"""), {"i": sid})).fetchall()
    cliente = None
    if getattr(s, "user_id", None):
        cliente = (await db.execute(text("SELECT id, name FROM users WHERE id = :u"), {"u": s.user_id})).fetchone()
    return {"cliente": {"id": cliente.id, "nombre": cliente.name} if cliente else None,
            "propuestas": [{"id": r.id, "campo": r.campo, "etiqueta": r.etiqueta, "destino": r.destino, "valor": r.valor, "cita": r.cita,
                            "minuto": r.minuto, "confianza": r.confianza, "solo_sugerencia": r.solo_sugerencia, "valor_actual": r.valor_actual,
                            "conflicto": r.conflicto, "estado": r.estado, "valor_final": r.valor_final, "revisado_por": r.revisado_por,
                            "revisado_at": r.revisado_at.isoformat() if r.revisado_at else None} for r in rows]}


@router.post("/{sid}/proposals/{pid}/decision")
async def decide(sid: int, pid: int, body: Decision, db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    import json as _json
    from app.services.call_extraction import ensure_proposal_tables, apply_proposal, _validar, CAMPOS, _norm
    await ensure_proposal_tables(db)
    prop = (await db.execute(text("SELECT * FROM profile_field_proposals WHERE id = :p AND session_id = :s"), {"p": pid, "s": sid})).fetchone()
    if not prop:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada.")
    if prop.estado != "PROPUESTA":
        raise HTTPException(status_code=409, detail="Esta propuesta ya fue revisada.")
    actor = _who(user)
    if body.accion == "rechazar":
        await db.execute(text("UPDATE profile_field_proposals SET estado = 'RECHAZADA', revisado_por = :a, revisado_at = NOW() WHERE id = :p"), {"a": actor, "p": pid})
        await db.commit()
        return {"estado": "RECHAZADA"}
    if body.accion not in ("aprobar", "editar"):
        raise HTTPException(status_code=422, detail="Acción inválida.")
    valor = prop.valor if body.accion == "aprobar" else body.valor
    if body.accion == "editar":
        # el valor editado también debe respetar el catálogo (la cita sigue siendo la de la propuesta)
        v, motivo = _validar({"campo": prop.campo, "valor": valor, "cita": prop.cita}, _norm(prop.cita))
        if v is None:
            raise HTTPException(status_code=422, detail=f"Valor no válido: {motivo}")
        valor = v
    try:
        await apply_proposal(db, prop, valor, actor)
    except RuntimeError as exc:
        await db.rollback()
        raise HTTPException(status_code=422, detail=str(exc))
    estado = "APROBADA" if body.accion == "aprobar" else "EDITADA"
    await db.execute(text("""UPDATE profile_field_proposals SET estado = :e, valor_final = CAST(:v AS jsonb), revisado_por = :a, revisado_at = NOW()
        WHERE id = :p"""), {"e": estado, "v": _json.dumps(valor, ensure_ascii=False), "a": actor, "p": pid})
    await db.commit()
    return {"estado": estado, "valor": valor}


@router.get("/buscar/clientes")
async def buscar_clientes(q: str = Query(..., min_length=3), db: AsyncSession = Depends(get_db), user: dict = Depends(require_staff)):
    """Busca clientes por nombre para asociarlos a una llamada (máx. 10)."""
    rows = (await db.execute(text("""SELECT u.id, u.name, u.crm_id, p.city, p.age FROM users u LEFT JOIN profiles p ON p.user_id = u.id
        WHERE unaccent(lower(u.name)) LIKE '%' || unaccent(lower(:q)) || '%' AND u.crm_id ~ '^[0-9]+$'
        ORDER BY u.id DESC LIMIT 10"""), {"q": q.strip()})).fetchall()
    return [{"id": r.id, "nombre": r.name, "crm_id": r.crm_id, "ciudad": r.city, "edad": r.age} for r in rows]


@router.get("/recursos/guion")
async def guion(user: dict = Depends(require_staff)):
    """Guion de entrevista (borrador) con el campo del perfil que llena cada pregunta."""
    import json as _json
    return _json.loads((Path(__file__).resolve().parent.parent / "data" / "guion_entrevista.json").read_text(encoding="utf-8"))
