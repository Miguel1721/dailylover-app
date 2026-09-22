import asyncio
from app.database import engine
import sqlalchemy as sa

async def link_laura():
    async with engine.begin() as conn:
        await conn.execute(sa.text("UPDATE stripe_payments SET user_id = 8066 WHERE id = 1886"))
        await conn.execute(sa.text("UPDATE profiles SET plan_tier = 'Plan VIP 650k', responsable = 'MPS' WHERE user_id = 8066"))
        print("✅ Laura Pardo / Mejía (#8066) vinculada exitosamente a Pago #1886 como Plan VIP 650k [Resp: MPS].")

if __name__ == "__main__":
    asyncio.run(link_laura())
