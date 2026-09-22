import unittest
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer
from app.services.octagonal_match_evaluator import OctagonalMatchEvaluator
from app.routers.matchmaking import check_deterministic_hard_dealbreakers

class TestStrictDealbreakers(unittest.TestCase):

    def test_case_a_age_gap_over_8_without_note_discarded(self):
        """Caso A: Brecha > 8 años (15 años) sin notas específicas debe ser descartada de inmediato."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Carlos", "Bogotá", "Hombre", 45, bio_notes="Ingeniero en Bogotá.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Mariana", "Bogotá", "Mujer", 30, bio_notes="Diseñadora en Bogotá.")

        # Evaluador Octagonal
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(res["veredicto"], "NO RECOMENDADO")
        self.assertLessEqual(res["score_global"], 38)
        self.assertTrue(any("Incompatibilidad etaria" in d for d in res["deal_breakers"]))

        # Router Tier 1
        is_bad, reason = check_deterministic_hard_dealbreakers(
            {"name": "Carlos", "age": 45, "gender": "Hombre", "city": "Bogotá"},
            {"name": "Mariana", "age": 30, "gender": "Mujer", "city": "Bogotá"}
        )
        self.assertTrue(is_bad)
        self.assertIn("Incompatibilidad etaria", reason)

    def test_case_b_age_gap_between_8_and_10_with_explicit_note_allowed(self):
        """Caso B: Brecha entre 8 y 10 años (9 años) CON nota explícita que acepta mayores NO es dealbreaker."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Carlos", "Bogotá", "Hombre", 39, bio_notes="Ingeniero en Bogotá.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Mariana", "Bogotá", "Mujer", 30, bio_notes="Diseñadora en Bogotá. Le gustan mayores, acepta hasta 10 años mayor.")

        # Evaluador Octagonal
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        # No debe ser descartado como dealbreaker de edad
        self.assertFalse(any("Incompatibilidad etaria" in d for d in res.get("deal_breakers", [])))
        self.assertIn(res["veredicto"], ["VIABLE CON RESERVAS", "RECOMENDADO MODERADO", "RECOMENDADO ALTO"])

        # Router Tier 1
        is_bad, reason = check_deterministic_hard_dealbreakers(
            {"name": "Carlos", "age": 39, "gender": "Hombre", "city": "Bogotá"},
            {"name": "Mariana", "age": 30, "gender": "Mujer", "city": "Bogotá", "bio_notes": "Le gustan mayores, acepta hasta 10 años mayor."}
        )
        self.assertFalse(is_bad)

    def test_case_b2_age_gap_over_10_with_explicit_note_ALWAYS_discarded(self):
        """Caso B2: Brecha > 10 años (15 años) AUN CON nota explícita se DESCARTA SIEMPRE por política estricta de negocio."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Carlos", "Bogotá", "Hombre", 45, bio_notes="Ingeniero en Bogotá.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Mariana", "Bogotá", "Mujer", 30, bio_notes="Diseñadora en Bogotá. Le gustan mayores, acepta hasta 20 años mayor.")

        # Evaluador Octagonal
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(res["veredicto"], "NO RECOMENDADO")
        self.assertLessEqual(res["score_global"], 38)
        self.assertTrue(any("máximo 10 años permitido" in d for d in res.get("deal_breakers", [])))

        # Router Tier 1
        is_bad, reason = check_deterministic_hard_dealbreakers(
            {"name": "Carlos", "age": 45, "gender": "Hombre", "city": "Bogotá"},
            {"name": "Mariana", "age": 30, "gender": "Mujer", "city": "Bogotá", "bio_notes": "Le gustan mayores, acepta hasta 20 años mayor."}
        )
        self.assertTrue(is_bad)
        self.assertIn("máximo 10 años permitido", reason)

    def test_case_c_age_gap_within_8_allowed(self):
        """Caso C: Brecha <= 8 años (3 años) es completamente válida."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Andrés", "Bogotá", "Hombre", 34, bio_notes="Abogado.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Juliana", "Bogotá", "Mujer", 31, bio_notes="Médica.")

        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertFalse(any("Incompatibilidad etaria" in d for d in res.get("deal_breakers", [])))
        self.assertGreaterEqual(res["score_global"], 70)

        is_bad, reason = check_deterministic_hard_dealbreakers(
            {"name": "Andrés", "age": 34, "gender": "Hombre", "city": "Bogotá"},
            {"name": "Juliana", "age": 31, "gender": "Mujer", "city": "Bogotá"}
        )
        self.assertFalse(is_bad)

    def test_case_d_different_city_without_travel_discarded(self):
        """Caso D: Ciudades distintas (Bogotá x Medellín) sin disposición de viaje en notas se descartan."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Juan", "Bogotá", "Hombre", 32, bio_notes="Trabaja en oficina en Bogotá.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Sara", "Medellín", "Mujer", 30, bio_notes="Trabaja en Medellín.")

        # Evaluador Octagonal
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(res["veredicto"], "NO RECOMENDADO")
        self.assertLessEqual(res["score_global"], 38)
        self.assertTrue(any("Incompatibilidad geográfica" in d for d in res["deal_breakers"]))

        # Router Tier 1
        is_bad, reason = check_deterministic_hard_dealbreakers(
            {"name": "Juan", "age": 32, "gender": "Hombre", "city": "Bogotá"},
            {"name": "Sara", "age": 30, "gender": "Mujer", "city": "Medellín"}
        )
        self.assertTrue(is_bad)
        self.assertIn("Incompatibilidad territorial de ciudad", reason)

    def test_case_e_different_city_with_travel_allowed(self):
        """Caso E: Ciudades distintas (Bogotá x Medellín) CON disposición de viaje en notas NO se descarta de plano."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Juan", "Bogotá", "Hombre", 32, bio_notes="Trabaja en Bogotá. Abierto a viajar los fines de semana a otras ciudades.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Sara", "Medellín", "Mujer", 30, bio_notes="Trabaja en Medellín.")

        # Evaluador Octagonal
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertFalse(any("Incompatibilidad geográfica" in d for d in res.get("deal_breakers", [])))
        self.assertIn(res["veredicto"], ["VIABLE CON RESERVAS", "RECOMENDADO MODERADO"])
        self.assertTrue(any("Distancia intermunicipal con disposición de viaje" in f for f in res["puntos_friccion"]))

        # Router Tier 1
        is_bad, reason = check_deterministic_hard_dealbreakers(
            {"name": "Juan", "age": 32, "gender": "Hombre", "city": "Bogotá", "bio_notes": "Abierto a viajar los fines de semana a otras ciudades."},
            {"name": "Sara", "age": 30, "gender": "Mujer", "city": "Medellín"}
        )
        self.assertFalse(is_bad)

    def test_case_f_positive_match_young_adults_bogota(self):
        """Caso F: María José (22a) x Álvaro (26a) en Bogotá alcanza RECOMENDADO ALTO (≥80%)."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(6251, "Maria Jose", "Bogotá", "Mujer", 22, bio_notes="Psicologia en Bogota. Relacion estable.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(1234, "Alvaro", "Bogotá", "Hombre", 26, bio_notes="Ingeniero en Bogota. Relacion formal.")

        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(len(res.get("deal_breakers", [])), 0)
        self.assertGreaterEqual(res["score_global"], 80)
        self.assertEqual(res["veredicto"], "RECOMENDADO ALTO")
        self.assertTrue(any("Afinidad en momento vital" in s for s in res["sinergias_fuertes"]))

if __name__ == "__main__":
    unittest.main()
