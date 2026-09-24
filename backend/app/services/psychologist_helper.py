"""
Helper canónico para resolución y filtrado exacto de Psicólogas / Matchmakers.
Evita bugs de substring (ej. 'ANA' haciendo match indebido en 'SILVANA').
"""
from typing import List, Tuple, Dict, Any

PSYCHOLOGIST_ALIASES: Dict[str, List[str]] = {
    'ANA': ['ANA', 'ANA TOLOSA', 'MATCHES ANA'],
    'SILVI': ['SILVI', 'SILVANA', 'SILVIA', 'MATCHES SILVI'],
    'STEFFY': ['STEFFY', 'STEFF', 'STEPHANIE', 'MATCHES STEFFY'],
    'JENN': ['JENN', 'JENNIFER', 'MATCHES JENN'],
    'PIA': ['PIA', 'PÍA', 'MATCHES PIA'],
    'ISA': ['ISA', 'ISA MARQUEZ', 'ISABELA MARQUEZ', 'ISABELLA', 'MATCHES ISA'],
    'ALEJA': ['ALEJA', 'ALEJANDRA', 'MATCHES ALEJA'],
    'MANU': ['MANU', 'MANUELA', 'MANU 1', 'MANU 2', 'MATCHES MANU'],
    'SOFI': ['SOFI', 'SOFIA ARIAS', 'SOFÍA ARIAS', 'SOFI ARIAS', 'MATCHES SOFI'],
    'MAPE D': ['MAPE D', 'MAPE', 'MARIA PAULA', 'MARÍA PAULA', 'MARIA PAULA SALINAS', 'MATCHES MAPE D', 'MATCHES MAPE'],
    'MPS': ['MPS', 'MARIA', 'MARÍA', 'MARI DE LA E', 'MARI DE LA ESPRIELLA', 'MARI SARMIENTO', 'MARI B', 'MARIB', 'MARI PAZ', 'MARIPAZ'],
    'LAU': ['LAU', 'LAURA', 'MATCHES LAU']
}

def get_psychologist_aliases(raw_name: str) -> List[str]:
    """Retorna la lista exacta de variantes permitidas para una psicóloga dada."""
    if not raw_name:
        return []
    clean = raw_name.strip().upper().replace("MATCHES ", "").strip()
    if clean in PSYCHOLOGIST_ALIASES:
        return PSYCHOLOGIST_ALIASES[clean]
    for canonical, aliases in PSYCHOLOGIST_ALIASES.items():
        if clean in aliases:
            return aliases
    return [clean]

def build_psychologist_sql_condition(column_expr: str, raw_name: str, param_prefix: str = "psyc") -> Tuple[str, Dict[str, Any]]:
    """
    Construye una condición SQL exacta y segura evitando falsos positivos por substrings.
    Ej: Para column_expr='p.responsable' y raw_name='ANA', genera:
    (UPPER(TRIM(p.responsable)) IN (:psyc_0, :psyc_1, :psyc_2))
    """
    aliases = get_psychologist_aliases(raw_name)
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
