import asyncio
import json
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer
from app.services.octagonal_match_evaluator import OctagonalMatchEvaluator

async def test_evaluator():
    print(f"=====================================================================")
    print(f"🧪 PRUEBA DE EVALUACIÓN MULTIDIMENSIONAL (8 EJES) CON CASOS REALES")
    print(f"=====================================================================\n")

    # Synthetic profiles to test precise dynamics
    p_roman = OctagonalPersonaSynthesizer.synthesize_profile(
        user_id=7841, name="Román Briceño", city="Bogotá", gender="Hombre", age=59,
        bio_notes="59 años. Atleta de alto rendimiento mundial de atletismo 100m. Vasectomía no quiere más hijos. Nocturno, activo.",
        lifestyle={"has_children": "Sí", "wants_children": "No"}
    )

    p_mujer_quiere_hijos = OctagonalPersonaSynthesizer.synthesize_profile(
        user_id=9901, name="Carolina Gómez", city="Bogotá", gender="Mujer", age=34,
        bio_notes="34 años. Abogada. Sueña con formar una familia y tener hijos pronto. Catolica.",
        lifestyle={"has_children": "No", "wants_children": "Sí"}
    )

    p_mujer_sedentaria = OctagonalPersonaSynthesizer.synthesize_profile(
        user_id=9902, name="Adriana Castro", city="Bogotá", gender="Mujer", age=52,
        bio_notes="52 años. Muy hogareña, cero gym, planes caseros, dormir a las 8:30 pm. Tranquilidad.",
        lifestyle={"has_children": "Sí", "wants_children": "No"}
    )

    p_natalia_indep = OctagonalPersonaSynthesizer.synthesize_profile(
        user_id=9568, name="Natalia Rodriguez", city="Bogotá", gender="Mujer", age=31,
        bio_notes="Ingeniera. Vive sola desde los 20 años, muy independiente. En discusiones prefiere tomarse un espacio para pensar antes de hablar. Aseo estricto.",
        lifestyle={"has_children": "No", "wants_children": "No"}
    )

    p_hombre_reactivo = OctagonalPersonaSynthesizer.synthesize_profile(
        user_id=9903, name="Carlos Velez", city="Bogotá", gender="Hombre", age=33,
        bio_notes="Empresario. Impulsivo, puede contestar feo si se estresa. Quiere todo 24/7, necesidad constante de atencion.",
        lifestyle={"has_children": "No"}
    )

    p_candidato_refund = OctagonalPersonaSynthesizer.synthesize_profile(
        user_id=9504, name="Sandra Mosquera", city="Medellín", gender="Mujer", age=43,
        bio_notes="Enfermera turnos rotativos. Pidio refund. No proveedor es dealbreaker.",
        lifestyle={"availability_status": "REFUND"}
    )

    tests = [
        ("Román (Vasectomía 59a) x Carolina (Desea Hijos 34a)", p_roman, p_mujer_quiere_hijos, "Incompatibilidad Biológica / Vasectomía"),
        ("Román (Atleta 59a) x Adriana (Sedentaria 52a)", p_roman, p_mujer_sedentaria, "Disparidad de Ritmo Vital"),
        ("Natalia (Espacio reflexivo) x Carlos (Reactivo + Fusión 24/7)", p_natalia_indep, p_hombre_reactivo, "Riesgo Gottman y Descalce de Autonomía"),
        ("Cliente Activo x Sandra (Estado REFUND)", p_roman, p_candidato_refund, "Gatekeeper 0 de Estado Operativo")
    ]

    for title, c1, c2, expected_focus in tests:
        print(f"🔹 CASO: {title}")
        print(f"   Esperado: {expected_focus}")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        print(f"   🏆 Score Global: {res['score_global']}% | Veredicto: {res['veredicto']}")
        print(f"   📊 Desglose Ejes: {res.get('desglose_8_ejes', 'N/A')}")
        if res.get("deal_breakers"):
            print(f"   🛑 Dealbreakers: {res['deal_breakers']}")
        if res.get("puntos_friccion"):
            print(f"   ⚠️ Fricciones: {res['puntos_friccion']}")
        if res.get("sinergias_fuertes"):
            print(f"   ✨ Sinergias: {res['sinergias_fuertes']}")
        print(f"   💡 Guía Psicóloga: {res['recomendacion_psicologa']}")
        print("----------------------------------------------------------------------------------\n")

if __name__ == '__main__':
    asyncio.run(test_evaluator())
