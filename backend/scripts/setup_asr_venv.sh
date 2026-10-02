#!/usr/bin/env bash
# Crea (o repara) el entorno aparte donde corre el cliente de voz de NVIDIA para transcribir videollamadas.
# Vive en backend/.venv_asr (carpeta montada en el contenedor, no se pierde al reiniciarlo). Uso: docker exec dl_api bash /app/scripts/setup_asr_venv.sh
set -e
VENV=/app/.venv_asr
if [ ! -x "$VENV/bin/python" ]; then
  python -m venv "$VENV"
fi
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q nvidia-riva-client imageio-ffmpeg numpy
"$VENV/bin/python" -c "import riva.client, imageio_ffmpeg, numpy; print('entorno de voz listo')"
