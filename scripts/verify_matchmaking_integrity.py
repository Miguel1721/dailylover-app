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
    check_ast_syntax(WEBHOOKS_PY)
    check_ast_syntax(EXTRACTOR_PY)
    check_matchmaking_invariants()
    print("\n[SUCCESS] TODAS LAS VERIFICACIONES DE INTEGRIDAD PASARON EXITOSAMENTE.")


if __name__ == "__main__":
    main()
