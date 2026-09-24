"""
Clinical Profile Extractor 360° — Daily Lover
Consolida el 100% de la información clínica, CRM, notas de entrevistas,
observaciones de citas pasadas y feedbacks para construir un perfil
estructurado multidimensional ANTES de ejecutar el motor de matching.
"""

import re
import json
import unicodedata
from typing import Dict, Any, List, Optional, Set

def clean_text(text: Optional[str]) -> str:
    if not text:
        return ""
    return str(text).strip()

def normalize_text_unaccent(text: Optional[str]) -> str:
    if not text:
        return ""
    t = unicodedata.normalize('NFD', str(text))
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return t.lower().strip()

FEMALE_NAME_TOKENS = {
    'maria', 'sofia', 'sara', 'daniela', 'laura', 'valentina', 'camila', 'alejandra',
    'juliana', 'catalina', 'andrea', 'carolina', 'diana', 'natalia', 'paula', 'tatiana',
    'amalia', 'sandra', 'claudia', 'ana', 'luisa', 'monica', 'marcela', 'adriana',
    'patricia', 'valeria', 'gabriela', 'mariana', 'isabella', 'lucia', 'katherine',
    'jessica', 'lina', 'silvia', 'vanessa', 'stephany', 'estefania', 'ingrid', 'leidy',
    'yuli', 'viviana', 'ximena', 'melissa', 'elena', 'lorena', 'pilar', 'gloria',
    'martha', 'beatriz', 'esperanza', 'rocio', 'manuela', 'veronica', 'angie', 'luz',
    'johanna', 'paola', 'angela', 'karol', 'dayana', 'cindy', 'clara', 'mercedes',
    'margarita', 'teresa', 'rosa', 'carmen', 'olga', 'cecilia',
    # Nombres femeninos reales verificados en la base de datos de usuarios
    'susana', 'susan', 'isabel', 'isabela', 'angelica', 'karen', 'lizeth', 'erika',
    'eliana', 'juanita', 'juana', 'liliana', 'jennifer', 'jimena', 'stephanie',
    'stefanny', 'alexandra', 'jenny', 'johana', 'nathalia', 'mayra', 'cristina',
    'milena', 'yenny', 'wendy', 'gina', 'karla', 'paulina', 'carol', 'linda',
    'kelly', 'julieth', 'jeimy', 'sonia', 'zuleima', 'joanna', 'katya', 'bibiana',
    'luna', 'elizabeth', 'maritza', 'astrid', 'constanza', 'ivonne', 'shirley',
    'giselle', 'dora', 'miriam', 'myriam', 'francy', 'blanca', 'gladys', 'nidia',
    'yamile', 'leidys', 'yuliana', 'marina', 'eugenia', 'alicia', 'victoria',
    'silvana', 'danitza', 'salome', 'antonella', 'samanta', 'samantha'
}

MALE_NAME_TOKENS = {
    'juan', 'carlos', 'diego', 'andres', 'pedro', 'luis', 'felipe', 'daniel', 'sebastian',
    'jorge', 'pablo', 'alejandro', 'david', 'mateo', 'santiago', 'cristian', 'victor',
    'gabriel', 'nicolas', 'camilo', 'miguel', 'fernando', 'ricardo', 'jose', 'manuel',
    'rodrigo', 'mauricio', 'eduardo', 'gustavo', 'javier', 'julian', 'alberto', 'sergio',
    'esteban', 'francisco', 'mario', 'oscar', 'cesar', 'leonardo', 'jaime', 'gonzalo',
    'hector', 'hugo', 'ruben', 'samuel', 'alex', 'alexander', 'martin', 'lucas', 'tomas',
    'rene', 'ivan', 'alvaro', 'guillermo', 'fabian', 'edwin', 'harold', 'german',
    'antonio', 'jhon', 'raul', 'enrique', 'alfredo', 'alonso', 'edgar',
    # Nombres masculinos reales verificados en la base de datos de usuarios
    'john', 'jonathan', 'michael', 'brian', 'kevin', 'omar', 'fabio', 'federico',
    'christian', 'angel', 'brayan', 'bryan', 'rafael', 'wilson', 'johann', 'johan',
    'jacobo', 'nelson', 'orlando', 'william', 'vladimir', 'hernan', 'marcelo',
    'giovanny', 'danny', 'dario', 'didier', 'marco', 'gordon', 'erik'
}

def infer_gender_from_name_and_bio(name: str, bio_notes: str = "") -> str:
    """
    Infiere heurísticamente el género de una persona a partir de su nombre de pila
    y términos clave en sus notas clínicas de entrevista.
    Retorna 'Mujer', 'Hombre' o 'No especificado'.
    """
    norm_name = normalize_text_unaccent(name)
    tokens = [t for t in re.split(r'[^a-z]+', norm_name) if t]
    if tokens:
        first = tokens[0]
        if first in FEMALE_NAME_TOKENS:
            return "Mujer"
        if first in MALE_NAME_TOKENS:
            return "Hombre"
        if len(tokens) > 1:
            second = tokens[1]
            if second in FEMALE_NAME_TOKENS and first not in MALE_NAME_TOKENS:
                return "Mujer"
            if second in MALE_NAME_TOKENS and first not in FEMALE_NAME_TOKENS:
                return "Hombre"

    if bio_notes:
        norm_bio = normalize_text_unaccent(bio_notes)
        if re.search(r'\b(una chica|la chica|una mujer|ella busca|ella es|chica querida|super parchada|soltera|graduada|abogada|ingeniera|psicologa|medica)\b', norm_bio):
            return "Mujer"
        if re.search(r'\b(un chico|el chico|un hombre|el busca|el es|chico querido|super parchado|soltero|graduado|abogado|ingeniero|psicologo|medico)\b', norm_bio):
            return "Hombre"

    return "No especificado"

def infer_city_from_text(text: Optional[str]) -> Optional[str]:
    """
    Infiere la ciudad a partir de notas biográficas o texto libre.
    Reconoce las principales ciudades y municipios metropolitanos de Colombia.
    """
    if not text:
        return None
    norm = normalize_text_unaccent(text)
    # Área Metropolitana del Valle de Aburrá / Antioquia
    if re.search(r'\b(medellin|itagui|itaguei|envigado|sabaneta|bello|la estrella|rionegro|poblado|laureles|belen|antioquia)\b', norm):
        if "itagui" in norm or "itaguei" in norm:
            return "Itagüí"
        if "envigado" in norm:
            return "Envigado"
        return "Medellín"
    # Bogotá D.C. y Sabana de Bogotá
    if re.search(r'\b(bogota|cedritos|chapinero|usaquen|suba|chia|cajica|cota|soacha|engativa|colina|rosales|teusaquillo|cundinamarca)\b', norm):
        if "chia" in norm:
            return "Chía"
        if "cajica" in norm:
            return "Cajicá"
        return "Bogotá"
    # Cali y Valle del Cauca
    if re.search(r'\b(cali|jamundi|yumbo|valle del cauca)\b', norm):
        return "Cali"
    # Barranquilla y Caribe
    if re.search(r'\b(barranquilla|soledad|puerto colombia|atlantico)\b', norm):
        return "Barranquilla"
    if re.search(r'\b(cartagena|bolivar)\b', norm):
        return "Cartagena"
    # Santander
    if re.search(r'\b(bucaramanga|floridablanca|piedecuesta|giron|santander)\b', norm):
        return "Bucaramanga"
    # Eje Cafetero
    if re.search(r'\b(pereira|dosquebradas|risaralda)\b', norm):
        return "Pereira"
    if re.search(r'\b(manizales|caldas)\b', norm):
        return "Manizales"
    if re.search(r'\b(armenia|quindio)\b', norm):
        return "Armenia"
    return None

def get_metro_cluster(city: Optional[str]) -> Optional[str]:
    """
    Normaliza una ciudad o municipio a su conglomerado metropolitano principal.
    Permite emparejar personas de Medellín con Itagüí/Envigado, o Bogotá con Chía,
    pero previene cruces de larga distancia (ej: Bogotá x Medellín o Cali x Bogotá).
    """
    if not city:
        return None
    c = normalize_text_unaccent(city).replace('?', 'a')
    if any(k in c for k in ["medell", "itagui", "itaguei", "envigado", "sabaneta", "bello", "estrella", "rionegro", "poblado", "laureles"]):
        return "medellin_metro"
    if any(k in c for k in ["bogot", "chia", "cajica", "cota", "soacha", "zipaquira", "engativa", "suba", "cedritos", "chapinero", "colina", "usaquen"]):
        return "bogota_metro"
    if any(k in c for k in ["cali", "jamundi", "yumbo"]):
        return "cali_metro"
    if any(k in c for k in ["barranq", "soledad", "puerto colombia"]):
        return "barranquilla_metro"
    if any(k in c for k in ["cartagen"]):
        return "cartagena_metro"
    if any(k in c for k in ["bucaram", "floridablanca", "piedecuesta", "giron"]):
        return "bucaramanga_metro"
    if any(k in c for k in ["pereir", "manizal", "armenia", "dosquebradas"]):
        return "eje_cafetero"
    return c

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
        effective_bio = clean_text(bio_notes) or clean_text(profile_data.get("bio_notes", ""))
        all_text_blocks = [
            effective_bio,
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

        # Detección e inferencia de género robusta si no está registrado
        raw_gender = (profile_data.get("gender") or "").strip()
        if not raw_gender or raw_gender.lower() in ["no especificado", "none", ""]:
            inferred_g = infer_gender_from_name_and_bio(name, bio_notes)
            resolved_gender = inferred_g if inferred_g != "No especificado" else "No especificado"
        else:
            resolved_gender = raw_gender

        # Detección e inferencia de ciudad
        raw_city = (profile_data.get("city") or "").strip()
        if not raw_city or raw_city.lower() in ["no especificado", "none", "todas", ""]:
            inferred_c = infer_city_from_text(full_text)
            resolved_city = inferred_c if inferred_c else "No especificada"
        else:
            resolved_city = raw_city

        # Detección de edad propia
        raw_age = profile_data.get("age")
        if not raw_age:
            m_a = re.search(r'\b(\d{2})\s*a[ñn]os\b', full_text, re.IGNORECASE) or re.search(r'edad:\s*(\d{2})', full_text, re.IGNORECASE)
            if m_a:
                try:
                    raw_age = int(m_a.group(1))
                except Exception:
                    pass

        # Rango de edad buscado (dealbreaker etario)
        sp = profile_data.get("search_preferences") or {}
        if isinstance(sp, str):
            try:
                sp = json.loads(sp)
            except Exception:
                sp = {}
        min_age_pref = sp.get("min_age")
        max_age_pref = sp.get("max_age")
        if not min_age_pref and not max_age_pref:
            m_r = re.search(r'(?:rango|busca|edad|edades)[:\s]*(\d{2})\s*(?:a|-)\s*(\d{2})', full_text, re.IGNORECASE)
            if m_r:
                try:
                    min_age_pref = int(m_r.group(1))
                    max_age_pref = int(m_r.group(2))
                except Exception:
                    pass
            elif re.search(r'(?:no menores|no hombres menores|cero menores)', full_text, re.IGNORECASE):
                if raw_age:
                    min_age_pref = int(raw_age)

        return {
            "user_id": user_id,
            "name": name,
            "city": resolved_city,
            "age": raw_age,
            "min_age_pref": min_age_pref,
            "max_age_pref": max_age_pref,
            "gender": resolved_gender,
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

        datos_mascotas_verificados = bool(
            rechaza_mascotas or ama_perros or tiene_perro or infaltable_perros or re.search(r"(gatos?|mascotas?|perros?|animales)", text)
        )

        return {
            "ama_perros": ama_perros,
            "tiene_perro": tiene_perro,
            "infaltable_perros": infaltable_perros,
            "rechaza_mascotas": rechaza_mascotas,
            "tolera_mascotas": not rechaza_mascotas,
            "datos_mascotas_verificados": datos_mascotas_verificados,
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

        datos_hijos_verificados = bool(
            has_children_explicit is not None 
            or wants_children_explicit is not None 
            or tiene_hijos 
            or quiere_hijos 
            or no_quiere_hijos 
            or vasectomia 
            or red_flag_hijos 
            or re.search(r"(sin hijos|no tiene hijos|cero hijos)", text)
        )

        return {
            "tiene_hijos": tiene_hijos,
            "quiere_hijos": quiere_hijos,
            "no_quiere_hijos": no_quiere_hijos,
            "vasectomia": vasectomia,
            "red_flag_hijos_en_pareja": red_flag_hijos,
            "datos_hijos_verificados": datos_hijos_verificados,
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

        no_fuma = bool(re.search(r"(no fuma|cero cigarrillo|no vapea|no consume nicotina|no fumo|cero tabaco)", text))
        datos_sustancias_verificados = bool(fuma_cigarrillo or vapea or fuma_cannabis or no_fuma or rechaza_fumadores)

        return {
            "fuma_cigarrillo": fuma_cigarrillo,
            "vapea": vapea,
            "fuma_cannabis": fuma_cannabis,
            "consume_nicotina": fuma_cigarrillo or vapea,
            "rechaza_fumadores": rechaza_fumadores,
            "no_fuma": no_fuma,
            "datos_sustancias_verificados": datos_sustancias_verificados,
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
            "es_bi": is_bi,
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

        if (m_a.get("infaltable_perros") or m_a.get("ama_perros")):
            if m_b.get("rechaza_mascotas"):
                reasons.append(
                    f"Incompatibilidad crítica en mascotas: {p_a.get('name')} exige fascinación por los perros/convive con perro, y {p_b.get('name')} declara que no le gustan las mascotas."
                )
            elif not m_b.get("datos_mascotas_verificados"):
                reasons.append(
                    f"Descarte por no-negociable no verificable: {p_a.get('name')} convive con perro y exige fascinación por los animales; la ficha de {p_b.get('name')} no tiene verificada su afinidad con mascotas."
                )

        if m_a.get("rechaza_mascotas"):
            if m_b.get("tiene_perro") or m_b.get("infaltable_perros"):
                reasons.append(
                    f"Incompatibilidad crítica en mascotas: {p_a.get('name')} rechaza convivir con animales y {p_b.get('name')} convive con mascotas/perros."
                )

        # 2. REGLA ORIENTACIÓN SEXUAL Y GÉNERO
        o_a = p_a.get("orientacion", {})
        o_b = p_b.get("orientacion", {})
        g_a = (p_a.get("gender") or "").lower()
        g_b = (p_b.get("gender") or "").lower()

        # Si aún no tuvieran género especificado en profile_data, intentar inferirlo por el nombre
        if not g_a or "no especificado" in g_a:
            g_a = infer_gender_from_name_and_bio(p_a.get("name", "")).lower()
        if not g_b or "no especificado" in g_b:
            g_b = infer_gender_from_name_and_bio(p_b.get("name", "")).lower()

        is_a_female = "muj" in g_a or "fem" in g_a
        is_a_male = "homb" in g_a or "masc" in g_a
        is_b_female = "muj" in g_b or "fem" in g_b
        is_b_male = "homb" in g_b or "masc" in g_b

        is_a_hetero = o_a.get("es_hetero") or o_a.get("codigo") == "hetero"
        is_b_hetero = o_b.get("es_hetero") or o_b.get("codigo") == "hetero"

        # Compatibilidad Heterosexual: rechazo absoluto de parejas del mismo sexo
        if is_a_hetero:
            if is_a_female and is_b_female:
                reasons.append(f"Orientación incompatible: {p_a.get('name')} es mujer heterosexual (busca hombres) y {p_b.get('name')} es mujer.")
            elif is_a_male and is_b_male:
                reasons.append(f"Orientación incompatible: {p_a.get('name')} es hombre heterosexual (busca mujeres) y {p_b.get('name')} es hombre.")

        if is_b_hetero:
            if is_b_female and is_a_female and not any("es mujer" in r for r in reasons):
                reasons.append(f"Orientación incompatible: {p_b.get('name')} es mujer heterosexual (busca hombres) y {p_a.get('name')} es mujer.")
            elif is_b_male and is_a_male and not any("es hombre" in r for r in reasons):
                reasons.append(f"Orientación incompatible: {p_b.get('name')} es hombre heterosexual (busca mujeres) y {p_a.get('name')} es hombre.")

        # Cruce Hetero <-> Homosexual (Mujer Hetero + Hombre Gay, o Hombre Hetero + Mujer Lesbiana)
        if is_a_hetero and is_a_female and o_b.get("es_gay"):
            reasons.append(f"Orientación incompatible: {p_a.get('name')} es mujer heterosexual y {p_b.get('name')} es gay.")
        if is_b_hetero and is_b_female and o_a.get("es_gay"):
            reasons.append(f"Orientación incompatible: {p_b.get('name')} es mujer heterosexual y {p_a.get('name')} es gay.")
        if is_a_hetero and is_a_male and o_b.get("es_lesbiana"):
            reasons.append(f"Orientación incompatible: {p_a.get('name')} es hombre heterosexual y {p_b.get('name')} es lesbiana.")
        if is_b_hetero and is_b_male and o_a.get("es_lesbiana"):
            reasons.append(f"Orientación incompatible: {p_b.get('name')} es hombre heterosexual y {p_a.get('name')} es lesbiana.")

        # Reglas Homosexuales existentes
        if o_a.get("es_lesbiana") and is_b_male:
            reasons.append(f"Orientación incompatible: {p_a.get('name')} es lesbiana y {p_b.get('name')} es hombre.")
        if o_b.get("es_lesbiana") and is_a_male:
            reasons.append(f"Orientación incompatible: {p_b.get('name')} es lesbiana y {p_a.get('name')} es hombre.")
        if o_a.get("es_gay") and is_b_female:
            reasons.append(f"Orientación incompatible: {p_a.get('name')} es gay y {p_b.get('name')} es mujer.")
        if o_b.get("es_gay") and is_a_female:
            reasons.append(f"Orientación incompatible: {p_b.get('name')} es gay y {p_a.get('name')} es mujer.")

        # 3. REGLA HIJOS & VASECTOMÍA
        h_a = p_a.get("hijos", {})
        h_b = p_b.get("hijos", {})

        if h_a.get("red_flag_hijos_en_pareja"):
            if h_b.get("tiene_hijos"):
                reasons.append(f"Fricción de hijos: {p_a.get('name')} tiene como red flag parejas con hijos, y {p_b.get('name')} tiene hijos.")
            elif not h_b.get("datos_hijos_verificados"):
                reasons.append(f"Descarte por no-negociable no verificable: {p_a.get('name')} tiene como innegociable no salir con parejas que ya tengan hijos, y la ficha de {p_b.get('name')} no especifica si tiene hijos.")

        if h_a.get("quiere_hijos"):
            if h_b.get("vasectomia") or h_b.get("no_quiere_hijos"):
                reasons.append(f"Planes familiares opuestos: {p_a.get('name')} desea tener hijos y {p_b.get('name')} tiene vasectomía / no desea hijos.")
            elif not h_b.get("datos_hijos_verificados"):
                reasons.append(f"Descarte por no-negociable no verificable: {p_a.get('name')} tiene como innegociable formar una familia con hijos, y la ficha de {p_b.get('name')} no tiene registrada su postura frente a tener hijos.")

        # 4. REGLA VICIOS / FUMADORES
        v_a = p_a.get("vicios", {})
        v_b = p_b.get("vicios", {})

        if v_a.get("rechaza_fumadores"):
            if v_b.get("consume_nicotina"):
                reasons.append(f"Red flag de sustancias: {p_a.get('name')} rechaza fumadores/vicios y {p_b.get('name')} fuma/vapea.")
            elif not v_b.get("datos_sustancias_verificados"):
                reasons.append(f"Descarte por no-negociable no verificable: {p_a.get('name')} exige pareja no fumadora / sin vicios, y la ficha de {p_b.get('name')} no cuenta con datos verificados sobre consumo de sustancias.")

        # 5. REGLA CITAS PREVIAS REGISTRADAS
        hist_a = p_a.get("historial", {}).get("past_matched_names", [])
        hist_b = p_b.get("historial", {}).get("past_matched_names", [])
        name_a_lower = p_a.get("name", "").lower().strip()
        name_b_lower = p_b.get("name", "").lower().strip()

        if any(name_b_lower in past.lower() for past in hist_a) or any(name_a_lower in past.lower() for past in hist_b):
            reasons.append(f"Historial previo: {p_a.get('name')} y {p_b.get('name')} ya tuvieron una cita o asignación previa en Daily Lover.")

        # 6. REGLA CIUDAD / TERRITORIO
        city_a = p_a.get("city") or ""
        city_b = p_b.get("city") or ""
        cluster_a = get_metro_cluster(city_a) if city_a and city_a.lower() != "todas" else None
        cluster_b = get_metro_cluster(city_b) if city_b and city_b.lower() != "todas" else None

        if cluster_a:
            if not city_b or city_b.strip().lower() in ("no especificada", "none", ""):
                reasons.append(
                    f"Descarte por no-negociable no verificable: {p_a.get('name')} reside en {city_a} y {p_b.get('name')} no tiene ciudad de residencia registrada para coordinar cita presencial."
                )
            elif cluster_b and cluster_a != cluster_b:
                reasons.append(
                    f"Incompatibilidad de ciudad: {p_a.get('name')} reside en {city_a} y {p_b.get('name')} reside en {city_b}. Matches interciudades no permitidos."
                )

        # 7. REGLA RANGO DE EDAD BIDIRECCIONAL
        age_a = p_a.get("age")
        age_b = p_b.get("age")
        min_pref_a = p_a.get("min_age_pref")
        max_pref_a = p_a.get("max_age_pref")
        min_pref_b = p_b.get("min_age_pref")
        max_pref_b = p_b.get("max_age_pref")

        # Validación de Persona B evaluada contra los límites de Persona A
        if min_pref_a is not None or max_pref_a is not None:
            if not age_b or age_b == 0:
                reasons.append(
                    f"Descarte por no-negociable no verificable: {p_a.get('name')} exige rango de edad específico ({min_pref_a or 18} a {max_pref_a or 99} años), y {p_b.get('name')} no tiene edad registrada."
                )
            else:
                if min_pref_a is not None and age_b < min_pref_a:
                    reasons.append(
                        f"Incompatibilidad de edad: {p_a.get('name')} exige pareja de mínimo {min_pref_a} años, y {p_b.get('name')} tiene {age_b} años."
                    )
                elif max_pref_a is not None and age_b > max_pref_a:
                    reasons.append(
                        f"Incompatibilidad de edad: {p_a.get('name')} exige pareja de máximo {max_pref_a} años, y {p_b.get('name')} tiene {age_b} años."
                    )

        # Validación de Persona A evaluada contra los límites de Persona B
        if age_a is not None:
            if min_pref_b is not None and age_a < min_pref_b:
                reasons.append(
                    f"Incompatibilidad de edad: {p_b.get('name')} exige pareja de mínimo {min_pref_b} años, y {p_a.get('name')} tiene {age_a} años."
                )
            elif max_pref_b is not None and age_a > max_pref_b:
                reasons.append(
                    f"Incompatibilidad de edad: {p_b.get('name')} exige pareja de máximo {max_pref_b} años, y {p_a.get('name')} tiene {age_a} años."
                )

        # 8. ADVERTENCIAS CLÍNICAS (No descartan totalmente pero se alertan)
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
