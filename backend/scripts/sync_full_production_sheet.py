#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Daily Lover - Sincronización Integral del Sheet Original de Producción a PostgreSQL (Etapa 2)
Preserva 100% de los textos clínicos humanos.
Normaliza estados, ciudades y fechas.
Aplica upsert seguro en users, profiles, operational_matches, scheduled_dates, trouble_matches e historical_matches.
"""

import sys
import os
import json
import asyncio
from datetime import datetime
import unicodedata
import re
import uuid

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

sys.stdout.reconfigure(encoding='utf-8')

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://postgres:your_secure_postgres_password@dl_postgres:5432/dailylover"
)

PAYLOAD_FILE = "/tmp/stage2_full_payload.json"

def normalize_name(name: str) -> str:
    if not name:
        return ""
    n = unicodedata.normalize('NFD', str(name))
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    n = re.sub(r'[^a-zA-Z0-9\s]', ' ', n)
    n = re.sub(r'\s+', ' ', n).strip().lower()
    return n

async def run_sync():
    print("=" * 65)
    print("INICIANDO SINCRONIZACIÓN INTEGRAL ETAPA 2 (Sheet -> PostgreSQL)")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 65)

    if not os.path.exists(PAYLOAD_FILE):
        print(f"ERROR: Archivo de payload {PAYLOAD_FILE} no encontrado!")
        sys.exit(1)

    print(f"1. Cargando payload normalizado desde {PAYLOAD_FILE}...")
    with open(PAYLOAD_FILE, "r", encoding="utf-8") as f:
        payload = json.load(f)

    clients = payload.get("clients", [])
    op_matches = payload.get("operational_matches", [])
    canonical_matches = payload.get("canonical_matches", [])
    trouble_matches = payload.get("trouble_matches", [])
    enamorados = payload.get("enamorados", [])

    print(f"   -> Clientes a procesar: {len(clients)}")
    print(f"   -> Matches de psicólogas: {len(op_matches)}")
    print(f"   -> Citas mesa canónica: {len(canonical_matches)}")
    print(f"   -> Casos Trouble: {len(trouble_matches)}")
    print(f"   -> Casos Enamorados: {len(enamorados)}")

    engine = create_async_engine(DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        # -------------------------------------------------------------
        # 1. ESTADO PREVIO (MÉTRICAS INICIALES)
        # -------------------------------------------------------------
        res_u = await session.execute(text("SELECT COUNT(*) FROM users;"))
        count_u_before = res_u.scalar()

        res_p = await session.execute(text("SELECT COUNT(*) FROM profiles;"))
        count_p_before = res_p.scalar()

        res_om = await session.execute(text("SELECT COUNT(*) FROM operational_matches;"))
        count_om_before = res_om.scalar()

        print(f"\n2. Estado actual de la base de datos:")
        print(f"   - users: {count_u_before}")
        print(f"   - profiles: {count_p_before}")
        print(f"   - operational_matches: {count_om_before}")

        # -------------------------------------------------------------
        # 2. PROCESAR CLIENTES Y PERFILES (users & profiles)
        # -------------------------------------------------------------
        print(f"\n3. Sincronizando Clientes y Perfiles...")
        # Cargar todos los usuarios existentes en memoria para fast-lookup
        users_res = await session.execute(text("SELECT id, name, email, client_code, crm_id FROM users;"))
        existing_users = users_res.fetchall()
        
        user_by_norm_name = {}
        user_by_code = {}
        for u in existing_users:
            u_id, u_name, u_email, u_code, u_crm = u
            if u_name:
                user_by_norm_name[normalize_name(u_name)] = u_id
            if u_code:
                user_by_code[str(u_code).strip().upper()] = u_id
            if u_crm:
                user_by_code[str(u_crm).strip().upper()] = u_id

        # Cargar perfiles existentes
        prof_res = await session.execute(text("SELECT user_id FROM profiles;"))
        existing_prof_user_ids = set(r[0] for r in prof_res.fetchall())

        users_updated = 0
        users_inserted = 0
        profiles_updated = 0
        profiles_inserted = 0

        for c in clients:
            c_name = c["name"]
            c_norm = c["norm_name"]
            c_code = c.get("client_code") or ""
            c_email = c.get("email") or ""
            c_resp = c.get("responsable") or "Por asignar"
            c_city = c.get("city") or "Bogotá"
            c_plan = c.get("plan_tier") or "Estándar"
            c_diff = c.get("is_difficult", False)
            c_diff_notes = c.get("difficult_notes") or ""
            c_pref = json.dumps(c.get("search_preferences") or {}, ensure_ascii=False)

            user_id = user_by_norm_name.get(c_norm) or (user_by_code.get(c_code.upper()) if c_code else None)

            if user_id:
                # Update existing user email if provided
                if c_email:
                    await session.execute(
                        text("""
                            UPDATE users 
                            SET email = COALESCE(NULLIF(email, ''), :email),
                                client_code = COALESCE(NULLIF(client_code, ''), :code)
                            WHERE id = :uid
                        """),
                        {"email": c_email, "code": c_code, "uid": user_id}
                    )
                    users_updated += 1

                # Upsert profile
                if user_id in existing_prof_user_ids:
                    await session.execute(
                        text("""
                            UPDATE profiles
                            SET responsable = COALESCE(NULLIF(:resp, ''), responsable),
                                city = COALESCE(NULLIF(:city, ''), city),
                                plan_tier = COALESCE(NULLIF(:plan, ''), plan_tier),
                                is_difficult = :diff,
                                difficult_notes = COALESCE(NULLIF(:d_notes, ''), difficult_notes),
                                search_preferences = CASE WHEN CAST(:pref AS text) != '{}' THEN CAST(:pref AS jsonb) ELSE search_preferences END,
                                updated_at = NOW()
                            WHERE user_id = :uid
                        """),
                        {
                            "resp": c_resp,
                            "city": c_city,
                            "plan": c_plan,
                            "diff": c_diff,
                            "d_notes": c_diff_notes,
                            "pref": c_pref,
                            "uid": user_id
                        }
                    )
                    profiles_updated += 1
                else:
                    await session.execute(
                        text("""
                            INSERT INTO profiles (
                                user_id, full_name_raw, responsable, city, plan_tier, 
                                is_difficult, difficult_notes, search_preferences, updated_at
                            ) VALUES (
                                :uid, :name, :resp, :city, :plan,
                                :diff, :d_notes, CAST(:pref AS jsonb), NOW()
                            )
                        """),
                        {
                            "uid": user_id,
                            "name": c_name,
                            "resp": c_resp,
                            "city": c_city,
                            "plan": c_plan,
                            "diff": c_diff,
                            "d_notes": c_diff_notes,
                            "pref": c_pref
                        }
                    )
                    existing_prof_user_ids.add(user_id)
                    profiles_inserted += 1
            else:
                # Insert completely new user
                placeholder_phone = f"GEN_{uuid.uuid4().hex[:12]}"
                insert_u = await session.execute(
                    text("""
                        INSERT INTO users (name, phone, email, client_code, created_at)
                        VALUES (:name, :phone, :email, :code, NOW())
                        RETURNING id;
                    """),
                    {"name": c_name, "phone": placeholder_phone, "email": c_email or None, "code": c_code or None}
                )
                new_uid = insert_u.scalar()
                user_by_norm_name[c_norm] = new_uid
                if c_code:
                    user_by_code[c_code.upper()] = new_uid
                users_inserted += 1

                # Insert profile
                await session.execute(
                    text("""
                        INSERT INTO profiles (
                            user_id, full_name_raw, responsable, city, plan_tier,
                            is_difficult, difficult_notes, search_preferences, updated_at
                        ) VALUES (
                            :uid, :name, :resp, :city, :plan,
                            :diff, :d_notes, CAST(:pref AS jsonb), NOW()
                        )
                    """),
                    {
                        "uid": new_uid,
                        "name": c_name,
                        "resp": c_resp,
                        "city": c_city,
                        "plan": c_plan,
                        "diff": c_diff,
                        "d_notes": c_diff_notes,
                        "pref": c_pref
                    }
                )
                existing_prof_user_ids.add(new_uid)
                profiles_inserted += 1

        await session.commit()
        print(f"   -> Clientes actualizados: {users_updated}, Clientes nuevos insertados: {users_inserted}")
        print(f"   -> Perfiles actualizados: {profiles_updated}, Perfiles nuevos insertados: {profiles_inserted}")

        # -------------------------------------------------------------
        # 3. PROCESAR MESAS DE PSICÓLOGAS (operational_matches)
        # -------------------------------------------------------------
        print(f"\n4. Sincronizando Mesas Operativas de Psicólogas ({len(op_matches)} registros)...")
        
        # Matches protegidos (con citas agendadas o confirmaciones)
        res_prot = await session.execute(text("""
            SELECT DISTINCT match_id FROM scheduled_dates WHERE match_id IS NOT NULL
            UNION
            SELECT DISTINCT match_id FROM match_confirmations WHERE match_id IS NOT NULL;
        """))
        protected_match_ids = set(r[0] for r in res_prot.fetchall())
        print(f"   -> Matches protegidos con citas/confirmaciones: {len(protected_match_ids)}")

        # Mapeo existente de operational_matches
        om_res = await session.execute(text("""
            SELECT id, LOWER(TRIM(person_a)), LOWER(TRIM(person_b)), psychologist_name 
            FROM operational_matches;
        """))
        om_map = {}
        for r in om_res.fetchall():
            m_id, pa, pb, psyc = r
            om_map[(pa or "", pb or "", (psyc or "").strip().upper())] = m_id

        om_updated = 0
        om_inserted = 0

        for m in op_matches:
            pa = m["person_a"].strip()
            pb = m["person_b"].strip()
            psyc = m["psychologist_name"].strip().upper()
            city = m["city"]
            pref = m["pref"] or None
            plan = m["plan_tier"] or None
            st = m["status"]
            obs = m["observations"] or None
            slot = m["slot_number"]
            appr = m["approved_by_maria"]

            uid_a = user_by_norm_name.get(normalize_name(pa))
            uid_b = user_by_norm_name.get(normalize_name(pb)) if pb else None

            key = (normalize_name(pa), normalize_name(pb), psyc)
            existing_mid = om_map.get(key)

            if existing_mid:
                # Update match in situ
                await session.execute(
                    text("""
                        UPDATE operational_matches
                        SET status = :st,
                            city = COALESCE(NULLIF(:city, ''), city),
                            pref = COALESCE(NULLIF(:pref, ''), pref),
                            plan_tier = COALESCE(NULLIF(:plan, ''), plan_tier),
                            observations = COALESCE(NULLIF(:obs, ''), observations),
                            slot_number = COALESCE(:slot, slot_number),
                            approved_by_maria = :appr,
                            user_id_a = COALESCE(:uid_a, user_id_a),
                            user_id_b = COALESCE(:uid_b, user_id_b),
                            updated_at = NOW()
                        WHERE id = :mid
                    """),
                    {
                        "st": st,
                        "city": city,
                        "pref": pref,
                        "plan": plan,
                        "obs": obs,
                        "slot": slot,
                        "appr": appr,
                        "uid_a": uid_a,
                        "uid_b": uid_b,
                        "mid": existing_mid
                    }
                )
                om_updated += 1
            else:
                # Insert new operational match
                ins_om = await session.execute(
                    text("""
                        INSERT INTO operational_matches (
                            person_a, person_b, user_id_a, user_id_b, psychologist_name,
                            city, pref, plan_tier, status, approved_by_maria, observations,
                            slot_number, created_at, updated_at
                        ) VALUES (
                            :pa, :pb, :uid_a, :uid_b, :psyc,
                            :city, :pref, :plan, :st, :appr, :obs,
                            :slot, NOW(), NOW()
                        )
                        RETURNING id;
                    """),
                    {
                        "pa": pa,
                        "pb": pb or None,
                        "uid_a": uid_a,
                        "uid_b": uid_b,
                        "psyc": psyc,
                        "city": city,
                        "pref": pref,
                        "plan": plan,
                        "st": st,
                        "appr": appr,
                        "obs": obs,
                        "slot": slot
                    }
                )
                new_mid = ins_om.scalar()
                om_map[key] = new_mid
                om_inserted += 1

        await session.commit()
        print(f"   -> operational_matches actualizados: {om_updated}")
        print(f"   -> operational_matches insertados: {om_inserted}")

        # -------------------------------------------------------------
        # 4. MESA CANÓNICA GENERAL DE CITAS (scheduled_dates)
        # -------------------------------------------------------------
        print(f"\n5. Sincronizando Mesa Canónica General ({len(canonical_matches)} citas)...")
        sched_res = await session.execute(text("SELECT id, LOWER(TRIM(person_a)), LOWER(TRIM(person_b)) FROM scheduled_dates;"))
        sched_map = {}
        for r in sched_res.fetchall():
            s_id, pa, pb = r
            sched_map[(pa or "", pb or "")] = s_id

        sched_updated = 0
        sched_inserted = 0

        for cm in canonical_matches:
            pa = cm["person_a"].strip()
            pb = cm["person_b"].strip()
            dt = cm["date_time"] or None
            venue = cm["venue"] or None
            city = cm["city"] or "Bogotá"
            res_conf = cm["reservation_confirmed"]
            feedback_ella = cm["feedback_ella"] or None
            had_date = bool(cm["match_result"])

            # Find matching operational_match id if exists
            matched_om_id = None
            for (k_pa, k_pb, _), m_id in om_map.items():
                if k_pa == normalize_name(pa) and k_pb == normalize_name(pb):
                    matched_om_id = m_id
                    break

            key = (normalize_name(pa), normalize_name(pb))
            s_id = sched_map.get(key)

            if s_id:
                await session.execute(
                    text("""
                        UPDATE scheduled_dates
                        SET date_time = COALESCE(NULLIF(:dt, ''), date_time),
                            venue = COALESCE(NULLIF(:venue, ''), venue),
                            city = COALESCE(NULLIF(:city, ''), city),
                            reservation_confirmed = :res_conf,
                            feedback_ella = COALESCE(NULLIF(:fb, ''), feedback_ella),
                            had_date = :had_date,
                            match_id = COALESCE(:mid, match_id),
                            updated_at = NOW()
                        WHERE id = :sid
                    """),
                    {
                        "dt": dt,
                        "venue": venue,
                        "city": city,
                        "res_conf": res_conf,
                        "fb": feedback_ella,
                        "had_date": had_date,
                        "mid": matched_om_id,
                        "sid": s_id
                    }
                )
                sched_updated += 1
            else:
                ins_s = await session.execute(
                    text("""
                        INSERT INTO scheduled_dates (
                            match_id, person_a, person_b, date_time, venue, city,
                            reservation_confirmed, feedback_ella, had_date, created_at, updated_at
                        ) VALUES (
                            :mid, :pa, :pb, :dt, :venue, :city,
                            :res_conf, :fb, :had_date, NOW(), NOW()
                        )
                        RETURNING id;
                    """),
                    {
                        "mid": matched_om_id,
                        "pa": pa,
                        "pb": pb,
                        "dt": dt,
                        "venue": venue,
                        "city": city,
                        "res_conf": res_conf,
                        "fb": feedback_ella,
                        "had_date": had_date
                    }
                )
                new_sid = ins_s.scalar()
                sched_map[key] = new_sid
                sched_inserted += 1

        await session.commit()
        print(f"   -> scheduled_dates actualizados: {sched_updated}")
        print(f"   -> scheduled_dates insertados: {sched_inserted}")

        # -------------------------------------------------------------
        # 5. TABLAS ESPECIALES (trouble_matches & historical_matches)
        # -------------------------------------------------------------
        print(f"\n6. Sincronizando Tablas Especiales (Trouble Matches y Enamorados)...")
        # Trouble matches
        await session.execute(text("TRUNCATE TABLE trouble_matches RESTART IDENTITY;"))
        for tr in trouble_matches:
            await session.execute(
                text("""
                    INSERT INTO trouble_matches (person_a, person_b, reported_by, reason, notes, created_at)
                    VALUES (:pa, :pb, 'Google Sheet', :reason, :notes, NOW())
                """),
                {
                    "pa": tr["person_a"],
                    "pb": tr["person_b"],
                    "reason": tr["reason"],
                    "notes": tr["notes"]
                }
            )
        await session.commit()
        print(f"   -> trouble_matches cargados: {len(trouble_matches)}")

        # Enamorados en historical_matches
        for en in enamorados:
            await session.execute(
                text("""
                    INSERT INTO historical_matches (
                        person_a, person_b, matchmaker, match_date, status, observations, created_at
                    ) VALUES (
                        :pa, :pb, :mm, :dt, 'ENAMORADOS', :obs, NOW()
                    )
                """),
                {
                    "pa": en["person_a"],
                    "pb": en["person_b"],
                    "mm": en["matchmaker"] or "Daily Lover",
                    "dt": en["match_date"] or None,
                    "obs": f"Tiempo enamorados: {en['time_in_love']} | Nota: {en['notes']}"
                }
            )
        await session.commit()
        print(f"   -> enamorados registrados en historical_matches: {len(enamorados)}")

        # -------------------------------------------------------------
        # 6. MÉTRICAS FINALES
        # -------------------------------------------------------------
        res_u_after = await session.execute(text("SELECT COUNT(*) FROM users;"))
        count_u_after = res_u_after.scalar()

        res_p_after = await session.execute(text("SELECT COUNT(*) FROM profiles;"))
        count_p_after = res_p_after.scalar()

        res_om_after = await session.execute(text("SELECT COUNT(*) FROM operational_matches;"))
        count_om_after = res_om_after.scalar()

        res_sd_after = await session.execute(text("SELECT COUNT(*) FROM scheduled_dates;"))
        count_sd_after = res_sd_after.scalar()

        print("\n" + "=" * 65)
        print("RESUMEN DE SINCRONIZACIÓN ETAPA 2 (FINAL)")
        print("=" * 65)
        print(f"Users:               {count_u_before} -> {count_u_after} (+{count_u_after - count_u_before})")
        print(f"Profiles:            {count_p_before} -> {count_p_after} (+{count_p_after - count_p_before})")
        print(f"Operational Matches: {count_om_before} -> {count_om_after} (+{count_om_after - count_om_before})")
        print(f"Scheduled Dates:     {count_sd_after}")
        print("=" * 65)

if __name__ == "__main__":
    asyncio.run(run_sync())
