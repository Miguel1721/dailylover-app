import json

import os
path = "/app/ronda7_mega_estres_500.json" if os.path.exists("/app/ronda7_mega_estres_500.json") else "backend/ronda7_mega_estres_500.json"
with open(path, encoding="utf-8") as f:
    data = json.load(f)

for e in data["evaluations"]:
    c_a = (e["anchor_city"] or "").strip().lower()
    c_c = (e["cand_city"] or "").strip().lower()
    if c_a != c_c and e["desglose"]["1_logistica"] >= 85:
        print(f"Anchor: {e['anchor_name']} ({e['anchor_city']}) x Cand: {e['cand_name']} ({e['cand_city']})")
        print(f"  Logistica: {e['desglose']['1_logistica']}% | Sinergias: {e['sinergias_fuertes']}")
        print(f"  Fricciones: {e['puntos_friccion']}")
        print()
