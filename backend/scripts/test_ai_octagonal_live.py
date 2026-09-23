import asyncio
import json
from sqlalchemy import text
from app.database import engine
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer
from app.services.octagonal_match_evaluator import OctagonalMatchEvaluator

async def run_ai_eval():
    async with engine.connect() as conn:
        q = text("""
            SELECT u.id, u.name, p.gender, p.age, p.city, p.bio_notes, p.lifestyle, p.search_preferences
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.id IN (13255, 13179, 6678)
        """)
        res = await conn.execute(q)
        rows = {r.id: dict(r._mapping) for r in res.fetchall()}

    esteban = rows.get(13255)
    natalia = rows.get(13179)
    juan_fl = rows.get(6678)

    print("======================================================================")
    print("1. PERFILES REALES DE LA BASE DE DATOS")
    print("======================================================================")
    print(f"Cliente A: {esteban['name']} | Género: {esteban['gender']} | Edad: {esteban['age']} | Ciudad: {esteban['city']}")
    print(f"Candidata B (Compatible): {natalia['name']} | Género: {natalia['gender']} | Edad: {natalia['age']} | Ciudad: {natalia['city']}")
    print(f"Candidato C (Kill-Switch Distancia/Edad): {juan_fl['name']} | Género: {juan_fl['gender']} | Edad: {juan_fl['age']} | Ciudad: {juan_fl['city']}")

    # Sintetizar perfiles en 8 Ejes Clínicos
    esteban_syn = OctagonalPersonaSynthesizer.synthesize_profile(
        user_id=esteban['id'], name=esteban['name'], city=esteban['city'] or 'Bogotá',
        gender=esteban['gender'] or 'Hombre', age=esteban['age'], bio_notes=esteban['bio_notes'] or '',
        lifestyle=esteban['lifestyle'] or {}, search_preferences=esteban['search_preferences'] or {}
    )

    natalia_syn = OctagonalPersonaSynthesizer.synthesize_profile(
        user_id=natalia['id'], name=natalia['name'], city=natalia['city'] or 'Bogotá',
        gender=natalia['gender'] or 'Mujer', age=natalia['age'], bio_notes=natalia['bio_notes'] or '',
        lifestyle=natalia['lifestyle'] or {}, search_preferences=natalia['search_preferences'] or {}
    )

    juan_syn = OctagonalPersonaSynthesizer.synthesize_profile(
        user_id=juan_fl['id'], name=juan_fl['name'], city=juan_fl['city'] or 'Hollywood, FL',
        gender=juan_fl['gender'] or 'Hombre', age=juan_fl['age'], bio_notes=juan_fl['bio_notes'] or '',
        lifestyle=juan_fl['lifestyle'] or {}, search_preferences=juan_fl['search_preferences'] or {}
    )

    # 1. EVALUACIÓN MATCH 1: ESTEBAN BAQUERO (30) vs NATALIA CASTRO (28)
    print("\n======================================================================")
    print("2. EVALUACIÓN IA MATCHMAKING: ESTEBAN BAQUERO vs NATALIA CASTRO")
    print("======================================================================")
    eval_esteban_natalia = OctagonalMatchEvaluator.evaluate_match(esteban_syn, natalia_syn)
    
    score = eval_esteban_natalia.get('score_global', 0)
    print(f"PUNTAJE GLOBAL DE COMPATIBILIDAD: {score}/100")
    print(f"CLASIFICACIÓN CLÍNICA: {eval_esteban_natalia.get('veredicto', 'EVALUADO')}")
    print("\nDESGLOSE POR EJES VINCULARES (8 EJES):")
    for eje, valor in (eval_esteban_natalia.get('desglose_8_ejes') or {}).items():
        print(f"  • {eje.replace('_', ' ').title()}: {valor}")

    print("\n✨ SINERGIAS FUERTES DETECTADAS (CLÍNICAS / RELACIONALES):")
    for s in (eval_esteban_natalia.get('sinergias_fuertes') or []):
        print(f"  + {s}")

    print("\n📍 DATOS LOGÍSTICOS / CONTEXTO GEOGRÁFICO:")
    for dl in (eval_esteban_natalia.get('datos_logisticos') or []):
        print(f"  • {dl}")

    print("\n⚠️ PUNTOS DE FRICCIÓN (ADVERTENCIAS PARA LA PSICÓLOGA):")
    for f in (eval_esteban_natalia.get('puntos_friccion') or []):
        print(f"  ! {f}")

    print("\n🚫 DEALBREAKERS / KILL SWITCHES:")
    dbs = eval_esteban_natalia.get('deal_breakers') or []
    if dbs:
        for d in dbs:
            print(f"  X {d}")
    else:
        print("  ✓ Ningún dealbreaker activado. Match clínicamente viable.")

    # 2. EVALUACIÓN MATCH 2: NATALIA CASTRO (28, Bogotá) vs JUAN BALLESTEROS (57, Hollywood FL)
    print("\n======================================================================")
    print("3. TEST DE KILL-SWITCH: NATALIA CASTRO (28) vs JUAN BALLESTEROS (57)")
    print("======================================================================")
    eval_natalia_juan = OctagonalMatchEvaluator.evaluate_match(natalia_syn, juan_syn)
    print(f"PUNTAJE GLOBAL: {eval_natalia_juan.get('score_global', 0)}/100")
    print(f"VEREDICTO: {eval_natalia_juan.get('veredicto')}")
    print("DEALBREAKERS DETECTADOS:")
    for d in (eval_natalia_juan.get('deal_breakers') or []):
        print(f"  X {d}")
    print("FRICCIONES:")
    for f in (eval_natalia_juan.get('puntos_friccion') or []):
        print(f"  ! {f}")

if __name__ == '__main__':
    asyncio.run(run_ai_eval())
