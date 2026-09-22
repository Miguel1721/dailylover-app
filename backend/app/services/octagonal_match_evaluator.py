"""
Octagonal Match Evaluator — DailyLover
Motor de Evaluación Clínica Relacional en 8 Ejes Vinculares.
Aplica la Regla del Eslabón Débil (Capa 1: Cimientos > Capa 2: Convivencia > Capa 3: Deseo).
Calibrado con Principio de Evidencia Positiva (anti-inflación), Coherencia Geográfica y Brecha Generacional.
"""

from typing import Dict, Any, List, Tuple
from app.services.clinical_profile_extractor import get_metro_cluster

class OctagonalMatchEvaluator:
    """
    Evalúa compatibilidad multidimensional entre dos perfiles sintetizados en 8 ejes.
    """

    @classmethod
    def evaluate_match(
        cls,
        client: Dict[str, Any],
        candidate: Dict[str, Any]
    ) -> Dict[str, Any]:
        c_meta = client["metadata"]
        k_meta = candidate["metadata"]
        
        c_ejes = client["ejes"]
        k_ejes = candidate["ejes"]

        dealbreakers_activos = []
        puntos_friccion = []
        sinergias_fuertes = []

        # ─── GATEKEEPER 0: DISPONIBILIDAD OPERATIVA Y GÉNERO ────────────────────
        if k_meta.get("availability_status") in ["EN_PAREJA", "REFUND", "INACTIVO"]:
            st = k_meta.get("availability_status")
            return cls._build_rejected_result(
                c_meta, k_meta,
                score=10,
                razon_bloqueo=f"Candidato no disponible en plataforma (Estado operativo: {st})"
            )

        # Incompatibilidad de Orientación / Género Buscado
        c_gender = (c_meta.get("gender") or "").strip().lower()
        k_gender = (k_meta.get("gender") or "").strip().lower()
        c_sp = c_meta.get("search_preferences") or {}
        k_sp = k_meta.get("search_preferences") or {}

        c_pref = (c_sp.get("preferred_gender") or c_sp.get("looking_for") or "").strip().lower()
        k_pref = (k_sp.get("preferred_gender") or k_sp.get("looking_for") or "").strip().lower()
        c_orient = (c_meta.get("orientation") or c_sp.get("preferred_orientation") or "").strip().lower()
        k_orient = (k_meta.get("orientation") or k_sp.get("preferred_orientation") or "").strip().lower()

        c_wants_both = ("hombre" in c_pref and "mujer" in c_pref) or ("ambos" in c_pref) or ("cualquiera" in c_pref)
        k_wants_both = ("hombre" in k_pref and "mujer" in k_pref) or ("ambos" in k_pref) or ("cualquiera" in k_pref)

        if c_pref and k_gender and not c_wants_both:
            if ("hombre" in c_pref and "mujer" in k_gender) or ("mujer" in c_pref and "hombre" in k_gender):
                return cls._build_rejected_result(
                    c_meta, k_meta, score=0,
                    razon_bloqueo=f"Incompatibilidad de género buscado: {c_meta.get('name')} busca {c_pref}, pero el candidato es {k_gender}."
                )

        if k_pref and c_gender and not k_wants_both:
            if ("hombre" in k_pref and "mujer" in c_gender) or ("mujer" in k_pref and "hombre" in c_gender):
                return cls._build_rejected_result(
                    c_meta, k_meta, score=0,
                    razon_bloqueo=f"Incompatibilidad de género buscado en candidato: {k_meta.get('name')} busca {k_pref}, pero el cliente es {c_gender}."
                )

        if ('hombre' in c_gender and 'mujer' in k_gender) or ('mujer' in c_gender and 'hombre' in k_gender):
            if 'gay' in c_orient or 'lesb' in c_orient:
                return cls._build_rejected_result(
                    c_meta, k_meta, score=0,
                    razon_bloqueo=f"Incompatibilidad de orientación sexual: {c_meta.get('name')} es homosexual/gay/lesbiana."
                )
            if 'gay' in k_orient or 'lesb' in k_orient:
                return cls._build_rejected_result(
                    c_meta, k_meta, score=0,
                    razon_bloqueo=f"Incompatibilidad de orientación sexual: {k_meta.get('name')} es homosexual/gay/lesbiana."
                )

        # ─── CAPA 1: CIMIENTOS DUROS ─────────────────────────────────────────────
        # Eje 1: Logística y Distancia Real
        score_logistica, fricciones_log, kill_switches_log, sinergias_log = cls._eval_logistica(
            c_ejes["1_logistica"], k_ejes["1_logistica"], c_meta, k_meta
        )
        dealbreakers_activos.extend(kill_switches_log)
        puntos_friccion.extend(fricciones_log)

        # Eje 2: Timing, Fase de Vida y Brecha Generacional
        score_timing, fricciones_tim, kill_switches_tim, sinergias_tim = cls._eval_timing(
            c_ejes["2_timing"], k_ejes["2_timing"], c_meta, k_meta
        )
        dealbreakers_activos.extend(kill_switches_tim)
        puntos_friccion.extend(fricciones_tim)

        # Eje 3: Axiología (Hijos, Dinero, Fe, Política)
        score_axiologia, fricciones_ax, kill_switches_ax, sinergias_ax = cls._eval_axiologia(
            c_ejes["3_axiologia"], k_ejes["3_axiologia"]
        )
        dealbreakers_activos.extend(kill_switches_ax)
        puntos_friccion.extend(fricciones_ax)

        # ─── CAPA 2: CONVIVENCIA Y REGULACIÓN ────────────────────────────────────
        # Eje 4: Estilo de Conflicto
        score_conflicto, fricciones_conf = cls._eval_conflicto(c_ejes["4_conflicto"], k_ejes["4_conflicto"])
        puntos_friccion.extend(fricciones_conf)

        # Eje 5: Autonomía vs Fusión
        score_autonomia, fricciones_aut = cls._eval_autonomia(c_ejes["5_autonomia"], k_ejes["5_autonomia"])
        puntos_friccion.extend(fricciones_aut)

        # Eje 6: Ritmo Vital y Energía Biológica
        score_ritmo, fricciones_rit, sinergias_rit = cls._eval_ritmo_vital(
            c_ejes["6_ritmo_vital"], k_ejes["6_ritmo_vital"]
        )
        puntos_friccion.extend(fricciones_rit)

        # ─── CAPA 3: DESEO Y QUÍMICA SOMÁTICA ────────────────────────────────────
        # Eje 7: Polaridad de Roles
        score_polaridad, sinergias_pol = cls._eval_polaridad(c_ejes["7_polaridad"], k_ejes["7_polaridad"])

        # Eje 8: Estética y Hábitos
        score_estetica, fricciones_est = cls._eval_estetica(c_ejes["8_estetica"], k_ejes["8_estetica"])
        puntos_friccion.extend(fricciones_est)

        # ─── REBALANCEO CLÍNICO DE SINERGIAS (SUSTANCIA ARRIBA, LOGÍSTICA AL FONDO) ─
        sinergias_fuertes.extend(sinergias_ax)   # Axiología / Hijos / Visión de vida
        sinergias_fuertes.extend(sinergias_pol)  # Polaridad y roles
        sinergias_fuertes.extend(sinergias_rit)  # Ritmo vital y estilo de vida
        sinergias_fuertes.extend(sinergias_tim)  # Timing generacional
        sinergias_fuertes.extend(sinergias_log)  # Viabilidad logística secundaria

        # ─── PRINCIPIO DEL ESLABÓN DÉBIL & SCORING JERÁRQUICO ────────────────────
        score_capa1_cimientos = (score_logistica * 0.35 + score_timing * 0.30 + score_axiologia * 0.35)
        score_capa2_convivencia = (score_conflicto * 0.35 + score_autonomia * 0.35 + score_ritmo * 0.30)
        score_capa3_deseo = (score_polaridad * 0.50 + score_estetica * 0.50)

        # Regla del cuello de botella (Bottleneck)
        if dealbreakers_activos or score_axiologia < 30 or score_logistica < 25 or score_timing < 25:
            global_score = min(38, int(score_capa1_cimientos))
            veredicto = "NO RECOMENDADO"
        elif score_capa1_cimientos < 70 or score_timing < 55 or score_capa2_convivencia < 65 or score_ritmo < 50 or score_conflicto < 55 or score_autonomia < 55:
            base_score = int((score_capa1_cimientos * 0.5) + (score_capa2_convivencia * 0.5))
            global_score = min(64, base_score)
            veredicto = "VIABLE CON RESERVAS"
        else:
            global_score = int(
                (score_capa1_cimientos * 0.45) +
                (score_capa2_convivencia * 0.35) +
                (score_capa3_deseo * 0.20)
            )
            # Solo es RECOMENDADO ALTO si alcanza >= 80% y tiene coherencia clínica
            veredicto = "RECOMENDADO ALTO" if global_score >= 80 else "RECOMENDADO MODERADO"

        return {
            "cliente": f"{c_meta['name']} (UID {c_meta['user_id']})",
            "candidato": f"{k_meta['name']} (UID {k_meta['user_id']})",
            "score_global": global_score,
            "veredicto": veredicto,
            "desglose_8_ejes": {
                "1_logistica": score_logistica,
                "2_timing": score_timing,
                "3_axiologia": score_axiologia,
                "4_conflicto": score_conflicto,
                "5_autonomia": score_autonomia,
                "6_ritmo_vital": score_ritmo,
                "7_polaridad": score_polaridad,
                "8_estetica": score_estetica
            },
            "deal_breakers": dealbreakers_activos,
            "puntos_friccion": puntos_friccion,
            "sinergias_fuertes": sinergias_fuertes,
            "recomendacion_psicologa": cls._generar_guia_cita(veredicto, dealbreakers_activos, puntos_friccion)
        }

    # ─── EVALUADORES INDIVIDUALES ─────────────────────────────────────────────

    @classmethod
    def _normalize_city(cls, city_str: str) -> str:
        if not city_str:
            return ""
        c = city_str.strip().lower()
        replacements = {'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', '?': 'a'}
        for orig, rep in replacements.items():
            c = c.replace(orig, rep)
        if "bogot" in c:
            return "bogota"
        if "medell" in c:
            return "medellin"
        if "cali" in c:
            return "cali"
        if "barranq" in c:
            return "barranquilla"
        if "cartagen" in c:
            return "cartagena"
        if "bucaram" in c:
            return "bucaramanga"
        if "pereir" in c:
            return "pereira"
        if "manizal" in c:
            return "manizales"
        return c

    @classmethod
    def _eval_logistica(cls, c: dict, k: dict, c_meta: dict = None, k_meta: dict = None) -> Tuple[int, List[str], List[str], List[str]]:
        score = 80
        fricciones = []
        dealbreakers = []
        sinergias = []

        # 1. Turnos y movilidad extrema
        if c.get("profesion_alta_movilidad") and k.get("profesion_alta_movilidad"):
            score -= 30
            fricciones.append("Ambos tienen regímenes de viaje o movilidad alta (desafío severo para coincidir)")
        elif c.get("profesion_alta_movilidad") or k.get("profesion_alta_movilidad"):
            score -= 15
            fricciones.append("Uno de los perfiles tiene régimen de trabajo por turnos o viajes extendidos")

        if c.get("custodia_compartida_semanal") and k.get("custodia_compartida_semanal"):
            fricciones.append("Ambos tienen custodia compartida semanal (verificar sincronía de semanas libres)")
            score -= 10

        # 2. Coincidencia o distancia de Ciudad
        if c_meta and k_meta:
            city_c = cls._normalize_city(c_meta.get("city"))
            city_k = cls._normalize_city(k_meta.get("city"))

            if city_c and city_k:
                if city_c == city_k:
                    score += 10
                    sinergias.append(f"Coincidencia geográfica local en {c_meta.get('city') or k_meta.get('city')}")
                else:
                    cluster_c = get_metro_cluster(city_c)
                    cluster_k = get_metro_cluster(city_k)
                    same_cluster = bool(cluster_c and cluster_k and cluster_c == cluster_k)

                    if same_cluster:
                        score += 5
                        sinergias.append(f"Cercanía geográfica metropolitana: {c_meta.get('city')} y {k_meta.get('city')}")
                    else:
                        tiene_viaje = bool(
                            c.get("disposicion_viajar") or k.get("disposicion_viajar") or
                            (c_meta and c_meta.get("disposicion_viajar")) or
                            (k_meta and k_meta.get("disposicion_viajar"))
                        )

                        is_international = any(w in city_c or w in city_k for w in ["usa", "florida", "miami", "davie", "españa", "madrid", "mexico", "hollywood"])

                        if not tiene_viaje:
                            dealbreakers.append(
                                f"Incompatibilidad geográfica: Ciudades diferentes ({c_meta.get('city')} vs {k_meta.get('city')}) sin disposición de viaje o traslado registrada en notas"
                            )
                            score = 10
                        elif is_international:
                            score = 25
                            fricciones.append(f"Distancia internacional mitigada por movilidad: {c_meta.get('city')} vs {k_meta.get('city')} (requiere acuerdo explícito de traslados)")
                        else:
                            score -= 20
                            fricciones.append(f"Distancia intermunicipal con disposición de viaje: {c_meta.get('city')} vs {k_meta.get('city')} (requiere coordinar fechas de visita)")

        return max(10, min(95, score)), fricciones, dealbreakers, sinergias

    @classmethod
    def _eval_timing(cls, c: dict, k: dict, c_meta: dict = None, k_meta: dict = None) -> Tuple[int, List[str], List[str], List[str]]:
        score = 80
        fricciones = []
        dealbreakers = []
        sinergias = []

        # 1. Duelo reciente
        if c.get("duelo_activo_reciente") or k.get("duelo_activo_reciente"):
            score = 35
            fricciones.append("Ruptura sentimental reciente (< 90 días) en uno de los candidatos")

        # 2. Desfase de intención
        if (c.get("intencion_primaria") == "Matrimonio / Familia" and k.get("intencion_primaria") == "Casual / Exploratorio") or \
           (k.get("intencion_primaria") == "Matrimonio / Familia" and c.get("intencion_primaria") == "Casual / Exploratorio"):
            score = 25
            fricciones.append("Desfase de intención: Proyecto de matrimonio vs Dinámica casual sin afán")
        elif c.get("intencion_primaria") == k.get("intencion_primaria") and c.get("intencion_primaria") != "Relación Estable":
            sinergias.append(f"Alineación en intención vincular ({c.get('intencion_primaria')})")
            score += 5

        # 3. Brecha Generacional y Momento Vital (REGLA DE MÁXIMO 8 AÑOS POR DEFECTO)
        if c_meta and k_meta:
            age_c = c_meta.get("age")
            age_k = k_meta.get("age")
            if age_c and age_k:
                try:
                    diff = abs(int(age_c) - int(age_k))
                    # Verificar autorización explícita para brechas mayores a 8 años
                    autorizado_amplio = bool(
                        c.get("acepta_brecha_edad_amplia") or k.get("acepta_brecha_edad_amplia") or
                        (c_meta and c_meta.get("acepta_brecha_edad_amplia")) or
                        (k_meta and k_meta.get("acepta_brecha_edad_amplia"))
                    )

                    c_sp = (c_meta and c_meta.get("search_preferences")) or {}
                    k_sp = (k_meta and k_meta.get("search_preferences")) or {}
                    if c_sp.get("min_age") and c_sp.get("max_age"):
                        try:
                            if int(c_sp["min_age"]) <= int(age_k) <= int(c_sp["max_age"]):
                                autorizado_amplio = True
                        except Exception:
                            pass
                    if k_sp.get("min_age") and k_sp.get("max_age"):
                        try:
                            if int(k_sp["min_age"]) <= int(age_c) <= int(k_sp["max_age"]):
                                autorizado_amplio = True
                        except Exception:
                            pass

                    if diff > 10:
                        dealbreakers.append(
                            f"Incompatibilidad etaria: Brecha de {diff} años excede el límite absoluto del negocio (máximo 10 años permitido bajo cualquier circunstancia) ({c_meta.get('name')} {age_c}a vs {k_meta.get('name')} {age_k}a)"
                        )
                    elif diff > 8 and not autorizado_amplio:
                        dealbreakers.append(
                            f"Incompatibilidad etaria: Brecha de {diff} años excede el máximo permitido por defecto (8 años) sin especificación en notas ({c_meta.get('name')} {age_c}a vs {k_meta.get('name')} {age_k}a)"
                        )
                        score = 15
                    elif diff >= 25:
                        score -= 45
                        fricciones.append(f"Descalce de momento vital / brecha generacional extrema ({diff} años): {c_meta.get('name')} ({age_c}a) vs {k_meta.get('name')} ({age_k}a)")
                    elif diff >= 16:
                        score -= 25
                        fricciones.append(f"Brecha generacional marcada ({diff} años): Evaluar si coinciden en proyectos y estilo de vida ({age_c}a vs {age_k}a)")
                    elif diff <= 6:
                        score += 10
                        sinergias.append(f"Afinidad en momento vital y cohorte generacional ({age_c}a y {age_k}a)")
                except Exception:
                    pass

        return max(10, min(95, score)), fricciones, dealbreakers, sinergias

    @classmethod
    def _eval_axiologia(cls, c: dict, k: dict) -> Tuple[int, List[str], List[str], List[str]]:
        score = 80
        fricciones = []
        dealbreakers = []
        sinergias = []

        # Hijos vs Vasectomía
        if (c.get("deseo_hijos") and k.get("vasectomia")) or (k.get("deseo_hijos") and c.get("vasectomia")):
            dealbreakers.append("Incompatibilidad biológica: Uno desea tener hijos y el otro tiene vasectomía cerrada")
            score = 10

        # Modelo Financiero
        if c.get("modelo_financiero") == "Proveedor tradicional" and k.get("modelo_financiero") == "Igualitario 50/50":
            fricciones.append("Choque financiero: Expectativa de proveedor tradicional vs Mentalidad estricta 50/50")
            score -= 25
        elif c.get("modelo_financiero") == k.get("modelo_financiero") and c.get("modelo_financiero") not in ("Flexible / Equilibrado", None):
            sinergias.append(f"Alineación financiera compartida: {c.get('modelo_financiero')}")
            score += 10

        # Fe
        if (c.get("fe_espiritual") == "Creyente devoto/practicante" and k.get("fe_espiritual") == "Ateo / Agnóstico") or \
           (k.get("fe_espiritual") == "Creyente devoto/practicante" and c.get("fe_espiritual") == "Ateo / Agnóstico"):
            fricciones.append("Tensión axiológica de fe: Creyente devoto practicante vs Ateo/Agnóstico ('yugo desigual')")
            score -= 30

        # Política
        vetos_c = c.get("vetos_politicos", {})
        vetos_k = k.get("vetos_politicos", {})
        if (vetos_c.get("rechaza_izquierda") and k.get("postura_politica") == "Izquierda") or \
           (vetos_k.get("rechaza_izquierda") and c.get("postura_politica") == "Izquierda"):
            dealbreakers.append("Incompatibilidad política: Veto explícito a personas de izquierda")
            score = 15
        elif (vetos_c.get("rechaza_derecha") and k.get("postura_politica") == "Derecha") or \
             (vetos_k.get("rechaza_derecha") and c.get("postura_politica") == "Derecha"):
            dealbreakers.append("Incompatibilidad política: Veto explícito a personas de derecha")
            score = 15

        return max(10, min(95, score)), fricciones, dealbreakers, sinergias

    @classmethod
    def _eval_conflicto(cls, c: dict, k: dict) -> Tuple[int, List[str]]:
        score = 80
        fricciones = []
        if c.get("estilo_procesamiento") == "Tiempo fuera / Reflexivo" and k.get("alerta_reactividad"):
            score -= 30
            fricciones.append("Riesgo Gottman (Demanda-Retirada): Uno necesita espacio reflexivo y el otro es reactivo/inmediato")
        return max(20, score), fricciones

    @classmethod
    def _eval_autonomia(cls, c: dict, k: dict) -> Tuple[int, List[str]]:
        score = 80
        fricciones = []
        if (c.get("necesidad_espacio_personal") == "Alta (Hiper-independiente)" and k.get("necesidad_espacio_personal") == "Baja (Fusión / Mucha cercanía)") or \
           (k.get("necesidad_espacio_personal") == "Alta (Hiper-independiente)" and c.get("necesidad_espacio_personal") == "Baja (Fusión / Mucha cercanía)"):
            score -= 35
            fricciones.append("Descalce de intimidad: Necesidad de hiper-independencia vs Búsqueda de atención/fusión constante")
        return max(20, score), fricciones

    @classmethod
    def _eval_ritmo_vital(cls, c: dict, k: dict) -> Tuple[int, List[str], List[str]]:
        score = 75
        fricciones = []
        sinergias = []
        if (c.get("vitalidad_fisica") == "Muy Alta (Atleta / Alto Desgaste)" and k.get("vitalidad_fisica") == "Baja (Hogareño / Sedentario)") or \
           (k.get("vitalidad_fisica") == "Muy Alta (Atleta / Alto Desgaste)" and c.get("vitalidad_fisica") == "Baja (Hogareño / Sedentario)"):
            score -= 35
            fricciones.append("Disparidad crítica de ritmo vital: Atleta de alto rendimiento vs Perfil sedentario/hogareño temprano")
        elif c.get("vitalidad_fisica") == k.get("vitalidad_fisica") and c.get("vitalidad_fisica") != "Moderada":
            sinergias.append(f"Sintonía de energía vital compartida ({c.get('vitalidad_fisica')})")
            score += 10
        return max(15, min(95, score)), fricciones, sinergias

    @classmethod
    def _eval_polaridad(cls, c: dict, k: dict) -> Tuple[int, List[str]]:
        score = 75
        sinergias = []
        if c.get("dinamica_preferida") == k.get("dinamica_preferida"):
            sinergias.append(f"Alineación en dinámica de roles: {c.get('dinamica_preferida')}")
            score += 15
        return min(95, score), sinergias

    @classmethod
    def _eval_estetica(cls, c: dict, k: dict) -> Tuple[int, List[str]]:
        score = 80
        fricciones = []
        return score, fricciones

    @classmethod
    def _build_rejected_result(cls, c_meta, k_meta, score, razon_bloqueo):
        return {
            "cliente": f"{c_meta['name']} (UID {c_meta['user_id']})",
            "candidato": f"{k_meta['name']} (UID {k_meta['user_id']})",
            "score_global": score,
            "veredicto": "NO RECOMENDADO (BLOQUEADO)",
            "desglose_8_ejes": {
                "1_logistica": 10,
                "2_timing": 10,
                "3_axiologia": 10,
                "4_conflicto": 10,
                "5_autonomia": 10,
                "6_ritmo_vital": 10,
                "7_polaridad": 10,
                "8_estetica": 10
            },
            "deal_breakers": [razon_bloqueo],
            "puntos_friccion": [razon_bloqueo],
            "sinergias_fuertes": [],
            "recomendacion_psicologa": f"No presentar este match: {razon_bloqueo}."
        }

    @classmethod
    def _generar_guia_cita(cls, veredicto: str, dealbreakers: list, fricciones: list) -> str:
        if veredicto == "NO RECOMENDADO":
            return f"Descartar propuesta. Razón principal: {dealbreakers[0] if dealbreakers else (fricciones[0] if fricciones else 'Incompatibilidad de cimientos')}."
        if veredicto == "VIABLE CON RESERVAS":
            return f"Advertir previamente al cliente sobre: {fricciones[0] if fricciones else 'diferencias de ritmo'}. Agendar cita de bajo compromiso (café o almuerzo ligero)."
        return "Match sólido y equilibrado. Sugerir cena o salida tranquila en lugar sin exceso de ruido para facilitar conversación profunda."
