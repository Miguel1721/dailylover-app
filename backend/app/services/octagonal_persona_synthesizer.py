"""
Octagonal Persona Synthesizer — DailyLover
Sintetizador Clínico Multidimensional de Perfiles en 8 Ejes Vinculares.
Transforma notas no estructuradas y datos del CRM en un Vector Clínico Estructurado.
"""

import os
import json
import logging
import re
import unicodedata
from typing import Dict, Any, List, Optional
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)

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

    @classmethod
    def _merge_llm_extraction(cls, base: Dict[str, Any], extracted: Dict[str, Any], model_name: str, gender: str) -> None:
        base["metadata"]["version_sintesis"] = "2.0-octagonal-llm"
        base["metadata"]["extraction_engine"] = model_name

        # Soporte para esquema anidado o plano
        e1 = extracted.get("1_logistica", extracted)
        e2 = extracted.get("2_timing", extracted)
        e3 = extracted.get("3_axiologia", extracted)
        e4 = extracted.get("4_conflicto", extracted)
        e5 = extracted.get("5_autonomia", extracted)
        e6 = extracted.get("6_ritmo_vital", extracted)
        e7 = extracted.get("7_polaridad", extracted)
        e8 = extracted.get("8_estetica", extracted)

        # Eje 1: Logística
        if "turnos_rotativos" in e1:
            base["ejes"]["1_logistica"]["turnos_rotativos"] = bool(e1["turnos_rotativos"])
        if "turno_nocturno" in e1:
            base["ejes"]["1_logistica"]["turno_nocturno"] = bool(e1["turno_nocturno"])
        if "profesion_alta_movilidad" in e1:
            base["ejes"]["1_logistica"]["profesion_alta_movilidad"] = bool(e1["profesion_alta_movilidad"])
        if "disposicion_viajar" in e1:
            base["ejes"]["1_logistica"]["disposicion_viajar"] = bool(e1["disposicion_viajar"])
        if "custodia_compartida_semanal" in e1:
            base["ejes"]["1_logistica"]["custodia_compartida_semanal"] = bool(e1["custodia_compartida_semanal"])
        if base["ejes"]["1_logistica"]["turnos_rotativos"] or base["ejes"]["1_logistica"]["turno_nocturno"] or base["ejes"]["1_logistica"]["profesion_alta_movilidad"]:
            base["ejes"]["1_logistica"]["disponibilidad_resumen"] = "Régimen de turnos rotativos / alta movilidad"

        # Eje 2: Timing
        if "duelo_activo_reciente" in e2:
            base["ejes"]["2_timing"]["duelo_activo_reciente"] = bool(e2["duelo_activo_reciente"])
            if e2["duelo_activo_reciente"]:
                base["ejes"]["2_timing"]["alerta_disponibilidad_emocional"] = "Ruptura sentimental hace menos de 60-90 días"
        if "planes_mudanza_internacional" in e2:
            base["ejes"]["2_timing"]["planes_mudanza_internacional"] = bool(e2["planes_mudanza_internacional"])
        if "intencion_primaria" in e2 and e2["intencion_primaria"]:
            base["ejes"]["2_timing"]["intencion_primaria"] = e2["intencion_primaria"]

        # Eje 3: Axiología
        if "vasectomia" in e3:
            base["ejes"]["3_axiologia"]["vasectomia"] = bool(e3["vasectomia"])
        if "deseo_hijos" in e3:
            base["ejes"]["3_axiologia"]["deseo_hijos"] = bool(e3["deseo_hijos"])
        if "modelo_financiero" in e3 and e3["modelo_financiero"]:
            base["ejes"]["3_axiologia"]["modelo_financiero"] = e3["modelo_financiero"]
        if "fe_espiritual" in e3 and e3["fe_espiritual"]:
            base["ejes"]["3_axiologia"]["fe_espiritual"] = e3["fe_espiritual"]
        if "postura_politica" in e3 and e3["postura_politica"]:
            base["ejes"]["3_axiologia"]["postura_politica"] = e3["postura_politica"]
        if "rechaza_izquierda" in e3:
            base["ejes"]["3_axiologia"]["vetos_politicos"]["rechaza_izquierda"] = bool(e3["rechaza_izquierda"])
        if "rechaza_derecha" in e3:
            base["ejes"]["3_axiologia"]["vetos_politicos"]["rechaza_derecha"] = bool(e3["rechaza_derecha"])

        # Eje 4: Conflicto
        if "estilo_procesamiento" in e4 and e4["estilo_procesamiento"]:
            base["ejes"]["4_conflicto"]["estilo_procesamiento"] = e4["estilo_procesamiento"]
        if "alerta_reactividad" in e4:
            base["ejes"]["4_conflicto"]["alerta_reactividad"] = bool(e4["alerta_reactividad"])
        if "rasgo_evitativo" in e4:
            base["ejes"]["4_conflicto"]["rasgo_evitativo"] = bool(e4["rasgo_evitativo"])

        # Eje 5: Autonomía
        if "necesidad_espacio_personal" in e5 and e5["necesidad_espacio_personal"]:
            base["ejes"]["5_autonomia"]["necesidad_espacio_personal"] = e5["necesidad_espacio_personal"]

        # Eje 6: Ritmo Vital
        if "vitalidad_fisica" in e6 and e6["vitalidad_fisica"]:
            base["ejes"]["6_ritmo_vital"]["vitalidad_fisica"] = e6["vitalidad_fisica"]
        if "cronotipo" in e6 and e6["cronotipo"]:
            base["ejes"]["6_ritmo_vital"]["cronotipo"] = e6["cronotipo"]

        # Eje 7: Polaridad
        if "dinamica_preferida" in e7 and e7["dinamica_preferida"]:
            base["ejes"]["7_polaridad"]["dinamica_preferida"] = e7["dinamica_preferida"]

        # Eje 8: Estética
        if "aseo_y_presentacion_estricta" in e8:
            base["ejes"]["8_estetica"]["aseo_y_presentacion_estricta"] = bool(e8["aseo_y_presentacion_estricta"])
        if "rechaza_tatuajes" in e8:
            base["ejes"]["8_estetica"]["rechaza_tatuajes"] = bool(e8["rechaza_tatuajes"])
        if "rechaza_cirugias_esteticas" in e8:
            base["ejes"]["8_estetica"]["rechaza_cirugias_esteticas"] = bool(e8["rechaza_cirugias_esteticas"])
        if "exige_cuerpo_saludable" in e8:
            base["ejes"]["8_estetica"]["exige_cuerpo_saludable"] = bool(e8["exige_cuerpo_saludable"])

        if "es_trans" in extracted:
            base["metadata"]["es_trans"] = bool(extracted["es_trans"])

        # Regla de consistencia clínica para vasectomía masculina
        if gender and "hombre" in gender.lower() and base["ejes"]["3_axiologia"].get("vasectomia"):
            base["ejes"]["3_axiologia"]["deseo_hijos"] = False

    @classmethod
    async def synthesize_profile_llm(
        cls,
        user_id: int,
        name: str,
        city: str,
        gender: str,
        age: Optional[int],
        bio_notes: str = "",
        lifestyle: Optional[Dict[str, Any]] = None,
        search_preferences: Optional[Dict[str, Any]] = None,
        use_llm: bool = True,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> Dict[str, Any]:
        """
        Síntesis híbrida en 8 Ejes Clínicos:
        1. Genera la estructura base determinística con regex (baseline instantáneo).
        2. Si use_llm es True y hay texto clínico suficiente (> 20 caracteres),
           ejecuta extracción semántica profunda con LLM (Tier 1: NVIDIA NIM Llama 3.2 11B, Tier 2: Gemini 2.5 Flash).
        3. Si la extracción LLM tiene éxito, fusiona y sobreescribe los ejes con mayor precisión semántica.
        4. Si falla o hay timeout de red, recurre automáticamente al baseline sin lanzar excepciones (graceful degradation).
        """
        base = cls.synthesize_profile(
            user_id=user_id,
            name=name,
            city=city,
            gender=gender,
            age=age,
            bio_notes=bio_notes,
            lifestyle=lifestyle,
            search_preferences=search_preferences
        )

        clean_notes = (bio_notes or "").strip()
        if not use_llm or len(clean_notes) < 20:
            base["metadata"]["extraction_engine"] = "regex"
            return base

        settings = get_settings()
        nvidia_key = (settings.nvidia_api_key or os.getenv("NVIDIA_API_KEY") or "").strip()
        gemini_key = (settings.gemini_api_key or os.getenv("GEMINI_API_KEY") or "").strip()

        if not nvidia_key and os.path.exists("/app/.env"):
            try:
                with open("/app/.env") as f:
                    for l in f:
                        if l.startswith("NVIDIA_API_KEY="):
                            nvidia_key = l.split("=", 1)[1].strip().strip('"').strip("'")
            except Exception:
                pass

        if not nvidia_key and not gemini_key:
            base["metadata"]["extraction_engine"] = "regex"
            return base

        lifestyle_text = json_to_text(lifestyle or {})
        sp_text = json_to_text(search_preferences or {})

        prompt = f"""Eres un psicólogo clínico extractor para DailyLover Colombia.
Analiza la ficha y responde ÚNICAMENTE un JSON compacto con los atributos clínicos detectados:
{{
  "vasectomia": bool,
  "deseo_hijos": bool,
  "turnos_rotativos": bool,
  "turno_nocturno": bool,
  "profesion_alta_movilidad": bool,
  "disposicion_viajar": bool,
  "custodia_compartida_semanal": bool,
  "duelo_activo_reciente": bool,
  "planes_mudanza_internacional": bool,
  "modelo_financiero": "Proveedor tradicional" | "Igualitario 50/50" | "Flexible / Equilibrado",
  "fe_espiritual": "Creyente devoto/practicante" | "Ateo / Agnóstico" | "Espiritual / No practicante",
  "postura_politica": "Izquierda" | "Derecha" | "Centro / Apolitico",
  "rechaza_izquierda": bool,
  "rechaza_derecha": bool,
  "estilo_procesamiento": "Tiempo fuera / Reflexivo" | "Inmediato / Reactivo" | "Equilibrado",
  "alerta_reactividad": bool,
  "rasgo_evitativo": bool,
  "necesidad_espacio_personal": "Alta (Hiper-independiente)" | "Baja (Fusión / Mucha cercanía)" | "Equilibrada",
  "vitalidad_fisica": "Muy Alta (Atleta / Alto Desgaste)" | "Baja (Hogareño / Sedentario)" | "Moderada",
  "cronotipo": "Alondra (Madrugador extremo)" | "Búho (Nocturno)" | "Estándar",
  "dinamica_preferida": "Polaridad Tradicional (Liderazgo masculino / Receptividad femenina)" | "Dinámica Igualitaria / Colaborativa",
  "aseo_y_presentacion_estricta": bool,
  "rechaza_tatuajes": bool,
  "rechaza_cirugias_esteticas": bool,
  "exige_cuerpo_saludable": bool,
  "es_trans": bool
}}

Reglas clínicas colombianas:
- Si es hombre y 'cerró la fábrica' / 'se operó definitivamente' / 'ligado', vasectomia=true y deseo_hijos=false.
- Horarios rotativos, turnos 12h, guardias clínicas, rotación semanal/mensual: turnos_rotativos=true.
- 'tusa', 'se dejaron hace mes y medio', ruptura < 90 días: duelo_activo_reciente=true.
- Nómada digital, teletrabajo total, viaja entre ciudades: disposicion_viajar=true.

Ficha:
Nombre: {name}, Género: {gender}, Edad: {age}, Ciudad: {city}
Notas clínicas:
{clean_notes}
Estilo de vida: {lifestyle_text}
Preferencias: {sp_text}"""

        extracted_data = None
        model_name = None

        async def _call_llm(client: httpx.AsyncClient):
            nonlocal extracted_data, model_name
            # TIER 1: NVIDIA NIM (Llama 3.2 11B Vision Instruct)
            if nvidia_key:
                url_nv = "https://integrate.api.nvidia.com/v1/chat/completions"
                headers_nv = {"Authorization": f"Bearer {nvidia_key}", "Content-Type": "application/json"}
                payload_nv = {
                    "model": "meta/llama-3.2-11b-vision-instruct",
                    "messages": [
                        {"role": "system", "content": "Devuelve SOLO un objeto JSON válido sin bloques markdown ni texto adicional."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.0,
                    "max_tokens": 350
                }
                try:
                    r = await client.post(url_nv, json=payload_nv, headers=headers_nv, timeout=25.0)
                    if r.status_code == 200:
                        content = r.json()["choices"][0]["message"]["content"]
                        parsed = _clean_and_parse_llm_json(content)
                        if parsed and ("turnos_rotativos" in parsed or "vasectomia" in parsed or "1_logistica" in parsed):
                            extracted_data = parsed
                            model_name = "meta/llama-3.2-11b-vision-instruct"
                            return
                except Exception as e:
                    logger.debug(f"NVIDIA extraction failed for user {user_id}: {e}")

            # TIER 2: Gemini 2.5 Flash
            if gemini_key:
                url_gem = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
                payload_gem = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "maxOutputTokens": 350,
                        "temperature": 0.0,
                        "responseMimeType": "application/json"
                    }
                }
                try:
                    r = await client.post(url_gem, json=payload_gem, timeout=25.0)
                    if r.status_code == 200:
                        content = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                        parsed = _clean_and_parse_llm_json(content)
                        if parsed and ("turnos_rotativos" in parsed or "vasectomia" in parsed or "1_logistica" in parsed):
                            extracted_data = parsed
                            model_name = "gemini-2.5-flash"
                            return
                except Exception as e:
                    logger.debug(f"Gemini extraction failed for user {user_id}: {e}")

        try:
            if http_client:
                await _call_llm(http_client)
            else:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    await _call_llm(client)
        except Exception as e:
            logger.warning(f"Error general en extracción semántica LLM para user {user_id}: {e}")

        if extracted_data and model_name:
            cls._merge_llm_extraction(base, extracted_data, model_name, gender)
        else:
            base["metadata"]["extraction_engine"] = "regex-fallback"

        return base

def _clean_and_parse_llm_json(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    s = text.strip()
    if s.startswith("```json"):
        s = s[7:]
    elif s.startswith("```"):
        s = s[3:]
    if s.endswith("```"):
        s = s[:-3]
    s = s.strip()
    try:
        return json.loads(s)
    except Exception:
        match = re.search(r'\{.*\}', s, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
    return None

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
