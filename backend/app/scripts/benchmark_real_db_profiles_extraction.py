"""
Benchmark Real: Extracción de 100 Perfiles Reales de Producción
Compara empíricamente el vector clínico extraído por:
1. Regex Clásico (OctagonalPersonaSynthesizer.synthesize_profile)
2. LLM Semántico (OctagonalPersonaSynthesizer.synthesize_profile_llm)
Midiendo dealbreakers y fricciones latentes que Regex dejó escapar.
"""

import asyncio
import time
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer

async def run_real_db_benchmark(limit: int = 50):
    print("=" * 80)
    print(f"🔬 AUDITORÍA REAL EN BD: REGEX VS LLM ({limit} PERFILES REALES CON NOTAS EXTENSAS)")
    print("=" * 80)

    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.bio_notes, p.lifestyle, p.search_preferences
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LENGTH(COALESCE(p.bio_notes, '')) > 250
              AND u.name IS NOT NULL
              AND u.name NOT ILIKE '%test%'
            ORDER BY p.user_id ASC
            LIMIT :limit;
        """), {"limit": limit})
        profiles = res.fetchall()

    print(f"✅ Cargados {len(profiles)} perfiles reales con notas clínicas profundas.\n")

    # Contadores
    regex_counts = {
        "vasectomia": 0,
        "turnos_rotativos": 0,
        "duelo_reciente": 0,
        "disposicion_viajar": 0,
        "modelo_proveedor": 0,
        "modelo_50_50": 0,
        "creyente_devoto": 0,
        "ateo": 0,
        "conflicto_tiempo_fuera": 0,
        "conflicto_reactivo": 0,
        "hiper_autonomo": 0,
        "atleta_alto_rendimiento": 0,
        "exige_pulcritud": 0
    }

    llm_counts = {k: 0 for k in regex_counts}
    captured_novel_insights = []

    sem = asyncio.Semaphore(4)

    async def process_profile(row):
        uid, name, city, gender, age, notes, life, sp = row
        # 1. Regex
        reg_syn = OctagonalPersonaSynthesizer.synthesize_profile(
            uid, name, city or "", gender or "", age, notes or "", life or {}, sp or {}
        )
        
        # 2. LLM
        async with sem:
            llm_syn = await OctagonalPersonaSynthesizer.synthesize_profile_llm(
                uid, name, city or "", gender or "", age, notes or "", life or {}, sp or {}, use_llm=True
            )

        return (row, reg_syn, llm_syn)

    tasks = [process_profile(r) for r in profiles]
    results = await asyncio.gather(*tasks)

    for (row, reg_syn, llm_syn) in results:
        uid, name, city, gender, age, notes, life, sp = row
        r_e = reg_syn["ejes"]
        l_e = llm_syn["ejes"]

        # Medir Regex
        if r_e["3_axiologia"].get("vasectomia"): regex_counts["vasectomia"] += 1
        if r_e["1_logistica"].get("turnos_rotativos") or r_e["1_logistica"].get("turno_nocturno"): regex_counts["turnos_rotativos"] += 1
        if r_e["2_timing"].get("duelo_activo_reciente"): regex_counts["duelo_reciente"] += 1
        if r_e["1_logistica"].get("disposicion_viajar"): regex_counts["disposicion_viajar"] += 1
        if r_e["3_axiologia"].get("modelo_financiero") == "Proveedor tradicional": regex_counts["modelo_proveedor"] += 1
        if r_e["3_axiologia"].get("modelo_financiero") == "Igualitario 50/50": regex_counts["modelo_50_50"] += 1
        if r_e["3_axiologia"].get("fe_espiritual") == "Creyente devoto/practicante": regex_counts["creyente_devoto"] += 1
        if r_e["3_axiologia"].get("fe_espiritual") == "Ateo / Agnóstico": regex_counts["ateo"] += 1
        if r_e["4_conflicto"].get("estilo_procesamiento") == "Tiempo fuera / Reflexivo": regex_counts["conflicto_tiempo_fuera"] += 1
        if r_e["4_conflicto"].get("alerta_reactividad"): regex_counts["conflicto_reactivo"] += 1
        if "Alta" in str(r_e["5_autonomia"].get("necesidad_espacio_personal", "")): regex_counts["hiper_autonomo"] += 1
        if "Muy Alta" in str(r_e["6_ritmo_vital"].get("vitalidad_fisica", "")): regex_counts["atleta_alto_rendimiento"] += 1
        if r_e["8_estetica"].get("aseo_y_presentacion_estricta"): regex_counts["exige_pulcritud"] += 1

        # Medir LLM
        if l_e["3_axiologia"].get("vasectomia"): llm_counts["vasectomia"] += 1
        if l_e["1_logistica"].get("turnos_rotativos") or l_e["1_logistica"].get("turno_nocturno"): llm_counts["turnos_rotativos"] += 1
        if l_e["2_timing"].get("duelo_activo_reciente"): llm_counts["duelo_reciente"] += 1
        if l_e["1_logistica"].get("disposicion_viajar"): llm_counts["disposicion_viajar"] += 1
        if l_e["3_axiologia"].get("modelo_financiero") == "Proveedor tradicional": llm_counts["modelo_proveedor"] += 1
        if l_e["3_axiologia"].get("modelo_financiero") == "Igualitario 50/50": llm_counts["modelo_50_50"] += 1
        if l_e["3_axiologia"].get("fe_espiritual") == "Creyente devoto/practicante": llm_counts["creyente_devoto"] += 1
        if l_e["3_axiologia"].get("fe_espiritual") == "Ateo / Agnóstico": llm_counts["ateo"] += 1
        if l_e["4_conflicto"].get("estilo_procesamiento") == "Tiempo fuera / Reflexivo": llm_counts["conflicto_tiempo_fuera"] += 1
        if l_e["4_conflicto"].get("alerta_reactividad"): llm_counts["conflicto_reactivo"] += 1
        if "Alta" in str(l_e["5_autonomia"].get("necesidad_espacio_personal", "")): llm_counts["hiper_autonomo"] += 1
        if "Muy Alta" in str(l_e["6_ritmo_vital"].get("vitalidad_fisica", "")): llm_counts["atleta_alto_rendimiento"] += 1
        if l_e["8_estetica"].get("aseo_y_presentacion_estricta"): llm_counts["exige_pulcritud"] += 1

        # Detectar casos donde LLM descubrió algo crítico invisible a regex
        diffs = []
        if l_e["3_axiologia"].get("vasectomia") and not r_e["3_axiologia"].get("vasectomia"):
            diffs.append("Vasectomía omitida por Regex")
        if (l_e["1_logistica"].get("turnos_rotativos") or l_e["1_logistica"].get("turno_nocturno")) and not (r_e["1_logistica"].get("turnos_rotativos") or r_e["1_logistica"].get("turno_nocturno")):
            diffs.append("Turnos rotativos omitidos por Regex")
        if l_e["2_timing"].get("duelo_activo_reciente") and not r_e["2_timing"].get("duelo_activo_reciente"):
            diffs.append("Duelo reciente omitido por Regex")
        if l_e["1_logistica"].get("disposicion_viajar") and not r_e["1_logistica"].get("disposicion_viajar"):
            diffs.append("Disposición a viajar omitida por Regex")
        if l_e["3_axiologia"].get("modelo_financiero") != "Flexible / Equilibrado" and r_e["3_axiologia"].get("modelo_financiero") == "Flexible / Equilibrado":
            diffs.append(f"Modelo financiero ({l_e['3_axiologia'].get('modelo_financiero')})")

        if diffs:
            captured_novel_insights.append({
                "uid": uid,
                "name": name,
                "gender": gender,
                "diffs": diffs,
                "snippet": notes[:180].replace("\n", " ") + "..."
            })

    # Imprimir Cuadro Comparativo
    print("=" * 80)
    print("📊 RESULTADOS EMPÍRICOS EN BASE DE DATOS REAL:")
    print("=" * 80)
    print(f"{'Atributo Clínico':<30} | {'Regex Detectado':<16} | {'LLM Detectado':<16} | {'Ganancia Neta'}")
    print("-" * 80)

    for k in regex_counts:
        reg_v = regex_counts[k]
        llm_v = llm_counts[k]
        diff = llm_v - reg_v
        diff_str = f"+{diff} casos" if diff > 0 else (f"{diff} casos" if diff < 0 else "=")
        print(f"{k:<30} | {reg_v:<16} | {llm_v:<16} | {diff_str}")

    print("=" * 80)
    print(f"\n🔍 CASOS REALES DONDE EL LLM RESCATÓ INFORMACIÓN CRÍTICA INVISIBLE AL REGEX ({len(captured_novel_insights)} perfiles):")
    for item in captured_novel_insights[:8]:
        print(f"\n👤 [{item['uid']}] {item['name']} ({item['gender']}):")
        print(f"   • Hallazgos rescatados: {', '.join(item['diffs'])}")
        print(f"   • Texto clínico real: \"{item['snippet']}\"")

if __name__ == "__main__":
    asyncio.run(run_real_db_benchmark(50))
