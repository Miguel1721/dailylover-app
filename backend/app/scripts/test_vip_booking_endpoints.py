"""
Integration test for client VIP booking endpoints using AsyncClient.
"""

import unittest
import httpx
from httpx import ASGITransport
from app.main import app

class TestVipBookingEndpoints(unittest.IsolatedAsyncioTestCase):

    async def test_get_vip_slots_and_confirm(self):
        """Prueba de ciclo completo: consulta de slots y confirmación de cita VIP con Tercero Organizador."""
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Obtener slots
            res = await client.get("/api/v1/client/vip-booking/slots?days_ahead=7")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["status"], "success")
            self.assertIn("slots", data)
            self.assertGreaterEqual(len(data["slots"]), 3)
            self.assertLessEqual(len(data["slots"]), 5)

            first_slot = data["slots"][0]
            self.assertIn("slot_iso", first_slot)
            self.assertIn("display_date", first_slot)
            self.assertIn("display_time", first_slot)

            # 2. Confirmar cita
            payload = {
                "client_name": "Test Client VIP Auto",
                "client_email": "test.client.vip.auto@example.com",
                "client_phone": "+573009998877",
                "slot_iso": first_slot["slot_iso"],
                "notes": "Prueba automatizada de agendamiento con Tercero Organizador"
            }

            confirm_res = await client.post("/api/v1/client/vip-booking/confirm", json=payload)
            self.assertEqual(confirm_res.status_code, 200)
            confirm_data = confirm_res.json()
            self.assertEqual(confirm_data["status"], "success")
            self.assertIn("appointment_id", confirm_data)
            self.assertIn("meet_link", confirm_data)
            self.assertTrue(confirm_data["meet_link"].startswith("https://meet.google.com"))

if __name__ == "__main__":
    unittest.main()
