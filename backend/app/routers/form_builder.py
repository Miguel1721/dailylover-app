from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import json
import logging

from app.database import get_db
from app.core.permissions import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/forms", tags=["Form Builder"])

# ─── PYDANTIC SCHEMAS ─────────────────────────────────────────────────────────

class FormField(BaseModel):
    id: str
    label: str
    type: str  # 'text', 'dropdown', 'scale_1_10', 'boolean'
    options: Optional[List[str]] = []
    required: Optional[bool] = False
    help_text: Optional[str] = ""

class FormSection(BaseModel):
    id: str
    title: str
    order: Optional[int] = 1
    description: Optional[str] = ""
    fields: List[FormField] = []

class FormSchemaPayload(BaseModel):
    title: str
    description: Optional[str] = ""
    sections: List[FormSection]

# ─── DEFAULT SCHEMAS FACTORY ──────────────────────────────────────────────────

DEFAULT_SCHEMAS = {
    "datos_objetivos": {
        "title": "Datos Objetivos",
        "description": "Evaluación objetiva y estilo de vida del candidato",
        "sections": [
            {
                "id": "sec_social_estatus",
                "title": "Grupo Social & Estatus",
                "order": 1,
                "description": "Nivel social, cultural y educativo",
                "fields": [
                    {
                        "id": "social_group_score",
                        "label": "Social Group (1-10)",
                        "type": "scale_1_10",
                        "required": True,
                        "help_text": "Criterio de afinidad y grupo social del candidato"
                    },
                    {
                        "id": "education_level",
                        "label": "Nivel Educativo / Intelectual (1-10)",
                        "type": "scale_1_10",
                        "required": True,
                        "help_text": "Grado de preparación académica y afinidad intelectual"
                    },
                    {
                        "id": "mobility_travel",
                        "label": "Movilidad / Disposición a Viajar (1-10)",
                        "type": "scale_1_10",
                        "required": False,
                        "help_text": "Facilidad para desplazarse o tener citas internacionales/nacionales"
                    }
                ]
            },
            {
                "id": "sec_habitos_vida",
                "title": "Estilo de Vida & Hábitos",
                "order": 2,
                "description": "Rutinas diarias y energía personal",
                "fields": [
                    {
                        "id": "physical_activity_level",
                        "label": "Actividad Física / Fitness (1-10)",
                        "type": "scale_1_10",
                        "required": False,
                        "help_text": "Frecuencia e intensidad deportiva"
                    },
                    {
                        "id": "social_energy_level",
                        "label": "Energía Social (1-10)",
                        "type": "scale_1_10",
                        "required": True,
                        "help_text": "Introversión vs extroversión en entornos sociales"
                    },
                    {
                        "id": "life_structure_level",
                        "label": "Estructura de Vida / Rutina (1-10)",
                        "type": "scale_1_10",
                        "required": False,
                        "help_text": "Nivel de planeación y horarios fijos"
                    },
                    {
                        "id": "weekend_style",
                        "label": "Estilo de Fin de Semana Principal",
                        "type": "dropdown",
                        "options": ["Casero", "Activo urbano", "Naturaleza-aventura", "Social", "Mixto"],
                        "required": False,
                        "help_text": "Plan predilecto para fines de semana"
                    }
                ]
            },
            {
                "id": "sec_valores_vision",
                "title": "Valores & Visión de Vida",
                "order": 3,
                "description": "Aspectos fundamentales no negociables a largo plazo",
                "fields": [
                    {
                        "id": "religion_importance",
                        "label": "Importancia de la Religión / Espiritualidad (1-10)",
                        "type": "scale_1_10",
                        "required": False,
                        "help_text": "Peso que le da a la fe o espiritualidad en su pareja"
                    },
                    {
                        "id": "political_self_placement",
                        "label": "Orientación Política",
                        "type": "dropdown",
                        "options": ["apolítico", "centro", "derecha", "izquierda", "progresista", "conservador"],
                        "required": False,
                        "help_text": "Postura política declarada"
                    },
                    {
                        "id": "kids_importance",
                        "label": "Importancia de Hijos (1-10)",
                        "type": "scale_1_10",
                        "required": True,
                        "help_text": "Deseo de tener hijos o importancia de coincidir en este plan"
                    },
                    {
                        "id": "traditionalism_level",
                        "label": "Tradicionalismo / Roles de Pareja (1-10)",
                        "type": "scale_1_10",
                        "required": False,
                        "help_text": "Perspectiva sobre roles tradicionales vs modernos"
                    }
                ]
            }
        ]
    },
    "percepcion_psicologa": {
        "title": "Percepción Psicóloga",
        "description": "Evaluación clínica, lenguaje de afecto, banderas y síntesis matchmaker",
        "sections": [
            {
                "id": "sec_primera_impresion",
                "title": "Primera Impresión & Presencia",
                "order": 1,
                "description": "Postura, puntualidad y desenvoltura en entrevista",
                "fields": [
                    {
                        "id": "punctuality",
                        "label": "Puntualidad en Entrevista",
                        "type": "dropdown",
                        "options": ["A tiempo", "Tarde (< 10 min)", "Muy tarde (> 10 min)", "No se presentó"],
                        "required": True,
                        "help_text": "Cumplimiento en la hora acordada"
                    },
                    {
                        "id": "presentation_camera",
                        "label": "Cámara encendida y buena conexión",
                        "type": "boolean",
                        "required": True,
                        "help_text": "¿Estuvo en un entorno propicio para la videollamada?"
                    },
                    {
                        "id": "presentation_style",
                        "label": "Estilo de Presentación Personal",
                        "type": "dropdown",
                        "options": ["Arreglado", "Casual", "Desaliñado", "Formal"],
                        "required": False,
                        "help_text": "Cuidado estético para la sesión"
                    },
                    {
                        "id": "presentation_background",
                        "label": "Fondo / Entorno",
                        "type": "dropdown",
                        "options": ["Ordenado", "Desordenado", "Lugar público / oficina", "Vehículo / en movimiento"],
                        "required": False,
                        "help_text": "Espacio donde atendió la llamada"
                    },
                    {
                        "id": "speaking_confidence",
                        "label": "Seguridad al Hablar (1-10)",
                        "type": "scale_1_10",
                        "required": True,
                        "help_text": "Nivel de seguridad, elocuencia y soltura comunicativa"
                    },
                    {
                        "id": "conversation_lead",
                        "label": "Iniciativa / Capacidad de Liderar Conversación (1-10)",
                        "type": "scale_1_10",
                        "required": False,
                        "help_text": "Mantiene el ritmo o es reactivo"
                    }
                ]
            },
            {
                "id": "sec_historia_emocional",
                "title": "Historia Emocional & Cariño",
                "order": 2,
                "description": "Estilo vincular y patrones de apego",
                "fields": [
                    {
                        "id": "attachment_style",
                        "label": "Estilo de Apego Percibido",
                        "type": "dropdown",
                        "options": ["Seguro", "Ansioso", "Evitativo", "Desorganizado"],
                        "required": True,
                        "help_text": "Diagnóstico de estilo de vinculación afectiva"
                    },
                    {
                        "id": "emotional_processing",
                        "label": "Procesamiento Emocional (1-10)",
                        "type": "scale_1_10",
                        "required": True,
                        "help_text": "Capacidad de elaborar rupturas y gestionar emociones"
                    },
                    {
                        "id": "months_single",
                        "label": "Meses de Soltería Aproximados",
                        "type": "text",
                        "required": False,
                        "help_text": "Tiempo transcurrido desde su última relación formal"
                    },
                    {
                        "id": "self_awareness",
                        "label": "Nivel de Autoconocimiento (1-10)",
                        "type": "scale_1_10",
                        "required": True,
                        "help_text": "Claridad sobre sus virtudes, errores y áreas de mejora"
                    },
                    {
                        "id": "love_language_given",
                        "label": "Lenguaje de Amor que Brinda",
                        "type": "dropdown",
                        "options": ["Palabras de afirmación", "Actos de servicio", "Regalos", "Tiempo de calidad", "Contacto físico"],
                        "required": False,
                        "help_text": "Forma predilecta de expresar afecto"
                    },
                    {
                        "id": "love_language_received",
                        "label": "Lenguaje de Amor que Prefiere Recibir",
                        "type": "dropdown",
                        "options": ["Palabras de afirmación", "Actos de servicio", "Regalos", "Tiempo de calidad", "Contacto físico"],
                        "required": False,
                        "help_text": "Forma en que se siente más querido/a"
                    },
                    {
                        "id": "love_language_flexibility",
                        "label": "Flexibilidad en Lenguajes de Amor (1-10)",
                        "type": "scale_1_10",
                        "required": False,
                        "help_text": "Capacidad de adaptarse al lenguaje de su pareja"
                    }
                ]
            },
            {
                "id": "sec_tipo_fisico",
                "title": "Tipo Físico & Atracción",
                "order": 3,
                "description": "Preferencia estética y cuidado personal",
                "fields": [
                    {
                        "id": "physical_importance",
                        "label": "Importancia del Atractivo Físico para el Cliente (1-10)",
                        "type": "scale_1_10",
                        "required": True,
                        "help_text": "¿Qué tan determinante es el físico para este cliente?"
                    },
                    {
                        "id": "physical_traits_notes",
                        "label": "Observaciones de Complexión & Rasgos",
                        "type": "text",
                        "required": False,
                        "help_text": "Anotaciones sobre estatura, complexión, estilo visual o rasgos preferidos"
                    }
                ]
            },
            {
                "id": "sec_semaforo_clinico",
                "title": "Semáforo Clínico (Red & Green Flags)",
                "order": 4,
                "description": "Alertas y factores de protección",
                "fields": [
                    {
                        "id": "behavioral_risk_level",
                        "label": "Nivel de Riesgo Conductual (1 = Seguro, 10 = Alerta Roja)",
                        "type": "scale_1_10",
                        "required": True,
                        "help_text": "Evaluación de posibles conductas conflictivas o falta de madurez"
                    },
                    {
                        "id": "flags_notes",
                        "label": "Detalle de Red Flags / Green Flags",
                        "type": "text",
                        "required": False,
                        "help_text": "Anotaciones confidenciales de las banderas detectadas"
                    }
                ]
            },
            {
                "id": "sec_sintesis_matchmaker",
                "title": "Síntesis Matchmaker (Quick Notes)",
                "order": 5,
                "description": "Resumen ejecutivo para la sugerencia de matches",
                "fields": [
                    {
                        "id": "synthesis_who_really_is",
                        "label": "¿Quién es realmente? (Esencia del candidato)",
                        "type": "text",
                        "required": True,
                        "help_text": "Descripción concisa de la personalidad auténtica"
                    },
                    {
                        "id": "synthesis_first_date_behavior",
                        "label": "¿Cómo actúa en su primera cita?",
                        "type": "text",
                        "required": False,
                        "help_text": "Qué esperar de él/ella durante la primera salida"
                    },
                    {
                        "id": "synthesis_best_match_type",
                        "label": "¿Con qué tipo de persona haría un match perfecto?",
                        "type": "text",
                        "required": True,
                        "help_text": "Perfil complementario ideal"
                    }
                ]
            }
        ]
    }
}

# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@router.get("/schemas")
async def list_form_schemas(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista todos los formularios dinámicos configurables.
    """
    await ensure_form_schemas_table(db)
    res = await db.execute(text("SELECT form_code, title, description, updated_at, updated_by FROM form_schemas ORDER BY id ASC"))
    rows = res.fetchall()
    
    items = []
    for r in rows:
        items.append({
            "form_code": r.form_code,
            "title": r.title,
            "description": r.description,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            "updated_by": r.updated_by
        })
    return {"schemas": items}


@router.get("/schemas/{form_code}")
async def get_form_schema(
    form_code: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene el schema activo de un formulario específico.
    Si no existe aún en la base de datos, lo inicializa con el schema por defecto.
    """
    await ensure_form_schemas_table(db)
    res = await db.execute(
        text("SELECT id, form_code, title, description, sections, updated_at, updated_by FROM form_schemas WHERE form_code = :code"),
        {"code": form_code}
    )
    row = res.fetchone()
    
    if not row:
        if form_code in DEFAULT_SCHEMAS:
            default_data = DEFAULT_SCHEMAS[form_code]
            sec_json = json.dumps(default_data["sections"], ensure_ascii=False)
            insert_res = await db.execute(text("""
                INSERT INTO form_schemas (form_code, title, description, sections, updated_at, updated_by)
                VALUES (:code, :title, :desc, CAST(:sections AS jsonb), NOW(), 'System Seed')
                RETURNING id, form_code, title, description, sections, updated_at, updated_by;
            """), {
                "code": form_code,
                "title": default_data["title"],
                "desc": default_data.get("description", ""),
                "sections": sec_json
            })
            await db.commit()
            row = insert_res.fetchone()
        else:
            raise HTTPException(status_code=404, detail=f"Formulario '{form_code}' no existe.")

    sections = row.sections if isinstance(row.sections, list) else json.loads(row.sections or "[]")

    return {
        "id": row.id,
        "form_code": row.form_code,
        "title": row.title,
        "description": row.description,
        "sections": sections,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "updated_by": row.updated_by
    }


@router.put("/schemas/{form_code}")
async def update_form_schema(
    form_code: str,
    payload: FormSchemaPayload,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza el schema de un formulario (agregar, editar, reordenar, quitar campos).
    Solo permitido para Admin y María.
    """
    # Seguridad de roles
    user_role = (current_user.get("role_name") or "").lower()
    user_email = (current_user.get("email") or "").lower()
    is_admin = "admin" in user_role or "super" in user_role or "maria" in user_email or "miguel" in user_email or "agente.col.bot" in user_email

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores o María pueden modificar los schemas de formularios."
        )

    await ensure_form_schemas_table(db)

    # Convert sections to dicts for json dumping
    sections_dict = [s.dict() for s in payload.sections]
    sec_json = json.dumps(sections_dict, ensure_ascii=False)
    author = current_user.get("employee_name") or current_user.get("email") or "Admin"

    upsert_sql = """
        INSERT INTO form_schemas (form_code, title, description, sections, updated_at, updated_by)
        VALUES (:code, :title, :desc, CAST(:sections AS jsonb), NOW(), :author)
        ON CONFLICT (form_code) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            sections = EXCLUDED.sections,
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by
        RETURNING id, form_code, title, description, sections, updated_at, updated_by;
    """
    res = await db.execute(text(upsert_sql), {
        "code": form_code,
        "title": payload.title,
        "desc": payload.description or "",
        "sections": sec_json,
        "author": author
    })
    await db.commit()
    row = res.fetchone()

    logger.info(f"Schema '{form_code}' actualizado por {author}")

    return {
        "success": True,
        "message": f"Formulario '{form_code}' actualizado con éxito.",
        "schema": {
            "form_code": row.form_code,
            "title": row.title,
            "sections": row.sections if isinstance(row.sections, list) else json.loads(row.sections or "[]"),
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            "updated_by": row.updated_by
        }
    }


@router.post("/schemas/{form_code}/reset-default")
async def reset_form_schema_to_default(
    form_code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Restaura el schema predeterminado de fábrica para un formulario.
    """
    user_role = (current_user.get("role_name") or "").lower()
    user_email = (current_user.get("email") or "").lower()
    is_admin = "admin" in user_role or "super" in user_role or "maria" in user_email or "miguel" in user_email or "agente.col.bot" in user_email

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores o María pueden reiniciar los schemas de formularios."
        )

    if form_code not in DEFAULT_SCHEMAS:
        raise HTTPException(status_code=404, detail=f"No hay schema predeterminado para '{form_code}'.")

    default_data = DEFAULT_SCHEMAS[form_code]
    sec_json = json.dumps(default_data["sections"], ensure_ascii=False)
    author = current_user.get("employee_name") or current_user.get("email") or "Admin"

    await ensure_form_schemas_table(db)
    await db.execute(text("""
        INSERT INTO form_schemas (form_code, title, description, sections, updated_at, updated_by)
        VALUES (:code, :title, :desc, CAST(:sections AS jsonb), NOW(), :author)
        ON CONFLICT (form_code) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            sections = EXCLUDED.sections,
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by;
    """), {
        "code": form_code,
        "title": default_data["title"],
        "desc": default_data.get("description", ""),
        "sections": sec_json,
        "author": f"{author} (Reset)"
    })
    await db.commit()

    return {"success": True, "message": f"Formulario '{form_code}' restaurado a su versión inicial."}


# ─── HELPER: ENSURE TABLE & DYNAMIC_ANSWERS COLUMN ────────────────────────────

async def ensure_form_schemas_table(db: AsyncSession):
    """
    Garantiza que la tabla form_schemas y la columna dynamic_answers existan en la base de datos.
    """
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS form_schemas (
            id SERIAL PRIMARY KEY,
            form_code VARCHAR(50) UNIQUE NOT NULL,
            title VARCHAR(150) NOT NULL,
            description TEXT,
            sections JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_by VARCHAR(100) DEFAULT 'Admin'
        );
    """))
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_form_schemas_code ON form_schemas(form_code);
    """))
    await db.execute(text("""
        ALTER TABLE client_extended_profile ADD COLUMN IF NOT EXISTS dynamic_answers JSONB DEFAULT '{}'::jsonb;
    """))
    await db.commit()
