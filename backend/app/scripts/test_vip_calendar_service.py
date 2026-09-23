"""
Unit test suite for VIP 650k Third-Party Calendar Service & Booking Flow.
"""

import unittest
import zoneinfo
from datetime import datetime, timedelta
from app.services.google_calendar_service import (
    calculate_available_vip_slots,
    create_third_party_vip_event
)
from app.services.email_service import (
    build_vip_slot_selection_email_html,
    send_vip_slot_selection_email,
    build_vip_confirmation_email_html,
    send_vip_confirmation_emails
)

class TestVipCalendarService(unittest.TestCase):

    def test_calculate_available_vip_slots(self):
        """Calcula entre 3 y 5 huecos libres de 45 min, respetando 48h de aviso y horario laboral L-V."""
        slots = calculate_available_vip_slots(days_ahead=10, slot_minutes=45, min_notice_hours=48)
        self.assertGreaterEqual(len(slots), 3)
        self.assertLessEqual(len(slots), 5)

        tz_cot = zoneinfo.ZoneInfo("America/Bogota")
        now = datetime.now(tz_cot).replace(tzinfo=None)
        min_allowed_dt = now + timedelta(hours=47)  # pequeña holgura para segundos

        for s in slots:
            slot_dt = datetime.fromisoformat(s["slot_iso"])
            # 1. Al menos 48 horas posteriores
            self.assertGreaterEqual(slot_dt, min_allowed_dt)
            # 2. Solo Lunes (0) a Viernes (4)
            self.assertLess(slot_dt.weekday(), 5)
            # 3. Entre 9:00 AM y 5:00 PM
            self.assertGreaterEqual(slot_dt.hour, 9)
            self.assertLessEqual(slot_dt.hour, 16)
            # 4. Formateo legible en español
            self.assertIn("display_date", s)
            self.assertIn("display_time", s)

    def test_create_third_party_vip_event(self):
        """Crea el evento en el calendario del Tercero con sala de Google Meet e invitados."""
        now = datetime.now() + timedelta(days=3)
        start_dt = now.replace(hour=10, minute=0, second=0, microsecond=0)
        end_dt = start_dt + timedelta(minutes=45)

        res = create_third_party_vip_event(
            client_name="Alejandro Morales",
            client_email="alejandro.morales@example.com",
            start_dt=start_dt,
            end_dt=end_dt,
            client_phone="+573109988776"
        )
        self.assertEqual(res["status"], "success")
        self.assertIn("meet_link", res)
        self.assertTrue(res["meet_link"].startswith("https://meet.google.com"))
        self.assertIn("Alejandro Morales", res["summary"])

    def test_vip_slot_selection_email(self):
        """Genera y simula el envío del correo con botones de selección de horarios."""
        slots = calculate_available_vip_slots(days_ahead=5, slot_minutes=45, min_notice_hours=48)
        html = build_vip_slot_selection_email_html(
            customer_name="Sofía Vergara",
            customer_email="sofia@example.com",
            slots=slots,
            booking_token="vip_tok_12345"
        )
        self.assertIn("Sofía Vergara", html)
        self.assertIn("vip_tok_12345", html)
        self.assertIn("Seleccionar", html)

        res = send_vip_slot_selection_email(
            customer_name="Sofía Vergara",
            customer_email="sofia@example.com",
            slots=slots,
            booking_token="vip_tok_12345"
        )
        self.assertTrue(res)

    def test_vip_confirmation_emails(self):
        """Genera y simula el envío de confirmación con enlace de Google Meet a María y al cliente."""
        html_cli = build_vip_confirmation_email_html(
            customer_name="Carlos Valderrama",
            display_date="Jueves 25 de Septiembre",
            display_time="10:00 AM",
            meet_link="https://meet.google.com/dlv-abc-defg",
            is_for_owner=False
        )
        self.assertIn("Carlos Valderrama", html_cli)
        self.assertIn("https://meet.google.com/dlv-abc-defg", html_cli)
        self.assertIn("10:00 AM", html_cli)

        res = send_vip_confirmation_emails(
            customer_name="Carlos Valderrama",
            customer_email="carlos@example.com",
            display_date="Jueves 25 de Septiembre",
            display_time="10:00 AM",
            meet_link="https://meet.google.com/dlv-abc-defg"
        )
        self.assertTrue(res)

if __name__ == "__main__":
    unittest.main()
