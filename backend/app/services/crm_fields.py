"""Copia fiel de TODOS los campos del CRM (SmartMatchApp) por cliente, sin descartar ninguno.

Tabla `crm_profile_fields` (crm_id, field_id, label, ftype, value JSONB, source, updated_at) + diccionario `crm_field_dictionary`.
Es ADITIVA: no modifica profiles/users. Se alimenta (1) con el respaldo completo de la API y (2) con cada evento del webhook.
"""
import json
import logging
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
_ready = False


async def ensure_crm_field_tables(db: AsyncSession) -> None:
    global _ready
    if _ready:
        return
    await db.execute(text("""CREATE TABLE IF NOT EXISTS crm_field_dictionary (
        field_id TEXT PRIMARY KEY, label TEXT, ftype TEXT, updated_at TIMESTAMPTZ DEFAULT NOW())"""))
    await db.execute(text("""CREATE TABLE IF NOT EXISTS crm_profile_fields (
        crm_id INT NOT NULL, field_id TEXT NOT NULL, user_id INT, label TEXT, ftype TEXT, value JSONB,
        source TEXT, updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (crm_id, field_id))"""))
    await db.execute(text("CREATE INDEX IF NOT EXISTS idx_crm_pf_user ON crm_profile_fields (user_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS idx_crm_pf_field ON crm_profile_fields (field_id)"))
    await db.commit()
    _ready = True


def _empty(v: Any) -> bool:
    return v is None or v == "" or v == [] or v == {}


async def backfill_from_snapshots(db: AsyncSession) -> Dict[str, int]:
    """Rellena desde crm_client_snapshots (respaldo completo de la API). Solo campos con valor."""
    await ensure_crm_field_tables(db)
    rows = (await db.execute(text("""
        SELECT s.crm_id, u.id AS user_id, s.profile, s.preferences
        FROM crm_client_snapshots s LEFT JOIN users u ON u.crm_id = cast(s.crm_id AS text)"""))).fetchall()
    n_clients = n_fields = 0
    dic: Dict[str, tuple] = {}
    for crm_id, user_id, prof, pref in rows:
        batch = []
        for blob in (prof, pref):
            for g in (blob or []):
                for fid, f in (g.get("fields") or {}).items():
                    if not (fid.startswith("prof_") or fid.startswith("pref_")):
                        continue
                    dic[fid] = (f.get("label"), f.get("type"))
                    v = f.get("value")
                    if _empty(v):
                        continue
                    batch.append({"c": crm_id, "f": fid, "u": user_id, "l": f.get("label"), "t": f.get("type"), "v": json.dumps(v, ensure_ascii=False)})
        if batch:
            await db.execute(text("""INSERT INTO crm_profile_fields (crm_id, field_id, user_id, label, ftype, value, source, updated_at)
                VALUES (:c, :f, :u, :l, :t, CAST(:v AS JSONB), 'api_backfill', NOW())
                ON CONFLICT (crm_id, field_id) DO UPDATE SET user_id = EXCLUDED.user_id, label = EXCLUDED.label, ftype = EXCLUDED.ftype,
                    value = EXCLUDED.value, source = 'api_backfill', updated_at = NOW()
                WHERE crm_profile_fields.source = 'api_backfill'"""), batch)
            n_clients += 1; n_fields += len(batch)
        if n_clients % 500 == 0:
            await db.commit()
    for fid, (label, ftype) in dic.items():
        await db.execute(text("""INSERT INTO crm_field_dictionary (field_id, label, ftype) VALUES (:f, :l, :t)
            ON CONFLICT (field_id) DO UPDATE SET label = EXCLUDED.label, ftype = EXCLUDED.ftype, updated_at = NOW()"""), {"f": fid, "l": label, "t": ftype})
    await db.commit()
    return {"clientes": n_clients, "campos": n_fields, "diccionario": len(dic)}


async def ingest_webhook_payload(db: AsyncSession, payload: Dict[str, Any]) -> int:
    """Guarda los campos prof_*/pref_* de un evento del webhook. Un valor vacío borra el campo. Nunca lanza excepciones."""
    try:
        await ensure_crm_field_tables(db)
        data = payload.get("payload") if isinstance(payload.get("payload"), dict) else payload
        crm_id = data.get("id") or data.get("client_id")
        if crm_id is None:
            return 0
        crm_id = int(crm_id)
        user_id = (await db.execute(text("SELECT id FROM users WHERE crm_id = :c LIMIT 1"), {"c": str(crm_id)})).scalar()
        n = 0
        for fid, v in data.items():
            if not (str(fid).startswith("prof_") or str(fid).startswith("pref_")):
                continue
            if _empty(v):
                await db.execute(text("DELETE FROM crm_profile_fields WHERE crm_id = :c AND field_id = :f"), {"c": crm_id, "f": fid})
            else:
                meta = (await db.execute(text("SELECT label, ftype FROM crm_field_dictionary WHERE field_id = :f"), {"f": fid})).fetchone()
                await db.execute(text("""INSERT INTO crm_profile_fields (crm_id, field_id, user_id, label, ftype, value, source, updated_at)
                    VALUES (:c, :f, :u, :l, :t, CAST(:v AS JSONB), 'webhook', NOW())
                    ON CONFLICT (crm_id, field_id) DO UPDATE SET user_id = COALESCE(EXCLUDED.user_id, crm_profile_fields.user_id),
                        value = EXCLUDED.value, source = 'webhook', updated_at = NOW()"""),
                    {"c": crm_id, "f": fid, "u": user_id, "l": meta[0] if meta else None, "t": meta[1] if meta else None, "v": json.dumps(v, ensure_ascii=False)})
            n += 1
        await db.commit()
        return n
    except Exception as exc:  # jamás debe tumbar el webhook
        logger.warning("No se pudo guardar la copia fiel de campos del CRM: %s", exc)
        try:
            await db.rollback()
        except Exception:
            pass
        return 0
