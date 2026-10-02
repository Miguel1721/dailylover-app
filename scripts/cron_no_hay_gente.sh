#!/bin/bash
# Revision diaria de slots en "No hay gente": busca candidatas nuevas con el motor
docker exec -w /app -e PYTHONPATH=/app dl_api python /app/scripts/cron_no_hay_gente.py
