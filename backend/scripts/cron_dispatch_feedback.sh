#!/usr/bin/env bash
# ==============================================================================
# Daily Lover - Despacho Automático de Correos de Feedback Post-Cita
# Ejecución diaria: Mañana hora Colombia (08:30 COT / 13:30 UTC)
# Modo Seguro: Envía a agente.sti.col@gmail.com con datos configurados del cliente
# ==============================================================================

set -uo pipefail

LOG_DIR="/home/ubuntu/dailylover/logs"
LOG_FILE="${LOG_DIR}/feedback_dispatch.log"
mkdir -p "${LOG_DIR}"

log() {
    local LEVEL="$1"
    local MSG="$2"
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [${LEVEL}] ${MSG}" | tee -a "${LOG_FILE}"
}

log "INFO" "======================================================================"
log "INFO" "INICIANDO DESPACHO AUTOMATIZADO DE FEEDBACK POST-CITA (MODO SEGURO)"
log "INFO" "======================================================================"

RESPONSE=$(docker exec dl_api curl -s -X POST "http://localhost:8000/api/v1/matchmaking/calendar/feedback/dispatch-automated?simulation_mode=true")

log "INFO" "Respuesta del despachador: ${RESPONSE}"

log "INFO" "======================================================================"
log "INFO" "DESPACHO FINALIZADO"
log "INFO" "======================================================================"
