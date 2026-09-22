import asyncio
import json
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer
from app.services.octagonal_match_evaluator import OctagonalMatchEvaluator
from app.routers.matchmaking import check_deterministic_hard_dealbreakers

async def test_real_anchors():
    print("=" * 80)
    print("🔬 AUDITORÍA REAL DE REGLAS ESTRICTAS: EDAD (≤8a) Y CIUDAD (VIAJE)")
    print("=" * 80)

    async with AsyncSessionLocal() as db:
        # Cargar a Román Briceño (59a, Bogotá, Hombre)
        # y María José Álvarez (22a, Bogotá, Mujer)
        res_anchors = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.orientation, p.bio_notes, p.lifestyle, p.search_preferences
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE p.user_id IN (7841, 6251)
        """))
        anchors = res_anchors.fetchall()

        # Candidatas mujeres (diversas edades y ciudades)
        res_cand_fem = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.orientation, p.bio_notes, p.lifestyle, p.search_preferences
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE p.gender = 'Mujer'
              AND LENGTH(COALESCE(p.bio_notes, '')) > 60
              AND u.name IS NOT NULL
              AND p.age IS NOT NULL
            ORDER BY p.age DESC
            LIMIT 25;
        """))
        cand_fem = res_cand_fem.fetchall()

        # Candidatos hombres para María José (diversas edades y ciudades)
        res_cand_masc = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.orientation, p.bio_notes, p.lifestyle, p.search_preferences
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE p.gender = 'Hombre'
              AND LENGTH(COALESCE(p.bio_notes, '')) > 60
              AND u.name IS NOT NULL
              AND p.age IS NOT NULL
            ORDER BY p.age ASC
            LIMIT 25;
        """))
        cand_masc = res_cand_masc.fetchall()

    for a in anchors:
        candidates = cand_fem if a.gender == 'Hombre' else cand_masc
        a_syn = OctagonalPersonaSynthesizer.synthesize_profile(
            a.user_id, a.name, a.city or "", a.gender or "", a.age,
            a.bio_notes or "", a.lifestyle or {}, a.search_preferences or {}
        )
        print("\n" + "=" * 80)
        print(f"👤 CLIENTE ANCLA: {a.name} ({a.age}a, {a.city}, {a.gender})")
        print("=" * 80)

        discarded_count = 0
        accepted_count = 0

        for c in candidates:
            c_syn = OctagonalPersonaSynthesizer.synthesize_profile(
                c.user_id, c.name, c.city or "", c.gender or "", c.age,
                c.bio_notes or "", c.lifestyle or {}, c.search_preferences or {}
            )

            res = OctagonalMatchEvaluator.evaluate_match(a_syn, c_syn)
            is_bad_tier1, reason_tier1 = check_deterministic_hard_dealbreakers(
                {"name": a.name, "age": a.age, "gender": a.gender, "city": a.city, "bio_notes": a.bio_notes, "search_preferences": a.search_preferences},
                {"name": c.name, "age": c.age, "gender": c.gender, "city": c.city, "bio_notes": c.bio_notes, "search_preferences": c.search_preferences}
            )

            diff = abs((a.age or 0) - (c.age or 0))
            is_discarded = (res["veredicto"] == "NO RECOMENDADO") or is_bad_tier1

            if is_discarded:
                discarded_count += 1
                reason = res["deal_breakers"][0] if res.get("deal_breakers") else reason_tier1
                print(f"  ❌ DESCARTADO DIRECTO : vs {c.name:26s} ({c.age:2d}a, {c.city or 'S/D':12s}) | Gap: {diff:2d}a | Score: {res['score_global']}%")
                print(f"     Motivo: {reason}")
            else:
                accepted_count += 1
                print(f"  ✅ PERMITIDO (VIABLE) : vs {c.name:26s} ({c.age:2d}a, {c.city or 'S/D':12s}) | Gap: {diff:2d}a | Score: {res['score_global']}% ({res['veredicto']})")
                print(f"     Sinergias: {res['sinergias_fuertes'][:2]}")

        print(f"\n📊 Resumen para {a.name} ({a.age}a): Descartados Directos={discarded_count} | Viables/Compatibles={accepted_count}")

if __name__ == '__main__':
    asyncio.run(test_real_anchors())
