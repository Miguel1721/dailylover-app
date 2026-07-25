#!/bin/bash
# scripts/restore.sh — restaura un backup desde S3 al contenedor Postgres
# Uso: ./restore.sh 20260708_120000
set -e

TIMESTAMP=$1

# Cargar variables de entorno si existe el archivo .env
if [ -f ../.env ]; then
    export $(grep -v '^#' ../.env | xargs)
elif [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

if [ -z "$TIMESTAMP" ]; then
    echo "ERROR: Debes proporcionar un timestamp de backup como argumento. Ejemplo:"
    echo "       ./restore.sh 20260708_120000"
    exit 1
fi

S3_PATH="s3://${AWS_S3_BUCKET}/backups/db/backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
LOCAL_FILE="/tmp/restore_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

echo "[RESTORE] Descargando backup desde S3..."
aws s3 cp $S3_PATH $LOCAL_FILE

echo "[RESTORE] Importando datos a PostgreSQL..."
# Descomprimir y pasar por pipe a psql en el contenedor
gunzip -c $LOCAL_FILE | docker exec -i dl_postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

echo "[RESTORE] Limpiando archivos temporales..."
rm -f $LOCAL_FILE

echo "[RESTORE] Base de datos restaurada correctamente desde el backup ${TIMESTAMP}."
