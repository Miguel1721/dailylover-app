from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import require_permission
from app.services.report_service import generate_executive_summary
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
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
