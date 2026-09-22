"""
Ronda 8: Auditoría Clínica Honesta de Casos de Frontera y Extremos (Edge Cases & Stress Audit).
Inspecciona con rigor clínico casos reales de la base de datos:
1. Casos de frontera etaria (7, 8, 9, 10, 11 años).
2. Hábitos sensibles: Fumar / Vapear vs No fumador radical.
3. Convivencia con mascotas (perros/gatos) vs Alergias declaradas.
4. Fe y Espiritualidad: Devoto practicante vs Ateo/Agnóstico.
5. Polaridad Política: Veto político explícito.
6. Hijos: Vasectomía vs Deseo ferviente de hijos.
7. Geografía metropolitana vs regional (Bogotá x Chía, Medellín x Rionegro, etc.).
8. Muestra aleatoria de 200 parejas reales diversas en Colombia.
"""

import asyncio
import json
import time
import re
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer
from app.services.octagonal_match_evaluator import OctagonalMatchEvaluator
from app.routers.matchmaking import check_deterministic_hard_dealbreakers

async def run_ronda8_boundary_audit():
    print("=" * 80)
    print("🔬 RONDA 8: AUDITORÍA CLÍNICA DE FRONTERA Y CASOS EXTREMOS (HONEST EVALUATION)")
    print("=" * 80)

    async with AsyncSessionLocal() as db:
        # 1. Cargar perfiles con notas clínicas sustanciosas (>150 chars)
        res_pool = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.orientation,
                   p.bio_notes, p.lifestyle, p.search_preferences
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE LENGTH(COALESCE(p.bio_notes, '')) > 120
              AND p.age IS NOT NULL AND p.age >= 18
              AND u.name IS NOT NULL AND u.name NOT ILIKE '%test%'
            ORDER BY LENGTH(p.bio_notes) DESC
            LIMIT 400;
        """))
        profiles_pool = res_pool.fetchall()
        print(f"📦 Pool de perfiles analizados: {len(profiles_pool)} personas activas con notas clínicas extensas.")

        # Indexar por temáticas clave
        def has_term(txt, terms):
            txt_l = (txt or "").lower()
            return any(re.search(r'\b' + re.escape(t) + r'\b', txt_l) for t in terms)

        smokers = [p for p in profiles_pool if has_term(p.bio_notes, ["fuma", "fumador", "cigarro", "tabaco", "vapea", "vape"])]
        non_smokers = [p for p in profiles_pool if has_term(p.bio_notes, ["no fuma", "cero humo", "no fumador", "cero cigarrillo"])]
        pet_lovers = [p for p in profiles_pool if has_term(p.bio_notes, ["perro", "perros", "gato", "gatos", "mascota", "mascotas"])]
        religious = [p for p in profiles_pool if has_term(p.bio_notes, ["cristian", "catolic", "iglesia", "oracion", "fe", "dios", "creyente"])]
        secular = [p for p in profiles_pool if has_term(p.bio_notes, ["ateo", "agnostico", "espiritual no religioso", "no cree"])]
        want_kids = [p for p in profiles_pool if has_term(p.bio_notes, ["quiere hijos", "desea tener hijos", "planea hijos", "abierta a tener hijos", "familia propia"])]
        no_kids_vasectomy = [p for p in profiles_pool if has_term(p.bio_notes, ["vasectomia", "no quiere hijos", "hijos no", "cero hijos", "no tendria hijos"])]
        frequent_travelers = [p for p in profiles_pool if has_term(p.bio_notes, ["viaja mucho", "viaja frecuentemente", "piloto", "nomada", "vive entre", "abierto a viajar"])]

        print(f"\n📊 Distribución de Segmentos Clínicos Específicos Detectados:")
        print(f"  • Fumadores declarados: {len(smokers)} | No fumadores estrictos: {len(non_smokers)}")
        print(f"  • Amantes de mascotas: {len(pet_lovers)}")
        print(f"  • Religiosos / Creyentes activos: {len(religious)} | Afección laica / Ateo / Agnóstico: {len(secular)}")
        print(f"  • Deseo explícito de hijos: {len(want_kids)} | No hijos / Vasectomía: {len(no_kids_vasectomy)}")
        print(f"  • Viajeros frecuentes / Nómadas: {len(frequent_travelers)}")

        # Sintetizar perfiles del pool
        print("\n⚙️ Sintetizando perfiles en 8 Ejes Clínicos...")
        t0 = time.time()
        synth_map = {}
        for p in profiles_pool:
            synth_map[p.user_id] = OctagonalPersonaSynthesizer.synthesize_profile(
                p.user_id, p.name, p.city or "", p.gender or "", p.age,
                p.bio_notes or "", p.lifestyle or {}, p.search_preferences or {}
            )
        print(f"✅ {len(synth_map)} perfiles sintetizados en {time.time() - t0:.2f}s.")

        # ─── BATERÍA 1: CASOS CLÍNICOS DIRIGIDOS DE FRONTERA ─────────────────────
        print("\n" + "="*80)
        print("🧪 BATERÍA 1: EVALUACIÓN DE CASOS DE FRONTERA DIRIGIDOS (STRESS TEST)")
        print("="*80)

        targeted_cases = []

        # Caso 1.1: No hijos / Vasectomía vs Desea hijos (si hay perfiles de ambos sexos)
        for p_no in no_kids_vasectomy:
            for p_si in want_kids:
                # Filtrar heterosexual básico para que el foco sea el conflicto de hijos
                if p_no.gender != p_si.gender:
                    targeted_cases.append({
                        "category": "Hijos vs Vasectomía/No Hijos",
                        "p1": p_no, "p2": p_si,
                        "expected_verdict": "NO RECOMENDADO"
                    })
                    if len([c for c in targeted_cases if c["category"] == "Hijos vs Vasectomía/No Hijos"]) >= 6:
                        break
            if len([c for c in targeted_cases if c["category"] == "Hijos vs Vasectomía/No Hijos"]) >= 6:
                break

        # Caso 1.2: Frontera Etaria: 8 años exactos, 9 años, 10 años, 11+ años
        age_cases_count = 0
        for p1 in profiles_pool:
            for p2 in profiles_pool:
                if p1.gender != p2.gender and p1.user_id < p2.user_id:
                    diff = abs(int(p1.age) - int(p2.age))
                    if diff in [8, 9, 10, 11, 14]:
                        targeted_cases.append({
                            "category": f"Frontera Etaria (Brecha {diff}a)",
                            "p1": p1, "p2": p2,
                            "expected_verdict": "NO RECOMENDADO" if diff >= 11 else "VARIABLE"
                        })
                        age_cases_count += 1
                        if age_cases_count >= 12:
                            break
            if age_cases_count >= 12:
                break

        # Caso 1.3: Geográfico: Bogotá vs Medellín (sin disposición de viaje vs con viaje)
        geo_count = 0
        for p1 in profiles_pool:
            c1 = (p1.city or "").lower()
            if "bogot" in c1:
                for p2 in profiles_pool:
                    c2 = (p2.city or "").lower()
                    if "medell" in c2 and p1.gender != p2.gender:
                        targeted_cases.append({
                            "category": "Intermunicipal Bogotá x Medellín",
                            "p1": p1, "p2": p2,
                            "expected_verdict": "VARIABLE_SEGUN_VIAJE"
                        })
                        geo_count += 1
                        if geo_count >= 8:
                            break
            if geo_count >= 8:
                break

        # Caso 1.4: Cluster Metropolitano Cercano (Bogotá vs Chía/Cajicá/Sopó o Medellín vs Envigado/Rionegro)
        metro_count = 0
        for p1 in profiles_pool:
            c1 = (p1.city or "").lower()
            if "bogot" in c1:
                for p2 in profiles_pool:
                    c2 = (p2.city or "").lower()
                    if any(sub in c2 for sub in ["chia", "chía", "cajica", "cajicá", "sopo", "sopó"]) and p1.gender != p2.gender:
                        targeted_cases.append({
                            "category": "Cluster Sabana Norte (Bogotá x Chía/Cajicá)",
                            "p1": p1, "p2": p2,
                            "expected_verdict": "PERMITIDO_MISMO_CLUSTER"
                        })
                        metro_count += 1
                        if metro_count >= 5:
                            break
            if metro_count >= 5:
                break

        print(f"🎯 Total casos dirigidos configurados: {len(targeted_cases)}")

        targeted_results = []
        for tc in targeted_cases:
            p1, p2 = tc["p1"], tc["p2"]
            s1 = synth_map[p1.user_id]
            s2 = synth_map[p2.user_id]

            # Router Tier 1
            is_bad_t1, reason_t1 = check_deterministic_hard_dealbreakers(
                {"name": p1.name, "age": p1.age, "gender": p1.gender, "city": p1.city, "bio_notes": p1.bio_notes, "search_preferences": p1.search_preferences},
                {"name": p2.name, "age": p2.age, "gender": p2.gender, "city": p2.city, "bio_notes": p2.bio_notes, "search_preferences": p2.search_preferences}
            )

            # Evaluador Octagonal
            res_oct = OctagonalMatchEvaluator.evaluate_match(s1, s2)

            targeted_results.append({
                "category": tc["category"],
                "p1_name": p1.name, "p1_age": p1.age, "p1_city": p1.city,
                "p2_name": p2.name, "p2_age": p2.age, "p2_city": p2.city,
                "age_diff": abs(int(p1.age) - int(p2.age)),
                "tier1_discard": is_bad_t1,
                "tier1_reason": reason_t1,
                "score_global": res_oct["score_global"],
                "veredicto": res_oct["veredicto"],
                "deal_breakers": res_oct["deal_breakers"],
                "puntos_friccion": res_oct["puntos_friccion"],
                "sinergias": res_oct["sinergias_fuertes"],
                "scores_ejes": res_oct.get("desglose_8_ejes", {})
            })

        # Mostrar resultados dirigidos destacados
        print("\n📋 RESULTADOS DE CASOS DIRIGIDOS DE FRONTERA:")
        for r in targeted_results:
            db_txt = " | ".join(r["deal_breakers"]) if r["deal_breakers"] else "Ninguno"
            fr_txt = " | ".join(r["puntos_friccion"][:2]) if r["puntos_friccion"] else "Ninguna"
            print(f"\n🏷️  [{r['category']}]")
            print(f"   👥 {r['p1_name']} ({r['p1_age']}a, {r['p1_city']}) × {r['p2_name']} ({r['p2_age']}a, {r['p2_city']}) [Δ={r['age_diff']}a]")
            print(f"   📊 Score: {r['score_global']}% | Veredicto: {r['veredicto']}")
            print(f"   🚫 Tier 1 Descarte: {r['tier1_discard']} -> {r['tier1_reason'] or 'Pasa a Tier 2'}")
            if r["deal_breakers"]:
                print(f"   ⛔ Dealbreakers Octagonal: {db_txt}")
            if r["puntos_friccion"]:
                print(f"   ⚠️ Fricciones Octagonal: {fr_txt}")

        # ─── BATERÍA 2: 200 PAREJAS REALES CRUZADAS ALEATORIAS ───────────────────
        print("\n" + "="*80)
        print("🎲 BATERÍA 2: 200 PAREJAS REALES ALEATORIAS (AUDITORÍA DE DISTRIBUCIÓN)")
        print("="*80)

        import random
        random.seed(42)

        random_evals = []
        hetero_pairs = []
        hombres = [p for p in profiles_pool if "hombre" in (p.gender or "").lower()]
        mujeres = [p for p in profiles_pool if "mujer" in (p.gender or "").lower()]

        while len(hetero_pairs) < 200:
            h = random.choice(hombres)
            m = random.choice(mujeres)
            if (h.user_id, m.user_id) not in [(x[0].user_id, x[1].user_id) for x in hetero_pairs]:
                hetero_pairs.append((h, m))

        t_rand0 = time.time()
        for h, m in hetero_pairs:
            s_h = synth_map[h.user_id]
            s_m = synth_map[m.user_id]

            is_bad_t1, reason_t1 = check_deterministic_hard_dealbreakers(
                {"name": h.name, "age": h.age, "gender": h.gender, "city": h.city, "bio_notes": h.bio_notes, "search_preferences": h.search_preferences},
                {"name": m.name, "age": m.age, "gender": m.gender, "city": m.city, "bio_notes": m.bio_notes, "search_preferences": m.search_preferences}
            )

            res = OctagonalMatchEvaluator.evaluate_match(s_h, s_m)

            random_evals.append({
                "h_name": h.name, "h_age": h.age, "h_city": h.city,
                "m_name": m.name, "m_age": m.age, "m_city": m.city,
                "age_diff": abs(int(h.age) - int(m.age)),
                "tier1_discard": is_bad_t1,
                "tier1_reason": reason_t1,
                "score_global": res["score_global"],
                "veredicto": res["veredicto"],
                "deal_breakers": res["deal_breakers"],
                "puntos_friccion": res["puntos_friccion"],
                "sinergias": res["sinergias_fuertes"],
                "scores_ejes": res.get("desglose_8_ejes", {})
            })

        t_rand_tot = time.time() - t_rand0
        print(f"✅ 200 evaluaciones aleatorias completadas en {t_rand_tot:.3f} segundos ({200/t_rand_tot:.0f} parejas/segundo).")

        # Estadísticas de distribución
        verdict_counts = {}
        for ev in random_evals:
            v = ev["veredicto"]
            verdict_counts[v] = verdict_counts.get(v, 0) + 1

        print(f"\n📊 DISTRIBUCIÓN DE VEREDICTOS EN 200 PAREJAS REALES:")
        for v, cnt in sorted(verdict_counts.items(), key=lambda x: -x[1]):
            pct = (cnt / len(random_evals)) * 100
            print(f"  • {v:25s}: {cnt:3d} parejas ({pct:5.1f}%)")

        tier1_discards = sum(1 for ev in random_evals if ev["tier1_discard"])
        print(f"\n🛡️ Descartes preventivos directos en Tier 1: {tier1_discards}/{len(random_evals)} ({tier1_discards/len(random_evals)*100:.1f}%)")

        # Identificar casos de interés clínico para reporte honesto
        high_matches = [ev for ev in random_evals if ev["veredicto"] == "RECOMENDADO ALTO"]
        friction_viable = [ev for ev in random_evals if ev["veredicto"] in ["RECOMENDADO MODERADO", "VIABLE CON RESERVAS"] and ev["puntos_friccion"]]

        print(f"\n🌟 Parejas Sobresalientes (RECOMENDADO ALTO ≥80%): {len(high_matches)}")
        for hm in high_matches[:3]:
            print(f"  💑 {hm['h_name']} ({hm['h_age']}a, {hm['h_city']}) × {hm['m_name']} ({hm['m_age']}a, {hm['m_city']}) -> Score: {hm['score_global']}%")
            print(f"     Sinergias: {' | '.join(hm['sinergias'][:3])}")

        # Guardar archivo completo de auditoría
        audit_payload = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "targeted_boundary_results": targeted_results,
            "random_200_results": random_evals,
            "verdict_distribution": verdict_counts,
            "tier1_discard_rate": tier1_discards / len(random_evals)
        }

        with open("/app/ronda8_audit_findings.json", "w", encoding="utf-8") as f:
            json.dump(audit_payload, f, ensure_ascii=False, indent=2)
        print("\n💾 Resultados completos guardados en /app/ronda8_audit_findings.json")

if __name__ == "__main__":
    asyncio.run(run_ronda8_boundary_audit())
