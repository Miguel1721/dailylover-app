#!/bin/bash
# =================================================================─────────────
# 🚀 Daily Lover — Script de Instalación desde Cero en Servidor AWS / VPS
# Configura un servidor Linux Ubuntu 22.04 / 24.04 virgen desde Cero.
# Uso: bash setup_fresh_server.sh
# =================================================================─────────────

set -e

echo "═══════════════════════════════════════════════════════════════"
echo " 🚀 Daily Lover — Instalación de Servidor desde Cero "
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. Actualizar paquetes del sistema
echo "📦 [1/6] Actualizando paquetes del sistema Linux..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y git curl wget ca-certificates gnupg ufw htop net-tools

# 2. Configurar memoria Swap (Evita caídas de memoria RAM en picos de eventos)
if [ ! -f /swapfile ]; then
    echo "⚡ [2/6] Creando 4 GB de memoria Swap de respaldo..."
    sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf
    sudo sysctl -p
    echo "✅ Swap de 4GB activada."
else
    echo "✅ Memoria Swap ya configurada."
fi

# 3. Instalar Docker y Docker Compose
echo "🐳 [3/6] Instalando Docker y Docker Compose..."
if ! command -v docker &> /dev/null; then
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "✅ Docker instalado exitosamente."
else
    echo "✅ Docker ya está instalado."
fi

# 4. Clonar Repositorio si no existe en el directorio actual
echo "📥 [4/6] Verificando código fuente del proyecto..."
if [ ! -f "docker-compose.yml" ]; then
    echo "Clonando repositorio GitHub Daily Lover..."
    cd /home/ubuntu
    git clone https://github.com/Miguel1721/dailylover-app.git dailylover
    cd dailylover
fi

# 5. Crear .env si no existe
echo "⚙️ [5/6] Configurando variables de entorno (.env)..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "⚠️ Se creó el archivo .env desde .env.example."
        echo "👉 IMPORTANTE: Revisa las contraseñas en .env si deseas cambiarlas."
    else
        cat << 'EOF' > .env
POSTGRES_DB=dailylover
POSTGRES_USER=postgres
POSTGRES_PASSWORD=DailyPasswordSeguro2026!
DATABASE_URL=postgresql+asyncpg://postgres:DailyPasswordSeguro2026!@postgres:5432/dailylover

REDIS_PASSWORD=DailyRedisPassword2026!
REDIS_URL=redis://:DailyRedisPassword2026!@redis:6379/0

JWT_SECRET_KEY=e8f9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1
DEMO_MODE=false
EOF
        echo "✅ Archivo .env básico creado."
    fi
fi

# 6. Levantar todo el stack con Docker Compose
echo "🚀 [6/6] Compilando e iniciando servicios en Docker (PostgreSQL + Redis + FastAPI API + Celery)..."
sudo docker compose up -d --build

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " 🎉 ¡INSTALACIÓN COMPLETADA EXITOSAMENTE!"
echo "═══════════════════════════════════════════════════════════════"
echo "  🌐 Panel Admin:      http://localhost:8000/admin/"
echo "  📱 App Cliente PWA:  http://localhost:8000/app-preview/"
echo "  🔍 API Health Check: http://localhost:8000/api/health"
echo "═══════════════════════════════════════════════════════════════"
