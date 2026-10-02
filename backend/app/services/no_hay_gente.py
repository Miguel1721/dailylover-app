"""Seguimiento de las personas en 'No hay gente': detecta gente NUEVA compatible con filtros baratos ANTES de usar el motor (y la IA).

Orden de costo (de menor a mayor):
  1. Filtros básicos en base de datos y en memoria: ciudad, género buscado (de ambas), rango de edad (de ambas).
  2. Solo si hay candidatas nuevas que pasan esos filtros: se consulta el motor de compatibilidad de esa persona.
  3. La IA (análisis profundo de la pareja) NO corre aquí: la psicóloga la pide al proponer, solo para la candidata que le interesa.
"""
import json
import re
import unicodedata
from datetime import timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import text

TOLERANCIA_EDAD = 2


def _n(s: Optional[str]) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z ]", "", s).strip()


def _genero(g: Optional[str]) -> str:
    g = _n(g)
    if g.startswith("hombre") or g in ("masculino", "male", "m"):
        return "hombre"
    if g.startswith("mujer") or g in ("femenino", "female", "f"):
        return "mujer"
    return g


def _prefs(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Preferencias del CRM: pref_54 género buscado (lista de {label}), pref_68 rango de edad ({start,end})."""
    gen = set()
    v = raw.get("pref_54")
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except Exception:
            v = None
    if isinstance(v, list):
        for x in v:
            lab = x.get("label") if isinstance(x, dict) else x
            if lab:
                gen.add(_genero(lab))
    edad = None
    e = raw.get("pref_68")
    if isinstance(e, str):
        try:
            e = json.loads(e)
        except Exception:
            e = None
    if isinstance(e, dict) and (e.get("start") or e.get("end")):
        try:
            edad = (int(e.get("start") or 18), int(e.get("end") or 99))
        except Exception:
            edad = None
    return {"gen": gen, "edad": edad}


def compatibles_basicos(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    """¿Vale la pena gastar motor en este par? Solo descarta lo que NO puede funcionar por datos básicos; si falta un dato, deja pasar."""
    from app.routers.matchmaking import normalize_city
    ca, cb = normalize_city(a.get("city") or ""), normalize_city(b.get("city") or "")
    if ca and cb and ca != cb:
        return False
    ga, gb = _genero(a.get("gender")), _genero(b.get("gender"))
    if a["prefs"]["gen"] and gb and gb not in a["prefs"]["gen"]:
        return False
    if b["prefs"]["gen"] and ga and ga not in b["prefs"]["gen"]:
        return False
    for x, y in ((a, b), (b, a)):
        rango, edad = x["prefs"]["edad"], y.get("age")
        if rango and edad and not (rango[0] - TOLERANCIA_EDAD <= int(edad) <= rango[1] + TOLERANCIA_EDAD):
            return False
    return True


async def _ficha(db, user_ids: List[int]) -> Dict[int, Dict[str, Any]]:
    rows = (await db.execute(text("""SELECT u.id, u.name, u.crm_id, p.gender, p.age, p.city FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ANY(:u)"""), {"u": user_ids})).fetchall()
    out = {r.id: {"user_id": r.id, "name": r.name, "crm_id": r.crm_id, "gender": r.gender, "age": r.age, "city": r.city, "prefs": {"gen": set(), "edad": None}} for r in rows}
    raw: Dict[int, Dict[str, Any]] = {}
    for r in (await db.execute(text("SELECT user_id, field_id, value FROM crm_profile_fields WHERE user_id = ANY(:u) AND field_id IN ('pref_54', 'pref_68')"), {"u": user_ids})).fetchall():
        raw.setdefault(r.user_id, {})[r.field_id] = r.value
    for uid, d in out.items():
        d["prefs"] = _prefs(raw.get(uid, {}))
    return out


async def entrantes_nuevos(db, user_id_a: int, desde, limite: int = 400) -> List[int]:
    """Personas que entraron al grupo que busca match después de `desde` (clientes nuevos, pagos nuevos o filas nuevas con slot abierto)."""
    rows = (await db.execute(text("""
        SELECT DISTINCT u.id FROM users u
        JOIN profiles p ON p.user_id = u.id
        WHERE u.id <> :a AND COALESCE(u.status, 'active') = 'active' AND u.merged_into_id IS NULL AND p.gender IS NOT NULL
          AND (u.created_at > :d OR p.last_payment_date > :d OR EXISTS (SELECT 1 FROM operational_matches n WHERE n.user_id_a = u.id AND n.created_at > :d))
          AND EXISTS (SELECT 1 FROM operational_matches o WHERE o.user_id_a = u.id AND UPPER(COALESCE(o.status, '')) IN ('LISTO PARA MATCH', 'NO HAY GENTE', 'BORRADOR', 'PENDIENTE')
                      AND COALESCE(TRIM(o.person_b), '') = '')
          AND NOT EXISTS (SELECT 1 FROM operational_matches x WHERE x.user_id_a = u.id AND UPPER(COALESCE(x.status, '')) IN ('REFUND', 'REFUND DONE', 'DESCALIFICADO', 'INACTIVO', 'ARCHIVADO', 'ENAMORADOS'))
        LIMIT :l
    """), {"a": user_id_a, "d": desde, "l": limite})).fetchall()
    return [r[0] for r in rows]


async def candidatas_nuevas_basicas(db, user_id_a: int, desde) -> List[Dict[str, Any]]:
    """Entrantes nuevos que pasan los filtros básicos con la persona `user_id_a`. Si no hay ninguna, el motor ni se consulta."""
    if getattr(desde, "tzinfo", None) is not None:
        desde = desde.astimezone(timezone.utc).replace(tzinfo=None)      # las columnas de fecha del sistema son sin zona (UTC)
    ids = await entrantes_nuevos(db, user_id_a, desde)
    if not ids:
        return []
    fichas = await _ficha(db, ids + [user_id_a])
    a = fichas.get(user_id_a)
    if not a:
        return []
    ya = {(r[0]) for r in (await db.execute(text("SELECT user_id_b FROM operational_matches WHERE user_id_a = :a AND user_id_b IS NOT NULL"), {"a": user_id_a})).fetchall()}
    out = []
    for uid in ids:
        b = fichas.get(uid)
        if b and uid not in ya and compatibles_basicos(a, b):
            out.append({"user_id": str(uid), "name": b["name"], "crm_id": b["crm_id"] or "", "city": b["city"] or "", "age": b["age"]})
    return out


# ---------------------------------------------------------------- revisión de una persona
REVISION_COMPLETA_DIAS = 7


def _jl(v) -> list:
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return []
    return v or []


async def revisar_persona(db, user_id_a: int, motor, forzar: bool = False, gastar_motor: bool = True) -> Dict[str, Any]:
    """Revisa a UNA persona en 'No hay gente' (todas sus filas comparten el resultado).
    `motor(user_id) -> lista de candidatas` es el motor de compatibilidad (caro). Devuelve qué se hizo y las candidatas nuevas.
      - primera vez: solo línea base (lo que el motor ya ve), sin avisos
      - luego: primero filtros básicos sobre gente NUEVA; sin candidatas básicas no se consulta el motor (salvo revisión completa semanal)."""
    filas = (await db.execute(text("""
        SELECT m.id, v.vistos, v.nuevos, v.ultima_revision FROM operational_matches m LEFT JOIN no_gente_vigilancia v ON v.match_id = m.id
        WHERE m.user_id_a = :u AND UPPER(COALESCE(m.status, '')) LIKE '%NO HAY GENTE%' AND COALESCE(TRIM(m.person_b), '') = ''
        ORDER BY m.id"""), {"u": user_id_a})).fetchall()
    if not filas:
        return {"accion": "sin_filas", "nuevos": []}
    base = filas[0]
    primera = base.vistos is None
    desde = base.ultima_revision
    vistos = set(map(str, _jl(base.vistos)))
    nuevos_prev = [x for x in _jl(base.nuevos)]
    accion, cands, motor_llamado = "sin_novedad", {}, False
    from datetime import datetime, timezone, timedelta
    vencida = (desde is None) or (datetime.now(timezone.utc) - desde > timedelta(days=REVISION_COMPLETA_DIAS))
    basicas: List[Dict[str, Any]] = []
    if not primera and desde is not None and not forzar:
        basicas = await candidatas_nuevas_basicas(db, user_id_a, desde)
    consultar = gastar_motor and (primera or forzar or vencida or bool(basicas))
    if consultar:
        for c in await motor(user_id_a):
            uid = c.get("user_id")
            if uid:
                cands[str(uid)] = {"user_id": str(uid), "name": c.get("name") or c.get("person_b") or "", "crm_id": c.get("crm_id") or "", "score": c.get("score")}
        motor_llamado = True
        accion = "baseline" if primera else "motor"
    if primera:
        nuevos = []
    else:
        conocidos = {str(x.get("user_id")) for x in nuevos_prev}
        agregados = [dict(c, detectado=datetime.now().strftime("%Y-%m-%d")) for u, c in cands.items() if u not in vistos and u not in conocidos]
        nuevos = list(nuevos_prev) + agregados
    vistos_nuevo = sorted(vistos | set(cands.keys())) if motor_llamado else sorted(vistos)
    hay = len(nuevos) > len(nuevos_prev)
    for f in filas:
        await db.execute(text("""
            INSERT INTO no_gente_vigilancia (match_id, user_id_a, vistos, nuevos, ultima_revision, detectado_en)
            VALUES (:m, :u, CAST(:v AS jsonb), CAST(:n AS jsonb), NOW(), CASE WHEN :h THEN NOW() ELSE NULL END)
            ON CONFLICT (match_id) DO UPDATE SET vistos = CAST(:v AS jsonb), nuevos = CAST(:n AS jsonb), ultima_revision = NOW(),
                detectado_en = CASE WHEN :h THEN NOW() ELSE no_gente_vigilancia.detectado_en END
        """), {"m": f.id, "u": str(user_id_a), "v": json.dumps(vistos_nuevo), "n": json.dumps(nuevos), "h": hay})
    await db.commit()
    return {"accion": accion, "motor_llamado": motor_llamado, "basicas": len(basicas), "nuevos": nuevos, "hay_nuevos": hay}


# ---------------------------------------------------------------- IA sobre las candidatas nuevas (con tope diario)
UMBRAL_MOTOR = 70          # solo se analiza con IA a quien el motor ya puntúa alto
CANDIDATAS_POR_PERSONA = 2
PUNTAJE_OCULTAR = 5.0      # si la IA da menos de 5/10 la candidata se oculta (queda en "ocultas por la IA")


async def analizar_nuevas_con_ia(db, user_id_a: int, presupuesto: int) -> Dict[str, Any]:
    """Para UNA persona: toma sus candidatas nuevas aún sin análisis, las más altas del motor (máx. 2), y las analiza con la IA.
    Gasta como mucho `presupuesto` análisis. Devuelve cuántos se hicieron."""
    from app.services.analisis_pareja import analizar_par_usuarios
    filas = (await db.execute(text("SELECT match_id, nuevos FROM no_gente_vigilancia WHERE user_id_a = :u ORDER BY match_id"), {"u": str(user_id_a)})).fetchall()
    if not filas or presupuesto <= 0:
        return {"analizadas": 0}
    nuevos = [x for x in _jl(filas[0].nuevos)]
    pend = [c for c in nuevos if "ia" not in c and (c.get("score") is None or float(c.get("score") or 0) >= UMBRAL_MOTOR)]
    pend.sort(key=lambda c: -(float(c.get("score") or 0)))
    hechas = 0
    for c in pend[:min(CANDIDATAS_POR_PERSONA, presupuesto)]:
        try:
            r = await analizar_par_usuarios(db, user_id_a, int(c["user_id"]))
        except Exception as e:
            c["ia_error"] = str(e)[:120]
            continue
        c["ia"] = {"puntaje": r.get("puntaje"), "veredicto": r.get("veredicto"), "resumen": (r.get("resumen") or "")[:600], "vetos": r.get("vetos") or [], "generado_en": r.get("generado_en")}
        c["ocultar_por_ia"] = bool(r.get("puntaje") is not None and r["puntaje"] < PUNTAJE_OCULTAR)
        hechas += 1
    if hechas or any("ia_error" in c for c in nuevos):
        for f in filas:
            await db.execute(text("UPDATE no_gente_vigilancia SET nuevos = CAST(:n AS jsonb) WHERE match_id = :m"), {"n": json.dumps(nuevos), "m": f.match_id})
        await db.commit()
    return {"analizadas": hechas}
