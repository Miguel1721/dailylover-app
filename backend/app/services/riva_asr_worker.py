"""Transcribe una pista de audio con Canary (NVIDIA, servicio de voz Riva) y escribe en la salida un JSON con los segmentos.

Se ejecuta con el python del entorno aparte `.venv_asr` (el cliente de voz de NVIDIA trae dependencias que no se mezclan con las de la API).
Uso:  NVIDIA_ASR_KEY=... python riva_asr_worker.py <audio.webm|wav|mp3>
Salida (ultima linea): {"segmentos": [{"inicio": s, "fin": s, "texto": "..."}], "ventanas": n, "errores": k}

El audio se pasa a wav 16 kHz mono y se corta en ventanas de ~28 s, buscando el punto mas silencioso al final de cada ventana
para no partir palabras. Las ventanas casi sin sonido no se envian.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import wave

import numpy as np

FUNCTION_ID = os.environ.get("NVIDIA_ASR_FUNCTION_ID", "b702f636-f60c-4a3d-a6f4-f3568c13bd7d")   # whisper-large-v3
IDIOMA = os.environ.get("NVIDIA_ASR_LANG", "es-US")
VENTANA_S, BUSQUEDA_S = 28.0, 4.0
UMBRAL_SILENCIO = 20          # volumen medio (int16) por debajo del cual una ventana se considera silencio


def a_wav(entrada: str, salida: str) -> None:
    import imageio_ffmpeg
    r = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", entrada, "-ar", "16000", "-ac", "1", "-f", "wav", salida],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("ffmpeg: " + r.stderr[-200:])


def cortes(pcm: np.ndarray, sr: int):
    n, ventana, busq = len(pcm), int(VENTANA_S * sr), int(BUSQUEDA_S * sr)
    puntos, pos = [0], 0
    while n - pos > ventana:
        fin = pos + ventana
        zona = np.abs(pcm[fin - busq:fin].astype(np.float32))
        bloque = int(0.2 * sr)
        m = len(zona) // bloque
        energia = zona[:m * bloque].reshape(m, bloque).mean(axis=1)
        corte = fin - busq + int(np.argmin(energia)) * bloque + bloque // 2
        puntos.append(corte)
        pos = corte
    puntos.append(n)
    return puntos


def limites_voz(trozo: np.ndarray, sr: int):
    """Segundo donde empieza y donde termina la voz dentro del tramo (se recorta el silencio de los bordes)."""
    bloque = max(1, int(0.1 * sr))
    m = len(trozo) // bloque
    if m == 0:
        return 0.0, len(trozo) / sr
    e = np.abs(trozo[:m * bloque].astype(np.int32)).reshape(m, bloque).mean(axis=1)
    activos = np.where(e > UMBRAL_SILENCIO * 2)[0]
    if len(activos) == 0:
        return 0.0, len(trozo) / sr
    return float(activos[0] * bloque) / sr, float((activos[-1] + 1) * bloque) / sr


def segmentos_de(alt, desfase: float, t_ini: float, t_fin: float):
    """Parte el texto reconocido en frases (texto tal como lo devuelve Canary) y reparte el tiempo de la voz del tramo segun el largo de cada frase."""
    txt = alt.transcript.strip()
    if not txt:
        return []
    frases = [f.strip() for f in re.split(r"(?<=[.?!])\s+", txt) if f.strip()]
    unidas = []
    for f in frases:
        if unidas and len(f) < 12:          # un fragmento muy corto se une a la frase anterior
            unidas[-1] += " " + f
        else:
            unidas.append(f)
    total = sum(len(f) for f in unidas) or 1
    out, acum = [], 0
    for f in unidas:
        a = t_ini + (t_fin - t_ini) * acum / total
        acum += len(f)
        b = t_ini + (t_fin - t_ini) * acum / total
        out.append({"inicio": round(a + desfase, 1), "fin": round(b + desfase, 1), "texto": f})
    return out


def main(ruta: str) -> None:
    import riva.client
    key = os.environ["NVIDIA_ASR_KEY"]
    tmp = tempfile.mkdtemp()
    wav = os.path.join(tmp, "pista.wav")
    a_wav(ruta, wav)
    w = wave.open(wav, "rb")
    sr = w.getframerate()
    pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    w.close()
    auth = riva.client.Auth(use_ssl=True, uri="grpc.nvcf.nvidia.com:443",
                            metadata_args=[["function-id", FUNCTION_ID], ["authorization", "Bearer " + key]])
    asr = riva.client.ASRService(auth)
    cfg = riva.client.RecognitionConfig(language_code=IDIOMA, max_alternatives=1, enable_automatic_punctuation=True,   # sin tiempos por palabra: con ellos Canary deforma las palabras con ñ
                                        
                                        encoding=riva.client.AudioEncoding.LINEAR_PCM, sample_rate_hertz=sr, audio_channel_count=1)
    puntos = cortes(pcm, sr)
    segs, errores, ventanas = [], 0, 0
    for a, b in zip(puntos[:-1], puntos[1:]):
        trozo = pcm[a:b]
        if len(trozo) < sr // 2 or float(np.abs(trozo.astype(np.int32)).mean()) < UMBRAL_SILENCIO:
            continue
        ventanas += 1
        desfase = a / sr
        v_ini, v_fin = limites_voz(trozo, sr)
        listo = False
        for intento in range(4):
            try:
                resp = asr.offline_recognize(trozo.tobytes(), cfg)
                for res in resp.results:
                    if res.alternatives:
                        segs.extend(segmentos_de(res.alternatives[0], desfase, v_ini, v_fin))
                listo = True
                break
            except Exception:
                time.sleep(2 * (intento + 1))
        if not listo:
            errores += 1
            segs.append({"inicio": round(desfase, 1), "fin": round(b / sr, 1), "texto": "[sin transcribir]"})
    print(json.dumps({"segmentos": segs, "ventanas": ventanas, "errores": errores}, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1])
