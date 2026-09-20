#!/usr/bin/env bash
# ==============================================================================
# 📦 Daily Lover — Script de Exportación Completa para Migración a AWS
# Genera un paquete todo-en-uno que incluye:
# 1. Base de datos PostgreSQL completa con pgvector, perfiles, notas y matches.
# 2. Carpeta completa de fotos e imágenes de clientes (uploads).
# 3. Archivos de configuración y docker-compose.standalone.yml.
# ==============================================================================

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
MIGRATION_DIR="/tmp/dailylover_export_${TIMESTAMP}"
BUNDLE_NAME="dailylover_migration_${TIMESTAMP}.tar.gz"
OUTPUT_PATH="/home/ubuntu/${BUNDLE_NAME}"

echo "═══════════════════════════════════════════════════════════════"
echo " 🚀 INICIANDO EXPORTACIÓN PARA MIGRACIÓN A AWS: ${TIMESTAMP}"
echo "═══════════════════════════════════════════════════════════════"

mkdir -p "${MIGRATION_DIR}/db"
mkdir -p "${MIGRATION_DIR}/uploads"

# 1. Cargar variables de entorno
if [ -f "/home/ubuntu/dailylover/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source /home/ubuntu/dailylover/.env
    set +a
fi

DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-dailylover}"

# 2. Volcado integral de PostgreSQL con pgvector
echo "1. Exportando base de datos PostgreSQL ($DB_NAME)..."
docker exec dl_postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges | gzip > "${MIGRATION_DIR}/db/database.sql.gz"
echo "   ✅ Dump generado: $(du -h "${MIGRATION_DIR}/db/database.sql.gz" | cut -f1)"

# 3. Copia de imágenes de clientes
echo "2. Empacando galería de medios y fotos de clientes..."
if [ -d "/home/ubuntu/dailylover/backend/app/static/uploads" ]; then
    tar -czf "${MIGRATION_DIR}/uploads/uploads.tar.gz" -C /home/ubuntu/dailylover/backend/app/static uploads 2>/dev/null || true
    echo "   ✅ Medios empacados: $(du -h "${MIGRATION_DIR}/uploads/uploads.tar.gz" | cut -f1)"
else
    echo "   ⚠️ Directorio de uploads local no encontrado, extrayendo de volumen Docker..."
    docker run --rm -v dl_uploads:/src -v "${MIGRATION_DIR}/uploads:/dst" alpine tar -czf /dst/uploads.tar.gz -C /src .
fi

# 4. Incluir archivo de variables de entorno (sanitizado o de producción)
echo "3. Copiando configuraciones y Compose..."
cp /home/ubuntu/dailylover/docker-compose.standalone.yml "${MIGRATION_DIR}/docker-compose.yml"
if [ -f "/home/ubuntu/dailylover/.env" ]; then
    cp /home/ubuntu/dailylover/.env "${MIGRATION_DIR}/.env"
fi

# 5. Comprimir todo en un paquete único
echo "4. Comprimiendo paquete maestro de migración..."
tar -czf "$OUTPUT_PATH" -C /tmp "dailylover_export_${TIMESTAMP}"
rm -rf "$MIGRATION_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo " 🎉 PAQUETE DE MIGRACIÓN GENERADO CON ÉXITO:"
echo "    Ruta: $OUTPUT_PATH"
echo "    Tamaño: $(du -h "$OUTPUT_PATH" | cut -f1)"
echo ""
echo " 📋 COMANDO PARA TRANSFERIR A LA NUEVA INSTANCIA AWS:"
echo "    scp -i tu_llave_aws.pem $OUTPUT_PATH ubuntu@<IP_PUBLICA_AWS>:/home/ubuntu/"
echo "═══════════════════════════════════════════════════════════════"
