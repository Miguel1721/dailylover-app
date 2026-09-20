"""
Clinical Profile Extractor 360° — Daily Lover
Consolida el 100% de la información clínica, CRM, notas de entrevistas,
observaciones de citas pasadas y feedbacks para construir un perfil
estructurado multidimensional ANTES de ejecutar el motor de matching.
"""

import re
import json
from typing import Dict, Any, List, Optional, Set

def clean_text(text: Optional[str]) -> str:
    if not text:
        return ""
    return str(text).strip()

class ClinicalProfileExtractor:
    """
    Extrae entidades, hábitos, no negociables, estilo de vida y dinámicas relacionales
    a partir del 100% de los datos disponibles de cada persona en Daily Lover.
    """

    @classmethod
    def extract_full_profile_360(
        cls,
        user_id: int,
        name: str,
        profile_data: Dict[str, Any],
        bio_notes: str = "",
        past_match_observations: List[str] = None,
        past_matched_names: List[str] = None,
        client_notes: List[str] = None,
        cs_notes: List[str] = None,
    ) -> Dict[str, Any]:
        past_match_observations = past_match_observations or []
        past_matched_names = past_matched_names or []
        client_notes = client_notes or []
        cs_notes = cs_notes or []

        # Consolidar todo el texto relevante para escaneo profundo
        all_text_blocks = [
            clean_text(bio_notes),
            clean_text(profile_data.get("difficult_notes", "")),
            " ".join([clean_text(o) for o in past_match_observations]),
            " ".join([clean_text(n) for n in client_notes]),
            " ".join([clean_text(c) for c in cs_notes]),
        ]
        full_text = "\n".join([b for b in all_text_blocks if b]).lower()

        # 1. MASCOTAS & PERROS (Dealbreaker Frecuente)
        mascotas = cls._extract_pets(full_text)

        # 2. HIJOS, FERTILIDAD & VASECTOMÍA
        hijos = cls._extract_children(full_text, profile_data)

        # 3. VICIOS & SUSTANCIAS (Cigarrillo, Vape, Cannabis, Alcohol)
        vicios = cls._extract_substances(full_text)

        # 4. CREENCIAS & ESPIRITUALIDAD
        creencias = cls._extract_beliefs(full_text, profile_data)

        # 5. ORIENTACIÓN SEXUAL & GÉNERO
        orientacion = cls._extract_orientation(full_text, profile_data)

        # 6. ESTILO DE VIDA, DEPORTE & RUTINA
        estilo_vida = cls._extract_lifestyle(full_text, profile_data)

        # 7. VISIÓN DE PAREJA, APEGO & LENGUAJE DEL AMOR
        relacion = cls._extract_relationship(full_text, profile_data)

        # 8. HISTORIAL Y RESTRICCIONES DE CITAS PREVIAS
        historial = {
            "past_matched_names": [n.strip() for n in past_matched_names if n.strip()],
            "observations_summary": past_match_observations[:5],
            "total_dates_recorded": len(past_matched_names),
        }

        # 9. DEALBREAKERS CONSOLIDADOS
        dealbreakers = cls._consolidate_dealbreakers(
            mascotas=mascotas,
            hijos=hijos,
            vicios=vicios,
            creencias=creencias,
            orientacion=orientacion,
            estilo_vida=estilo_vida,
            full_text=full_text,
        )

        return {
            "user_id": user_id,
            "name": name,
            "city": profile_data.get("city") or "Bogotá",
            "age": profile_data.get("age"),
            "gender": profile_data.get("gender") or "No especificado",
            "estatura": profile_data.get("estatura"),
            "occupation": profile_data.get("occupation") or cls._extract_occupation(full_text),
            "mascotas": mascotas,
            "hijos": hijos,
            "vicios": vicios,
            "creencias": creencias,
            "orientacion": orientacion,
            "estilo_vida": estilo_vida,
            "relacion": relacion,
            "historial": historial,
            "dealbreakers": dealbreakers,
            "data_completeness": cls._calculate_completeness(
                bio_notes=bio_notes,
                profile_data=profile_data,
                mascotas=mascotas,
                hijos=hijos,
                creencias=creencias,
                estilo_vida=estilo_vida
            ),
        }

    # ─── MÉTODOS INTERNOS DE EXTRACCIÓN ───────────────────────────────────────

    @classmethod
    def _extract_pets(cls, text: str) -> Dict[str, Any]:
        # Detección de rechazo a mascotas
        rechaza_mascotas = bool(re.search(
            r"(no le gustan? (las )?mascotas|no mascotas|rechaza mascotas|cero mascotas|odia las mascotas|alergia a (perros|gatos|mascotas))",
            text
        ))

        # Detección de amor/fascinación por perros o mascotas
        ama_perros = bool(re.search(
            r"(infaltable.*perros?|que le fascinen? los perros|ama (a )?los (perros|animales)|vive con (su|un) perro|saca a su perro|dog lover|le encantan los perros)",
            text
        ))

        tiene_perro = bool(re.search(
            r"(vive (solo )?con su perro|tiene (un |su )?perro|su perro|con su perrita)",
            text
        ))

        infaltable_perros = bool(re.search(
            r"(infaltable\s*:\s*que le fascinen? los perros|vital que le gusten los perros|excluyente.*perros?)",
            text
        ))

        return {
            "ama_perros": ama_perros,
            "tiene_perro": tiene_perro,
            "infaltable_perros": infaltable_perros,
            "rechaza_mascotas": rechaza_mascotas,
            "tolera_mascotas": not rechaza_mascotas,
        }

    @classmethod
    def _extract_children(cls, text: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        has_children_explicit = profile_data.get("has_children")
        wants_children_explicit = profile_data.get("wants_children")

        tiene_hijos = has_children_explicit is True or bool(re.search(
            r"(tiene (un|dos|tres|\d+) hijos?|madre de|padre de|con su hijo|sus hijos)",
            text
        ))

        no_quiere_hijos = wants_children_explicit is False or bool(re.search(
            r"(no quiere hijos|cero hijos|sin intenci[oó]n de tener hijos|no planea tener hijos|no le gustan los ni[ñn]os)",
            text
        ))

        quiere_hijos = wants_children_explicit is True or bool(re.search(
            r"(quiere (tener )?hijos|desea hijos|sue[ñn]a con ser (madre|padre)|le gustar[ií]a tener hijos)",
            text
        ))

        vasectomia = bool(re.search(
            r"(vasectom[ií]a|operado para no tener hijos)",
            text
        ))

        red_flag_hijos = bool(re.search(
            r"(que tenga hijos\s*:\s*red flag|red flags?.*hijos|no personas con hijos|cero hijos en su match)",
            text
        ))

        return {
            "tiene_hijos": tiene_hijos,
            "quiere_hijos": quiere_hijos,
            "no_quiere_hijos": no_quiere_hijos,
            "vasectomia": vasectomia,
            "red_flag_hijos_en_pareja": red_flag_hijos,
        }

    @classmethod
    def _extract_substances(cls, text: str) -> Dict[str, Any]:
        fuma_cigarrillo = bool(re.search(
            r"(fuma cigarrillo|fuma tabaco|fumador(a)?\b|fuma socialmente)",
            text
        )) and not bool(re.search(r"no fuma", text))

        vapea = bool(re.search(r"\b(vapea|vape|vaper)\b", text))
        fuma_cannabis = bool(re.search(r"\b(cannabis|marihuana|weed)\b", text)) and not bool(re.search(r"cero cannabis|no cannabis", text))

        rechaza_fumadores = bool(re.search(
            r"(que fume\s*:\s*red flag|red flags?.*que fume|no fumadores?|cero vicios|cualquier tipo de vicio\s*:\s*red flag|no tolera el cigarrillo)",
            text
        ))

        return {
            "fuma_cigarrillo": fuma_cigarrillo,
            "vapea": vapea,
            "fuma_cannabis": fuma_cannabis,
            "consume_nicotina": fuma_cigarrillo or vapea,
            "rechaza_fumadores": rechaza_fumadores,
        }

    @classmethod
    def _extract_beliefs(cls, text: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        religion_raw = str(profile_data.get("religion", "")).lower()

        ateo = bool(re.search(
            r"(es ateo|es atea|ir a misa ser[ií]a su peor plan|cero creyente|no cree en dios)",
            text
        )) or "ateo" in religion_raw or "atea" in religion_raw

        catolico = bool(re.search(r"\b(cat[oó]lic[oa])\b", text)) or "católic" in religion_raw or "catolic" in religion_raw
        cristiano = bool(re.search(r"\b(cristian[oa])\b", text)) or "cristian" in religion_raw
        espiritual = bool(re.search(r"(espiritual|meditaci[oó]n|reza|yoga|astrolog[ií]a)", text)) or "espiritual" in religion_raw

        exige_creyente = bool(re.search(
            r"(le parece importante que.*crea en dios|fundamental que comparta su fe|debe ser creyente|exige creyente)",
            text
        ))

        tolerante_creencias = bool(re.search(
            r"(no le importa si su pareja es religiosa|tolerancia.*religi[oó]n|respeta creencias|cero fan[aá]tico)",
            text
        ))

        return {
            "ateo": ateo,
            "catolico": catolico,
            "cristiano": cristiano,
            "espiritual": espiritual,
            "exige_creyente": exige_creyente,
            "tolerante_creencias": tolerante_creencias,
            "etiqueta_principal": "Ateo" if ateo else ("Católico" if catolico else ("Cristiano" if cristiano else ("Espiritual" if espiritual else "No especificado")))
        }

    @classmethod
    def _extract_orientation(cls, text: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        orient_field = str(profile_data.get("orientation", "")).lower()

        is_lesbiana = bool(re.search(r"\b(lesbiana|lesbica|lesb|solo mujeres)\b", text)) or "lesb" in orient_field
        is_gay = bool(re.search(r"\b(gay|homosexual|solo hombres)\b", text)) or "gay" in orient_field
        is_bi = bool(re.search(r"\b(bisexual|bi)\b", text)) or "bi" in orient_field
        is_hetero = "hetero" in orient_field or bool(re.search(r"\b(heterosexual|busca (un )?hombre|busca (una )?mujer)\b", text))

        if is_lesbiana:
            codigo = "lesb"
        elif is_gay:
            codigo = "gay"
        elif is_bi:
            codigo = "bi"
        else:
            codigo = "hetero"

        return {
            "codigo": codigo,
            "es_lesbiana": is_lesbiana,
            "es_gay": is_gay,
            "es_hetero": is_hetero and not (is_lesbiana or is_gay),
        }

    @classmethod
    def _extract_lifestyle(cls, text: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        deporte_diario = bool(re.search(
            r"(trota por las mañanas|entrena todos los d[ií]as|crossfit diario|gimnasio todos los d[ií]as|atleta|deportista de alto rendimiento)",
            text
        ))

        hace_deporte = deporte_diario or bool(re.search(
            r"(hace ejercicio|entrena|juega f[uú]tbol|clases grupales|trota|nataci[oó]n|ciclismo|pilates|yoga)",
            text
        ))

        exige_deportista = bool(re.search(
            r"(quiere a alguien que haga.*ejercicio|indispensable que haga deporte|contextura atl[eé]tica|que se cuide f[ií]sicamente)",
            text
        ))

        sedentario = bool(re.search(
            r"(cero de (ejercicio|deporte)|no hace ejercicio|odia el ejercicio|sedentari[oa])",
            text
        ))

        foodie = bool(re.search(
            r"(foodie|ama la comida|le fascina cocinar|preparar c[oó]cteles|salir a comer|restaurantes)",
            text
        ))

        amiguero_social = bool(re.search(
            r"(muy amiguero|le encanta salir|el host del grupo|extrovertid[oa]|fiester[oa]|le gusta bailar)",
            text
        ))

        return {
            "deporte_diario": deporte_diario,
            "hace_deporte": hace_deporte,
            "exige_deportista": exige_deportista,
            "sedentario": sedentario,
            "foodie": foodie,
            "amiguero_social": amiguero_social,
        }

    @classmethod
    def _extract_relationship(cls, text: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        apego_raw = profile_data.get("apego") or {}
        if isinstance(apego_raw, str):
            try:
                apego_raw = json.loads(apego_raw)
            except Exception:
                apego_raw = {"style": apego_raw}

        estilo_apego = apego_raw.get("style", "").capitalize()
        if not estilo_apego:
            if re.search(r"apego seguro|segur[oa] en sus relaciones", text):
                estilo_apego = "Seguro"
            elif re.search(r"apego ansioso|insegur[oa]|miedo al abandono", text):
                estilo_apego = "Ansioso"
            elif re.search(r"apego evitativo|independiente al extremo|evita compromiso", text):
                estilo_apego = "Evitativo"

        busca_matrimonio = bool(re.search(
            r"(le gustar[ií]a casarse|quiere casarse|sue[ñn]a con casarse|visi[oó]n de matrimonio)",
            text
        ))

        relacion_seria = busca_matrimonio or bool(re.search(
            r"(quiere algo serio|relaci[oó]n seria|a largo plazo|construir un equipo|pareja estable)",
            text
        ))

        lenguaje_amor = profile_data.get("love_language") or apego_raw.get("love_language")
        if not lenguaje_amor:
            if re.search(r"contacto f[ií]sico|demostraciones muy f[ií]sicas", text):
                lenguaje_amor = "Contacto físico"
            elif re.search(r"tiempo de calidad", text):
                lenguaje_amor = "Tiempo de calidad"
            elif re.search(r"palabras de afirmaci[oó]n", text):
                lenguaje_amor = "Palabras de afirmación"
            elif re.search(r"actos de servicio|servicial", text):
                lenguaje_amor = "Actos de servicio"

        return {
            "estilo_apego": estilo_apego or "Seguro",
            "lenguaje_amor": lenguaje_amor or "Tiempo de calidad",
            "busca_matrimonio": busca_matrimonio,
            "relacion_seria": relacion_seria,
        }

    @classmethod
    def _extract_occupation(cls, text: str) -> str:
        match = re.search(r"(profesi[oó]n|a qu[eé] se dedica|trabaja como|es)\s*:\s*([^\n\.,]+)", text, re.IGNORECASE)
        if match:
            return match.group(2).strip().capitalize()
        return "Profesional"

    @classmethod
    def _consolidate_dealbreakers(cls, **kwargs) -> List[Dict[str, Any]]:
        dealbreakers = []
        mascotas = kwargs.get("mascotas", {})
        hijos = kwargs.get("hijos", {})
        vicios = kwargs.get("vicios", {})
        creencias = kwargs.get("creencias", {})
        orientacion = kwargs.get("orientacion", {})
        estilo_vida = kwargs.get("estilo_vida", {})

        if mascotas.get("infaltable_perros") or mascotas.get("ama_perros"):
            dealbreakers.append({
                "categoria": "Mascotas",
                "tipo": "EXIGE_AMOR_PERROS",
                "descripcion": "Exige que a su pareja le fascinen los perros / convive activamente con perro."
            })
        if mascotas.get("rechaza_mascotas"):
            dealbreakers.append({
                "categoria": "Mascotas",
                "tipo": "RECHAZA_MASCOTAS",
                "descripcion": "No le gustan las mascotas / rechaza convivir con animales."
            })

        if hijos.get("red_flag_hijos_en_pareja"):
            dealbreakers.append({
                "categoria": "Hijos",
                "tipo": "RECHAZA_HIJOS_PAREJA",
                "descripcion": "Red flag explícita si su pareja ya tiene hijos."
            })
        if hijos.get("vasectomia"):
            dealbreakers.append({
                "categoria": "Fertilidad",
                "tipo": "VASECTOMIA",
                "descripcion": "Tiene vasectomía realizada."
            })
        if hijos.get("no_quiere_hijos"):
            dealbreakers.append({
                "categoria": "Hijos",
                "tipo": "NO_QUIERE_HIJOS",
                "descripcion": "No desea tener hijos bajo ninguna circunstancia."
            })

        if vicios.get("rechaza_fumadores"):
            dealbreakers.append({
                "categoria": "Vicios",
                "tipo": "RECHAZA_FUMADORES",
                "descripcion": "Red flag si su pareja fuma o tiene vicios."
            })
        if vicios.get("fuma_cigarrillo") or vicios.get("vapea"):
            dealbreakers.append({
                "categoria": "Vicios",
                "tipo": "CONSUME_NICOTINA",
                "descripcion": "Fuma cigarrillo o vapea activamente."
            })

        if creencias.get("exige_creyente"):
            dealbreakers.append({
                "categoria": "Espiritualidad",
                "tipo": "EXIGE_CREYENTE",
                "descripcion": "Considera fundamental que su pareja crea en Dios."
            })
        if creencias.get("ateo"):
            dealbreakers.append({
                "categoria": "Espiritualidad",
                "tipo": "ATEO_DECLARADO",
                "descripcion": "Ateo declarado / rechaza actividades religiosas."
            })

        if orientacion.get("es_lesbiana"):
            dealbreakers.append({
                "categoria": "Orientación",
                "tipo": "LESBIANA",
                "descripcion": "Orientación homosexual femenina (solo mujeres)."
            })
        elif orientacion.get("es_gay"):
            dealbreakers.append({
                "categoria": "Orientación",
                "tipo": "GAY",
                "descripcion": "Orientación homosexual masculina (solo hombres)."
            })

        if estilo_vida.get("exige_deportista"):
            dealbreakers.append({
                "categoria": "Estilo de Vida",
                "tipo": "EXIGE_DEPORTISTA",
                "descripcion": "Exige que su pareja haga ejercicio o tenga estilo de vida activo."
            })
        if estilo_vida.get("sedentario"):
            dealbreakers.append({
                "categoria": "Estilo de Vida",
                "tipo": "SEDENTARIO",
                "descripcion": "No realiza actividad física / estilo sedentario."
            })

        return dealbreakers

    @classmethod
    def _calculate_completeness(cls, bio_notes: str, profile_data: Dict[str, Any], **kwargs) -> int:
        pts = 0
        if bio_notes and len(bio_notes) > 100:
            pts += 40
        if profile_data.get("age"):
            pts += 15
        if profile_data.get("city"):
            pts += 10
        if profile_data.get("occupation"):
            pts += 10
        if kwargs.get("mascotas", {}).get("ama_perros") or kwargs.get("mascotas", {}).get("rechaza_mascotas"):
            pts += 10
        if kwargs.get("creencias", {}).get("etiqueta_principal") != "No especificado":
            pts += 10
        if kwargs.get("estilo_vida", {}).get("hace_deporte"):
            pts += 5
        return min(pts, 100)

    # ─── EVALUADOR PRE-MATCH DE DEALBREAKERS ─────────────────────────────────

    @classmethod
    def evaluate_bidirectional_dealbreakers_360(
        cls,
        p_a: Dict[str, Any],
        p_b: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evalúa si existe algún dealbreaker absoluto bidireccional entre Persona A y Persona B.
        Devuelve:
          - compatible: bool
          - reasons: List[str] (motivos clínicos detallados si hay rechazo)
          - warnings: List[str] (fricciones que no son descarte total pero alertan a la psicóloga)
        """
        reasons = []
        warnings = []

        # 1. REGLA MASCOTAS / PERROS
        m_a = p_a.get("mascotas", {})
        m_b = p_b.get("mascotas", {})

        if (m_a.get("infaltable_perros") or m_a.get("ama_perros")) and m_b.get("rechaza_mascotas"):
            reasons.append(
                f"Incompatibilidad crítica en mascotas: {p_a.get('name')} exige fascinación por los perros/convive con perro, y {p_b.get('name')} declara que no le gustan las mascotas."
            )
        if (m_b.get("infaltable_perros") or m_b.get("ama_perros")) and m_a.get("rechaza_mascotas"):
            reasons.append(
                f"Incompatibilidad crítica en mascotas: {p_b.get('name')} exige fascinación por los perros/convive con perro, y {p_a.get('name')} declara que no le gustan las mascotas."
            )

        # 2. REGLA ORIENTACIÓN SEXUAL
        o_a = p_a.get("orientacion", {})
        o_b = p_b.get("orientacion", {})
        g_a = (p_a.get("gender") or "").lower()
        g_b = (p_b.get("gender") or "").lower()

        if o_a.get("es_lesbiana") and "masc" in g_b:
            reasons.append(f"Orientación incompatible: {p_a.get('name')} es lesbiana y {p_b.get('name')} es hombre.")
        if o_b.get("es_lesbiana") and "masc" in g_a:
            reasons.append(f"Orientación incompatible: {p_b.get('name')} es lesbiana y {p_a.get('name')} es hombre.")
        if o_a.get("es_gay") and "fem" in g_b:
            reasons.append(f"Orientación incompatible: {p_a.get('name')} es gay y {p_b.get('name')} es mujer.")
        if o_b.get("es_gay") and "fem" in g_a:
            reasons.append(f"Orientación incompatible: {p_b.get('name')} es gay y {p_a.get('name')} es mujer.")

        # 3. REGLA HIJOS & VASECTOMÍA
        h_a = p_a.get("hijos", {})
        h_b = p_b.get("hijos", {})

        if h_a.get("red_flag_hijos_en_pareja") and h_b.get("tiene_hijos"):
            reasons.append(f"Fricción de hijos: {p_a.get('name')} tiene como red flag parejas con hijos, y {p_b.get('name')} tiene hijos.")
        if h_b.get("red_flag_hijos_en_pareja") and h_a.get("tiene_hijos"):
            reasons.append(f"Fricción de hijos: {p_b.get('name')} tiene como red flag parejas con hijos, y {p_a.get('name')} tiene hijos.")

        if h_a.get("quiere_hijos") and (h_b.get("vasectomia") or h_b.get("no_quiere_hijos")):
            reasons.append(f"Planes familiares opuestos: {p_a.get('name')} desea tener hijos y {p_b.get('name')} tiene vasectomía / no desea hijos.")
        if h_b.get("quiere_hijos") and (h_a.get("vasectomia") or h_a.get("no_quiere_hijos")):
            reasons.append(f"Planes familiares opuestos: {p_b.get('name')} desea tener hijos y {p_a.get('name')} tiene vasectomía / no desea hijos.")

        # 4. REGLA VICIOS / FUMADORES
        v_a = p_a.get("vicios", {})
        v_b = p_b.get("vicios", {})

        if v_a.get("rechaza_fumadores") and v_b.get("consume_nicotina"):
            reasons.append(f"Red flag de sustancias: {p_a.get('name')} rechaza fumadores/vicios y {p_b.get('name')} fuma/vapea.")
        if v_b.get("rechaza_fumadores") and v_a.get("consume_nicotina"):
            reasons.append(f"Red flag de sustancias: {p_b.get('name')} rechaza fumadores/vicios y {p_a.get('name')} fuma/vapea.")

        # 5. REGLA CITAS PREVIAS REGISTRADAS
        hist_a = p_a.get("historial", {}).get("past_matched_names", [])
        hist_b = p_b.get("historial", {}).get("past_matched_names", [])
        name_a_lower = p_a.get("name", "").lower().strip()
        name_b_lower = p_b.get("name", "").lower().strip()

        if any(name_b_lower in past.lower() for past in hist_a) or any(name_a_lower in past.lower() for past in hist_b):
            reasons.append(f"Historial previo: {p_a.get('name')} y {p_b.get('name')} ya tuvieron una cita o asignación previa en Daily Lover.")

        # 6. ADVERTENCIAS CLÍNICAS (No descartan totalmente pero se alertan)
        c_a = p_a.get("creencias", {})
        c_b = p_b.get("creencias", {})
        if c_a.get("exige_creyente") and c_b.get("ateo"):
            warnings.append(f"Contraste de Fe: {p_a.get('name')} exige que su match crea en Dios, y {p_b.get('name')} es ateo declarado.")
        elif c_b.get("exige_creyente") and c_a.get("ateo"):
            warnings.append(f"Contraste de Fe: {p_b.get('name')} exige que su match crea en Dios, y {p_a.get('name')} es ateo declarado.")

        ev_a = p_a.get("estilo_vida", {})
        ev_b = p_b.get("estilo_vida", {})
        if ev_a.get("exige_deportista") and ev_b.get("sedentario"):
            warnings.append(f"Contraste Físico: {p_a.get('name')} exige que su match haga deporte y {p_b.get('name')} es sedentario(a).")
        elif ev_b.get("exige_deportista") and ev_a.get("sedentario"):
            warnings.append(f"Contraste Físico: {p_b.get('name')} exige que su match haga deporte y {p_a.get('name')} es sedentario(a).")

        return {
            "compatible": len(reasons) == 0,
            "reasons": reasons,
            "warnings": warnings,
        }
