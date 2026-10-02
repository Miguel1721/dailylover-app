"""Vigilancia de operaciones: concilia los pagos de Stripe con el sistema y detecta webhooks en silencio.

Nació del incidente de sep-2026: 15 días de pagos sin registrar y nadie se enteró. Corre cada 30 min en UN solo proceso (líder).
Avisa por (1) un aviso URGENTE en el panel (tabla reminders) y (2) correo a la dirección de alertas (staff_settings.ops_alert_email).
"""
import asyncio
import base64
import json
import logging
import os
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
BOGOTA = ZoneInfo("America/Bogota")
GRACE_MINUTES = 20          # margen para que el webhook procese un pago recién hecho
STRIPE_LOOKBACK_HOURS = 96
CRM_SILENCE_HOURS = 8       # horas sin eventos del CRM (solo en horario laboral) para alertar
RENOTIFY_HOURS = 6
ALERT_EMAIL_DEFAULT = "miguel.lozano1408@gmail.com"


async def ensure_ops_tables(db: AsyncSession) -> None:
    await db.execute(text("""CREATE TABLE IF NOT EXISTS ops_alerts (
        key TEXT PRIMARY KEY, detail TEXT, first_seen TIMESTAMPTZ DEFAULT NOW(), last_notified TIMESTAMPTZ, resolved_at TIMESTAMPTZ, last_count INT)"""))
    await db.commit()


def _stripe_get(path: str, params: Dict[str, Any]) -> Dict[str, Any]:
    key = os.environ.get("STRIPE_API_KEY", "")
    if not key:
        raise RuntimeError("Sin STRIPE_API_KEY")
    auth = "Basic " + base64.b64encode(f"{key}:".encode()).decode()
    req = urllib.request.Request("https://api.stripe.com" + path + "?" + urllib.parse.urlencode(params, doseq=True), headers={"Authorization": auth})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode())


async def check_stripe_reconciliation(db: AsyncSession) -> Dict[str, Any]:
    """Pagos exitosos de Stripe (últimas 96 h, con margen de 20 min) que NO están en stripe_payments."""
    since = int((datetime.now(timezone.utc) - timedelta(hours=STRIPE_LOOKBACK_HOURS)).timestamp())
    cutoff = int((datetime.now(timezone.utc) - timedelta(minutes=GRACE_MINUTES)).timestamp())
    pis: List[dict] = []
    after = None
    for _ in range(8):
        p: Dict[str, Any] = {"limit": 100, "created[gte]": since}
        if after:
            p["starting_after"] = after
        d = await asyncio.to_thread(_stripe_get, "/v1/payment_intents", p)
        pis += d["data"]
        if not d.get("has_more"):
            break
        after = d["data"][-1]["id"]
    ok = [p for p in pis if p.get("status") == "succeeded" and p["created"] <= cutoff]
    have = {r[0] for r in (await db.execute(text("SELECT stripe_payment_intent_id FROM stripe_payments WHERE stripe_payment_intent_id IS NOT NULL"))).fetchall()}
    missing = [p for p in ok if p["id"] not in have]
    vip = [p for p in missing if 640000 <= p["amount"] / 100 <= 660000]
    return {"checked": len(ok), "missing": len(missing), "missing_vip_650k": len(vip),
            "oldest_missing": datetime.fromtimestamp(min((p["created"] for p in missing), default=0), BOGOTA).strftime("%d/%m %H:%M") if missing else None,
            "missing_total_cop": int(sum(p["amount"] for p in missing) / 100)}


async def check_crm_webhook(db: AsyncSession) -> Dict[str, Any]:
    now = datetime.now(BOGOTA)
    last = (await db.execute(text("SELECT max(received_at) FROM webhook_events_raw WHERE source ILIKE 'smartmatch%'"))).scalar()
    hours = None
    if last is not None:
        l = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
        hours = round((datetime.now(timezone.utc) - l).total_seconds() / 3600, 1)
    working = now.weekday() < 6 and 8 <= now.hour < 22
    return {"hours_since_last_event": hours, "working_hours": working, "silent": bool(working and (hours is None or hours > CRM_SILENCE_HOURS))}


SHEET_SYNC_MAX_HOURS = 26   # la sincronizacion corre una vez al dia (04:30 hora Colombia)
_SYNC_STATUS_FILES = ("/app/sync_sheet_status.json", "/home/ubuntu/dailylover/backend/sync_sheet_status.json")


async def check_sheet_sync(db: AsyncSession) -> Dict[str, Any]:
    """Hoja -> base: alerta si la ultima sincronizacion exitosa tiene mas de 26 h. Se apaga con staff_settings.sheet_sync_enabled = 0 (al cortar la hoja)."""
    row = (await db.execute(text("SELECT value FROM staff_settings WHERE key = 'sheet_sync_enabled'"))).fetchone()
    if row and str(row[0]).strip() in ("0", "false", "no"):
        return {"enabled": False, "stale": False}
    last, error = None, None
    for path in _SYNC_STATUS_FILES:
        if os.path.exists(path):
            try:
                j = json.load(open(path, encoding="utf-8"))
                last = j.get("last_successful_sync")
                error = j.get("last_error")
                break
            except Exception as exc:
                error = f"no se pudo leer el estado: {exc}"[:120]
    hours = None
    if last:
        l = datetime.fromisoformat(last.replace("Z", "+00:00"))
        l = l if l.tzinfo else l.replace(tzinfo=timezone.utc)
        hours = round((datetime.now(timezone.utc) - l).total_seconds() / 3600, 1)
    return {"enabled": True, "hours_since_last_sync": hours, "last_error": error, "stale": hours is None or hours > SHEET_SYNC_MAX_HOURS}


async def _alert_email(db: AsyncSession) -> str:
    row = (await db.execute(text("SELECT value FROM staff_settings WHERE key = 'ops_alert_email'"))).fetchone()
    return (row[0] if row else ALERT_EMAIL_DEFAULT).strip()


async def _raise(db: AsyncSession, key: str, title: str, detail: str, count: int) -> bool:
    """Crea/renueva una alerta. Devuelve True si se notificó (nueva, empeoró o pasaron 6 h)."""
    row = (await db.execute(text("SELECT last_notified, last_count, resolved_at FROM ops_alerts WHERE key = :k"), {"k": key})).fetchone()
    now = datetime.now(timezone.utc)
    notify = (row is None or row[2] is not None or (row[1] or 0) < count
              or row[0] is None or (now - row[0]).total_seconds() > RENOTIFY_HOURS * 3600)
    await db.execute(text("""INSERT INTO ops_alerts (key, detail, last_notified, last_count, resolved_at) VALUES (:k, :d, CASE WHEN :n THEN NOW() END, :c, NULL)
        ON CONFLICT (key) DO UPDATE SET detail = :d, last_count = :c, resolved_at = NULL,
            last_notified = CASE WHEN :n THEN NOW() ELSE ops_alerts.last_notified END,
            first_seen = CASE WHEN ops_alerts.resolved_at IS NOT NULL THEN NOW() ELSE ops_alerts.first_seen END"""), {"k": key, "d": detail, "c": count, "n": notify})
    if notify:
        await db.execute(text("""INSERT INTO reminders (title, client_name, client_phone, priority, matchmaker, due_date, notes)
            VALUES (:t, 'SISTEMA', '', 'URGENTE', 'MPS', 'Hoy (URGENTE)', :n)"""), {"t": title, "n": detail})
    await db.commit()
    if notify:
        try:
            from app.services.email_service import send_email_html
            to = await _alert_email(db)
            html = f'<div style="font-family:Arial;max-width:560px"><h2 style="color:#b91c1c">⚠️ {title}</h2><p>{detail}</p><p style="font-size:12px;color:#64748b">Alerta automática de Daily Lover (vigilancia de operaciones). Se repite cada {RENOTIFY_HOURS} h mientras el problema continúe.</p></div>'
            await asyncio.to_thread(send_email_html, to, f"[ALERTA] {title}", html)
        except Exception as exc:
            logger.warning("No se pudo enviar el correo de alerta: %s", exc)
    return notify


async def _clear(db: AsyncSession, key: str) -> None:
    await db.execute(text("UPDATE ops_alerts SET resolved_at = NOW() WHERE key = :k AND resolved_at IS NULL"), {"k": key})
    await db.commit()


async def run_checks(db: AsyncSession, notify: bool = True) -> Dict[str, Any]:
    await ensure_ops_tables(db)
    out: Dict[str, Any] = {}
    try:
        st = await check_stripe_reconciliation(db)
        out["stripe"] = st
        if notify and st["missing"] > 0:
            # Los pagos exitosos que el webhook no registró se recuperan solos (así finanzas, planes y slots no dependen de que el webhook funcione)
            try:
                from app.services.stripe_recuperar import recuperar_pagos_faltantes
                rec = await recuperar_pagos_faltantes(db)
                out["stripe_recuperados"] = rec
                if rec["registrados"] > 0:
                    await _raise(db, "stripe_webhook_sin_eventos", "Stripe no avisó de pagos: se registraron solos",
                                 f"Se registraron automáticamente {rec['registrados']} pago(s) exitoso(s) que el webhook de Stripe no avisó. "
                                 "Falta activar en Stripe (Developers > Webhooks) los eventos checkout.session.completed, charge.succeeded y payment_intent.succeeded."
                                 + (f" Pagos del plan VIP de 650k sin enlace enviado: {', '.join(rec['vip_sin_enlace'])}." if rec["vip_sin_enlace"] else ""), rec["registrados"])
                st = await check_stripe_reconciliation(db)
                out["stripe"] = st
            except Exception as exc:
                logger.warning("Recuperación automática de pagos de Stripe falló: %s", exc)
        if notify:
            if st["missing"] > 0:
                vip = f" Incluye {st['missing_vip_650k']} de 650.000 (plan VIP: el cliente NO recibió su enlace para agendar)." if st["missing_vip_650k"] else ""
                await _raise(db, "stripe_unrecorded", f"{st['missing']} pago(s) de Stripe sin registrar en el sistema",
                             f"Hay {st['missing']} pagos exitosos en Stripe (desde {st['oldest_missing']}, total ${st['missing_total_cop']:,} COP) que no están en el sistema.{vip} "
                             f"Revisar el webhook de Stripe (Developers → Webhooks) y reprocesar.", st["missing"])
            else:
                await _clear(db, "stripe_unrecorded")
    except Exception as exc:
        out["stripe"] = {"error": str(exc)[:160]}
    try:
        crm = await check_crm_webhook(db)
        out["crm_webhook"] = crm
        if notify:
            if crm["silent"]:
                await _raise(db, "crm_webhook_silent", "El webhook del CRM lleva horas sin recibir eventos",
                             f"No llegan eventos del CRM (SmartMatchApp) hace {crm['hours_since_last_event']} h en horario laboral. Revisar que el webhook siga activo en el CRM.",
                             int(crm["hours_since_last_event"] or 999))
            else:
                await _clear(db, "crm_webhook_silent")
    except Exception as exc:
        out["crm_webhook"] = {"error": str(exc)[:160]}
    try:
        sy = await check_sheet_sync(db)
        out["sheet_sync"] = sy
        if notify:
            if sy["stale"]:
                h = sy["hours_since_last_sync"]
                await _raise(db, "sheet_sync_stale", "La sincronización de la hoja a la base no corre",
                             f"La última sincronización exitosa fue hace {h if h is not None else 'más de 26'} h (debería correr cada día a las 4:30 a. m.). "
                             f"Revisar /home/ubuntu/dailylover/logs/cron_sheet_sync.log en el servidor. Si ya se congeló la hoja, apagar este aviso con staff_settings.sheet_sync_enabled = 0."
                             + (f" Último error: {sy['last_error']}" if sy.get("last_error") else ""), int(h or 999))
            else:
                await _clear(db, "sheet_sync_stale")
    except Exception as exc:
        out["sheet_sync"] = {"error": str(exc)[:160]}
    return out


async def ops_watch_loop() -> None:
    from app.database import AsyncSessionLocal
    await asyncio.sleep(240)
    while True:
        try:
            async with AsyncSessionLocal() as db:
                res = await run_checks(db)
                logger.info("[OPS] vigilancia: %s", json.dumps(res, default=str)[:300])
        except Exception as exc:
            logger.warning("Error en ops_watch_loop: %s", exc)
        await asyncio.sleep(1800)
