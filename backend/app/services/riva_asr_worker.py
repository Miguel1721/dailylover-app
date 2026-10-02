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

FUNCTION_ID = os.environ.get("NVIDIA_ASR_FUNCTION_ID", "b0e8b4a5-217c-40b7-9b96-17d84e666317")   # canary-1b-asr
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


def segmentos_de(alt, desfase: float, fin_ventana: float):
    """Parte el texto reconocido en frases (con el texto tal como lo devuelve Canary) y reparte los tiempos de la ventana segun el largo de cada frase."""
    txt = alt.transcript.strip()
    if not txt:
        return []
    palabras = list(alt.words)
    t_ini = palabras[0].start_time / 1000.0 if palabras else 0.0
    t_fin = palabras[-1].end_time / 1000.0 if palabras else max(0.0, fin_ventana - desfase)
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
    cfg = riva.client.RecognitionConfig(language_code=IDIOMA, max_alternatives=1, enable_automatic_punctuation=True, enable_word_time_offsets=True,
                                        encoding=riva.client.AudioEncoding.LINEAR_PCM, sample_rate_hertz=sr, audio_channel_count=1)
    puntos = cortes(pcm, sr)
    segs, errores, ventanas = [], 0, 0
    for a, b in zip(puntos[:-1], puntos[1:]):
        trozo = pcm[a:b]
        if len(trozo) < sr // 2 or float(np.abs(trozo.astype(np.int32)).mean()) < UMBRAL_SILENCIO:
            continue
        ventanas += 1
        desfase = a / sr
        listo = False
        for intento in range(4):
            try:
                resp = asr.offline_recognize(trozo.tobytes(), cfg)
                for res in resp.results:
                    if res.alternatives:
                        segs.extend(segmentos_de(res.alternatives[0], desfase, b / sr))
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
