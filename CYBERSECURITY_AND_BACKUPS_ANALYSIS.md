# 🛡️ Análisis de Ciberseguridad, Protección de Datos & Sistema de Respaldos (Matchmaking SaaS)

**Proyecto:** Daily Lover  
**Naturaleza del Negocio:** Plataforma de Matchmaking, Citas y Eventos con información clínica, fotos, orientación sexual, preferencias íntimas y notas de psicólogas.

---

## 💾 1. Sistema de Respaldos (Backups Automáticos & Disaster Recovery)

### A. Estrategia de Respaldos Duales (`scripts/backup.sh`)
El sistema ejecuta un respaldo automático diario de dos elementos críticos:
1. **Base de Datos PostgreSQL**: Dump estructurado `.sql.gz` con usuarios, perfiles, cuestionarios, notas psicólogas e historial de matches.
2. **Galería de Fotos de Clientes**: Archivo `.tar.gz` con todas las imágenes WebP optimizadas.

### B. Configuración de Tarea Programada (Cron Job en Linux)
Para activar respaldos automáticos todos los días a las **2:00 AM** en el servidor de producción:

```bash
# Editar crontab del servidor
crontab -e

# Agregar esta línea (Ejecuta el backup todas las noches a las 2:00 AM)
0 2 * * * /bin/bash /home/ubuntu/dailylover/scripts/backup.sh >> /var/log/dailylover_backup.log 2>&1
```

### C. Política de Rotación & Retención (Disaster Recovery)
- **Copia Local**: Se conservan **14 días de respaldos** en `/var/backups/dailylover/`. Los archivos más antiguos se eliminan automáticamente para no llenar el disco.
- **Copia Remota en Nube (Opcional AWS S3)**: Si se definen credenciales en `.env`, el script sube automáticamente los archivos a un bucket S3 privado con cifrado AES-256.

### D. Procedimiento de Restauración de Emergencia (1 Comando)
En caso de fallo catastrófico del servidor, la base de datos se restaura con:

```bash
# Restaurar la última copia de seguridad local
gunzip -c /var/backups/dailylover/dailylover_ULTIMA_FECHA.sql.gz | docker exec -i dl_postgres psql -U postgres -d dailylover
```

---

## 🔍 2. Análisis de Riesgos de Ciberseguridad para un Negocio de Matchmaking

Un SaaS de citas maneja la **información más sensible de una persona** (preferencias sexuales, fotos privadas, estilo de vida, ingresos, comentarios psicológicos). A continuación se detallan las protecciones necesarias y su estado de implementación:

| Amenaza / Riesgo | Consecuencia si no se protege | Medida de Protección Recomendada / Implementada | Estado |
|---|---|---|---|
| **1. Scraping / Cosecha Masiva de Fotos y Teléfonos** | Competidores o acosadores descargan el catálogo de clientes | **Rate Limiting** (máximo 10 peticiones/min en autenticación) + Hotlink Protection en Nginx. | ✅ Implementado |
| **2. Filtración de Notas Clínicas de Psicólogas** | Daño reputacional severo por comentarios privados expuestos | **Control de Acceso Basado en Roles (RBAC)**. Los clientes NUNCA tienen acceso al campo `observations` de la psicóloga. | ✅ Implementado |
| **3. Rastreo GPS de Usuarias vía Fotos** | Acoso físico localizando dónde se tomó la foto | **Stripping Automático de Metadatos EXIF** (Pillow elimina coordenadas GPS al subir foto). | ✅ Implementado |
| **4. Inyección SQL (SQLi) & Extracción de BD** | Robo de la base de datos completa | **Consultas Parametrizadas Asyncpg/SQLAlchemy**. Imposibilita inyección de código SQL. | ✅ Implementado |
| **5. Acceso de Ex-Empleados / Psicólogas Despedidas** | Psicóloga despedida sigue ingresando a ver clientes | **Invalidación Inmediata de Tokens JWT** al cambiar contraseña o deshabilitar usuario. | ✅ Implementado |
| **6. Derecho al Olvido (Habeas Data / Ley 1581)** | Sanciones legales de la SIC por no eliminar datos cuando el cliente lo pide | **Endpoint de Borrado Seguro / Anonimización** (`DELETE /api/v1/client/delete-account`). | 🟡 Recomendado |
| **7. Suplantación en Eventos mediante QR** | Personas registrándose con datos o nombres falsos | **Verificación de WhatsApp OTP / Código SMS** al crear la cuenta en el evento. | 🟡 Recomendado (Fase 2) |

---

## 🛡️ 3. Recomendaciones Adicionales de Seguridad Recomendadas para Fase 2

1. **Endpoint de Eliminación de Cuenta (Cumplimiento Legal SIC / ARCO)**:
   Ofrecer en la PWA el botón *"Eliminar mi perfil y fotos permanentemente"* para cumplir estrictamente con la Ley 1581 de Habeas Data de Colombia.
2. **Detección de Intentos de Login Sospechosos**:
   Notificar al usuario por WhatsApp si se detecta un inicio de sesión desde un nuevo dispositivo o ciudad.
3. **Firmado de URLs de Fotos (Private S3 Bucket)**:
   Servir las fotos a través de URLs firmadas con expiración (ej: URL válida por 15 minutos) para que nadie pueda adivinar o compartir links directos de imágenes de otros clientes.
