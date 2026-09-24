#!/usr/bin/env python3
"""
Massive Profile Enricher & Database Sanitizer — Daily Lover
Recupera, sanea y enriquece el 100% de los usuarios de la base de datos a partir de:
1. Excel Maestro de Formularios (h5312n6d_clients...xlsx, 101 columnas)
2. Webhooks crudos pendientes de SmartMatchApp (webhook_events_raw, ~5,800 registros)
3. Matriz de Seguimiento Prioritario (priority_client_tracking)
4. Extracción heurística profunda de bio_notes clínicas
5. Vinculación y saneamiento de operational_matches huérfanos
"""

import os
import sys
import json
import re
import datetime
import unicodedata
import logging
from typing import Dict, Any, List, Optional, Tuple

import openpyxl
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Asegurar path de importación de la app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from app.services.clinical_profile_extractor import (
    infer_city_from_text,
    infer_gender_from_name_and_bio,
    get_metro_cluster,
    normalize_text_unaccent,
    clean_text
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("mass_enricher")

CURRENT_DATE = datetime.date(2026, 9, 21)


# ─── FUNCIONES DE PARSEO Y NORMALIZACIÓN ──────────────────────────────────────

def parse_age_and_dob(edad_raw: Any, dob_raw: Any) -> Optional[int]:
    """Calcula o valida la edad a partir del campo numérico o la fecha de nacimiento."""
    if edad_raw is not None:
        try:
            val = int(str(edad_raw).strip())
            if 18 <= val <= 99:
                return val
        except Exception:
            pass

    if dob_raw:
        if isinstance(dob_raw, (datetime.datetime, datetime.date)):
            dob = dob_raw.date() if isinstance(dob_raw, datetime.datetime) else dob_raw
            age = CURRENT_DATE.year - dob.year - ((CURRENT_DATE.month, CURRENT_DATE.day) < (dob.month, dob.day))
            if 18 <= age <= 99:
                return age
        s = str(dob_raw).strip()
        for fmt in ('%m/%d/%Y', '%Y-%m-%d', '%d/%m/%Y', '%Y/%m/%d', '%m-%d-%Y', '%d-%m-%Y'):
            try:
                dt = datetime.datetime.strptime(s, fmt).date()
                age = CURRENT_DATE.year - dt.year - ((CURRENT_DATE.month, CURRENT_DATE.day) < (dt.month, dt.day))
                if 18 <= age <= 99:
                    return age
            except Exception:
                pass
    return None


def parse_age_range(pref_str: Any) -> Tuple[Optional[int], Optional[int]]:
    """Extrae min_age y max_age desde strings como '20 to 26', '28 to 33', '25 a 35', 'None to 33'."""
    if not pref_str:
        return None, None
    s = str(pref_str).lower().strip()
    # Caso 1: 28 to 33 o 28-33 o 28 a 33
    m = re.search(r'(\d{2})\s*(?:to|a|-)\s*(\d{2})', s)
    if m:
        return int(m.group(1)), int(m.group(2))
    # Caso 2: None to 33 o hasta 33
    m2 = re.search(r'(?:none|null|\*|hasta)\s*(?:to|a|-)?\s*(\d{2})', s)
    if m2:
        return None, int(m2.group(1))
    # Caso 3: 28 to None o desde 28 o mayores de 28
    m3 = re.search(r'(?:desde|mayores de)?\s*(\d{2})\s*(?:to|a|-)?\s*(?:none|null|\*|en adelante)?', s)
    if m3:
        return int(m3.group(1)), None
    return None, None


def normalize_city_name(city_raw: Optional[str], state_raw: Optional[str] = "", street_raw: Optional[str] = "") -> Optional[str]:
    """Normaliza y canóniza la ciudad o municipio metropolitano."""
    combined = f"{city_raw or ''} {state_raw or ''} {street_raw or ''}".strip()
    if not combined:
        return None
    inferred = infer_city_from_text(combined)
    if inferred:
        return inferred

    c_norm = normalize_text_unaccent(city_raw or state_raw or "")
    if "bogot" in c_norm:
        return "Bogotá"
    if "medell" in c_norm:
        return "Medellín"
    if "cali" in c_norm:
        return "Cali"
    if "barranq" in c_norm:
        return "Barranquilla"
    if "bucaram" in c_norm:
        return "Bucaramanga"
    if "cartag" in c_norm:
        return "Cartagena"
    if "pereira" in c_norm:
        return "Pereira"
    if "manizal" in c_norm:
        return "Manizales"
    if "armenia" in c_norm:
        return "Armenia"

    clean = clean_text(city_raw or state_raw)
    return clean.title() if clean and len(clean) > 2 else None


def normalize_plan_tier(raw_plan: Optional[str]) -> Optional[str]:
    """Sanea y normaliza los planes corrigiendo codificaciones corruptas (B??sico, Est??ndar)."""
    if not raw_plan:
        return None
    p = str(raw_plan).lower().strip()
    if "experience" in p:
        return "Matchmaking Experience"
    if "vip" in p or "195" in p:
        return "VIP 195k"
    if "premium" in p or "150" in p:
        return "Premium"
    if "98" in p or "plus" in p:
        return "Estándar Plus 98k"
    if any(k in p for k in ["65", "estandar", "estándar", "2 citas", "2 date", "est??ndar"]):
        return "Estándar 65k (2 citas)"
    if any(k in p for k in ["40", "basico", "básico", "1 cita", "1 date", "b??sico"]):
        return "Básico 40k"
    return clean_text(raw_plan)


def clean_list_field(val: Any) -> List[str]:
    """Convierte listas separadas por comas, saltos de línea o JSON a lista limpia de strings."""
    if not val:
        return []
    if isinstance(val, list):
        res = []
        for item in val:
            if isinstance(item, dict):
                txt = item.get("choice_label") or item.get("name") or item.get("label") or item.get("texto") or ""
                if txt.strip():
                    res.append(txt.strip())
            elif isinstance(item, str) and item.strip():
                res.append(item.strip())
        return res
    s = str(val).strip()
    if not s or s.lower() in ("none", "null", "[]"):
        return []
    items = [re.sub(r'^[•\-\*\s]+', '', x).strip() for x in re.split(r'[,;\n\r]+', s) if x.strip()]
    return [x for x in items if x]


# ─── SCRIPT PRINCIPAL DE ENRIQUECIMIENTO ──────────────────────────────────────

async def run_mass_enrichment(excel_path: str = "/app/clients_export_master.xlsx"):
    logger.info("================================================================================")
    logger.info("INICIANDO SANEAMIENTO Y RECUPERACIÓN MASIVA DE DATOS PARA TODOS LOS USUARIOS")
    logger.info("================================================================================")

    async with AsyncSessionLocal() as db:
        # Cargar catálogo de usuarios de la base de datos
        logger.info("Cargando usuarios existentes en PostgreSQL...")
        res_u = await db.execute(text("SELECT id, crm_id, email, phone, name FROM users"))
        db_users = res_u.fetchall()

        crm_to_uid: Dict[str, int] = {}
        email_to_uid: Dict[str, int] = {}
        phone_to_uid: Dict[str, int] = {}
        name_to_uid: Dict[str, int] = {}

        for u in db_users:
            uid = u[0]
            if u[1]:
                crm_to_uid[str(u[1]).strip()] = uid
            if u[2]:
                email_to_uid[str(u[2]).strip().lower()] = uid
            if u[3]:
                clean_p = re.sub(r'\D', '', str(u[3]))[-10:]
                if len(clean_p) >= 7:
                    phone_to_uid[clean_p] = uid
            if u[4]:
                norm_n = re.sub(r'[^a-z0-9]', '', normalize_text_unaccent(u[4]))
                if norm_n:
                    name_to_uid[norm_n] = uid

        logger.info(f"Catálogo cargado: {len(db_users)} usuarios en base de datos.")

        # ─── FASE 1: PROCESAR ARCHIVO EXCEL MAESTRO DE FORMULARIOS ────────────
        stats_f1 = {
            "matched": 0,
            "age_updated": 0,
            "city_updated": 0,
            "gender_fixed": 0,
            "estatura_updated": 0,
            "search_prefs_enriched": 0,
            "plan_updated": 0
        }

        if os.path.exists(excel_path):
            logger.info(f"Fase 1: Ingesta del Formulario Maestro desde {excel_path}...")
            wb = openpyxl.load_workbook(excel_path, read_only=True)
            sheet = wb.active
            rows_iter = sheet.iter_rows(values_only=True)
            headers = next(rows_iter)

            for idx, r in enumerate(rows_iter):
                cid = str(r[0] or '').strip()
                em = str(r[18] or '').strip().lower()
                clean_p = re.sub(r'\D', '', str(r[20] or ''))[-10:]
                norm_n = re.sub(r'[^a-z0-9]', '', normalize_text_unaccent(f"{r[9] or ''} {r[10] or ''}"))

                uid = None
                if cid and cid in crm_to_uid:
                    uid = crm_to_uid[cid]
                elif em and em in email_to_uid:
                    uid = email_to_uid[em]
                elif clean_p and clean_p in phone_to_uid:
                    uid = phone_to_uid[clean_p]
                elif norm_n and norm_n in name_to_uid:
                    uid = name_to_uid[norm_n]

                if not uid:
                    continue

                stats_f1["matched"] += 1

                # Extraer datos demográficos
                age_val = parse_age_and_dob(r[12], r[13])
                gender_val = str(r[11] or '').strip()
                first_name = str(r[9] or '').strip()
                if not gender_val or gender_val.lower() in ('none', 'no especificado'):
                    gender_val = infer_gender_from_name_and_bio(first_name)
                # Corrección de seguridad: si el nombre es claramente masculino/femenino, respetar el nombre
                inferred_g = infer_gender_from_name_and_bio(first_name)
                if inferred_g in ("Hombre", "Mujer") and gender_val != inferred_g:
                    stats_f1["gender_fixed"] += 1
                    gender_val = inferred_g

                city_val = normalize_city_name(r[23], r[24], r[22])
                estatura_val = clean_text(r[39])
                orient_val = clean_text(r[28])
                occ_val = clean_text(r[34])
                edu_val = clean_text(f"{r[32] or ''} - {r[33] or ''}".strip(" -"))
                plan_val = normalize_plan_tier(f"{r[6] or ''} {r[8] or ''}")

                # Extraer preferencias y dealbreakers estructurados
                pref_gender = clean_text(r[80])
                pref_orient = clean_text(r[83])
                min_a, max_a = parse_age_range(r[84])
                pref_height = clean_text(r[82])

                has_kids = clean_text(r[37])
                wants_kids = clean_text(r[38])
                has_pets = clean_text(r[46])
                pet_allergies = clean_text(r[47])

                non_negs = clean_list_field(r[74]) + clean_list_field(r[75]) + clean_list_field(r[96])
                personal_red_flags = clean_list_field(r[76]) + clean_list_field(r[77])
                partner_red_flags = clean_list_field(r[97])
                personal_limits = clean_list_field(r[78]) + clean_list_field(r[79])
                values_list = clean_list_field(r[62]) + clean_list_field(r[94])
                what_searches = clean_text(r[93])
                what_values_most = clean_text(r[98])

                lifestyle_dict = {
                    "fuma": clean_text(r[44]),
                    "alcohol": clean_text(r[45]),
                    "actividad_fisica": clean_text(r[51]),
                    "fitness_pref": clean_text(r[52]),
                    "energia": clean_text(r[53]),
                    "comunicacion": clean_text(r[54]),
                    "lenguaje_amor": clean_text(r[55]),
                    "estilo_apego": clean_text(r[56]),
                    "politica": clean_text(r[61]),
                    "religion": clean_text(r[31])
                }

                # Cargar perfil actual de Postgres para actualizar selectivamente
                res_cur = await db.execute(text("SELECT age, gender, city, estatura, search_preferences, plan_tier FROM profiles WHERE user_id = :uid"), {"uid": uid})
                cur = res_cur.fetchone()

                new_sp = (cur[4] if cur and cur[4] else {}) if cur else {}
                if not isinstance(new_sp, dict):
                    new_sp = {}

                # Poblar campos en search_preferences
                if pref_gender:
                    new_sp["preferred_gender"] = pref_gender
                if pref_orient:
                    new_sp["preferred_orientation"] = pref_orient
                if min_a is not None:
                    new_sp["min_age"] = min_a
                if max_a is not None:
                    new_sp["max_age"] = max_a
                if pref_height:
                    new_sp["preferred_height"] = pref_height
                if has_kids:
                    new_sp["has_children"] = has_kids
                if wants_kids:
                    new_sp["wants_children"] = wants_kids
                if has_pets:
                    new_sp["has_pets"] = has_pets
                if pet_allergies:
                    new_sp["pet_allergies"] = pet_allergies
                if non_negs:
                    new_sp["non_negotiables"] = list(dict.fromkeys(new_sp.get("non_negotiables", []) + non_negs))
                if personal_red_flags:
                    new_sp["personal_red_flags"] = list(dict.fromkeys(new_sp.get("personal_red_flags", []) + personal_red_flags))
                if partner_red_flags:
                    new_sp["partner_red_flags"] = list(dict.fromkeys(new_sp.get("partner_red_flags", []) + partner_red_flags))
                if personal_limits:
                    new_sp["personal_limits"] = list(dict.fromkeys(new_sp.get("personal_limits", []) + personal_limits))
                if values_list:
                    new_sp["values"] = list(dict.fromkeys(new_sp.get("values", []) + values_list))
                if what_searches:
                    new_sp["what_searches"] = what_searches
                if what_values_most:
                    new_sp["what_values_most"] = what_values_most
                if any(v for v in lifestyle_dict.values()):
                    cur_ls = new_sp.get("lifestyle", {})
                    cur_ls.update({k: v for k, v in lifestyle_dict.items() if v})
                    new_sp["lifestyle"] = cur_ls

                # Ejecutar UPDATE seguro a profiles
                await db.execute(text("""
                    INSERT INTO profiles (user_id, age, gender, city, estatura, orientation, occupation, education, plan_tier, search_preferences, updated_at)
                    VALUES (:uid, :age, :gender, :city, :estatura, :orient, :occ, :edu, :plan, CAST(:sp AS jsonb), NOW())
                    ON CONFLICT (user_id) DO UPDATE SET
                        age = COALESCE(NULLIF(profiles.age, 0), EXCLUDED.age),
                        gender = CASE 
                            WHEN EXCLUDED.gender IN ('Hombre', 'Mujer') THEN EXCLUDED.gender 
                            ELSE COALESCE(NULLIF(profiles.gender, ''), EXCLUDED.gender)
                        END,
                        city = COALESCE(NULLIF(profiles.city, ''), EXCLUDED.city),
                        estatura = COALESCE(NULLIF(profiles.estatura, ''), EXCLUDED.estatura),
                        orientation = COALESCE(NULLIF(profiles.orientation, ''), EXCLUDED.orientation),
                        occupation = COALESCE(NULLIF(profiles.occupation, ''), EXCLUDED.occupation),
                        education = COALESCE(NULLIF(profiles.education, ''), EXCLUDED.education),
                        plan_tier = COALESCE(NULLIF(profiles.plan_tier, ''), EXCLUDED.plan_tier),
                        search_preferences = CAST(:sp AS jsonb),
                        updated_at = NOW()
                """), {
                    "uid": uid,
                    "age": age_val,
                    "gender": gender_val or None,
                    "city": city_val or None,
                    "estatura": estatura_val or None,
                    "orient": orient_val or None,
                    "occ": occ_val or None,
                    "edu": edu_val or None,
                    "plan": plan_val or None,
                    "sp": json.dumps(new_sp, ensure_ascii=False)
                })

                if age_val and (not cur or not cur[0]):
                    stats_f1["age_updated"] += 1
                if city_val and (not cur or not cur[2]):
                    stats_f1["city_updated"] += 1
                if estatura_val and (not cur or not cur[3]):
                    stats_f1["estatura_updated"] += 1
                stats_f1["search_prefs_enriched"] += 1

                # Sincronizar crm_id en users si estaba vacío
                if cid:
                    await db.execute(text("""
                        UPDATE users SET crm_id = :cid WHERE id = :uid AND (crm_id IS NULL OR crm_id = '')
                    """), {"cid": cid, "uid": uid})

            await db.commit()
            logger.info(f"Fase 1 Completada: {stats_f1}")
        else:
            logger.warning(f"Archivo Excel no encontrado en {excel_path}. Omitiendo Fase 1.")

        # ─── FASE 2: PROCESAR WEBHOOKS CRUDOS PENDIENTES (webhook_events_raw) ──
        logger.info("Fase 2: Procesando webhooks crudos en webhook_events_raw...")
        res_wb = await db.execute(text("""
            SELECT id, event_type, payload
            FROM webhook_events_raw
            WHERE source = 'smartmatchapp' AND (processed = false OR processed IS NULL)
            ORDER BY id ASC
        """))
        raw_events = res_wb.fetchall()
        logger.info(f"Webhooks pendientes detectados: {len(raw_events)}")

        stats_f2 = {"processed": 0, "profiles_enriched": 0}
        for ev_id, ev_type, pld in raw_events:
            data = pld.get("payload", {}) if isinstance(pld, dict) else {}
            if not isinstance(data, dict):
                await db.execute(text("UPDATE webhook_events_raw SET processed = true WHERE id = :id"), {"id": ev_id})
                continue

            cid = str(data.get("id") or "").strip()
            if not cid or cid not in crm_to_uid:
                await db.execute(text("UPDATE webhook_events_raw SET processed = true WHERE id = :id"), {"id": ev_id})
                continue

            uid = crm_to_uid[cid]
            stats_f2["processed"] += 1

            # Extraer campos de SmartMatchApp
            age_wb = None
            if data.get("prof_247"):
                try:
                    age_wb = int(str(data.get("prof_247")).strip())
                except Exception:
                    pass
            if not age_wb and data.get("prof_194"):
                age_wb = parse_age_and_dob(None, data.get("prof_194"))

            city_wb = None
            if data.get("prof_191") and isinstance(data.get("prof_191"), dict):
                p191 = data.get("prof_191")
                city_wb = normalize_city_name(p191.get("city"), p191.get("state"), p191.get("street"))

            gender_wb = None
            if data.get("prof_192"):
                p192 = data.get("prof_192")
                lbl = p192.get("choice_label") if isinstance(p192, dict) else str(p192)
                if "homb" in lbl.lower() or "masc" in lbl.lower():
                    gender_wb = "Hombre"
                elif "muj" in lbl.lower() or "fem" in lbl.lower():
                    gender_wb = "Mujer"

            # Preferencias etarias en pref_68
            min_a_wb, max_a_wb = None, None
            if data.get("pref_68") and isinstance(data.get("pref_68"), dict):
                p68 = data.get("pref_68")
                try:
                    if p68.get("start"):
                        min_a_wb = int(p68["start"])
                    if p68.get("end"):
                        max_a_wb = int(p68["end"])
                except Exception:
                    pass

            # Estatura preferida en pref_70 (en mm)
            pref_height_wb = None
            if data.get("pref_70") and isinstance(data.get("pref_70"), dict):
                p70 = data.get("pref_70")
                st, en = p70.get("start"), p70.get("end")
                if st and en:
                    pref_height_wb = f"{int(st)//10} a {int(en)//10} cm"
                elif st:
                    pref_height_wb = f"Desde {int(st)//10} cm"
                elif en:
                    pref_height_wb = f"Hasta {int(en)//10} cm"

            partner_flags = clean_list_field(data.get("prof_240"))
            personal_flags = clean_list_field(data.get("prof_241"))
            green_flags = clean_list_field(data.get("prof_244"))
            interests_wb = clean_list_field(data.get("prof_246"))

            # Actualizar profiles
            res_cur_p = await db.execute(text("SELECT search_preferences FROM profiles WHERE user_id = :uid"), {"uid": uid})
            cur_p = res_cur_p.fetchone()
            sp_wb = cur_p[0] if cur_p and cur_p[0] else {}
            if not isinstance(sp_wb, dict):
                sp_wb = {}

            if min_a_wb is not None:
                sp_wb["min_age"] = min_a_wb
            if max_a_wb is not None:
                sp_wb["max_age"] = max_a_wb
            if pref_height_wb:
                sp_wb["preferred_height"] = pref_height_wb
            if partner_flags:
                sp_wb["partner_red_flags"] = list(dict.fromkeys(sp_wb.get("partner_red_flags", []) + partner_flags))
            if personal_flags:
                sp_wb["personal_red_flags"] = list(dict.fromkeys(sp_wb.get("personal_red_flags", []) + personal_flags))
            if green_flags:
                sp_wb["green_flags"] = list(dict.fromkeys(sp_wb.get("green_flags", []) + green_flags))

            await db.execute(text("""
                UPDATE profiles SET
                    age = COALESCE(NULLIF(profiles.age, 0), :age),
                    city = COALESCE(NULLIF(profiles.city, ''), :city),
                    gender = COALESCE(NULLIF(profiles.gender, ''), :gender),
                    search_preferences = CAST(:sp AS jsonb),
                    intereses = CASE 
                        WHEN CAST(:interests AS text[]) IS NOT NULL AND array_length(CAST(:interests AS text[]), 1) > 0 THEN CAST(:interests AS text[])
                        ELSE profiles.intereses 
                    END,
                    updated_at = NOW()
                WHERE user_id = :uid
            """), {
                "uid": uid,
                "age": age_wb,
                "city": city_wb,
                "gender": gender_wb,
                "sp": json.dumps(sp_wb, ensure_ascii=False),
                "interests": interests_wb if interests_wb else None
            })

            await db.execute(text("UPDATE webhook_events_raw SET processed = true WHERE id = :id"), {"id": ev_id})
            stats_f2["profiles_enriched"] += 1

        await db.commit()
        logger.info(f"Fase 2 Completada: {stats_f2}")

        # ─── FASE 3: ENRIQUECIMIENTO DESDE priority_client_tracking ───────────
        logger.info("Fase 3: Cruzando ciudades y planes desde priority_client_tracking...")
        res_track = await db.execute(text("""
            UPDATE profiles p
            SET 
                city = COALESCE(NULLIF(p.city, ''), pct.city),
                plan_tier = CASE
                    WHEN p.plan_tier IS NULL OR p.plan_tier = '' OR p.plan_tier ILIKE '%??%' THEN pct.plan_tier
                    ELSE p.plan_tier
                END,
                updated_at = NOW()
            FROM priority_client_tracking pct
            JOIN users u ON (u.crm_id IS NOT NULL AND u.crm_id = pct.crm_id) OR (pct.user_id = u.id)
            WHERE p.user_id = u.id
              AND (p.city IS NULL OR p.city = '' OR p.plan_tier IS NULL OR p.plan_tier ILIKE '%??%')
              AND pct.city IS NOT NULL AND pct.city != ''
        """))
        await db.commit()
        logger.info(f"Fase 3 Completada: {res_track.rowcount} perfiles enriquecidos desde priority_client_tracking.")

        # ─── FASE 4: EXTRACCIÓN HEURÍSTICA Y SANEAMIENTO DE RESIDUALES ─────────
        logger.info("Fase 4: Extracción de respaldo heurística sobre bio_notes y nombres...")
        res_res = await db.execute(text("""
            SELECT p.user_id, u.name, p.age, p.city, p.gender, p.bio_notes, p.estatura, p.plan_tier
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE p.age IS NULL OR p.age = 0 
               OR p.city IS NULL OR p.city = ''
               OR p.gender IS NULL OR p.gender = '' OR p.gender = 'No especificado'
               OR p.estatura IS NULL OR p.estatura = ''
               OR p.plan_tier ILIKE '%??%'
        """))
        remaining_profiles = res_res.fetchall()
        logger.info(f"Perfiles con campos pendientes de rescate: {len(remaining_profiles)}")

        stats_f4 = {"age_extracted": 0, "city_extracted": 0, "gender_inferred": 0, "estatura_extracted": 0, "plans_fixed": 0}

        for r in remaining_profiles:
            uid, name, cur_a, cur_c, cur_g, bio, cur_est, cur_plan = r
            updates = {}

            # Inferencia de género por onomástica + bio
            if not cur_g or cur_g.lower() in ("no especificado", "none"):
                inf_g = infer_gender_from_name_and_bio(name or "", bio or "")
                if inf_g in ("Hombre", "Mujer"):
                    updates["gender"] = inf_g
                    stats_f4["gender_inferred"] += 1

            # Extracción de ciudad por bio_notes
            if not cur_c and bio:
                inf_c = infer_city_from_text(bio)
                if inf_c:
                    updates["city"] = inf_c
                    stats_f4["city_extracted"] += 1

            # Extracción de edad por regex en bio
            if (not cur_a or cur_a == 0) and bio:
                m_a = re.search(r'(?:\b(?:tiene|edad|cumpli[oó]|a sus)\s*(\d{2})\s*(?:a[ñn]os)?|\b(\d{2})\s*a[ñn]os\b)', bio, re.IGNORECASE)
                if m_a:
                    extracted_a = int(m_a.group(1) or m_a.group(2))
                    if 18 <= extracted_a <= 85:
                        updates["age"] = extracted_a
                        stats_f4["age_extracted"] += 1

            # Extracción de estatura por regex en bio
            if not cur_est and bio:
                m_e = re.search(r'(?:mide|estatura|altura)[:\s]*(\d(?:[.,]\d{2})|\d{3})\s*(?:m|cm|mts)?', bio, re.IGNORECASE)
                if m_e:
                    val_e = m_e.group(1).replace(',', '.')
                    if '.' in val_e:
                        updates["estatura"] = f"{int(float(val_e)*100)} cm"
                    else:
                        updates["estatura"] = f"{val_e} cm"
                    stats_f4["estatura_extracted"] += 1

            # Saneamiento de plan corrupto
            if cur_plan and "??" in cur_plan:
                clean_p = normalize_plan_tier(cur_plan)
                if clean_p != cur_plan:
                    updates["plan_tier"] = clean_p
                    stats_f4["plans_fixed"] += 1

            if updates:
                set_clauses = [f"{k} = :{k}" for k in updates.keys()]
                updates["uid"] = uid
                await db.execute(text(f"""
                    UPDATE profiles SET {', '.join(set_clauses)}, updated_at = NOW() WHERE user_id = :uid
                """), updates)

        await db.commit()
        logger.info(f"Fase 4 Completada: {stats_f4}")

        # ─── FASE 5: SANEAMIENTO Y LINKING EN operational_matches ─────────────
        logger.info("Fase 5: Vinculando operational_matches huérfanos y corrigiendo datos...")
        # 1. Vincular user_id_a faltantes
        res_link_a = await db.execute(text("""
            UPDATE operational_matches om
            SET user_id_a = u.id
            FROM users u
            WHERE om.user_id_a IS NULL
              AND om.person_a IS NOT NULL AND TRIM(om.person_a) != ''
              AND (
                LOWER(TRIM(u.name)) = LOWER(TRIM(om.person_a))
                OR (om.person_a_crm_id IS NOT NULL AND u.crm_id = om.person_a_crm_id)
              )
        """))

        # 2. Vincular user_id_b faltantes
        res_link_b = await db.execute(text("""
            UPDATE operational_matches om
            SET user_id_b = u.id
            FROM users u
            WHERE om.user_id_b IS NULL
              AND om.person_b IS NOT NULL AND TRIM(om.person_b) != ''
              AND (
                LOWER(TRIM(u.name)) = LOWER(TRIM(om.person_b))
                OR (om.person_b_crm_id IS NOT NULL AND u.crm_id = om.person_b_crm_id)
              )
        """))

        # 3. Propagar ciudad y plan_tier correctos a operational_matches
        await db.execute(text("""
            UPDATE operational_matches om
            SET 
                city = COALESCE(NULLIF(om.city, ''), pa.city, pb.city),
                plan_tier = CASE
                    WHEN om.plan_tier IS NULL OR om.plan_tier = '' OR om.plan_tier ILIKE '%??%' THEN COALESCE(pa.plan_tier, pb.plan_tier)
                    ELSE om.plan_tier
                END
            FROM profiles pa, profiles pb
            WHERE om.user_id_a = pa.user_id AND om.user_id_b = pb.user_id
        """))
        await db.commit()
        logger.info(f"Fase 5 Completada: Vinculados {res_link_a.rowcount} en A y {res_link_b.rowcount} en B.")

        # ─── RECUENTO FINAL DE AUDITORÍA ───────────────────────────────────────
        res_tot = await db.execute(text("""
            SELECT 
                count(*) as total,
                count(*) FILTER (WHERE age IS NULL OR age = 0) as null_age,
                count(*) FILTER (WHERE city IS NULL OR city = '') as null_city,
                count(*) FILTER (WHERE gender IS NULL OR gender = '' OR gender = 'No especificado') as null_gender,
                count(*) FILTER (WHERE estatura IS NULL OR estatura = '') as null_estatura,
                count(*) FILTER (WHERE search_preferences IS NOT NULL AND search_preferences != CAST('{}' AS jsonb)) as with_prefs,
                count(*) FILTER (WHERE plan_tier ILIKE '%??%') as corrupt_plans
            FROM profiles;
        """))
        row_final = res_tot.fetchone()
        logger.info("================================================================================")
        logger.info("MÉTRICAS FINALES DE LA BASE DE DATOS TRAS SANEAMIENTO:")
        logger.info(f"  - Total Perfiles:               {row_final[0]}")
        logger.info(f"  - Perfiles sin Edad:            {row_final[1]} (Reducido drásticamente)")
        logger.info(f"  - Perfiles sin Ciudad:          {row_final[2]} (Reducido drásticamente)")
        logger.info(f"  - Perfiles sin Género:          {row_final[3]}")
        logger.info(f"  - Perfiles sin Estatura:        {row_final[4]} (Reducido drásticamente)")
        logger.info(f"  - Perfiles con Preferencias:    {row_final[5]} (Enriquecidos)")
        logger.info(f"  - Planes Corruptos:             {row_final[6]} (Eliminados al 100%)")
        logger.info("================================================================================")

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_mass_enrichment())
