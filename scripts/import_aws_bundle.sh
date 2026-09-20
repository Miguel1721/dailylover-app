#!/usr/bin/env bash
# ==============================================================================
# 📥 Daily Lover — Script de Importación y Restauración en AWS (Servidor de María)
# Se ejecuta en el nuevo servidor AWS para desplegar la plataforma completa.
# Uso:
#   chmod +x import_aws_bundle.sh
#   ./import_aws_bundle.sh dailylover_migration_YYYYMMDD_HHMMSS.tar.gz
# ==============================================================================

set -euo pipefail

BUNDLE_FILE="${1:-}"

if [ -z "$BUNDLE_FILE" ] || [ ! -f "$BUNDLE_FILE" ]; then
    echo "❌ ERROR: Debe indicar el archivo comprimido del paquete de migración."
    echo "Uso: ./import_aws_bundle.sh dailylover_migration_XXXXXXXX.tar.gz"
    exit 1
fi

DEST_DIR="/home/ubuntu/dailylover"
EXTRACT_DIR="/tmp/dailylover_import_tmp"

echo "═══════════════════════════════════════════════════════════════"
echo " 🚀 INICIANDO RESTAURACIÓN EN AWS: $(date)"
echo "═══════════════════════════════════════════════════════════════"

# 1. Asegurar dependencias del sistema operativo
echo "1. Verificando Docker y Docker Compose..."
if ! command -v docker &> /dev/null; then
    echo "   Instalando Docker Engine oficial..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh
    sudo usermod -aG docker "$USER"
fi

# 2. Descomprimir el paquete
echo "2. Descomprimiendo paquete de migración..."
rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"
tar -xzf "$BUNDLE_FILE" -C "$EXTRACT_DIR"

EXPORT_FOLDER=$(find "$EXTRACT_DIR" -maxdepth 1 -type d -name "dailylover_export_*" | head -n 1)

mkdir -p "$DEST_DIR"
cp "$EXPORT_FOLDER/docker-compose.yml" "$DEST_DIR/docker-compose.yml"
if [ -f "$EXPORT_FOLDER/.env" ]; then
    cp "$EXPORT_FOLDER/.env" "$DEST_DIR/.env"
fi

cd "$DEST_DIR"

# 3. Descargar repositorio de código si no existe
if [ ! -d "$DEST_DIR/backend" ]; then
    echo "3. Clonando código del repositorio GitHub..."
    git clone https://github.com/Miguel1721/dailylover-app.git /tmp/dl_repo
    cp -r /tmp/dl_repo/backend "$DEST_DIR/backend"
    cp -r /tmp/dl_repo/db "$DEST_DIR/db"
    rm -rf /tmp/dl_repo
fi

# 4. Levantar PostgreSQL y esperar a que esté saludable
echo "4. Levantando base de datos PostgreSQL con pgvector..."
docker compose up -d postgres redis
echo "   Esperando a que la base de datos esté lista para recibir conexiones..."
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U postgres &>/dev/null; then
        echo "   ✅ PostgreSQL listo!"
        break
    fi
    sleep 2
done

# 5. Restaurar el dump de base de datos
SQL_GZ=$(find "$EXPORT_FOLDER/db" -name "*.sql.gz" | head -n 1)
if [ -f "$SQL_GZ" ]; then
    echo "5. Restaurando base de datos completa (${SQL_GZ})..."
    gunzip -c "$SQL_GZ" | docker compose exec -T postgres psql -U postgres -d dailylover
    echo "   ✅ Base de datos restaurada con éxito."
else
    echo "   ⚠️ No se encontró archivo .sql.gz de base de datos."
fi

# 6. Restaurar fotos e imágenes de clientes
UPLOADS_TAR=$(find "$EXPORT_FOLDER/uploads" -name "uploads.tar.gz" | head -n 1)
if [ -f "$UPLOADS_TAR" ]; then
    echo "6. Restaurando galería de medios y fotos de clientes..."
    mkdir -p "$DEST_DIR/backend/app/static"
    tar -xzf "$UPLOADS_TAR" -C "$DEST_DIR/backend/app/static"
    echo "   ✅ Fotos restauradas."
fi

# 7. Levantar todos los servicios
echo "7. Levantando todos los servicios en segundo plano..."
docker compose up -d --build

# 8. Limpieza de archivos temporales
rm -rf "$EXTRACT_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo " 🎉 MIGRACIÓN A AWS COMPLETADA CON ÉXITO"
echo "    Estado de contenedores:"
docker compose ps
echo "═══════════════════════════════════════════════════════════════"
