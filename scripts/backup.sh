#!/bin/bash
# scripts/backup.sh — ejecuta backup de la base de datos y sube a AWS S3
set -e

# Cargar variables de entorno si existe el archivo .env
if [ -f ../.env ]; then
    export $(grep -v '^#' ../.env | xargs)
elif [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/tmp/db_backups"
BACKUP_FILE="${BACKUP_DIR}/backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
S3_PATH="s3://${AWS_S3_BUCKET}/backups/db/backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

echo "[BACKUP] Iniciando backup a las $(date)..."
mkdir -p $BACKUP_DIR

# Generar dump y comprimirlo directamente
echo "[BACKUP] Ejecutando pg_dump en el contenedor..."
docker exec dl_postgres pg_dump -U $POSTGRES_USER -d $POSTGRES_DB | gzip > $BACKUP_FILE

# Subir a AWS S3
echo "[BACKUP] Subiendo backup a S3: ${S3_PATH}..."
aws s3 cp $BACKUP_FILE $S3_PATH

# Eliminar archivo local temporal
rm -f $BACKUP_FILE
echo "[BACKUP] Backup subido exitosamente y limpiado del servidor local."
