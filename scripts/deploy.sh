#!/bin/bash
# scripts/deploy.sh — script de deploy continuo sin caída (zero downtime) para el servidor
set -e

echo "[DEPLOY] Iniciando deploy a las $(date)..."

# 1. Pull los cambios del repositorio git (si está configurado)
if [ -d .git ]; then
    echo "[DEPLOY] Actualizando repositorio git..."
    git pull origin main
fi

# 2. Reconstruir solo el contenedor de FastAPI
echo "[DEPLOY] Reconstruyendo servicio api..."
docker compose build api

# 3. Levantar el servicio actualizado sin afectar a la base de datos o redis
echo "[DEPLOY] Actualizando servicio api en docker compose..."
docker compose up -d --no-deps api

# 4. Correr migraciones de base de datos con Alembic si están presentes
# echo "[DEPLOY] Corriendo migraciones con Alembic..."
# docker compose exec api alembic upgrade head

# 5. Esperar un momento y verificar la salud de la API
echo "[DEPLOY] Verificando salud del servicio..."
sleep 5

# curl interno al puerto del contenedor
if curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "[DEPLOY] API está saludable! Despliegue completado exitosamente."
else
    echo "[DEPLOY] ERROR: La API no responde en http://localhost:8000/api/health. Por favor revisa los logs."
    exit 1
fi
