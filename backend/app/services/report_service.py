import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.config import get_settings
from anthropic import AsyncAnthropic

settings = get_settings()

async def get_report_data(db: AsyncSession, month: int, year: int) -> dict:
    """Gather real data metrics from the database for the given month and year."""
    # 1. Count events
    events_count = (await db.execute(text("""
        SELECT COUNT(*) FROM events 
        WHERE EXTRACT(MONTH FROM date) = :month AND EXTRACT(YEAR FROM date) = :year
    """), {"month": month, "year": year})).scalar() or 0

    # 2. Total Income
    total_income = (await db.execute(text("""
        SELECT COALESCE(SUM(amount), 0) FROM income_records
        WHERE EXTRACT(MONTH FROM received_at) = :month AND EXTRACT(YEAR FROM received_at) = :year
    """), {"month": month, "year": year})).scalar() or 0.0

    # 3. Total Expenses
    total_expenses = (await db.execute(text("""
        SELECT COALESCE(SUM(amount), 0) FROM expense_records
        WHERE EXTRACT(MONTH FROM paid_at) = :month AND EXTRACT(YEAR FROM paid_at) = :year
    """), {"month": month, "year": year})).scalar() or 0.0

    # 4. Best Event (most profitable)
    best_event_row = (await db.execute(text("""
        SELECT e.name, 
               (SELECT COALESCE(SUM(amount), 0) FROM income_records WHERE event_id = e.id) -
               (SELECT COALESCE(SUM(amount), 0) FROM expense_records WHERE event_id = e.id) as net_profit
        FROM events e
        WHERE EXTRACT(MONTH FROM e.date) = :month AND EXTRACT(YEAR FROM e.date) = :year
        ORDER BY net_profit DESC
        LIMIT 1
    """), {"month": month, "year": year})).fetchone()
    best_event = best_event_row.name if best_event_row else None

    # 5. Overdue amount
    overdue_amount = (await db.execute(text("""
        SELECT COALESCE(SUM(amount), 0) FROM accounts_receivable WHERE due_date < CURRENT_DATE AND status = 'pending'
    """))).scalar() or 0.0

    # 6. Overdue amount last month (due date older than 30 days)
    overdue_amount_last_month = (await db.execute(text("""
        SELECT COALESCE(SUM(amount), 0) FROM accounts_receivable WHERE due_date < CURRENT_DATE - INTERVAL '30 days' AND status = 'pending'
    """))).scalar() or 0.0

    # 7. New Clients
    new_clients = (await db.execute(text("""
        SELECT COUNT(*) FROM users
        WHERE EXTRACT(MONTH FROM created_at) = :month AND EXTRACT(YEAR FROM created_at) = :year
    """), {"month": month, "year": year})).scalar() or 0

    # 8. Average satisfaction
    avg_sat = (await db.execute(text("""
        SELECT COALESCE(AVG(satisfaccion), 0) FROM post_event_feedback pef
        JOIN events e ON e.id = pef.event_id
        WHERE EXTRACT(MONTH FROM e.date) = :month AND EXTRACT(YEAR FROM e.date) = :year
    """), {"month": month, "year": year})).scalar() or 0.0

    return {
        "events_count": int(events_count),
        "total_income": float(total_income),
        "total_expenses": float(total_expenses),
        "best_event": best_event,
        "overdue_amount": float(overdue_amount),
        "overdue_amount_last_month": float(overdue_amount_last_month),
        "new_clients": int(new_clients),
        "avg_satisfaction": round(float(avg_sat), 1)
    }

def generate_fallback_summary(data: dict, month: int, year: int) -> str:
    """Generate a clean mock Spanish report if demo_mode is active or API fails."""
    income = data['total_income']
    expenses = data['total_expenses']
    net = income - expenses
    best_event = data['best_event'] or "Ninguno"
    overdue = data['overdue_amount']
    new_clients = data['new_clients']
    avg_sat = data['avg_satisfaction']

    summary = (
        f"El desempeño del negocio en {month:02d}/{year} fue sólido. "
        f"Se realizaron {data['events_count']} eventos, generando ingresos totales por ${income:,.0f} COP "
        f"y gastos por ${expenses:,.0f} COP, lo que representa una utilidad neta de ${net:,.0f} COP. "
        f"El evento de mayor rentabilidad fue '{best_event}'. "
    )
    if new_clients > 0:
        summary += f"Se captaron {new_clients} nuevos clientes para el CRM, manteniendo un nivel de satisfacción promedio de {avg_sat}/10. "
    if overdue > 0:
        summary += f"Actualmente la cartera vencida se ubica en ${overdue:,.0f} COP, mostrando un incremento comparado con meses anteriores. "
    summary += "Recomendación: Habilitar una campaña de recuperación de cartera y potenciar el aforo del formato más rentable para el próximo ciclo."
    return summary

import httpx

async def generate_gemini_summary(data: dict, month: int, year: int) -> str:
    """Generate executive summary using Gemini API via HTTP POST request."""
    prompt = f"""
    Eres un analista financiero que resume el desempeño de un negocio
    de eventos sociales en Colombia, en español, tono profesional pero cercano,
    máximo 150 palabras, en párrafos cortos.
    
    Datos del periodo {month:02d}/{year}:
    - Eventos realizados: {data['events_count']}
    - Ingresos totales: ${data['total_income']:,.0f} COP
    - Gastos totales: ${data['total_expenses']:,.0f} COP
    - Evento más rentable: {data['best_event'] or 'Ninguno'}
    - Cartera vencida actual: ${data['overdue_amount']:,.0f} COP
    - Cartera vencida mes anterior: ${data['overdue_amount_last_month']:,.0f} COP
    - Clientes nuevos: {data['new_clients']}
    - Satisfacción promedio: {data['avg_satisfaction']}/10
    
    Genera un resumen ejecutivo destacando lo más relevante, comparando 
    contra el periodo anterior cuando sea relevante, y termina con una 
    recomendación práctica de una sola frase. Do not output markdown code blocks (like ```markdown), just return the plain text report.
    """
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.gemini_api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "maxOutputTokens": 2000,
            "temperature": 0.7
        }
    }
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            res_json = response.json()
            try:
                text = res_json['candidates'][0]['content']['parts'][0]['text']
                return text.strip()
            except (KeyError, IndexError):
                raise Exception("Respuesta de Gemini API mal formateada")
        else:
            raise Exception(f"Gemini API returned status {response.status_code}: {response.text}")

async def generate_executive_summary(db: AsyncSession, month: int, year: int) -> str:
    """Generate executive summary using Gemini API, Claude API, or fallback based on config."""
    # 1. Fetch real metrics from DB
    data = await get_report_data(db, month, year)

    # 2. Check if demo mode is enabled (with no API keys)
    if settings.demo_mode and not settings.gemini_api_key and not settings.anthropic_api_key:
        return generate_fallback_summary(data, month, year)

    # 3. Try Gemini API first (if key exists)
    if settings.gemini_api_key:
        try:
            return await generate_gemini_summary(data, month, year)
        except Exception as e:
            print(f"[GEMINI API ERROR] {e}. Trying Claude...")

    # 4. Try Claude API (if key exists)
    if settings.anthropic_api_key:
        try:
            client = AsyncAnthropic(api_key=settings.anthropic_api_key)
            prompt = f"""
            Eres un analista financiero que resume el desempeño de un negocio
            de eventos sociales en Colombia, en español, tono profesional pero cercano,
            máximo 150 palabras, en párrafos cortos.
            
            Datos del periodo {month:02d}/{year}:
            - Eventos realizados: {data['events_count']}
            - Ingresos totales: ${data['total_income']:,.0f} COP
            - Gastos totales: ${data['total_expenses']:,.0f} COP
            - Evento más rentable: {data['best_event'] or 'Ninguno'}
            - Cartera vencida actual: ${data['overdue_amount']:,.0f} COP
            - Cartera vencida mes anterior: ${data['overdue_amount_last_month']:,.0f} COP
            - Clientes nuevos: {data['new_clients']}
            - Satisfacción promedio: {data['avg_satisfaction']}/10
            
            Genera un resumen ejecutivo destacando lo más relevante, comparando 
            contra el periodo anterior cuando sea relevante, y termina con una 
            recomendación práctica de una sola frase.
            """
            response = await client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=300,
                temperature=0.7,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        except Exception as e:
            print(f"[CLAUDE API ERROR] {e}. Falling back to template.")

    # 5. Fallback template
    return generate_fallback_summary(data, month, year)
