import asyncio
import json
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer

async def test_synthesis():
    target_uids = [7841, 12482, 9504, 9568, 12837, 7502]
    
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.bio_notes, p.lifestyle, p.search_preferences
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE p.user_id = ANY(:uids)
        """), {"uids": target_uids})
        rows = res.fetchall()
        
        print(f"=====================================================================")
        print(f"🧪 PRUEBA DE SÍNTESIS CLÍNICA OCTAGONAL EN 6 CASOS DE BORDE REALES")
        print(f"=====================================================================\n")
        
        for r in rows:
            syn = OctagonalPersonaSynthesizer.synthesize_profile(
                user_id=r.user_id,
                name=r.name,
                city=r.city,
                gender=r.gender,
                age=r.age,
                bio_notes=r.bio_notes,
                lifestyle=r.lifestyle,
                search_preferences=r.search_preferences
            )
            print(f"👤 UID {syn['metadata']['user_id']} | {syn['metadata']['name']} ({syn['metadata']['age']}a, {syn['metadata']['city']}, {syn['metadata']['gender']})")
            print(f"   🚦 Estado: {syn['metadata']['availability_status']} | Calidad notas: {syn['metadata']['calidad_notas']} | Trans: {syn['metadata']['es_trans']}")
            print(f"   ⏰ 1. Logística: {syn['ejes']['1_logistica']['disponibilidad_resumen']} (Rotación: {syn['ejes']['1_logistica']['profesion_alta_movilidad']}, Custodia: {syn['ejes']['1_logistica']['custodia_compartida_semanal']})")
            print(f"   ⏳ 2. Timing: {syn['ejes']['2_timing']['intencion_primaria']} | {syn['ejes']['2_timing']['alerta_disponibilidad_emocional']}")
            print(f"   💎 3. Axiología: Hijos={syn['ejes']['3_axiologia']['tiene_hijos']} | Deseo={syn['ejes']['3_axiologia']['deseo_hijos']} | Vasectomía={syn['ejes']['3_axiologia']['vasectomia']} | Finanzas={syn['ejes']['3_axiologia']['modelo_financiero']}")
            print(f"   🗣️ 4. Conflicto: {syn['ejes']['4_conflicto']['estilo_procesamiento']} (Reactivo: {syn['ejes']['4_conflicto']['alerta_reactividad']}, Evitativo: {syn['ejes']['4_conflicto']['rasgo_evitativo']})")
            print(f"   🧘 5. Autonomía: {syn['ejes']['5_autonomia']['necesidad_espacio_personal']}")
            print(f"   ⚡ 6. Ritmo Vital: {syn['ejes']['6_ritmo_vital']['vitalidad_fisica']} | {syn['ejes']['6_ritmo_vital']['cronotipo']}")
            print(f"   🎭 7. Polaridad: {syn['ejes']['7_polaridad']['dinamica_preferida']}")
            print(f"   ✨ 8. Estética: Aseo estricto={syn['ejes']['8_estetica']['aseo_y_presentacion_estricta']} | No tatuajes={syn['ejes']['8_estetica']['rechaza_tatuajes']} | No cirugías={syn['ejes']['8_estetica']['rechaza_cirugias_esteticas']}")
            print("----------------------------------------------------------------------------------\n")

if __name__ == '__main__':
    asyncio.run(test_synthesis())
