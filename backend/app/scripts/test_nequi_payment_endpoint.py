import asyncio
import unittest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.auth_service import create_access_token

# Tiny 1x1 transparent PNG in base64
TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

class TestNequiPaymentEndpoint(unittest.IsolatedAsyncioTestCase):
    async def test_nequi_payment_with_receipt_and_calendly(self):
        token = create_access_token(user_account_id=1, role_id=1)
        headers = {"Authorization": f"Bearer {token}"}
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            payload = {
                "name": "Cliente Prueba Comprobante",
                "phone": "3118889900",
                "city": "Bogotá",
                "gender": "Mujer",
                "plan_tier": "Estándar 65k (2 citas)",
                "amount_cop": 65000,
                "receipt_base64": TINY_PNG
            }
            res = await ac.post("/api/v1/admin/finance/nequi-payment", json=payload, headers=headers)
            self.assertEqual(res.status_code, 201, f"Error: {res.text}")
            data = res.json()
            
            # Assertions
            self.assertTrue(data.get("success"))
            self.assertIn("receipt_url", data)
            self.assertTrue(data["receipt_url"] is not None)
            self.assertTrue(data["receipt_url"].startswith("/static/uploads/"))
            self.assertEqual(data.get("calendly_url"), "https://calendly.com/maria-salinas-dailylover/blind-dates-1-1")
            self.assertIn("https://calendly.com/maria-salinas-dailylover/blind-dates-1-1", data.get("whatsapp_message", ""))
            
            print(f"\n✅ Nequi Payment Test OK!")
            print(f"   Client: {data.get('name')} ({data.get('client_code')})")
            print(f"   Receipt URL: {data.get('receipt_url')}")
            print(f"   Calendly URL: {data.get('calendly_url')}")

if __name__ == "__main__":
    unittest.main()
