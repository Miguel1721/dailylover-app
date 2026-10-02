"""Analisis con IA de una pareja (Persona A + Persona B) con el metodo de María.

Arma el contexto con los datos del CRM, las notas (bio, red flags, perfil clinico, entrevistas) y el historial de matches,
llama a Gemini y guarda el resultado en match_ia_analysis (un analisis por match). Las instrucciones viven en
backend/app/data/prompt_analisis_pareja.md para poder editarlas sin tocar codigo.
"""
import asyncio
import hashlib
import json
import os
import re
import urllib.request
from typing import Any, Dict, List, Optional

from sqlalchemy import text

MODEL = os.environ.get("ANALISIS_MODEL", "gemini-2.5-flash")
PROMPT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "prompt_analisis_pareja.md")

# Campos del CRM que no se envian a la IA (contacto, foto, redes)
OMITIR = {"prof_180", "prof_190", "prof_212", "prof_187", "prof_188", "prof_189", "prof_194"}
VEREDICTOS = ("PROPONER", "PROPONER SI SE CONFIRMA", "CONFIRMAR FOTO", "NO PROPONER", "SIN MATCH VIABLE")

_TEL = re.compile(r"\+?\d[\d\s().\-]{7,}\d")
_MAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def _limpio(t: Any, n: int = 1500) -> str:
    t = str(t or "").replace("\xa0", " ")
    t = _MAIL.sub("[correo omitido]", _TEL.sub("[telefono omitido]", t))
    return t.strip()[:n]


def _fmt(field_id: str, v: Any) -> str:
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except Exception:
            pass
    if field_id == "prof_203" and isinstance(v, (int, float)):
        return f"{v / 1000:.2f} m".replace(".", ",")
    if isinstance(v, dict):
        if "choice_label" in v:
            return str(v["choice_label"])
        if "start" in v or "end" in v:
            a, b = v.get("start"), v.get("end")
            if field_id == "pref_70":
                a = f"{a / 1000:.2f} m" if a else None
                b = f"{b / 1000:.2f} m" if b else None
            if a and b:
                return f"de {a} a {b}"
            return f"desde {a}" if a else (f"hasta {b}" if b else "")
        if "city" in v:
            return ", ".join(str(v.get(k)) for k in ("city", "state", "country") if v.get(k))
        return ""
    if isinstance(v, list):
        return ", ".join(str(e.get("label") or e.get("choice_label") or e.get("choice")) for e in v if isinstance(e, dict))
    if v is None:
        return ""
    return str(v)


async def _persona(db, nombre: str, user_id: Optional[int], crm_id: Any, match_id: int) -> Dict[str, Any]:
    campos: List[str] = []
    cid = int(str(crm_id)) if str(crm_id or "").strip().isdigit() else None
    if cid is not None:
        for r in (await db.execute(text("SELECT field_id, label, value FROM crm_profile_fields WHERE crm_id = :c ORDER BY field_id"), {"c": cid})).fetchall():
            if r.field_id in OMITIR:
                continue
            t = _fmt(r.field_id, r.value)
            if t.strip():
                campos.append(f"{r.label}: {_limpio(t, 600)}")
    notas: Dict[str, str] = {}
    hist: List[str] = []
    if user_id:
        p = (await db.execute(text("SELECT bio_notes, difficult_notes, clinical_profile_360, city, age, gender FROM profiles WHERE user_id = :u"), {"u": user_id})).fetchone()
        if p:
            if p.bio_notes:
                notas["notas_rapidas_psicologa"] = _limpio(p.bio_notes, 2500)
            if p.difficult_notes:
                notas["notas_dificiles"] = _limpio(p.difficult_notes, 800)
            if p.clinical_profile_360:
                notas["perfil_clinico_360"] = _limpio(json.dumps(p.clinical_profile_360, ensure_ascii=False) if not isinstance(p.clinical_profile_360, str) else p.clinical_profile_360, 3000)
            notas["ficha_basica"] = f"edad {p.age or 'SIN DATO'}, ciudad {p.city or 'SIN DATO'}, genero {p.gender or 'SIN DATO'}"
        try:
            e = (await db.execute(text("SELECT flags_notes, physical_traits_notes FROM client_extended_profile WHERE user_id = :u"), {"u": user_id})).fetchone()
            if e:
                if e.flags_notes:
                    notas["flags_ficha_extendida"] = _limpio(e.flags_notes, 600)
                if e.physical_traits_notes:
                    notas["rasgos_fisicos"] = _limpio(e.physical_traits_notes, 600)
        except Exception:
            await db.rollback()
        i = (await db.execute(text("SELECT quick_notes_ai, dealbreakers_ai, notes FROM interview_appointments WHERE user_id = :u AND (quick_notes_ai IS NOT NULL OR dealbreakers_ai IS NOT NULL) ORDER BY id DESC LIMIT 1"), {"u": user_id})).fetchone()
        if i:
            if i.quick_notes_ai:
                notas["quick_notes_entrevista"] = _limpio(i.quick_notes_ai if isinstance(i.quick_notes_ai, str) else json.dumps(i.quick_notes_ai, ensure_ascii=False), 1500)
            if i.dealbreakers_ai:
                notas["dealbreakers_entrevista"] = _limpio(i.dealbreakers_ai if isinstance(i.dealbreakers_ai, str) else json.dumps(i.dealbreakers_ai, ensure_ascii=False), 800)
        rows = (await db.execute(text("""
            SELECT CASE WHEN user_id_a = :u THEN person_b ELSE person_a END AS otra, status, left(COALESCE(observations, ''), 140) AS obs
            FROM operational_matches WHERE (user_id_a = :u OR user_id_b = :u) AND id <> :m ORDER BY id DESC LIMIT 10
        """), {"u": user_id, "m": match_id})).fetchall()
        hist = [f"{(r.otra or '(sin candidata)')} | {r.status} | {_limpio(r.obs, 140)}" for r in rows]
    return {"nombre": nombre, "campos_crm": campos, "notas": notas, "historial_matches": hist}


async def construir_contexto(db, match_id: int) -> Dict[str, Any]:
    m = (await db.execute(text("""
        SELECT id, person_a, person_b, user_id_a, user_id_b, person_a_crm_id, person_b_crm_id, city, plan_tier, status, observations, psychologist_name
        FROM operational_matches WHERE id = :m"""), {"m": match_id})).fetchone()
    if not m:
        raise LookupError("match no encontrado")
    if not (m.person_b or "").strip():
        raise ValueError("el match no tiene Persona B")
    a = await _persona(db, m.person_a, m.user_id_a, m.person_a_crm_id, match_id)
    b = await _persona(db, m.person_b, m.user_id_b, m.person_b_crm_id, match_id)
    return {
        "match": {"ciudad_registrada": m.city, "plan": m.plan_tier, "estado": m.status, "psicologa": m.psychologist_name,
                  "nota_de_la_psicologa_sobre_esta_propuesta": _limpio(m.observations, 800)},
        "persona_a": a, "persona_b": b,
    }


def _llamar_ia(prompt: str) -> Dict[str, Any]:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("Falta GEMINI_API_KEY")
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"}}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
                                 data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key})
    with urllib.request.urlopen(req, timeout=150) as r:
        out = json.loads(r.read().decode())
    raw = "".join(p.get("text", "") for p in out["candidates"][0]["content"]["parts"])
    raw = re.sub(r"^```(json)?|```$", "", raw.strip()).strip()
    return json.loads(raw)


def _lista(v: Any) -> List[str]:
    return [str(x).strip() for x in v if str(x).strip()][:7] if isinstance(v, list) else []


def _validar(d: Dict[str, Any]) -> Dict[str, Any]:
    try:
        puntaje = float(d.get("puntaje"))
    except (TypeError, ValueError):
        raise ValueError("la IA no devolvio puntaje")
    puntaje = max(1.0, min(10.0, round(puntaje, 1)))
    confirmar = bool(d.get("confirmar_foto"))
    vetos = _lista(d.get("vetos"))
    if confirmar:
        puntaje = min(puntaje, 7.0)
    if vetos:
        puntaje = min(puntaje, 5.0)
    ver = str(d.get("veredicto") or "").upper().strip()
    if ver not in VEREDICTOS:
        ver = "NO PROPONER" if puntaje < 6 else ("PROPONER SI SE CONFIRMA" if puntaje < 8 else "PROPONER")
    return {
        "puntaje": puntaje, "veredicto": ver, "resumen": str(d.get("resumen") or "").strip(),
        "perfil_a": str(d.get("perfil_a") or "").strip(), "perfil_b": str(d.get("perfil_b") or "").strip(),
        "puntos_fuertes": _lista(d.get("puntos_fuertes")), "puntos_a_considerar": _lista(d.get("puntos_a_considerar")),
        "vetos": vetos, "preguntas_para_psicologa": _lista(d.get("preguntas_para_psicologa")),
        "condicion_para_subir_puntaje": str(d.get("condicion_para_subir_puntaje") or "").strip(),
        "recomendacion": str(d.get("recomendacion") or "").strip(), "alertas_ficha": _lista(d.get("alertas_ficha")),
        "confirmar_foto": confirmar, "flag_inventario": str(d.get("flag_inventario") or "").strip(),
    }


def _fila(r) -> Dict[str, Any]:
    a = r.analisis
    if isinstance(a, str):
        a = json.loads(a)
    return {**a, "match_id": r.match_id, "generado_en": r.creado_en.strftime("%Y-%m-%d %H:%M") if r.creado_en else "", "modelo": r.modelo}


async def analizar_par(db, match_id: int, regenerar: bool = False) -> Dict[str, Any]:
    ctx = await construir_contexto(db, match_id)
    entrada = json.dumps(ctx, ensure_ascii=False, sort_keys=True)
    h = hashlib.sha1((entrada + MODEL).encode()).hexdigest()
    if not regenerar:
        c = (await db.execute(text("SELECT match_id, analisis, creado_en, modelo, entrada_hash FROM match_ia_analysis WHERE match_id = :m"), {"m": match_id})).fetchone()
        if c and c.entrada_hash == h:
            return _fila(c)
    with open(PROMPT_PATH, encoding="utf-8") as f:
        instrucciones = f.read()
    prompt = instrucciones + "\n\n## Datos de la pareja a evaluar\n\n" + entrada + "\n\nDevuelve solo el JSON del formato de salida."
    crudo = await asyncio.to_thread(_llamar_ia, prompt)
    res = _validar(crudo)
    await db.execute(text("""
        INSERT INTO match_ia_analysis (match_id, analisis, modelo, entrada_hash, creado_en)
        VALUES (:m, CAST(:a AS jsonb), :mo, :h, NOW())
        ON CONFLICT (match_id) DO UPDATE SET analisis = CAST(:a AS jsonb), modelo = :mo, entrada_hash = :h, creado_en = NOW()
    """), {"m": match_id, "a": json.dumps(res, ensure_ascii=False), "mo": MODEL, "h": h})
    await db.commit()
    c = (await db.execute(text("SELECT match_id, analisis, creado_en, modelo FROM match_ia_analysis WHERE match_id = :m"), {"m": match_id})).fetchone()
    return _fila(c)


async def adjuntar_analisis(db, items: List[Dict[str, Any]]) -> None:
    """Agrega a cada item de la cola el analisis guardado (si existe) para mostrarlo sin volver a llamar a la IA."""
    ids = [it.get("id") for it in items if it.get("id")]
    for it in items:
        it["analisis_ia"] = None
    if not ids:
        return
    try:
        por_id = {r.match_id: _fila(r) for r in (await db.execute(text("SELECT match_id, analisis, creado_en, modelo FROM match_ia_analysis WHERE match_id = ANY(:i)"), {"i": ids})).fetchall()}
    except Exception:
        await db.rollback()
        return
    for it in items:
        it["analisis_ia"] = por_id.get(it.get("id"))
