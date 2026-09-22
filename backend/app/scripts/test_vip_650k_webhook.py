import unittest
from app.services.email_service import build_vip_650k_notification_html, send_vip_650k_alert_to_owner
from app.routers.webhooks import STRIPE_PLAN_MAP

class TestVIP650kIntegration(unittest.TestCase):

    def test_plan_map_contains_650k(self):
        self.assertIn("650", STRIPE_PLAN_MAP)
        self.assertEqual(STRIPE_PLAN_MAP["650"], "Plan VIP 650k")

    def test_email_html_generation(self):
        html = build_vip_650k_notification_html(
            customer_name="Mariana Gómez",
            customer_email="mariana.gomez@example.com",
            customer_phone="+573001234567",
            amount_cop=650000.0,
            currency="COP",
            user_id=99999
        )
        self.assertIn("Mariana Gómez", html)
        self.assertIn("mariana.gomez@example.com", html)
        self.assertIn("650,000", html)
        self.assertIn("contact.mariasalinas@gmail.com", html)
        self.assertIn("https://wa.me/573001234567", html)

    def test_mock_email_delivery(self):
        res = send_vip_650k_alert_to_owner(
            customer_name="Test User VIP",
            customer_email="test.vip@example.com",
            customer_phone="3009998877",
            amount_cop=650000.0,
            currency="COP"
        )
        self.assertTrue(res)

if __name__ == "__main__":
    unittest.main()
