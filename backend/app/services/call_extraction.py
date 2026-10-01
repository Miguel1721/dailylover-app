"""Extracción de datos del perfil a partir de la transcripción de la entrevista.

Regla de oro: la IA propone con evidencia; una persona aprueba; nada se inventa.
- Cada propuesta trae la frase LITERAL de la cliente que la respalda y el minuto.
- El sistema verifica que esa frase aparezca de verdad en lo que dijo la cliente; si no, la descarta.
- Valores fuera del catálogo (opción no permitida, escala fuera de 1-10) se descartan.
- Nada entra al perfil hasta que la psicóloga lo aprueba (o lo edita). Se guarda quién y cuándo.
"""
import asyncio
import json
import logging
import os
import re
import unicodedata
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

MODEL = os.environ.get("EXTRACTION_MODEL", "gemini-2.5-flash")
CATALOGO = json.loads((Path(__file__).resolve().parent.parent / "data" / "catalogo_campos.json").read_text(encoding="utf-8"))
CAMPOS = {c["key"]: c for c in CATALOGO["campos"]}
# Campos que dependen de la observación de la psicóloga: la IA solo sugiere.
OBSERVACION = {"punctuality", "presentation_camera", "presentation_style", "presentation_background", "speaking_confidence",
               "conversation_lead", "behavioral_risk_level", "physical_traits_notes", "physical_complexion"}

# Campos que describen a la cliente misma (no lo que busca en una pareja).
SOBRE_ELLA = {"has_children", "smoker", "drinks_alcohol", "has_pets", "pet_allergies", "housing_status", "fitness_level",
              "work_style", "financial_vibe", "income_range", "rumba", "sociability", "energy_level", "therapy",
              "physical_activity_level", "education_level", "religion_importance", "months_single"}

_ready = False


async def ensure_proposal_tables(db: AsyncSession) -> None:
    global _ready
    if _ready:
        return
    await db.execute(text("ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS user_id INT"))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS profile_field_proposals (
            id SERIAL PRIMARY KEY, session_id INT NOT NULL, user_id INT, campo TEXT NOT NULL, etiqueta TEXT, destino TEXT,
            valor JSONB, cita TEXT, minuto TEXT, confianza TEXT, solo_sugerencia BOOLEAN DEFAULT FALSE,
            valor_actual TEXT, conflicto BOOLEAN DEFAULT FALSE,
            estado TEXT NOT NULL DEFAULT 'PROPUESTA', valor_final JSONB, revisado_por TEXT, revisado_at TIMESTAMPTZ,
            modelo TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (session_id, campo)
        )"""))
    await db.commit()
    _ready = True


def _norm(s: Any) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _catalogo_para_prompt() -> str:
    lineas = []
    for c in CATALOGO["campos"]:
        t = c["type"]
        if c.get("allowed"):
            t += " opciones=" + json.dumps(c["allowed"], ensure_ascii=False)
        if c.get("anchors"):
            t += " escala=" + json.dumps(c["anchors"], ensure_ascii=False)
        lineas.append(f"- {c['key']}: {c['label']} [{t}]")
    return "\n".join(lineas)


PROMPT = """Eres asistente de una psicóloga de Daily Lover (matchmaking). Lee la transcripción de una entrevista y propone
valores SOLO para los campos de los que la CLIENTE habló claramente.

Reglas obligatorias:
1. Si el tema no se habló, NO propongas nada para ese campo. No adivines, no completes, no uses valores por defecto.
2. Cada propuesta lleva "cita": una frase COPIADA LITERALMENTE de lo que dijo la Cliente (no de la Psicóloga), y "minuto" (mm:ss).
3. Para campos con opciones, el valor debe ser EXACTAMENTE una de las opciones (o una lista de ellas si el tipo es list).
4. Escalas 1-10: sé conservador. No uses los extremos (1-2 o 9-10) salvo que la cliente lo diga de forma explícita
   (p. ej. "tengo doctorado" = 10; "soy arquitecta" = profesional universitaria, alrededor de 7). Si solo hay un indicio, confianza "media".
5. Para campos de lista o de varios elementos (no negociables, banderas rojas, intereses), incluye TODOS los elementos que la cliente
   mencionó, no solo uno, y usa una cita por cada elemento separándolas con " | ".
6. No deduzcas un estilo o rasgo general a partir de una sola actividad (p. ej. un almuerzo familiar no define su fin de semana).
7. No confundas lo que la cliente BUSCA o RECHAZA en una pareja con cómo es ELLA. "No soporto que fume" es un no negociable
   sobre la pareja; NO dice si ella fuma. Los campos de la cliente (fuma, bebe, hijos propios…) solo con lo que dijo de sí misma.
9. Datos sensibles (ingresos, salud, orientación, religión, política) solo si la cliente los dijo voluntariamente.
10. "confianza": "alta" si lo dijo explícitamente, "media" si se deduce directamente de lo que dijo.

Campos:
{catalogo}

Devuelve SOLO JSON: {{"propuestas": [{{"campo": "...", "valor": ..., "cita": "...", "minuto": "mm:ss", "confianza": "alta|media"}}]}}

Transcripción:
{transcripcion}
"""


def _llamar_ia(prompt: str) -> List[Dict[str, Any]]:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("Falta GEMINI_API_KEY")
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
                                 data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key})
    with urllib.request.urlopen(req, timeout=300) as r:
        out = json.loads(r.read().decode())
    raw = "".join(p.get("text", "") for p in out["candidates"][0]["content"]["parts"])
    raw = re.sub(r"^```(json)?|```$", "", raw.strip()).strip()
    return json.loads(raw).get("propuestas", [])


def _validar(p: Dict[str, Any], dicho_cliente: str) -> Tuple[Optional[Any], str]:
    """Devuelve (valor válido, motivo de descarte)."""
    c = CAMPOS.get(str(p.get("campo")))
    if not c:
        return None, "campo fuera del catálogo"
    citas = [c for c in str(p.get("cita") or "").split("|") if c.strip()]
    if not citas or any(len(_norm(c)) < 4 or _norm(c) not in dicho_cliente for c in citas):
        return None, "la cita no aparece en lo que dijo la cliente"
    # Campos sobre la PROPIA cliente: si la cita habla de la pareja ("que fume…", "mi pareja…"), no sirve como evidencia.
    if c["key"] in SOBRE_ELLA and any(_norm(x).startswith(("que ", "y que ")) or " pareja" in " " + _norm(x) for x in citas):
        return None, "la cita habla de la pareja, no de ella"
    v, t = p.get("valor"), c["type"]
    if v in (None, "", []):
        return None, "sin valor"
    if t == "enum":
        ok = [a for a in c.get("allowed", []) if _norm(a) == _norm(v)]
        return (ok[0], "") if ok else (None, "opción no permitida")
    if t == "list":
        vals = v if isinstance(v, list) else [v]
        ok = [a for a in c.get("allowed", []) if any(_norm(a) == _norm(x) for x in vals)]
        return (ok, "") if ok else (None, "opciones no permitidas")
    if t in ("scale_1_10", "decimal_1_10"):
        try:
            n = float(v)
        except (TypeError, ValueError):
            return None, "escala inválida"
        return ((round(n, 1) if t == "decimal_1_10" else int(round(n))), "") if 1 <= n <= 10 else (None, "escala fuera de 1-10")
    if t == "int":
        try:
            n = int(float(v))
        except (TypeError, ValueError):
            return None, "número inválido"
        lo, hi = c.get("min", 0), c.get("max", 999)
        return (n, "") if lo <= n <= hi else (None, "número fuera de rango")
    if t == "list_text":
        vals = v if isinstance(v, list) else [x for x in re.split(r"\s*[|;]\s*", str(v)) if x.strip()]
        vals = [str(x).strip()[:200] for x in vals if str(x).strip()]
        return (vals, "") if vals else (None, "lista vacía")
    if t == "bool":
        return (bool(v) if isinstance(v, bool) else _norm(v) in ("si", "true", "yes")), ""
    s = str(v).strip()
    return (s[: c.get("max_chars", 500)], "") if s else (None, "texto vacío")


async def _valor_actual(db: AsyncSession, user_id: Optional[int], destino: str) -> str:
    if not user_id:
        return ""
    partes = destino.split(".")
    try:
        if partes[0] == "client_extended_profile":
            v = (await db.execute(text(f"SELECT {partes[1]}::text FROM client_extended_profile WHERE user_id = :u"), {"u": user_id})).scalar()
        elif partes[0] == "profiles" and len(partes) == 3:
            v = (await db.execute(text(f"SELECT {partes[1]}->>:k FROM profiles WHERE user_id = :u"), {"k": partes[2], "u": user_id})).scalar()
        else:
            v = (await db.execute(text(f"SELECT {partes[1]}::text FROM profiles WHERE user_id = :u"), {"u": user_id})).scalar()
    except Exception:
        await db.rollback()
        return ""
    return "" if v in (None, "5") and partes[0] == "client_extended_profile" and destino.endswith(("_level", "_importance")) else (v or "")


async def extract_session(db: AsyncSession, session_id: int) -> Dict[str, Any]:
    await ensure_proposal_tables(db)
    tr = (await db.execute(text("SELECT segments FROM call_transcripts WHERE session_id = :s AND status = 'LISTA'"), {"s": session_id})).scalar()
    if not tr:
        raise RuntimeError("Primero hay que transcribir la llamada.")
    user_id = (await db.execute(text("SELECT user_id FROM call_sessions WHERE id = :s"), {"s": session_id})).scalar()
    lineas = [f"[{int(s['inicio'] // 60):02d}:{int(s['inicio'] % 60):02d}] {'Psicóloga' if s['quien'] == 'PSICOLOGA' else 'Cliente'}: {s['texto']}" for s in tr]
    dicho_cliente = " ".join(_norm(s["texto"]) for s in tr if s["quien"] == "CLIENTE")
    propuestas = await asyncio.to_thread(_llamar_ia, PROMPT.format(catalogo=_catalogo_para_prompt(), transcripcion="\n".join(lineas)))
    guardadas, descartadas = 0, []
    for p in propuestas:
        valor, motivo = _validar(p, dicho_cliente)
        if valor is None:
            descartadas.append({"campo": p.get("campo"), "motivo": motivo})
            continue
        c = CAMPOS[p["campo"]]
        actual = await _valor_actual(db, user_id, c["target"])
        conflicto = bool(actual) and _norm(actual) != _norm(valor if not isinstance(valor, list) else ", ".join(valor))
        await db.execute(text("""
            INSERT INTO profile_field_proposals (session_id, user_id, campo, etiqueta, destino, valor, cita, minuto, confianza,
                solo_sugerencia, valor_actual, conflicto, modelo)
            VALUES (:s, :u, :c, :e, :d, CAST(:v AS jsonb), :ci, :mi, :co, :ss, :va, :cf, :mo)
            ON CONFLICT (session_id, campo) DO UPDATE SET valor = EXCLUDED.valor, cita = EXCLUDED.cita, minuto = EXCLUDED.minuto,
                confianza = EXCLUDED.confianza, valor_actual = EXCLUDED.valor_actual, conflicto = EXCLUDED.conflicto, modelo = EXCLUDED.modelo,
                estado = CASE WHEN profile_field_proposals.estado = 'PROPUESTA' THEN 'PROPUESTA' ELSE profile_field_proposals.estado END
        """), {"s": session_id, "u": user_id, "c": p["campo"], "e": c["label"], "d": c["target"], "v": json.dumps(valor, ensure_ascii=False),
               "ci": str(p.get("cita"))[:500], "mi": str(p.get("minuto") or "")[:8], "co": str(p.get("confianza") or "")[:10],
               "ss": p["campo"] in OBSERVACION, "va": str(actual)[:300], "cf": conflicto, "mo": MODEL})
        guardadas += 1
    await db.commit()
    return {"propuestas": guardadas, "descartadas": descartadas}


async def apply_proposal(db: AsyncSession, prop, valor: Any, actor: str) -> None:
    """Escribe en el perfil el valor aprobado y deja registro en profile_field_changes."""
    user_id = prop.user_id or (await db.execute(text("SELECT user_id FROM call_sessions WHERE id = :s"), {"s": prop.session_id})).scalar()
    if not user_id:
        raise RuntimeError("Asocia primero la llamada a un cliente del sistema.")
    partes = prop.destino.split(".")
    v_json = json.dumps(valor, ensure_ascii=False)
    if partes[0] == "client_extended_profile":
        col = partes[1]
        tipo = (await db.execute(text("SELECT data_type FROM information_schema.columns WHERE table_name = 'client_extended_profile' AND column_name = :c"), {"c": col})).scalar()
        if not tipo:
            raise RuntimeError(f"La columna {col} no existe en client_extended_profile")
        if tipo == "ARRAY":
            val = valor if isinstance(valor, list) else [valor]
        elif tipo == "jsonb":
            val = v_json
        else:
            val = ", ".join(valor) if isinstance(valor, list) else valor
        cast = "CAST(:v AS jsonb)" if tipo == "jsonb" else ":v"
        await db.execute(text(f"""INSERT INTO client_extended_profile (user_id, {col}, updated_at, updated_by) VALUES (:u, {cast}, NOW(), :a)
            ON CONFLICT (user_id) DO UPDATE SET {col} = EXCLUDED.{col}, updated_at = NOW(), updated_by = :a"""), {"u": user_id, "v": val, "a": actor})
    elif partes[0] == "profiles" and len(partes) == 3:
        await db.execute(text(f"""UPDATE profiles SET {partes[1]} = COALESCE({partes[1]}, '{{}}'::jsonb) || jsonb_build_object(CAST(:k AS text), CAST(:v AS jsonb)),
            updated_at = NOW() WHERE user_id = :u"""), {"k": partes[2], "v": v_json, "u": user_id})
    else:
        raise RuntimeError(f"Destino no soportado: {prop.destino}")
    await db.execute(text("""INSERT INTO profile_field_changes (user_id, target, old_value, new_value, source, kind)
        VALUES (:u, :t, :o, :n, :s, 'entrevista')"""), {"u": user_id, "t": prop.destino, "o": prop.valor_actual or "", "n": v_json[:2000], "s": f"llamada_{prop.session_id}:{actor}"})
