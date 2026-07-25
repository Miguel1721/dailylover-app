#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Script de despliegue para Barbería App en 157.137.232.7
# Uso: bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

SERVER="ubuntu@157.137.232.7"
KEY="/c/Users/jeloz/.ssh/llave_server_149"
REMOTE_DIR="/home/ubuntu/PRODUCCION/barberia"
TEMP_TAR="barberia_deploy.tar.gz"

echo "🚀 Iniciando deploy de Barbería App..."
echo "📡 Servidor: $SERVER"
echo "📁 Destino: $REMOTE_DIR"
echo ""

# 1. Crear tarball local excluyendo node_modules, .next y .git
echo "📦 Empaquetando código fuente..."
tar -czf "$TEMP_TAR" --exclude='node_modules' --exclude='.next' --exclude='.git' .

# 2. Crear directorio remoto si no existe
echo "📁 Asegurando directorio remoto..."
ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" "mkdir -p $REMOTE_DIR"

# 3. Subir el archivo empaquetado
echo "📤 Subiendo paquete al servidor VPS..."
scp -i "$KEY" -o StrictHostKeyChecking=no "$TEMP_TAR" "$SERVER:$REMOTE_DIR/"

# 4. Desempaquetar y reconstruir en el servidor remoto
echo "🐳 Desempaquetando y reconstruyendo contenedores Docker..."
ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" "
  cd $REMOTE_DIR
  tar -xzf $TEMP_TAR
  rm -f $TEMP_TAR
  docker compose down 2>/dev/null || true
  docker compose up -d --build
"

# 5. Limpieza local
rm -f "$TEMP_TAR"

echo ""
echo "✅ Deploy completado exitosamente!"
echo "🌐 App disponible en: https://barberclub.com.co"
