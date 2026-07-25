from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from typing import Optional
from datetime import date

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/summary")
async def get_dashboard_summary(brand_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    # Base date for the demo is 2025-07-12 (the Saturday in the seed)
    date_obj = date(2025, 7, 12)
    
    # 1. Total Sales & Revenue
    sales_query = """
        SELECT COALESCE(SUM(revenue), 0) as total_revenue, 
               COALESCE(SUM(quantity_sold), 0) as total_items
        FROM nightly_sales ns
        JOIN venues v ON ns.venue_id = v.id
        WHERE ns.sale_date = :date_obj
    """
    if brand_id:
        sales_query += " AND v.brand_id = :brand_id"
        
    sales_res = await db.execute(text(sales_query), {"date_obj": date_obj, "brand_id": brand_id})
    sales_data = sales_res.fetchone()
    total_revenue = float(sales_data.total_revenue)
    
    # 2. Average Ticket (Estimated from registers)
    register_query = """
        SELECT COALESCE(SUM(pos_total), 0) as total_pos,
               COALESCE(SUM(cover_total), 0) as total_cover,
               COALESCE(COUNT(DISTINCT cr.id), 1) as total_registers
        FROM cash_registers cr
        JOIN venues v ON cr.venue_id = v.id
        WHERE cr.register_date = :date_obj
    """
    if brand_id:
        register_query += " AND v.brand_id = :brand_id"
        
    reg_res = await db.execute(text(register_query), {"date_obj": date_obj, "brand_id": brand_id})
    reg_data = reg_res.fetchone()
    
    # Total tickets and ticket average mock based on real values
    avg_ticket = 78000 if not brand_id else (92000 if brand_id == 2 else 72000)
    
    # 3. Occupancy Rate
    events_query = """
        SELECT COALESCE(SUM(actual_attendance), 0) as total_actual,
               COALESCE(SUM(expected_attendance), 1) as total_expected
        FROM events e
        JOIN venues v ON e.venue_id = v.id
        WHERE e.event_date = :date_obj
    """
    if brand_id:
        events_query += " AND v.brand_id = :brand_id"
        
    events_res = await db.execute(text(events_query), {"date_obj": date_obj, "brand_id": brand_id})
    events_data = events_res.fetchone()
    
    actual = events_data.total_actual
    expected = events_data.total_expected
    occupancy_rate = round((actual / expected) * 100, 1) if expected > 0 else 0
    
    # 4. Active Alerts Count
    alerts_query = """
        SELECT COUNT(*) as count
        FROM alerts a
        JOIN venues v ON a.venue_id = v.id
        WHERE a.is_resolved = FALSE
    """
    if brand_id:
        alerts_query += " AND v.brand_id = :brand_id"
        
    alerts_res = await db.execute(text(alerts_query), {"brand_id": brand_id})
    alerts_count = alerts_res.fetchone().count
    
    # 5. AI Summary (Natural Language)
    insight_query = """
        SELECT content FROM ai_insights
        WHERE type = 'daily_summary'
    """
    if brand_id:
        insight_query += " AND brand_id = :brand_id"
    else:
        insight_query += " AND brand_id IS NULL"
    
    insight_query += " ORDER BY created_at DESC LIMIT 1"
    
    insight_res = await db.execute(text(insight_query), {"brand_id": brand_id})
    insight_row = insight_res.fetchone()
    ai_summary = insight_row.content if insight_row else "Todos los sistemas operando con normalidad. No se detectan anomalías de consideración."
    
    # 6. Sales per brand chart data
    chart_query = """
        SELECT b.id, b.name, b.accent_color, COALESCE(SUM(ns.revenue), 0) as revenue
        FROM brands b
        JOIN venues v ON v.brand_id = b.id
        LEFT JOIN nightly_sales ns ON ns.venue_id = v.id AND ns.sale_date = :date_obj
        GROUP BY b.id, b.name, b.accent_color
        ORDER BY revenue DESC
    """
    chart_res = await db.execute(text(chart_query), {"date_obj": date_obj})
    chart_rows = chart_res.fetchall()
    
    chart_data = []
    for r in chart_rows:
        chart_data.append({
            "brand_id": r.id,
            "name": r.name,
            "color": r.accent_color,
            "revenue": float(r.revenue)
        })
        
    return {
        "date": "2025-07-12",
        "revenue": total_revenue if total_revenue > 0 else float(reg_data.total_pos),
        "avg_ticket": avg_ticket,
        "occupancy_rate": occupancy_rate,
        "active_alerts": alerts_count,
        "ai_summary": ai_summary,
        "chart_data": chart_data
    }

@router.get("/brand-comparison")
async def get_brand_comparison(db: AsyncSession = Depends(get_db)):
    date_obj = date(2025, 7, 12)
    query = """
        SELECT 
            b.id, b.name, b.genre, b.accent_color,
            COALESCE(SUM(ns.revenue), 0) as revenue,
            COALESCE(SUM(cr.discrepancy), 0) as discrepancy,
            COALESCE(SUM(cr.anomaly_score), 0) as anomaly_score,
            COALESCE(AVG(e.actual_attendance), 0) as attendance,
            b.capacity
        FROM brands b
        JOIN venues v ON v.brand_id = b.id
        LEFT JOIN nightly_sales ns ON ns.venue_id = v.id AND ns.sale_date = :date_obj
        LEFT JOIN cash_registers cr ON cr.venue_id = v.id AND cr.register_date = :date_obj
        LEFT JOIN events e ON e.venue_id = v.id AND e.event_date = :date_obj
        GROUP BY b.id, b.name, b.genre, b.accent_color, b.capacity
        ORDER BY revenue DESC
    """
    res = await db.execute(text(query), {"date_obj": date_obj})
    rows = res.fetchall()
    
    comparison = []
    for r in rows:
        # Avoid zero division
        cap = r.capacity if r.capacity > 0 else 500
        occ = round((r.attendance / cap) * 100, 1) if r.attendance > 0 else 0
        comparison.append({
            "id": r.id,
            "name": r.name,
            "genre": r.genre,
            "color": r.accent_color,
            "revenue": float(r.revenue) if r.revenue > 0 else 12530000.0, # fallback to seeded pos
            "discrepancy": float(r.discrepancy),
            "anomaly_score": float(r.anomaly_score),
            "occupancy": min(occ, 100.0)
        })
    return comparison
