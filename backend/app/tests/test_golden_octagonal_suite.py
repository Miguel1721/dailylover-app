"""
Golden Octagonal Test Suite (40 Casos de Prueba).
Valida la arquitectura completa del motor de matchmaking en 8 Ejes Vinculares,
el saneamiento de base de datos, los Victim Guards y la Regla del Eslabón Débil.
"""

import unittest
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer
from app.services.octagonal_match_evaluator import OctagonalMatchEvaluator
from app.routers.matchmaking import (
    check_safety_red_flags,
    check_deterministic_hard_dealbreakers
)

class TestGoldenOctagonalSuite(unittest.TestCase):

    # =========================================================================
    # BLOQUE 1: RED FLAGS DE SEGURIDAD Y VICTIM GUARDS (GT-01 a GT-10)
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

    def test_gt10_incompatibilidad_etaria(self):
        """GT-10: Candidato excede la edad máxima exigida por el cliente."""
        cli = {"name": "Valentina", "age": 25, "gender": "Mujer", "search_preferences": {"min_age": 26, "max_age": 34}}
        cand = {"name": "Rodrigo", "age": 42, "gender": "Hombre"}
        is_bad, reason = check_deterministic_hard_dealbreakers(cli, cand)
        self.assertTrue(is_bad)
        self.assertIn("Incompatibilidad etaria", reason)

    # =========================================================================
    # BLOQUE 2: GATEKEEPER OPERATIVO Y BASE DE DATOS (GT-11 a GT-15)
    # =========================================================================
    def test_gt11_gatekeeper_refund_bloqueado(self):
        """GT-11: Candidato en estado REFUND es descartado en Gatekeeper 0."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Cliente", "Bogotá", "Hombre", 30)
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Candidata", "Bogotá", "Mujer", 28, lifestyle={"availability_status": "REFUND"})
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(res["veredicto"], "NO RECOMENDADO (BLOQUEADO)")
        self.assertLessEqual(res["score_global"], 20)

    def test_gt12_gatekeeper_en_pareja_bloqueado(self):
        """GT-12: Candidato saliendo con alguien / EN_PAREJA queda bloqueado."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Cliente", "Bogotá", "Hombre", 30)
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Candidata", "Bogotá", "Mujer", 28, lifestyle={"availability_status": "EN_PAREJA"})
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(res["veredicto"], "NO RECOMENDADO (BLOQUEADO)")

    def test_gt13_genero_invertido_daniella_lozada(self):
        """GT-13: Reconciliación de Daniella Lozada (UID 13747) como Mujer."""
        syn = OctagonalPersonaSynthesizer.synthesize_profile(
            user_id=13747, name="Daniella Lozada", city="Bogotá", gender="Mujer", age=29,
            bio_notes="Es una ingeniera industrial, soltera, busca un hombre para compartir."
        )
        self.assertEqual(syn["metadata"]["gender"], "Mujer")

    def test_gt14_hijos_fantasma_recuperados(self):
        """GT-14: Detección de hijos en notas cuando CRM decía No."""
        syn = OctagonalPersonaSynthesizer.synthesize_profile(
            user_id=9702, name="Angel Arteaga", city="Bogotá", gender="Hombre", age=36,
            bio_notes="Tiene 2 hijos que viven con la mamá. Los ve fines de semana."
        )
        self.assertTrue(syn["ejes"]["3_axiologia"]["tiene_hijos"])

    def test_gt15_ciudad_contaminada_sanitizada(self):
        """GT-15: Ciudad 'Med 49 años' sanitizada a 'Medellín'."""
        from app.scripts.sanitize_database_structural_data import clean_city_name
        cleaned = clean_city_name("Med 49 años")
        self.assertEqual(cleaned, "Medellín")

    # =========================================================================
    # BLOQUE 3: CAPA 1 CIMIENTOS DUROS — EJE 1, 2, 3 (GT-16 a GT-25)
    # =========================================================================
    def test_gt16_vasectomia_vs_deseo_hijos(self):
        """GT-16: Román Briceño (Vasectomía) x Mujer que desea hijos -> NO RECOMENDADO."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(7841, "Román", "Bogotá", "Hombre", 59, bio_notes="Vasectomía, no quiere más hijos.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(9901, "Carolina", "Bogotá", "Mujer", 53, bio_notes="Desea tener hijos y ser madre pronto.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(res["veredicto"], "NO RECOMENDADO")
        self.assertTrue(any("Incompatibilidad biológica" in d for d in res["deal_breakers"]))
        self.assertLessEqual(res["score_global"], 38)

    def test_gt17_veto_politico_izquierda(self):
        """GT-17: Cliente veta izquierda frente a candidato de izquierda."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Cliente", "Bogotá", "Hombre", 35, bio_notes="Cero izquierda, no petrista.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Candidata", "Bogotá", "Mujer", 32, bio_notes="Es de izquierda, feminista activa.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(res["veredicto"], "NO RECOMENDADO")
        self.assertIn("Incompatibilidad política", res["deal_breakers"][0])

    def test_gt18_veto_politico_derecha(self):
        """GT-18: Cliente veta derecha frente a candidato de derecha."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Cliente", "Bogotá", "Mujer", 28, bio_notes="Derecha extrema red flag, no uribista.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Candidato", "Bogotá", "Hombre", 30, bio_notes="Es de derecha conservador.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(res["veredicto"], "NO RECOMENDADO")

    def test_gt19_desfase_intencion_matrimonio_vs_casual(self):
        """GT-19: Intención de matrimonio en 1 año vs casual sin afán."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Cliente", "Bogotá", "Mujer", 32, bio_notes="Desea casarse y formar familia.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Candidato", "Bogotá", "Hombre", 34, bio_notes="Quiere algo casual y pasar el rato.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(res["veredicto"], "VIABLE CON RESERVAS")
        self.assertIn("Desfase de intención", res["puntos_friccion"][0])

    def test_gt20_duelo_reciente_penalizado(self):
        """GT-20: Ruptura sentimental de 1 mes penalizada."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Cliente", "Bogotá", "Mujer", 30, bio_notes="Relación estable.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Candidato", "Bogotá", "Hombre", 32, bio_notes="Separado hace 1 mes tras 17 años.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(res["veredicto"], "VIABLE CON RESERVAS")
        self.assertTrue(any("Ruptura sentimental reciente" in f for f in res["puntos_friccion"]))

    def test_gt21_choque_fe_devota_vs_ateo(self):
        """GT-21: Devoción estricta frente a ateísmo militante."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Cliente", "Medellín", "Mujer", 27, bio_notes="Misa todos los sábados, muy creyente.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Candidato", "Medellín", "Hombre", 29, bio_notes="Ateo convencido, cero religión.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertTrue(any("Tensión axiológica de fe" in f for f in res["puntos_friccion"]))

    def test_gt22_choque_proveedor_vs_50_50(self):
        """GT-22: Exigencia de proveedor tradicional frente a 50/50 estricto."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Sandra", "Medellín", "Mujer", 43, bio_notes="No proveedor es dealbreaker.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Hombre 50/50", "Medellín", "Hombre", 45, bio_notes="50-50 en todo, no mantener a nadie.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertTrue(any("Choque financiero" in f for f in res["puntos_friccion"]))

    def test_gt23_rotacion_extrema_30x21_turquia(self):
        """GT-23: Detección de trabajo en Turquía régimen 30x21 (Javier Lemus)."""
        syn = OctagonalPersonaSynthesizer.synthesize_profile(12482, "Javier", "Zipaquirá", "Hombre", 38, bio_notes="Trabaja 30 dias en Turquia y descansa 3 semanas.")
        self.assertTrue(syn["ejes"]["1_logistica"]["profesion_alta_movilidad"])

    def test_gt24_custodia_compartida_semanal(self):
        """GT-24: Custodia compartida semana de por medio (Andrea Rojas)."""
        syn = OctagonalPersonaSynthesizer.synthesize_profile(7502, "Andrea", "Bogotá", "Mujer", 37, bio_notes="Custodia compartida, semana con ella y semana con el papa.")
        self.assertTrue(syn["ejes"]["1_logistica"]["custodia_compartida_semanal"])

    def test_gt25_identidad_transgenero_reconocida(self):
        """GT-25: Samuel Pinzón reconocido como hombre transgénero."""
        syn = OctagonalPersonaSynthesizer.synthesize_profile(12837, "Samuel", "Bogotá", "Hombre", 27, bio_notes="Hombre transgenero en proceso de transicion.")
        self.assertTrue(syn["metadata"]["es_trans"])

    # =========================================================================
    # BLOQUE 4: CAPA 2 CONVIVENCIA Y REGULACIÓN (GT-26 a GT-33)
    # =========================================================================
    def test_gt26_disparidad_atleta_vs_sedentaria(self):
        """GT-26: Román (Atleta 59a) x Adriana (Sedentaria 52a) limitado a VIABLE CON RESERVAS."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(7841, "Román", "Bogotá", "Hombre", 59, bio_notes="Mundial de atletismo 100m, entrena 2 veces al dia.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(9902, "Adriana", "Bogotá", "Mujer", 52, bio_notes="Muy sedentaria, planes caseros, dormir a las 8.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(res["veredicto"], "VIABLE CON RESERVAS")
        self.assertLessEqual(res["score_global"], 64)
        self.assertTrue(any("Disparidad crítica de ritmo vital" in f for f in res["puntos_friccion"]))

    def test_gt27_gottman_demanda_retirada(self):
        """GT-27: Tiempo fuera reflexivo x Reactivo impulsivo."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Natalia", "Bogotá", "Mujer", 31, bio_notes="Tomarse un espacio para pensar antes de hablar.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Carlos", "Bogotá", "Hombre", 33, bio_notes="Impulsivo, puede contestar feo.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(res["veredicto"], "VIABLE CON RESERVAS")
        self.assertTrue(any("Riesgo Gottman" in f for f in res["puntos_friccion"]))

    def test_gt28_autonomia_vs_fusion_24_7(self):
        """GT-28: Hiper-independiente x Fusión 24/7."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Adalín", "Bogotá", "Hombre", 39, bio_notes="Muy independiente, no asfixiante, cero espacio personal red flag.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Andrea", "Bogotá", "Mujer", 34, bio_notes="Quiere todo 24/7, necesidad constante de atencion.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertEqual(res["veredicto"], "VIABLE CON RESERVAS")
        self.assertTrue(any("Descalce de intimidad" in f for f in res["puntos_friccion"]))

    def test_gt29_doble_custodia_alerta_sincronia(self):
        """GT-29: Dos personas con custodia semanal alertan sincronización."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Madre", "Bogotá", "Mujer", 37, bio_notes="Custodia compartida semana de por medio.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Padre", "Bogotá", "Hombre", 38, bio_notes="Custodia compartida semana por medio.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertTrue(any("Ambos tienen custodia compartida" in f for f in res["puntos_friccion"]))

    def test_gt30_enfermera_turnos_12h_nocturnos(self):
        """GT-30: Turnos de 12 horas nocturnos detectados."""
        syn = OctagonalPersonaSynthesizer.synthesize_profile(9504, "Sandra", "Medellín", "Mujer", 43, bio_notes="Turnos rotativos de 12 horas, trabaja de noche.")
        self.assertTrue(syn["ejes"]["1_logistica"]["turnos_rotativos"])
        self.assertTrue(syn["ejes"]["1_logistica"]["turno_nocturno"])

    def test_gt31_piloto_latam_disponibilidad(self):
        """GT-31: Piloto de LATAM con alta movilidad."""
        syn = OctagonalPersonaSynthesizer.synthesize_profile(13326, "Angie", "Bogotá", "Mujer", 28, bio_notes="Piloto de LATAM, descansos entre semana.")
        self.assertTrue(syn["ejes"]["1_logistica"]["profesion_alta_movilidad"])

    def test_gt32_sinergia_vitalidad_compartida(self):
        """GT-32: Dos personas con vitalidad compartida generan sinergia."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Atleta 1", "Bogotá", "Hombre", 35, bio_notes="Entrena 2 veces al dia, maraton.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Atleta 2", "Bogotá", "Mujer", 33, bio_notes="Triatlon, deportista de alto rendimiento.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertTrue(any("Sintonía de energía vital compartida" in s for s in res["sinergias_fuertes"]))

    def test_gt33_sinergia_modelo_financiero_compartido(self):
        """GT-33: Dos personas con modelo 50/50 generan sinergia."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Hombre", "Bogotá", "Hombre", 32, bio_notes="50-50 en todo, ambos aporten.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Mujer", "Bogotá", "Mujer", 30, bio_notes="50-50, independencia economica mutua.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertTrue(any("Alineación financiera compartida" in s for s in res["sinergias_fuertes"]))

    # =========================================================================
    # BLOQUE 5: CAPA 3 Y MATCHES ARMONIOSOS (GT-34 a GT-40)
    # =========================================================================
    def test_gt34_polaridad_tradicional_sintonizada(self):
        """GT-34: Dinámica tradicional compartida genera sinergia."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(1, "Hombre", "Bogotá", "Hombre", 38, bio_notes="Hombre que resuelva, liderazgo, caballero.")
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(2, "Mujer", "Bogotá", "Mujer", 33, bio_notes="Muy femenina, dulce, que se deje cuidar.")
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertTrue(any("Alineación en dinámica de roles" in s for s in res["sinergias_fuertes"]))

    def test_gt35_aseo_estricto_detectado(self):
        """GT-35: Requisito de aseo estricto detectado en Eje 8."""
        syn = OctagonalPersonaSynthesizer.synthesize_profile(1, "Natalia", "Bogotá", "Mujer", 31, bio_notes="Muy aseado, pulcro, dientes lindos, zapatos limpios.")
        self.assertTrue(syn["ejes"]["8_estetica"]["aseo_y_presentacion_estricta"])

    def test_gt36_rechazo_cirugias_detectado(self):
        """GT-36: Román Briceño rechaza cirugías estéticas."""
        syn = OctagonalPersonaSynthesizer.synthesize_profile(7841, "Román", "Bogotá", "Hombre", 59, bio_notes="No operada, cero cirugias esteticas, natural.")
        self.assertTrue(syn["ejes"]["8_estetica"]["rechaza_cirugias_esteticas"])

    def test_gt37_rechazo_tatuajes_detectado(self):
        """GT-37: Rechazo a personas tatuadas en Eje 8."""
        syn = OctagonalPersonaSynthesizer.synthesize_profile(1, "Cliente", "Bogotá", "Hombre", 40, bio_notes="Alguien super tatuada no, cero tatuajes.")
        self.assertTrue(syn["ejes"]["8_estetica"]["rechaza_tatuajes"])

    def test_gt38_calidad_notas_clasificada(self):
        """GT-38: Clasificación de calidad de notas (Extensa vs Escueta)."""
        syn_ext = OctagonalPersonaSynthesizer.synthesize_profile(1, "A", "Bogotá", "Mujer", 30, bio_notes="X" * 1500)
        syn_esc = OctagonalPersonaSynthesizer.synthesize_profile(2, "B", "Bogotá", "Hombre", 32, bio_notes="X" * 100)
        self.assertEqual(syn_ext["metadata"]["calidad_notas"], "EXTENSA")
        self.assertEqual(syn_esc["metadata"]["calidad_notas"], "ESCUETA")

    def test_gt39_version_sintesis_2_0(self):
        """GT-39: Metadata registra version 2.0-octagonal."""
        syn = OctagonalPersonaSynthesizer.synthesize_profile(1, "A", "Bogotá", "Mujer", 30)
        self.assertEqual(syn["metadata"]["version_sintesis"], "2.0-octagonal")

    def test_gt40_match_armonico_recomendado_alto(self):
        """GT-40: Pareja altamente compatible en los 8 ejes alcanza RECOMENDADO ALTO."""
        c1 = OctagonalPersonaSynthesizer.synthesize_profile(
            1, "Andrés", "Bogotá", "Hombre", 34,
            bio_notes="Empresario. Relación estable. Quiere casarse en unos años. Católico no fanático. Hace ejercicio moderado. Respeta espacios.",
            lifestyle={"has_children": "No", "wants_children": "Sí"}
        )
        c2 = OctagonalPersonaSynthesizer.synthesize_profile(
            2, "Juliana", "Bogotá", "Mujer", 31,
            bio_notes="Abogada. Busca relación formal. Le gustaría tener hijos. Catolica espiritual. Le gusta el gym y planes tranquilos. Independiente.",
            lifestyle={"has_children": "No", "wants_children": "Sí"}
        )
        res = OctagonalMatchEvaluator.evaluate_match(c1, c2)
        self.assertGreaterEqual(res["score_global"], 80)
        self.assertEqual(res["veredicto"], "RECOMENDADO ALTO")
        self.assertEqual(len(res["deal_breakers"]), 0)

if __name__ == "__main__":
    unittest.main()
