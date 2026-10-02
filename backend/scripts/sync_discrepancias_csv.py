"""Convierte las discrepancias de la sincronizacion de la hoja en CSV para revisar a mano.

Uso (dentro del contenedor): python /app/scripts/sync_discrepancias_csv.py
Lee /app/exports/sync_discrepancias.json y /app/exports/sync_fuzzy.json (los deja la sincronizacion diaria) y escribe:
  - sync_sin_enlazar.csv      : clientes de la hoja que no se encontraron en la base (son los que hay que revisar)
  - sync_sin_perfil_crm.csv   : usuarios sin perfil, los crea el CRM (solo informativo)
  - sync_coincidencias_fuzzy.csv : parejas enlazadas por parecido de nombre, para confirmar
"""
import csv
import json
import os

D = os.environ.get("SYNC_EXPORT_DIR", "/app/exports")


def cargar(nombre):
    ruta = os.path.join(D, nombre)
    if not os.path.exists(ruta):
        return []
    return json.load(open(ruta, encoding="utf-8"))


def escribir(nombre, filas, cols):
    with open(os.path.join(D, nombre), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in filas:
            w.writerow(r)
    print(f"{nombre}: {len(filas)} filas")


disc = cargar("sync_discrepancias.json")
sin_enlazar = sorted([r for r in disc if not str(r.get("reason", "")).startswith("usuario sin perfil")], key=lambda r: ((r.get("responsable") or "zzz"), r.get("name") or ""))
sin_perfil = [r for r in disc if str(r.get("reason", "")).startswith("usuario sin perfil")]
cols = ["responsable", "name", "client_code", "email", "city", "plan_tier", "reason"]
escribir("sync_sin_enlazar.csv", sin_enlazar, cols)
escribir("sync_sin_perfil_crm.csv", sin_perfil, cols)
fz = cargar("sync_fuzzy.json")
if fz:
    escribir("sync_coincidencias_fuzzy.csv", fz, sorted(set().union(*[set(x.keys()) for x in fz])))
