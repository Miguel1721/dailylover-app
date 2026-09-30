"""Correos y recordatorios del horario semanal (Fase 4).

- Ajustes en `staff_settings` (destino de prueba de los correos, recordatorios on/off).
- Correo con el horario aprobado de cada persona.
- Recordatorio diario a quien aún no puso su disponibilidad (solo si el admin lo activó).
"""
import asyncio
import html
import logging
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

BOGOTA = ZoneInfo("America/Bogota")
TEST_EMAIL_DEFAULT = "miguel.lozano1408@gmail.com"
REMINDER_HOUR = 9  # hora de Bogotá a partir de la cual sale el recordatorio del día
DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
TYPE_LABEL = {"ENTREVISTAS": "Entrevistas", "MATCHMAKING": "Matches"}


async def ensure_planning_tables(db: AsyncSession) -> None:
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS staff_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())
    """))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS staff_weeks (
            week_monday DATE PRIMARY KEY,
            status VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
            generated_at TIMESTAMPTZ, generated_by TEXT,
            approved_at TIMESTAMPTZ, approved_by TEXT,
            emails_sent_at TIMESTAMPTZ
        )
    """))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS staff_reminders (
            person TEXT NOT NULL, sent_on DATE NOT NULL, kind TEXT NOT NULL DEFAULT 'DISPONIBILIDAD',
            PRIMARY KEY (person, sent_on, kind)
        )
    """))
    await db.execute(text("ALTER TABLE staff_team ADD COLUMN IF NOT EXISTS notify_email VARCHAR(150)"))
    await db.commit()


async def get_setting(db: AsyncSession, key: str, default: str = "") -> str:
    row = (await db.execute(text("SELECT value FROM staff_settings WHERE key = :k"), {"k": key})).fetchone()
    return row[0] if row else default


async def set_setting(db: AsyncSession, key: str, value: str) -> None:
    await db.execute(text("""
        INSERT INTO staff_settings (key, value, updated_at) VALUES (:k, :v, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    """), {"k": key, "v": value})
    await db.commit()


async def recipient_for(db: AsyncSession, person: str) -> Optional[str]:
    """Correo destino. Con destino de prueba activo, TODO va a esa dirección; si no, al correo de notificación de la persona."""
    test_to = (await get_setting(db, "email_test_to", TEST_EMAIL_DEFAULT)).strip()
    if test_to:
        return test_to
    row = (await db.execute(text("SELECT notify_email FROM staff_team WHERE LOWER(name) = LOWER(:n)"), {"n": person})).fetchone()
    return (row[0] or "").strip() or None if row else None


def _t12(t) -> str:
    h, m = t.hour, t.minute
    suf = "am" if h < 12 else "pm"
    h12 = h % 12 or 12
    return f"{h12}{suf}" if m == 0 else f"{h12}:{m:02d}{suf}"


async def _send(to: str, subject: str, body_html: str) -> bool:
    from app.services.email_service import send_email_html
    try:
        return bool(await asyncio.to_thread(send_email_html, to, subject, body_html))
    except Exception as exc:  # no tumbar el flujo por un correo
        logger.warning("Error enviando correo de turnos a %s: %s", to, exc)
        return False


def _wrap(person: str, test_to: bool, title: str, inner: str) -> str:
    note = (f'<p style="background:#fef3c7;padding:8px 12px;border-radius:6px;font-size:12px;color:#92400e">'
            f'MODO PRUEBA: este correo es para <b>{html.escape(person)}</b> y se envió a la dirección de prueba.</p>') if test_to else ""
    return (f'<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#1e293b">{note}'
            f'<h2 style="color:#0f172a">{html.escape(title)}</h2>{inner}'
            f'<p style="font-size:12px;color:#64748b;margin-top:24px">Daily Lover · Agenda y turnos</p></div>')


async def send_schedule_email(db: AsyncSession, person: str, monday: date, shifts: List[dict]) -> Dict:
    to = await recipient_for(db, person)
    if not to:
        return {"name": person, "to": None, "ok": False, "reason": "sin correo"}
    test_mode = bool((await get_setting(db, "email_test_to", TEST_EMAIL_DEFAULT)).strip())
    by_day: Dict[date, List[dict]] = {}
    for s in shifts:
        by_day.setdefault(s["date"], []).append(s)
    rows = ""
    for d in sorted(by_day):
        parts = "<br>".join(
            f'{_t12(s["start"])} – {_t12(s["end"])} · <b style="color:{"#0f766e" if s["type"] == "ENTREVISTAS" else "#be185d"}">{TYPE_LABEL.get(s["type"], s["type"])}</b>'
            for s in sorted(by_day[d], key=lambda x: x["start"]))
        rows += (f'<tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;width:120px">{DAY_NAMES[d.weekday()]} {d.day}/{d.month}</td>'
                 f'<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">{parts}</td></tr>')
    end = monday + timedelta(days=6)
    inner = (f'<p>Hola {html.escape(person.split()[0])}, este es tu horario aprobado de la semana del '
             f'{monday.day}/{monday.month} al {end.day}/{end.month}:</p>'
             f'<table style="width:100%;border-collapse:collapse;font-size:14px">{rows}</table>'
             f'<p style="font-size:13px;color:#475569">Las entrevistas no se pueden mover por tu cuenta. '
             f'Las horas de matches sí puedes cambiarlas dentro de la misma semana.</p>')
    ok = await _send(to, f"Tu horario de la semana del {monday.day}/{monday.month}",
                     _wrap(person, test_mode, "Tu horario de la semana", inner))
    return {"name": person, "to": to, "ok": ok}


async def missing_availability(db: AsyncSession) -> List[str]:
    team = (await db.execute(text("SELECT name FROM staff_team WHERE is_active = true AND weekly_hours IS NOT NULL ORDER BY id"))).fetchall()
    have = {r[0] for r in (await db.execute(text("SELECT DISTINCT LOWER(employee_name) FROM staff_availability"))).fetchall()}
    return [t[0] for t in team if t[0].lower() not in have]


async def run_availability_reminders(db: AsyncSession, force: bool = False) -> Dict:
    """Un correo por día a cada persona activa que aún no puso su disponibilidad. Con recordatorios apagados no envía (salvo force)."""
    await ensure_planning_tables(db)
    if not force and (await get_setting(db, "reminders_enabled", "0")) != "1":
        return {"enabled": False, "sent": [], "pending": await missing_availability(db)}
    today = datetime.now(BOGOTA).date()
    pending = await missing_availability(db)
    test_mode = bool((await get_setting(db, "email_test_to", TEST_EMAIL_DEFAULT)).strip())
    sent = []
    for person in pending:
        # una sola vez por persona y día, aunque haya varios procesos del API
        got = (await db.execute(text("""
            INSERT INTO staff_reminders (person, sent_on) VALUES (:p, :d) ON CONFLICT DO NOTHING RETURNING 1
        """), {"p": person, "d": today})).fetchone()
        await db.commit()
        if not got:
            continue
        to = await recipient_for(db, person)
        if not to:
            sent.append({"name": person, "to": None, "ok": False, "reason": "sin correo"})
            continue
        inner = (f'<p>Hola {html.escape(person.split()[0])}, todavía no has puesto tu <b>disponibilidad</b> en el sistema.</p>'
                 f'<p>El horario de la próxima semana <b>no se puede generar</b> hasta que todas la hayan puesto. '
                 f'Entra a <b>Agenda y turnos → Disponibilidad</b> y márcala cuanto antes.</p>'
                 f'<p><a href="https://daily-lover.agentesia.cloud/admin/matchmaking/calendario" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:700">Poner mi disponibilidad</a></p>')
        ok = await _send(to, "Recordatorio: pon tu disponibilidad de la semana", _wrap(person, test_mode, "Falta tu disponibilidad", inner))
        sent.append({"name": person, "to": to, "ok": ok})
    return {"enabled": True, "sent": sent, "pending": pending}


async def availability_reminder_loop() -> None:
    """Revisa cada hora; desde las 9:00 (Bogotá) envía el recordatorio del día si está activado."""
    from app.database import AsyncSessionLocal
    await asyncio.sleep(180)
    while True:
        try:
            if datetime.now(BOGOTA).hour >= REMINDER_HOUR:
                async with AsyncSessionLocal() as session:
                    res = await run_availability_reminders(session)
                    if res.get("sent"):
                        logger.info("[TURNOS] recordatorios de disponibilidad: %s", [(s["name"], s["ok"]) for s in res["sent"]])
        except Exception as exc:
            logger.warning("Error en availability_reminder_loop: %s", exc)
        await asyncio.sleep(3600)
