import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def check_crm_dependents():
    async with AsyncSessionLocal() as db:
        tables = [
            ("profiles", "user_id"),
            ("embeddings", "user_id"),
            ("event_attendees", "user_id"),
            ("post_event_feedback", "user_id"),
            ("match_requests", "from_user"),
            ("match_requests", "to_user"),
            ("accounts_receivable", "user_id"),
            ("historical_matches", "user_id_a"),
            ("historical_matches", "user_id_b"),
            ("interview_appointments", "user_id"),
            ("match_evaluations", "user_id"),
            ("client_notes", "user_id"),
            ("client_images", "user_id"),
            ("operational_matches", "user_id_a"),
            ("operational_matches", "user_id_b"),
            ("client_extended_profile", "user_id"),
            ("priority_client_tracking", "user_id"),
            ("priority_client_tracking", "candidate_id"),
            ("stripe_payments", "user_id"),
            ("cs_novedades", "client_id"),
        ]
        
        print("Verificando filas asociadas a 'Cliente CRM%' en tablas dependientes:")
        for t, col in tables:
            cnt = (await db.execute(text(f"""
                SELECT COUNT(*) FROM {t} WHERE {col} IN (SELECT id FROM users WHERE name ILIKE 'Cliente CRM%');
            """))).scalar()
            if cnt > 0:
                print(f"  ⚠️ {t}.{col}: {cnt} registros")
            else:
                print(f"  ✓ {t}.{col}: 0 registros")

if __name__ == '__main__':
    asyncio.run(check_crm_dependents())
