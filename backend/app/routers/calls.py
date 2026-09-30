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
CONSENT_VERSION = "2026-09-30-borrador"
# BORRADOR: debe revisarlo un abogado antes de usarse con clientes reales (Ley 1581 de 2012, habeas data).
CONSENT_TEXT = (
    "Autorizo a Daily Lover a grabar únicamente el AUDIO de esta videollamada y a transcribirlo, con el fin de "
    "completar mi perfil y encontrar personas más compatibles conmigo. Entiendo que: (1) la grabación es voluntaria y "
    "puedo negarme: si no acepto, la entrevista se realiza igual y no se graba nada; (2) la psicóloga revisa lo que se "
    "extraiga antes de que entre a mi perfil; (3) puedo pedir en cualquier momento consultar, corregir o eliminar mi "
    "audio, mi transcripción y mis datos; (4) solo personal autorizado de Daily Lover accede a ellos."
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

class CreateCall(BaseModel):
    client_name: str
    psychologist_name: Optional[str] = None
    appointment_id: Optional[int] = None
    is_test: Optional[bool] = False


def _public(row) -> Dict[str, Any]:
    return {"id": row.id, "client_name": row.client_name, "psychologist_name": row.psychologist_name, "status": row.status,
            "consent": row.consent, "recording_enabled": bool(row.recording_enabled), "is_test": bool(row.is_test),
            "public_url": f"{APP_BASE_URL}/admin/llamada/{row.public_token}",
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "started_at": row.started_at.isoformat() if row.started_at else None,
            "ended_at": row.ended_at.isoformat() if row.ended_at else None}


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
