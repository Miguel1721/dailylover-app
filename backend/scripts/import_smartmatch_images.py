#!/usr/bin/env python3
"""
Script de Carga Masiva y Pipeline de Imágenes (Fase 2).
- Recorre los paquetes ZIP (images_part_1 a images_part_12) en C:\\Users\\jeloz\\Downloads\\daily lover.
- Resuelve el user_id del cliente buscando en la tabla `users` / `profiles` de la base de datos o en `clients.xlsx`.
- Realiza deduplicación global por hash MD5 en tiempo real.
- Genera 2 versiones WebP con Pillow:
  1. Versión Principal: máximo 1600px en el lado más largo, WebP calidad 80.
  2. Miniatura (Thumb): máximo 400px en el lado más largo, WebP calidad 75.
- Si NO es --dry-run: sube ambas versiones a Oracle Object Storage / S3 via boto3 e inserta registros en la tabla `client_images`.
- Actualiza `profiles.photo_url` con la imagen primaria (is_primary = TRUE).
"""

import os
import sys
import argparse
import json
import zipfile
import hashlib
import io
import asyncio
from typing import Dict, Optional
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

async def load_client_mappings(excel_folder: str) -> Dict[str, int]:
    """Carga mapeo de Nombre Completo -> user_id leyendo la BD de Postgres con fallback a clients.xlsx."""
    name_to_user_id = {}
    
    # 1. Intentar cargar desde la Base de Datos PostgreSQL
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(text("SELECT id, name FROM users WHERE name IS NOT NULL"))
            rows = result.fetchall()
            for uid, name in rows:
                if name and name.strip():
                    name_to_user_id[name.strip().lower()] = uid
            print(f"Se cargaron {len(name_to_user_id)} clientes directamente de la base de datos Postgres.")
    except Exception as e:
        print(f"No se pudo consultar la BD Postgres local ({e}). Usando catalogo de clients.xlsx.")

    # 2. Fallback / Enriquecimiento desde clients.xlsx
    clients_file = next((os.path.join(excel_folder, f) for f in os.listdir(excel_folder) if "clients." in f.lower() and f.endswith(".xlsx")), None)
    if clients_file:
        try:
            wb = openpyxl.load_workbook(clients_file, read_only=True)
            sheet = wb.active
            rows_iter = sheet.iter_rows(values_only=True)
            raw_headers = list(next(rows_iter))
            headers = [str(c or "").strip().lower() for c in raw_headers]

            col_id = next((i for i, h in enumerate(headers) if "id" == h or "client id" in h), 0)
            col_first = next((i for i, h in enumerate(headers) if "nombre" in h or "first name" in h), 9)
            col_last = next((i for i, h in enumerate(headers) if "apellido" in h or "last name" in h), 10)

            for row in rows_iter:
                cid = row[col_id]
                first = str(row[col_first] or "").strip()
                last = str(row[col_last] or "").strip()
                full_name = f"{first} {last}".strip().lower()

                if full_name and full_name not in name_to_user_id:
                    name_to_user_id[full_name] = cid

            print(f"Catalogo total mapeado (BD + XLSX): {len(name_to_user_id)} clientes.")
        except Exception as e:
            print(f"Error al leer clients.xlsx: {e}")


    return name_to_user_id

async def main():
    parser = argparse.ArgumentParser(description="Pipeline de imágenes SmartMatchApp -> S3 / Oracle Object Storage")
    parser.add_argument("--dir", default=EXPORT_DIR, help="Carpeta que contiene las partes ZIP y los Excel")
    parser.add_argument("--dry-run", dest="dry_run", action="store_true", help="Proyecta la carga y optimización sin subir a S3 ni modificar la BD")
    args = parser.parse_args()

    print("================================================================================")
    print("PIPELINE DE IMAGENES SMARTMATCHAPP (FASE 2)")
    print(f"Carpeta Origen: {args.dir}")
    print(f"Modo de Ejecucion: {'DRY-RUN (Simulacion sin cambios)' if args.dry_run else 'PRODUCCION (Subida activa a S3 y Postgres)'}")
    print("================================================================================\n")


    settings = get_settings()

    if not args.dry_run:
        if not settings.aws_s3_bucket or not settings.aws_access_key_id:
            print("❌ Error: Se requieren las variables AWS_S3_BUCKET y AWS_ACCESS_KEY_ID en .env para ejecutar en modo producción.")
            return

    # Cargar mapeo de clientes
    client_map = await load_client_mappings(args.dir)

    zip_files = sorted([f for f in os.listdir(args.dir) if f.endswith(".zip") and "images_part_" in f])
    
    total_images_processed = 0
    duplicates_skipped = 0
    uploaded_count = 0
    unmatched_count = 0

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

                    # 1. Deduplicación por hash MD5 en tiempo real
                    h = hashlib.md5(img_bytes).hexdigest()
                    if h in hashes_seen:
                        duplicates_skipped += 1
                        continue
                    hashes_seen.add(h)

                    # 2. Resolver Cliente (user_id) por nombre de carpeta
                    parts = member.filename.split('/')
                    user_id = None
                    if len(parts) > 1:
                        folder_name = parts[0].strip().lower()
                        user_id = client_map.get(folder_name)

                    if not user_id:
                        unmatched_count += 1
                        unmatched_log.append(member.filename)
                        continue

                    # 3. Compresión en memoria (Main 1600px Q80 + Thumb 400px Q75)
                    try:
                        im = Image.open(io.BytesIO(img_bytes))
                        orig_w, orig_h = im.size

                        main_webp = optimize_image(img_bytes, max_dim=1600, quality=80)
                        thumb_webp = optimize_image(img_bytes, max_dim=400, quality=75)
                        
                        projected_opt_bytes += (len(main_webp) + len(thumb_webp))

                        s3_key_main = f"clients/{user_id}/main_{h[:10]}.webp"
                        s3_key_thumb = f"clients/{user_id}/thumb_{h[:10]}.webp"

                        is_primary = False

                        if not args.dry_run:
                            # Subida a Object Storage / S3

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

                            # Inserción en Postgres
                            async with AsyncSessionLocal() as db:
                                # Verificar si es la primera foto del cliente para marcarla como primaria
                                res = await db.execute(text("SELECT COUNT(*) FROM client_images WHERE user_id = :uid"), {"uid": user_id})
                                count = res.scalar()
                                if count == 0:
                                    is_primary = True

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
                                    # Actualizar photo_url en profiles
                                    photo_url = f"https://{settings.aws_s3_bucket}.s3.amazonaws.com/{s3_key_main}"
                                    if settings.aws_endpoint_url:
                                        photo_url = f"{settings.aws_endpoint_url.rstrip('/')}/{settings.aws_s3_bucket}/{s3_key_main}"
                                    
                                    await db.execute(text("UPDATE profiles SET photo_url = :url WHERE user_id = :uid"), {
                                        "url": photo_url,
                                        "uid": user_id
                                    })
                                
                                await db.commit()

                        uploaded_count += 1

                    except Exception as e:
                        print(f"Error procesando imagen {member.filename}: {e}")

        except Exception as e:
            print(f"Error leyendo paquete ZIP {zfname}: {e}")

    # Reporte de cierre
    print("\n================================================================================")
    print("RESUMEN FINAL DEL PIPELINE DE IMAGENES (FASE 2)")
    print("================================================================================")
    print(f"Total de imagenes escaneadas: {total_images_processed:,}")
    print(f"Duplicados omitidos por hash MD5: {duplicates_skipped:,}")
    print(f"Imagenes optimizadas y {'proyectadas' if args.dry_run else 'subidas con exito'}: {uploaded_count:,}")

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
