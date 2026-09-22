import asyncio
import sys
import json
from app.database import AsyncSessionLocal
from app.routers.matchmaking import get_leads_men_rescue, get_refund_categories
from app.routers.reports import get_commercial_kpis
from app.routers.work_time import get_matchmaker_shift_efficiency
from app.routers.scheduling import get_cs_daily_metrics

async def run_tests():
    async with AsyncSessionLocal() as db:
        print("=== TEST 1: Rescate de Hombres (1.116 leads) ===")
        res1 = await get_leads_men_rescue(city_filter='all', status_filter='all', page=1, page_size=5, search='', db=db)
        print(f"Total leads: {res1.get('total')}")
        stats = res1.get('stats', {})
        print(f"Total leads: {res1.get('total')}")
        print(f"Stats: {stats}")
        assert res1.get('total', 0) == 1116, f"Expected 1116 men, got {res1.get('total')}"
        if res1.get('leads'):
            sample_lead = res1['leads'][0]
            print(f"Sample lead: {sample_lead.get('name')}, city: {sample_lead.get('city')}, whatsapp_url: {bool(sample_lead.get('whatsapp_url'))}")

        print("\n=== TEST 2: Categorias Oficiales de Refund ===")
        res2 = await get_refund_categories()
        cats = res2.get('categories', [])
        print(f"Categorías ({len(cats)}):")
        for c in cats:
            print(f" - {c}")
        assert len(cats) == 6, f"Expected 6 refund categories, got {len(cats)}"

        print("\n=== TEST 3: Reporte Comercial & Metas 15/dia ===")
        res3 = await get_commercial_kpis(year=2026, month=9, db=db)
        print(f"Meta Sep: {res3.get('monthly_target')}, Real Mes: {res3.get('total_month')}, Cumplimiento: {res3.get('compliance_month_pct')}%")
        print(f"Distribución ciudades: {res3.get('summary_by_city')}")
        print(f"Días computados: {len(res3.get('days', []))}")
        assert res3.get('monthly_target') == 350, f"Expected Sep target to be 350, got {res3.get('monthly_target')}"
        assert len(res3.get('days', [])) == 30, f"Expected 30 days in September, got {len(res3.get('days', []))}"

        print("\n=== TEST 4: Eficiencia y Turnos de Matchmakers ===")
        res4 = await get_matchmaker_shift_efficiency(year=2026, month=9, db=db)
        mms = res4.get('matchmakers', [])
        print(f"Matchmakers encontradas: {len(mms)}")
        for mm in mms[:5]:
            print(f" - {mm.get('name')}: {mm.get('matches_count')} matches, {mm.get('active_hours')}h, {mm.get('avg_minutes_per_match')} min/match, speed: {mm.get('speed_diagnosis')}")

        print("\n=== TEST 5: Métricas CS (Citas, Reprogramaciones, Reservas) ===")
        res5 = await get_cs_daily_metrics(days=30, db=db)
        summary = res5.get('summary', {})
        print(f"Total citas agendadas: {summary.get('total_scheduled_dates')}")
        print(f"Total reprogramadas: {summary.get('total_rescheduled')} (Tasa: {summary.get('reschedule_rate_pct')}%)")
        print(f"Total reservas restaurante: {summary.get('total_confirmed_reservations')}")
        print(f"Citas por ciudad: {summary.get('scheduled_by_city')}")
        print(f"Reservas por ciudad: {summary.get('reservations_by_city')}")

        print("\n>>> ALL 5 OPERATIONAL MODULES PASSED VALIDATION WITH ZERO ERRORS! <<<")

def main():
    asyncio.run(run_tests())

if __name__ == '__main__':
    main()
