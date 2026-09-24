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
        """Calcula entre 3 y 6 huecos libres de 30 min, a partir del día siguiente y en franjas 10-13 y 17-19 L-V."""
        slots = calculate_available_vip_slots(days_ahead=7, slot_minutes=30, max_slots=6)
        self.assertGreaterEqual(len(slots), 3)
        self.assertLessEqual(len(slots), 6)

        try:
            tz_cot = zoneinfo.ZoneInfo("America/Bogota")
        except Exception:
            from datetime import timezone
            tz_cot = timezone(timedelta(hours=-5))
        now = datetime.now(tz_cot).replace(tzinfo=None)
        next_day = (now + timedelta(days=1)).date()

        for s in slots:
            slot_dt = datetime.fromisoformat(s["slot_iso"])
            # 1. A partir del día siguiente al pago
            self.assertGreaterEqual(slot_dt.date(), next_day)
            # 2. Solo Lunes (0) a Viernes (4)
            self.assertLess(slot_dt.weekday(), 5)
            # 3. Franjas 10:00 AM a 1:00 PM (10:00 - 13:00) y 5:00 PM a 7:00 PM (17:00 - 19:00)
            is_morning = (10 <= slot_dt.hour < 13)
            is_afternoon = (17 <= slot_dt.hour < 19)
            self.assertTrue(is_morning or is_afternoon, f"Slot {slot_dt} fuera de franjas permitidas")
            # 4. Formateo legible en español
            self.assertIn("display_date", s)
            self.assertIn("display_time", s)

    def test_create_third_party_vip_event(self):
        """Crea el evento en el calendario del Tercero con sala de Google Meet e invitados."""
        now = datetime.now() + timedelta(days=3)
        start_dt = now.replace(hour=10, minute=0, second=0, microsecond=0)
        end_dt = start_dt + timedelta(minutes=30)

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
        slots = calculate_available_vip_slots(days_ahead=7, slot_minutes=30, max_slots=6)
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
