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
MIS_MATCHES_JSX = ROOT / "frontend" / "admin" / "src" / "pages" / "matchmaking" / "MisMatches.jsx"
MIGRATIONS_DIR = ROOT / "backend" / "alembic" / "versions"


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
    mis_matches_src = MIS_MATCHES_JSX.read_text(encoding="utf-8")
    migration_files = {p.name: p.read_text(encoding="utf-8") for p in MIGRATIONS_DIR.glob("*.py")}

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
        ("Constructor diferenciado strict vs relaxed (build_candidate_pool_queries) y síntesis bio_notes (synthesize_structured_bio_notes)", "def build_candidate_pool_queries(" in mm_src and "def synthesize_structured_bio_notes(" in mm_src and "LENGTH(TRIM(p.bio_notes)) > 40" not in mm_src),
        ("Blindaje de resolve_person_email_and_id contra emails corridos (profiles real, merged_into_id IS NULL, +57300000% y GEN_%)", "def _is_safe_user_row_for_email(" in mm_src and "def _select_safe_person_email_and_id(" in mm_src and "NOT LIKE '+57300000%'" in mm_src and "NOT LIKE 'GEN_%'" in mm_src),

        # --- Bloqueo secuencial de slots multi-cita (sequential_gate) ---
        ("Migración alembic agrega operational_matches.sequential_gate (aditivo, default false)",
            any("ADD COLUMN IF NOT EXISTS sequential_gate BOOLEAN NOT NULL DEFAULT false" in src for src in migration_files.values())),
        ("intake-client marca sequential_gate=true solo en planes de 2+ citas creados de aquí en adelante (no toca clientes existentes)",
            "seq_gate_val = num_slots > 1" in mm_src and '"seq_gate": seq_gate_val' in mm_src and "sequential_gate, created_at, updated_at)" in mm_src),
        ("my-matches calcula is_locked_sequential vía EXISTS de slot anterior no CITA REALIZADA (no retroactivo: exige sequential_gate=true)",
            "AS is_locked_sequential" in mm_src and "COALESCE(m.sequential_gate, false) AND m.slot_number > 1" in mm_src and "UPPER(COALESCE(m2.status, '')) != 'CITA REALIZADA'" in mm_src),
        ("my-matches expone is_locked/lock_reason/sequential_wait_slot combinando aprobado + cross_review + sequential_gate",
            '"is_locked": is_approved or is_cross_locked or is_locked_sequential' in mm_src and '"lock_reason":' in mm_src and '"sequential_wait_slot":' in mm_src),
        ("MisMatches.jsx muestra etiqueta 'Bloqueado hasta Cita N' solo para lock_reason sequential_gate, y separa 'Aprobado por María' de is_locked genérico",
            "Bloqueado hasta Cita" in mis_matches_src and "m.lock_reason === 'sequential_gate'" in mis_matches_src and "{m.approved_by_maria ? (" in mis_matches_src),

        # --- Espejo de rechazo para Persona B (vuelve a su propia psicóloga) ---
        ("Estados nuevos relativos a Persona B registrados en STATUS_COLORS/ALLOWED_STATUSES (backend) y STATUS_GROUPS/STATUS_COLORS (frontend)",
            '"RECHAZÓ A LA OTRA PERSONA"' in mm_src and '"RECHAZADO POR LA OTRA PERSONA"' in mm_src and "'RECHAZÓ A LA OTRA PERSONA'" in mis_matches_src and "'RECHAZADO POR LA OTRA PERSONA'" in mis_matches_src),
        ("Al rechazar, Persona B se busca por su propia ficha (person_a=B) y se le asigna el estado correcto direccional (no copia RECHAZADO POR PERSONA A/B tal cual)",
            'b_status = "RECHAZÓ A LA OTRA PERSONA"' in mm_src and 'b_status = "RECHAZADO POR LA OTRA PERSONA"' in mm_src and "WHERE LOWER(TRIM(person_a)) = LOWER(TRIM(:pB))" in mm_src),
        ("Persona B solo se devuelve a su psicóloga si ya tiene ficha propia (b_home_row con psychologist_name); si no, no se toca nada",
            "if b_home_row and b_home_row.psychologist_name and b_home_row.psychologist_name.strip():" in mm_src),
        ("Se evita duplicar el slot 'Listo para match' de Persona B si ya tiene uno abierto (mismo guard que Persona A)",
            mm_src.count("LOWER(TRIM(status)) = 'listo para match'") >= 2),
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
    """Extrae y ejecuta resolve_physical_activity_level, resolve_education_level, build_candidate_pool_queries, synthesize_structured_bio_notes y resolve_person_email_and_id contra casos reales."""
    import asyncio
    import json
    import re
    from typing import Any, Dict, List, Optional, Tuple

    ns: Dict[str, Any] = {
        "Any": Any,
        "Dict": Dict,
        "List": List,
        "Optional": Optional,
        "Tuple": Tuple,
        "AsyncSession": Any,
        "text": lambda s: s,
        "json": json,
        "re": re,
    }
    target_names = {
        "resolve_physical_activity_level",
        "_EDU_PROFESSIONAL_KEYWORDS",
        "_match_education_text",
        "resolve_education_level",
        "synthesize_structured_bio_notes",
        "build_candidate_pool_queries",
        "_is_safe_user_row_for_email",
        "_select_safe_person_email_and_id",
        "resolve_person_email_and_id",
    }
    selected_nodes = []
    for node in mm_tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in target_names:
            selected_nodes.append(node)
        elif isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id in target_names:
                    selected_nodes.append(node)

    mod = ast.Module(body=selected_nodes, type_ignores=[])
    exec(compile(mod, filename=str(MATCHMAKING_PY), mode="exec"), ns)

    resolve_act = ns["resolve_physical_activity_level"]
    resolve_edu = ns["resolve_education_level"]
    synth_bio = ns["synthesize_structured_bio_notes"]
    build_queries = ns["build_candidate_pool_queries"]
    select_safe_email = ns["_select_safe_person_email_and_id"]
    resolve_email_async = ns["resolve_person_email_and_id"]

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

    # Prueba de comportamiento: build_candidate_pool_queries (strict vs relaxed)
    sample_gender_sql = "(p.gender ILIKE '%homb%' OR p.gender ILIKE '%masc%')"
    sample_anti_name_sql = "AND u.name !~* '^(maria|paula|laura)'"
    sample_city_sql = "AND (p.city ILIKE '%Bogotá%' OR p.city IS NULL OR p.city = '')"
    sample_orient_sql = "AND (p.orientation IS NULL OR p.orientation = '' OR p.orientation ILIKE '%hetero%')"
    sample_age_order_sql = "CASE WHEN p.age BETWEEN 25 AND 35 THEN 0 ELSE 1 END ASC,"

    strict_sql, relaxed_sql = build_queries(
        sample_gender_sql,
        sample_anti_name_sql,
        sample_city_sql,
        sample_orient_sql,
        sample_age_order_sql,
    )
    if strict_sql.strip() == relaxed_sql.strip():
        print("[FAIL] build_candidate_pool_queries: strict_sql y relaxed_sql siguen siendo idénticas")
        sys.exit(1)
    if sample_anti_name_sql not in strict_sql or sample_anti_name_sql in relaxed_sql:
        print("[FAIL] build_candidate_pool_queries: anti_opposite_name_sql debe estar en strict_sql y relajarse en relaxed_sql")
        sys.exit(1)
    strict_where = strict_sql.split("ORDER BY")[0]
    relaxed_where = relaxed_sql.split("ORDER BY")[0]
    if "p.city ILIKE '%Bogotá%'" not in strict_where or "p.city ILIKE '%Bogotá%'" in relaxed_where:
        print("[FAIL] build_candidate_pool_queries: city_sql debe filtrar en WHERE de strict_sql y pasar a ORDER BY en relaxed_sql")
        sys.exit(1)
    if "p.lifestyle IS NOT NULL" not in strict_where or "p.lifestyle IS NOT NULL" in relaxed_where:
        print("[FAIL] build_candidate_pool_queries: filtro de completitud estructurada/bio debe estar en strict_where y relajarse en relaxed_where")
        sys.exit(1)
    if "COALESCE(p.bio_notes, '') !~*" not in strict_where or "COALESCE(p.bio_notes, '') !~*" not in relaxed_where:
        print("[FAIL] build_candidate_pool_queries: debe usar COALESCE(p.bio_notes, '') !~* para no excluir NULLs en SQL")
        sys.exit(1)
    print("[OK] Prueba de comportamiento build_candidate_pool_queries (strict_sql != relaxed_sql y relajación real verificada)")

    # Prueba de comportamiento: synthesize_structured_bio_notes
    laura_mock = {
        "bio_notes": "",
        "age": 21,
        "city": "Bogotá",
        "estatura": "162 cm",
        "education": "Pregrado / Universitario (Colegio Mayor de Cundinamarca)",
        "love_language": "Tiempo de calidad",
        "lifestyle": {"fitness_level": "Moderado", "wants_children": "No", "has_pets": "Sí", "pet_type": "Perro"},
        "search_preferences": {"min_age": 21, "max_age": 27, "non_negotiables": ["Falta de honestidad"]},
    }
    synthesized = synth_bio(laura_mock)
    if len(synthesized) <= 40 or "Edad: 21 años" not in synthesized or "Estatura: 162 cm" not in synthesized:
        print(f"[FAIL] synthesize_structured_bio_notes falló en perfil estructurado: {synthesized!r}")
        sys.exit(1)
    long_existing = "Abogada corporativa apasionada por el deporte, busca relación estable en Bogotá."
    if synth_bio({"bio_notes": long_existing, "age": 30}) != long_existing:
        print("[FAIL] synthesize_structured_bio_notes no preservó bio_notes > 40 chars existente")
        sys.exit(1)
    if synth_bio({"bio_notes": None, "age": None}) != "":
        print("[FAIL] synthesize_structured_bio_notes inventó texto en perfil vacío")
        sys.exit(1)
    print("[OK] Prueba de comportamiento synthesize_structured_bio_notes (síntesis estructurada >40 chars y preservación verificadas)")

    # Prueba de comportamiento: resolve_person_email_and_id (Caso Isabella Luquetta / Diana Coral Guerrero y colisiones por nombre)
    class _MockResult:
        def __init__(self, rows):
            self._rows = rows

        def fetchall(self):
            return self._rows

    class _MockAsyncDB:
        def __init__(self, dataset_by_name):
            self.dataset_by_name = dataset_by_name
            self.queries = []

        async def execute(self, sql, params=None):
            self.queries.append((str(sql), params or {}))
            n = (params or {}).get("n", "").strip().lower()
            if n and n in self.dataset_by_name:
                return _MockResult(self.dataset_by_name[n])
            return _MockResult([])

    mock_dataset = {
        # 1) Isabella Luquetta (UID=12011): tiene profiles real, merged_into_id=None, teléfono real +573103185223 -> DEBE devolver isalu.luquetta@gmail.com
        "isabella luquetta": [
            {
                "id": 12011,
                "email": "isalu.luquetta@gmail.com",
                "phone": "+573103185223",
                "merged_into_id": None,
                "has_profile": True,
            }
        ],
        # 2) Diana Coral Guerrero (UID=5557): tiene el email corrido de Isabella Luquetta en una fila con teléfono +573000000167 -> DEBE ignorar el email ("")
        "diana coral guerrero": [
            {
                "id": 5557,
                "email": "isalu.luquetta@gmail.com",
                "phone": "+573000000167",
                "merged_into_id": None,
                "has_profile": True,
            }
        ],
        # 3) Colisión de nombre exacto: fila sin profiles (o con +57300000% / GEN_% / merged_into_id) tiene email corrido, y fila con profiles real no tiene email
        "miguel angel duarte sánchez": [
            {
                "id": 5407,
                "email": "cespedes.daniele2310@gmail.com",
                "phone": "+573000000016",
                "merged_into_id": None,
                "has_profile": False,
            },
            {
                "id": 99991,
                "email": "leak@example.com",
                "phone": "GEN_62285ffdf9d3",
                "merged_into_id": None,
                "has_profile": True,
            },
            {
                "id": 99992,
                "email": "merged_leak@example.com",
                "phone": "+573109998877",
                "merged_into_id": 15412,
                "has_profile": True,
            },
            {
                "id": 15412,
                "email": "",
                "phone": "+573152223344",
                "merged_into_id": None,
                "has_profile": True,
            },
        ],
    }

    mock_db = _MockAsyncDB(mock_dataset)
    res_isabella = asyncio.run(resolve_email_async(mock_db, "Isabella Luquetta"))
    if res_isabella != (12011, "isalu.luquetta@gmail.com"):
        print(f"[FAIL] resolve_person_email_and_id('Isabella Luquetta') -> {res_isabella} != (12011, 'isalu.luquetta@gmail.com')")
        sys.exit(1)

    res_diana = asyncio.run(resolve_email_async(mock_db, "Diana Coral Guerrero"))
    if res_diana != (5557, ""):
        print(f"[FAIL] resolve_person_email_and_id('Diana Coral Guerrero') filtró email corrido de Isabella Luquetta: {res_diana}")
        sys.exit(1)

    res_collision = asyncio.run(resolve_email_async(mock_db, "Miguel Angel Duarte Sánchez"))
    if res_collision != (15412, ""):
        print(f"[FAIL] resolve_person_email_and_id('Miguel Angel Duarte Sánchez') no priorizó fila con profiles real o filtró email corrido: {res_collision}")
        sys.exit(1)

    # Verificar que la consulta SQL generada también contiene las cláusulas de protección
    executed_sql = mock_db.queries[0][0]
    for required_sql_piece in (
        "LEFT JOIN profiles p ON p.user_id = u.id",
        "u.merged_into_id IS NULL",
        "NOT LIKE '+57300000%'",
        "NOT LIKE 'GEN_%'",
    ):
        if required_sql_piece not in executed_sql:
            print(f"[FAIL] SQL de resolve_person_email_and_id no incluye '{required_sql_piece}'")
            sys.exit(1)

    print("[OK] Prueba de comportamiento resolve_person_email_and_id (Isabella Luquetta / Diana Coral Guerrero y colisión de nombres verificadas)")


def main() -> None:
    mm_tree = check_ast_syntax(MATCHMAKING_PY)
    check_ast_syntax(WEBHOOKS_PY)
    check_ast_syntax(EXTRACTOR_PY)
    check_matchmaking_invariants()
    check_resolvers_behavior(mm_tree)
    print("\n[SUCCESS] TODAS LAS VERIFICACIONES DE INTEGRIDAD PASARON EXITOSAMENTE.")


if __name__ == "__main__":
    main()

