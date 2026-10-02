#!/usr/bin/env bash
# ==============================================================================
# Daily Lover - Tarea Diaria de Sincronización Automática (Google Sheet -> PostgreSQL)
# Etapa 3: Madrugada hora Colombia (04:30 COT / 09:30 UTC)
#
# Flujo:
# 1. Realiza Backup Previo Comprimido de PostgreSQL en /home/ubuntu/backups/
# 2. Valida la integridad del Backup (tamaño > 1 MB) antes de procesar cambios
# 3. Ejecuta sync_full_production_sheet.py dentro del contenedor dl_api (STRICT READ-ONLY)
# 4. Actualiza /home/ubuntu/dailylover/backend/sync_sheet_status.json
# 5. Registra bitácora estructurada en /home/ubuntu/dailylover/logs/sheet_sync.log
# ==============================================================================

set -uo pipefail

DATE_STR=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ubuntu/backups"
LOG_DIR="/home/ubuntu/dailylover/logs"
LOG_FILE="${LOG_DIR}/sheet_sync.log"
BACKUP_FILE="${BACKUP_DIR}/dailylover_pre_sheet_sync_${DATE_STR}.sql.gz"

mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"

log() {
    local LEVEL="$1"
    local MSG="$2"
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [${LEVEL}] ${MSG}" | tee -a "${LOG_FILE}"
}

log "INFO" "======================================================================"
log "INFO" "INICIANDO TAREA DIARIA DE SINCRONIZACIÓN AUTOMÁTICA"
log "INFO" "======================================================================"

# 1. Crear Backup Previo Obligatorio
log "INFO" "Paso 1: Generando backup comprimido de PostgreSQL..."
log "INFO" "Archivo destino: ${BACKUP_FILE}"

if ! docker exec dl_postgres pg_dump -U postgres -d dailylover | gzip > "${BACKUP_FILE}"; then
    log "ERROR" "FALLO CRÍTICO al generar el dump de PostgreSQL. Sincronización abortada."
    exit 1
fi

# 2. Validar tamaño del backup (> 1MB)
if [ ! -f "${BACKUP_FILE}" ]; then
    log "ERROR" "El archivo de backup no existe tras la exportación. Sincronización abortada."
    exit 1
fi

BACKUP_SIZE=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null || echo 0)
log "INFO" "Tamaño del backup generado: ${BACKUP_SIZE} bytes"

if [ "${BACKUP_SIZE}" -lt 1048576 ]; then
    log "ERROR" "El backup generado es sospechosamente pequeño (< 1 MB). Abortando por seguridad."
    exit 1
fi
log "INFO" "Backup validado exitosamente. Integridad confirmada."

# 3. Ejecutar sincronización dentro del contenedor dl_api
log "INFO" "Paso 2: Ejecutando sync_full_production_sheet.py en contenedor dl_api..."
if docker exec -e PRE_SYNC_BACKUP_FILE="${BACKUP_FILE}" dl_api python /app/scripts/sync_full_production_sheet.py --discrepancies-out /app/exports/sync_discrepancias.json --fuzzy-out /app/exports/sync_fuzzy.json >> "${LOG_FILE}" 2>&1; then
    docker exec dl_api python /app/scripts/sync_discrepancias_csv.py >> "${LOG_FILE}" 2>&1 || log "WARN" "No se pudo generar el CSV de discrepancias."
    log "INFO" "Sincronización completada exitosamente."
else
    SYNC_EXIT=$?
    log "ERROR" "sync_full_production_sheet.py terminó con error (exit code: ${SYNC_EXIT})."
    exit ${SYNC_EXIT}
fi

# 4. Rotación preventiva de backups antiguos (conservar últimos 30 días de pre-sync)
find "${BACKUP_DIR}" -name "dailylover_pre_sheet_sync_*.sql.gz" -type f -mtime +30 -delete 2>/dev/null || true

log "INFO" "======================================================================"
log "INFO" "TAREA DIARIA DE SINCRONIZACIÓN FINALIZADA CON ÉXITO"
log "INFO" "======================================================================"
exit 0
