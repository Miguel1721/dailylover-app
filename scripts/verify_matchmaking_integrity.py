"""
Verificador estático AST y de reglas de integridad clínica para el motor de Matchmaking.
Uso: python scripts/verify_matchmaking_integrity.py
"""
import ast
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MATCHMAKING_PY = ROOT / "backend" / "app" / "routers" / "matchmaking.py"
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
    ext_src = EXTRACTOR_PY.read_text(encoding="utf-8")
    jsx_src = FRONTEND_JSX.read_text(encoding="utf-8")

    checks = [
        ("Plan & Citas en _format_clinical_entity_for_chat", "- Plan & Citas:" in mm_src),
        ("Extractor estructurado _extract_plan_and_dates_fields", "def _extract_plan_and_dates_fields(" in mm_src),
        ("Respuesta determinística para consultas de citas (_is_direct_plan_or_dates_question)", "def _is_direct_plan_or_dates_question(" in mm_src),
        ("Grounding cruzado en evaluate_candidate_quick_notes_ai", "_SPECIFIC_TOPIC_PATTERNS" in mm_src and "_has_unilateral_cross_attribution" in mm_src),
        ("Truncado ampliado de notas clínicas [:3500]", "[:3500]" in mm_src),
        ("Cache key v5 en evaluate_candidate_quick_notes_ai", 'cache_key = f"v5:' in mm_src),
        ("Rastro estructurado decision_trace en find_candidate_matches_engine", '"decision_trace":' in mm_src),
        ("Regla had_date=true en historial de citas", "had_date = true" in mm_src.lower()),
        ("Advertencia no bloqueante para 'Ya presentado/a antes' en extractor", 'warnings.append(f"Historial previo:' in ext_src),
        ("Conexión de opportunity_reason en EntrevistaResultados.jsx", "cand.opportunity_reason" in jsx_src or "c.opportunity_reason" in jsx_src),
    ]

    failed = False
    for label, passed in checks:
        status = "[OK]" if passed else "[FAIL]"
        print(f"{status} {label}")
        if not passed:
            failed = True

    if failed:
        sys.exit(1)


def main() -> None:
    check_ast_syntax(MATCHMAKING_PY)
    check_ast_syntax(EXTRACTOR_PY)
    check_matchmaking_invariants()
    print("\n[SUCCESS] TODAS LAS VERIFICACIONES DE INTEGRIDAD PASARON EXITOSAMENTE.")


if __name__ == "__main__":
    main()
