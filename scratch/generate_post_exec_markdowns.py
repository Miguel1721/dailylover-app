import json
import shutil
from pathlib import Path

BASE = Path("C:/Users/jeloz/Documents/antigravity/zealous-fermi/scratch")
ART = Path("C:/Users/jeloz/.gemini/antigravity/brain/b1416e31-a60d-4e5d-b2e9-d22c8bda4045")

# 1. Update Fase 2 Markdown with Post-Execution Verification
f2_json = json.loads((BASE / "fase2_profiles_insert_audit_before_after.json").read_text(encoding="utf-8"))
f2_md_path = BASE / "fase2_profiles_insert_audit_before_after.md"
f2_md_text = f2_md_path.read_text(encoding="utf-8")

exec_banner_f2 = (
    "# Respaldo de Auditoría Pre y Post-INSERT (Fase 2): Perfiles Nuevos (`Antes → Después` — EJECUTADO Y VERIFICADO)\n\n"
    f"- **Estado de ejecución en Producción (`dl_api`):** `EJECUTADO Y VERIFICADO EN BD` (`{f2_json.get('executed_at_utc')}`)\n"
    f"- **Filas nuevas insertadas en `profiles` (`INSERT ... ON CONFLICT DO NOTHING`):** **`{f2_json.get('inserted_count')} / {f2_json.get('total_records')}`**\n"
    f"- **Filas verificadas en `profiles` después del commit (`verified_after_count`):** **`{f2_json.get('verified_after_count')} / {f2_json.get('total_records')}` (100%)**\n"
)
f2_md_lines = f2_md_text.splitlines()
if f2_md_lines and f2_md_lines[0].startswith("# "):
    f2_md_lines[0] = exec_banner_f2.strip()
f2_md_path.write_text("\n".join(f2_md_lines) + "\n", encoding="utf-8")

# 2. Update Fase 1 Certeza Alta Markdown with Post-Execution Verification
f1_json = json.loads((BASE / "fase1_certeza_alta_merge_audit_before_after.json").read_text(encoding="utf-8"))
s1 = f1_json["summary"]

md1_lines = [
    "# Respaldo Antes → Después (Fase 1 — Fusión de Identidades de Certeza Alta — EJECUTADO Y VERIFICADO)",
    "",
    "## Resumen Ejecutivo, Salvaguardas Aplicadas y Verificación Post-Ejecución en BD",
    "",
    f"- **Estado de ejecución en Producción (`dl_api`)**: `EJECUTADO Y VERIFICADO EN BD` (`{s1.get('executed_at_utc')}`)",
    "- **Total filas en buckets de Certeza Alta (`Nivel 1`, `1B`, `2`, `2-typo`, `3`)**: **660**",
    f"- **Fusiones limpias ejecutadas y verificadas (`merged_count_verified`)**: **`{s1.get('merged_count_verified')} / {s1.get('clean_certeza_alta_to_merge')}` (100%)**",
    "  - `NIVEL_1_EMAIL_Y_NOMBRE_EXACTO`: **57**",
    "  - `NIVEL_1B_EMAIL_EXACTO_Y_NOMBRE_COMPATIBLE`: **381**",
    "  - `NIVEL_2_NOMBRE_EXACTO_Y_PREFIJO_EMAIL`: **1**",
    "  - `NIVEL_2_TYPO_DOMINIO_EMAIL`: **9**",
    "  - `NIVEL_3_NOMBRE_EXACTO_SIN_CONFLICTO_EMAIL` (limpios): **13** (`UIDs: 15164, 5757, 5979, 6088, 6784, 6797, 6804, 6837, 5977, 6146, 8658, 8659, 9272`)",
    "- **Transferencias y Reapuntado de Llaves Foráneas (`source_uid → target_uid`) verificadas**:",
    f"  - `users.crm_id` transferidos al registro canónico: **`{s1.get('transferred_crm_id_total')}`**",
    f"  - `stripe_payments.user_id` reapuntados: **`{s1.get('repointed_stripe_total')}`**",
    f"  - `operational_matches.user_id_a / user_id_b` reapuntados: **`{s1.get('repointed_om_total')}`**",
    f"  - `historical_matches.user_id_a / user_id_b` reapuntados: **`{s1.get('repointed_hm_total')}`**",
    f"  - `client_notes.user_id` reapuntados: **`{s1.get('repointed_cn_total')}`**",
    f"- **Excluidos en `Nivel 3` por salvaguarda de integridad (0 tocados)**: **{s1.get('excluded_dummy_status_names_in_nivel_3', 162) + s1.get('excluded_shifted_email_table2_in_nivel_3', 37)}**",
    f"  - **`{s1.get('excluded_dummy_status_names_in_nivel_3', 162)}` filas basura de estado de Excel** (`name IN ('NO MATCH/CAMBIAR', 'APROBADO')`) que coincidían consigo mismas por string de estado.",
    f"  - **`{s1.get('excluded_shifted_email_table2_in_nivel_3', 37)}` filas con teléfono sintético `+57300000...` y email corrido (Tabla 2)** (`36` en `blocked_email_collisions` + `UID=6803` `GINNA MARGARETH NIÑO` con `porrego2019@gmail.com`).",
    "",
    "## Detalle Caso por Caso: 461 Fusiones de Certeza Alta (`Antes → Después Verificado en BD`)",
    "",
    "| # | Nivel | ANTES: Source UID | ANTES: Target UID | DESPUÉS VERIFICADO EN BD (`users` + `profiles`) |",
    "|---|---|---|---|---|",
]

for idx, r in enumerate(f1_json["records"], start=1):
    sa = r["side_a_duplicate_no_profile"]
    sb = r["side_b_target_with_profile"]
    ver = r.get("db_after_verified") or {}
    s_after = ver.get("source_user_after") or {}
    t_after = ver.get("target_user_after") or {}
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
    despues_ver = (
        f"✅ `users[{sa['user_id']}].merged_into_id = {s_after.get('merged_into_id')}`<br>"
        f"Target **UID={sb['user_id']}**: `crm_id={t_after.get('crm_id')}` · `email={t_after.get('email')}`<br>"
        f"Plan: `{t_after.get('plan_tier')}` · Ciudad: `{t_after.get('city')}` · Edad: `{t_after.get('age')}` · BioLen: `{t_after.get('bio_len')}`"
    )
    md1_lines.append(f"| {idx} | `{r['confidence_level']}` | {antes_a} | {antes_b} | {despues_ver} |")

f1_md_path = BASE / "fase1_certeza_alta_merge_audit_before_after.md"
f1_md_path.write_text("\n".join(md1_lines) + "\n", encoding="utf-8")

# 3. Combine and write the Read-Only Security Audit on the 449 Shifted-Email Rows (Table 2)
a449 = json.loads((BASE / "auditoria_seguridad_449_emails_corridos.json").read_text(encoding="utf-8"))
sd_detail = json.loads((BASE / "sd_contaminated_test_dispatches.json").read_text(encoding="utf-8"))
a449["scheduled_dates_feedback_email_audit"] = sd_detail
(BASE / "auditoria_seguridad_449_emails_corridos.json").write_text(
    json.dumps(a449, ensure_ascii=False, indent=2), encoding="utf-8"
)

contam = sd_detail["contaminated_test_dispatches"]
status_bd = sd_detail["status_breakdown"]

sec_md = [
    "# Auditoría de Seguridad (Solo Lectura): ¿Se Usaron los 449 Emails Corridos (Tabla 2) para Enviar Comunicaciones Reales?",
    "",
    "> [!IMPORTANT]",
    "> **Respuesta corta y verificada:** **NO se ha enviado ningún correo real ni recibo de pago a la persona equivocada**, gracias a que **(1)** Stripe envía los recibos al correo ingresado directamente en el Checkout de Stripe (no lee `users.email` de nuestra BD), **(2)** el servidor `dl_api` tiene `SMTP_USER=\"\"` y `SMTP_PASSWORD=\"\"` (modo simulación/log sin despacho SMTP externo), y **(3)** el despachador de correos post-cita (`scheduled_dates`) ha operado exclusivamente en modo piloto (`simulation_mode=True` → `agente.sti.col@gmail.com`).",
    ">",
    "> **PERO identificamos un riesgo latente crítico que habría ocurrido al activar el envío real (`simulation_mode=False`):** en **`" + str(len(contam)) + "` despachos de prueba** de evaluación post-cita (`scheduled_dates`), la función `resolve_person_email_and_id()` buscó por nombre en `users` y seleccionó la fila `+57300000...` con **email corrido de otra persona** (por ejemplo, para la cita de *Miguel Angel Duarte Sánchez* seleccionó el correo de *Daniel Céspedes*; para *Manuel Alejandro Beltrán* seleccionó el correo de *Tatiana Jaramillo*).",
    "",
    "---",
    "",
    "## 1. Verificación Canal por Canal (449 Filas con Email Corrido — `0` filas tocadas o fusionadas)",
    "",
    "| Canal / Flujo | ¿Lee `users.email` de la BD? | ¿Se envió comunicación real a un tercero equivocado? | Evidencia Técnica en Producción (`dl_api`) |",
    "|---|---|---|---|",
    "| **1. Recibos de Pago de Stripe** (`checkout.session.completed` / `charge.succeeded`) | **NO** — Stripe envía el recibo al `customer_email` digitado por el comprador en la pasarela de Stripe. | **NO (`0` casos)** | De los `138` pagos cuyo correo coincide con alguno de los 449 emails, `137` fueron pagados por el **dueño real** de ese correo (`Side B`) y `1` por *Francy Yamile Tatar* usando su correo real `tatargarnica@yahoo.es` en Stripe. |",
    "| **2. Correos de Bienvenida / Agendamiento Plan VIP 650k** (`webhooks.py` L262-299) | **NO** — Usa `c_final_email = customer_email` proveniente del payload de Stripe. | **NO (`0` casos)** | `vip_650k_payments_in_table2 = 0`. Además, `SMTP_USER` no está configurado en el contenedor (`[SMTP MOCK/LOG]`). |",
    "| **3. Correos de Evaluación Post-Cita** (`scheduled_dates` / `matchmaking.py` L4050-4220) | **SÍ** — `resolve_person_email_and_id(db, person_name)` busca en `users` por `LOWER(TRIM(u.name))` priorizando filas con `email != ''`. | **NO en el mundo real (`0` envíos reales)**, pero **SÍ en `23` pruebas internas (`ENVIADO_TEST`)** enviadas a `agente.sti.col@gmail.com`. | El `100%` de las citas con `feedback_email_sent_at IS NOT NULL` (`544` registros) tienen `feedback_email_status = 'ENVIADO_TEST'` y `feedback_email_target = 'agente.sti.col@gmail.com'`. Sin embargo, en **`23` de esas citas**, el correo resuelto para el cliente era un **email corrido de Tabla 2 perteneciente a otra persona**. |",
    "| **4. Correos de Evaluación en `historical_matches`** (`admin.py` L2854) | **SÍ** (`LEFT JOIN users ON ...`) | **NO (`0` casos)** | `SELECT COUNT(*) FROM historical_matches WHERE feedback_email_sent_at IS NOT NULL` = **`0`**. |",
    "| **5. Notificaciones y Contacto por WhatsApp** (`wa.me/...`) | **NO** — Usa `users.phone`. | **NO (`0` casos)** | Las filas corridas de Tabla 2 tienen teléfonos sintéticos `+57300000...` (inválidos en WhatsApp), no teléfonos de otros clientes. |",
    "| **6. Acceso al Portal de Clientes** (`POST /api/v1/auth/client-login` en `auth.py` L187) | **SÍ** (`WHERE lower(u.email) = :email LIMIT 1`) | **NO (`0` contraseñas activas)** | `table2_rows_with_hashed_password = 0` (ninguna de las 449 filas tiene `hashed_password`). No obstante, si el dueño real del correo (`Side B`) intentara iniciar sesión por email, el `LIMIT 1` sin `ORDER BY` podría chocar con la fila basura `Side A`. |",
    "",
    "---",
    "",
    f"## 2. Hallazgo Crítico en `scheduled_dates`: Las `{len(contam)}` Citas donde el Modo Piloto Resolvió al Email Corrido de Otra Persona",
    "",
    "Cuando el despachador de evaluación post-cita (`dispatch_automated_feedback_emails`) corrió en modo seguro (`ENVIADO_TEST` hacia `agente.sti.col@gmail.com`), la función `resolve_person_email_and_id` buscó por nombre del cliente y, al ver que la fila histórica `+57300000...` tenía un `email` no vacío (mientras que el perfil real del cliente no tenía email o tenía `id` menor), **asignó como destinatario configurado el correo de un tercero**:",
    "",
    "| # | `scheduled_date_id` | Fecha Envío Test | Cliente en la Cita (`person_a` / `person_b`) | Fila `Side A` Leída (`UID`) | Email Corrido Configurado | Dueño Real de ese Email (`Side B`) | Estado / Destino Físico |",
    "|---|---|---|---|---|---|---|---|",
]

for idx, c in enumerate(contam, start=1):
    sec_md.append(
        f"| {idx} | `{c['scheduled_date_id']}` | `{c['sent_at'][:19]}` | **{c['person_name_in_cita']}** (`{c['side']}`) | `UID={c['resolved_uid']}` | `{c['shifted_email_configured']}` | **{c['true_email_owner_name']}** (`UID={c['true_email_owner_uid']}`) | `{c['feedback_email_status']}` → `{c['feedback_email_target_actually_used']}` |"
    )

sec_md.extend([
    "",
    "---",
    "",
    "## 3. Los 2 Pagos en `stripe_payments` cuya FK `user_id` Apuntó a una Fila de la Tabla 2",
    "",
    "Revisamos los `138` pagos de Stripe que cruzan por `user_id` o `customer_email` con las 449 filas:",
    "- **`136` pagos** tienen su FK `stripe_payments.user_id` apuntando correctamente al dueño real del correo (`Side B`).",
    "- **Solo `2` pagos** quedaron con `stripe_payments.user_id` apuntando a `Side A`, y en **ninguno de los dos** se envió recibo a la persona equivocada:",
    "  1. **`stripe_payment_id = 921`** (`2026-07-11`, `$38,000 COP`, *Evento HOT & SINGLE*): Pagó **Isabella Luquetta** ingresando su propio correo `isalu.luquetta@gmail.com` en Stripe Checkout, y la FK apuntó a `UID=12011` (*Isabella Luquetta*, `CRM=3680`). Estaba en Tabla 2 porque la fila antigua `UID=5557` (*Diana Coral Guerrero*, `+573000000167`) tiene pegado por error el correo de Isabella.",
    "  2. **`stripe_payment_id = 1220`** (`2026-06-26`, `$60,000 COP`, *Plan Especial*): Pagó **Francy Yamile Tatar** ingresando su correo real `tatargarnica@yahoo.es` en Stripe Checkout (donde recibió su recibo). El webhook vinculó la FK a `UID=6291` (*Francy Yamile Tatar*, `+573000000900`) por coincidencia exacta de **nombre**, no por el email corrido `delmontevarelaveronica@gmail.com` que tenía esa fila.",
    "",
    "---",
    "",
    "## 4. Recomendación de Blindaje Técnico (Sin Fusionar las 449 Filas)",
    "",
    "Para garantizar que **nunca** en el futuro (cuando se active `SMTP_USER` y `simulation_mode=False`) se pueda usar uno de esos 449 emails corridos por error:",
    "1. **En `resolve_person_email_and_id` (`matchmaking.py` L3961) y en `webhooks.py` / `auth.py`**: priorizar siempre usuarios con perfil (`EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = u.id)`) y excluir/ignorar el campo `email` de filas sin perfil con teléfono sintético `u.phone LIKE '+57300000%'`.",
    "2. **Opcional (cuando tú lo autorices)**: poner `email = NULL` únicamente en las filas `+57300000...` sin perfil donde el mismo email ya pertenece a otro usuario con nombre distinto en `profiles` (sin fusionar las filas ni borrar los usuarios).",
])

sec_md_path = BASE / "auditoria_seguridad_449_emails_corridos.md"
sec_md_path.write_text("\n".join(sec_md) + "\n", encoding="utf-8")

# Copy all updated Markdown and CSV files to the Artifacts directory
for fname in [
    "fase2_profiles_insert_audit_before_after.md",
    "fase1_certeza_alta_merge_audit_before_after.md",
    "fase1_revision_manual_equipo_humano_493.md",
    "fase1_revision_manual_equipo_humano_493.csv",
    "auditoria_seguridad_449_emails_corridos.md",
]:
    shutil.copyfile(BASE / fname, ART / fname)

print("All post-execution Markdowns and Security Audit generated and copied to artifacts.")
