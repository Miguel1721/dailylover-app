import csv
import json
from pathlib import Path

BASE = Path("C:/Users/jeloz/Documents/antigravity/zealous-fermi/scratch")
DATA_PATH = BASE / "fase1_twins_merge_case_by_case_audit.json"
FASE2_PATH = BASE / "fase2_profiles_insert_audit_before_after.json"

data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
fase2_data = json.loads(FASE2_PATH.read_text(encoding="utf-8"))
fase2_by_uid = {r["user_id"]: r for r in fase2_data["records"]}

blocked_uids = {b["side_a_no_profile"]["user_id"] for b in data["blocked_email_collisions"]}

certeza_alta_buckets = {
    "NIVEL_1_EMAIL_Y_NOMBRE_EXACTO",
    "NIVEL_1B_EMAIL_EXACTO_Y_NOMBRE_COMPATIBLE",
    "NIVEL_2_NOMBRE_EXACTO_Y_PREFIJO_EMAIL",
    "NIVEL_2_TYPO_DOMINIO_EMAIL",
    "NIVEL_3_NOMBRE_EXACTO_SIN_CONFLICTO_EMAIL",
}

manual_review_buckets = {
    "NIVEL_2_EMAIL_EXACTO_TARJETAHABIENTE_O_TERCERO_REVISAR",
    "NIVEL_3_NOMBRE_COMPLETO_3_TOKENS_DISTINTO_EMAIL",
    "NIVEL_4_HOMONIMO_O_EMAIL_DISTINTO_REVISAR",
    "NIVEL_4_SIMILITUD_NOMBRE_DIFUSO",
    "NIVEL_4_SUBCONJUNTO_NOMBRE_DIFUSO",
}

DUMMY_NAMES = {"NO MATCH/CAMBIAR", "APROBADO"}

clean_certeza_alta = []
excluded_dummy_n3 = []
excluded_shifted_email_n3 = []
manual_review_493 = []

for r in data["cases"]:
    b = r["confidence_level"]
    sa = r["side_a_duplicate_no_profile"]
    sb = r["side_b_target_with_profile"]
    uid_a = sa["user_id"]
    name_a = (sa.get("name") or "").strip().upper()
    phone_a = str(sa.get("phone") or "")
    sp_count = len(r.get("stripe_payments") or [])
    om_count = len(r.get("operational_matches") or [])

    if b in certeza_alta_buckets:
        if b == "NIVEL_3_NOMBRE_EXACTO_SIN_CONFLICTO_EMAIL":
            if name_a in DUMMY_NAMES:
                excluded_dummy_n3.append(r)
                continue
            if uid_a in blocked_uids or uid_a == 6803:
                excluded_shifted_email_n3.append(r)
                continue

        f2_rec = fase2_by_uid.get(uid_a)
        r_copy = json.loads(json.dumps(r))
        r_copy["before_state"] = {
            "source_user": {
                "id": sa["user_id"],
                "crm_id": sa["crm_id"],
                "name": sa["name"],
                "phone": sa["phone"],
                "email": sa["email"],
                "merged_into_id": None,
                "stripe_paid_count": sp_count,
                "op_matches_count": om_count,
                "in_fase2_insert": f2_rec is not None,
            },
            "target_user": {
                "id": sb["user_id"],
                "crm_id": sb["crm_id"],
                "name": sb["name"],
                "phone": sb["phone"],
                "email": sb["email"],
                "merged_into_id": None,
                "profile_plan_tier": sb.get("plan_tier"),
                "profile_city": sb.get("city"),
                "profile_age": sb.get("age"),
            },
        }
        r_copy["expected_after_state"] = {
            "source_user_id": sa["user_id"],
            "source_merged_into_id": sb["user_id"],
            "source_crm_id_after": None if (sb["crm_id"] is None and sa["crm_id"] is not None) else sa["crm_id"],
            "target_user_id": sb["user_id"],
            "target_crm_id_after": sb["crm_id"] if sb["crm_id"] is not None else sa["crm_id"],
            "target_email_after": sb["email"] if sb["email"] else sa["email"],
            "repoint_stripe_payments_from_source": sp_count,
            "repoint_operational_matches_from_source": om_count,
            "coalesce_profile_from_source_or_canonical": True,
        }
        clean_certeza_alta.append(r_copy)
    elif b in manual_review_buckets:
        manual_review_493.append(r)
    else:
        raise ValueError(f"Unknown bucket: {b}")

print(f"Total Certeza Alta raw: {len(clean_certeza_alta) + len(excluded_dummy_n3) + len(excluded_shifted_email_n3)}")
print(f"  -> Clean Certeza Alta to merge: {len(clean_certeza_alta)}")
print(f"  -> Excluded dummy N3 ('NO MATCH/CAMBIAR' / 'APROBADO'): {len(excluded_dummy_n3)}")
print(f"  -> Excluded Table-2 shifted-email N3: {len(excluded_shifted_email_n3)}")
print(f"Total Manual Review 493: {len(manual_review_493)}")

# 1. Write JSON for Certeza Alta Pre-Merge Audit
certeza_alta_payload = {
    "summary": {
        "total_certeza_alta_authorized_bucket_rows": 660,
        "clean_certeza_alta_to_merge": len(clean_certeza_alta),
        "excluded_dummy_status_names_in_nivel_3": len(excluded_dummy_n3),
        "excluded_shifted_email_table2_in_nivel_3": len(excluded_shifted_email_n3),
        "breakdown_by_bucket": {
            b: sum(1 for x in clean_certeza_alta if x["confidence_level"] == b)
            for b in sorted(certeza_alta_buckets)
        },
    },
    "records": clean_certeza_alta,
    "excluded_dummy_n3_uids": [x["side_a_duplicate_no_profile"]["user_id"] for x in excluded_dummy_n3],
    "excluded_shifted_email_n3_uids": [x["side_a_duplicate_no_profile"]["user_id"] for x in excluded_shifted_email_n3],
}

json_out = BASE / "fase1_certeza_alta_merge_audit_before_after.json"
json_out.write_text(json.dumps(certeza_alta_payload, ensure_ascii=False, indent=2), encoding="utf-8")

# 2. Write Markdown for Certeza Alta Pre-Merge Audit
md_lines = [
    "# Respaldo Antes → Después (Fase 1 — Fusión de Identidades de Certeza Alta)",
    "",
    "## Resumen Ejecutivo y Salvaguardas Aplicadas",
    "",
    "- **Total filas en buckets de Certeza Alta (`Nivel 1`, `1B`, `2`, `2-typo`, `3`)**: **660**",
    f"- **Fusiones limpias a ejecutar (`clean_certeza_alta_to_merge`)**: **{len(clean_certeza_alta)}**",
    "  - `NIVEL_1_EMAIL_Y_NOMBRE_EXACTO`: **57**",
    "  - `NIVEL_1B_EMAIL_EXACTO_Y_NOMBRE_COMPATIBLE`: **381**",
    "  - `NIVEL_2_NOMBRE_EXACTO_Y_PREFIJO_EMAIL`: **1**",
    "  - `NIVEL_2_TYPO_DOMINIO_EMAIL`: **9**",
    "  - `NIVEL_3_NOMBRE_EXACTO_SIN_CONFLICTO_EMAIL` (limpios): **13** (`UIDs: 15164, 5757, 5979, 6088, 6784, 6797, 6804, 6837, 5977, 6146, 8658, 8659, 9272`)",
    f"- **Excluidos en `Nivel 3` por salvaguarda de integridad**: **{len(excluded_dummy_n3) + len(excluded_shifted_email_n3)}**",
    f"  - **{len(excluded_dummy_n3)} filas basura de estado de Excel** (`name IN ('NO MATCH/CAMBIAR', 'APROBADO')`) que coincidían consigo mismas por string de estado, no por ser personas reales.",
    f"  - **{len(excluded_shifted_email_n3)} filas con teléfono sintético `+57300000...` y email corrido (Tabla 2)** (`36` en `blocked_email_collisions` + `UID=6803` `GINNA MARGARETH NIÑO` con `porrego2019@gmail.com`), cumpliendo la instrucción estricta de no tocar ni fusionar ningún registro de la Tabla 2.",
    "",
    "## Detalle Caso por Caso: 461 Fusiones de Certeza Alta (Antes → Después)",
    "",
    "| # | Nivel | ANTES: Source UID (A fusionar) | ANTES: Target UID (Canónico) | DESPUÉS: Acción (`merged_into_id`, `crm_id`, FKs y `COALESCE(profiles)`) |",
    "|---|---|---|---|---|",
]

for idx, r in enumerate(clean_certeza_alta, start=1):
    sa = r["side_a_duplicate_no_profile"]
    sb = r["side_b_target_with_profile"]
    exp = r["expected_after_state"]
    sp_count = len(r.get("stripe_payments") or [])
    om_count = len(r.get("operational_matches") or [])
    antes_a = (
        f"**UID={sa['user_id']}** (CRM={sa['crm_id']})<br>"
        f"`{sa['name']}`<br>"
        f"Tel: `{sa['phone']}` · Email: `{sa['email']}`<br>"
        f"Stripe={sp_count} · OpMatches={om_count}"
    )
    antes_b = (
        f"**UID={sb['user_id']}** (CRM={sb['crm_id']})<br>"
        f"`{sb['name']}`<br>"
        f"Tel: `{sb['phone']}` · Email: `{sb['email']}`<br>"
        f"Plan: `{sb.get('plan_tier')}` · Ciudad: `{sb.get('city')}` · Edad={sb.get('age')}"
    )
    despues = (
        f"`users[{sa['user_id']}].merged_into_id = {sb['user_id']}`<br>"
        f"Target `crm_id` → `{exp['target_crm_id_after']}` · Target `email` → `{exp['target_email_after']}`<br>"
        f"Repoint Stripe={exp['repoint_stripe_payments_from_source']}, OpMatches={exp['repoint_operational_matches_from_source']} + `COALESCE` profile"
    )
    md_lines.append(f"| {idx} | `{r['confidence_level']}` | {antes_a} | {antes_b} | {despues} |")

md_out = BASE / "fase1_certeza_alta_merge_audit_before_after.md"
md_out.write_text("\n".join(md_lines) + "\n", encoding="utf-8")

# 3. Write CSV and Markdown for the 493 Manual Review Cases (Human Team)
csv_out = BASE / "fase1_revision_manual_equipo_humano_493.csv"
with csv_out.open("w", encoding="utf-8-sig", newline="") as f:
    writer = csv.writer(f)
    writer.writerow([
        "case_number",
        "confidence_level",
        "why_same_person_or_review_reason",
        "side_a_user_id",
        "side_a_crm_id",
        "side_a_name",
        "side_a_phone",
        "side_a_email",
        "side_a_stripe_payments_count",
        "side_a_op_matches_count",
        "side_b_user_id",
        "side_b_crm_id",
        "side_b_name",
        "side_b_phone",
        "side_b_email",
        "side_b_plan_tier",
        "side_b_city",
        "side_b_age",
        "side_a_in_table2_shifted_email",
        "decision_equipo_humano_FUSIONAR_o_SEPARAR",
        "notas_equipo_humano",
    ])
    for idx, r in enumerate(manual_review_493, start=1):
        sa = r["side_a_duplicate_no_profile"]
        sb = r["side_b_target_with_profile"]
        sp_count = len(r.get("stripe_payments") or [])
        om_count = len(r.get("operational_matches") or [])
        in_table2 = "SI_EMAIL_CORRIDO_TABLA2" if (sa["user_id"] in blocked_uids or str(sa.get("phone") or "").startswith("+57300000")) else "NO"
        writer.writerow([
            idx,
            r["confidence_level"],
            r["why_same_person"],
            sa["user_id"],
            sa["crm_id"],
            sa["name"],
            sa["phone"],
            sa["email"],
            sp_count,
            om_count,
            sb["user_id"],
            sb["crm_id"],
            sb["name"],
            sb["phone"],
            sb["email"],
            sb.get("plan_tier"),
            sb.get("city"),
            sb.get("age"),
            in_table2,
            "",
            "",
        ])

manual_md_lines = [
    "# Lista de Revisión Manual para el Equipo Humano (493 Casos — NO Fusionados Automáticamente)",
    "",
    "> [!IMPORTANT]",
    "> Estos **493 casos** (`Nivel 2 Tarjetahabiente/Tercero`, `Nivel 3 Nombre 3 Tokens con Distinto Email`, y `Nivel 4 Homónimos / Similitud Difusa`) **NO fueron tocados ni fusionados**.",
    "> También se generó el archivo CSV descargable para Excel/Google Sheets en `scratch/fase1_revision_manual_equipo_humano_493.csv` con las columnas `decision_equipo_humano_FUSIONAR_o_SEPARAR` y `notas_equipo_humano`.",
    "",
    "## Desglose por Categoría",
    "",
    "- `NIVEL_2_EMAIL_EXACTO_TARJETAHABIENTE_O_TERCERO_REVISAR`: **18 casos** (Mismo email exacto, pero nombres de personas distintas: posible pago con tarjeta de pareja/familiar o email compartido).",
    "- `NIVEL_3_NOMBRE_COMPLETO_3_TOKENS_DISTINTO_EMAIL`: **5 casos** (Nombre completo de 3+ palabras idéntico, pero emails distintos y teléfonos distintos).",
    "- `NIVEL_4_HOMONIMO_O_EMAIL_DISTINTO_REVISAR`: **13 casos** (Nombre corto de 2 palabras idéntico con emails distintos: alto riesgo de homónimo real).",
    "- `NIVEL_4_SIMILITUD_NOMBRE_DIFUSO`: **53 casos** (Similitud difusa de nombre >= 0.86 sin email compartido).",
    "- `NIVEL_4_SUBCONJUNTO_NOMBRE_DIFUSO`: **404 casos** (Primer nombre + primer apellido coinciden con un nombre más largo, pero sin teléfono ni email común: requiere confirmar si es la misma persona o un homónimo).",
    "",
    "## Tabla Completa de los 493 Casos para Revisión Humana",
    "",
    "| # | Categoría | Registro A (`users` duplicado candidato) | Registro B (`users` + `profiles` existente) | Motivo / Alerta |",
    "|---|---|---|---|---|",
]

for idx, r in enumerate(manual_review_493, start=1):
    sa = r["side_a_duplicate_no_profile"]
    sb = r["side_b_target_with_profile"]
    sp_count = len(r.get("stripe_payments") or [])
    om_count = len(r.get("operational_matches") or [])
    warn = " ⚠️ **A tiene teléfono `+57300000` / Tabla 2**" if (sa["user_id"] in blocked_uids or str(sa.get("phone") or "").startswith("+57300000")) else ""
    col_a = (
        f"**UID={sa['user_id']}** (CRM={sa['crm_id']})<br>"
        f"`{sa['name']}`<br>"
        f"Tel: `{sa['phone']}` · Email: `{sa['email']}`<br>"
        f"Stripe={sp_count} · OpM={om_count}"
    )
    col_b = (
        f"**UID={sb['user_id']}** (CRM={sb['crm_id']})<br>"
        f"`{sb['name']}`<br>"
        f"Tel: `{sb['phone']}` · Email: `{sb['email']}`<br>"
        f"Plan: `{sb.get('plan_tier')}` · Ciudad: `{sb.get('city')}` · Edad: `{sb.get('age')}`"
    )
    manual_md_lines.append(
        f"| {idx} | `{r['confidence_level']}` | {col_a} | {col_b} | {r['why_same_person']}{warn} |"
    )

manual_md_out = BASE / "fase1_revision_manual_equipo_humano_493.md"
manual_md_out.write_text("\n".join(manual_md_lines) + "\n", encoding="utf-8")
print("Generated all pre-merge Certeza Alta and Manual Review 493 files successfully.")
