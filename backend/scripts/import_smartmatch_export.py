#!/usr/bin/env python3
"""
Script de Importación Histórica desde Archivos de Exportación de SmartMatchApp (Fase 2 - Perfeccionado).
- Resuelve IDs crudos de Persona A y Persona B a sus nombres reales o emails completos.
- Reporta la diferencia transparente entre filas brutas en Excel y entidades únicas sin duplicados.
"""

import os
import sys
import argparse
import asyncio
import json
import logging
import csv
from typing import Dict, List, Any

# Fallbacks locales para simulación si no se definieron variables en .env
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/dailylover")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("REDIS_PASSWORD", "redis_secret")
os.environ.setdefault("SMARTMATCHAPP_WEBHOOK_SECRET", "dummy_local_secret")

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/dailylover")
engine = create_async_engine(db_url, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("import_smartmatch")


def build_header_index(rows: List[Dict[str, str]]) -> Dict[str, str]:
    """Dado un dict de fila, retorna mapeo {header_normalizado: header_real} para búsqueda insensible a mayúsculas/tildes."""
    if not rows:
        return {}
    return {str(k).strip().lower(): k for k in rows[0].keys()}

def find_field(header_index: Dict[str, str], row: Dict[str, str], *candidates: str) -> str:
    """Busca la primera columna cuyo nombre contenga alguno de los candidatos y devuelve el valor."""
    for cand in candidates:
        cand_norm = cand.strip().lower()
        for header_norm, header_real in header_index.items():
            if cand_norm in header_norm:
                val = str(row.get(header_real) or "").strip()
                if val:
                    return val
    return ""

def find_export_files(folder_path: str) -> Dict[str, str]:
    """Escanea la carpeta en busca de archivos CSV o XLSX por categoría."""
    files = {}
    if not os.path.exists(folder_path):
        logger.error(f"La carpeta especificada no existe: {folder_path}")
        return files

    for f in os.listdir(folder_path):
        if f.startswith("~$"):
            continue
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
        elif "timeline" in fname_lower or "activities" in fname_lower:
            files["timeline"] = full_path

    return files

EXPECTED_COUNTS = {
    "clients": 3526,
    "matches": 2119,
    "notes": 144,
    "intros": 50,
}
TOLERANCE = 1.15

def sanity_check(category: str, actual_count: int):
    expected = EXPECTED_COUNTS.get(category)
    if expected and actual_count > expected * TOLERANCE:
        raise RuntimeError(
            f"⚠️ ABORTADO: '{category}' iba a procesar {actual_count} filas, "
            f"pero se esperaban ~{expected}. Revisar antes de continuar."
        )


def load_rows(file_path: str) -> List[Dict[str, str]]:
    """Carga un CSV o XLSX en una lista de diccionarios de Python."""
    if file_path.lower().endswith((".xlsx", ".xls")):
        import openpyxl
        wb = openpyxl.load_workbook(file_path, read_only=True)
        sheet = wb.active
        rows_iter = sheet.iter_rows(values_only=True)
        raw_headers = list(next(rows_iter))
        results = []
        for r in rows_iter:
            row_dict = {str(raw_headers[i] or ""): str(r[i] or "").strip() if r[i] is not None else "" for i in range(min(len(raw_headers), len(r)))}
            results.append(row_dict)
        return results
    else:
        with open(file_path, mode="r", encoding="utf-8-sig", errors="ignore") as f:
            reader = csv.DictReader(f)
            return [dict(row) for row in reader]


def build_id_to_name_catalog(client_rows: List[Dict[str, str]]) -> Dict[str, str]:
    """Construye un catálogo de resolución de SmartMatch Client ID -> Nombre Completo Real."""
    id_to_name = {}
    if not client_rows:
        return id_to_name

    header_index = build_header_index(client_rows)
    for r in client_rows:
        cid = find_field(header_index, r, "id", "client id")
        first = find_field(header_index, r, "nombre", "first name")
        last = find_field(header_index, r, "apellido", "last name")
        full_name = f"{first} {last}".strip()
        if cid and full_name:
            id_to_name[str(cid).strip()] = full_name
    return id_to_name

def resolve_person(header_index: Dict[str, str], row: Dict[str, str], id_to_name: Dict[str, str], *field_candidates: str) -> str:
    """Resuelve el identificador de una persona buscando prioritariamente en sus columnas específicas."""
    val = find_field(header_index, row, *field_candidates)
    if val:
        if val in id_to_name:
            return id_to_name[val]
        return val

    return ""



async def process_clients(rows: List[Dict[str, str]], dry_run: bool, db):
    """Importa clientes con mapeo dinámico de campos."""
    if not rows:
        return 0, 0, 0

    header_index = build_header_index(rows)
    inserted, updated, errors = 0, 0, 0

    for idx, row in enumerate(rows):
        try:
            first = find_field(header_index, row, "nombre", "first name")
            last = find_field(header_index, row, "apellido", "last name")
            name = f"{first} {last}".strip()

            phone = find_field(header_index, row, "teléfono", "telefono", "phone", "mobile")
            email = find_field(header_index, row, "email", "correo")
            city = find_field(header_index, row, "barrio city", "city", "ciudad")
            age = find_field(header_index, row, "edad", "age")
            gender = find_field(header_index, row, "género", "genero", "gender")
            occupation = find_field(header_index, row, "ocupación", "ocupacion", "occupation")
            plan = find_field(header_index, row, "membership status", "plan", "membership") or "Estándar 65k"

            if not name and not phone and not email:
                continue

            if phone:
                phone = phone.replace(" ", "").replace("-", "")
                if not phone.startswith("+"):
                    phone = "+57" + phone.lstrip("0")
            else:
                phone = f"+57300000{idx:05d}"

            if dry_run:
                if not name and not email:
                    errors += 1
                    continue
                inserted += 1
                continue

            async with db.begin_nested():
                # SELECT -> INSERT / UPDATE en users
                res_sel = await db.execute(text("SELECT id FROM users WHERE phone = :phone"), {"phone": phone})
                uid = res_sel.scalar()

                if uid is None:
                    res_ins = await db.execute(text("""
                        INSERT INTO users (phone, name, email)
                        VALUES (:phone, :name, :email)
                        ON CONFLICT (phone) DO UPDATE SET
                            name = COALESCE(EXCLUDED.name, users.name),
                            email = COALESCE(EXCLUDED.email, users.email)
                        RETURNING id
                    """), {"phone": phone, "name": name or None, "email": email or None})
                    uid = res_ins.scalar()
                    if uid is None:
                        res_sel2 = await db.execute(text("SELECT id FROM users WHERE phone = :phone"), {"phone": phone})
                        uid = res_sel2.scalar()
                else:
                    await db.execute(text("""
                        UPDATE users SET
                            name = COALESCE(:name, name),
                            email = COALESCE(:email, email)
                        WHERE id = :uid
                    """), {"uid": uid, "name": name or None, "email": email or None})

                # INSERT a profiles
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

import hashlib

def make_source_ref(prefix: str, row: Dict[str, str]) -> str:
    raw = "|".join(str(v) for v in row.values())
    h = hashlib.md5(raw.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}:{h}"

async def process_matches(rows: List[Dict[str, str]], id_to_name: Dict[str, str], dry_run: bool, db):
    """Importa parejas e historial de matches / intros con resolución de nombres reales."""
    if not rows:
        return 0, 0, 0

    header_index = build_header_index(rows)
    inserted, errors = 0, 0

    for idx, row in enumerate(rows):
        try:
            pA = resolve_person(header_index, row, id_to_name, "client email", "introducing client", "client 1", "person a", "client a", "client id")
            pB = resolve_person(header_index, row, id_to_name, "match email", "match", "recipient", "client 2", "person b", "client b", "match id")

            matchmaker = find_field(header_index, row, "user", "matchmaker", "by", "psicóloga", "psicologa") or "SILVI"
            match_date = find_field(header_index, row, "date", "created", "sent date", "fecha") or "Por agendar"
            status = (find_field(header_index, row, "status", "client status", "match status", "estado") or "PENDIENTE").upper()
            notes = find_field(header_index, row, "notes", "feedback", "comment", "observations")

            if not pA:
                continue

            if not pB:
                pB = "Por asignar / borrador"

            if dry_run:
                inserted += 1
                continue

            source_ref = make_source_ref("smartmatch_matches", row)
            await db.execute(text("""
                INSERT INTO historical_matches (person_a, person_b, matchmaker, match_date, status, observations, source_ref)
                VALUES (:pA, :pB, :mm, :mdate, :status, :obs, :sref)
                ON CONFLICT (source_ref) DO NOTHING
            """), {
                "pA": pA, "pB": pB, "mm": matchmaker, "mdate": match_date, "status": status,
                "obs": notes or "Importación Histórica SmartMatchApp", "sref": source_ref
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

    header_index = build_header_index(rows)
    inserted, errors = 0, 0

    for idx, row in enumerate(rows):
        try:
            user_name = find_field(header_index, row, "client email", "client name", "client", "nombre")
            note_text = find_field(header_index, row, "note text", "note", "comment", "answer", "text")

            if not note_text:
                continue

            if dry_run:
                inserted += 1
                continue

            uid = None
            if user_name:
                res = await db.execute(text("SELECT id FROM users WHERE LOWER(email) = :n OR LOWER(name) LIKE :n_like LIMIT 1"), {
                    "n": user_name.lower(),
                    "n_like": f"%{user_name.lower()}%"
                })
                uid = res.scalar()

            source_ref = make_source_ref(f"smartmatch_{source_tag}", row)
            await db.execute(text("""
                INSERT INTO client_notes (user_id, note, source, created_at, source_ref)
                VALUES (:uid, :note, :src, NOW(), :sref)
                ON CONFLICT (source_ref) DO NOTHING
            """), {"uid": uid, "note": note_text, "src": source_tag, "sref": source_ref})
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
    logger.info("=== DETECCIÓN DE ARCHIVOS FUENTE Y CATEGORÍAS ===")
    for category, filepath in files.items():
        print(f"Categoria '{category}' <- archivo: {filepath}")
        logger.info(f"Categoria '{category}' <- archivo: {filepath}")

    if not files:
        logger.warning("No se encontraron archivos de exportación válidos (.csv, .xlsx, .xls) en la carpeta.")
        return

    if args.dry_run:
        logger.info("=== MODO SIMULACIÓN (DRY-RUN) ACTIVO — NO SE MODIFICARÁ LA BASE DE DATOS ===")

    id_to_name_catalog = {}

    if "clients" in files:
        client_rows = load_rows(files["clients"])
        sanity_check("clients", len(client_rows))
        id_to_name_catalog = build_id_to_name_catalog(client_rows)
        async with AsyncSessionLocal() as db:
            ins, up, err = await process_clients(client_rows, args.dry_run, db)
            if not args.dry_run:
                await db.commit()
        logger.info(f"👥 Clientes -> Filas brutas en Excel: {len(client_rows)} | Validadas con éxito: {ins} | Nombres únicos: {len(id_to_name_catalog)}")

    if "matches" in files:
        rows = load_rows(files["matches"])
        sanity_check("matches", len(rows))
        async with AsyncSessionLocal() as db:
            ins, up, err = await process_matches(rows, id_to_name_catalog, args.dry_run, db)
            if not args.dry_run:
                await db.commit()
        logger.info(f"❤️ Matches -> Filas brutas en Excel: {len(rows)} | Validadas con éxito: {ins} | Errores: {err}")

    if "intros" in files:
        rows = load_rows(files["intros"])
        sanity_check("intros", len(rows))
        async with AsyncSessionLocal() as db:
            ins, up, err = await process_matches(rows, id_to_name_catalog, args.dry_run, db)
            if not args.dry_run:
                await db.commit()
        logger.info(f"💌 Intros/Propuestas -> Filas brutas en Excel: {len(rows)} | Validadas con éxito: {ins} | Errores: {err}")

    if "notes" in files:
        rows = load_rows(files["notes"])
        sanity_check("notes", len(rows))
        async with AsyncSessionLocal() as db:
            ins, up, err = await process_notes_and_surveys(rows, args.dry_run, db, "smartmatch_notes_export")
            if not args.dry_run:
                await db.commit()
        logger.info(f"📝 Notas de Clientes -> Filas brutas en Excel: {len(rows)} | Validadas con éxito: {ins} | Errores: {err}")

    if "surveys" in files:
        rows = load_rows(files["surveys"])
        async with AsyncSessionLocal() as db:
            ins, up, err = await process_notes_and_surveys(rows, args.dry_run, db, "smartmatch_surveys_export")
            if not args.dry_run:
                await db.commit()
        logger.info(f"📋 Respuestas Encuestas -> Filas brutas en Excel: {len(rows)} | Validadas con éxito: {ins} | Errores: {err}")

    if not args.dry_run:
        logger.info("✅ Importación histórica ejecutada y guardada exitosamente en PostgreSQL.")

if __name__ == "__main__":
    asyncio.run(main())


