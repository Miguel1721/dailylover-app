"""Finanzas: lo que ingresa por día, semana y mes, los gastos y la utilidad. SOLO la ve María (Super Admin).

Ingresos = pagos de Stripe (se registran solos; si el webhook falla, la vigilancia los recupera) + ingresos manuales (transferencia, efectivo).
Las fechas se cuentan en hora de Colombia. Los pagos que entraron por el webhook antiguo se guardaron en hora del servidor (UTC):
se detectan porque su fecha de pago es igual a la de registro, y se restan 5 horas.
"""
import csv
import io
import re
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_current_user
from app.database import get_db


async def solo_maria(user: dict = Depends(get_current_user)) -> dict:
    """Finanzas es solo de María: el rol Super Admin (no basta con ser Admin)."""
    if user.get("is_client") or str(user.get("role_name") or "") != "Super Admin":
        raise HTTPException(status_code=403, detail="Finanzas es solo para María.")
    return user


router = APIRouter(prefix="/api/v1/finanzas", tags=["Finanzas (solo María)"], dependencies=[Depends(solo_maria)])

FECHA_LOCAL = "(CASE WHEN ABS(EXTRACT(EPOCH FROM (s.created_at - s.payment_date))) < 60 THEN s.payment_date - INTERVAL '5 hours' ELSE s.payment_date END)"
CATEGORIAS_GASTO = ["nomina", "honorarios", "arriendo", "restaurantes_y_citas", "publicidad", "software", "comisiones_stripe", "impuestos", "eventos", "reembolsos", "otros"]
CATEGORIAS_INGRESO_MANUAL = ["transferencia", "efectivo", "evento", "plan", "otro"]
_ready = False


async def _asegurar(db: AsyncSession) -> None:
    global _ready
    if _ready:
        return
    for q in ("ALTER TABLE income_records ADD COLUMN IF NOT EXISTS registrado_por TEXT", "ALTER TABLE income_records ADD COLUMN IF NOT EXISTS cliente TEXT",
              "ALTER TABLE expense_records ADD COLUMN IF NOT EXISTS registrado_por TEXT", "ALTER TABLE expense_records ADD COLUMN IF NOT EXISTS proveedor TEXT",
              "ALTER TABLE expense_records ADD COLUMN IF NOT EXISTS notas TEXT"):
        await db.execute(text(q))
    await db.commit()
    _ready = True


def _categoria(plan: Optional[str]) -> str:
    p = (plan or "").lower()
    if re.search(r"evento|hot|party|singles|historias de amor", p):
        return "Eventos"
    if re.search(r"recompra", p):
        return "Recompra de citas"
    if re.search(r"plan especial|personalizado|pendiente", p):
        return "Otros pagos"
    return "Planes"


def _inicio_periodo(d: date, agrupar: str) -> date:
    if agrupar == "semana":
        return d - timedelta(days=d.weekday())
    if agrupar == "mes":
        return d.replace(day=1)
    return d


def _hoy() -> date:
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("America/Bogota")).date()


async def _pagos(db: AsyncSession, desde: date, hasta: date) -> List[Dict[str, Any]]:
    rows = (await db.execute(text(f"""
        SELECT s.id, ({FECHA_LOCAL})::date AS dia, ({FECHA_LOCAL}) AS fecha_hora, s.customer_name, s.customer_email, s.plan_tier, s.amount, s.amount_refunded, s.payment_status,
               s.stripe_payment_intent_id AS ref, s.metadata->>'recuperado' AS recuperado
        FROM stripe_payments s
        WHERE s.payment_status IN ('succeeded', 'partially_refunded', 'refunded') AND ({FECHA_LOCAL})::date BETWEEN :d AND :h
        ORDER BY ({FECHA_LOCAL}) DESC"""), {"d": desde, "h": hasta})).fetchall()
    out = []
    for r in rows:
        bruto = float(r.amount or 0)
        reemb = float(r.amount_refunded or 0)
        if r.payment_status == "refunded" and reemb == 0:
            reemb = bruto
        out.append({"origen": "stripe", "id": str(r.id), "fecha": r.dia, "hora": r.fecha_hora.strftime("%H:%M") if r.fecha_hora else "", "cliente": r.customer_name or r.customer_email or "",
                    "plan": r.plan_tier or "", "categoria": _categoria(r.plan_tier), "bruto": bruto, "reembolso": reemb, "neto": bruto - reemb, "estado": r.payment_status, "ref": r.ref})
    return out


async def _manuales(db: AsyncSession, desde: date, hasta: date) -> List[Dict[str, Any]]:
    rows = (await db.execute(text("""SELECT id, received_at, category, description, amount, payment_method, cliente FROM income_records WHERE received_at BETWEEN :d AND :h ORDER BY received_at DESC, created_at DESC"""),
                             {"d": desde, "h": hasta})).fetchall()
    return [{"origen": "manual", "id": str(r.id), "fecha": r.received_at, "hora": "", "cliente": r.cliente or r.description or "", "plan": r.description or "", "categoria": "Manual: " + (r.category or "otro"),
             "bruto": float(r.amount), "reembolso": 0.0, "neto": float(r.amount), "estado": "registrado", "ref": r.payment_method or ""} for r in rows]


async def _gastos(db: AsyncSession, desde: date, hasta: date) -> List[Dict[str, Any]]:
    rows = (await db.execute(text("""SELECT id, paid_at, category, description, amount, payment_method, is_recurring, proveedor, notas FROM expense_records WHERE paid_at BETWEEN :d AND :h ORDER BY paid_at DESC, created_at DESC"""),
                             {"d": desde, "h": hasta})).fetchall()
    return [{"id": str(r.id), "fecha": r.paid_at, "categoria": r.category, "descripcion": r.description or "", "monto": float(r.amount), "metodo": r.payment_method or "",
             "recurrente": bool(r.is_recurring), "proveedor": r.proveedor or "", "notas": r.notas or ""} for r in rows]


def _suma(items, k):
    return float(sum(x[k] for x in items))


def _serie(pagos, manuales, gastos, agrupar: str, desde: date, hasta: date) -> List[Dict[str, Any]]:
    claves: Dict[date, Dict[str, Any]] = {}
    d = _inicio_periodo(desde, agrupar)
    while d <= hasta:
        claves[d] = {"periodo": d.isoformat(), "bruto": 0.0, "reembolsos": 0.0, "manuales": 0.0, "gastos": 0.0, "n_pagos": 0}
        d = d + timedelta(days=1) if agrupar == "dia" else (d + timedelta(days=7) if agrupar == "semana" else (d.replace(year=d.year + 1, month=1) if d.month == 12 else d.replace(month=d.month + 1)))
    for p in pagos:
        c = claves.get(_inicio_periodo(p["fecha"], agrupar))
        if c:
            c["bruto"] += p["bruto"]; c["reembolsos"] += p["reembolso"]; c["n_pagos"] += 1
    for m in manuales:
        c = claves.get(_inicio_periodo(m["fecha"], agrupar))
        if c:
            c["manuales"] += m["bruto"]
    for g in gastos:
        c = claves.get(_inicio_periodo(g["fecha"], agrupar))
        if c:
            c["gastos"] += g["monto"]
    out = []
    for c in claves.values():
        c["ingresos"] = c["bruto"] - c["reembolsos"] + c["manuales"]
        c["utilidad"] = c["ingresos"] - c["gastos"]
        out.append(c)
    return out


@router.get("/resumen")
async def resumen(agrupar: str = Query("dia", pattern="^(dia|semana|mes)$"), desde: Optional[date] = None, hasta: Optional[date] = None, db: AsyncSession = Depends(get_db)):
    await _asegurar(db)
    hoy = _hoy()
    hasta = hasta or hoy
    desde = desde or (hoy - timedelta(days=29) if agrupar == "dia" else (hoy - timedelta(weeks=11) if agrupar == "semana" else hoy.replace(day=1) - timedelta(days=330)))
    if desde > hasta:
        raise HTTPException(status_code=422, detail="La fecha inicial debe ser anterior a la final.")
    pagos, manuales, gastos = await _pagos(db, desde, hasta), await _manuales(db, desde, hasta), await _gastos(db, desde, hasta)
    serie = _serie(pagos, manuales, gastos, agrupar, desde, hasta)
    por_plan: Dict[str, Dict[str, float]] = {}
    for p in pagos:
        k = re.sub(r"\s+", " ", (p["plan"] or "Sin plan").replace("??", "á")).strip() or "Sin plan"
        e = por_plan.setdefault(k, {"neto": 0.0, "n": 0})
        e["neto"] += p["neto"]; e["n"] += 1
    por_cat: Dict[str, float] = {}
    for p in pagos:
        por_cat[p["categoria"]] = por_cat.get(p["categoria"], 0.0) + p["neto"]
    for m in manuales:
        por_cat[m["categoria"]] = por_cat.get(m["categoria"], 0.0) + m["neto"]
    gasto_cat: Dict[str, float] = {}
    for g in gastos:
        gasto_cat[g["categoria"]] = gasto_cat.get(g["categoria"], 0.0) + g["monto"]

    async def periodo(d1: date, d2: date) -> Dict[str, float]:
        pg, mn, gs = await _pagos(db, d1, d2), await _manuales(db, d1, d2), await _gastos(db, d1, d2)
        ing = _suma(pg, "neto") + _suma(mn, "neto")
        return {"ingresos": ing, "bruto": _suma(pg, "bruto") + _suma(mn, "bruto"), "reembolsos": _suma(pg, "reembolso"), "gastos": _suma(gs, "monto"), "utilidad": ing - _suma(gs, "monto"), "n_pagos": len(pg)}

    ini_sem, ini_mes = _inicio_periodo(hoy, "semana"), hoy.replace(day=1)
    ant_mes_fin = ini_mes - timedelta(days=1)
    tarjetas = {
        "hoy": await periodo(hoy, hoy), "ayer": await periodo(hoy - timedelta(days=1), hoy - timedelta(days=1)),
        # se compara el MISMO tramo: lunes a hoy contra lunes a ese mismo día de la semana pasada; día 1 a hoy contra día 1 a ese mismo día del mes pasado
        "semana": await periodo(ini_sem, hoy), "semana_anterior": await periodo(ini_sem - timedelta(days=7), hoy - timedelta(days=7)),
        "mes": await periodo(ini_mes, hoy), "mes_anterior": await periodo(ant_mes_fin.replace(day=1), ant_mes_fin.replace(day=min(hoy.day, ant_mes_fin.day))),
    }
    return {"agrupar": agrupar, "desde": desde.isoformat(), "hasta": hasta.isoformat(), "serie": serie,
            "totales": {"bruto": _suma(pagos, "bruto") + _suma(manuales, "bruto"), "reembolsos": _suma(pagos, "reembolso"), "ingresos": _suma(pagos, "neto") + _suma(manuales, "neto"),
                        "gastos": _suma(gastos, "monto"), "utilidad": _suma(pagos, "neto") + _suma(manuales, "neto") - _suma(gastos, "monto"), "n_pagos": len(pagos)},
            "por_categoria": sorted([{"categoria": k, "monto": v} for k, v in por_cat.items()], key=lambda x: -x["monto"]),
            "por_plan": sorted([{"plan": k, "neto": v["neto"], "n": v["n"]} for k, v in por_plan.items()], key=lambda x: -x["neto"])[:12],
            "gastos_por_categoria": sorted([{"categoria": k, "monto": v} for k, v in gasto_cat.items()], key=lambda x: -x["monto"]),
            "tarjetas": tarjetas, "ultimo_pago_registrado": (pagos[0]["fecha"].isoformat() + " " + pagos[0]["hora"]) if pagos else None}


@router.get("/ingresos")
async def ingresos(desde: Optional[date] = None, hasta: Optional[date] = None, q: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    await _asegurar(db)
    hoy = _hoy()
    desde, hasta = desde or hoy - timedelta(days=6), hasta or hoy
    items = (await _pagos(db, desde, hasta)) + (await _manuales(db, desde, hasta))
    if q and q.strip():
        t = q.strip().lower()
        items = [x for x in items if t in f"{x['cliente']} {x['plan']} {x['ref']}".lower()]
    items.sort(key=lambda x: (x["fecha"], x["hora"]), reverse=True)
    return {"items": [{**x, "fecha": x["fecha"].isoformat()} for x in items[:1500]], "total_neto": _suma(items, "neto"), "total_bruto": _suma(items, "bruto"), "reembolsos": _suma(items, "reembolso"), "n": len(items)}


class IngresoManual(BaseModel):
    fecha: date
    monto: float = Field(gt=0)
    categoria: str = "otro"
    descripcion: str = Field(min_length=2, max_length=255)
    cliente: Optional[str] = Field(None, max_length=150)
    metodo: Optional[str] = Field("transferencia", max_length=30)


@router.post("/ingresos")
async def crear_ingreso(p: IngresoManual, db: AsyncSession = Depends(get_db), user: dict = Depends(solo_maria)):
    await _asegurar(db)
    if p.fecha > _hoy() + timedelta(days=1):
        raise HTTPException(status_code=422, detail="La fecha no puede ser futura.")
    nid = uuid4()
    await db.execute(text("""INSERT INTO income_records (id, category, description, amount, payment_method, received_at, registrado_por, cliente)
        VALUES (:i, :c, :d, :a, :m, :f, :u, :cl)"""), {"i": nid, "c": p.categoria[:50], "d": p.descripcion.strip(), "a": p.monto, "m": p.metodo, "f": p.fecha, "u": str(user.get("email")), "cl": (p.cliente or "").strip() or None})
    await db.commit()
    return {"status": "success", "id": str(nid)}


@router.delete("/ingresos/{ingreso_id}")
async def borrar_ingreso(ingreso_id: str, db: AsyncSession = Depends(get_db)):
    """Solo se borran ingresos MANUALES; los pagos de Stripe no se tocan."""
    r = await db.execute(text("DELETE FROM income_records WHERE id = CAST(:i AS uuid)"), {"i": ingreso_id})
    await db.commit()
    if r.rowcount == 0:
        raise HTTPException(status_code=404, detail="Ingreso manual no encontrado (los pagos de Stripe no se pueden borrar).")
    return {"status": "success"}


class Gasto(BaseModel):
    fecha: date
    monto: float = Field(gt=0)
    categoria: str
    descripcion: str = Field(min_length=2, max_length=255)
    proveedor: Optional[str] = Field(None, max_length=150)
    metodo: Optional[str] = Field("transferencia", max_length=30)
    recurrente: bool = False
    notas: Optional[str] = Field(None, max_length=500)


@router.get("/gastos")
async def gastos(desde: Optional[date] = None, hasta: Optional[date] = None, db: AsyncSession = Depends(get_db)):
    await _asegurar(db)
    hoy = _hoy()
    desde, hasta = desde or hoy.replace(day=1), hasta or hoy
    items = await _gastos(db, desde, hasta)
    por: Dict[str, float] = {}
    for g in items:
        por[g["categoria"]] = por.get(g["categoria"], 0.0) + g["monto"]
    return {"items": [{**g, "fecha": g["fecha"].isoformat()} for g in items], "total": _suma(items, "monto"), "por_categoria": por, "categorias": CATEGORIAS_GASTO}


@router.post("/gastos")
async def crear_gasto(p: Gasto, db: AsyncSession = Depends(get_db), user: dict = Depends(solo_maria)):
    await _asegurar(db)
    if p.categoria not in CATEGORIAS_GASTO:
        raise HTTPException(status_code=422, detail="Categoría inválida.")
    if p.fecha > _hoy() + timedelta(days=1):
        raise HTTPException(status_code=422, detail="La fecha no puede ser futura.")
    nid = uuid4()
    await db.execute(text("""INSERT INTO expense_records (id, category, description, amount, payment_method, paid_at, is_recurring, registrado_por, proveedor, notas)
        VALUES (:i, :c, :d, :a, :m, :f, :r, :u, :pv, :n)"""), {"i": nid, "c": p.categoria, "d": p.descripcion.strip(), "a": p.monto, "m": p.metodo, "f": p.fecha, "r": p.recurrente, "u": str(user.get("email")), "pv": (p.proveedor or "").strip() or None, "n": (p.notas or "").strip() or None})
    await db.commit()
    return {"status": "success", "id": str(nid)}


@router.put("/gastos/{gasto_id}")
async def editar_gasto(gasto_id: str, p: Gasto, db: AsyncSession = Depends(get_db)):
    if p.categoria not in CATEGORIAS_GASTO:
        raise HTTPException(status_code=422, detail="Categoría inválida.")
    r = await db.execute(text("""UPDATE expense_records SET category = :c, description = :d, amount = :a, payment_method = :m, paid_at = :f, is_recurring = :r, proveedor = :pv, notas = :n
        WHERE id = CAST(:i AS uuid)"""), {"i": gasto_id, "c": p.categoria, "d": p.descripcion.strip(), "a": p.monto, "m": p.metodo, "f": p.fecha, "r": p.recurrente, "pv": (p.proveedor or "").strip() or None, "n": (p.notas or "").strip() or None})
    await db.commit()
    if r.rowcount == 0:
        raise HTTPException(status_code=404, detail="Gasto no encontrado.")
    return {"status": "success"}


@router.delete("/gastos/{gasto_id}")
async def borrar_gasto(gasto_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("DELETE FROM expense_records WHERE id = CAST(:i AS uuid)"), {"i": gasto_id})
    await db.commit()
    if r.rowcount == 0:
        raise HTTPException(status_code=404, detail="Gasto no encontrado.")
    return {"status": "success"}


@router.get("/exportar")
async def exportar(tipo: str = Query("ingresos", pattern="^(ingresos|gastos)$"), desde: Optional[date] = None, hasta: Optional[date] = None, db: AsyncSession = Depends(get_db)):
    await _asegurar(db)
    hoy = _hoy()
    desde, hasta = desde or hoy.replace(day=1), hasta or hoy
    buf = io.StringIO()
    w = csv.writer(buf)
    if tipo == "ingresos":
        w.writerow(["fecha", "hora", "origen", "cliente", "plan", "categoria", "bruto", "reembolso", "neto", "estado", "referencia"])
        for x in sorted((await _pagos(db, desde, hasta)) + (await _manuales(db, desde, hasta)), key=lambda x: (x["fecha"], x["hora"])):
            w.writerow([x["fecha"], x["hora"], x["origen"], x["cliente"], x["plan"], x["categoria"], x["bruto"], x["reembolso"], x["neto"], x["estado"], x["ref"]])
    else:
        w.writerow(["fecha", "categoria", "descripcion", "proveedor", "monto", "metodo", "recurrente", "notas"])
        for g in sorted(await _gastos(db, desde, hasta), key=lambda x: x["fecha"]):
            w.writerow([g["fecha"], g["categoria"], g["descripcion"], g["proveedor"], g["monto"], g["metodo"], "si" if g["recurrente"] else "no", g["notas"]])
    return Response(content="﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f"attachment; filename=finanzas_{tipo}_{desde}_{hasta}.csv"})
