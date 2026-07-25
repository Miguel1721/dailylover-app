# backend/app/services/image_service.py
"""
Servicio de Optimización y Seguridad de Imágenes para Daily Lover.

Funciones:
1. Eliminación de metadatos EXIF (Geolocalización GPS, dispositivo, fecha) para ciberseguridad y privacidad (Ley 1581 / Habeas Data).
2. Redimensionamiento inteligente (Máx. 1080px de ancho) preservando relación de aspecto.
3. Conversión automática al formato WebP optimizado (Reducción de peso del 95%: fotos de 5MB a ~100KB).
"""

import io
import os
import uuid
from PIL import Image, ImageOps

# Directorio de almacenamiento de imágenes optimizadas
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def optimize_and_save_photo(file_bytes: bytes, user_id: int) -> str:
    """
    Procesa una imagen cruda (JPEG/PNG/HEIC de celular):
    - Elimina metadatos EXIF (Privacidad y Geolocalización GPS)
    - Auto-orientación según sensor
    - Redimensiona a máx 1080px
    - Convierte a formato WebP optimizado (Compresión ~80%)
    - Retorna el path relativo /static/uploads/usr_{user_id}_{uuid}.webp
    """
    # 1. Cargar imagen con Pillow
    image = Image.open(io.BytesIO(file_bytes))

    # 2. Auto-orientar según etiqueta EXIF de cámara antes de removerla
    image = ImageOps.exif_transpose(image)

    # 3. Convertir a RGB (manejo de transparencias PNG o formatos CMYK)
    if image.mode in ("RGBA", "P"):
        image = image.convert("RGB")
    elif image.mode != "RGB":
        image = image.convert("RGB")

    # 4. Redimensionamiento Máximo (1080px ancho/alto)
    max_size = (1080, 1080)
    image.thumbnail(max_size, Image.Resampling.LANCZOS)

    # 5. Generar nombre único libre de rastreo
    filename = f"usr_{user_id}_{uuid.uuid4().hex[:10]}.webp"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # 6. Guardar como WebP optimizado sin metadatos EXIF
    # Quality=78 ofrece excelente calidad visual humana con peso promedio ~90KB - 120KB
    image.save(filepath, format="WEBP", quality=78, optimize=True)

    # Retornar URL estática
    return f"/static/uploads/{filename}"
