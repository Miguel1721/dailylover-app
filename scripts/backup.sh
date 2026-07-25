#!/bin/bash
# =================================================================─────────────
# 💾 Daily Lover — Script de Respaldos Automáticos de Base de Datos y Fotos
# Realiza backup comprimido (.sql.gz) de PostgreSQL + sincroniza fotos WebP.
# Guarda copia local (retención 14 días) y opcionalmente sube a AWS S3.
# =================================================================─────────────

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOCAL_BACKUP_DIR="/var/backups/dailylover"
mkdir -p "$LOCAL_BACKUP_DIR"

# Cargar variables de entorno
if [ -f /home/ubuntu/dailylover/.env ]; then
    set -a
    source /home/ubuntu/dailylover/.env
    set +a
elif [ -f .env ]; then
    set -a
    source .env
    set +a
fi

DB_USER=${POSTGRES_USER:-postgres}
DB_NAME=${POSTGRES_DB:-dailylover}
BACKUP_FILE="${LOCAL_BACKUP_DIR}/dailylover_${TIMESTAMP}.sql.gz"

echo "═══════════════════════════════════════════════════════════════"
echo " 💾 [BACKUP] Iniciando respaldo automático: $(date)"
echo "═══════════════════════════════════════════════════════════════"

# 1. Generar dump de PostgreSQL comprimido
echo "📦 Resguardando base de datos PostgreSQL ($DB_NAME)..."
if docker ps | grep -q dl_postgres; then
    docker exec dl_postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists | gzip > "$BACKUP_FILE"
    echo "✅ Backup local guardado en: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
    echo "⚠️ Contenedor dl_postgres no en ejecución. Se omite pg_dump."
fi

# 2. Resguardar fotos subidas de clientes (uploads)
FOTOS_TAR="${LOCAL_BACKUP_DIR}/fotos_${TIMESTAMP}.tar.gz"
if [ -d "/home/ubuntu/dailylover/backend/app/static/uploads" ]; then
    echo "🖼️ Resguardando imágenes de clientes (uploads)..."
    tar -czf "$FOTOS_TAR" -C /home/ubuntu/dailylover/backend/app/static uploads 2>/dev/null || true
    echo "✅ Backup de fotos guardado en: $FOTOS_TAR ($(du -h "$FOTOS_TAR" 2>/dev/null | cut -f1 || echo '0B'))"
fi

# 3. Subir a AWS S3 si las credenciales están configuradas en .env
if [ -n "$AWS_S3_BUCKET" ] && [ "$AWS_S3_BUCKET" != "your_s3_bucket_name_here" ]; then
    echo "☁️ Subiendo respaldos a AWS S3 (Bucket: $AWS_S3_BUCKET)..."
    if command -v aws &> /dev/null; then
        aws s3 cp "$BACKUP_FILE" "s3://${AWS_S3_BUCKET}/backups/db/dailylover_${TIMESTAMP}.sql.gz"
        [ -f "$FOTOS_TAR" ] && aws s3 cp "$FOTOS_TAR" "s3://${AWS_S3_BUCKET}/backups/media/fotos_${TIMESTAMP}.tar.gz"
        echo "✅ Respaldos subidos a AWS S3 exitosamente."
    else
        echo "⚠️ CLI de AWS no instalado. Se conservan solo las copias locales."
    fi
fi

# 4. Política de Retención: Eliminar backups locales de más de 14 días para no llenar disco
echo "🧹 Aplicando política de rotación (Eliminando respaldos de más de 14 días)..."
find "$LOCAL_BACKUP_DIR" -type f -name "*.sql.gz" -mtime +14 -delete
find "$LOCAL_BACKUP_DIR" -type f -name "*.tar.gz" -mtime +14 -delete
echo "✅ Rotación de backups completada."

echo "═══════════════════════════════════════════════════════════════"
echo " 🎉 Respaldo completado con éxito a las $(date)"
echo "═══════════════════════════════════════════════════════════════"
