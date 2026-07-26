import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "no-reply@dailylover.app")
APP_BASE_URL = os.getenv("APP_BASE_URL", "https://prueba-daily.agentesia.cloud")

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


def build_feedback_email_html(user_name: str, partner_name: str, match_id: int, user_id: int) -> str:
    """Construye la plantilla HTML del correo para evaluación post-cita obligatoria."""
    feedback_link = f"{APP_BASE_URL}/evaluacion-cita?match_id={match_id}&user_id={user_id}"
    
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

        <div class="content">
          <p>Hola <strong>{user_name}</strong>,</p>
          <p>Esperamos que tu reciente encuentro con <strong>{partner_name}</strong> haya sido una experiencia enriquecedora.</p>
          
          <div class="alert-box">
            📌 <strong>REQUISITO OBLIGATORIO DE MATCHMAKING:</strong> Para mantener activo tu perfil y continuar recibiendo nuevas propuestas de candidatos en el sistema, es obligatorio completar la retroalimentación de esta cita.
          </div>

          <p>Nos interesa conocer tu opinión honesta sobre:</p>
          <ul>
            <li>El ambiente y la experiencia en el sitio.</li>
            <li>La puntualidad y química con la persona.</li>
            <li>Si deseas agendar una segunda cita o ajustar tus criterios de búsqueda.</li>
          </ul>

          <div class="btn-container">
            <a href="{feedback_link}" class="btn">⭐ Evaluar Cita & Continuar en Matches</a>
          </div>

          <p style="font-size: 12px; color: #9A8A8D; text-align: center;">
            Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br>
            <a href="{feedback_link}" style="color: #FF5A36;">{feedback_link}</a>
          </p>
        </div>

        <div class="footer">
          © 2026 Daily Lover App. Todos los derechos reservados.<br>
          Bogotá & Medellín, Colombia.
        </div>
      </div>
    </body>
    </html>
    """
