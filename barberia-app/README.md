# BarberPro — Sistema de Gestión para Barbería

Sistema web completo para gestión de barbería. Stack: **Next.js 14 + PostgreSQL 15 + Docker**.

---

## 🚀 Despliegue rápido en servidor 157.137.232.7

### 1. Conectar al servidor
```bash
ssh -i llave_server_149 ubuntu@157.137.232.7
```

### 2. Crear directorio del proyecto
```bash
mkdir -p /home/ubuntu/PRODUCCION/barberia
```

### 3. Copiar archivos (desde tu máquina local)
```bash
# Desde la carpeta del proyecto en tu PC:
scp -i "i:\Mi unidad\Proyectos_Miguel\Servidor_saas_restaurante\llave_server_149" -r . ubuntu@157.137.232.7:/home/ubuntu/PRODUCCION/barberia/
```

O usar rsync (más eficiente si ya existe):
```bash
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.env' \
  -e "ssh -i 'i:\Mi unidad\Proyectos_Miguel\Servidor_saas_restaurante\llave_server_149'" \
  . ubuntu@157.137.232.7:/home/ubuntu/PRODUCCION/barberia/
```

### 4. Configurar variables de entorno en el servidor
```bash
# En el servidor:
cd /home/ubuntu/PRODUCCION/barberia
cp .env.example .env
nano .env
```

Edita el `.env` con valores reales:
```env
POSTGRES_PASSWORD=TuPasswordSeguro123!
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://157.137.232.7:3500
ADMIN_EMAIL=admin@barberia.com
ADMIN_PASSWORD=TuPasswordAdmin!
```

### 5. Levantar la aplicación
```bash
cd /home/ubuntu/PRODUCCION/barberia
docker-compose up -d --build
```

Esto ejecuta automáticamente:
- Levanta PostgreSQL
- Corre las migraciones de base de datos
- Carga los datos iniciales (6 barberos, servicios, productos)
- Levanta la app Next.js en el puerto **3500**

### 6. Verificar que funciona
```bash
curl http://localhost:3500/api/health
# Respuesta esperada: {"status":"ok","service":"barberia-app",...}
```

**Acceso:** `http://157.137.232.7:3500`  
**Login:** `admin@barberia.com` / `Admin123!`

---

## 🌐 Cuando tengas el dominio (mañana)

Solo edita el `docker-compose.yml` en el servidor, cambia las líneas de Traefik:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.docker.network=frontend_net"
  - "traefik.http.routers.barberia.rule=Host(`barberia.tudominio.com`)"
  - "traefik.http.routers.barberia.entrypoints=websecure"
  - "traefik.http.routers.barberia.tls.certresolver=myresolver"
  - "traefik.http.services.barberia.loadbalancer.server.port=3500"
```

Y elimina la línea `ports: - "3500:3500"` (Traefik manejará el acceso).  
Luego: `docker-compose up -d` (sin rebuild, solo reconfigura).

---

## 🐳 Comandos de gestión

```bash
# Ver logs en tiempo real
docker logs barberia-app -f

# Ver logs de la BD
docker logs barberia-db -f

# Reiniciar la app
docker-compose restart barberia-app

# Actualizar la app (después de un nuevo deploy)
docker-compose up -d --build barberia-app

# Detener todo
docker-compose down

# Detener y borrar datos (¡CUIDADO!)
docker-compose down -v
```

---

## 📦 Módulos del sistema

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Dashboard | `/dashboard` | KPIs del día, citas, ingresos |
| Agendamiento | `/appointments` | Calendario por barbero, crear citas |
| Punto de Venta | `/pos` | Cobrar servicios y productos |
| Inventario | `/inventory` | Productos, stock, movimientos |
| Comisiones | `/commissions` | 60% sobre servicios por barbero |
| Finanzas | `/finance` | Ingresos, gastos, utilidad neta |
| Barberos | `/barbers` | Gestión del equipo y horarios |

---

## 🔑 Credenciales iniciales

- **Email:** `admin@barberia.com` (o el que pongas en `.env`)
- **Password:** `Admin123!` (o el que pongas en `.env`)

---

## 🛠️ Estructura del proyecto

```
barberia-app/
├── docker-compose.yml     ← Orquestación completa
├── Dockerfile             ← Build de Next.js
├── Dockerfile.migrate     ← Solo migraciones + seed
├── prisma/
│   ├── schema.prisma      ← Esquema de BD
│   ├── seed.js            ← Datos iniciales
│   └── migrations/        ← Migraciones SQL
└── src/
    ├── app/
    │   ├── (app)/         ← Páginas autenticadas
    │   │   ├── dashboard/
    │   │   ├── appointments/
    │   │   ├── pos/
    │   │   ├── inventory/
    │   │   ├── commissions/
    │   │   ├── finance/
    │   │   └── barbers/
    │   ├── api/           ← API Routes (REST)
    │   │   ├── barbers/
    │   │   ├── appointments/
    │   │   ├── sales/
    │   │   ├── services/
    │   │   ├── inventory/
    │   │   ├── commissions/
    │   │   ├── expenses/
    │   │   └── finance/
    │   └── login/         ← Página de login
    ├── components/
    │   └── AppLayout.js   ← Sidebar + navegación
    └── lib/
        └── prisma.js      ← Cliente de BD
```
