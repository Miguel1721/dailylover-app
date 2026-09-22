"""
Golden Test Suite: Ejecutor de Pruebas Fijas de Regresión y Seguridad (25 Casos).
Se ejecuta con pytest o directamente con python3.
Garantiza que ningún cambio futuro en prompts o lógica de scoring rompa las reglas duras
o reintroduzca riesgos de seguridad.
"""

import os
import json
import pytest
import unittest
from typing import Tuple, Optional

# Importar funciones deterministas centrales del backend
from app.routers.matchmaking import (
    check_safety_red_flags,
    check_deterministic_hard_dealbreakers
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


if __name__ == "__main__":
    unittest.main()
