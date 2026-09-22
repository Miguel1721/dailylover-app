import unittest
import asyncio
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer

class TestOctagonalLLMSynthesizer(unittest.TestCase):
    def test_regex_fallback_when_llm_disabled(self):
        profile = asyncio.run(OctagonalPersonaSynthesizer.synthesize_profile_llm(
            user_id=1,
            name="Test Regex",
            city="Bogotá",
            gender="Hombre",
            age=35,
            bio_notes="Cerró la fábrica, se operó.",
            use_llm=False
        ))
        self.assertEqual(profile["metadata"]["extraction_engine"], "regex")
        self.assertEqual(profile["metadata"]["version_sintesis"], "2.0-octagonal")

    def test_short_notes_returns_regex(self):
        profile = asyncio.run(OctagonalPersonaSynthesizer.synthesize_profile_llm(
            user_id=2,
            name="Test Corto",
            city="Cali",
            gender="Mujer",
            age=28,
            bio_notes="Hola",
            use_llm=True
        ))
        self.assertEqual(profile["metadata"]["extraction_engine"], "regex")

    def test_llm_semantic_vasectomy_and_kids(self):
        profile = asyncio.run(OctagonalPersonaSynthesizer.synthesize_profile_llm(
            user_id=7841,
            name="Román Briceño",
            city="Bogotá",
            gender="Hombre",
            age=59,
            bio_notes="Se mandó a operar, cerró la fábrica de forma definitiva tras 3 hijos ya criados.",
            use_llm=True
        ))
        # Debe haber detectado vasectomía a través del LLM o fallback
        ejes = profile["ejes"]
        self.assertTrue(ejes["3_axiologia"]["vasectomia"], "Vasectomía no detectada semánticamente")
        self.assertFalse(ejes["3_axiologia"]["deseo_hijos"], "Deseo de hijos debe ser falso para hombre vasectomizado")

    def test_llm_semantic_rotating_shifts(self):
        profile = asyncio.run(OctagonalPersonaSynthesizer.synthesize_profile_llm(
            user_id=9504,
            name="Sandra Médica",
            city="Medellín",
            gender="Mujer",
            age=43,
            bio_notes="Enfermera jefe en urgencias, sus horarios cambian cada semana con turnos de 12 horas.",
            use_llm=True
        ))
        ejes = profile["ejes"]
        self.assertTrue(ejes["1_logistica"]["turnos_rotativos"], "Turnos rotativos no detectados")

    def test_llm_semantic_recent_grief(self):
        profile = asyncio.run(OctagonalPersonaSynthesizer.synthesize_profile_llm(
            user_id=1102,
            name="Camilo",
            city="Bogotá",
            gender="Hombre",
            age=32,
            bio_notes="En proceso de tusa tras convivencia de 4 años, se dejaron hace mes y medio.",
            use_llm=True
        ))
        ejes = profile["ejes"]
        self.assertTrue(ejes["2_timing"]["duelo_activo_reciente"], "Duelo reciente no detectado")

    def test_llm_semantic_willingness_to_travel(self):
        profile = asyncio.run(OctagonalPersonaSynthesizer.synthesize_profile_llm(
            user_id=1401,
            name="Valentina",
            city="Medellín",
            gender="Mujer",
            age=29,
            bio_notes="Teletrabaja al 100%, pasa tiempo entre Medellín y Miami, no le da pereza tomar avión cada 15 días.",
            use_llm=True
        ))
        ejes = profile["ejes"]
        self.assertTrue(ejes["1_logistica"]["disposicion_viajar"], "Disposición a viajar no detectada")

if __name__ == "__main__":
    unittest.main()
