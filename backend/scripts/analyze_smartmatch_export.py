#!/usr/bin/env python3
"""
Script de Inventario y Análisis de Export de SmartMatchApp (Fase 1).
Analiza archivos XLSX y paquetes ZIP de imágenes en C:\\Users\\jeloz\\Downloads\\daily lover.
No escribe en la base de datos ni modifica ningún archivo.
"""

import os
import sys
import json
import zipfile
import hashlib
import openpyxl
from io import BytesIO
from PIL import Image

EXPORT_DIR = r"C:\Users\jeloz\Downloads\daily lover"

def run_analysis():
    print("================================================================================")
    print("INICIANDO INVENTARIO Y ANALISIS DE EXPORT SMARTMATCHAPP (FASE 1)")
    print(f"Carpeta Objetivo: {EXPORT_DIR}")
    print("================================================================ algorithm\n")


    if not os.path.exists(EXPORT_DIR):
        print(f"❌ Error: La carpeta {EXPORT_DIR} no existe.")
        return

    # 1. ESQUEMA DE ARCHIVOS Y TAMAÑOS
    files_info = {}
    zip_files = []
    excel_files = []
    total_raw_bytes = 0

    for fname in os.listdir(EXPORT_DIR):
        fpath = os.path.join(EXPORT_DIR, fname)
        if not os.path.isfile(fpath):
            continue
        size = os.path.getsize(fpath)
        total_raw_bytes += size
        files_info[fname] = size

        if fname.endswith(".zip"):
            zip_files.append((fname, fpath, size))
        elif fname.endswith(".xlsx") or fname.endswith(".xls"):
            excel_files.append((fname, fpath, size))

    print(f"Total de Archivos Exportados: {len(files_info)}")
    print(f"Tamano Total Ocupado en Disco: {total_raw_bytes / (1024**3):.2f} GB\n")


    # 2. MAPEO CLIENTE ↔ NOMBRE EN CLIENTS.XLSX
    clients_file = next((fpath for fname, fpath, _ in excel_files if "clients." in fname.lower()), None)
    client_name_map = {}
    client_phone_map = {}
    client_email_map = {}

    if clients_file:
        print("Procesando catalogo de clientes desde clients.xlsx...")
        wb = openpyxl.load_workbook(clients_file, read_only=True)
        sheet = wb.active
        for row in list(sheet.iter_rows(values_only=True))[1:]:
            cid = row[0]
            first = str(row[9] or "").strip()
            last = str(row[10] or "").strip()
            full_name = f"{first} {last}".strip().lower()
            email = str(row[18] or "").strip().lower()
            phone = str(row[20] or "").strip().replace(" ", "").replace("-", "")

            if cid:
                if full_name:
                    client_name_map[full_name] = cid
                if email:
                    client_email_map[email] = cid
                if phone:
                    client_phone_map[phone] = cid
        print(f"Total de Clientes Mapeados: {len(client_name_map)} por nombre completo.\n")

    # 3. ANÁLISIS DE IMÁGENES DENTRO DE ZIPS Y DEDUPLICACIÓN
    print("Analizando paquetes de imagenes (ZIPs)...")
    total_images = 0
    duplicate_images = 0
    matched_images_to_client = 0
    unmatched_images = 0

    hashes_seen = set()
    formats_count = {}
    resolutions = []
    sample_images_for_compression = []

    for fname, fpath, fsize in zip_files:
        print(f"   Procesando {fname} ({fsize / (1024**2):.1f} MB)...")

        try:
            with zipfile.ZipFile(fpath, 'r') as z:
                for member in z.infolist():
                    if member.is_dir():
                        continue
                    filename = member.filename
                    ext = os.path.splitext(filename)[1].lower()

                    if ext not in ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.bmp']:
                        continue

                    total_images += 1
                    formats_count[ext] = formats_count.get(ext, 0) + 1

                    # Mapeo a cliente por nombre de carpeta
                    parts = filename.split('/')
                    if len(parts) > 1:
                        folder_client = parts[0].strip().lower()
                        if folder_client in client_name_map:
                            matched_images_to_client += 1
                        else:
                            unmatched_images += 1
                    else:
                        unmatched_images += 1

                    # Muestra para calcular hashes y compresión proyectada (primeras 60 imágenes)
                    if len(sample_images_for_compression) < 60:
                        img_bytes = z.read(member)
                        h = hashlib.md5(img_bytes).hexdigest()
                        if h in hashes_seen:
                            duplicate_images += 1
                        else:
                            hashes_seen.add(h)

                        try:
                            im = Image.open(BytesIO(img_bytes))
                            w, h_px = im.size
                            resolutions.append((w, h_px, len(img_bytes)))
                            sample_images_for_compression.append(img_bytes)
                        except Exception:
                            pass
        except Exception as e:
            print(f"⚠️ Error leyendo {fname}: {e}")

    # 4. PROYECCIÓN DE COMPRESIÓN (MUESTRA AMBIENTADA A WEBP 1600PX C80 + 400PX C75)
    print("\nCalculando tasa de compresion proyectada (WebP 1600px + Thumb 400px)...")

    orig_sample_size = 0
    webp_main_size = 0
    webp_thumb_size = 0

    for raw_b in sample_images_for_compression:
        orig_sample_size += len(raw_b)
        try:
            im = Image.open(BytesIO(raw_b)).convert("RGB")
            
            # Main WebP (Max 1600px, Q80)
            im_main = im.copy()
            im_main.thumbnail((1600, 1600), Image.LANCZOS)
            buf_main = BytesIO()
            im_main.save(buf_main, format="WEBP", quality=80, method=6)
            webp_main_size += len(buf_main.getvalue())

            # Thumb WebP (Max 400px, Q75)
            im_thumb = im.copy()
            im_thumb.thumbnail((400, 400), Image.LANCZOS)
            buf_thumb = BytesIO()
            im_thumb.save(buf_thumb, format="WEBP", quality=75, method=6)
            webp_thumb_size += len(buf_thumb.getvalue())
        except Exception as e:
            pass

    compression_ratio = (webp_main_size + webp_thumb_size) / orig_sample_size if orig_sample_size > 0 else 0.2
    projected_total_gb = (total_raw_bytes * compression_ratio) / (1024**3)

    # 5. REPORTE FINAL DE RESULTADOS
    report = {
        "summary": {
            "total_raw_size_gb": round(total_raw_bytes / (1024**3), 2),
            "projected_compressed_size_gb": round(projected_total_gb, 2),
            "compression_ratio_percent": round(compression_ratio * 100, 1),
            "free_tier_limit_gb": 20.0,
            "within_free_tier": projected_total_gb <= 20.0
        },
        "images": {
            "total_count": total_images,
            "matched_to_client": matched_images_to_client,
            "unmatched": unmatched_images,
            "match_rate_percent": round((matched_images_to_client / total_images * 100), 1) if total_images > 0 else 0,
            "formats": formats_count
        },
        "sample_resolutions": {
            "count": len(resolutions),
            "avg_width": int(sum(r[0] for r in resolutions) / len(resolutions)) if resolutions else 0,
            "avg_height": int(sum(r[1] for r in resolutions) / len(resolutions)) if resolutions else 0,
            "avg_orig_file_size_kb": int(sum(r[2] for r in resolutions) / len(resolutions) / 1024) if resolutions else 0
        }
    }

    report_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "scratch"))
    os.makedirs(report_dir, exist_ok=True)
    report_path = os.path.join(report_dir, "smartmatch_export_inventory_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)


    print("\n================================================================================")
    print("RESUMEN DEL INVENTARIO (FASE 1 COMPLETADA)")
    print("================================================================================")
    print(f"Archivos totales de imagen detectados: {total_images:,}")
    print(f"Imagenes asociadas con exito a un Cliente: {matched_images_to_client:,} ({report['images']['match_rate_percent']}%)")
    print(f"Tamano actual del export (RAW): {report['summary']['total_raw_size_gb']} GB")
    print(f"Tamano estimado tras compresion WebP: {report['summary']['projected_compressed_size_gb']} GB")
    print(f"Estado de compatibilidad con Oracle Free Tier (20GB): {'ENTRA GRATIS CON MARGEN DE SOBRA' if report['summary']['within_free_tier'] else 'SUPERA LIMITE'}")
    print("================================================================================")

if __name__ == "__main__":
    run_analysis()
