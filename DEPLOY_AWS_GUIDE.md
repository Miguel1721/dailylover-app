# 🚀 Guía de Instalación Desde Cero en AWS / VPS — Daily Lover

Esta guía paso a paso te explica cómo montar la plataforma **Daily Lover desde cero en un servidor virgen de AWS (EC2 Ubuntu 22.04 / 24.04)** con una inversión mínima de **$20 a $30 USD / mes**, capaz de soportar a los **3,000 clientes de la base de datos** y picos de **1,000 usuarios activos simultáneos en eventos**.

---

## 💵 1. Servidor Recomendado & Costo Mínimo

Para no gastar $500/mes y mantener la arquitectura súper económica y potente en 1 sola máquina:

| Proveedor | Tipo de Servidor / Instancia | Especificaciones | Costo Aprox. Mensual |
|---|---|---|---|
| **AWS EC2 (Opción 1)** | `t4g.xlarge` (ARM Graviton3) | 4 vCPU, 16 GB RAM | **~$30 - $35 USD/mes** |
| **AWS EC2 (Opción 2)** | `t4g.large` (Ahorro máximo) | 2 vCPU, 8 GB RAM | **~$18 - $22 USD/mes** |
| **Hetzner / DigitalOcean (Alternativa)** | VPS CPX31 / Droplet 16GB | 4 vCPU, 16 GB RAM, 160 GB NVMe | **~$18 - $24 USD/mes** |

*Nota: Con 16 GB RAM y 4 vCPUs corriendo PostgreSQL, Redis y FastAPI en la misma máquina mediante Docker, el sistema atiende hasta 200 peticiones HTTP/segundo (1,000 usuarios interactuando en vivo sin parpadeos).*

---

## 📋 2. Requisitos Previos en la Instancia AWS

Al crear la instancia EC2 en AWS Console:
1. **Sistema Operativo**: Ubuntu 22.04 LTS o 24.04 LTS (x86_64 o ARM64/Graviton).
2. **Puertos Abiertos (Security Group)**:
   - `80` (HTTP)
   - `443` (HTTPS)
   - `8000` (API & Frontends)
   - `22` (Acceso SSH)
3. **Almacenamiento**: 30 GB o 50 GB SSD (gp3).

---

## ⚡ 3. Instalación con 1 Solo Comando (Modo Ultra Rápido)

Una vez conectado al servidor virgen por SSH:

```bash
# 1. Conectarte a tu servidor
ssh -i "tu_llave_aws.pem" ubuntu@TU_IP_AWS

# 2. Ejecutar el instalador automático de 1 solo paso:
curl -sSL https://raw.githubusercontent.com/Miguel1721/dailylover-app/main/scripts/setup_fresh_server.sh | bash
```

---

## 🛠️ 4. Paso a Paso Manual (Si prefieres ejecutar comando por comando)

Si deseas hacer la instalación paso a paso manualmente:

### Paso A: Actualizar Linux e Instalar Utilitarios
```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y git curl wget build-essential
```

### Paso B: Configurar Memoria Swap de 4GB (Evita bloqueos de RAM)
```bash
sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Paso C: Instalar Docker y Docker Compose
```bash
# Instalar Docker oficial
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

### Paso D: Clonar el Repositorio desde GitHub
```bash
cd /home/ubuntu
git clone https://github.com/Miguel1721/dailylover-app.git dailylover
cd dailylover
```

### Paso E: Crear Archivo de Entorno (.env)
```bash
cp .env.example .env
```

### Paso F: Levantar los Servicios en Docker
```bash
docker compose up -d --build
```

---

## 🌐 5. Verificar que Todo esté Funcionando

Ejecuta este comando para ver el estado de los contenedores:

```bash
docker compose ps
```

Deberías ver 4 servicios activos (`running`):
- `dl_postgres` (Base de datos PostgreSQL 16 con vector search)
- `dl_redis` (Caché de alta velocidad)
- `dl_api` (API FastAPI + Admin Panel + App PWA Cliente)
- `dl_worker` (Celery background worker para IA y notificaciones)

---

## 🔒 6. Configurar Dominio y Certificado SSL Gratis (HTTPS)

Para poner tu propio dominio (ej: `app.dailylover.com`) con SSL gratis de Let's Encrypt:

```bash
# 1. Instalar Nginx y Certbot en el servidor
sudo apt-get install -y nginx certbot python3-certbot-nginx

# 2. Configurar Nginx como proxy hacia Docker
sudo nano /etc/nginx/sites-available/dailylover
```

Pega esta configuración en Nginx:
```nginx
server {
    server_name app.dailylover.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activa el sitio y genera el certificado SSL con 1 comando:
```bash
sudo ln -s /etc/nginx/sites-available/dailylover /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.dailylover.com
```

¡Listo! Tu sitio quedará con `https://app.dailylover.com` 100% seguro.

---

## 🔄 7. Cómo Actualizar la App Cuando Hagas Cambios

Cada vez que hagas cambios en tu PC y hagas `git push` a GitHub, actualizas el servidor con:

```bash
cd /home/ubuntu/dailylover
git pull origin main
docker compose up -d --build api
```
