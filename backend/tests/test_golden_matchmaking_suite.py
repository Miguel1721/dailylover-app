"""
Golden Test Suite: Ejecutor de Pruebas Fijas de Regresión y Seguridad (25 Casos).
Se ejecuta con pytest o directamente con python3.
Garantiza que ningún cambio futuro en prompts o lógica de scoring rompa las reglas duras
o reintroduzca riesgos de seguridad.
"""

import os
import json
import unittest
from typing import Tuple, Optional

# Importar funciones deterministas centrales del backend
from app.routers.matchmaking import (
    check_safety_red_flags,
    check_deterministic_hard_dealbreakers,
    build_canonical_profile,
    compare_canonical_profiles
)

REGISTRY_PATH = os.path.join(os.path.dirname(__file__), "golden_cases_registry.json")


class TestGoldenMatchmakingSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
            cls.registry = json.load(f)
        cls.cases = {c["id"]: c for c in cls.registry["test_cases"]}

    # =========================================================================
    # BLOQUE 1: RED FLAGS DE SEGURIDAD (AGRESORES Y RIESGOS INFRANQUEABLES)
    # =========================================================================
    def test_gt01_camilo_prieto_violencia(self):
        """GT-01: Camilo Prieto con antecedentes de violencia física debe ser descalificado."""
        cand = {
            "name": "Camilo Humberto Prieto Fetiva",
            "bio_notes": "Abogado y docente. Tiene antecedentes de violencia fisica en pareja. Busca relación seria."
        }
        is_risk, reason = check_safety_red_flags(cand)
        self.assertTrue(is_risk, "Camilo Prieto debe ser detectado como riesgo de seguridad")
        self.assertIn("VIOLENCIA/AGRESIÓN", reason)

    def test_gt02_camilo_prieto_variacion_notas(self):
        """GT-02: Detección en notas alternativas o síntesis clínica."""
        cand = {
            "name": "Camilo Prieto",
            "synthesis": "Tiene antecedentes de violencia en su última relación de pareja."
        }
        is_risk, reason = check_safety_red_flags(cand)
        self.assertTrue(is_risk)

    def test_gt03_camilo_prieto_denuncia(self):
        """GT-03: Detección por orden de alejamiento o medida de protección."""
        cand = {
            "name": "Persona X",
            "bio_notes": "Presenta medida de protección en su contra vigente por agresión."
        }
        is_risk, reason = check_safety_red_flags(cand)
        self.assertTrue(is_risk)

    # =========================================================================
    # BLOQUE 2: PROTECCIÓN INVIOLABLE A VÍCTIMAS (CERO FALSOS POSITIVOS)
    # =========================================================================
    def test_gt04_julian_cubillos_limite_personal(self):
        """GT-04: Julian Cubillos (declara no tolerar violencia como víctima) NO debe ser penalizado."""
        cand = {
            "name": "Julian Cubillos",
            "bio_notes": "Aprendizajes: No quiere volver a vivir relaciones marcadas por: Celos, Toxicidad, Violencia física o verbal."
        }
        is_risk, reason = check_safety_red_flags(cand)
        self.assertFalse(is_risk, f"Julian Cubillos no debe ser marcado como riesgo. Razón dada: {reason}")

    def test_gt05_valentina_rodriguez_evento_traumatico(self):
        """GT-05: Valentina Rodríguez (víctima de evento traumático en su pasado) NO debe ser descalificada."""
        cand = {
            "name": "Valentina Rodriguez Perez",
            "bio_notes": "A nivel de salud, tuvo un evento traumático (abuso sexual) a los 19 años, lo que derivó en estrés postraumático."
        }
        is_risk, reason = check_safety_red_flags(cand)
        self.assertFalse(is_risk, f"Valentina es víctima y debe estar protegida. Razón dada: {reason}")

    def test_gt06_andrea_duran_abuso_en_matrimonio_previo(self):
        """GT-06: Andrea Durán (identificó abuso en matrimonio previo con expareja) NO debe ser descalificada."""
        cand = {
            "name": "Andrea Duran Yepes",
            "bio_notes": "12 años de convivencia... identificó después abuso sexual normalizado dentro de esa relación con su expareja."
        }
        is_risk, reason = check_safety_red_flags(cand)
        self.assertFalse(is_risk, f"Andrea es víctima en relación previa y debe estar protegida. Razón dada: {reason}")

    def test_gt07_jorge_camacho_expareja_suicidio(self):
        """GT-07: Jorge Camacho (su expareja tenía intentos de suicidio) NO debe ser penalizado."""
        cand = {
            "name": "Jorge Camacho",
            "bio_notes": "Se casó muy enamorado, sabía que ella venía con temas de salud mental, TLP e intentos de suicidio. Él huyó de eso."
        }
        is_risk, reason = check_safety_red_flags(cand)
        self.assertFalse(is_risk, f"Jorge Camacho no debe ser penalizado por antecedentes de su expareja. Razón dada: {reason}")

    def test_gt08_lucia_rodriguez_no_negociable_drogas(self):
        """GT-08: Lucía Rodríguez (exige que su pareja no tenga adicciones) NO debe ser marcada como adicta."""
        cand = {
            "name": "Lucia Rodríguez",
            "bio_notes": "Qué busca: Inteligencia emocional. No negociable: NO adiccion a las drogas. NO fume."
        }
        is_risk, reason = check_safety_red_flags(cand)
        self.assertFalse(is_risk, f"Lucía exige no adicciones en su pareja. Razón dada: {reason}")

    def test_gt09_marco_ruiz_rechazo_adicciones(self):
        """GT-09: Marco Ruiz (rechaza personas con adicciones) NO debe ser penalizado."""
        cand = {
            "name": "Marco Ruiz",
            "bio_notes": "Filtros fuertes: no drogas, no alcohol ni adicciones. Personas con consumo problemático de alcohol o drogas."
        }
        is_risk, reason = check_safety_red_flags(cand)
        self.assertFalse(is_risk, f"Marco rechaza drogas, no es consumidor. Razón dada: {reason}")

    # =========================================================================
    # BLOQUE 3: ADICCIONES ACTIVAS, DELITOS Y PSIQUIÁTRICO AGUDO
    # =========================================================================
    def test_gt10_adiccion_activa_severa(self):
        """GT-10: Perfil con consumo problemático de drogas o alcoholismo activo severo."""
        cand = {
            "name": "Candidato Adicto Activo",
            "bio_notes": "Registra consumo problemático de cocaína a diario y adicción activa severa sin rehabilitación."
        }
        is_risk, reason = check_safety_red_flags(cand)
        self.assertTrue(is_risk)
        self.assertIn("ADICCIÓN SEVERA ACTIVA", reason)

    def test_gt11_delito_penal_grave_estafa(self):
        """GT-11: Perfil condenado por estafa o con orden de captura."""
        cand = {
            "name": "Candidato Delitos",
            "bio_notes": "Estuvo en la cárcel por estafa y presenta orden de captura activa."
        }
        is_risk, reason = check_safety_red_flags(cand)
        self.assertTrue(is_risk)
        self.assertIn("DELITO/PENAL GRAVE", reason)

    def test_gt12_riesgo_psiquiatrico_agudo(self):
        """GT-12: Ideación suicida activa o brote psicótico propio."""
        cand = {
            "name": "Candidato Riesgo Vital",
            "bio_notes": "En entrevista manifiesta ideación suicida activa y brote psicótico no compensado."
        }
        is_risk, reason = check_safety_red_flags(cand)
        self.assertTrue(is_risk)
        self.assertIn("RIESGO PSIQUIÁTRICO AGUDO", reason)

    # =========================================================================
    # BLOQUE 4: REGLAS DURAS DETERMINISTAS EN TIER 1 (0% IA, 0 TOKENS)
    # =========================================================================
    def test_gt13_menor_de_edad_estricto(self):
        """GT-13: Menor de 18 años debe ser descartado inmediatamente en Tier 1."""
        cli = {"name": "Cliente Adulto", "age": 28, "gender": "Hombre"}
        cand = {"name": "Candidata Joven", "age": 16, "gender": "Mujer"}
        is_bad, reason = check_deterministic_hard_dealbreakers(cli, cand)
        self.assertTrue(is_bad)
        self.assertIn("Incompatibilidad etaria legal", reason)

    def test_gt14_edad_corrupta_crm(self):
        """GT-14: Edad negativa (-1 o 0) debe ser descartada en Tier 1."""
        cli = {"name": "Cliente Adulto", "age": 30, "gender": "Hombre"}
        cand = {"name": "Candidato Corrupto", "age": -1, "gender": "Mujer"}
        is_bad, reason = check_deterministic_hard_dealbreakers(cli, cand)
        self.assertTrue(is_bad)
        self.assertIn("Incompatibilidad etaria legal", reason)

    def test_gt15_mismo_sexo_heterosexual(self):
        """GT-15: Mismo sexo cuando al menos uno es heterosexual declarado."""
        cli = {"name": "Juan", "gender": "Hombre", "orientation": "Heterosexual"}
        cand = {"name": "Pedro", "gender": "Hombre", "orientation": "Heterosexual"}
        is_bad, reason = check_deterministic_hard_dealbreakers(cli, cand)
        self.assertTrue(is_bad)
        self.assertIn("Incompatibilidad de orientación sexual", reason)

    def test_gt16_orientacion_cruzada_gay(self):
        """GT-16: Hombre gay vs mujer."""
        cli = {"name": "Carlos", "gender": "Hombre", "orientation": "Homosexual"}
        cand = {"name": "Laura", "gender": "Mujer", "orientation": "Heterosexual"}
        is_bad, reason = check_deterministic_hard_dealbreakers(cli, cand)
        self.assertTrue(is_bad)
        self.assertIn("Incompatibilidad de orientación sexual", reason)

    def test_gt17_ciudad_incompatible(self):
        """GT-17: Bogotá vs Medellín (clusters territoriales incompatibles)."""
        cli = {"name": "Maria", "gender": "Mujer", "city": "Bogotá"}
        cand = {"name": "Andres", "gender": "Hombre", "city": "Medellín"}
        is_bad, reason = check_deterministic_hard_dealbreakers(cli, cand)
        self.assertTrue(is_bad)
        self.assertIn("Incompatibilidad territorial de ciudad", reason)

    def test_gt18_dealbreaker_hijos_no_negociable(self):
        """GT-18: Cliente exige 'no personas con hijos' y candidato tiene hijos."""
        cli = {
            "name": "Natalia",
            "gender": "Mujer",
            "search_preferences": {"non_negotiables": ["No personas con hijos"]}
        }
        cand = {
            "name": "Fernando",
            "gender": "Hombre",
            "lifestyle": {"has_children": "Sí (2 hijos)"}
        }
        is_bad, reason = check_deterministic_hard_dealbreakers(cli, cand)
        self.assertTrue(is_bad)
        self.assertIn("Dealbreaker de hijos", reason)

    def test_gt19_edad_fuera_de_rango(self):
        """GT-19: Candidato excede la edad máxima exigida por el cliente."""
        cli = {
            "name": "Valentina",
            "age": 25,
            "gender": "Mujer",
            "search_preferences": {"min_age": 26, "max_age": 34}
        }
        cand = {
            "name": "Rodrigo",
            "age": 42,
            "gender": "Hombre"
        }
        is_bad, reason = check_deterministic_hard_dealbreakers(cli, cand)
        self.assertTrue(is_bad)
        self.assertIn("Incompatibilidad etaria", reason)

    # =========================================================================
    # BLOQUE 5: VERIFICACIÓN DE BENCHMARK EN PRODUCCIÓN (15 CLIENTES REALES)
    # =========================================================================
    def test_gt20_to_gt25_production_benchmark_evidence(self):
        """GT-20 a GT-25: Verificar que el benchmark oficial de 15 clientes en producción cumpla los criterios."""
        bench_path = os.path.join(os.path.dirname(__file__), "../app/scripts/benchmark_results_production.json")
        self.assertTrue(os.path.exists(bench_path), "El benchmark de producción debe existir")
        with open(bench_path, "r", encoding="utf-8") as f:
            bench_data = json.load(f)

        results = bench_data.get("results", [])
        self.assertEqual(len(results), 15, "Deben evaluarse los 15 clientes completos")

        # GT-21: Nelson David Calderón
        nelson = next((r for r in results if "Nelson David" in r["target_client"]), None)
        self.assertIsNotNone(nelson)
        self.assertGreater(nelson["suggested_matches_count"], 0)
        self.assertIn(nelson["top_match"]["ai_veredicto"], ["RECOMENDADO", "VIABLE BUENO"])

        # GT-22: Sharon Nicolle Gil
        sharon = next((r for r in results if "Sharon" in r["target_client"]), None)
        self.assertIsNotNone(sharon)
        self.assertEqual(sharon["top_match"]["ai_veredicto"], "RECOMENDADO")

        # GT-23: Maria Alejandra Marroquin
        aleja = next((r for r in results if "Maria Alejandra" in r["target_client"]), None)
        self.assertIsNotNone(aleja)
        self.assertEqual(aleja["top_match"]["ai_veredicto"], "RECOMENDADO")

        # GT-24: Laura Alza
        laura = next((r for r in results if "Laura Alza" in r["target_client"]), None)
        self.assertIsNotNone(laura)
        self.assertEqual(laura["top_match"]["ai_veredicto"], "RECOMENDADO")

        # GT-25: Carlos Arturo Vargas Nocua (Protección de 120 candidatos incompatibles)
        carlos = next((r for r in results if "Carlos Arturo" in r["target_client"]), None)
        self.assertIsNotNone(carlos)
        self.assertEqual(carlos["suggested_matches_count"], 0, "No debe alucinar matches cuando todos son incompatibles")

    # =========================================================================
    # BLOQUE 6: MOTOR FACTUAL CANÓNICO Y ANTI-ALUCINACIÓN (GT-26 a GT-31)
    # =========================================================================
    def test_gt26_julieth_daniel_age_sport_gap(self):
        """GT-26: Julieth (34a) x Daniel (tope 33a, deporte constante vs principiante)."""
        p_julieth = {
            "name": "Julieth Angulo Jara",
            "completeness_pct": 80,
            "verified_data": {
                "edad": 34,
                "ciudad": "Bogotá",
                "genero": "Mujer",
                "orientacion": "Heterosexual",
                "profesion": "Arquitecta",
                "hijos_actuales": "No",
                "deseo_hijos": "Sí",
                "deporte_nivel": "Principiante",
                "lenguaje_amor": "Tiempo de calidad",
                "estatura_cm": 155
            },
            "preferences": {}
        }
        p_daniel = {
            "name": "Daniel Acosta",
            "completeness_pct": 74,
            "verified_data": {
                "edad": 30,
                "ciudad": "Bogotá",
                "genero": "Hombre",
                "orientacion": "Heterosexual",
                "profesion": "Ingeniero ambiental",
                "hijos_actuales": "No",
                "deseo_hijos": None,  # Ausente en Daniel
                "deporte_nivel": "Constante",
                "lenguaje_amor": "Tiempo de calidad",
                "estatura_cm": 175
            },
            "preferences": {
                "edad_max": 33,
                "busca_pareja_deportiva": True,
                "estatura_max_cm": 170
            }
        }
        res = compare_canonical_profiles(p_julieth, p_daniel)
        self.assertEqual(res["veredicto"], "VIABLE CON RESERVAS")
        self.assertLessEqual(res["score_factual"], 62)
        disc_text = " ".join(res["discrepancias_reales"])
        self.assertIn("Fuera de rango de edad", disc_text)
        self.assertIn("Brecha deportiva", disc_text)
        coin_text = " ".join(res["coincidencias_verificadas"])
        self.assertIn("Tiempo de calidad", coin_text)
        self.assertIn("Estatura cumplida", coin_text)
        pend_text = " ".join(res["pendientes_entrevista"])
        self.assertIn("Daniel Acosta", pend_text)
        self.assertIn("apego", pend_text)

    def test_gt27_daniela_hernando_high_affinity(self):
        """GT-27: Daniela Ordoñez x Hernando 31 (ambos en Bogotá, sin discrepancias críticas)."""
        p_daniela = {
            "name": "Daniela Ordoñez",
            "completeness_pct": 80,
            "verified_data": {
                "edad": 27,
                "ciudad": "Bogotá",
                "genero": "Mujer",
                "orientacion": "Heterosexual",
                "profesion": "Consultora en Health-Tech",
                "hijos_actuales": "Sí",
                "deseo_hijos": "Tal vez",
                "deporte_nivel": "Constante",
                "lenguaje_amor": "Actos de servicio",
                "estilo_apego": "Ansioso"
            },
            "preferences": {}
        }
        p_hernando = {
            "name": "Hernando 31",
            "completeness_pct": 80,
            "verified_data": {
                "edad": 30,
                "ciudad": "Bogotá",
                "genero": "Hombre",
                "orientacion": "Heterosexual",
                "profesion": "Nutricionista infantil",
                "hijos_actuales": "No",
                "deseo_hijos": "Yes",
                "deporte_nivel": "Fitness lover",
                "lenguaje_amor": "Physical touch",
                "estilo_apego": None
            },
            "preferences": {}
        }
        res = compare_canonical_profiles(p_daniela, p_hernando)
        self.assertEqual(res["veredicto"], "RECOMENDADO")
        self.assertGreaterEqual(res["score_factual"], 80)
        self.assertEqual(len(res["discrepancias_reales"]), 0)
        coin_text = " ".join(res["coincidencias_verificadas"])
        self.assertIn("Bogotá", coin_text)
        self.assertIn("Edades afines", coin_text)

    def test_gt28_enrique_mariapaula_children_city_clash(self):
        """GT-28: Enrique Triana (Bogotá, NO hijos) x Maria Paula Perdomo (Cali, SÍ hijos)."""
        p_enrique = {
            "name": "Enrique Triana",
            "completeness_pct": 80,
            "verified_data": {
                "edad": 31,
                "ciudad": "Bogotá",
                "genero": "Hombre",
                "orientacion": "Heterosexual",
                "profesion": "Analista back office",
                "hijos_actuales": "No",
                "deseo_hijos": "No",
                "deporte_nivel": "Principiante",
                "lenguaje_amor": "Tiempo de calidad",
                "estatura_cm": 172
            },
            "preferences": {}
        }
        p_mariapaula = {
            "name": "Maria Paula Perdomo Giraldo",
            "completeness_pct": 80,
            "verified_data": {
                "edad": 30,
                "ciudad": "Cali",
                "genero": "Mujer",
                "orientacion": "Heterosexual",
                "profesion": "Empleada",
                "hijos_actuales": "No",
                "deseo_hijos": "Sí",
                "deporte_nivel": "Constante",
                "lenguaje_amor": "Contacto físico",
                "estilo_apego": None
            },
            "preferences": {
                "estatura_max_cm": 170
            }
        }
        res = compare_canonical_profiles(p_enrique, p_mariapaula)
        disc_text = " ".join(res["discrepancias_reales"])
        self.assertIn("proyecto familiar", disc_text)
        self.assertIn("Ciudades distintas", disc_text)
        self.assertEqual(res["veredicto"], "VIABLE CON RESERVAS")
        self.assertLessEqual(res["score_factual"], 62)

    def test_gt29_karen_juan_incomplete_profile_and_children_clash(self):
        """GT-29: Karen Arias (Financiera, SÍ hijos, ciudad null) x Juan Hosman (NO hijos)."""
        p_karen = {
            "name": "Karen Arias",
            "completeness_pct": 55,
            "verified_data": {
                "edad": 29,
                "ciudad": None,
                "genero": "Mujer",
                "orientacion": "Heterosexual",
                "profesion": "Financiera",
                "hijos_actuales": "Sí",
                "deseo_hijos": "Sí",
                "deporte_nivel": "No entrena",
                "lenguaje_amor": "Actos de servicio",
                "estilo_apego": None
            },
            "preferences": {}
        }
        p_juan = {
            "name": "Juan Hosman",
            "completeness_pct": 80,
            "verified_data": {
                "edad": 37,
                "ciudad": "Bogotá",
                "genero": "Hombre",
                "orientacion": "Heterosexual",
                "profesion": "Analista back office",
                "hijos_actuales": "No",
                "deseo_hijos": "No",
                "deporte_nivel": "Principiante",
                "lenguaje_amor": "Tiempo de calidad",
                "estilo_apego": None
            },
            "preferences": {}
        }
        res = compare_canonical_profiles(p_karen, p_juan)
        disc_text = " ".join(res["discrepancias_reales"])
        self.assertIn("proyecto familiar", disc_text)
        pend_text = " ".join(res["pendientes_entrevista"])
        self.assertIn("Ciudad de residencia no confirmada", pend_text)
        self.assertIn("apego", pend_text)

    def test_gt30_luna_ricardo_age_gap(self):
        """GT-30: Luna Lily García (37a, tope 45) x Ricardo Colon (55a, Medellín)."""
        p_luna = {
            "name": "Luna Lily García Piedra",
            "completeness_pct": 75,
            "verified_data": {
                "edad": 37,
                "ciudad": "Medellín",
                "genero": "Mujer",
                "orientacion": "Heterosexual",
                "profesion": "Diseñadora",
                "hijos_actuales": "No",
                "deseo_hijos": "No",
                "lenguaje_amor": "Tiempo de calidad"
            },
            "preferences": {
                "edad_max": 45
            }
        }
        p_ricardo = {
            "name": "Ricardo Colon",
            "completeness_pct": 50,
            "verified_data": {
                "edad": 55,
                "ciudad": "Medellín",
                "genero": "Hombre",
                "orientacion": "Heterosexual",
                "profesion": "Empresario",
                "hijos_actuales": "Sí",
                "deseo_hijos": "No",
                "lenguaje_amor": "Actos de servicio"
            },
            "preferences": {}
        }
        res = compare_canonical_profiles(p_luna, p_ricardo)
        disc_text = " ".join(res["discrepancias_reales"])
        self.assertIn("Fuera de rango de edad", disc_text)
        coin_text = " ".join(res["coincidencias_verificadas"])
        self.assertIn("Medellín", coin_text)

    def test_gt31_canonical_extraction_strict_nulls(self):
        """GT-31: Extracción Canónica estricta con NULLs explícitos cuando no hay datos."""
        raw_empty = {
            "prof_192": None,
            "prof_194": None,
            "prof_201": "No especificado",
            "prof_202": None,
            "prof_220": None
        }
        canon = build_canonical_profile(
            user_id=99999,
            name="Cliente Vacío",
            crm_id="99999",
            raw_wh=raw_empty,
            p_row=None,
            ext_row=None
        )
        v = canon["verified_data"]
        self.assertNotIn("ciudad", v, "Ciudad no debe estar en verified_data si no está confirmada")
        self.assertIn("ciudad", canon["missing_data"], "Ciudad debe estar catalogada explícitamente en missing_data")
        self.assertNotIn("estilo_apego", v, "Estilo de apego no debe inventarse como 'Apego Seguro'")
        self.assertIn("estilo_apego", canon["missing_data"], "Estilo de apego debe estar en missing_data")
        self.assertNotIn("deseo_hijos", v, "Deseo de hijos no debe autocompletarse afirmativo")
        self.assertIn("deseo_hijos", canon["missing_data"], "Deseo de hijos debe estar en missing_data")
        self.assertLessEqual(canon["completeness_pct"], 35)

        p_otro = {
            "name": "Otro Cliente",
            "completeness_pct": 20,
            "verified_data": {"genero": "Hombre", "orientacion": "Heterosexual"},
            "preferences": {}
        }
        res = compare_canonical_profiles(canon, p_otro)
        self.assertEqual(res["veredicto"], "DATOS INSUFICIENTES (ENTREVISTA PENDIENTE)")
        self.assertEqual(res["score_factual"], 55)


if __name__ == "__main__":
    unittest.main()
