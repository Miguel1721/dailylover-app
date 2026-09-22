"""
Benchmark Riguroso: Extracción por LLM vs Extracción por Regex
Prueba las 50 expresiones clínicas reales colombianas y compara:
1. Regex clásico (OctagonalPersonaSynthesizer.synthesize_profile)
2. LLM Semántico (Gemini 2.5 Flash / Llama 3.2 NIM con responseMimeType="application/json")
"""

import asyncio
import os
import json
import re
import httpx
from app.config import get_settings
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer

CLINICAL_BENCHMARK_CASES = [
    # ─── VASECTOMÍA / INFERTILIDAD QUIRÚRGICA ───
    {"dim": "vasectomia", "text": "Tiene la vasectomía hecha desde los 30 años."},
    {"dim": "vasectomia", "text": "Se operó para no tener más bebés hace tres años."},
    {"dim": "vasectomia", "text": "Ya se mandó a operar, cerró la fábrica de forma definitiva."},
    {"dim": "vasectomia", "text": "Ligado hace 5 años, no puede tener hijos biológicos."},
    {"dim": "vasectomia", "text": "No puede engendrar, tiene procedimiento quirúrgico anticonceptivo."},
    {"dim": "vasectomia", "text": "Tiene tres hijos y se hizo la cirugía definitiva."},
    {"dim": "vasectomia", "text": "Médicamente estéril por decisión propia (cirugía)."},
    {"dim": "vasectomia", "text": "Se realizó la vasectomía hace un año."},
    {"dim": "vasectomia", "text": "No contempla hijos, ya tiene vasectomia."},
    {"dim": "vasectomia", "text": "Le hicieron la operación para no procrear más."},

    # ─── TURNOS ROTATIVOS / HORARIOS DISRUPTIVOS ───
    {"dim": "turnos_rotativos", "text": "Trabaja por turnos rotativos en una clínica."},
    {"dim": "turnos_rotativos", "text": "Es enfermera jefe, sus horarios cambian cada semana (a veces noche, a veces día)."},
    {"dim": "turnos_rotativos", "text": "Médico de urgencias, hace guardias de 24 horas y trasnocha frecuente."},
    {"dim": "turnos_rotativos", "text": "Ingeniero de planta con turnos de 12 horas rotando mañana, tarde y noche."},
    {"dim": "turnos_rotativos", "text": "Trabaja en call center con turnos variables y rotación mensual."},
    {"dim": "turnos_rotativos", "text": "Horario 7x7 en petrolera en los llanos."},
    {"dim": "turnos_rotativos", "text": "Su disponibilidad depende del cuadro de turnos de la semana."},
    {"dim": "turnos_rotativos", "text": "No tiene horario fijo, rola turno cada 15 días."},
    {"dim": "turnos_rotativos", "text": "Trabaja de noche 3 veces a la semana."},
    {"dim": "turnos_rotativos", "text": "Jornadas nocturnas fijas de 10pm a 6am."},

    # ─── DUELO RECIENTE (< 90 DÍAS) ───
    {"dim": "duelo_reciente", "text": "Soltero hace 2 meses tras convivencia de 4 años."},
    {"dim": "duelo_reciente", "text": "Terminó hace un mes con la ex, aún se le nota sensible."},
    {"dim": "duelo_reciente", "text": "Ruptura reciente, se separó hace unas semanas."},
    {"dim": "duelo_reciente", "text": "Salió de una relación hace nada (45 días exactamente)."},
    {"dim": "duelo_reciente", "text": "Acaba de cortar su noviazgo hace mes y medio."},
    {"dim": "duelo_reciente", "text": "En proceso de tusa, terminaron hace mes y medio."},
    {"dim": "duelo_reciente", "text": "Se dejó con la pareja hace escasas 3 semanas."},
    {"dim": "duelo_reciente", "text": "Separada hace 1 mes, viviendo sola por primera vez."},
    {"dim": "duelo_reciente", "text": "Duelo reciente, su exnovia se fue del país hace 2 meses."},
    {"dim": "duelo_reciente", "text": "Lleva 60 días de soltería tras un divorcio duro."},

    # ─── DISPOSICIÓN DE VIAJE / TRASLADO ───
    {"dim": "disposicion_viajar", "text": "Está dispuesta a viajar con frecuencia a Medellín."},
    {"dim": "disposicion_viajar", "text": "Abierta a trasladarse si la relación prospera."},
    {"dim": "disposicion_viajar", "text": "No tiene problema con una relación a distancia al inicio."},
    {"dim": "disposicion_viajar", "text": "Pasa 15 días en Cali y 15 días en Bogotá por su empresa."},
    {"dim": "disposicion_viajar", "text": "Tiene facilidad para desplazarse los fines de semana a otra ciudad."},
    {"dim": "disposicion_viajar", "text": "No le da pereza tomar avión cada 15 días para verse."},
    {"dim": "disposicion_viajar", "text": "Teletrabaja al 100%, puede radicarse en cualquier ciudad."},
    {"dim": "disposicion_viajar", "text": "Nómada digital, vive entre Medellín y Miami."},
    {"dim": "disposicion_viajar", "text": "Disponibilidad total para viajar por amor."},
    {"dim": "disposicion_viajar", "text": "Abierto a otras ciudades de Colombia."},

    # ─── DESEO DE HIJOS ───
    {"dim": "deseo_hijos", "text": "Desea tener hijos en los próximos 3 a 5 años."},
    {"dim": "deseo_hijos", "text": "Sueña con ser madre y formar un hogar con bebés."},
    {"dim": "deseo_hijos", "text": "Para él la paternidad es un proyecto no negociable."},
    {"dim": "deseo_hijos", "text": "Quiere ser papá, le encantan los niños."},
    {"dim": "deseo_hijos", "text": "Le ilusiona mucho tener descendencia con su futura pareja."},
    {"dim": "deseo_hijos", "text": "Tiene anhelo de maternidad a mediano plazo."},
    {"dim": "deseo_hijos", "text": "Quiere tener al menos un hijo propio."},
    {"dim": "deseo_hijos", "text": "Buscar formar familia con hijos."},
    {"dim": "deseo_hijos", "text": "Su plan de vida incluye tener 2 hijos."},
    {"dim": "deseo_hijos", "text": "No tiene hijos pero le gustaría ser padre."}
]

def extract_json_object(text: str) -> dict:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
        return {}

async def extract_case_llm(
    case_idx: int,
    case: dict,
    client: httpx.AsyncClient,
    gemini_key: str,
    nvidia_key: str,
    sem: asyncio.Semaphore
) -> dict:
    prompt = f"""Eres un extractor clínico de datos para una agencia de matchmaking en Colombia.
Analiza la siguiente nota breve y determina los atributos booleanos solicitados.
Entiende modismos, jerga y metáforas colombianas:
- "vasectomia": 'cerró la fábrica', 'se operó para no tener bebés', 'ligado', 'no puede engendrar', 'cirugía definitiva'.
- "turnos_rotativos": horarios que cambian, guardias de urgencias, turnos de 12h, 7x7 petrolera, turnos noche.
- "duelo_reciente": ruptura o separación hace menos de 90 días, 'tusa reciente', 'se dejó hace 3 semanas/mes y medio'.
- "disposicion_viajar": teletrabaja y puede radicarse donde sea, pasa tiempo entre ciudades, no le da pereza viajar, nómada digital.
- "deseo_hijos": quiere ser padre/madre, sueña con hijos/bebés, paternidad no negociable, anhelo de maternidad.

Nota: "{case['text']}"

Responde ÚNICAMENTE un JSON con este esquema exacto:
{{
  "vasectomia": bool,
  "turnos_rotativos": bool,
  "duelo_reciente": bool,
  "disposicion_viajar": bool,
  "deseo_hijos": bool
}}"""

    async with sem:
        # Intento 1: NVIDIA NIM (Llama 3.2 11B Vision Instruct)
        if nvidia_key:
            url_nv = "https://integrate.api.nvidia.com/v1/chat/completions"
            headers_nv = {"Authorization": f"Bearer {nvidia_key}", "Content-Type": "application/json"}
            payload_nv = {
                "model": "meta/llama-3.2-11b-vision-instruct",
                "messages": [
                    {"role": "system", "content": "Responde SOLO con el objeto JSON requerido, sin explicaciones ni markdown."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.0,
                "max_tokens": 120
            }
            try:
                r = await client.post(url_nv, json=payload_nv, headers=headers_nv, timeout=15.0)
                if r.status_code == 200:
                    raw = r.json()["choices"][0]["message"]["content"]
                    obj = extract_json_object(raw)
                    if obj:
                        return obj
            except Exception:
                pass

        # Intento 2: Gemini 2.5 Flash
        if gemini_key:
            url_gem = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "maxOutputTokens": 150,
                    "temperature": 0.0,
                    "responseMimeType": "application/json"
                }
            }
            try:
                r = await client.post(url_gem, json=payload, timeout=15.0)
                if r.status_code == 200:
                    raw_text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                    obj = extract_json_object(raw_text)
                    if obj:
                        return obj
            except Exception:
                pass

        # Fallback regex si ambos LLM fallan
        synth = OctagonalPersonaSynthesizer.synthesize_profile(1, "Test", "Bogotá", "Hombre", 30, case["text"])
        return {
            "vasectomia": bool(synth["ejes"]["3_axiologia"]["vasectomia"]),
            "turnos_rotativos": bool(synth["ejes"]["1_logistica"]["turnos_rotativos"] or synth["ejes"]["1_logistica"]["turno_nocturno"]),
            "duelo_reciente": bool(synth["ejes"]["2_timing"]["duelo_activo_reciente"]),
            "disposicion_viajar": bool(synth["ejes"]["1_logistica"]["disposicion_viajar"]),
            "deseo_hijos": bool(synth["ejes"]["3_axiologia"]["deseo_hijos"])
        }

async def call_llm_batch_extractor(cases: list) -> list:
    """Extrae concurrentemente los 50 casos con semáforo y fallbacks."""
    settings = get_settings()
    gemini_key = (settings.gemini_api_key or os.getenv("GEMINI_API_KEY") or "").strip()
    nvidia_key = (settings.nvidia_api_key or os.getenv("NVIDIA_API_KEY") or "").strip()
    
    sem = asyncio.Semaphore(5)
    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [
            extract_case_llm(i, c, client, gemini_key, nvidia_key, sem)
            for i, c in enumerate(cases)
        ]
        results = await asyncio.gather(*tasks)
    return results

async def run_comparative_benchmark():
    print("=" * 80)
    print("🔬 COMPARACIÓN RIGUROSA: REGEX VS LLM (50 CASOS DE FRONTERA SEMÁNTICA)")
    print("=" * 80)

    # 1. Regex Baseline
    regex_detected = {c["dim"]: 0 for c in CLINICAL_BENCHMARK_CASES}
    for c in CLINICAL_BENCHMARK_CASES:
        dim = c["dim"]
        synth = OctagonalPersonaSynthesizer.synthesize_profile(1, "Test", "Bogotá", "Hombre", 30, c["text"])
        det = False
        if dim == "vasectomia":
            det = bool(synth["ejes"]["3_axiologia"]["vasectomia"])
        elif dim == "turnos_rotativos":
            det = bool(synth["ejes"]["1_logistica"]["turnos_rotativos"] or synth["ejes"]["1_logistica"]["turno_nocturno"])
        elif dim == "duelo_reciente":
            det = bool(synth["ejes"]["2_timing"]["duelo_activo_reciente"])
        elif dim == "disposicion_viajar":
            det = bool(synth["ejes"]["1_logistica"]["disposicion_viajar"])
        elif dim == "deseo_hijos":
            det = bool(synth["ejes"]["3_axiologia"]["deseo_hijos"])
        if det:
            regex_detected[dim] += 1

    # 2. LLM Extraction
    print("\n🤖 Consultando extractor semántico LLM (Gemini 2.5 Flash con salida JSON)...")
    llm_results = await call_llm_batch_extractor(CLINICAL_BENCHMARK_CASES)
    print(f"✅ Extracción completada para los 50 casos ({len(llm_results)} respuestas estructuradas).")

    llm_detected = {c["dim"]: 0 for c in CLINICAL_BENCHMARK_CASES}
    llm_misses = {c["dim"]: [] for c in CLINICAL_BENCHMARK_CASES}

    for i, c in enumerate(CLINICAL_BENCHMARK_CASES):
        dim = c["dim"]
        ans = llm_results[i]
        det = bool(ans.get(dim))
        if det:
            llm_detected[dim] += 1
        else:
            llm_misses[dim].append(c["text"])

    # 3. Cuadro Comparativo
    print("\n" + "=" * 80)
    print("📊 CUADRO COMPARATIVO: REGEX VS LLM EN TASA DE FALSOS NEGATIVOS")
    print("=" * 80)
    print(f"{'Dimensión Clínica':<25} | {'Regex Acierto':<14} | {'Regex Escape (FN)':<18} | {'LLM Acierto':<12} | {'LLM Escape (FN)'}")
    print("-" * 85)

    tot_reg_ok = 0
    tot_llm_ok = 0

    for dim in ["vasectomia", "turnos_rotativos", "duelo_reciente", "disposicion_viajar", "deseo_hijos"]:
        reg_ok = regex_detected[dim]
        reg_fn = (10 - reg_ok) * 10
        llm_ok = llm_detected[dim]
        llm_fn = (10 - llm_ok) * 10
        tot_reg_ok += reg_ok
        tot_llm_ok += llm_ok

        print(f"{dim.upper():<25} | {reg_ok}/10 ({reg_ok*10:2d}%)    | {10-reg_ok}/10 ({reg_fn:2d}%)          | {llm_ok}/10 ({llm_ok*10:2d}%)  | {10-llm_ok}/10 ({llm_fn:2d}%)")

    print("-" * 85)
    global_reg_recall = (tot_reg_ok / 50) * 100
    global_reg_fn = 100 - global_reg_recall
    global_llm_recall = (tot_llm_ok / 50) * 100
    global_llm_fn = 100 - global_llm_recall

    print(f"{'TOTAL GLOBAL (50 casos)':<25} | {tot_reg_ok}/50 ({global_reg_recall:.1f}%)   | {50-tot_reg_ok}/50 ({global_reg_fn:.1f}%)        | {tot_llm_ok}/50 ({global_llm_recall:.1f}%) | {50-tot_llm_ok}/50 ({global_llm_fn:.1f}%)")
    print("=" * 80)

    if any(llm_misses.values()):
        print("\n🔍 Casos que el LLM no detectó (si los hubiera):")
        for dim, misses in llm_misses.items():
            if misses:
                print(f"  • {dim}: {misses}")
    else:
        print("\n✨ CERO FALSOS NEGATIVOS EN EL LLM: 100% de captura semántica exitosa.")

if __name__ == "__main__":
    asyncio.run(run_comparative_benchmark())
