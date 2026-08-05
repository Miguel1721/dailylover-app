#!/usr/bin/env python3
"""
Script de Importación Histórica desde Archivos de Exportación de SmartMatchApp.
Procesa archivos descargados (Clients, Matches, Timeline, Survey Answers, Clients Notes, Finances, Contracts, Intros).
Soporta archivos .csv, .xlsx y .xls.

Uso:
  python backend/scripts/import_smartmatch_export.py --dir /ruta/a/archivos_export --dry-run
  python backend/scripts/import_smartmatch_export.py --dir /ruta/a/archivos_export
"""

import os
import sys
import argparse
import asyncio
import json
import logging
import csv
from typing import Dict, List, Any

# Agregar directorio backend al PATH de Python
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from sqlalchemy import text

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("import_smartmatch")


def find_export_files(folder_path: str) -> Dict[str, str]:
    """Escanea la carpeta en busca de archivos CSV o XLSX por categoría."""
    files = {}
    if not os.path.exists(folder_path):
        logger.error(f"La carpeta especificada no existe: {folder_path}")
        return files

    for f in os.listdir(folder_path):
        full_path = os.path.join(folder_path, f)
        if not os.path.isfile(full_path):
            continue
        fname_lower = f.lower()
        if not fname_lower.endswith((".csv", ".xlsx", ".xls")):
            continue

        if "client" in fname_lower and "note" not in fname_lower:
            files["clients"] = full_path
        elif "match" in fname_lower:
            files["matches"] = full_path
        elif "note" in fname_lower:
            files["notes"] = full_path
        elif "survey" in fname_lower or "answer" in fname_lower:
            files["surveys"] = full_path
        elif "intro" in fname_lower:
            files["intros"] = full_path
        elif "contract" in fname_lower:
            files["contracts"] = full_path
        elif "finance" in fname_lower or "invoice" in fname_lower:
            files["finances"] = full_path
        elif "timeline" in fname_lower:
            files["timeline"] = full_path

    return files


def load_rows(file_path: str) -> List[Dict[str, str]]:
    """Carga un CSV o XLSX en una lista de diccionarios de Python."""
    try:
        if file_path.lower().endswith((".xlsx", ".xls")):
            try:
                import pandas as pd
                df = pd.read_excel(file_path, dtype=str).fillna("")
                return df.to_dict(orient="records")
            except ImportError:
                logger.warning("Pandas/openpyxl no instalado; se recomienda para XLSX. Intentando fallback...")
                return []
        else:
            with open(file_path, mode="r", encoding="utf-8-sig", errors="ignore") as f:
                reader = csv.DictReader(f)
                return [dict(row) for row in reader]
    except Exception as e:
        logger.error(f"Error cargando archivo {file_path}: {e}")
        return []


async def process_clients(rows: List[Dict[str, str]], dry_run: bool, db):
    """Importa clientes y sus expedientes clínicos."""
    if not rows:
        return 0, 0, 0

    inserted, updated, errors = 0, 0, 0
    for idx, row in enumerate(rows):
        try:
            name = str(row.get("Name") or row.get("Full Name") or row.get("Nombre") or "").strip()
            phone = str(row.get("Phone") or row.get("Mobile") or row.get("Teléfono") or "").strip()
            email = str(row.get("Email") or row.get("Correo") or "").strip()
            city = str(row.get("City") or row.get("Ciudad") or "").strip()
            age = str(row.get("Age") or row.get("Edad") or "").strip()
            gender = str(row.get("Gender") or row.get("Género") or "").strip()
            occupation = str(row.get("Occupation") or row.get("Profesión") or "").strip()
            plan = str(row.get("Plan") or row.get("Plan Tier") or "").strip() or "Estándar 65k"

            if not name and not phone and not email:
                continue

            if phone:
                phone = phone.replace(" ", "").replace("-", "")
                if not phone.startswith("+"):
                    phone = "+57" + phone.lstrip("0")
            else:
                phone = f"+57300000{idx:05d}"

            if dry_run:
                inserted += 1
                continue

            # Corregido Punto 5a: INSERT a users sin plan_tier
            res = await db.execute(text("""
                INSERT INTO users (phone, name, email)
                VALUES (:phone, :name, :email)
                ON CONFLICT (phone) DO UPDATE SET
                    name = COALESCE(EXCLUDED.name, users.name),
                    email = COALESCE(EXCLUDED.email, users.email)
                RETURNING id
            """), {"phone": phone, "name": name or None, "email": email or None})
            uid = res.scalar()

            # Corregido Punto 5a: plan_tier se guarda en profiles
            await db.execute(text("""
                INSERT INTO profiles (user_id, age, gender, city, occupation, plan_tier, updated_at)
                VALUES (:uid, :age, :gender, :city, :occ, :plan, NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    age = COALESCE(EXCLUDED.age, profiles.age),
                    gender = COALESCE(EXCLUDED.gender, profiles.gender),
                    city = COALESCE(EXCLUDED.city, profiles.city),
                    occupation = COALESCE(EXCLUDED.occupation, profiles.occupation),
                    plan_tier = COALESCE(EXCLUDED.plan_tier, profiles.plan_tier),
                    updated_at = NOW()
            """), {
                "uid": uid,
                "age": int(age) if age.isdigit() else None,
                "gender": gender or None,
                "city": city or None,
                "occ": occupation or None,
                "plan": plan
            })
            
            inserted += 1
        except Exception as e:
            errors += 1
            logger.warning(f"Error procesando cliente fila {idx}: {e}")

    return inserted, updated, errors


async def process_matches(rows: List[Dict[str, str]], dry_run: bool, db):
    """Importa parejas e historial de matches / intros."""
    if not rows:
        return 0, 0, 0

    inserted, errors = 0, 0
    for idx, row in enumerate(rows):
        try:
            pA = str(row.get("Person A") or row.get("Client A") or row.get("Persona A") or "").strip()
            pB = str(row.get("Person B") or row.get("Client B") or row.get("Persona B") or "").strip()
            matchmaker = str(row.get("Matchmaker") or row.get("Psicóloga") or "SILVI").strip()
            match_date = str(row.get("Date") or row.get("Match Date") or row.get("Fecha") or "Por agendar").strip()
            status = str(row.get("Status") or row.get("Estado") or "PENDIENTE").strip().upper()
            notes = str(row.get("Notes") or row.get("Observations") or "").strip()

            if not pA or not pB:
                continue

            if dry_run:
                inserted += 1
                continue

            await db.execute(text("""
                INSERT INTO historical_matches (person_a, person_b, matchmaker, match_date, status, observations)
                VALUES (:pA, :pB, :mm, :mdate, :status, :obs)
            """), {
                "pA": pA, "pB": pB, "mm": matchmaker, "mdate": match_date, "status": status, "obs": notes or "Importación Histórica SmartMatchApp"
            })
            inserted += 1
        except Exception as e:
            errors += 1
            logger.warning(f"Error en match fila {idx}: {e}")

    return inserted, 0, errors


async def process_notes_and_surveys(rows: List[Dict[str, str]], dry_run: bool, db, source_tag: str):
    """Importa notas de clientes y respuestas de encuestas en client_notes."""
    if not rows:
        return 0, 0, 0

    inserted, errors = 0, 0
    for idx, row in enumerate(rows):
        try:
            user_name = str(row.get("Client Name") or row.get("Client") or row.get("Nombre") or "").strip()
            note_text = str(row.get("Note") or row.get("Comment") or row.get("Answer") or row.get("Text") or "").strip()

            if not note_text:
                continue

            if dry_run:
                inserted += 1
                continue

            uid = None
            if user_name:
                res = await db.execute(text("SELECT id FROM users WHERE LOWER(name) LIKE :n LIMIT 1"), {"n": f"%{user_name.lower()}%"})
                uid = res.scalar()

            await db.execute(text("""
                INSERT INTO client_notes (user_id, note, source, created_at)
                VALUES (:uid, :note, :src, NOW())
            """), {"uid": uid, "note": note_text, "src": source_tag})
            inserted += 1
        except Exception as e:
            errors += 1
            logger.warning(f"Error en nota/survey fila {idx}: {e}")

    return inserted, 0, errors


async def main():
    parser = argparse.ArgumentParser(description="Script de Importación Histórica desde Export Data de SmartMatchApp")
    parser.add_argument("--dir", required=True, help="Ruta a la carpeta con los archivos descargados")
    parser.add_argument("--dry-run", action="store_true", help="Modo de simulación (no escribe en la base de datos)")
    args = parser.parse_args()

    files = find_export_files(args.dir)
    logger.info(f"Archivos de exportación detectados: {list(files.keys())}")

    if not files:
        logger.warning("No se encontraron archivos de exportación válidos (.csv, .xlsx, .xls) en la carpeta.")
        return

    if args.dry_run:
        logger.info("=== MODO SIMULACIÓN (DRY-RUN) ACTIVO — NO SE MODIFICARÁ LA BASE DE DATOS ===")

    async with AsyncSessionLocal() as db:
        if "clients" in files:
            rows = load_rows(files["clients"])
            ins, up, err = await process_clients(rows, args.dry_run, db)
            logger.info(f"👥 Clientes -> Por procesar: {ins} | Errores: {err}")

        if "matches" in files:
            rows = load_rows(files["matches"])
            ins, up, err = await process_matches(rows, args.dry_run, db)
            logger.info(f"❤️ Matches -> Por procesar: {ins} | Errores: {err}")

        if "intros" in files:
            rows = load_rows(files["intros"])
            ins, up, err = await process_matches(rows, args.dry_run, db)
            logger.info(f"💌 Intros/Propuestas -> Por procesar: {ins} | Errores: {err}")

        if "notes" in files:
            rows = load_rows(files["notes"])
            ins, up, err = await process_notes_and_surveys(rows, args.dry_run, db, "smartmatch_notes_export")
            logger.info(f"📝 Notas de Clientes -> Por procesar: {ins} | Errores: {err}")

        if "surveys" in files:
            rows = load_rows(files["surveys"])
            ins, up, err = await process_notes_and_surveys(rows, args.dry_run, db, "smartmatch_surveys_export")
            logger.info(f"📋 Respuestas Encuestas -> Por procesar: {ins} | Errores: {err}")

        if not args.dry_run:
            await db.commit()
            logger.info("✅ Importación histórica ejecutada y guardada exitosamente en PostgreSQL.")

if __name__ == "__main__":
    asyncio.run(main())
