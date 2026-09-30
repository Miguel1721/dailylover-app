from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.scheduling import require_admin
from app.services import ops_watch

router = APIRouter(prefix="/api/v1/ops", tags=["Operaciones"])


@router.get("/status")
async def ops_status(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    """Estado actual de la vigilancia (no envía alertas): pagos de Stripe sin registrar y silencio del webhook del CRM."""
    await ops_watch.ensure_ops_tables(db)
    res = await ops_watch.run_checks(db, notify=False)
    rows = (await db.execute(text("SELECT key, detail, first_seen, last_notified, resolved_at FROM ops_alerts ORDER BY first_seen DESC LIMIT 10"))).fetchall()
    res["alerts"] = [{"key": r[0], "detail": r[1], "first_seen": r[2].isoformat() if r[2] else None,
                      "last_notified": r[3].isoformat() if r[3] else None, "resolved": r[4] is not None} for r in rows]
    return res


@router.post("/check-now")
async def ops_check_now(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    """Ejecuta la vigilancia ahora y envía las alertas que correspondan."""
    return await ops_watch.run_checks(db, notify=True)
