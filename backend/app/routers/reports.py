from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import require_permission, get_current_user
from app.services.report_service import generate_executive_summary
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime
import calendar
import csv
import io
from uuid import UUID

router = APIRouter(prefix="/api/v1/admin/reports", tags=["Reports"])

class SummaryRequest(BaseModel):
    month: int
    year: int
    force_regenerate: Optional[bool] = False

class SummaryOut(BaseModel):
    summary: str
    generated_at: datetime
    period: str

# Month name mapping in Spanish
MONTH_NAMES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
    7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

@router.post("/executive-summary", response_model=SummaryOut)
async def get_executive_summary_report(
    req: SummaryRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("dashboard", "view"))
):
    """Retrieve or generate the executive AI summary report for a specific period."""
    if req.month < 1 or req.month > 12:
        raise HTTPException(status_code=400, detail="Mes inválido")
        
    period_str = f"{MONTH_NAMES.get(req.month, str(req.month))} {req.year}"

    # Check if report already exists
    report_row = None
    if not req.force_regenerate:
        res = await db.execute(text("""
            SELECT summary_text, generated_at 
            FROM executive_reports 
            WHERE period_month = :month AND period_year = :year
        """), {"month": req.month, "year": req.year})
        report_row = res.fetchone()

    if report_row:
        return SummaryOut(
            summary=report_row.summary_text,
            generated_at=report_row.generated_at,
            period=period_str
        )

    # Generate new report
    summary_text = await generate_executive_summary(db, req.month, req.year)
    generated_time = datetime.now()

    # Save to db (insert or overwrite)
    await db.execute(text("""
        INSERT INTO executive_reports (period_month, period_year, summary_text, generated_at)
        VALUES (:month, :year, :summary_text, :gen_time)
        ON CONFLICT (period_month, period_year)
        DO UPDATE SET summary_text = EXCLUDED.summary_text, generated_at = EXCLUDED.generated_at
    """), {
        "month": req.month,
        "year": req.year,
        "summary_text": summary_text,
        "gen_time": generated_time
    })
    await db.commit()

    return SummaryOut(
        summary=summary_text,
        generated_at=generated_time,
        period=period_str
    )


# ─── MÓDULO 4: DASHBOARD EJECUTIVO DE CLIENTES NUEVOS & METAS (LINA & MARÍA) ──

def classify_city_bucket(raw_city: Optional[str]) -> str:
    """Clasifica una ciudad en uno de los 6 buckets oficiales del reporte ejecutivo."""
    if not raw_city:
        return "Bogotá"
    c = raw_city.lower().strip()
    if any(k in c for k in ["bogot", "chía", "chia", "cajic", "soacha", "tocancip", "zipaquir", "cundinamarca"]):
        return "Bogotá"
    if any(k in c for k in ["medell", "envigado", "sabaneta", "itagui", "itaguí", "bello", "rionegro", "antioquia"]):
        return "Medellín"
    if "cali" in c or "valle" in c:
        return "Cali"
    if any(k in c for k in ["miami", "florida", "coconut", "hollywood", "orlando", "lauderdale"]):
        return "Miami"
    if any(k in c for k in ["pereira", "manizales", "armenia", "dosquebradas", "risaralda", "caldas", "quindio"]):
        return "Eje Cafetero"
    return "Otras"


@router.get("/commercial-kpis")
async def get_commercial_kpis(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    daily_target: int = Query(15, ge=1),
    monthly_target: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user)
):
    """
    Dashboard ejecutivo de clientes nuevos vs meta diaria y acumulada por ciudad.
    Agrupa automáticamente el Eje Cafetero (Pereira, Manizales, Armenia, Dosquebradas).
    """
    if hasattr(year, 'default'):
        year = year.default
    if hasattr(month, 'default'):
        month = month.default
    if hasattr(daily_target, 'default'):
        daily_target = int(daily_target.default or 15)
    if hasattr(monthly_target, 'default'):
        monthly_target = monthly_target.default
    now = datetime.now()
    t_year = year or now.year
    t_month = month or now.month
    
    # Meta mensual predeterminada (Septiembre 350, Agosto 300, o días * 15)
    default_monthly_targets = {8: 300, 9: 350}
    days_in_month = calendar.monthrange(t_year, t_month)[1]
    m_target = monthly_target or default_monthly_targets.get(t_month, days_in_month * daily_target)

    # 1. Consultar todos los clientes/pagos del mes agrupados por día y ciudad
    query_month = """
        SELECT 
            EXTRACT(DAY FROM sp.payment_date)::int as day_num,
            TO_CHAR(sp.payment_date, 'YYYY-MM-DD') as day_str,
            COALESCE(p.city, l.city, sp.metadata->>'city', 'Bogotá') as raw_city,
            count(*) as client_count
        FROM stripe_payments sp
        LEFT JOIN profiles p ON p.user_id = sp.user_id
        LEFT JOIN leads_pendientes_entrevista l ON l.user_id = sp.user_id
        WHERE EXTRACT(YEAR FROM sp.payment_date) = :year
          AND EXTRACT(MONTH FROM sp.payment_date) = :month
          AND sp.payment_status = 'succeeded'
        GROUP BY day_num, day_str, raw_city
        ORDER BY day_num ASC
    """
    rows = (await db.execute(text(query_month), {"year": t_year, "month": t_month})).mappings().all()

    # Organizar por día: day_map[day_num] = {city_bucket: count}
    day_map: Dict[int, Dict[str, int]] = {d: {"Bogotá": 0, "Medellín": 0, "Cali": 0, "Miami": 0, "Eje Cafetero": 0, "Otras": 0} for d in range(1, days_in_month + 1)}

    for r in rows:
        d_num = r["day_num"]
        c_bucket = classify_city_bucket(r["raw_city"])
        if d_num in day_map:
            day_map[d_num][c_bucket] = day_map[d_num].get(c_bucket, 0) + int(r["client_count"])

    # 2. Generar desglose día a día con acumulados
    days_data = []
    running_cumulative = 0
    tot_bogota = 0
    tot_medellin = 0
    tot_cali = 0
    tot_miami = 0
    tot_eje_cafetero = 0
    tot_otras = 0

    for d in range(1, days_in_month + 1):
        c_data = day_map[d]
        b = c_data.get("Bogotá", 0)
        m = c_data.get("Medellín", 0)
        c = c_data.get("Cali", 0)
        mi = c_data.get("Miami", 0)
        ec = c_data.get("Eje Cafetero", 0)
        ot = c_data.get("Otras", 0)
        day_total = b + m + c + mi + ec + ot

        running_cumulative += day_total
        cum_target = d * daily_target
        cum_pct = round((running_cumulative / cum_target * 100.0), 1) if cum_target > 0 else 0.0
        day_pct = round((day_total / daily_target * 100.0), 1) if daily_target > 0 else 0.0

        tot_bogota += b
        tot_medellin += m
        tot_cali += c
        tot_miami += mi
        tot_eje_cafetero += ec
        tot_otras += ot

        days_data.append({
            "day": d,
            "date": f"{t_year}-{t_month:02d}-{d:02d}",
            "bogota": b,
            "medellin": m,
            "cali": c,
            "miami": mi,
            "eje_cafetero": ec,
            "otras": ot,
            "total_day": day_total,
            "target_day": daily_target,
            "compliance_day_pct": day_pct,
            "cumulative": running_cumulative,
            "target_cumulative": cum_target,
            "compliance_cumulative_pct": cum_pct
        })

    total_month = running_cumulative
    month_compliance_pct = round((total_month / m_target * 100.0), 1) if m_target > 0 else 0.0

    # 3. Comparativa histórica mes a mes (Ene a Dic)
    query_history = """
        SELECT 
            EXTRACT(MONTH FROM sp.payment_date)::int as m_num,
            COALESCE(p.city, l.city, sp.metadata->>'city', 'Bogotá') as raw_city,
            count(*) as client_count
        FROM stripe_payments sp
        LEFT JOIN profiles p ON p.user_id = sp.user_id
        LEFT JOIN leads_pendientes_entrevista l ON l.user_id = sp.user_id
        WHERE EXTRACT(YEAR FROM sp.payment_date) = :year
          AND sp.payment_status = 'succeeded'
        GROUP BY m_num, raw_city
        ORDER BY m_num ASC
    """
    hist_rows = (await db.execute(text(query_history), {"year": t_year})).mappings().all()
    hist_map: Dict[int, Dict[str, int]] = {m_idx: {"Bogotá": 0, "Medellín": 0, "Cali": 0, "Miami": 0, "Eje Cafetero": 0, "Otras": 0} for m_idx in range(1, 13)}

    for hr in hist_rows:
        m_idx = hr["m_num"]
        c_bucket = classify_city_bucket(hr["raw_city"])
        if m_idx in hist_map:
            hist_map[m_idx][c_bucket] = hist_map[m_idx].get(c_bucket, 0) + int(hr["client_count"])

    historical_months = []
    prev_total = 0
    for m_idx in range(1, 13):
        m_counts = hist_map[m_idx]
        b = m_counts["Bogotá"]
        m = m_counts["Medellín"]
        c = m_counts["Cali"]
        mi = m_counts["Miami"]
        ec = m_counts["Eje Cafetero"]
        ot = m_counts["Otras"]
        m_tot = b + m + c + mi + ec + ot
        
        target_m = default_monthly_targets.get(m_idx, 300)
        growth_pct = round(((m_tot - prev_total) / prev_total * 100.0), 1) if prev_total > 0 else 0.0
        comp_pct = round((m_tot / target_m * 100.0), 1) if target_m > 0 else 0.0

        historical_months.append({
            "month": m_idx,
            "name": f"{MONTH_NAMES.get(m_idx, str(m_idx))} {t_year}",
            "bogota": b,
            "medellin": m,
            "cali": c,
            "miami": mi,
            "eje_cafetero": ec,
            "otras": ot,
            "total": m_tot,
            "target": target_m,
            "growth_pct": growth_pct if prev_total > 0 else None,
            "compliance_pct": comp_pct
        })
        if m_tot > 0:
            prev_total = m_tot

    return {
        "year": t_year,
        "month": t_month,
        "month_name": MONTH_NAMES.get(t_month, str(t_month)),
        "daily_target": daily_target,
        "monthly_target": m_target,
        "total_month": total_month,
        "compliance_month_pct": month_compliance_pct,
        "summary_by_city": {
            "bogota": tot_bogota,
            "medellin": tot_medellin,
            "cali": tot_cali,
            "miami": tot_miami,
            "eje_cafetero": tot_eje_cafetero,
            "otras": tot_otras,
            "pct_bogota": round((tot_bogota / total_month * 100.0), 1) if total_month > 0 else 0.0,
            "pct_medellin": round((tot_medellin / total_month * 100.0), 1) if total_month > 0 else 0.0,
            "pct_cali": round((tot_cali / total_month * 100.0), 1) if total_month > 0 else 0.0,
            "pct_miami": round((tot_miami / total_month * 100.0), 1) if total_month > 0 else 0.0,
            "pct_eje_cafetero": round((tot_eje_cafetero / total_month * 100.0), 1) if total_month > 0 else 0.0,
            "pct_otras": round((tot_otras / total_month * 100.0), 1) if total_month > 0 else 0.0
        },
        "days": days_data,
        "historical_months": historical_months
    }


@router.get("/commercial-kpis/export-csv")
async def export_commercial_kpis_csv(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    daily_target: int = Query(15, ge=1),
    db: AsyncSession = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user)
):
    """Descarga directa del CSV idéntico a la plantilla de Google Sheets de Lina y María."""
    data = await get_commercial_kpis(
        year=year,
        month=month,
        daily_target=daily_target,
        db=db,
        user=user
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Header estilo Lina
    writer.writerow(["Clientes nuevos · seguimiento diario"])
    writer.writerow([f"Meta: {daily_target} clientes nuevos al día ({data['month_name']} {data['year']}). Fuente: DailyLover Backend."])
    writer.writerow(["Meta diaria →", daily_target])
    writer.writerow([
        "Fecha", "Bogotá", "Medellín", "Cali", "Miami", "Eje Cafetero", "Otras",
        "Total día", "Meta día", "% cumplimiento día", "Acumulado", "Meta acumulada", "% acumulado"
    ])

    for d in data["days"]:
        writer.writerow([
            d["date"],
            d["bogota"],
            d["medellin"],
            d["cali"],
            d["miami"],
            d["eje_cafetero"],
            d["otras"],
            d["total_day"],
            d["target_day"],
            f"{d['compliance_day_pct']}%",
            d["cumulative"],
            d["target_cumulative"],
            f"{d['compliance_cumulative_pct']}%"
        ])

    # Totales y porcentajes
    s = data["summary_by_city"]
    writer.writerow([])
    writer.writerow([
        "Total mes",
        s["bogota"], s["medellin"], s["cali"], s["miami"], s["eje_cafetero"], s["otras"],
        data["total_month"], data["monthly_target"], f"{data['compliance_month_pct']}%"
    ])
    writer.writerow([
        "% por ciudad",
        f"{s['pct_bogota']}%", f"{s['pct_medellin']}%", f"{s['pct_cali']}%", f"{s['pct_miami']}%", f"{s['pct_eje_cafetero']}%", f"{s['pct_otras']}%"
    ])

    csv_content = output.getvalue()
    filename = f"clientes_nuevos_{data['year']}_{data['month']:02d}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

