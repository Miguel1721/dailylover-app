"""
Helper canónico para resolución y filtrado exacto de Psicólogas / Matchmakers.
Evita bugs de substring (ej. 'ANA' haciendo match indebido en 'SILVANA').
"""
from typing import List, Tuple, Dict, Any, Optional

PSYCHOLOGIST_ALIASES: Dict[str, List[str]] = {
    'ANA': ['ANA', 'ANA TOLOSA', 'MATCHES ANA'],
    'SILVI': ['SILVI', 'SILVA', 'SILVANA', 'SILVIA', 'MATCHES SILVI'],
    'STEFFY': ['STEFFY', 'TEFFY', 'STEFF', 'STEPHANIE', 'MATCHES STEFFY'],
    'JENN': ['JENN', 'JENNIFER', 'MATCHES JENN'],
    'PIA': ['PIA', 'PÍA', 'MATCHES PIA'],
    'ISA': ['ISA', 'ISA MARQUEZ', 'ISABELA MARQUEZ', 'ISABELLA', 'MATCHES ISA'],
    'ALEJA': ['ALEJA', 'ALEJANDRA', 'MATCHES ALEJA', 'ALEJA - JENN'],
    'MANU': ['MANU', 'MANUELA', 'MANU 1', 'MANU 2', 'MATCHES MANU'],
    'SOFI': ['SOFI', 'SOFIA ARIAS', 'SOFÍA ARIAS', 'SOFI ARIAS', 'MATCHES SOFI'],
    'MAPE D': ['MAPE D', 'MAPE', 'MARI DE LA E', 'MARI DE LA ESPRIELLA', 'MARIA PAULA', 'MARÍA PAULA', 'MARIA PAULA SALINAS', 'MATCHES MAPE D', 'MATCHES MAPE', 'MATCHES'],
    # Psicólogas retiradas Maripaz / MariB / MariS (cartera heredada por ANA). Antes su clave era 'MPS', pero el código
    # 'MPS' también se usa para los clientes del plan Matchmaking Service (650k) que atiende María Paula Salinas:
    # esa colisión los mostraba como cartera heredada de ANA.
    'MARIPAZ': ['MARIPAZ', 'MARI SARMIENTO', 'MARI S', 'MARIS', 'MARI S Y MAPE', 'MARI B', 'MARIB', 'MARI PAZ', 'MARI PAZ Y MAPE'],
    # 'MPS' literal = María Paula Salinas (plan 650k). Nunca es cartera heredada.
    'MPS': ['MPS', 'MATCHES MPS'],
    'LAU': ['LAU', 'LAURA', 'MATCHES LAU']
}

# Mapa oficial de carteras heredadas (psicólogas activas <- psicólogas retiradas)
INHERITED_PSYCHOLOGIST_MAP: Dict[str, List[str]] = {
    'SILVI': ['SOFI'],
    'JENN': ['ALEJA'],
    'ISA': ['LAU'],
    'ANA': ['MARIPAZ'],
    'STEFFY': ['MANU'],
}

# Mapa inverso: psicóloga retiradas -> psicóloga activa que la heredó
RETIRED_TO_ACTIVE_PSYCHOLOGIST: Dict[str, str] = {
    'SOFI': 'SILVI',
    'ALEJA': 'JENN',
    'LAU': 'ISA',
    'MARIPAZ': 'ANA',
    'MANU': 'STEFFY',
}

INHERITED_DISPLAY_LABELS: Dict[str, str] = {
    'SILVI': 'Sofi',
    'JENN': 'Aleja',
    'ISA': 'Lau',
    'ANA': 'Maripaz / MariB / MariS',
    'STEFFY': 'Manu',
}


def resolve_canonical_psychologist(raw_name: Optional[str]) -> str:
    """Resuelve cualquier alias al código canónico de la psicóloga."""
    if not raw_name:
        return ""
    clean = str(raw_name).strip().upper().replace("MATCHES ", "").strip()
    if clean in PSYCHOLOGIST_ALIASES:
        return clean
    for canonical, aliases in PSYCHOLOGIST_ALIASES.items():
        if clean in aliases:
            return canonical
    return clean


def get_psychologist_aliases(raw_name: str, ownership_mode: str = "all") -> List[str]:
    """
    Retorna la lista exacta de variantes permitidas para una psicóloga dada.
    ownership_mode:
      - 'all': incluye los perfiles propios + los heredados de psicólogas que ya no están
      - 'propios': incluye únicamente los perfiles propios de la psicóloga activa
      - 'heredados': incluye únicamente los perfiles heredados de la psicóloga retirada asignada
    """
    if not raw_name:
        return []
    canonical = resolve_canonical_psychologist(raw_name)
    own_aliases = list(PSYCHOLOGIST_ALIASES.get(canonical, [canonical]))
    inherited_canonicals = INHERITED_PSYCHOLOGIST_MAP.get(canonical, [])
    inherited_aliases: List[str] = []
    for ic in inherited_canonicals:
        for alias in PSYCHOLOGIST_ALIASES.get(ic, [ic]):
            if alias not in inherited_aliases:
                inherited_aliases.append(alias)

    mode = (ownership_mode or "all").strip().lower()
    if mode in ("propios", "own", "propio"):
        return own_aliases
    if mode in ("heredados", "inherited", "heredado"):
        return inherited_aliases if inherited_aliases else ["__NO_INHERITED_PORTFOLIO__"]

    combined = list(own_aliases)
    for alias in inherited_aliases:
        if alias not in combined:
            combined.append(alias)
    return combined


def classify_psychologist_ownership(
    raw_responsable: Optional[str],
    viewer_psychologist: Optional[str] = None,
    fallback_responsable: Optional[str] = None
) -> Dict[str, Any]:
    """
    Clasifica si un registro (cuyo responsable original es raw_responsable o fallback_responsable)
    es 'propio' o 'heredado', quién lo heredó y de qué psicóloga provino.
    """
    raw_clean = str(raw_responsable or "").strip()
    orig_canonical = resolve_canonical_psychologist(raw_clean)
    upper_raw = raw_clean.upper()

    is_inherited = orig_canonical in RETIRED_TO_ACTIVE_PSYCHOLOGIST

    # Si en operational_matches ya figura el código de la psicóloga activa pero en profiles.responsable
    # conserva el nombre de la psicóloga retirada que se fue, respetar ese origen heredado:
    if not is_inherited and fallback_responsable:
        fb_clean = str(fallback_responsable or "").strip()
        fb_canonical = resolve_canonical_psychologist(fb_clean)
        if fb_canonical in RETIRED_TO_ACTIVE_PSYCHOLOGIST:
            expected_active = RETIRED_TO_ACTIVE_PSYCHOLOGIST[fb_canonical]
            if not orig_canonical or orig_canonical == expected_active:
                is_inherited = True
                orig_canonical = fb_canonical
                raw_clean = fb_clean
                upper_raw = fb_clean.upper()

    assigned_canonical = RETIRED_TO_ACTIVE_PSYCHOLOGIST.get(orig_canonical, orig_canonical)

    inherited_from = None
    if is_inherited:
        if orig_canonical == 'SOFI':
            inherited_from = 'Sofi'
        elif orig_canonical == 'ALEJA':
            inherited_from = 'Aleja'
        elif orig_canonical == 'LAU':
            inherited_from = 'Lau'
        elif orig_canonical == 'MANU':
            inherited_from = 'Manu'
        elif orig_canonical == 'MARIPAZ':
            if 'PAZ' in upper_raw:
                inherited_from = 'Maripaz'
            elif 'MARI B' in upper_raw or 'MARIB' in upper_raw:
                inherited_from = 'MariB'
            elif 'SARMIENTO' in upper_raw or 'MARI S' in upper_raw or 'MARIS' in upper_raw:
                inherited_from = 'MariS'
            else:
                inherited_from = 'Maripaz / MariB / MariS'

    return {
        "original_psychologist": raw_clean or orig_canonical,
        "original_canonical": orig_canonical,
        "assigned_psychologist": assigned_canonical,
        "is_inherited": is_inherited,
        "ownership_type": "heredado" if is_inherited else "propio",
        "inherited_from": inherited_from,
    }


def build_psychologist_sql_condition(
    column_expr: str,
    raw_name: str,
    param_prefix: str = "psyc",
    ownership_mode: str = "all"
) -> Tuple[str, Dict[str, Any]]:
    """
    Construye una condición SQL exacta y segura evitando falsos positivos por substrings.
    Soporta ownership_mode ('all', 'propios', 'heredados').
    """
    aliases = get_psychologist_aliases(raw_name, ownership_mode=ownership_mode)
    if not aliases:
        return "1=1", {}

    params = {}
    param_names = []
    for idx, a in enumerate(aliases):
        p_name = f"{param_prefix}_{idx}"
        params[p_name] = a.upper()
        param_names.append(f":{p_name}")

    sql = f"(UPPER(TRIM({column_expr})) IN ({', '.join(param_names)}))"
    return sql, params

