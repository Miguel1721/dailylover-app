"""Concilia la FECHA DE PAGO del plan de cada cliente con todas las fuentes que existen. Solo lectura: no cambia nada.
Fuentes: Stripe (pagos de plan), CRM (fecha en que la persona se registró, que es justo después de pagar), hoja PROFILES (columna FECHA),
hoja VOLVIO A PAGAR (renovaciones), hoja 650 k (Fecha plan), y la fecha ya guardada en el sistema.
Salida: /app/exports/fechas_de_pago_conciliadas.csv
"""
import asyncio, csv, re, sys
from collections import Counter
from datetime import date, datetime

sys.path.insert(0, "/app/scripts"); sys.path.insert(0, "/app")
import sync_full_production_sheet as S                       # noqa: E402
from sqlalchemy import text                                   # noqa: E402
from app.database import AsyncSessionLocal                    # noqa: E402
from google.oauth2 import service_account                     # noqa: E402
from googleapiclient.discovery import build                   # noqa: E402

CORTE = date(2026, 5, 1)
MESES = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
         "ene": 1, "abr": 4, "ago": 8, "dic": 12}


def parse(v):
    v = str(v or "").strip()
    if not v:
        return None
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$", v)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        y = y + 2000 if y < 100 else y
        try:
            return date(y, mo, d)
        except ValueError:
            return None
    m = re.match(r"^(\d{1,2})/(\d{1,2})$", v)          # 02/10 = 2 de octubre (año en curso)
    if m:
        try:
            return date(2026, int(m.group(2)), int(m.group(1)))
        except ValueError:
            return None
    m = re.match(r"^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$", v)
    if m and m.group(2).lower() in MESES:
        return date(int(m.group(3)), MESES[m.group(2).lower()], int(m.group(1)))
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", v)
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return None


def leer(svc, sid, tab, rng):
    return svc.spreadsheets().values().get(spreadsheetId=sid, range=f"'{tab}'!{rng}").execute().get("values", [])


async def main():
    creds = service_account.Credentials.from_service_account_file(S.resolve_creds_file(), scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
    svc = build("sheets", "v4", credentials=creds, cache_discovery=False)
    sid = S.ORIGINAL_SHEET_ID
    prof = leer(svc, sid, "PROFILES", "A1:C4000")
    volvio = leer(svc, sid, "VOLVIO A PAGAR", "A1:E1000")
    mps = leer(svc, sid, "650 k", "A1:C100")
    async with AsyncSessionLocal() as db:
        users = (await db.execute(text("SELECT id, name, email, phone, client_code, crm_id FROM users"))).fetchall()
        res = S.UserCascadeResolver(users)
        base = (await db.execute(text("""
            SELECT u.id, u.name, u.crm_id, p.plan_tier, p.responsable, p.last_payment_date,
                   COALESCE((SELECT left(s.created, 10) FROM crm_client_snapshots s WHERE u.crm_id ~ '^[0-9]+$' AND s.crm_id = u.crm_id::int),
                            (SELECT left(s2.created, 10) FROM crm_profile_fields f JOIN crm_client_snapshots s2 ON s2.crm_id = f.crm_id
                              WHERE f.field_id = 'prof_180' AND u.email IS NOT NULL AND u.email <> '' AND LOWER(TRIM(BOTH '"' FROM f.value::text)) = LOWER(u.email)
                              ORDER BY s2.created LIMIT 1)) AS crm_creado,
                   (u.crm_id IS NULL OR u.crm_id !~ '^[0-9]+$') AS sin_enlace_crm
            FROM users u JOIN profiles p ON p.user_id = u.id
            WHERE p.plan_tier IS NOT NULL AND TRIM(p.plan_tier) <> '' AND LOWER(p.plan_tier) NOT IN ('sin plan', 'sin clasificar')"""))).fetchall()
        pagos = {}
        for r in (await db.execute(text("""
            SELECT COALESCE(s.user_id, u.id) AS uid, s.payment_date::date AS d, s.amount, s.plan_tier
            FROM stripe_payments s LEFT JOIN users u ON s.user_id IS NULL AND LOWER(u.email) = LOWER(s.customer_email)
            WHERE s.payment_status = 'succeeded' AND s.payment_date IS NOT NULL
              AND (s.amount IN (65000, 98000, 150000, 195000, 650000, 40000, 85000, 76000) OR s.plan_tier ~* '(65k|98k|150k|195k|40k|premium|vip|sico|ndar)')
              AND COALESCE(s.plan_tier, '') !~* '(evento|party|hot)'"""))).fetchall():
            if r.uid:
                pagos.setdefault(r.uid, []).append(r.d)
    f_hoja, f_vol, f_650 = {}, {}, {}
    for row in prof[1:]:
        if len(row) > 2:
            uid, _, _ = res.resolve(str(row[1]).strip()) if len(row) > 1 and str(row[1]).strip() else (None, None, None)
            d = parse(row[2])
            if uid and d:
                f_hoja[uid] = min(f_hoja.get(uid, d), d)           # la primera vez que se la ve en PROFILES
    for row in volvio[1:]:
        if len(row) > 3:
            uid, _, _ = res.resolve(str(row[1]).strip()) if str(row[1]).strip() else (None, None, None)
            d = parse(row[3])
            if uid and d:
                f_vol[uid] = max(f_vol.get(uid, d), d)             # la renovación más reciente
    for row in mps[1:]:
        if len(row) > 2:
            uid, _, _ = res.resolve(str(row[2]).strip()) if str(row[2]).strip() else (None, None, None)
            d = parse(row[1])
            if uid and d:
                f_650[uid] = d

    filas, cnt = [], Counter()
    for b in base:
        ps = sorted(pagos.get(b.id, []))
        d_sp, d_sf = (ps[-1] if ps else None), (ps[0] if ps else None)
        d_crm = parse(b.crm_creado)
        d_h, d_v, d_6 = f_hoja.get(b.id), f_vol.get(b.id), f_650.get(b.id)
        guardada = b.last_payment_date.date() if b.last_payment_date else None
        # prioridad: lo más directo y reciente primero
        cand = [("Stripe (último pago de plan)", d_sp), ("hoja VOLVIO A PAGAR", d_v), ("hoja 650 k", d_6), ("CRM (fecha de registro)", d_crm), ("hoja PROFILES (FECHA)", d_h)]
        if d_v and (not d_sp or d_v > d_sp):
            cand = [("hoja VOLVIO A PAGAR", d_v)] + [c for c in cand if c[0] != "hoja VOLVIO A PAGAR"]
        propuesta, fuente = next(((d, f) for f, d in cand if d), (None, ""))
        fechas = [d for _, d in cand if d]
        lados = {d < CORTE for d in fechas}
        conflicto = len(lados) > 1                                         # las fuentes se contradicen sobre el lado del 1-may
        spread = (max(fechas) - min(fechas)).days if len(fechas) > 1 else 0
        if not propuesta:
            conf = "SIN DATO"
        elif d_sp:
            conf = "ALTA (Stripe)"
        elif len([1 for _, d in cand if d]) >= 2 and spread <= 30 and not conflicto:
            conf = "ALTA (dos fuentes coinciden)"
        elif conflicto:
            conf = "BAJA (las fuentes se contradicen)"
        else:
            conf = "MEDIA (una sola fuente)"
        cnt[conf] += 1
        plan = b.plan_tier or ""
        depende = bool(re.search(r"65k|est.ndar|b.sico|40k", plan, re.I)) and not re.search(r"\(\d+\s*citas?\)|98k|plus", plan, re.I)
        filas.append({
            "user_id": b.id, "cliente": b.name, "responsable": b.responsable or "", "plan": plan, "depende_de_la_fecha": "SI" if depende else "no",
            "fecha_guardada_en_sistema": guardada or "", "fecha_stripe_ultima": d_sp or "", "fecha_stripe_primera": d_sf or "", "fecha_crm_registro": d_crm or "", "crm_enlazado_por_email": "SI" if b.sin_enlace_crm and d_crm else "",
            "fecha_hoja_profiles": d_h or "", "fecha_hoja_volvio_a_pagar": d_v or "", "fecha_hoja_650k": d_6 or "",
            "fecha_propuesta": propuesta or "", "fuente_de_la_propuesta": fuente, "confianza": conf,
            "antes_del_1_mayo": ("SI" if propuesta < CORTE else "no") if propuesta else "", "fuentes_se_contradicen_en_el_1_mayo": "SI" if conflicto else "",
            "slots_con_la_fecha_propuesta": ("" if not depende or not propuesta else (3 if propuesta < CORTE else 2)),
            "difiere_de_la_guardada": "SI" if (guardada and propuesta and abs((guardada - propuesta).days) > 7) else "",
        })
    filas.sort(key=lambda r: (r["depende_de_la_fecha"] != "SI", r["confianza"], r["cliente"]))
    with open("/app/exports/fechas_de_pago_conciliadas.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(filas[0].keys()))
        w.writeheader()
        w.writerows(filas)
    dep = [r for r in filas if r["depende_de_la_fecha"] == "SI"]
    print(f"clientes con plan: {len(filas)} | dependen de la fecha (Estándar/Básico sin número de citas): {len(dep)}")
    print("confianza (todos):", dict(cnt))
    print("confianza (los que dependen de la fecha):", dict(Counter(r['confianza'] for r in dep)))
    print("dependen de la fecha y su propuesta cae ANTES del 1-may (3 slots):", sum(1 for r in dep if r["antes_del_1_mayo"] == "SI"), "| después (2 slots):", sum(1 for r in dep if r["antes_del_1_mayo"] == "no"), "| sin dato:", sum(1 for r in dep if not r["fecha_propuesta"]))
    print("dependen y las fuentes se contradicen en el 1-may:", sum(1 for r in dep if r["fuentes_se_contradicen_en_el_1_mayo"] == "SI"))
    print("de los que ya tienen fecha guardada, difieren más de 7 días de la propuesta:", sum(1 for r in filas if r["difiere_de_la_guardada"] == "SI"), "de", sum(1 for r in filas if r["fecha_guardada_en_sistema"]))
    print("clientes cuya fecha de CRM se encontró por EMAIL (no tenían el enlace con el CRM):", sum(1 for r in filas if r["crm_enlazado_por_email"] == "SI"))
    print("fuentes usadas:", dict(Counter(r["fuente_de_la_propuesta"] for r in filas)))


asyncio.run(main())
