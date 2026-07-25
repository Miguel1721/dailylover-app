# 🚀 Guía de Despliegue en AWS — Daily Lover AI Platform

Esta guía describe los pasos para clonar y levantar la plataforma **Daily Lover** en un servidor nuevo de **AWS (EC2 Ubuntu 22.04 / 24.04 LTS)** usando **Docker Compose**.

---

## 📋 Requisitos Previos en AWS

1. **Instancia EC2 recomendada**: 
   - **Pruebas / Staging**: `t3.medium` (2 vCPU, 4 GB RAM)
   - **Producción (Hasta 5,000 usuarios activos)**: Ver la guía de escalabilidad [AWS_PERFORMANCE_5000_USERS.md](./AWS_PERFORMANCE_5000_USERS.md)
2. **Puertos de red (Security Group)**:
   - `80` (HTTP)
   - `443` (HTTPS)
   - `22` (SSH)
3. **Dominio apuntando al IP de la instancia EC2** (ej: `app.dailylover.com` o `prueba-daily.agentesia.cloud`)

---

## ⚡ Paso a Paso de Instalación en AWS (Menos de 5 Minutos)

### 1️⃣ Conectarse al Servidor por SSH

```bash
ssh -i "tu_llave_aws.pem" ubuntu@TU_IP_EXPRESSION_AWS
```

### 2️⃣ Instalar Docker y Git

Copiar y pegar este bloque en la consola de Ubuntu:

```bash
# Actualizar sistema e instalar utilidades
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y git curl ca-certificates gnupg

# Instalar Docker oficial
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Permitir ejecutar docker sin sudo
sudo usermod -aG docker $USER
newgrp docker
```

---

### 3️⃣ Clonar el Repositorio de GitHub

```bash
cd /home/ubuntu
git clone https://github.com/Miguel1721/dailylover-app.git dailylover
cd dailylover
```

---

### 4️⃣ Configurar las Variables de Entorno (`.env`)

Crea el archivo `.env` copiando la plantilla de ejemplo:

```bash
cp .env.example .env
nano .env
```

Define tus credenciales seguras (contraseñas de BD, JWT secret, etc.):

```env
POSTGRES_DB=dailylover
POSTGRES_USER=postgres
POSTGRES_PASSWORD=TuPasswordSuperSeguro2026!
DATABASE_URL=postgresql+asyncpg://postgres:TuPasswordSuperSeguro2026!@postgres:5432/dailylover

REDIS_PASSWORD=TuRedisPasswordSeguro2026!
REDIS_URL=redis://:TuRedisPasswordSeguro2026!@redis:6379/0

JWT_SECRET_KEY=GeneraUnSecretAleatorioSeguro32Caracteres
```

---

### 5️⃣ Construir y Levantar los Servicios

```bash
docker compose up -d --build
```

¡Listo! Docker descargará las imágenes, compilará la API y los frontends, ejecutará las migraciones e iniciará el sistema.

---

## 🔍 Verificación y Salud del Sistema

Para verificar que todos los contenedores estén funcionando:

```bash
# Ver estado de los servicios
docker compose ps

# Ver logs de la API en tiempo real
docker compose logs -f api

# Probar estado de salud de la API
curl http://localhost:8000/api/health
```

---

## 🌐 URLs de Acceso

- **Panel Admin Psicólogas**: `http://TU_IP/admin/`
- **Web App Cliente (PWA)**: `http://TU_IP/app-preview/`
- **Documentación API Swagger**: `http://TU_IP/docs`

---

## 🛠️ Actualizaciones Futuras (Deploy Continuo)

Cada vez que subas cambios a GitHub (`git push origin main`), solo necesitas correr esto en el servidor:

```bash
cd /home/ubuntu/dailylover
git pull origin main
docker compose up -d --build api
```

*(O puedes usar el workflow de GitHub Actions preconfigurado en `.github/workflows/deploy.yml` para despliegue automático 100% desatendido)*.
