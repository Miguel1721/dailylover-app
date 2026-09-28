"""
Verificador estático AST y de reglas de integridad clínica para el motor de Matchmaking.
Uso: python scripts/verify_matchmaking_integrity.py
"""
import ast
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MATCHMAKING_PY = ROOT / "backend" / "app" / "routers" / "matchmaking.py"
WEBHOOKS_PY = ROOT / "backend" / "app" / "routers" / "webhooks.py"
EXTRACTOR_PY = ROOT / "backend" / "app" / "services" / "clinical_profile_extractor.py"
FRONTEND_JSX = ROOT / "frontend" / "admin" / "src" / "pages" / "matchmaking" / "EntrevistaResultados.jsx"


def check_ast_syntax(filepath: pathlib.Path) -> ast.Module:
    source = filepath.read_text(encoding="utf-8")
    try:
        tree = ast.parse(source, filename=str(filepath))
        print(f"[OK] AST Syntax válido: {filepath.relative_to(ROOT)} ({len(source.splitlines())} líneas)")
        return tree
    except SyntaxError as exc:
        print(f"[FAIL] Error de sintaxis en {filepath}: {exc}")
        sys.exit(1)


def check_matchmaking_invariants() -> None:
    mm_src = MATCHMAKING_PY.read_text(encoding="utf-8")
    wh_src = WEBHOOKS_PY.read_text(encoding="utf-8")
    ext_src = EXTRACTOR_PY.read_text(encoding="utf-8")
    jsx_src = FRONTEND_JSX.read_text(encoding="utf-8")

    checks = [
        ("Plan & Citas en _format_clinical_entity_for_chat", "- Plan & Citas:" in mm_src),
        ("Extractor estructurado _extract_plan_and_dates_fields", "def _extract_plan_and_dates_fields(" in mm_src),
        ("Respuesta determinística para consultas de citas (_is_direct_plan_or_dates_question)", "def _is_direct_plan_or_dates_question(" in mm_src),
        ("Grounding cruzado en evaluate_candidate_quick_notes_ai", "_SPECIFIC_TOPIC_PATTERNS" in mm_src and "_has_unilateral_cross_attribution" in mm_src),
        ("Segunda pasada LLM de verificación de grounding (_verify_bilateral_grounding_llm)", "async def _verify_bilateral_grounding_llm(" in mm_src),
        ("Clusters de personalidad/estilo de vida (tranquilo vs espontáneo/activo)", "estilo de vida tranquilo/hogareño" in mm_src and "has_lifestyle_polarity_mismatch" in mm_src),
        ("Truncado ampliado de notas clínicas [:3500]", "[:3500]" in mm_src),
        ("Cache key v7 + SQLite multi-worker en evaluate_candidate_quick_notes_ai", 'cache_key = f"v7:' in mm_src and "def _get_shared_ai_match_cache(" in mm_src),
        ("Presupuesto no destructivo Pass 2 + reintento automático en _eval_with_sem", "_verify_bilateral_grounding_llm(draft_an_initial, draft_pts_initial),\n            timeout=7.5" in mm_src and "[AI MATCH AUTO-RETRY]" in mm_src),
        ("DISTINCT ON en LEFT JOIN users de get_matches_pending_service", "SELECT DISTINCT ON (LOWER(TRIM(name))) name, crm_id, phone" in mm_src),
        ("Prohibición de fabricar approved_at con updated_at en get_matches_pending_service", 'app_dt = d.get("approved_at")' in mm_src and '"Sin fecha registrada"' in mm_src),
        ("Rastro estructurado decision_trace en find_candidate_matches_engine", '"decision_trace":' in mm_src),
        ("Regla had_date=true en historial de citas", "had_date = true" in mm_src.lower()),
        ("Advertencia no bloqueante para 'Ya presentado/a antes' en extractor", 'warnings.append(f"Historial previo:' in ext_src),
        ("Conexión de opportunity_reason en EntrevistaResultados.jsx", "cand.opportunity_reason" in jsx_src or "c.opportunity_reason" in jsx_src),
        ("Importación de datetime a nivel de módulo en webhooks.py", "\nfrom datetime import datetime\n" in wh_src),
        ("Reminder visible en fallo de correo VIP 650k (except Exception as e_vip_mail)", "Fallo Correo Agendamiento VIP:" in wh_src),
        ("Cascada centralizada F2 -> CRM (resolve_physical_activity_level / resolve_education_level)", mm_src.count("resolve_physical_activity_level(") >= 5 and mm_src.count("resolve_education_level(") >= 5),
        ("Sincronización completa _sync_crm_id_from_webhooks conectada en process_webhook_payload (webhooks.py)", "_sync_crm_id_from_webhooks" in wh_src and '"income_range"' in mm_src and '"partner_red_flags"' in mm_src and '"min_age"' in mm_src),
    ]

    failed = False
    for label, passed in checks:
        status = "[OK]" if passed else "[FAIL]"
        print(f"{status} {label}")
        if not passed:
            failed = True

    if failed:
        sys.exit(1)


def check_resolvers_behavior(mm_tree: ast.Module) -> None:
    """Extrae y ejecuta resolve_physical_activity_level y resolve_education_level contra casos reales."""
    import json
    import re
    from typing import Any, Dict, Optional, Tuple

    ns: Dict[str, Any] = {
        "Any": Any,
        "Dict": Dict,
        "Optional": Optional,
        "Tuple": Tuple,
        "json": json,
        "re": re,
    }
    target_names = {
        "resolve_physical_activity_level",
        "_EDU_PROFESSIONAL_KEYWORDS",
        "_match_education_text",
        "resolve_education_level",
    }
    selected_nodes = []
    for node in mm_tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in target_names:
            selected_nodes.append(node)
        elif isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id in target_names:
                    selected_nodes.append(node)

    mod = ast.Module(body=selected_nodes, type_ignores=[])
    exec(compile(mod, filename=str(MATCHMAKING_PY), mode="exec"), ns)

    resolve_act = ns["resolve_physical_activity_level"]
    resolve_edu = ns["resolve_education_level"]

    act_cases = [
        # (args, kwargs, expected)
        ((8, {"fitness_level": "No entrena"}), {"is_persisted_in_cep": True}, (8, "Psicóloga (F2)")),
        ((None, {"fitness_level": "Moderado"}), {}, (6, "CRM")),
        ((None, {"fitness_level": "Constante (2–3/semana)"}), {}, (6, "CRM")),
        ((None, {"fitness_level": "Fitness Lover (4–6/semana)"}), {}, (8, "CRM")),
        ((None, {"fitness_level": "Avanzado"}), {}, (8, "CRM")),
        ((None, {"fitness_level": "Atleta"}), {}, (10, "CRM")),
        ((None, {"fitness_level": "Principiante"}), {}, (4, "CRM")),
        ((None, {"fitness_level": "No entrena"}), {}, (2, "CRM")),
        ((None, {"fitness_level": "Sedentario"}), {}, (2, "CRM")),
        ((None, {}), {}, (None, "Pendiente (F2)")),
    ]
    for args, kwargs, expected in act_cases:
        actual = resolve_act(*args, **kwargs)
        if actual != expected:
            print(f"[FAIL] resolve_physical_activity_level{args} -> {actual} != {expected}")
            sys.exit(1)
    print(f"[OK] Pruebas unitarias resolve_physical_activity_level ({len(act_cases)} casos verificados, incl. 'Moderado')")

    edu_cases = [
        # Prioridad F2 sobre CRM
        ((9, "Bachiller", "Independiente"), {"is_persisted_in_cep": True}, (9, "Psicóloga (F2)")),
        # Títulos directos en education
        ((None, "Doctorado en Economía", None), {}, (10, "CRM")),
        ((None, "Maestría - Universidad de La Sabana", None), {}, (9, "CRM")),
        ((None, "Especialización en Finanzas", None), {}, (8, "CRM")),
        ((None, "Profesional - Universidad del Rosario", None), {}, (7, "CRM")),
        ((None, "Estudiante - Universidad UNAD", None), {}, (5, "CRM")),
        ((None, "Técnico", None), {}, (5, "CRM")),
        ((None, "Bachillerato", None), {}, (3, "CRM")),
        # Texto libre en profiles.education (importación histórica Excel: carreras o universidades solas)
        ((None, "Ingeniero de Sistemas", None), {}, (7, "CRM")),
        ((None, "Ingeniero naval mecanico", None), {}, (7, "CRM")),
        ((None, "Abogada", None), {}, (7, "CRM")),
        ((None, "Médico Cirujano", None), {}, (7, "CRM")),
        ((None, "Psicóloga clínica", None), {}, (7, "CRM")),
        ((None, "La Javeriana", None), {}, (7, "CRM")),
        ((None, "Los Andes", None), {}, (7, "CRM")),
        ((None, "Politécnico Grancolombiano", None), {}, (7, "CRM")),
        ((None, "Professional Degree (politecnico grancolombiano)", None), {}, (7, "CRM")),
        # Fallback por crm_occupation_val cuando crm_education_val está vacío
        ((None, None, "Ingeniero de Sistemas"), {}, (7, "CRM")),
        ((None, "", "Abogada"), {}, (7, "CRM")),
        ((None, None, "Médico Cirujano"), {}, (7, "CRM")),
        ((None, None, "Psicóloga clínica"), {}, (7, "CRM")),
        ((None, None, "Abogada y hace maestria"), {}, (9, "CRM")),
        ((None, "La Javeriana", "Abogada y hace maestria"), {}, (9, "CRM")),
        ((None, None, "Estudiante de Ciencias Sociales"), {}, (5, "CRM")),
        ((None, None, "Soporte tecnico"), {}, (5, "CRM")),
        # Sin datos ni palabras clave
        ((None, None, "Independiente"), {}, (None, "Pendiente (F2)")),
        ((None, None, None), {}, (None, "Pendiente (F2)")),
    ]
    for args, kwargs, expected in edu_cases:
        actual = resolve_edu(*args, **kwargs)
        if actual != expected:
            print(f"[FAIL] resolve_education_level{args} -> {actual} != {expected}")
            sys.exit(1)
    print(f"[OK] Pruebas unitarias resolve_education_level ({len(edu_cases)} casos verificados, incl. profesiones y ocupación)")


def main() -> None:
    mm_tree = check_ast_syntax(MATCHMAKING_PY)
    check_ast_syntax(WEBHOOKS_PY)
    check_ast_syntax(EXTRACTOR_PY)
    check_matchmaking_invariants()
    check_resolvers_behavior(mm_tree)
    print("\n[SUCCESS] TODAS LAS VERIFICACIONES DE INTEGRIDAD PASARON EXITOSAMENTE.")


if __name__ == "__main__":
    main()
