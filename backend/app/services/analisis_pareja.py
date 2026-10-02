"""Analisis con IA de una pareja (Persona A + Persona B) con el metodo de María.

Arma el contexto con los datos del CRM, las notas (bio, red flags, perfil clinico, entrevistas) y el historial de matches,
llama a Gemini y guarda el resultado en match_ia_analysis (un analisis por match). Las instrucciones viven en
backend/app/data/prompt_analisis_pareja.md para poder editarlas sin tocar codigo.
"""
import asyncio
import hashlib
from datetime import datetime
import json
import os
import re
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from sqlalchemy import text

# Modelos en orden de preferencia: si uno devuelve 429 (sin cuota) o 404 (retirado) se prueba el siguiente
MODELOS = [m.strip() for m in os.environ.get("ANALISIS_MODEL", "gemini-3.8-flash,gemini-2.5-flash").split(",") if m.strip()]
MODEL = MODELOS[0]
NVIDIA_TIMEOUT = 170
# NVIDIA (API compatible con OpenAI): modelos en orden de preferencia; la clave va en ANALISIS_NVIDIA_API_KEY del .env
NVIDIA_MODELOS = [m.strip() for m in os.environ.get("ANALISIS_MODEL_NVIDIA", "moonshotai/kimi-k3,nvidia/nemotron-3-super-120b-a12b").split(",") if m.strip()]
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
    raw: Dict[str, Any] = {}
    cid = int(str(crm_id)) if str(crm_id or "").strip().isdigit() else None
    if cid is not None:
        for r in (await db.execute(text("SELECT field_id, label, value FROM crm_profile_fields WHERE crm_id = :c ORDER BY field_id"), {"c": cid})).fetchall():
            v_raw = r.value
            if isinstance(v_raw, str):
                try:
                    v_raw = json.loads(v_raw)
                except Exception:
                    pass
            raw[r.field_id] = v_raw
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
                notas["notas_rapidas_psicologa"] = _limpio(p.bio_notes, 7000)
            if p.difficult_notes:
                notas["notas_dificiles"] = _limpio(p.difficult_notes, 800)
            if p.clinical_profile_360:
                notas["perfil_clinico_360"] = _limpio(json.dumps(p.clinical_profile_360, ensure_ascii=False) if not isinstance(p.clinical_profile_360, str) else p.clinical_profile_360, 3000)
            notas["ficha_basica"] = f"edad {p.age or 'SIN DATO'}, ciudad {p.city or 'SIN DATO'}, genero {p.gender or 'SIN DATO'}"
            try:
                cl = p.clinical_profile_360 if isinstance(p.clinical_profile_360, dict) else json.loads(p.clinical_profile_360 or "{}")
                raw["_cl_city"] = str((cl.get("metadata") or {}).get("city") or "")
                raw["_cl_estado"] = str((cl.get("metadata") or {}).get("availability_status") or "")
                raw["_cl_politica"] = str((((cl.get("ejes") or {}).get("3_axiologia")) or {}).get("postura_politica") or "")
            except Exception:
                pass
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
        ABIERTOS = ("HECHO", "APROBADO", "PENDIENTE APROBACIÓN MARÍA", "AGENDADO", "CITA PROGRAMADA", "EN REVISION", "PROPUESTO", "APROBADO POR PSICÓLOGAS")
        raw["_abiertas"] = [f"{r.otra} ({r.status})" for r in rows if (r.otra or "").strip() and str(r.status or "").upper().strip() in ABIERTOS]
    return {"nombre": nombre, "campos_crm": campos, "notas": notas, "historial_matches": hist, "_raw": raw}



def _lab(v: Any) -> str:
    if isinstance(v, dict):
        return str(v.get("choice_label") or "")
    if isinstance(v, list):
        return ", ".join(str(e.get("label") or e.get("choice_label") or "") for e in v if isinstance(e, dict))
    return str(v or "")


def _norm(t: str) -> str:
    return re.sub(r"[^a-z]", "", (t or "").lower().replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u"))


def _ciudad(raw: Dict[str, Any]) -> str:
    v = raw.get("prof_191")
    return str(v.get("city") or "") if isinstance(v, dict) else ""


def _chequeos(na: str, ra: Dict[str, Any], nb: str, rb: Dict[str, Any]) -> List[str]:
    """Hechos calculados por el sistema (no por la IA): rangos de edad y estatura, ciudad, hijos, fumar, religion, politica, social group."""
    out: List[str] = []

    def edad(r):
        try:
            return int(r.get("prof_247"))
        except (TypeError, ValueError):
            return None

    ea, eb = edad(ra), edad(rb)
    for (n1, r1, e1), (n2, r2, e2) in (((na, ra, ea), (nb, rb, eb)), ((nb, rb, eb), (na, ra, ea))):
        rg = r1.get("pref_68")
        if isinstance(rg, dict) and (rg.get("start") or rg.get("end")):
            a, b = rg.get("start"), rg.get("end")
            txt = f"{n1} pide edad {a or '?'} a {b or '?'}"
            if e2 is None:
                out.append(f"EDAD: {txt}; {n2} no tiene edad en la ficha (ERROR DE FICHA)")
            elif (a and e2 < a) or (b and e2 > b):
                dif = (a - e2) if (a and e2 < a) else (e2 - b)
                out.append(f"EDAD: {txt}; {n2} tiene {e2}: FUERA DEL RANGO por {dif} años (veto explícito)")
            else:
                out.append(f"EDAD: {txt}; {n2} tiene {e2}: cumple")
        else:
            out.append(f"EDAD: {n1} no tiene rango de edad en sus preferencias (vacío)")
    if ea and eb:
        out.append(f"DIFERENCIA DE EDAD: {abs(ea - eb)} años ({na} {ea}, {nb} {eb})")

    def mm(v):
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    for (n1, r1), (n2, r2) in (((na, ra), (nb, rb)), ((nb, rb), (na, ra))):
        rg, h = r1.get("pref_70"), mm(r2.get("prof_203"))
        if isinstance(rg, dict) and (rg.get("start") or rg.get("end")) and h:
            a, b = rg.get("start"), rg.get("end")
            ok = not ((a and h < a) or (b and h > b))
            out.append(f"ESTATURA: {n1} pide {('desde %.2f m' % (a / 1000)) if a else ''}{(' hasta %.2f m' % (b / 1000)) if b else ''}; {n2} mide {h / 1000:.2f} m: {'cumple' if ok else 'NO cumple'}")
        elif h:
            out.append(f"ESTATURA: {n2} mide {h / 1000:.2f} m ({n1} no define preferencia)")
        if h and (h < 1400 or h > 2200):
            out.append(f"ALERTA DE FICHA: estatura imposible de {n2} ({h / 1000:.2f} m)")

    ca, cb = _ciudad(ra), _ciudad(rb)
    if ca and cb:
        out.append(f"CIUDAD (según el CRM): {na} en {ca}, {nb} en {cb}: {'misma ciudad' if _norm(ca.split(',')[0]) == _norm(cb.split(',')[0]) else 'CIUDADES DISTINTAS'}")
    else:
        out.append(f"CIUDAD: falta en la ficha de {na if not ca else nb}")

    for (n1, r1), (n2, r2) in (((na, ra), (nb, rb)), ((nb, rb), (na, ra))):
        g_pref, g_otro = _lab(r1.get("pref_54")), _lab(r2.get("prof_192"))
        if g_pref and g_otro:
            out.append(f"GÉNERO: {n1} busca {g_pref}; {n2} es {g_otro}: {'cumple' if _norm(g_pref) == _norm(g_otro) else 'NO cumple'}")

    for n, r in ((na, ra), (nb, rb)):
        out.append(f"HIJOS: {n} tiene hijos: {_lab(r.get('prof_201')) or 'sin dato'}; quiere hijos: {_lab(r.get('prof_202')) or 'sin dato'}")
        out.append(f"HÁBITOS: {n} fuma: {_lab(r.get('prof_208')) or 'sin dato'}; alcohol: {_lab(r.get('prof_209')) or 'sin dato'}")
        out.append(f"CREENCIAS: {n} religión {_lab(r.get('prof_197')) or 'sin dato'}; política {_lab(r.get('prof_226')) or 'sin dato'}")
        out.append(f"LÍMITES ESCRITOS POR {n}: {r.get('prof_242') or 'ninguno'} | RED FLAGS: {r.get('prof_243') or 'ninguna'}")

    def _pol(t: str) -> str:
        t = _norm(t)
        return "derecha" if "right" in t or "derecha" in t else ("izquierda" if "left" in t or "izquierda" in t else ("centro" if "center" in t or "centro" in t or "apolitic" in t else ""))

    for n, r in ((na, ra), (nb, rb)):
        c_crm, c_cl = _ciudad(r), r.get("_cl_city", "")
        if c_crm and c_cl and _norm(c_crm.split(",")[0]) != _norm(c_cl.split(",")[0]):
            out.append(f"DISCREPANCIA DE FICHA (ciudad): {n} figura en {c_crm} en el CRM pero su perfil clínico dice {c_cl}. Verificar dónde vive realmente")
        p_crm, p_cl = _pol(_lab(r.get("prof_226"))), _pol(r.get("_cl_politica", ""))
        if p_crm and p_cl and p_crm != p_cl:
            out.append(f"DISCREPANCIA DE FICHA (política): {n} es {_lab(r.get('prof_226'))} en el CRM pero su perfil clínico dice {r.get('_cl_politica')}. Verificar con sus notas")
        ab = r.get("_abiertas") or []
        out.append(f"INTROS ABIERTAS (sin contar esta): {n} tiene {len(ab)}" + (": " + "; ".join(ab[:6]) if ab else "") + (" (REGLA: con 2 o más no se propone)" if len(ab) >= 2 else ""))
        if r.get("_cl_estado") and r.get("_cl_estado").upper() != "ACTIVO":
            out.append(f"ESTADO: {n} figura como {r.get('_cl_estado')} (no activo)")

    sa, sb = _lab(ra.get("prof_248")), _lab(rb.get("prof_248"))
    if sa and sb:
        try:
            out.append(f"SOCIAL GROUP: {na} {sa}, {nb} {sb}: diferencia de {abs(int(sa) - int(sb))}")
        except ValueError:
            out.append(f"SOCIAL GROUP: {na} {sa}, {nb} {sb}")
    for (n1, r1), (n2, _r2), s2 in (((na, ra), (nb, rb), sb), ((nb, rb), (na, ra), sa)):
        pref = [x.strip() for x in _lab(r1.get("pref_69")).split(",") if x.strip()]
        if pref and s2:
            out.append(f"SOCIAL GROUP BUSCADO: {n1} busca {', '.join(pref)}; {n2} es {s2}: {'dentro de lo que busca' if s2 in pref else 'FUERA de lo que busca'}")
    return out


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
    chequeos_objetivos = _chequeos(a["nombre"], a.pop("_raw"), b["nombre"], b.pop("_raw"))
    return {
        "chequeos_objetivos": chequeos_objetivos,
        "match": {"ciudad_registrada": m.city, "plan": m.plan_tier, "estado": m.status, "psicologa": m.psychologist_name,
                  "nota_de_la_psicologa_sobre_esta_propuesta": _limpio(m.observations, 800)},
        "persona_a": a, "persona_b": b,
    }


def _llamar_gemini(prompt: str):
    """Devuelve (json, modelo_usado)."""
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("Falta GEMINI_API_KEY")
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"}}
    ultimo = ""
    for modelo in MODELOS:
        for intento in range(5):
            req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent",
                                         data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key})
            try:
                with urllib.request.urlopen(req, timeout=150) as r:
                    out = json.loads(r.read().decode())
            except urllib.error.HTTPError as e:
                ultimo = f"{modelo}: HTTP {e.code}"
                if e.code == 503 and intento < 4:      # alta demanda pasajera: reintenta con espera creciente
                    time.sleep(4 * (intento + 1))
                    continue
                if e.code in (404, 429, 503):
                    break                               # sin cuota / retirado / sigue saturado: siguiente modelo
                raise
            raw = "".join(p.get("text", "") for p in out["candidates"][0]["content"]["parts"])
            raw = re.sub(r"^```(json)?|```$", "", raw.strip()).strip()
            return json.loads(raw), modelo
    raise RuntimeError(f"Ningún modelo de IA disponible ({ultimo}). Revisa la cuota de la clave de Gemini.")


def _llamar_nvidia(prompt: str, modelo: str) -> Dict[str, Any]:
    key = (os.environ.get("ANALISIS_NVIDIA_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("falta ANALISIS_NVIDIA_API_KEY")
    body = {"model": modelo, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3, "max_tokens": 5000}
    req = urllib.request.Request("https://integrate.api.nvidia.com/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=NVIDIA_TIMEOUT) as r:
        out = json.loads(r.read().decode())
    txt = out["choices"][0]["message"].get("content") or ""
    txt = re.sub(r"<think>.*?</think>", "", txt, flags=re.S)
    txt = re.sub(r"```(?:json)?", "", txt)
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        raise ValueError("la respuesta no trae JSON")
    return json.loads(m.group(0))


def _llamar_ia(prompt: str):
    """Prueba los modelos de NVIDIA y, si ninguno responde, Gemini. Devuelve (json, modelo_usado)."""
    errores: List[str] = []
    if (os.environ.get("ANALISIS_NVIDIA_API_KEY") or "").strip():
        for modelo in NVIDIA_MODELOS:
            for intento in range(2):      # a veces el modelo devuelve la respuesta sin JSON: se reintenta una vez
                try:
                    return _llamar_nvidia(prompt, modelo), "nvidia/" + modelo
                except ValueError as e:
                    errores.append(f"{modelo}: {str(e)[:60]}")
                    continue
                except Exception as e:
                    errores.append(f"{modelo}: {str(e)[:60]}")
                    break
    try:
        return _llamar_gemini(prompt)
    except Exception as e:
        errores.append(f"gemini: {str(e)[:80]}")
    raise RuntimeError("Ningún modelo de IA disponible (" + " | ".join(errores) + ")")


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
    crudo, modelo_usado = await asyncio.to_thread(_llamar_ia, prompt)
    res = _validar(crudo)
    await db.execute(text("""
        INSERT INTO match_ia_analysis (match_id, analisis, modelo, entrada_hash, creado_en)
        VALUES (:m, CAST(:a AS jsonb), :mo, :h, NOW())
        ON CONFLICT (match_id) DO UPDATE SET analisis = CAST(:a AS jsonb), modelo = :mo, entrada_hash = :h, creado_en = NOW()
    """), {"m": match_id, "a": json.dumps(res, ensure_ascii=False), "mo": modelo_usado, "h": h})
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


# ---------------------------------------------------------------- analisis de una pareja de PERSONAS (sin fila de match): candidatas nuevas de 'No hay gente'
async def analizar_par_usuarios(db, user_a: int, user_b: int, regenerar: bool = False) -> Dict[str, Any]:
    """Mismo método de María que `analizar_par`, pero para dos personas que todavía no son un match propuesto. Se guarda aparte (match_ia_analysis_pares)."""
    await db.execute(text("""CREATE TABLE IF NOT EXISTS match_ia_analysis_pares (
        user_a BIGINT NOT NULL, user_b BIGINT NOT NULL, analisis JSONB NOT NULL, modelo TEXT, entrada_hash TEXT, creado_en TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (user_a, user_b))"""))
    ua = (await db.execute(text("SELECT id, name, crm_id FROM users WHERE id = :u"), {"u": user_a})).fetchone()
    ub = (await db.execute(text("SELECT id, name, crm_id FROM users WHERE id = :u"), {"u": user_b})).fetchone()
    if not ua or not ub:
        raise LookupError("persona no encontrada")
    fa = (await db.execute(text("SELECT city, plan_tier FROM profiles WHERE user_id = :u"), {"u": user_a})).fetchone()
    a = await _persona(db, ua.name, user_a, ua.crm_id, 0)
    b = await _persona(db, ub.name, user_b, ub.crm_id, 0)
    chequeos_objetivos = _chequeos(a["nombre"], a.pop("_raw"), b["nombre"], b.pop("_raw"))
    ctx = {
        "chequeos_objetivos": chequeos_objetivos,
        "match": {"ciudad_registrada": fa.city if fa else None, "plan": fa.plan_tier if fa else None, "estado": "CANDIDATA NUEVA (todavia no propuesta)", "psicologa": None,
                  "nota_de_la_psicologa_sobre_esta_propuesta": ""},
        "persona_a": a, "persona_b": b,
    }
    entrada = json.dumps(ctx, ensure_ascii=False, sort_keys=True)
    h = hashlib.sha1((entrada + MODEL).encode()).hexdigest()
    if not regenerar:
        c = (await db.execute(text("SELECT analisis, creado_en, modelo, entrada_hash FROM match_ia_analysis_pares WHERE user_a = :a AND user_b = :b"), {"a": user_a, "b": user_b})).fetchone()
        if c and c.entrada_hash == h:
            an = c.analisis if isinstance(c.analisis, dict) else json.loads(c.analisis)
            return {**an, "generado_en": c.creado_en.strftime("%Y-%m-%d %H:%M") if c.creado_en else "", "modelo": c.modelo, "cache": True}
    with open(PROMPT_PATH, encoding="utf-8") as f:
        instrucciones = f.read()
    prompt = instrucciones + "\n\n## Datos de la pareja a evaluar\n\n" + entrada + "\n\nDevuelve solo el JSON del formato de salida."
    crudo, modelo_usado = await asyncio.to_thread(_llamar_ia, prompt)
    res = _validar(crudo)
    await db.execute(text("""
        INSERT INTO match_ia_analysis_pares (user_a, user_b, analisis, modelo, entrada_hash, creado_en) VALUES (:a, :b, CAST(:an AS jsonb), :mo, :h, NOW())
        ON CONFLICT (user_a, user_b) DO UPDATE SET analisis = CAST(:an AS jsonb), modelo = :mo, entrada_hash = :h, creado_en = NOW()
    """), {"a": user_a, "b": user_b, "an": json.dumps(res, ensure_ascii=False), "mo": modelo_usado, "h": h})
    await db.commit()
    return {**res, "generado_en": datetime.now().strftime("%Y-%m-%d %H:%M"), "modelo": modelo_usado, "cache": False}
