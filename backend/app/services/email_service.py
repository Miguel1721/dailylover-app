import os
import re
import smtplib
from typing import Optional, List, Dict, Any
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "no-reply@dailylover.app")
APP_BASE_URL = os.getenv("APP_BASE_URL", "https://daily-lover.agentesia.cloud")
OWNER_EMAIL = os.getenv("OWNER_EMAIL", "maria.salinas@dailylover.org")

def send_email_html(to_email: str, subject: str, html_content: str) -> bool:
    """Envía un correo electrónico HTML o simula el envío si no hay credenciales SMTP."""
    if not to_email or "@" not in to_email:
        logger.warning(f"Email inválido omitido: {to_email}")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Daily Lover Matchmaking <{SENDER_EMAIL}>"
    msg["To"] = to_email

    part = MIMEText(html_content, "html", "utf-8")
    msg.attach(part)

    if not SMTP_USER or not SMTP_PASSWORD:
        logger.info(f"💌 [SMTP MOCK/LOG] Correo enviado a {to_email} | Asunto: '{subject}'")
        print(f"\n==========================================")
        print(f"💌 EMAIL SIMULADO -> Para: {to_email}")
        print(f"📌 Asunto: {subject}")
        print(f"==========================================\n")
        return True

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SENDER_EMAIL, [to_email], msg.as_string())
        logger.info(f"✅ Correo SMTP enviado exitosamente a {to_email}")
        return True
    except Exception as e:
        logger.error(f"❌ Error enviando correo SMTP a {to_email}: {str(e)}")
        return False


TEST_SAFE_FEEDBACK_EMAIL = os.getenv("TEST_SAFE_FEEDBACK_EMAIL", "agente.sti.col@gmail.com")

def build_feedback_email_html(
    user_name: str,
    partner_name: str,
    match_id: Optional[int] = None,
    user_id: Optional[int] = None,
    cal_id: Optional[int] = None,
    venue: str = "",
    city: str = "",
    date_time_str: str = "",
    simulation_mode: bool = True,
    real_user_email: str = ""
) -> str:
    """Construye la plantilla HTML del correo para evaluación post-cita con soporte de modo seguro."""
    params = []
    if match_id:
        params.append(f"match_id={match_id}")
    if user_id:
        params.append(f"user_id={user_id}")
    if cal_id:
        params.append(f"cal_id={cal_id}")
    query_str = f"?{'&'.join(params)}" if params else ""
    feedback_link = f"{APP_BASE_URL}/admin/evaluacion-cita{query_str}"
    
    simulation_banner = ""
    if simulation_mode:
        simulation_banner = f"""
        <div style="background-color: rgba(212, 175, 55, 0.15); border: 1.5px dashed #D4AF37; border-radius: 10px; padding: 14px 18px; margin-bottom: 22px; color: #FFF; font-size: 13px; line-height: 1.5;">
          <strong style="color: #FFD700; font-size: 14px;">⚠️ MODO PILOTO DE PRUEBA ACTIVO (Seguridad):</strong><br/>
          Este correo fue generado por el despachador automático para el cliente: <strong>{user_name}</strong> (<code>{real_user_email or 'Sin correo en perfil'}</code>).<br/>
          Encuentro: Con <strong>{partner_name}</strong> {f'en {venue} ({city})' if venue else ''} {f'· {date_time_str}' if date_time_str else ''}.<br/>
          <em>(El envío real a clientes está deshabilitado temporalmente; este mensaje fue despachado a <code>{TEST_SAFE_FEEDBACK_EMAIL}</code> para validación).</em>
        </div>
        """

    return f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Evaluación Post-Cita — Daily Lover</title>
      <style>
        body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0D0A0B; color: #F5F0F1; margin: 0; padding: 20px; }}
        .card {{ max-width: 580px; margin: 0 auto; background-color: #1A1214; border: 1px solid rgba(150, 21, 0, 0.4); border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
        .header {{ text-align: center; border-bottom: 1px solid rgba(150, 21, 0, 0.2); padding-bottom: 20px; margin-bottom: 24px; }}
        .logo {{ font-size: 24px; font-weight: 800; color: #961500; letter-spacing: 1px; }}
        .subtitle {{ font-size: 13px; color: #9A8A8D; margin-top: 4px; }}
        .content {{ font-size: 15px; line-height: 1.6; color: #E5DFE1; }}
        .alert-box {{ background-color: rgba(150, 21, 0, 0.12); border-left: 4px solid #961500; padding: 14px; border-radius: 8px; margin: 20px 0; font-size: 13px; color: #F5F0F1; }}
        .btn-container {{ text-align: center; margin: 30px 0; }}
        .btn {{ background-color: #961500; color: #ffffff !important; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 15px rgba(150, 21, 0, 0.4); transition: all 0.2s; }}
        .footer {{ font-size: 12px; color: #7A6A6D; text-align: center; margin-top: 28px; border-top: 1px solid rgba(150, 21, 0, 0.15); padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="logo">🌹 DAILY LOVER</div>
          <div class="subtitle">Acompañamiento Clínico & Matchmaking Humano</div>
        </div>

        {simulation_banner}

        <div class="content">
          <p>Hola <strong>{user_name}</strong>,</p>
          <p>Esperamos que tu reciente encuentro con <strong>{partner_name}</strong> haya sido una experiencia enriquecedora.</p>
          
          <div class="alert-box">
            📌 <strong>RETROALIMENTACIÓN DE TU DATE:</strong> Para el equipo de psicología y matchmaking de Daily Lover es fundamental conocer cómo te sentiste antes, durante y después del encuentro, para afinar tus criterios y desbloquear tus siguientes propuestas de matching.
          </div>

          <p>Nos interesa conocer tu opinión honesta sobre:</p>
          <ul>
            <li>El ambiente y la experiencia en el restaurante{f' ({venue})' if venue else ''}.</li>
            <li>La puntualidad y la química con <strong>{partner_name}</strong>.</li>
            <li>Si deseas una segunda cita o afinar las preferencias de tu perfil.</li>
          </ul>

          <div class="btn-container">
            <a href="{feedback_link}" class="btn" style="color: #ffffff !important;">⭐ Calificar mi Cita con {partner_name}</a>
          </div>

          <p style="font-size: 12px; color: #9A8A8D; text-align: center;">
            Si el botón no abre directamente, copia y pega este enlace en tu navegador:<br>
            <a href="{feedback_link}" style="color: #FF5A36;">{feedback_link}</a>
          </p>
        </div>

        <div class="footer">
          © 2026 Daily Lover App. Todos los derechos reservados.<br>
          Bogotá, Medellín & Principales Ciudades, Colombia.
        </div>
      </div>
    </body>
    </html>
    """


def send_automated_feedback_email(
    user_name: str,
    real_user_email: str,
    partner_name: str,
    match_id: Optional[int] = None,
    user_id: Optional[int] = None,
    cal_id: Optional[int] = None,
    date_time_str: str = "",
    venue: str = "",
    city: str = "",
    simulation_mode: bool = True
) -> Dict[str, Any]:
    """
    Despacha el correo de evaluación post-cita.
    En modo simulación (default=True):
    - El destinatario físico SMTP es SIEMPRE agente.sti.col@gmail.com
    - El asunto y cuerpo dejan constancia transparente de para quién estaba configurado
    """
    to_email = TEST_SAFE_FEEDBACK_EMAIL if simulation_mode else (real_user_email or TEST_SAFE_FEEDBACK_EMAIL)
    if simulation_mode:
        subject = f"[TEST FEEDBACK] Para: {user_name} ({real_user_email or 'Sin correo'}) — ¿Cómo estuvo tu date con {partner_name}? ⭐"
    else:
        subject = f"¿Cómo estuvo tu date con {partner_name}? ⭐ Cuéntanos tu experiencia — Daily Lover"

    html = build_feedback_email_html(
        user_name=user_name,
        partner_name=partner_name,
        match_id=match_id,
        user_id=user_id,
        cal_id=cal_id,
        venue=venue,
        city=city,
        date_time_str=date_time_str,
        simulation_mode=simulation_mode,
        real_user_email=real_user_email
    )

    success = send_email_html(to_email, subject, html)
    return {
        "success": success,
        "recipient": to_email,
        "configured_for_email": real_user_email,
        "client_name": user_name,
        "partner_name": partner_name,
        "simulation_mode": simulation_mode
    }



def build_vip_650k_notification_html(
    customer_name: str,
    customer_email: str,
    customer_phone: str,
    amount_cop: float,
    currency: str = "COP",
    user_id: Optional[int] = None
) -> str:
    """Plantilla de correo de alta prioridad para María Salinas ante nuevo pago del Plan VIP 650k."""
    clean_phone = re.sub(r"[^\d]", "", customer_phone or "")
    if clean_phone.startswith("57") and len(clean_phone) == 12:
        wa_link = f"https://wa.me/{clean_phone}"
    elif len(clean_phone) == 10:
        wa_link = f"https://wa.me/57{clean_phone}"
    else:
        wa_link = f"https://wa.me/{clean_phone}" if clean_phone else ""

    crm_link = f"{APP_BASE_URL}/admin/personas?search={customer_email}" if customer_email else f"{APP_BASE_URL}/admin"

    wa_btn_html = f'<a href="{wa_link}" style="background-color: #25D366; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 8px; display: inline-block; margin-right: 10px;" target="_blank">💬 Contactar por WhatsApp</a>' if wa_link else ""

    return f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Nuevo Pago VIP 650k — Daily Lover</title>
      <style>
        body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0D0A0B; color: #F5F0F1; margin: 0; padding: 20px; }}
        .card {{ max-width: 600px; margin: 0 auto; background-color: #1A1214; border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
        .header {{ text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.25); padding-bottom: 20px; margin-bottom: 24px; }}
        .badge {{ display: inline-block; background-color: rgba(212, 175, 55, 0.15); color: #D4AF37; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 20px; border: 1px solid #D4AF37; margin-bottom: 10px; }}
        .logo {{ font-size: 24px; font-weight: 800; color: #D4AF37; letter-spacing: 1px; }}
        .subtitle {{ font-size: 14px; color: #C5B083; margin-top: 4px; }}
        .content {{ font-size: 15px; line-height: 1.6; color: #E5DFE1; }}
        .data-box {{ background-color: rgba(255, 255, 255, 0.04); border-left: 4px solid #D4AF37; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 14px; }}
        .btn-gold {{ background: linear-gradient(135deg, #D4AF37 0%, #AA820A 100%); color: #0D0A0B !important; font-weight: 800; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3); }}
        .footer {{ font-size: 12px; color: #7A6A6D; text-align: center; margin-top: 28px; border-top: 1px solid rgba(212, 175, 55, 0.15); padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="badge">⭐ NOTIFICACIÓN DE PAGO VIP</div>
          <div class="logo">DAILY LOVER</div>
          <div class="subtitle">Entrevista Personal Asignada a María Paula Salinas</div>
        </div>

        <div class="content">
          <p>Hola <strong>María</strong>,</p>
          <p>Se acaba de confirmar un nuevo pago en Stripe correspondiente al <strong>Plan VIP 650k</strong> (${amount_cop:,.0f} {currency}).</p>
          
          <div class="data-box">
            <p style="margin: 4px 0;"><strong>👤 Cliente:</strong> {customer_name}</p>
            <p style="margin: 4px 0;"><strong>✉️ Email:</strong> {customer_email}</p>
            <p style="margin: 4px 0;"><strong>📱 Teléfono:</strong> {customer_phone}</p>
            <p style="margin: 4px 0;"><strong>💎 Plan:</strong> Plan VIP 650k (${amount_cop:,.0f} {currency})</p>
            <p style="margin: 4px 0;"><strong>🎯 Responsable asignada:</strong> MPS (María Paula Salinas)</p>
          </div>

          <p>Acciones inmediatas sugeridas:</p>
          <ul>
            <li>Contactar al cliente para darle la bienvenida VIP.</li>
            <li>Agendar su entrevista de evaluación (30 minutos).</li>
          </ul>

          <div style="text-align: center; margin: 26px 0;">
            {wa_btn_html}
            <a href="{crm_link}" class="btn-gold" target="_blank">📋 Ver Ficha en CRM</a>
          </div>
        </div>

        <div class="footer">
          Notificación automática del sistema Daily Lover Matchmaking.<br>
          Enviado a {OWNER_EMAIL}
        </div>
      </div>
    </body>
    </html>
    """


def send_vip_650k_alert_to_owner(
    customer_name: str,
    customer_email: str,
    customer_phone: str,
    amount_cop: float,
    currency: str = "COP",
    user_id: Optional[int] = None
) -> bool:
    """Envía la alerta inmediata del pago de 650k al correo de la dueña (María Salinas)."""
    to_owner = OWNER_EMAIL
    subject = f"🌹 NUEVO PAGO PLAN VIP $650.000 COP — Entrevista Requerida: {customer_name}"
    html = build_vip_650k_notification_html(
        customer_name=customer_name,
        customer_email=customer_email,
        customer_phone=customer_phone,
        amount_cop=amount_cop,
        currency=currency,
        user_id=user_id
    )
    return send_email_html(to_email=to_owner, subject=subject, html_content=html)


def build_vip_slot_selection_email_html(
    customer_name: str,
    customer_email: str,
    slots: List[Dict[str, Any]],
    booking_token: str
) -> str:
    """Plantilla para que el cliente VIP seleccione su horario preferido entre los huecos disponibles."""
    slots_buttons_html = ""
    for s in slots:
        slot_url = f"{APP_BASE_URL}/agendar-vip?token={booking_token}&slot={s.get('slot_iso')}"
        slots_buttons_html += f"""
        <div style="margin: 12px 0; padding: 14px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
          <div style="text-align: left;">
            <div style="font-weight: 700; color: #FFFFFF; font-size: 15px;">📅 {s.get('display_date')}</div>
            <div style="color: #D4AF37; font-size: 14px; margin-top: 2px;">⏰ {s.get('display_time')} (Hora Colombia)</div>
          </div>
          <div>
            <a href="{slot_url}" style="background: linear-gradient(135deg, #D4AF37 0%, #AA820A 100%); color: #0D0A0B !important; font-weight: 700; font-size: 13px; text-decoration: none; padding: 10px 18px; border-radius: 6px; display: inline-block;">Seleccionar</a>
          </div>
        </div>
        """

    return f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Bienvenido al Plan VIP — Daily Lover</title>
      <style>
        body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0D0A0B; color: #F5F0F1; margin: 0; padding: 20px; }}
        .card {{ max-width: 620px; margin: 0 auto; background-color: #1A1214; border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
        .header {{ text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.25); padding-bottom: 20px; margin-bottom: 24px; }}
        .badge {{ display: inline-block; background-color: rgba(212, 175, 55, 0.15); color: #D4AF37; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 20px; border: 1px solid #D4AF37; margin-bottom: 10px; }}
        .logo {{ font-size: 24px; font-weight: 800; color: #D4AF37; letter-spacing: 1px; }}
        .subtitle {{ font-size: 14px; color: #C5B083; margin-top: 4px; }}
        .content {{ font-size: 15px; line-height: 1.6; color: #E5DFE1; }}
        .info-box {{ background-color: rgba(212, 175, 55, 0.08); border-left: 4px solid #D4AF37; padding: 14px; border-radius: 8px; margin: 20px 0; font-size: 14px; }}
        .footer {{ font-size: 12px; color: #7A6A6D; text-align: center; margin-top: 28px; border-top: 1px solid rgba(212, 175, 55, 0.15); padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="badge">🌹 MEMBRESÍA VIP CONFIRMADA</div>
          <div class="logo">DAILY LOVER</div>
          <div class="subtitle">Acompañamiento Personalizado con María Paula Salinas</div>
        </div>

        <div class="content">
          <p>Hola <strong>{customer_name}</strong>,</p>
          <p>¡Te damos una cálida bienvenida al <strong>Plan VIP de Daily Lover</strong>! Hemos confirmado tu pago de manera exitosa.</p>
          
          <div class="info-box">
            📌 <strong>Tu Entrevista Privada:</strong> La sesión de evaluación personalizada tiene una duración de 30 minutos vía <strong>Google Meet</strong> y será conducida directamente por <strong>María Paula Salinas</strong>.
          </div>

          <p>Para tu comodidad, hemos analizado los espacios disponibles en la agenda para los próximos días. <strong>Por favor selecciona el horario que mejor se adapte a tu día:</strong></p>

          <div style="margin: 20px 0;">
            {slots_buttons_html}
          </div>

          <p style="font-size: 13px; color: #9A8A8D; text-align: center; margin-top: 20px;">
            Al hacer clic en tu horario preferido, recibirás automáticamente la invitación oficial en tu Google Calendar con el enlace directo de Google Meet.
          </p>
        </div>

        <div class="footer">
          © 2026 Daily Lover Matchmaking. Todos los derechos reservados.<br>
          Bogotá & Medellín, Colombia.
        </div>
      </div>
    </body>
    </html>
    """


def send_vip_slot_selection_email(
    customer_name: str,
    customer_email: str,
    slots: List[Dict[str, Any]],
    booking_token: str
) -> bool:
    """Envía el correo de bienvenida y selección de huecos al cliente VIP."""
    subject = f"🌹 ¡Bienvenido al Plan VIP! Elige tu horario de entrevista con María Salinas"
    html = build_vip_slot_selection_email_html(
        customer_name=customer_name,
        customer_email=customer_email,
        slots=slots,
        booking_token=booking_token
    )
    return send_email_html(to_email=customer_email, subject=subject, html_content=html)


def build_vip_confirmation_email_html(
    customer_name: str,
    display_date: str,
    display_time: str,
    meet_link: str,
    is_for_owner: bool = False
) -> str:
    """Plantilla de confirmación final de la entrevista agendada con sala de Google Meet."""
    if meet_link:
        meet_block = f"""<p style="text-align: center; margin: 24px 0;">
            <a href="{meet_link}" class="btn-meet" target="_blank">📹 Entrar a la Sala de Google Meet</a>
          </p>

          <p style="font-size: 13px; color: #9A8A8D; text-align: center;">
            El sistema ha enviado la invitación formal a tu correo con archivo de Google Calendar para que quede agregada automáticamente con recordatorios previos.
          </p>"""
    else:
        meet_block = """<p style="font-size: 14px; color: #E5DFE1; text-align: center; margin: 24px 0;">
            En breve te enviaremos la invitación con el enlace de la videollamada.
          </p>"""
    title_text = "Cita Confirmada con Cliente VIP" if is_for_owner else "Tu Entrevista VIP Está Confirmada"
    intro_text = (
        f"El cliente <strong>{customer_name}</strong> ha seleccionado su horario para la entrevista VIP de 30 minutos."
        if is_for_owner else
        f"Hola <strong>{customer_name}</strong>, tu entrevista VIP con <strong>María Paula Salinas</strong> ha quedado agendada con éxito."
    )

    return f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>{title_text} — Daily Lover</title>
      <style>
        body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0D0A0B; color: #F5F0F1; margin: 0; padding: 20px; }}
        .card {{ max-width: 600px; margin: 0 auto; background-color: #1A1214; border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
        .header {{ text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.25); padding-bottom: 20px; margin-bottom: 24px; }}
        .badge {{ display: inline-block; background-color: rgba(37, 211, 102, 0.15); color: #25D366; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 20px; border: 1px solid #25D366; margin-bottom: 10px; }}
        .logo {{ font-size: 24px; font-weight: 800; color: #D4AF37; letter-spacing: 1px; }}
        .content {{ font-size: 15px; line-height: 1.6; color: #E5DFE1; }}
        .data-box {{ background-color: rgba(255, 255, 255, 0.04); border-left: 4px solid #25D366; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 14px; }}
        .btn-meet {{ background-color: #1a73e8; color: #ffffff !important; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 15px rgba(26, 115, 232, 0.4); }}
        .footer {{ font-size: 12px; color: #7A6A6D; text-align: center; margin-top: 28px; border-top: 1px solid rgba(212, 175, 55, 0.15); padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="badge">✅ ENTREVISTA CONFIRMADA</div>
          <div class="logo">DAILY LOVER</div>
        </div>

        <div class="content">
          <p>{intro_text}</p>
          
          <div class="data-box">
            <p style="margin: 4px 0;"><strong>📅 Fecha:</strong> {display_date}</p>
            <p style="margin: 4px 0;"><strong>⏰ Hora:</strong> {display_time} (Hora Colombia)</p>
            <p style="margin: 4px 0;"><strong>💻 Modalidad:</strong> Videollamada Google Meet (30 min)</p>
            <p style="margin: 4px 0;"><strong>🎟️ Asistentes:</strong> María Paula Salinas & {customer_name}</p>
          </div>

          {meet_block}
        </div>

        <div class="footer">
          Daily Lover Matchmaking App • Notificación de Agenda Automatizada
        </div>
      </div>
    </body>
    </html>
    """


def send_vip_confirmation_emails(
    customer_name: str,
    customer_email: str,
    display_date: str,
    display_time: str,
    meet_link: str
) -> bool:
    """Envía los correos de confirmación tanto al cliente como a María Salinas."""
    # 1. Al cliente
    subj_cli = f"✅ Confirmado: Tu Entrevista VIP con María Salinas ({display_date} - {display_time})"
    html_cli = build_vip_confirmation_email_html(
        customer_name=customer_name,
        display_date=display_date,
        display_time=display_time,
        meet_link=meet_link,
        is_for_owner=False
    )
    res_cli = send_email_html(to_email=customer_email, subject=subj_cli, html_content=html_cli)

    # 2. A María Salinas
    subj_owner = f"📅 CITA AGENDADA: Entrevista VIP con {customer_name} ({display_date} - {display_time})"
    html_owner = build_vip_confirmation_email_html(
        customer_name=customer_name,
        display_date=display_date,
        display_time=display_time,
        meet_link=meet_link,
        is_for_owner=True
    )
    res_owner = send_email_html(to_email=OWNER_EMAIL, subject=subj_owner, html_content=html_owner)

    return res_cli and res_owner




# ─── ENTREVISTA CLÍNICA: INASISTENCIA (NO SE PRESENTÓ) ───────────────────────
# BORRADOR provisional: se reemplaza cuando exista la plantilla definitiva.
INTERVIEW_CALENDLY_URL = os.getenv(
    "INTERVIEW_CALENDLY_URL",
    "https://calendly.com/maria-salinas-dailylover/blind-dates-1-1"
)
INTERVIEW_MAX_NO_SHOWS = 3


def _interview_email_shell(body_html: str) -> str:
    return f"""<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2B2B2B;line-height:1.55">
{body_html}
<p style="margin-top:28px">Con cariño,<br><strong>Equipo Daily Lover</strong></p>
</div>"""


def build_interview_reschedule_email_html(user_name: str, no_show_count: int, calendly_url: str = "") -> str:
    url = calendly_url or INTERVIEW_CALENDLY_URL
    first = (user_name or "").strip().split(" ")[0].title() or "Hola"
    remaining = max(INTERVIEW_MAX_NO_SHOWS - no_show_count, 0)
    return _interview_email_shell(f"""
<p>Hola {first},</p>
<p>Notamos que no pudiste asistir a tu entrevista con nuestro equipo de psicólogas. ¡No te preocupes, pasa! 💛</p>
<p>La entrevista es el paso que activa tu perfil para que empecemos a presentarte personas compatibles, así que queremos ayudarte a retomarla. Puedes elegir un nuevo horario aquí:</p>
<p style="text-align:center;margin:24px 0"><a href="{url}" style="background:#B8324F;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Reprogramar mi entrevista</a></p>
<p style="font-size:13px;color:#555">Tienes un máximo de {INTERVIEW_MAX_NO_SHOWS} oportunidades para reprogramar. Esta fue la número {no_show_count}; te {'queda' if remaining == 1 else 'quedan'} {remaining}.</p>""")


def build_interview_removed_email_html(user_name: str) -> str:
    first = (user_name or "").strip().split(" ")[0].title() or "Hola"
    return _interview_email_shell(f"""
<p>Hola {first},</p>
<p>Te escribimos porque no pudimos concretar tu entrevista después de {INTERVIEW_MAX_NO_SHOWS} intentos de agendamiento, que es el máximo que permite nuestra política de entrevistas.</p>
<p>Por eso retiramos tu solicitud de la lista de entrevistas. Si crees que se trata de un error o quieres conversar sobre tu caso, responde a este correo y con gusto lo revisamos.</p>""")


def send_interview_no_show_email(to_email: str, user_name: str, no_show_count: int, removed: bool) -> bool:
    if removed:
        subject = "Tu entrevista en Daily Lover — actualización de tu solicitud"
        html = build_interview_removed_email_html(user_name)
    else:
        subject = "¿Reprogramamos tu entrevista? — Daily Lover"
        html = build_interview_reschedule_email_html(user_name, no_show_count)
    return send_email_html(to_email, subject, html)
