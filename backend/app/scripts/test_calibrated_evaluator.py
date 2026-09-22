import unittest
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer

# Import current evaluator
from app.services.octagonal_match_evaluator import OctagonalMatchEvaluator

class TestCalibratedEngine(unittest.TestCase):
    def test_roman_59_vs_paula_19(self):
        roman = OctagonalPersonaSynthesizer.synthesize_profile(7841, "Román", "Bogotá", "Hombre", 59, bio_notes="Atleta máster 100m. Vasectomía cerrada.")
        paula = OctagonalPersonaSynthesizer.synthesize_profile(1001, "Paula", "Bogotá", "Mujer", 19, bio_notes="Estudiante universitaria. Relación estable.")
        
        # Test how it evaluates
        res = OctagonalMatchEvaluator.evaluate_match(roman, paula)
        print("\nTest Román (59a) vs Paula (19a):")
        print(f"  Score: {res['score_global']}% | Veredicto: {res['veredicto']}")
        print(f"  Ejes: {res['desglose_8_ejes']}")
        print(f"  Fricciones: {res['puntos_friccion']}")

    def test_bogota_vs_medellin_distance(self):
        jc = OctagonalPersonaSynthesizer.synthesize_profile(12254, "Juan Carlos", "Bogotá", "Hombre", 56, bio_notes="Ecopetrol. Horario estándar.")
        nat = OctagonalPersonaSynthesizer.synthesize_profile(9510, "Natalia", "Medellín", "Mujer", 32, bio_notes="Economista en Medellín. Horario estándar.")
        
        res = OctagonalMatchEvaluator.evaluate_match(jc, nat)
        print("\nTest Bogotá vs Medellín (sin movilidad):")
        print(f"  Score: {res['score_global']}% | Veredicto: {res['veredicto']}")
        print(f"  Logística: {res['desglose_8_ejes']['1_logistica']}%")
        print(f"  Fricciones: {res['puntos_friccion']}")

if __name__ == '__main__':
    unittest.main()
