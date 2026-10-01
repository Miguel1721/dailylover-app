"""Transcripción de las entrevistas grabadas (una pista de audio por persona) con Gemini.

Cada pista se transcribe por separado, así se sabe quién habla sin adivinar. Los tiempos de cada pista se corren
según la hora en que esa persona empezó a grabar, y luego se mezclan en una sola conversación ordenada.
Regla: transcribir literal; si algo no se entiende, marcarlo como [inaudible]; nunca completar ni resumir.
"""
import asyncio
import base64
import json
import logging
import os
import re
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

MODEL = os.environ.get("TRANSCRIPTION_MODEL", "gemini-2.5-flash")
MAX_INLINE_BYTES = 18 * 1024 * 1024
ROLES = ("PSICOLOGA", "CLIENTE")

PROMPT = (
    "Transcribe literalmente este audio en español (Colombia). Es UNA sola persona hablando en una entrevista. "
    "Devuelve SOLO un JSON con la forma {\"segmentos\": [{\"inicio\": segundos, \"fin\": segundos, \"texto\": \"...\"}]}. "
    "Un segmento por frase o pausa natural. Escribe exactamente lo que se dice, sin resumir, sin corregir y sin agregar nada. "
    "Si una parte no se entiende escribe [inaudible]. Si no hay voz, devuelve {\"segmentos\": []}."
)

_ready = False


async def ensure_transcript_tables(db: AsyncSession) -> None:
    global _ready
    if _ready:
        return
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS call_transcripts (
            id SERIAL PRIMARY KEY, session_id INT UNIQUE NOT NULL, status TEXT NOT NULL DEFAULT 'PENDIENTE',
            model TEXT, segments JSONB DEFAULT '[]'::jsonb, full_text TEXT, error TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
        )"""))
    await db.commit()
    _ready = True


def _gemini_transcribe(path: Path) -> List[Dict[str, Any]]:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("Falta GEMINI_API_KEY")
    data = path.read_bytes()
    mime = "audio/webm" if path.suffix == ".webm" else ("audio/wav" if path.suffix == ".wav" else "audio/mpeg")
    subido = None
    if len(data) > MAX_INLINE_BYTES:
        subido = _subir_archivo(data, mime, key)          # audios largos: se suben como archivo y se borran al terminar
        audio_part = {"file_data": {"mime_type": mime, "file_uri": subido["uri"]}}
    else:
        audio_part = {"inline_data": {"mime_type": mime, "data": base64.b64encode(data).decode()}}
    body = {
        "contents": [{"parts": [audio_part, {"text": PROMPT}]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
    }
    try:
        return _generar(body, key)
    finally:
        if subido:
            try:
                urllib.request.urlopen(urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/{subido['name']}",
                                                              method="DELETE", headers={"x-goog-api-key": key}), timeout=30)
            except Exception:
                logger.warning("No se pudo borrar el archivo temporal %s en Gemini", subido.get("name"))


def _subir_archivo(data: bytes, mime: str, key: str) -> Dict[str, Any]:
    import time
    ini = urllib.request.Request("https://generativelanguage.googleapis.com/upload/v1beta/files", method="POST",
        data=json.dumps({"file": {"display_name": "entrevista"}}).encode(),
        headers={"x-goog-api-key": key, "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
                 "X-Goog-Upload-Header-Content-Length": str(len(data)), "X-Goog-Upload-Header-Content-Type": mime,
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(ini, timeout=60) as r:
        url = r.headers.get("x-goog-upload-url")
    up = urllib.request.Request(url, method="POST", data=data, headers={"X-Goog-Upload-Command": "upload, finalize",
                                "X-Goog-Upload-Offset": "0", "Content-Length": str(len(data))})
    with urllib.request.urlopen(up, timeout=600) as r:
        f = json.loads(r.read().decode())["file"]
    for _ in range(60):                                   # esperar a que el archivo quede listo
        if f.get("state") in (None, "ACTIVE"):
            return f
        time.sleep(3)
        with urllib.request.urlopen(urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/{f['name']}",
                                                           headers={"x-goog-api-key": key}), timeout=30) as r:
            f = json.loads(r.read().decode())
    raise RuntimeError("Gemini no terminó de procesar el audio subido")


def _generar(body: Dict[str, Any], key: str) -> List[Dict[str, Any]]:
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key})
    with urllib.request.urlopen(req, timeout=300) as r:
        out = json.loads(r.read().decode())
    raw = "".join(p.get("text", "") for p in out["candidates"][0]["content"]["parts"])
    raw = re.sub(r"^```(json)?|```$", "", raw.strip()).strip()
    segs = json.loads(raw).get("segmentos", [])
    clean = []
    for s in segs:
        t = str(s.get("texto") or "").strip()
        if not t:
            continue
        try:
            ini, fin = float(s.get("inicio") or 0), float(s.get("fin") or 0)
        except (TypeError, ValueError):
            ini, fin = 0.0, 0.0
        clean.append({"inicio": round(ini, 1), "fin": round(max(fin, ini), 1), "texto": t})
    return clean


async def transcribe_session(db: AsyncSession, session_id: int, audio_dir: Path) -> Dict[str, Any]:
    """Transcribe las pistas ensambladas de la llamada y guarda la conversación mezclada."""
    await ensure_transcript_tables(db)
    starts = {r[0]: r[1] for r in (await db.execute(text(
        "SELECT role, min(recorded_start_ms) FROM call_audio_chunks WHERE session_id = :s GROUP BY role"), {"s": session_id})).fetchall()}
    files = {}
    for role in ROLES:
        for ext in (".webm", ".wav", ".mp3"):
            p = audio_dir / str(session_id) / f"{role}{ext}"
            if p.exists() and p.stat().st_size > 0:
                files[role] = p
                break
    if not files:
        raise RuntimeError("No hay audio ensamblado para esta llamada.")
    base_ms = min((v for k, v in starts.items() if k in files and v), default=None)
    await db.execute(text("""INSERT INTO call_transcripts (session_id, status, model) VALUES (:s, 'EN_PROCESO', :m)
        ON CONFLICT (session_id) DO UPDATE SET status = 'EN_PROCESO', model = :m, error = NULL, updated_at = NOW()"""),
        {"s": session_id, "m": MODEL})
    await db.commit()
    merged: List[Dict[str, Any]] = []
    try:
        for role, path in files.items():
            segs = await asyncio.to_thread(_gemini_transcribe, path)
            off = ((starts.get(role) or base_ms or 0) - (base_ms or 0)) / 1000.0
            for s in segs:
                merged.append({"quien": role, "inicio": round(s["inicio"] + off, 1), "fin": round(s["fin"] + off, 1), "texto": s["texto"]})
        merged.sort(key=lambda x: (x["inicio"], x["quien"]))
        full = "\n".join(f"[{int(s['inicio'] // 60):02d}:{int(s['inicio'] % 60):02d}] {'Psicóloga' if s['quien'] == 'PSICOLOGA' else 'Cliente'}: {s['texto']}" for s in merged)
        await db.execute(text("""UPDATE call_transcripts SET status = 'LISTA', segments = CAST(:g AS jsonb), full_text = :f, updated_at = NOW()
            WHERE session_id = :s"""), {"g": json.dumps(merged, ensure_ascii=False), "f": full, "s": session_id})
        await db.commit()
        return {"status": "LISTA", "segmentos": len(merged), "pistas": list(files)}
    except Exception as exc:
        logger.warning("Transcripción fallida (llamada %s): %s", session_id, exc)
        await db.rollback()
        await db.execute(text("UPDATE call_transcripts SET status = 'ERROR', error = :e, updated_at = NOW() WHERE session_id = :s"),
                         {"e": str(exc)[:500], "s": session_id})
        await db.commit()
        raise
