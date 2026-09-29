"""
Plantillas de correo que el equipo envía a una persona desde el admin (botón "Correo" en Perfiles).

Los TEXTOS son provisionales: para cambiarlos basta editar las funciones `_body_*` y los asuntos de TEMPLATES.
Cada plantilla recibe un dict `ctx` con los datos de la persona (ver `build_context`) y devuelve el cuerpo HTML;
el marco visual (oscuro/dorado) lo pone `_interview_email_shell` para que todos los correos se vean igual.
"""
import json
import html as _html
from typing import Any, Dict, List, Optional, Tuple

from app.services.email_service import _interview_email_shell, _first_name, INTERVIEW_CALENDLY_URL

# Datos que se piden en la ficha y cómo se le nombran a la persona en el correo.
_MISSING_FRIENDLY = {
    "Edad": "tu edad",
    "Ciudad": "tu ciudad de residencia",
    "Género": "tu género",
    "Estatura": "tu estatura",
    "Notas de Entrevista": "completar tu entrevista con nuestro equipo",
    "Qué busca en Pareja": "qué buscas en tu pareja ideal",
}


def compute_missing_fields(row: Any) -> List[str]:
    """Mismos criterios de 'ficha incompleta' que la lista de Perfiles."""
    missing: List[str] = []
    if not getattr(row, "age", None):
        missing.append("Edad")
    if not getattr(row, "city", None) or str(row.city).strip().lower() in ("no especificada", "none", ""):
        missing.append("Ciudad")
    if not getattr(row, "gender", None) or str(row.gender).strip().lower() in ("no especificado", "none", ""):
        missing.append("Género")
    if not getattr(row, "estatura", None) or not str(row.estatura).strip():
        missing.append("Estatura")
    if len((getattr(row, "bio_notes", None) or "").strip()) < 25:
        missing.append("Notas de Entrevista")
    sp = getattr(row, "search_preferences", None) or {}
    if isinstance(sp, str):
        try:
            sp = json.loads(sp)
        except Exception:
            sp = {}
    if not sp or (not sp.get("min_age") and not sp.get("what_searches") and not sp.get("what_searches_in_partner")):
        missing.append("Qué busca en Pareja")
    return missing


def build_context(row: Any) -> Dict[str, Any]:
    """Arma los datos de la persona que usan las plantillas a partir de una fila users + profiles."""
    return {
        "user_id": row.id,
        "name": row.name or "",
        "first_name": _first_name(row.name or ""),
        "email": (row.email or "").strip(),
        "plan_tier": row.plan_tier or "",
        "responsable": row.responsable or "",
        "missing": compute_missing_fields(row),
    }


def _esc(s: str) -> str:
    return _html.escape(s or "", quote=True)


def _button(url: str, label: str) -> str:
    return (
        f'<div style="text-align:center;margin:24px 0;">'
        f'<a href="{_esc(url)}" style="background:linear-gradient(135deg,#D4AF37 0%,#AA820A 100%);color:#0D0A0B !important;'
        f'font-weight:700;font-size:16px;text-decoration:none;padding:14px 30px;border-radius:8px;display:inline-block;">{_esc(label)}</a></div>'
    )


def _signature() -> str:
    return '<p style="margin-top:22px;">Un abrazo,<br><strong>Equipo Daily Lover</strong></p>'


# ─── Cuerpos (textos provisionales) ─────────────────────────────────────────

def _body_no_hay_gente(ctx: Dict[str, Any]) -> str:
    return f"""
      <p>Hola <strong>{_esc(ctx['first_name'])}</strong>,</p>
      <p>Queremos contarte cómo va tu proceso: por ahora <strong>no tenemos una persona que cumpla con lo que buscas</strong> y que además sea compatible contigo.</p>
      <p>No es que hayamos dejado de buscar. Preferimos esperar a la persona indicada antes que presentarte una cita que no valga la pena. Seguimos revisando cada perfil nuevo que llega y, apenas aparezca alguien compatible, te escribimos.</p>
      <p>Si quieres ampliar un poco lo que buscas (edad, ciudad u otros detalles), respóndenos este correo y lo revisamos juntas.</p>
      {_signature()}"""


def _body_completar_perfil(ctx: Dict[str, Any]) -> str:
    items = [_MISSING_FRIENDLY.get(m, m.lower()) for m in ctx["missing"]]
    if items:
        lista = "".join(f'<li style="margin:4px 0;">{_esc(i)}</li>' for i in items)
        bloque = f'<p>Para poder presentarte personas realmente compatibles, nuestras psicólogas necesitan completar en tu ficha:</p><ul style="padding-left:20px;color:#F0D98A;">{lista}</ul>'
    else:
        bloque = "<p>Queremos confirmar contigo que los datos de tu ficha estén al día para poder presentarte personas compatibles.</p>"
    return f"""
      <p>Hola <strong>{_esc(ctx['first_name'])}</strong>,</p>
      <p>¡Gracias por ser parte de Daily Lover! 💛</p>
      {bloque}
      <p>Respóndenos este correo con esa información (o escríbenos por WhatsApp) y la actualizamos de inmediato. Entre más completa esté tu ficha, mejores serán tus matches.</p>
      {_signature()}"""


def _body_agendar_entrevista(ctx: Dict[str, Any]) -> str:
    return f"""
      <p>Hola <strong>{_esc(ctx['first_name'])}</strong>,</p>
      <p>El siguiente paso para empezar a presentarte personas compatibles es tu <strong>entrevista con nuestro equipo</strong>. Es una conversación corta en la que conocemos quién eres y qué buscas.</p>
      <p>Elige el día y la hora que mejor te queden aquí:</p>
      {_button(INTERVIEW_CALENDLY_URL, "📅 Agendar mi entrevista")}
      <p style="font-size:12px;color:#9A8A8D;text-align:center;margin:0 0 16px;">Si el botón no abre, copia y pega este enlace:<br><span style="word-break:break-all;color:#C5B083;">{_esc(INTERVIEW_CALENDLY_URL)}</span></p>
      {_signature()}"""


def _body_seguimiento(ctx: Dict[str, Any]) -> str:
    return f"""
      <p>Hola <strong>{_esc(ctx['first_name'])}</strong>,</p>
      <p>Te escribimos para contarte que <strong>tu proceso sigue en marcha</strong>. Nuestro equipo está trabajando en tus propuestas de match y revisándolas con cuidado para que cada cita tenga sentido para ti.</p>
      <p>A veces este paso toma unos días porque cuidamos que la persona que te presentemos sea la indicada. En cuanto tengamos novedades o una cita para ti, te avisamos por aquí.</p>
      <p>Si algo cambió en tu disponibilidad o en lo que buscas, cuéntanos respondiendo este correo.</p>
      {_signature()}"""


# key → definición. El orden es el que se muestra en el modal.
TEMPLATES: Dict[str, Dict[str, Any]] = {
    "no_hay_gente": {
        "label": "No hay gente por ahora",
        "description": "Le avisa que seguimos buscando y que le escribiremos cuando haya alguien compatible.",
        "subject": "Seguimos buscando a tu persona ideal — Daily Lover",
        "body": _body_no_hay_gente,
    },
    "completar_perfil": {
        "label": "Completa tu ficha",
        "description": "Pide los datos que le faltan en la ficha (se arma con lo que realmente falta).",
        "subject": "Completa tu ficha para presentarte mejores matches — Daily Lover",
        "body": _body_completar_perfil,
    },
    "agendar_entrevista": {
        "label": "Agenda tu entrevista",
        "description": "Invita a agendar la entrevista con el equipo (botón al agendador).",
        "subject": "Agenda tu entrevista con Daily Lover",
        "body": _body_agendar_entrevista,
    },
    "seguimiento": {
        "label": "Tu proceso sigue en marcha",
        "description": "Actualización general: estamos trabajando en sus propuestas de match.",
        "subject": "Tu proceso en Daily Lover sigue en marcha",
        "body": _body_seguimiento,
    },
}


def list_templates() -> List[Dict[str, str]]:
    return [{"key": k, "label": v["label"], "description": v["description"]} for k, v in TEMPLATES.items()]


def render_template(key: str, ctx: Dict[str, Any]) -> Optional[Tuple[str, str]]:
    """Devuelve (asunto, html) o None si la plantilla no existe."""
    tpl = TEMPLATES.get(key)
    if not tpl:
        return None
    return tpl["subject"], _interview_email_shell(tpl["subject"], tpl["body"](ctx))
