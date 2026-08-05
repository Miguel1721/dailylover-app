#!/usr/bin/env python3
"""
Script de Carga Masiva y Pipeline de Imágenes (Fase 2 - Refactored con Verificación Honesta en --dry-run).
- Mide con exactitud cuántos clientes existen en Postgres y cuántos faltan por crear en --dry-run.
- Genera números de teléfono sintéticos estables con hashlib.md5 (elimina aleatoriedad de hash()).
- Genera 2 versiones WebP en memoria:
  1. Principal: máximo 1600px en el lado más largo (WebP Q80).
  2. Miniatura: máximo 400px en el lado más largo (WebP Q75).
- En corrida real (--no-dry-run): crea los clientes faltantes en users/profiles, sube a S3 / Oracle Object Storage e inserta en client_images.
"""

import os
import sys
import argparse
import json
import zipfile
import hashlib
import io
import asyncio
from typing import Dict, Optional, Tuple
import openpyxl
from PIL import Image

# Fallbacks locales para simulación si no se definieron variables en .env
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/dailylover")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("REDIS_PASSWORD", "redis_secret")
os.environ.setdefault("SMARTMATCHAPP_WEBHOOK_SECRET", "dummy_local_secret")

# Importar configuración y base de datos del proyecto
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.config import get_settings
from app.database import AsyncSessionLocal
from sqlalchemy import text

EXPORT_DIR = r"C:\Users\jeloz\Downloads\daily lover"

def stable_fake_phone(full_name_key: str) -> str:
    """Genera un número de teléfono falso pero 100% estable y determinístico."""
    digest = hashlib.md5(full_name_key.encode("utf-8")).hexdigest()
    numeric = int(digest[:8], 16) % 1000000
    return f"+5730000{numeric:06d}"

def optimize_image(img_bytes: bytes, max_dim: int, quality: int) -> bytes:
    """Optimiza y redimensiona una imagen devolviendo bytes en formato WebP."""
    img = Image.open(io.BytesIO(img_bytes))
    img = img.convert("RGB")
    img.thumbnail((max_dim, max_dim), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality, method=6)
    return buf.getvalue()

def get_s3_client():
    """Retorna un cliente boto3 configurado para Oracle Object Storage o AWS S3."""
    import boto3
    settings = get_settings()
    
    kwargs = {
        "aws_access_key_id": settings.aws_access_key_id,
        "aws_secret_access_key": settings.aws_secret_access_key,
        "region_name": settings.aws_default_region,
    }
    if settings.aws_endpoint_url:
        kwargs["endpoint_url"] = settings.aws_endpoint_url

    return boto3.client("s3", **kwargs)

async def get_db_user_map() -> Tuple[Dict[str, int], Dict[str, int], Dict[str, int]]:
    """Consulta los clientes reales existentes en Postgres (users/profiles)."""
    name_map = {}
    email_map = {}
    phone_map = {}
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(text("SELECT id, name, email, phone FROM users"))
            rows = result.fetchall()
            for uid, name, email, phone in rows:
                if name and name.strip():
                    name_map[name.strip().lower()] = uid
                if email and email.strip():
                    email_map[email.strip().lower()] = uid
                if phone and phone.strip():
                    clean_p = phone.strip().replace(" ", "").replace("-", "")
                    phone_map[clean_p] = uid
            print(f"Se cargaron {len(name_map)} clientes existentes directamente de la BD Postgres.")
    except Exception as e:
        print(f"No se pudo consultar la BD Postgres local ({e}). Se asumiran 0 clientes en BD.")
    return name_map, email_map, phone_map

def load_excel_client_catalog(excel_folder: str) -> Dict[str, Dict[str, str]]:
    """Carga los datos de clientes desde clients.xlsx estructurados por nombre completo."""
    catalog = {}
    clients_file = next((os.path.join(excel_folder, f) for f in os.listdir(excel_folder) if "clients." in f.lower() and f.endswith(".xlsx")), None)
    if not clients_file:
        return catalog

    try:
        wb = openpyxl.load_workbook(clients_file, read_only=True)
        sheet = wb.active
        rows_iter = sheet.iter_rows(values_only=True)
        raw_headers = list(next(rows_iter))
        headers = [str(c or "").strip().lower() for c in raw_headers]

        col_id = next((i for i, h in enumerate(headers) if h in ["id", "client id"]), 0)
        col_first = next((i for i, h in enumerate(headers) if "nombre" in h or "first name" in h), 9)
        col_last = next((i for i, h in enumerate(headers) if "apellido" in h or "last name" in h), 10)
        col_email = next((i for i, h in enumerate(headers) if "email" in h or "correo" in h), 18)
        col_phone = next((i for i, h in enumerate(headers) if "teléfono" in h or "telefono" in h or "phone" in h), 20)

        for row in rows_iter:
            cid = row[col_id]
            first = str(row[col_first] or "").strip()
            last = str(row[col_last] or "").strip()
            full_name = f"{first} {last}".strip().lower()
            email = str(row[col_email] or "").strip().lower() if col_email < len(row) else ""
            phone = str(row[col_phone] or "").strip().replace(" ", "").replace("-", "") if col_phone < len(row) else ""

            if full_name:
                catalog[full_name] = {
                    "smartmatch_id": cid,
                    "first_name": first,
                    "last_name": last,
                    "full_name_raw": f"{first} {last}".strip(),
                    "email": email,
                    "phone": phone
                }
        print(f"Catalogo de clients.xlsx cargado: {len(catalog)} clientes.")
    except Exception as e:
        print(f"Error al leer clients.xlsx: {e}")

    return catalog

async def ensure_user_in_postgres(client_info: Dict[str, str], db_name_map: Dict[str, int]) -> int:
    """Garantiza que el cliente exista en users (Postgres) y retorna su id (INT PRIMARY KEY)."""
    full_name_key = client_info["full_name_raw"].strip().lower()
    
    if full_name_key in db_name_map:
        return db_name_map[full_name_key]

    phone = client_info.get("phone") or ""
    if phone:
        if not phone.startswith("+"):
            phone = "+57" + phone.lstrip("0")
    else:
        phone = stable_fake_phone(full_name_key)

    email = client_info.get("email") or None
    name = client_info.get("full_name_raw") or "Cliente SmartMatch"

    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            INSERT INTO users (phone, name, email)
            VALUES (:phone, :name, :email)
            ON CONFLICT (phone) DO UPDATE SET
                name = COALESCE(EXCLUDED.name, users.name),
                email = COALESCE(EXCLUDED.email, users.email)
            RETURNING id
        """), {"phone": phone, "name": name, "email": email})
        uid = res.scalar()

        await db.execute(text("""
            INSERT INTO profiles (user_id, updated_at)
            VALUES (:uid, NOW())
            ON CONFLICT (user_id) DO NOTHING
        """), {"uid": uid})

        await db.commit()

    db_name_map[full_name_key] = uid
    return uid

async def resolve_or_check_user(
    client_info: Dict[str, str],
    db_name_map: Dict[str, int],
    db_email_map: Dict[str, int],
    db_phone_map: Dict[str, int],
    dry_run: bool
) -> Tuple[Optional[int], bool]:
    """
    Devuelve (user_id, needs_creation).
    - Si el cliente ya existe en Postgres (por nombre, email o teléfono), retorna su id real y False.
    - Si no existe:
        - dry_run=True  -> retorna (None, True) sin escribir nada en la BD.
        - dry_run=False -> lo crea de verdad (ensure_user_in_postgres) y retorna (id_real, True).
    """
    full_name_key = client_info["full_name_raw"].strip().lower()

    if full_name_key in db_name_map:
        return db_name_map[full_name_key], False
    if client_info.get("email") and client_info["email"] in db_email_map:
        return db_email_map[client_info["email"]], False
    if client_info.get("phone"):
        clean_phone = client_info["phone"].replace(" ", "").replace("-", "")
        if clean_phone in db_phone_map:
            return db_phone_map[clean_phone], False

    # No existe todavía en Postgres
    if dry_run:
        return None, True

    uid = await ensure_user_in_postgres(client_info, db_name_map)
    return uid, True

async def main():
    parser = argparse.ArgumentParser(description="Pipeline de imágenes SmartMatchApp -> S3 / Oracle Object Storage")
    parser.add_argument("--dir", default=EXPORT_DIR, help="Carpeta que contiene las partes ZIP y los Excel")
    parser.add_argument("--dry-run", dest="dry_run", action="store_true", help="Proyecta la carga y optimización sin subir a S3 ni modificar la BD")
    parser.add_argument("--limit", type=int, default=None, help="Procesa como máximo N imágenes (para pruebas reales chicas)")
    args = parser.parse_args()

    print("================================================================================")
    print("PIPELINE DE IMAGENES SMARTMATCHAPP (FASE 2 - VERIFICACION HONESTA DRY-RUN)")
    print(f"Carpeta Origen: {args.dir}")
    print(f"Modo de Ejecucion: {'DRY-RUN (Simulacion sin cambios)' if args.dry_run else 'PRODUCCION (Subida activa a S3 y Postgres)'}")
    if args.limit:
        print(f"Limite Activo: Maximo {args.limit} imagenes con cliente")
    print("================================================================================\n")


    settings = get_settings()

    if not args.dry_run:
        if not settings.aws_s3_bucket or not settings.aws_access_key_id:
            print("Error: Se requieren las variables AWS_S3_BUCKET y AWS_ACCESS_KEY_ID en .env para ejecutar en modo produccion.")
            return

    # 1. Cargar clientes existentes de la BD Postgres
    db_name_map, db_email_map, db_phone_map = await get_db_user_map()

    # 2. Cargar catálogo de clients.xlsx
    excel_catalog = load_excel_client_catalog(args.dir)

    zip_files = sorted([f for f in os.listdir(args.dir) if f.endswith(".zip") and "images_part_" in f])
    
    total_images_processed = 0
    duplicates_skipped = 0
    uploaded_count = 0
    unmatched_count = 0
    created_users_count = 0
    missing_users_set = set()
    projected_missing_user_images = 0

    hashes_seen = set()
    unmatched_log = []
    projected_raw_bytes = 0
    projected_opt_bytes = 0

    s3 = None if args.dry_run else get_s3_client()

    for zfname in zip_files:
        zfpath = os.path.join(args.dir, zfname)
        print(f"\nProcesando paquete {zfname}...")

        try:
            with zipfile.ZipFile(zfpath, 'r') as z:
                for member in z.infolist():
                    if member.is_dir():
                        continue
                    
                    ext = os.path.splitext(member.filename)[1].lower()
                    if ext not in ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.bmp']:
                        continue

                    total_images_processed += 1
                    img_bytes = z.read(member)
                    raw_len = len(img_bytes)
                    projected_raw_bytes += raw_len

                    # Deduplicación por hash MD5 en tiempo real
                    h = hashlib.md5(img_bytes).hexdigest()
                    if h in hashes_seen:
                        duplicates_skipped += 1
                        continue
                    hashes_seen.add(h)

                    # Resolver Cliente por nombre de carpeta
                    parts = member.filename.split('/')
                    user_id = None
                    folder_name = None
                    if len(parts) > 1:
                        folder_name = parts[0].strip().lower()

                    if not folder_name or folder_name not in excel_catalog:
                        unmatched_count += 1
                        unmatched_log.append(member.filename)
                        continue

                    client_info = excel_catalog[folder_name]
                    user_id, needs_creation = await resolve_or_check_user(
                        client_info, db_name_map, db_email_map, db_phone_map, args.dry_run
                    )

                    if needs_creation:
                        missing_users_set.add(folder_name)
                        if not args.dry_run:
                            created_users_count += 1

                    if user_id is None:
                        # En dry-run cuando el cliente no existe todavía en Postgres
                        projected_missing_user_images += 1

                    # Compresión en memoria (Main 1600px Q80 + Thumb 400px Q75)
                    try:
                        im = Image.open(io.BytesIO(img_bytes))
                        orig_w, orig_h = im.size

                        main_webp = optimize_image(img_bytes, max_dim=1600, quality=80)
                        thumb_webp = optimize_image(img_bytes, max_dim=400, quality=75)
                        
                        projected_opt_bytes += (len(main_webp) + len(thumb_webp))

                        if not args.dry_run and user_id:
                            s3_key_main = f"clients/{user_id}/main_{h[:10]}.webp"
                            s3_key_thumb = f"clients/{user_id}/thumb_{h[:10]}.webp"

                            s3.put_object(
                                Bucket=settings.aws_s3_bucket,
                                Key=s3_key_main,
                                Body=main_webp,
                                ContentType="image/webp"
                            )
                            s3.put_object(
                                Bucket=settings.aws_s3_bucket,
                                Key=s3_key_thumb,
                                Body=thumb_webp,
                                ContentType="image/webp"
                            )

                            async with AsyncSessionLocal() as db:
                                res = await db.execute(text("SELECT COUNT(*) FROM client_images WHERE user_id = :uid"), {"uid": user_id})
                                count = res.scalar()
                                is_primary = (count == 0)

                                await db.execute(text("""
                                    INSERT INTO client_images (user_id, s3_key_main, s3_key_thumb, is_primary, original_filename, width, height)
                                    VALUES (:uid, :main, :thumb, :primary, :orig_name, :w, :h)
                                """), {
                                    "uid": user_id,
                                    "main": s3_key_main,
                                    "thumb": s3_key_thumb,
                                    "primary": is_primary,
                                    "orig_name": os.path.basename(member.filename),
                                    "w": orig_w,
                                    "h": orig_h
                                })

                                if is_primary:
                                    photo_url = f"https://{settings.aws_s3_bucket}.s3.amazonaws.com/{s3_key_main}"
                                    if settings.aws_endpoint_url:
                                        photo_url = f"{settings.aws_endpoint_url.rstrip('/')}/{settings.aws_s3_bucket}/{s3_key_main}"
                                    
                                    await db.execute(text("UPDATE profiles SET photo_url = :url WHERE user_id = :uid"), {
                                        "url": photo_url,
                                        "uid": user_id
                                    })
                                
                                await db.commit()

                        uploaded_count += 1
                        if args.limit and uploaded_count >= args.limit:
                            break

                    except Exception as e:
                        print(f"Error procesando imagen {member.filename}: {e}")

                if args.limit and uploaded_count >= args.limit:
                    break

        except Exception as e:
            print(f"Error leyendo paquete ZIP {zfname}: {e}")

        if args.limit and uploaded_count >= args.limit:
            break


    # Reporte de cierre
    print("\n================================================================================")
    print("RESUMEN FINAL DEL PIPELINE DE IMAGENES (FASE 2 - REPORTE DE INTEGRIDAD)")
    print("================================================================================")
    print(f"Total de imagenes escaneadas: {total_images_processed:,}")
    print(f"Duplicados omitidos por hash MD5: {duplicates_skipped:,}")
    print(f"Imagenes optimizadas en memoria: {uploaded_count:,}")
    print(f"Clientes que YA existen en Postgres: {len(db_name_map):,}")
    print(f"Clientes que faltan por crear en Postgres: {len(missing_users_set):,}")
    if args.dry_run:
        print(f"Imagenes que pertenecen a clientes aun no creados en Postgres: {projected_missing_user_images:,}")
    else:
        print(f"Clientes creados de verdad en esta corrida: {created_users_count:,}")
    print(f"Imagenes sin cliente asociado: {unmatched_count:,}")
    print(f"Peso original (RAW): {projected_raw_bytes / (1024**3):.2f} GB")
    print(f"Peso optimizado final (Main + Thumb WebP): {projected_opt_bytes / (1024**3):.2f} GB")
    
    if unmatched_log:
        log_path = os.path.abspath(os.path.join(args.dir, "unmatched_images_log.json"))
        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(unmatched_log, f, indent=2, ensure_ascii=False)
        print(f"\nSe guardo el registro de las {len(unmatched_log)} imagenes no asociadas en:\n   {log_path}")
    print("================================================================================\n")

if __name__ == "__main__":
    asyncio.run(main())
