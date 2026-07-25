from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from typing import Optional

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])

@router.get("")
async def get_inventory(brand_id: Optional[int] = None, venue_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    query = """
        SELECT 
            i.id,
            v.name as venue_name,
            b.name as brand_name,
            b.accent_color,
            p.name as product_name,
            pc.name as category_name,
            i.bar_number,
            i.stock_bottles,
            i.min_stock,
            p.cost_price,
            p.sell_price,
            i.last_counted_at
        FROM inventory i
        JOIN venues v ON i.venue_id = v.id
        JOIN brands b ON v.brand_id = b.id
        JOIN products p ON i.product_id = p.id
        JOIN product_categories pc ON p.category_id = pc.id
        WHERE 1=1
    """
    params = {}
    if brand_id:
        query += " AND b.id = :brand_id"
        params["brand_id"] = brand_id
    if venue_id:
        query += " AND v.id = :venue_id"
        params["venue_id"] = venue_id
        
    query += " ORDER BY b.name, v.name, pc.name, p.name"
    
    res = await db.execute(text(query), params)
    rows = res.fetchall()
    
    inventory_list = []
    for r in rows:
        status = "normal"
        if r.stock_bottles <= 0:
            status = "out_of_stock"
        elif r.stock_bottles <= r.min_stock:
            status = "low_stock"
            
        inventory_list.append({
            "id": r.id,
            "venue_name": r.venue_name,
            "brand_name": r.brand_name,
            "accent_color": r.accent_color,
            "product_name": r.product_name,
            "category_name": r.category_name,
            "bar_number": r.bar_number,
            "stock_bottles": float(r.stock_bottles),
            "min_stock": float(r.min_stock),
            "cost_price": float(r.cost_price),
            "sell_price": float(r.sell_price),
            "last_counted_at": r.last_counted_at.isoformat() if r.last_counted_at else None,
            "status": status
        })
    return inventory_list

@router.get("/alerts")
async def get_inventory_alerts(brand_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    query = """
        SELECT a.id, v.name as venue_name, b.name as brand_name, b.accent_color, a.severity, a.title, a.message, a.created_at
        FROM alerts a
        JOIN venues v ON a.venue_id = v.id
        JOIN brands b ON v.brand_id = b.id
        WHERE a.type = 'stock_low' AND a.is_resolved = FALSE
    """
    params = {}
    if brand_id:
        query += " AND b.id = :brand_id"
        params["brand_id"] = brand_id
        
    res = await db.execute(text(query), params)
    rows = res.fetchall()
    return [dict(row._mapping) for row in rows]

@router.get("/variance")
async def get_inventory_variance(brand_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    # Standard static demo data for variance (mermas POS vs físico)
    # Typically calculated by crossing POS sales with inventory checks
    data = [
        {"brand": "Furia Bogotá", "bar": "Barra 1", "bartender": "Diego R.", "product": "Absolut Original", "pos_qty": 35, "phys_qty": 37.5, "variance": -2.5, "cost_lost": 162500, "status": "flagged"},
        {"brand": "Matildelina Bogotá", "bar": "Barra 2", "bartender": "María P.", "product": "Buchanan's 12 Años", "pos_qty": 18, "phys_qty": 19.0, "variance": -1.0, "cost_lost": 180000, "status": "reviewed"},
        {"brand": "Gyal Bogotá", "bar": "Barra 1", "bartender": "Andrés G.", "product": "Aguardiente Antioqueño", "pos_qty": 40, "phys_qty": 43.0, "variance": -3.0, "cost_lost": 105000, "status": "flagged"},
        {"brand": "Casa D Bogotá", "bar": "Barra 1", "bartender": "Felipe A.", "product": "Johnnie Walker Black", "pos_qty": 10, "phys_qty": 10.2, "variance": -0.2, "cost_lost": 30000, "status": "normal"},
        {"brand": "África Bogotá", "bar": "Barra 2", "bartender": "Natalia C.", "product": "Don Julio Reposado", "pos_qty": 5, "phys_qty": 5.0, "variance": 0.0, "cost_lost": 0, "status": "normal"}
    ]
    if brand_id:
        brand_names = {1: "Matildelina Bogotá", 2: "Furia Bogotá", 3: "Casa D Bogotá", 4: "África Bogotá", 5: "Gyal Bogotá"}
        target = brand_names.get(brand_id)
        data = [item for item in data if item["brand"] == target]
    return data

@router.get("/forecast")
async def get_inventory_forecast(brand_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    # Standard demand forecast data
    data = [
        {"brand": "Matildelina Bogotá", "product": "Buchanan's 12 Años", "current_stock": 26, "avg_saturday": 20, "forecast_next": 28, "recommended_order": 12, "reason": "Artista invitado de vallenato (Carlos Vives Jr) programado para el sábado"},
        {"brand": "Furia Bogotá", "product": "Grey Goose", "current_stock": 14, "avg_saturday": 15, "forecast_next": 22, "recommended_order": 15, "reason": "Evento Afterlife (Tale of Us) tiene reservas al 100%"},
        {"brand": "Gyal Bogotá", "product": "Aguardiente Antioqueño", "current_stock": 40, "avg_saturday": 35, "forecast_next": 45, "recommended_order": 15, "reason": "Noche Bad Bunny temática con cover agotado en preventa"},
        {"brand": "Casa D Bogotá", "product": "Corona Extra", "current_stock": 15, "avg_saturday": 30, "forecast_next": 35, "recommended_order": 25, "reason": "Partido Selección Colombia el jueves empalma con fin de semana"}
    ]
    if brand_id:
        brand_names = {1: "Matildelina Bogotá", 2: "Furia Bogotá", 3: "Casa D Bogotá", 4: "África Bogotá", 5: "Gyal Bogotá"}
        target = brand_names.get(brand_id)
        data = [item for item in data if item["brand"] == target]
    return data
