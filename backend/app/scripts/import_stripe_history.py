"""
Daily Lover — Sincronizador e Importador Histórico de Stripe
Uso: python -m app.scripts.import_stripe_history
"""

import urllib.request
import urllib.parse
import json
import base64
import datetime
import os
import sys
import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.config import get_settings

def get_stripe_key():
    settings = get_settings()
    return settings.stripe_api_key or os.environ.get("STRIPE_API_KEY", "")

def stripe_get(endpoint, params=None):
    key = get_stripe_key()
    auth_header = "Basic " + base64.b64encode(f"{key}:".encode()).decode()
    url = f"https://api.stripe.com{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": auth_header})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def fetch_all_paginated(endpoint, object_type="data", max_items=5000):
    items = []
    has_more = True
    starting_after = None
    while has_more and len(items) < max_items:
        params = {"limit": 100}
        if starting_after:
            params["starting_after"] = starting_after
        try:
            res = stripe_get(endpoint, params)
            data = res.get(object_type, [])
            if not data:
                break
            items.extend(data)
            has_more = res.get("has_more", False)
            starting_after = data[-1]["id"]
        except Exception as e:
            print(f"Error consultando {endpoint}: {e}")
            break
    return items

async def sync_stripe_to_db():
    print("==========================================================")
    print(" DAILY LOVER — IMPORTACIÓN HISTÓRICA DE STRIPE")
    print("==========================================================")

    print("1. Descargando clientes de Stripe...")
    customers = fetch_all_paginated("/v1/customers")
    customer_map = {c["id"]: c for c in customers}
    print(f"   ✓ {len(customers)} clientes obtenidos.")

    print("2. Descargando cobros (Charges)...")
    charges = fetch_all_paginated("/v1/charges")
    print(f"   ✓ {len(charges)} cobros obtenidos.")

    async with AsyncSessionLocal() as db:
        inserted = 0

        for ch in charges:
            if not ch.get("paid"):
                continue

            amt = float(ch.get("amount", 0)) / 100.0
            curr = (ch.get("currency") or "cop").upper()
            amt_ref = float(ch.get("amount_refunded", 0)) / 100.0
            st = "refunded" if ch.get("refunded") else ("partially_refunded" if amt_ref > 0 else "succeeded")

            cust_id = ch.get("customer")
            cust_obj = customer_map.get(cust_id, {}) if cust_id else {}

            b_details = ch.get("billing_details") or {}
            email = (b_details.get("email") or cust_obj.get("email") or "").strip().lower()
            name = (b_details.get("name") or cust_obj.get("name") or "").strip()
            phone = (b_details.get("phone") or cust_obj.get("phone") or "").strip()

            desc = (ch.get("description") or "").strip()
            pi_id = ch.get("payment_intent") or ch.get("id")

            # Clasificación de plan
            if "195" in str(int(amt)) or "vip" in desc.lower():
                plan_tier = "VIP 195k"
            elif "150" in str(int(amt)) or "premium" in desc.lower():
                plan_tier = "Premium"
            elif "98" in str(int(amt)) or "plus" in desc.lower():
                plan_tier = "Estándar Plus 98k"
            elif "65" in str(int(amt)) or "65k" in desc.lower():
                plan_tier = "Estándar 65k"
            elif "40" in str(int(amt)) or "40k" in desc.lower():
                plan_tier = "Básico 40k"
            elif "hot & single" in desc.lower() or "🌶️" in desc:
                plan_tier = f"Evento: {desc[:40]}"
            elif "experience" in desc.lower():
                plan_tier = "Matchmaking Experience"
            elif desc:
                plan_tier = desc[:50]
            else:
                plan_tier = f"Plan Especial - ${int(amt):,} {curr}"

            dt = datetime.datetime.fromtimestamp(ch.get("created"))

            await db.execute(text("""
                INSERT INTO stripe_payments (
                    stripe_payment_intent_id, stripe_charge_id, stripe_customer_id,
                    customer_name, customer_email, customer_phone,
                    amount, currency, description, plan_tier,
                    payment_status, amount_refunded, payment_date, created_at, updated_at
                ) VALUES (
                    :pi, :ch, :cust,
                    :name, :email, :phone,
                    :amt, :curr, :desc, :plan,
                    :st, :amt_ref, :dt, NOW(), NOW()
                )
                ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET
                    payment_status = EXCLUDED.payment_status,
                    amount = EXCLUDED.amount,
                    amount_refunded = EXCLUDED.amount_refunded,
                    customer_name = CASE WHEN EXCLUDED.customer_name != '' THEN EXCLUDED.customer_name ELSE stripe_payments.customer_name END,
                    customer_email = CASE WHEN EXCLUDED.customer_email != '' THEN EXCLUDED.customer_email ELSE stripe_payments.customer_email END,
                    updated_at = NOW()
            """), {
                "pi": pi_id, "ch": ch.get("id"), "cust": cust_id,
                "name": name, "email": email, "phone": phone,
                "amt": amt, "curr": curr, "desc": desc or plan_tier, "plan": plan_tier,
                "st": st, "amt_ref": amt_ref, "dt": dt
            })
            inserted += 1

        # Cruzar con usuarios
        await db.execute(text("""
            UPDATE stripe_payments sp
            SET user_id = u.id
            FROM users u
            WHERE sp.user_id IS NULL
              AND sp.customer_email IS NOT NULL AND sp.customer_email != ''
              AND LOWER(TRIM(u.email)) = LOWER(TRIM(sp.customer_email));

            UPDATE stripe_payments sp
            SET user_id = u.id
            FROM users u
            WHERE sp.user_id IS NULL
              AND sp.customer_phone IS NOT NULL AND sp.customer_phone != ''
              AND TRIM(u.phone) = TRIM(sp.customer_phone);

            UPDATE stripe_payments sp
            SET user_id = u.id
            FROM users u
            WHERE sp.user_id IS NULL
              AND sp.customer_name IS NOT NULL AND LENGTH(sp.customer_name) > 5
              AND LOWER(TRIM(u.name)) = LOWER(TRIM(sp.customer_name));

            WITH latest_payments AS (
                SELECT DISTINCT ON (user_id)
                    user_id, plan_tier, stripe_customer_id, stripe_payment_intent_id, amount, payment_date
                FROM stripe_payments
                WHERE user_id IS NOT NULL
                  AND payment_status = 'succeeded'
                  AND plan_tier NOT ILIKE 'Evento:%'
                ORDER BY user_id, payment_date DESC
            )
            UPDATE profiles p
            SET plan_tier = lp.plan_tier,
                stripe_customer_id = COALESCE(lp.stripe_customer_id, p.stripe_customer_id),
                stripe_payment_intent_id = COALESCE(lp.stripe_payment_intent_id, p.stripe_payment_intent_id),
                last_payment_amount = lp.amount,
                last_payment_date = lp.payment_date,
                updated_at = NOW()
            FROM latest_payments lp
            WHERE p.user_id = lp.user_id;
        """))

        await db.commit()
        print(f"\n✓ Proceso finalizado exitosamente. {inserted} registros procesados.")

if __name__ == "__main__":
    asyncio.run(sync_stripe_to_db())
