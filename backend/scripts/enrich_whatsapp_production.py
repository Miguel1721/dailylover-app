"""
Script oficial de enriquecimiento y migración de datos extraídos de la auditoría de WhatsApp:
1. Registra 83 clientes identificados en el chat que no existían en users/profiles.
2. Carga 31 compras de citas extra / upgrades de plan con sus correspondientes slots y tickets en cs_novedades.
3. Carga 347 registros de No-Shows en client_notes y person_history.
4. Carga 76 registros de feedback post-cita en client_notes y person_history.
"""

import os
import sys
import json
import re
import psycopg2
from psycopg2.extras import RealDictCursor

raw_db_url = os.getenv("DATABASE_URL_SYNC") or os.getenv("DATABASE_URL")
if raw_db_url:
    DATABASE_URL = raw_db_url.replace("postgresql+asyncpg://", "postgresql://")
else:
    DATABASE_URL = "postgresql://postgres:your_secure_postgres_password@postgres:5432/dailylover"

def run_enrichment():
    print("=== INICIANDO MIGRACIÓN DE DATOS AUDITORÍA WHATSAPP ===")
    
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # 1. Cargar archivos JSON de datos
        base_dir = os.path.dirname(os.path.abspath(__file__))
        repo_root = os.path.dirname(base_dir)
        
        possible_dirs = [
            os.path.join(repo_root, "scratch"),
            os.path.join(repo_root, "..", "scratch"),
            os.path.join(base_dir, "scratch"),
            "/app/scratch",
            "/home/ubuntu/dailylover/scratch"
        ]
        
        unregistered_file = None
        enrichment_file = None
        
        for p in possible_dirs:
            u_candidate = os.path.join(p, "clean_unregistered_clients_whatsapp.json")
            e_candidate = os.path.join(p, "whatsapp_db_enrichment_candidates.json")
            if os.path.exists(u_candidate) and os.path.exists(e_candidate):
                unregistered_file = u_candidate
                enrichment_file = e_candidate
                break
                
        if not unregistered_file or not enrichment_file:
            raise FileNotFoundError(f"No se encontraron los archivos JSON en ninguna de las rutas posibles: {possible_dirs}")

        print(f"Archivos de migración encontrados en: {os.path.dirname(unregistered_file)}")

        with open(unregistered_file, "r", encoding="utf-8") as f:
            unregistered_clients = json.load(f)

        with open(enrichment_file, "r", encoding="utf-8") as f:
            enrichment_data = json.load(f)

        print(f"Candidatos no registrados a procesar: {len(unregistered_clients)}")
        print(f"Upgrades: {len(enrichment_data.get('upgrades', []))}")
        print(f"No-Shows: {len(enrichment_data.get('noshows', []))}")
        print(f"Feedbacks: {len(enrichment_data.get('feedback', []))}")

        # 2. Obtener usuarios actuales de DB
        cur.execute("SELECT id, LOWER(TRIM(name)) AS name_lower, name FROM users;")
        existing_users = {row["name_lower"]: row["id"] for row in cur.fetchall()}
        print(f"Usuarios existentes en DB antes de migración: {len(existing_users)}")

        # 3. Insertar los 83 clientes no registrados
        inserted_clients_count = 0
        for name in unregistered_clients:
            n_clean = name.strip()
            n_lower = n_clean.lower()
            if n_lower not in existing_users:
                # Insertar en users
                cur.execute(
                    "INSERT INTO users (name, created_at) VALUES (%s, NOW()) RETURNING id;",
                    (n_clean,)
                )
                new_id = cur.fetchone()["id"]
                client_code = f"DL-{new_id:04d}"
                cur.execute("UPDATE users SET client_code = %s WHERE id = %s;", (client_code, new_id))

                # Insertar en profiles
                cur.execute("""
                    INSERT INTO profiles (
                        user_id, city, responsable, plan_tier, bio_notes, updated_at
                    ) VALUES (
                        %s, 'Bogotá', 'SILVI', 'Estándar 65k (2 citas)',
                        'Cliente identificado en auditoría de chat de WhatsApp.', NOW()
                    );
                """, (new_id,))

                # Insertar slot inicial en operational_matches
                cur.execute("""
                    INSERT INTO operational_matches (
                        city, pref, plan_tier, person_a, psychologist_name, slot_number, status, observations, created_at, updated_at
                    ) VALUES (
                        'Bogotá', 'hetero', 'Estándar 65k (2 citas)', %s, 'SILVI', 1,
                        'Listo para match', %s, NOW(), NOW()
                    );
                """, (n_clean, f"Identificado en auditoría de WhatsApp ({client_code})."))

                existing_users[n_lower] = new_id
                inserted_clients_count += 1

        print(f"✅ Clientes nuevos creados en users, profiles y operational_matches: {inserted_clients_count}")

        # 4. Procesar Upgrades / Citas Extra (31 casos)
        upgrades_processed = 0
        slots_created_from_upgrades = 0
        for up in enrichment_data.get("upgrades", []):
            msg = up.get("message", "")
            sender = up.get("sender", "Customer Service")
            dt_str = up.get("datetime", "")
            
            # Buscar cliente mencionado
            matched_uid = None
            matched_name = None
            for uname_lower, uid in existing_users.items():
                if len(uname_lower) > 5 and uname_lower in msg.lower():
                    matched_uid = uid
                    matched_name = uname_lower.title()
                    break

            # Extraer citas
            extra_num = 1
            m_num = re.search(r'(\d+)\s*(?:dates|citas)', msg.lower())
            if m_num:
                extra_num = int(m_num.group(1))

            target_name = matched_name or sender
            novedad_type = "UPGRADE_PLAN" if "upgrade" in msg.lower() or "vip" in msg.lower() else "EXTRA_DATE"

            cur.execute("""
                INSERT INTO cs_novedades (
                    client_id, client_name, novedad_type, details, extra_dates, created_by, assigned_to, status, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, 'General', 'ATENDIDO', NOW()
                );
            """, (matched_uid, target_name, novedad_type, f"[{dt_str}] {msg}", extra_num, sender))

            if matched_uid:
                cur.execute("""
                    INSERT INTO client_notes (user_id, note, source, created_at)
                    VALUES (%s, %s, 'whatsapp_audit_upgrade', NOW());
                """, (matched_uid, f"💳 Compra registrada en WhatsApp ({dt_str}): {msg}"))

                # Crear slots si son citas extra
                if novedad_type == "EXTRA_DATE" and extra_num > 0:
                    for i in range(extra_num):
                        cur.execute("""
                            INSERT INTO operational_matches (
                                city, pref, plan_tier, person_a, psychologist_name, slot_number, status, observations, created_at, updated_at
                            ) VALUES (
                                'Bogotá', 'hetero', 'Cita Extra', %s, 'SILVI', 99, 'Listo para match',
                                %s, NOW(), NOW()
                            );
                        """, (target_name, f"Cita extra ({i+1}/{extra_num}) de auditoría WhatsApp: {msg}"))
                        slots_created_from_upgrades += 1

            upgrades_processed += 1

        print(f"✅ Upgrades / Citas Extra procesados: {upgrades_processed} (Slots creados: {slots_created_from_upgrades})")

        # 5. Procesar No-Shows (347 casos)
        noshows_processed = 0
        noshows_notes_added = 0
        for ns in enrichment_data.get("noshows", []):
            hint = (ns.get("client_hint") or "").strip()
            msg = ns.get("message", "")
            dt_str = ns.get("datetime", "")
            sender = ns.get("sender", "Psicóloga")

            matched_uid = None
            target_name = hint if hint else "Cliente"

            if hint and hint.lower() in existing_users:
                matched_uid = existing_users[hint.lower()]
                target_name = hint
            else:
                for uname_lower, uid in existing_users.items():
                    if len(uname_lower) > 6 and (uname_lower in msg.lower() or (hint and uname_lower in hint.lower())):
                        matched_uid = uid
                        target_name = uname_lower.title()
                        break

            # Registrar en person_history
            cur.execute("""
                INSERT INTO person_history (person_name, event_type, details, created_at)
                VALUES (%s, 'NO_SHOW_HISTORICAL', %s, NOW());
            """, (target_name, f"[{dt_str}] No-Show reportado por {sender}: {msg}"))

            if matched_uid:
                cur.execute("""
                    INSERT INTO client_notes (user_id, note, source, created_at)
                    VALUES (%s, %s, 'whatsapp_audit_noshow', NOW());
                """, (matched_uid, f"🚨 Inasistencia (No-Show) reportada en WhatsApp ({dt_str}) por {sender}: {msg}"))
                noshows_notes_added += 1

            noshows_processed += 1

        print(f"✅ No-Shows procesados: {noshows_processed} (Notas clínicas vinculadas a usuarios: {noshows_notes_added})")

        # 6. Procesar Feedbacks (76 casos)
        feedbacks_processed = 0
        feedbacks_notes_added = 0
        for fb in enrichment_data.get("feedback", []):
            msg = fb.get("message", "")
            dt_str = fb.get("datetime", "")
            sender = fb.get("sender", "Customer Service")

            matched_uid = None
            target_name = "Cliente"

            for uname_lower, uid in existing_users.items():
                if len(uname_lower) > 6 and uname_lower in msg.lower():
                    matched_uid = uid
                    target_name = uname_lower.title()
                    break

            cur.execute("""
                INSERT INTO person_history (person_name, event_type, details, created_at)
                VALUES (%s, 'DATE_FEEDBACK_HISTORICAL', %s, NOW());
            """, (target_name, f"[{dt_str}] Feedback reportado por {sender}: {msg}"))

            if matched_uid:
                cur.execute("""
                    INSERT INTO client_notes (user_id, note, source, created_at)
                    VALUES (%s, %s, 'whatsapp_audit_feedback', NOW());
                """, (matched_uid, f"⭐ Feedback de cita reportado en WhatsApp ({dt_str}): {msg}"))
                feedbacks_notes_added += 1

            feedbacks_processed += 1

        print(f"✅ Feedbacks procesados: {feedbacks_processed} (Notas clínicas vinculadas a usuarios: {feedbacks_notes_added})")

        # Confirmar transacción completa
        conn.commit()
        print("\n🎉 MIGRACIÓN Y ENRIQUECIMIENTO COMPLETADO CON ÉXITO.")

    except Exception as e:
        conn.rollback()
        print(f"❌ ERROR DURANTE LA MIGRACIÓN: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    run_enrichment()
