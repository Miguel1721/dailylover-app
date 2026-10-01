"""Pruebas del cálculo único. Ejecutar: python test_match_score.py"""
from match_score import unified_score, norm_city, WEIGHTS

# Casos basados en la prueba del 1-oct (fichas del CRM 4986, 4911 y 3213), sin datos de contacto.
# Estatura y preferencia de estatura de las candidatas son valores de ejemplo.
JUAN = dict(name="A-4986", genero="Hombre", genero_buscado="Mujer", edad=30, edad_min=25, edad_max=33, ciudad="BogotÁ",
            estatura_cm=179, deseo_hijos="Sí", deporte_nivel="Fitness Lover (4–6/semana)",
            valores=["Lealtad", "Ambición", "Honestidad"], estilo_apego="Mixto", lenguaje_amor="Actos de servicio",
            fumador="No", alcohol="Socialmente", rumba="Moderada", educacion="Maestría")
LORYS = dict(name="B-4911", genero="Mujer", genero_buscado="Hombre", edad=30, ciudad="Bogota", estatura_cm=165,
             estatura_min_cm=170, deseo_hijos="Sí", deporte_nivel="Constante (2–3/semana)", grupo_social=2,
             estilo_apego="Seguro", lenguaje_amor="Tiempo de calidad")
NATHALIA = dict(name="B-3213", genero="Mujer", genero_buscado="Hombre", edad=28, edad_min=28, edad_max=35, ciudad="Bogota",
                estatura_cm=161, estatura_min_cm=165, deseo_hijos="Tal vez", deporte_nivel="Fitness Lover (4–6/semana)",
                estilo_apego="Mixto", lenguaje_amor="Actos de servicio")


def check(cond, msg):
    assert cond, msg
    print("ok  ", msg)


assert sum(WEIGHTS.values()) == 100
for raw in ("Bogotá", "Bogota", "BogotÁ", "bogota", "Bogotá D.C.", "BOGOTA", "Bogotá, D.C.", "Bogota, Colina Campestre"):
    assert norm_city(raw) == "bogota", raw
print("ok   las 8 escrituras de Bogotá se reconocen como la misma ciudad")

r = unified_score(JUAN, LORYS)
print(f"     A-4986 × B-4911: {r['score']}% {r['veredicto']} (cobertura {r['cobertura_pct']}%), pendientes: {r['pendientes']}")
check(not any("Ciudades" in o for o in r["observaciones"]), "BogotÁ vs Bogota ya no es discrepancia")
check(r["score"] >= 75, "pareja sin discrepancias reales queda RECOMENDADO")

check(unified_score(JUAN, LORYS) == unified_score(JUAN, LORYS), "mismo dato -> mismo número")
check(unified_score(JUAN, LORYS)["score"] == unified_score(LORYS, JUAN)["score"], "el orden A/B no cambia el número")

r2 = unified_score(JUAN, NATHALIA)
print(f"     A-4986 × B-3213: {r2['score']}% {r2['veredicto']} (cobertura {r2['cobertura_pct']}%)")
check(not r2["discrepancias_fuertes"], "edades dentro de rango en ambas direcciones: sin aviso de 'edad fuera de rango'")
check(any("hijos" in o.lower() for o in r2["observaciones"]), "'Sí' vs 'Tal vez' queda como observación, no como bloqueo")

r3 = unified_score(JUAN, dict(LORYS, deseo_hijos="No"))
check(r3["score"] <= 60 and r3["discrepancias_fuertes"], "hijos Sí vs No topa el puntaje en 60")

r4 = unified_score(JUAN, dict(LORYS, genero="Hombre"))
check(r4["score"] == 0 and r4["veredicto"] == "NO RECOMENDADO", "género no buscado bloquea")

r5 = unified_score(dict(name="A", edad=30, ciudad="Cali"), dict(name="B", edad=31, ciudad="Cali"))
check(r5["veredicto"] == "DATOS INSUFICIENTES", "con pocos datos no se emite recomendación")

r6 = unified_score(JUAN, dict(LORYS, edad=40))
check(r6["discrepancias_fuertes"] and r6["score"] <= 60, "edad fuera de rango (más de 2 años) topa el puntaje")
print("\nTODAS LAS PRUEBAS PASARON")
