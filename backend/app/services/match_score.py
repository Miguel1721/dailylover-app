"""Cálculo ÚNICO de compatibilidad Daily Lover (propuesta, 1-oct-2026).

Una sola función, `unified_score(a, b)`, para las tres pantallas (Buscar con IA, Análisis de Match,
Persona B pegada por URL). Es determinística: mismos datos -> mismo número. La IA solo redacta la
explicación; nunca cambia el número.

Entrada: dos diccionarios planos con datos YA verificados del CRM (ver `FIELDS`). Dato ausente = None.
Salida: score 0-100, veredicto, cobertura, bloqueos, detalle por dimensión y pendientes.
"""
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

# Pesos por dimensión (suman 100). Ajustables por María/Jorge sin tocar el resto.
WEIGHTS = {
    "edad": 15, "hijos": 15, "ciudad": 10, "actividad_fisica": 10, "valores": 10, "grupo_social": 10,
    "estatura": 8, "apego": 8, "lenguaje_amor": 5, "habitos": 5, "educacion": 4,
}
MIN_COVERAGE = 50      # % de peso evaluable por debajo del cual el veredicto es "DATOS INSUFICIENTES"
CAP_STRONG = 60        # tope del score si hay una discrepancia fuerte (p. ej. hijos Sí vs No)

FIELDS = ("name", "genero", "genero_buscado", "edad", "edad_min", "edad_max", "ciudad", "estatura_cm",
          "estatura_min_cm", "estatura_max_cm", "deseo_hijos", "deporte_nivel", "valores", "grupo_social",
          "estilo_apego", "lenguaje_amor", "fumador", "alcohol", "rumba", "educacion")


def _n(s: Any) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", " ", s).strip()


def norm_city(c: Any) -> Optional[str]:
    """'BogotÁ', 'Bogota', 'Bogotá D.C.', 'Bogota, Colina Campestre' -> 'bogota'."""
    t = _n(str(c or "").split(",")[0])
    t = re.sub(r"\b(d c|dc|distrito capital)\b", "", t).strip()
    return t or None


def _gender(g: Any) -> Optional[str]:
    t = _n(g)
    if t in ("hombre", "male", "masculino", "m"): return "hombre"
    if t in ("mujer", "female", "femenino", "f"): return "mujer"
    return None


def _wanted(g: Any) -> set:
    items = g if isinstance(g, (list, tuple, set)) else re.split(r"[;,/]| y ", str(g or ""))
    out = {_gender(x) for x in items}
    if any(_n(x) in ("ambos", "todos", "cualquiera", "both") for x in items): out |= {"hombre", "mujer"}
    return {x for x in out if x}


def _yes_no(v: Any) -> Optional[str]:
    t = _n(v)
    if not t: return None
    if t.startswith("si") or t in ("yes", "true"): return "si"
    if t.startswith("no") or t == "false": return "no"
    if "tal vez" in t or "quiza" in t or "maybe" in t or "abiert" in t: return "tal vez"
    return None


def _level(v: Any, table: List[Tuple[str, int]]) -> Optional[int]:
    t = _n(v)
    for key, lvl in table:
        if key in t: return lvl
    return None

FITNESS = [("atleta", 4), ("fitness lover", 3), ("constante", 2), ("ocasional", 1), ("principiante", 1), ("sedentari", 0), ("no entren", 0)]
EDU = [("doctorado", 4), ("phd", 4), ("maestria", 3), ("master", 3), ("especializ", 3), ("posgrado", 3),
       ("profesional", 2), ("universit", 2), ("pregrado", 2), ("tecnolog", 1), ("tecnic", 1), ("bachiller", 0)]
RUMBA = [("alta", 2), ("frecuente", 2), ("moderad", 1), ("ocasional", 1), ("baja", 0), ("nunca", 0), ("no ", 0)]
ALCOHOL = [("frecuente", 2), ("social", 1), ("ocasional", 1), ("nunca", 0), ("no", 0)]


def _in_range(val, lo, hi, tol) -> Optional[float]:
    """1 dentro del rango; 0.5 si se sale por <= tol; 0 si más. None si no hay rango."""
    if val is None or (lo is None and hi is None): return None
    gap = max((lo - val) if lo is not None else 0, (val - hi) if hi is not None else 0, 0)
    return 1.0 if gap == 0 else (0.5 if gap <= tol else 0.0)


def _avg(xs: List[Optional[float]]) -> Optional[float]:
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def unified_score(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    na, nb = a.get("name") or "Persona A", b.get("name") or "Persona B"
    bloqueos: List[str] = []
    fuertes: List[str] = []      # discrepancias que topan el score
    notas: List[str] = []
    dims: Dict[str, Optional[float]] = {}

    # 0. Bloqueos: género vs género buscado, en ambas direcciones (solo con dato confirmado)
    for x, y, nx, ny in ((a, b, na, nb), (b, a, nb, na)):
        want, g = _wanted(x.get("genero_buscado")), _gender(y.get("genero"))
        if want and g and g not in want:
            bloqueos.append(f"{nx} busca {'/'.join(sorted(want))} y {ny} es {g}.")

    # 1. Edad (bidireccional, tolerancia 2 años)
    e_ab = _in_range(b.get("edad"), a.get("edad_min"), a.get("edad_max"), 2)
    e_ba = _in_range(a.get("edad"), b.get("edad_min"), b.get("edad_max"), 2)
    dims["edad"] = _avg([e_ab, e_ba])
    if e_ab == 0: fuertes.append(f"La edad de {nb} ({b.get('edad')}) está fuera del rango que busca {na}.")
    if e_ba == 0: fuertes.append(f"La edad de {na} ({a.get('edad')}) está fuera del rango que busca {nb}.")

    # 2. Hijos
    ha, hb = _yes_no(a.get("deseo_hijos")), _yes_no(b.get("deseo_hijos"))
    if ha and hb:
        if ha == hb: dims["hijos"] = 1.0
        elif "tal vez" in (ha, hb): dims["hijos"] = 0.5; notas.append("Postura sobre hijos por confirmar (uno indica 'Tal vez').")
        else: dims["hijos"] = 0.0; fuertes.append(f"Proyecto de hijos opuesto: {na} '{ha}' y {nb} '{hb}'.")
    else: dims["hijos"] = None

    # 3. Ciudad (normalizada: sin tildes, mayúsculas ni barrio)
    ca, cb = norm_city(a.get("ciudad")), norm_city(b.get("ciudad"))
    dims["ciudad"] = (1.0 if ca == cb else 0.0) if ca and cb else None
    if ca and cb and ca != cb: notas.append(f"Ciudades distintas: {a.get('ciudad')} y {b.get('ciudad')}.")

    # 4. Actividad física
    fa, fb = _level(a.get("deporte_nivel"), FITNESS), _level(b.get("deporte_nivel"), FITNESS)
    dims["actividad_fisica"] = max(0.0, 1 - abs(fa - fb) / 3) if fa is not None and fb is not None else None

    # 5. Valores (hasta 3 por persona)
    va, vb = {_n(x) for x in (a.get("valores") or [])} - {""}, {_n(x) for x in (b.get("valores") or [])} - {""}
    dims["valores"] = {0: 0.3, 1: 0.7}.get(len(va & vb), 1.0) if va and vb else None

    # 6. Grupo social (CRM prof_248, escala numérica)
    try:
        ga, gb = float(a.get("grupo_social")), float(b.get("grupo_social"))
        dims["grupo_social"] = {0: 1.0, 1: 0.6, 2: 0.2}.get(int(abs(ga - gb)), 0.0)
    except (TypeError, ValueError):
        dims["grupo_social"] = None

    # 7. Estatura (bidireccional, tolerancia 3 cm)
    dims["estatura"] = _avg([_in_range(b.get("estatura_cm"), a.get("estatura_min_cm"), a.get("estatura_max_cm"), 3),
                             _in_range(a.get("estatura_cm"), b.get("estatura_min_cm"), b.get("estatura_max_cm"), 3)])

    # 8. Apego
    pa, pb = _n(a.get("estilo_apego")), _n(b.get("estilo_apego"))
    if pa and pb:
        pair = {("ansios" in pa, "evit" in pa), ("ansios" in pb, "evit" in pb)}
        if "segur" in pa and "segur" in pb: dims["apego"] = 1.0
        elif "segur" in pa or "segur" in pb: dims["apego"] = 0.8
        elif pair == {(True, False), (False, True)}: dims["apego"] = 0.2; notas.append("Combinación de apego ansioso × evitativo.")
        else: dims["apego"] = 0.6
    else: dims["apego"] = None

    # 9. Lenguaje del amor
    la, lb = _n(a.get("lenguaje_amor")), _n(b.get("lenguaje_amor"))
    dims["lenguaje_amor"] = (1.0 if la == lb else 0.6) if la and lb else None

    # 10. Hábitos (fumar, alcohol, rumba)
    hab = []
    sa, sb = _yes_no(a.get("fumador")), _yes_no(b.get("fumador"))
    if sa and sb: hab.append(1.0 if sa == sb else 0.0)
    for key, table, span in (("alcohol", ALCOHOL, 2), ("rumba", RUMBA, 2)):
        xa, xb = _level(a.get(key), table), _level(b.get(key), table)
        if xa is not None and xb is not None: hab.append(1 - abs(xa - xb) / span)
    dims["habitos"] = _avg(hab)

    # 11. Educación
    ea, eb = _level(a.get("educacion"), EDU), _level(b.get("educacion"), EDU)
    dims["educacion"] = max(0.0, 1 - abs(ea - eb) / 3) if ea is not None and eb is not None else None

    possible = sum(WEIGHTS[k] for k, v in dims.items() if v is not None)
    earned = sum(WEIGHTS[k] * v for k, v in dims.items() if v is not None)
    cobertura = round(possible)                      # los pesos suman 100
    score = round(100 * earned / possible) if possible else 0
    if fuertes: score = min(score, CAP_STRONG)

    if bloqueos: score, veredicto = 0, "NO RECOMENDADO"
    elif cobertura < MIN_COVERAGE: veredicto = "DATOS INSUFICIENTES"
    elif score >= 75: veredicto = "RECOMENDADO"
    elif score >= 65: veredicto = "VIABLE BUENO"
    elif score >= 50: veredicto = "VIABLE CON RESERVAS"
    else: veredicto = "COMPATIBILIDAD BAJA"

    return {
        "score": score, "veredicto": veredicto, "cobertura_pct": cobertura, "parcial": cobertura < 100,
        "bloqueos": bloqueos, "discrepancias_fuertes": fuertes, "observaciones": notas,
        "dimensiones": [{"dimension": k, "peso": WEIGHTS[k], "puntaje": None if v is None else round(v, 2),
                         "puntos": None if v is None else round(WEIGHTS[k] * v, 1)} for k, v in dims.items()],
        "pendientes": [k for k, v in dims.items() if v is None],
    }


def canonical_to_score_input(canon: Optional[Dict[str, Any]] = None, p_row: Optional[Any] = None) -> Dict[str, Any]:
    canon = canon or {}
    v = canon.get("verified_data") or {}
    prefs = canon.get("preferences") or {}
    
    p_ls = {}
    p_sp = {}
    p_ap = {}
    p_edu = None
    p_love = None
    p_name = None
    p_gen = None
    p_city = None
    p_age = None
    p_est = None
    p_valores = None
    p_soc = None

    if p_row is not None:
        if isinstance(p_row, dict):
            p_ls = p_row.get("lifestyle") or {}
            p_sp = p_row.get("search_preferences") or {}
            p_ap = p_row.get("apego") or {}
            p_edu = p_row.get("education") or p_row.get("education_level")
            p_love = p_row.get("love_language") or p_row.get("love_language_received")
            p_name = p_row.get("name")
            p_gen = p_row.get("gender")
            p_city = p_row.get("city")
            p_age = p_row.get("age")
            p_est = p_row.get("estatura")
            p_valores = p_row.get("valores")
            p_soc = p_row.get("social_group_score") or (p_ls.get("social_group") if isinstance(p_ls, dict) else None)
        else:
            p_ls = getattr(p_row, "lifestyle", None) or {}
            p_sp = getattr(p_row, "search_preferences", None) or {}
            p_ap = getattr(p_row, "apego", None) or {}
            p_edu = getattr(p_row, "education", None)
            p_love = getattr(p_row, "love_language", None)
            p_name = getattr(p_row, "name", None) or getattr(p_row, "full_name_raw", None)
            p_gen = getattr(p_row, "gender", None)
            p_city = getattr(p_row, "city", None)
            p_age = getattr(p_row, "age", None)
            p_est = getattr(p_row, "estatura", None)
            p_valores = getattr(p_row, "valores", None)
            p_soc = getattr(p_row, "social_group_score", None) or (p_ls.get("social_group") if isinstance(p_ls, dict) else None)

    if not isinstance(p_ls, dict): p_ls = {}
    if not isinstance(p_sp, dict): p_sp = {}
    if not isinstance(p_ap, dict): p_ap = {}

    name = canon.get("name") or p_name
    genero = v.get("genero") or p_gen
    genero_buscado = prefs.get("genero_buscado") or p_sp.get("preferred_gender")
    edad = v.get("edad") or p_age
    edad_min = prefs.get("edad_min") or p_sp.get("min_age")
    edad_max = prefs.get("edad_max") or p_sp.get("max_age")
    ciudad = v.get("ciudad") or p_city
    estatura_cm = v.get("estatura_cm")
    if estatura_cm is None and p_est:
        m = re.search(r'(\d{3})', str(p_est))
        if m:
            estatura_cm = int(m.group(1))

    estatura_min_cm = prefs.get("estatura_min_cm")
    if estatura_min_cm is None and p_sp.get("min_height_cm"):
        try: estatura_min_cm = int(float(str(p_sp["min_height_cm"])))
        except Exception: pass
    estatura_max_cm = prefs.get("estatura_max_cm")
    if estatura_max_cm is None and p_sp.get("max_height_cm"):
        try: estatura_max_cm = int(float(str(p_sp["max_height_cm"])))
        except Exception: pass

    deseo_hijos = v.get("deseo_hijos") or p_ls.get("wants_children")
    deporte_nivel = v.get("deporte_nivel") or p_ls.get("fitness_level") or p_ls.get("physical_activity_level") or p_ls.get("exercise")
    valores = v.get("valores") or p_ls.get("values") or p_valores or p_sp.get("important_values")
    grupo_social = v.get("grupo_social") or p_soc or p_ls.get("social_group")
    estilo_apego = v.get("estilo_apego") or p_ap.get("style") or p_ap.get("attachment_style")
    lenguaje_amor = v.get("lenguaje_amor") or p_love or p_ls.get("love_language")
    fumador = v.get("fumador") or p_ls.get("smoker") or p_ls.get("smoke")
    alcohol = v.get("alcohol") or p_ls.get("drinks_alcohol") or p_ls.get("alcohol")
    rumba = v.get("rumba") or p_ls.get("rumba") or p_ls.get("party_habits")
    educacion = v.get("educacion") or p_edu or p_ls.get("education_level") or v.get("profesion")

    return {
        "name": name,
        "genero": genero,
        "genero_buscado": genero_buscado,
        "edad": edad,
        "edad_min": edad_min,
        "edad_max": edad_max,
        "ciudad": ciudad,
        "estatura_cm": estatura_cm,
        "estatura_min_cm": estatura_min_cm,
        "estatura_max_cm": estatura_max_cm,
        "deseo_hijos": deseo_hijos,
        "deporte_nivel": deporte_nivel,
        "valores": valores,
        "grupo_social": grupo_social,
        "estilo_apego": estilo_apego,
        "lenguaje_amor": lenguaje_amor,
        "fumador": fumador,
        "alcohol": alcohol,
        "rumba": rumba,
        "educacion": educacion,
    }

