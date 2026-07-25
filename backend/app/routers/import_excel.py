from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.config import get_settings, Settings
from app.core.permissions import require_permission
import pandas as pd
import io
import json
import anthropic
import asyncio
import random

router = APIRouter(prefix="/api/v1/admin", tags=["Import"])

# ─── FIELD MAPPING DEFINITIONS ────────────────────────────────────────────────

DB_FIELDS = {
    "clientes": [
        "users.name", "users.phone",
        "profiles.motivacion", "profiles.rol_social",
        "profiles.energia_social", "profiles.momento_vital",
        "profiles.intereses", "profiles.valores",
        "(ignorar)"
    ],
    "eventos": [
        "events.name", "events.date", "events.location",
        "events.format", "events.capacity", "events.price",
        "(ignorar)"
    ],
    "asistentes": [
        "event_attendees.event_id", "event_attendees.user_phone",
        "event_attendees.status", "(ignorar)"
    ]
}

# ─── EXCEL PREVIEW & AI MAPPING ───────────────────────────────────────────────

@router.post("/import/excel")
async def preview_excel(
    file: UploadFile = File(...),
    import_type: str = Form("clientes"),
    settings: Settings = Depends(get_settings),
    user: dict = Depends(require_permission("importar", "use"))
):
    """
    Upload an Excel/CSV file. Returns a preview of the data and AI-suggested
    column-to-field mapping using Claude.
    """
    if import_type not in DB_FIELDS:
        raise HTTPException(status_code=400, detail=f"Tipo inválido: {import_type}. Use: {list(DB_FIELDS.keys())}")

    # Read file into dataframe
    content = await file.read()
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content), dtype=str)
        else:
            df = pd.read_excel(io.BytesIO(content), dtype=str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al leer el archivo: {str(e)}")

    # Clean up: drop fully empty rows/cols, strip whitespace
    df = df.dropna(how="all").fillna("")
    df.columns = [str(c).strip() for c in df.columns]

    columns = list(df.columns)
    rows = df.to_dict(orient="records")

    if not columns:
        raise HTTPException(status_code=400, detail="El archivo no tiene columnas reconocibles")

    # Ask Claude to map columns
    available_fields = DB_FIELDS[import_type]
    sample_rows = rows[:3]

    prompt = f"""Eres un asistente experto en mapeo de datos para un CRM de matchmaking en Colombia.

Se está importando un Excel de tipo: **{import_type}**

Las columnas del archivo son:
{json.dumps(columns, ensure_ascii=False)}

Muestra de datos (primeras 3 filas):
{json.dumps(sample_rows, ensure_ascii=False, default=str)}

Los campos disponibles en la base de datos son:
{json.dumps(available_fields, ensure_ascii=False)}

Tu tarea: mapear CADA columna del Excel al campo de BD más apropiado.
Si una columna no corresponde a ningún campo, usa "(ignorar)".

Reglas:
- Columnas de nombre/nombre completo → users.name
- Columnas de teléfono/celular/whatsapp → users.phone
- Si hay columnas de tipo motivación, busca si dice exploración/conexión/diversión → profiles.motivacion
- El campo profiles.intereses y profiles.valores esperan listas separadas por comas
- Devuelve SOLO un JSON válido, sin explicación, con formato: {{"columna_excel": "campo.db", ...}}

Responde SOLO con el JSON, sin markdown, sin texto adicional."""

    if settings.demo_mode:
        await asyncio.sleep(random.uniform(1.2, 2.0))
        mapping = _heuristic_fallback(columns, import_type)
    else:
        try:
            # Pass base_url if it's set (for proxy usage like z.ai)
            client_args = {"api_key": settings.anthropic_api_key}
            if settings.anthropic_base_url:
                client_args["base_url"] = settings.anthropic_base_url
            client = anthropic.Anthropic(**client_args)

            message = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )
            mapping_text = message.content[0].text.strip()
            # Strip markdown code fences if present
            if mapping_text.startswith("```"):
                mapping_text = mapping_text.split("```")[1]
                if mapping_text.startswith("json"):
                    mapping_text = mapping_text[4:]
            mapping = json.loads(mapping_text)
        except Exception as e:
            import traceback
            traceback.print_exc()
            # Fallback: smart heuristic column mapping
            mapping = _heuristic_fallback(columns, import_type)

    return {
        "columns": columns,
        "mapping": mapping,
        "rows": rows,
        "total_rows": len(rows),
        "import_type": import_type
    }


# ─── CONFIRM & INSERT ─────────────────────────────────────────────────────────

@router.post("/import/confirm")
async def confirm_import(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("importar", "use"))
):
    """
    Confirm and execute the import using the user-reviewed mapping.
    Handles clientes, eventos, and asistentes.
    """
    import_type = payload.get("import_type", "clientes")
    mapping: dict = payload.get("mapping", {})
    rows: list = payload.get("data", [])

    if not rows:
        raise HTTPException(status_code=400, detail="No hay datos para importar")

    imported = 0
    skipped = 0
    errors = 0

    if import_type == "clientes":
        for row in rows:
            mapped = _apply_mapping(row, mapping)
            user_data = {k.replace("users.", ""): v for k, v in mapped.items() if k.startswith("users.")}
            profile_data = {k.replace("profiles.", ""): v for k, v in mapped.items() if k.startswith("profiles.")}

            phone = user_data.get("phone", "").strip()
            if not phone:
                skipped += 1
                continue

            # Normalize phone
            phone = phone.replace(" ", "").replace("-", "")
            if not phone.startswith("+"):
                phone = "+57" + phone.lstrip("0")

            try:
                # Upsert user
                result = await db.execute(text("""
                    INSERT INTO users (phone, name)
                    VALUES (:phone, :name)
                    ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
                    RETURNING id
                """), {"phone": phone, "name": user_data.get("name", "").strip() or None})
                user_id = result.scalar()

                # Insert/update profile if we have data
                if profile_data:
                    # Handle list fields
                    for list_field in ("intereses", "valores"):
                        if list_field in profile_data and isinstance(profile_data[list_field], str):
                            profile_data[list_field] = [
                                x.strip() for x in profile_data[list_field].split(",") if x.strip()
                            ] or None

                    await db.execute(text("""
                        INSERT INTO profiles (user_id, motivacion, rol_social, energia_social, momento_vital, intereses, valores)
                        VALUES (:uid, :motivacion, :rol_social, :energia_social, :momento_vital, :intereses, :valores)
                        ON CONFLICT (user_id) DO UPDATE SET
                            motivacion = COALESCE(EXCLUDED.motivacion, profiles.motivacion),
                            rol_social = COALESCE(EXCLUDED.rol_social, profiles.rol_social),
                            energia_social = COALESCE(EXCLUDED.energia_social, profiles.energia_social),
                            momento_vital = COALESCE(EXCLUDED.momento_vital, profiles.momento_vital),
                            intereses = COALESCE(EXCLUDED.intereses, profiles.intereses),
                            valores = COALESCE(EXCLUDED.valores, profiles.valores),
                            updated_at = NOW()
                    """), {
                        "uid": user_id,
                        "motivacion": profile_data.get("motivacion") or None,
                        "rol_social": profile_data.get("rol_social") or None,
                        "energia_social": _safe_float(profile_data.get("energia_social")),
                        "momento_vital": profile_data.get("momento_vital") or None,
                        "intereses": profile_data.get("intereses") or None,
                        "valores": profile_data.get("valores") or None,
                    })
                imported += 1
            except Exception:
                errors += 1
                continue

        await db.commit()

    elif import_type == "eventos":
        for row in rows:
            mapped = _apply_mapping(row, mapping)
            ev = {k.replace("events.", ""): v for k, v in mapped.items() if k.startswith("events.")}
            if not ev.get("name") or not ev.get("date"):
                skipped += 1
                continue
            try:
                await db.execute(text("""
                    INSERT INTO events (name, date, location, format, capacity, price)
                    VALUES (:name, :date, :location, :format, :capacity, :price)
                    ON CONFLICT DO NOTHING
                """), {
                    "name": ev.get("name"),
                    "date": ev.get("date"),
                    "location": ev.get("location") or None,
                    "format": ev.get("format") or None,
                    "capacity": _safe_int(ev.get("capacity")),
                    "price": _safe_float(ev.get("price")),
                })
                imported += 1
            except Exception:
                errors += 1

        await db.commit()

    elif import_type == "asistentes":
        for row in rows:
            mapped = _apply_mapping(row, mapping)
            ea = {k.replace("event_attendees.", ""): v for k, v in mapped.items() if k.startswith("event_attendees.")}
            event_id = _safe_int(ea.get("event_id"))
            user_phone = ea.get("user_phone", "").strip()
            if not event_id or not user_phone:
                skipped += 1
                continue
            try:
                uid_row = (await db.execute(text("SELECT id FROM users WHERE phone = :p"), {"p": user_phone})).fetchone()
                if not uid_row:
                    skipped += 1
                    continue
                await db.execute(text("""
                    INSERT INTO event_attendees (event_id, user_id, status)
                    VALUES (:eid, :uid, :status)
                    ON CONFLICT DO NOTHING
                """), {"eid": event_id, "uid": uid_row.id, "status": ea.get("status", "pending")})
                imported += 1
            except Exception:
                errors += 1

        await db.commit()

    else:
        raise HTTPException(status_code=400, detail=f"Tipo de importación no soportado: {import_type}")

    return {"imported": imported, "skipped": skipped, "errors": errors, "import_type": import_type}


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def _apply_mapping(row: dict, mapping: dict) -> dict:
    """Apply column → field mapping to a single row dict."""
    result = {}
    for col, field in mapping.items():
        if field and field != "(ignorar)" and col in row:
            result[field] = row[col]
    return result


def _safe_int(v) -> int | None:
    try:
        return int(float(str(v).replace(",", "."))) if v else None
    except Exception:
        return None


def _safe_float(v) -> float | None:
    try:
        return float(str(v).replace(",", ".")) if v else None
    except Exception:
        return None


def _heuristic_fallback(columns: list, import_type: str) -> dict:
    """Heuristic fallback mapping when AI call fails."""
    mapping = {}

    col_mappings = {
        "clientes": {
            "users.name": ["nombre", "name", "completo", "usuario", "cliente"],
            "users.phone": ["telefono", "teléfono", "celular", "whatsapp", "phone", "cel", "nro", "numero", "número"],
            "users.email": ["email", "correo", "mail"],
            "profiles.motivacion": ["motivacion", "motivación", "motivo", "busqueda", "búsqueda"],
            "profiles.rol_social": ["rol", "social", "perfil"],
            "profiles.energia_social": ["energia", "energía"],
            "profiles.momento_vital": ["momento", "vital", "etapa"],
            "profiles.intereses": ["intereses", "hobbies", "gustos", "interes", "hobbie"],
            "profiles.valores": ["valores", "principios"]
        },
        "eventos": {
            "events.name": ["nombre", "name", "evento", "titulo", "título"],
            "events.date": ["fecha", "date", "hora", "cuando", "cuándo"],
            "events.location": ["lugar", "ubicacion", "ubicación", "sitio", "direccion", "dirección"],
            "events.format": ["formato", "tipo", "modalidad"],
            "events.capacity": ["capacidad", "cupos", "aforo", "cantidad", "max"],
            "events.price": ["precio", "costo", "valor", "tarifa", "cop"]
        },
        "asistentes": {
            "event_attendees.event_id": ["evento", "event", "id_evento", "id"],
            "event_attendees.user_phone": ["telefono", "teléfono", "celular", "whatsapp", "phone", "usuario"],
            "event_attendees.status": ["estado", "status", "asistencia", "confirmado"]
        }
    }

    rules = col_mappings.get(import_type, {})

    for col in columns:
        col_lower = col.lower()
        matched = False
        # Try to find a matching field based on keywords
        for field, keywords in rules.items():
            if any(kw in col_lower for kw in keywords):
                mapping[col] = field
                matched = True
                break
        if not matched:
            mapping[col] = "(ignorar)"

    return mapping
