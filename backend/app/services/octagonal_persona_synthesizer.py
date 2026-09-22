"""
Octagonal Persona Synthesizer — DailyLover
Sintetizador Clínico Multidimensional de Perfiles en 8 Ejes Vinculares.
Transforma notas no estructuradas y datos del CRM en un Vector Clínico Estructurado.
"""

import re
import unicodedata
from typing import Dict, Any, List, Optional

def normalize_text(text: Optional[str]) -> str:
    if not text:
        return ""
    t = unicodedata.normalize('NFD', str(text))
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return t.lower().strip()

class OctagonalPersonaSynthesizer:
    """
    Motor de síntesis en 8 Ejes Clínicos:
    1. Viabilidad Logística y Espaciotemporal
    2. Horizonte Temporal y Fase de Vida (Timing)
    3. Matriz Axiológica y Valores Sagrados
    4. Estilo de Conflicto y Regulación Emocional
    5. Autonomía vs Fusión (Espacio Vital)
    6. Sincronía de Ritmo Vital y Energía Biológica
    7. Polaridad de Roles y Dinámica Vincular
    8. Química Somática, Estética y Sensorial
    """

    @classmethod
    def synthesize_profile(
        cls,
        user_id: int,
        name: str,
        city: str,
        gender: str,
        age: Optional[int],
        bio_notes: str = "",
        lifestyle: Optional[Dict[str, Any]] = None,
        search_preferences: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        lifestyle = lifestyle or {}
        sp = search_preferences or {}
        
        full_text = f"{bio_notes or ''}\n{json_to_text(lifestyle)}\n{json_to_text(sp)}"
        norm = normalize_text(full_text)

        # ─── EJE 1: VIABILIDAD LOGÍSTICA & HORARIOS ──────────────────────────────
        es_turno_rotativo = bool(re.search(r'(turno rotativo|turnos rotativos|guardias de|turnos 12 horas)', norm))
        es_turno_noche = bool(re.search(r'(trabaja de noche|turno(s)? de noche|horario nocturno)', norm))
        es_piloto = bool(re.search(r'(piloto de|aviacion|latam|avianca)', norm))
        es_rotacion_extrema = bool(re.search(r'(trabaja \d+ dias.*descansa \d+|regimen \d+x\d+|turquia|exterior)', norm))
        
        custodia_compartida = bool(re.search(
            r'(custodia compartida|semana de por medio|semana si y|semana por medio|1 semana con|semanas con el hijo)',
            norm
        ))

        dispuesto_viajar = bool(re.search(
            r'(dispuest[oa] a viajar|puede viajar|abiert[oa] a viajar|viaja con frecuencia|viaja frecuentemente|'
            r'viaja constantemente|disponibilidad (para|de) viajar|viaja por trabajo|dispuest[oa] a trasladarse|'
            r'dispuest[oa] a mudarse|abiert[oa] a otras ciudades|no importa la ciudad|relacion a distancia)',
            norm
        )) or es_piloto or es_rotacion_extrema or (sp.get("city") and any(k in str(sp.get("city")).lower() for k in ["todas", "cualquiera"]))

        eje1_logistica = {
            "turnos_rotativos": es_turno_rotativo,
            "turno_nocturno": es_turno_noche,
            "profesion_alta_movilidad": es_piloto or es_rotacion_extrema,
            "disposicion_viajar": dispuesto_viajar,
            "custodia_compartida_semanal": custodia_compartida,
            "disponibilidad_resumen": (
                "Régimen de rotación extrema o turnos de 12h" if (es_rotacion_extrema or es_turno_rotativo or es_turno_noche)
                else ("Custodia compartida semana de por medio" if custodia_compartida else "Horario estándar")
            )
        }

        # ─── EJE 2: HORIZONTE TEMPORAL & TIMING ──────────────────────────────────
        busca_casarse = bool(re.search(r'(casarse|desea casarse|matrimonio|formar una familia|proyecto de familia)', norm))
        busca_algo_casual = bool(re.search(r'(algo casual|pasar el rato|sugar|diversion|fluir sin compromisos|sin afanes)', norm))
        planes_emigrar = bool(re.search(r'(irse del pais|mudarse a espana|se va a espana|planes de emigrar|se muda a miami|nomada digital)', norm))
        
        # Duelo reciente (< 3 meses)
        duelo_reciente = bool(re.search(
            r'(solter[oa] hace (1|2|un|dos) meses|termino hace (1|2|un|dos) meses|separad[oa] hace (1|un) mes|ruptura reciente|acabo de separar)',
            norm
        ))

        acepta_brecha_edad_amplia = bool(re.search(
            r'(acepta mayores|acepta menores|no le importa la edad|sin limite de edad|edad no es problema|'
            r'abiert[oa] a mayor edad|rango de edad amplio|le gustan mayores|le gustan menores|'
            r'hasta \d+ a[ñn]os mayor|hasta \d+ a[ñn]os menor|'
            r'edad:\s*\d{2}\s*a\s*\d{2}|\bentre \d{2} y \d{2} a[ñn]os\b)',
            norm
        ))
        min_age_sp = sp.get("min_age")
        max_age_sp = sp.get("max_age")
        if min_age_sp is not None and max_age_sp is not None:
            try:
                if int(max_age_sp) - int(min_age_sp) > 8:
                    acepta_brecha_edad_amplia = True
            except Exception:
                pass

        eje2_timing = {
            "intencion_primaria": "Matrimonio / Familia" if busca_casarse else ("Casual / Exploratorio" if busca_algo_casual else "Relación Estable"),
            "planes_mudanza_internacional": planes_emigrar,
            "duelo_activo_reciente": duelo_reciente,
            "acepta_brecha_edad_amplia": acepta_brecha_edad_amplia,
            "alerta_disponibilidad_emocional": "Ruptura sentimental hace menos de 60-90 días" if duelo_reciente else "Disponible emocionalmente"
        }

        # ─── EJE 3: MATRIZ AXIOLÓGICA (VALORES SAGRADOS) ──────────────────────────
        # Hijos y fertilidad
        tiene_hijos = (lifestyle.get("has_children") in ["Sí", "Si", True]) or bool(re.search(r'(tiene \d+ hijos?|padre de|madre de|mama de|hijo de \d+ anos)', norm))
        quiere_hijos = (lifestyle.get("wants_children") in ["Sí", "Si", True]) or bool(re.search(
            r'(quiere\s+(tener\s+)?hijos|desea\s+(tener\s+)?hijos|quiere\s+ser\s+(madre|padre)|desea\s+ser\s+(madre|padre)|suena\s+con\s+ser\s+(madre|padre))',
            norm
        ))
        vasectomia = bool(re.search(r'(vasectomia|operado para no tener hijos|no quiere mas hijos)', norm))
        
        # Dinero y Proveedor
        modelo_proveedor = bool(re.search(r'(hombre proveedor|no 50-50|no 50/50|el hombre pague|caballeroso que provea|no proveedor es dealbreaker)', norm))
        modelo_igualitario = bool(re.search(r'(50-50|50/50|ambos aporten|independencia economica mutua|no mantener a nadie)', norm))
        
        # Fe y Espiritualidad
        fe_estricta_devota = bool(re.search(r'(muy creyente|catolica practicante|cristiano practicante|misa todos los|yugo desigual|sirve en la iglesia)', norm))
        es_ateo = bool(re.search(r'(ateo|atea|cero religion|no cree en dios|antirreligioso)', norm))
        
        # Política
        es_izquierda = bool(re.search(r'(de izquierda|petrista|progresista|feminista activa)', norm)) and not bool(re.search(r'(no izquierda|no petrista|cero petrista)', norm))
        es_derecha = bool(re.search(r'(de derecha|conservador|uribista)', norm)) and not bool(re.search(r'(no derecha|no conservador)', norm))
        rechaza_izquierda = bool(re.search(r'(no izquierda|no petrista|cero izquierda|nada de izquierda)', norm))
        rechaza_derecha = bool(re.search(r'(no derecha|no uribista|cero derecha|derecha extrema.*red flag)', norm))

        eje3_axiologia = {
            "tiene_hijos": tiene_hijos,
            "deseo_hijos": False if vasectomia else quiere_hijos,
            "vasectomia": vasectomia,
            "modelo_financiero": "Proveedor tradicional" if modelo_proveedor else ("Igualitario 50/50" if modelo_igualitario else "Flexible / Equilibrado"),
            "fe_espiritual": "Creyente devoto/practicante" if fe_estricta_devota else ("Ateo / Agnóstico" if es_ateo else "Espiritual / No practicante"),
            "postura_politica": "Izquierda" if es_izquierda else ("Derecha" if es_derecha else "Centro / Apolitico"),
            "vetos_politicos": {
                "rechaza_izquierda": rechaza_izquierda,
                "rechaza_derecha": rechaza_derecha
            }
        }

        # ─── EJE 4: ESTILO DE CONFLICTO & REGULACIÓN ─────────────────────────────
        necesita_tiempo_fuera = bool(re.search(r'(tomarse un espacio para pensar|procesar antes de hablar|espacio para pensar antes de continuar)', norm))
        es_reactivo_impulsivo = bool(re.search(r'(puede contestar feo|impulsiv[oa]|caracter fuerte|mal genio|explosiv[oa])', norm))
        evitativo = bool(re.search(r'(evitacion|le cuesta comunicar lo que siente|se encierra|silencio prolongado)', norm))

        eje4_conflicto = {
            "estilo_procesamiento": "Tiempo fuera / Reflexivo" if necesita_tiempo_fuera else ("Inmediato / Reactivo" if es_reactivo_impulsivo else "Equilibrado"),
            "alerta_reactividad": es_reactivo_impulsivo,
            "rasgo_evitativo": evitativo
        }

        # ─── EJE 5: AUTONOMÍA VS FUSIÓN (ESPACIO VITAL) ──────────────────────────
        es_hiper_autonomo = bool(re.search(r'(muy independiente|vive sol[oa] desde|que tenga su propia vida|no posesiva|no asfixiante|cero espacio personal.*red flag)', norm))
        es_fusionante = bool(re.search(r'(quiere todo 24/7|necesidad constante de atencion|muy melos[oa]|estar pegados todo el tiempo)', norm))

        eje5_autonomia = {
            "necesidad_espacio_personal": "Alta (Hiper-independiente)" if es_hiper_autonomo else ("Baja (Fusión / Mucha cercanía)" if es_fusionante else "Equilibrada")
        }

        # ─── EJE 6: RITMO VITAL & ENERGÍA BIOLÓGICA ──────────────────────────────
        es_atleta_alto_rendimiento = bool(re.search(r'(mundial de atletismo|maraton|triatlon|entrena 2 veces al dia|deportista de alto rendimiento|fitness disciplinado)', norm))
        es_sedentario_casero = bool(re.search(r'(planes caseros|cero gym|muy sedentari[oa]|dormir a las 8|dormir a las 9|no rumba)', norm))
        es_madrugador = bool(re.search(r'(madruga a las 5|madruga 3:30|5am en pie|alondra)', norm))
        es_nocturno = bool(re.search(r'(trasnochador|buho|sale tarde|hasta la 1 am)', norm))

        eje6_ritmo = {
            "vitalidad_fisica": "Muy Alta (Atleta / Alto Desgaste)" if es_atleta_alto_rendimiento else ("Baja (Hogareño / Sedentario)" if es_sedentario_casero else "Moderada"),
            "cronotipo": "Alondra (Madrugador extremo)" if es_madrugador else ("Búho (Nocturno)" if es_nocturno else "Estándar")
        }

        # ─── EJE 7: POLARIDAD DE ROLES & LIDERAZGO ───────────────────────────────
        quiere_hombre_lider = bool(re.search(r'(hombre que resuelva|liderazgo|energia masculina|que tome la iniciativa|seguro de si mismo)', norm))
        quiere_mujer_femenina = bool(re.search(r'(muy femenina|dulce|soft|sweet|que se deje cuidar|femenina no feminista)', norm))

        eje7_polaridad = {
            "dinamica_preferida": (
                "Polaridad Tradicional (Liderazgo masculino / Receptividad femenina)"
                if (quiere_hombre_lider or quiere_mujer_femenina)
                else "Dinámica Igualitaria / Colaborativa"
            )
        }

        # ─── EJE 8: QUÍMICA SOMÁTICA & ESTÉTICA ──────────────────────────────────
        rechaza_tatuajes = bool(re.search(r'(no tatuajes|cero tatuajes|alguien super tatuada.*no)', norm))
        rechaza_cirugias = bool(re.search(r'(no operada|cero cirugias|no tetas ni culo operado|natural)', norm))
        rechaza_obesidad = bool(re.search(r'(no gordos|no obesa|cuerpo cuidado|peso saludable)', norm))
        aseo_estricto = bool(re.search(r'(muy aseado|pulcro|dientes lindos|zapatos limpios|huela rico|clean girl)', norm))

        eje8_estetica = {
            "aseo_y_presentacion_estricta": aseo_estricto,
            "rechaza_tatuajes": rechaza_tatuajes,
            "rechaza_cirugias_esteticas": rechaza_cirugias,
            "exige_cuerpo_saludable": rechaza_obesidad
        }

        # ─── METADATOS Y ESTADO ──────────────────────────────────────────────────
        es_trans = bool(re.search(r'(hombre transgenero|mujer transgenero|persona trans\b|proceso de transicion)', norm))
        calidad_notas = "EXTENSA" if len(bio_notes) > 1200 else ("MEDIA" if len(bio_notes) > 300 else "ESCUETA")
        status = lifestyle.get("availability_status", "ACTIVO")

        return {
            "metadata": {
                "user_id": user_id,
                "name": name,
                "city": city,
                "gender": gender,
                "age": age,
                "availability_status": status,
                "disposicion_viajar": dispuesto_viajar,
                "acepta_brecha_edad_amplia": acepta_brecha_edad_amplia,
                "search_preferences": sp,
                "es_trans": es_trans,
                "calidad_notas": calidad_notas,
                "version_sintesis": "2.0-octagonal"
            },
            "ejes": {
                "1_logistica": eje1_logistica,
                "2_timing": eje2_timing,
                "3_axiologia": eje3_axiologia,
                "4_conflicto": eje4_conflicto,
                "5_autonomia": eje5_autonomia,
                "6_ritmo_vital": eje6_ritmo,
                "7_polaridad": eje7_polaridad,
                "8_estetica": eje8_estetica
            }
        }

def json_to_text(d: Any) -> str:
    if not d:
        return ""
    if isinstance(d, dict):
        parts = []
        for k, v in d.items():
            parts.append(f"{k}: {json_to_text(v)}")
        return " ".join(parts)
    if isinstance(d, list):
        return " ".join([str(x) for x in d])
    return str(d)
