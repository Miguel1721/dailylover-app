"""
Actualización y corrección retroactiva de los 11 pagos de 650k en la base de datos de DailyLover.
Corrige el plan_tier a 'Plan VIP 650k' y asigna responsable 'MPS' en profiles.
IMPORTANTE: NO envía correos de notificación por ser datos históricos.
"""

import asyncio
import logging
from sqlalchemy import text
from app.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fix_historical_650k():
    print("\n" + "="*70)
    print("🌹 CORRECCIÓN DE PAGOS HISTÓRICOS DE $650.000 COP EN DAILY LOVER")
    print("="*70 + "\n")

    async with engine.begin() as conn:
        # 1. Actualizar registros en stripe_payments
        res_sp = await conn.execute(text("""
            UPDATE stripe_payments
            SET plan_tier = 'Plan VIP 650k',
                updated_at = NOW()
            WHERE amount = 650000
            RETURNING id, customer_name, customer_email, amount;
        """))
        sp_rows = res_sp.fetchall()
        print(f"✅ Se actualizaron {len(sp_rows)} registros en stripe_payments a 'Plan VIP 650k'.\n")

        # 2. Para cada cliente, reconciliar y actualizar en users y profiles
        updated_profiles = 0
        for sp in sp_rows:
            sp_id, c_name, c_email, amt = sp[0], sp[1], sp[2], sp[3]
            
            # Buscar usuario
            u_res = await conn.execute(text("""
                SELECT u.id, u.name, u.email, p.plan_tier, p.responsable
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                WHERE (u.email IS NOT NULL AND lower(u.email) = lower(:e))
                   OR (u.name IS NOT NULL AND lower(u.name) = lower(:n))
                LIMIT 1
            """), {"e": c_email or "", "n": c_name or ""})
            u_row = u_res.fetchone()

            if u_row:
                uid, uname, uemail, old_p, old_resp = u_row[0], u_row[1], u_row[2], u_row[3], u_row[4]
                
                # Actualizar profile
                await conn.execute(text("""
                    UPDATE profiles
                    SET plan_tier = 'Plan VIP 650k',
                        responsable = 'MPS',
                        updated_at = NOW()
                    WHERE user_id = :uid
                """), {"uid": uid})

                # Vincular user_id en stripe_payments si faltaba
                await conn.execute(text("""
                    UPDATE stripe_payments
                    SET user_id = :uid
                    WHERE id = :sp_id
                """), {"uid": uid, "sp_id": sp_id})

                updated_profiles += 1
                print(f"  ⭐ User #{uid:5d} ({uname:25s}) | Email: {uemail:30s} -> Plan VIP 650k [Resp: MPS]")
            else:
                print(f"  ⚠️ Pago #{sp_id:4d} ({c_name:25s}) | Email: {c_email:30s} -> Sin usuario en users/profiles")

        print(f"\n✅ Total perfiles vinculados y actualizados a Plan VIP 650k: {updated_profiles}/{len(sp_rows)}")
        print("🔒 Cero correos enviados (regla de no notificación para históricos respetada).\n")

if __name__ == "__main__":
    asyncio.run(fix_historical_650k())
