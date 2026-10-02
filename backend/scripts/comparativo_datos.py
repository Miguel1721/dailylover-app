"""Comparativo de datos: HOJA vs SISTEMA vs CRM. Solo lectura (no escribe en la base ni en la hoja).

Salida en /app/exports/comparativo/ (CSV) y un resumen por psicologa en pantalla:
  1_clientes_hoja_vs_sistema.csv   responsable, ciudad y plan de cada cliente segun la hoja y segun el sistema
  2_clientes_sistema_vs_crm.csv    edad, genero, orientacion, estatura, religion y ciudad segun el sistema y segun el CRM
  3_matches_hoja_vs_sistema.csv    cada fila de las pestañas de las psicologas: estado y observaciones en la hoja y en el sistema
"""
import asyncio
import csv
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import date

sys.path.insert(0, "/app/scripts")
sys.path.insert(0, "/app")
import sync_full_production_sheet as S                      # noqa: E402
from sqlalchemy import text                                  # noqa: E402
from app.database import AsyncSessionLocal                   # noqa: E402
from app.services.psychologist_helper import resolve_canonical_psychologist as canon, RETIRED_TO_ACTIVE_PSYCHOLOGIST as HEREDA   # noqa: E402

OUT = "/app/exports/comparativo"
os.makedirs(OUT, exist_ok=True)


def n(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def val(v):
    if isinstance(v, dict):
        return v.get("choice_label") or v.get("label") or v.get("city") or ""
    if isinstance(v, list):
        return ", ".join(str(val(x)) for x in v)
    return "" if v is None else str(v)


def escribir(nombre, filas, cols):
    with open(os.path.join(OUT, nombre), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(filas)


def monto(plan):
    """Valor en miles de pesos que trae el nombre del plan ('65k (2 dates)' -> 65, 'Estándar 65k' -> 65)."""
    m = re.search(r"(\d{2,3})\s*k", str(plan or ""), re.I)
    return int(m.group(1)) if m else None


def psi(x):
    c = canon(x) if x else ""
    return c or "(sin psicóloga)"


async def main():
    payload = S.fetch_sheet_data(S.resolve_creds_file())
    clients, ops = payload["clients"], payload["operational_matches"]
    print(f"hoja: {len(clients)} clientes, {len(ops)} filas de matches")
    async with AsyncSessionLocal() as db:
        users = (await db.execute(text("SELECT id, name, email, phone, client_code, crm_id FROM users"))).fetchall()
        resolver = S.UserCascadeResolver(users)
        prof = {r.user_id: r for r in (await db.execute(text("SELECT user_id, responsable, city, plan_tier, age, gender, orientation, estatura, religion, last_payment_amount FROM profiles"))).fetchall()}
        urow = {u.id: u for u in users}
        crm = defaultdict(dict)
        for r in (await db.execute(text("SELECT crm_id, field_id, value FROM crm_profile_fields WHERE field_id IN ('prof_192','prof_193','prof_194','prof_247','prof_197','prof_203','prof_191')"))).fetchall():
            crm[str(r.crm_id)][r.field_id] = r.value
        oms = (await db.execute(text("SELECT id, person_a, person_b, psychologist_name, status, observations, plan_tier, city, sheet_row_index, updated_at FROM operational_matches"))).fetchall()

    # ---------- 1. hoja vs sistema (clientes)
    f1, resumen1 = [], Counter()
    for c in clients:
        uid, _, _ = resolver.resolve(c["name"], email=c.get("email") or "", client_code=c.get("client_code") or "")
        if not uid or uid not in prof:
            continue
        p = prof[uid]
        h_resp = psi(c.get("responsable"))
        s_resp = psi(p.responsable)
        h_city = S.normalize_city(c.get("city") or "") if c.get("city") else ""
        pagado = int(p.last_payment_amount / 1000) if getattr(p, "last_payment_amount", None) else None
        for campo, h, s_ in (("responsable", h_resp if c.get("responsable") else "", s_resp if p.responsable else ""),
                             ("ciudad", h_city or "", p.city or ""),
                             ("plan", c.get("plan_tier") or "", p.plan_tier or "")):
            if not h and not s_:
                continue
            nota = ""
            if campo == "responsable":
                if h and s_ and (n(h) == n(s_) or HEREDA.get(h) == s_ or HEREDA.get(s_) == h):
                    continue                                   # coincide, o es la cartera heredada (esperado)
            elif campo == "plan":
                mh, ms = monto(h), monto(s_)
                if h and s_ and mh is not None and mh == ms:
                    continue                                   # mismo valor, solo cambia como está escrito
                nota = f"último pago registrado: {pagado}k" if pagado else "sin pago registrado"
                if pagado and mh == pagado and ms != pagado:
                    nota += " (coincide con la hoja)"
                elif pagado and ms == pagado and mh != pagado:
                    nota += " (coincide con el sistema)"
                if re.fullmatch(r"\d{5}", str(s_ or "").strip()):
                    nota += " | el sistema guardó un número de fecha de Excel en vez del plan"
            elif n(h) == n(s_) or not h:
                continue                                       # ciudad: solo importa cuando la hoja trae algo distinto
            if n(h) != n(s_):
                tipo = "falta en el sistema" if h and not s_ else ("falta en la hoja" if s_ and not h else "distinto")
                if tipo == "falta en la hoja" and campo != "plan":
                    continue
                psico = h_resp if c.get("responsable") else s_resp
                f1.append({"psicologa": psico, "cliente": c["name"], "user_id": uid, "campo": campo, "hoja": h, "sistema": s_, "tipo": tipo, "nota": nota})
                resumen1[(psico, campo, tipo)] += 1
    escribir("1_clientes_hoja_vs_sistema.csv", sorted(f1, key=lambda r: (r["psicologa"], r["campo"], r["cliente"])), ["psicologa", "cliente", "user_id", "campo", "hoja", "sistema", "tipo", "nota"])

    # ---------- 2. sistema vs CRM
    f2, resumen2, hoy = [], Counter(), date.today()
    for uid, p in prof.items():
        u = urow.get(uid)
        if not u or not u.crm_id or str(u.crm_id) not in crm:
            continue
        k = crm[str(u.crm_id)]
        edad_crm = ""
        b = k.get("prof_194")
        if isinstance(b, str) and re.match(r"\d{4}-\d{2}-\d{2}", b):
            y, m, d = map(int, b[:10].split("-"))
            edad_crm = str(hoy.year - y - ((hoy.month, hoy.day) < (m, d)))
        elif k.get("prof_247") not in (None, ""):
            edad_crm = str(val(k.get("prof_247")))
        est_crm = ""
        try:
            e = float(val(k.get("prof_203")))
            est_crm = str(int(round(e / 10 if e > 300 else e)))
        except Exception:
            pass
        mm_ = re.search(r"\d+(?:[.,]\d+)?", p.estatura or "")
        est_sis = str(int(round(float(mm_.group(0).replace(",", "."))))) if mm_ else ""
        pares = [
            ("edad", str(p.age or ""), edad_crm, lambda a, b_: a and b_ and abs(int(a) - int(b_)) > 1),
            ("género", p.gender or "", val(k.get("prof_192")), lambda a, b_: a and b_ and n(a) != n(b_)),
            ("orientación", p.orientation or "", val(k.get("prof_193")), lambda a, b_: a and b_ and n(a) != n(b_)),
            ("estatura (cm)", est_sis, est_crm, lambda a, b_: a and b_ and abs(int(a) - int(b_)) > 2),
            ("religión", p.religion or "", val(k.get("prof_197")), lambda a, b_: a and b_ and n(a) != n(b_)),
            ("ciudad", p.city or "", val(k.get("prof_191")), lambda a, b_: a and b_ and n(a) not in n(b_) and n(b_) not in n(a)),
        ]
        for campo, s_, c_, distinto in pares:
            if distinto(s_, c_):
                tipo = "distinto"
            elif c_ and not s_:
                tipo = "falta en el sistema"
            else:
                continue
            psico = psi(p.responsable)
            nota = ""
            if campo == "edad" and tipo == "distinto" and abs(int(s_) - int(c_)) > 3:
                nota = "diferencia grande: posible vínculo equivocado con el CRM"
            elif campo == "género" or (campo == "orientación" and tipo == "distinto"):
                nota = "revisar a quién corresponde el perfil"
            elif campo == "ciudad":
                nota = "puede ser un municipio cercano (Chía, Cota, Envigado...): revisar solo si no lo es"
            f2.append({"psicologa": psico, "cliente": u.name, "user_id": uid, "crm_id": u.crm_id, "campo": campo, "sistema": s_, "crm": c_, "tipo": tipo, "nota": nota})
            resumen2[(psico, campo, tipo)] += 1
    escribir("2_clientes_sistema_vs_crm.csv", sorted(f2, key=lambda r: (r["psicologa"], r["campo"], r["cliente"])), ["psicologa", "cliente", "user_id", "crm_id", "campo", "sistema", "crm", "tipo", "nota"])

    # ---------- 3. matches hoja vs sistema
    AVANCE = {("APROBADO", "CITA PROGRAMADA"), ("APROBADO", "CITA REALIZADA"), ("APROBADO", "HECHO POR MAPE"), ("APROBADO", "CITA COMPLETADA"),
              ("NOT APPROVED", "HECHO POR MAPE"), ("LISTO PARA MATCH", "CITA REALIZADA"), ("LISTO PARA MATCH", "CITA PROGRAMADA"), ("HECHO POR MAPE", "CITA REALIZADA"),
              ("TROUBLE", "CITA PROGRAMADA"), ("TROUBLE", "CITA REALIZADA"), ("REVISAR", "CITA PROGRAMADA"), ("REVISAR", "CITA REALIZADA")}
    pares_hoja = defaultdict(set)
    for o in ops:
        pares_hoja[(n(o["person_a"]), n(o["person_b"]))].add(psi(o["psychologist_name"]))
    key = {}
    for m in oms:
        key.setdefault((n(m.person_a), n(m.person_b), (m.psychologist_name or "").strip().upper()), m)
    f3, resumen3, vistos = [], Counter(), set()
    for o in ops:
        k = (n(o["person_a"]), n(o["person_b"]), o["psychologist_name"].strip().upper())
        m = key.get(k)
        vistos.add(k)
        if not m:
            f3.append({"psicologa": psi(o["psychologist_name"]), "pestaña": o["tab"], "fila_hoja": o["row"], "persona_a": o["person_a"], "persona_b": o["person_b"], "estado_hoja": o["status"], "estado_sistema": "", "obs_hoja": o["observations"][:200], "obs_sistema": "", "tipo": "solo en la hoja"})
            resumen3[(psi(o["psychologist_name"]), "solo en la hoja")] += 1
            continue
        if n(o["status"]) != n(m.status):
            esperado = ((o["status"] or "").strip().upper(), (m.status or "").strip().upper()) in AVANCE
            tipo = "el sistema avanzó (esperado)" if esperado else "estado distinto: REVISAR"
            f3.append({"psicologa": psi(o["psychologist_name"]), "pestaña": o["tab"], "fila_hoja": o["row"], "persona_a": o["person_a"], "persona_b": o["person_b"], "estado_hoja": o["status"], "estado_sistema": m.status, "obs_hoja": o["observations"][:200], "obs_sistema": (m.observations or "")[:200], "tipo": tipo, "id_sistema": m.id})
            resumen3[(psi(o["psychologist_name"]), tipo)] += 1
        elif o["observations"] and n(o["observations"]) != n(m.observations) and n(o["observations"]) not in n(m.observations):
            f3.append({"psicologa": psi(o["psychologist_name"]), "pestaña": o["tab"], "fila_hoja": o["row"], "persona_a": o["person_a"], "persona_b": o["person_b"], "estado_hoja": o["status"], "estado_sistema": m.status, "obs_hoja": o["observations"][:200], "obs_sistema": (m.observations or "")[:200], "tipo": "observaciones distintas", "id_sistema": m.id})
            resumen3[(psi(o["psychologist_name"]), "observaciones distintas")] += 1
    en_sistema_sin_hoja = [m for m in oms if m.sheet_row_index is not None and (n(m.person_a), n(m.person_b), (m.psychologist_name or "").strip().upper()) not in vistos]
    for m in en_sistema_sin_hoja:
        otras = pares_hoja.get((n(m.person_a), n(m.person_b)), set()) - {psi(m.psychologist_name)}
        tipo = f"la fila pasó a otra psicóloga en la hoja ({', '.join(sorted(otras))})" if otras else "ya no está en la hoja (borrada o cambió de nombre)"
        f3.append({"psicologa": psi(m.psychologist_name), "pestaña": "", "fila_hoja": m.sheet_row_index, "persona_a": m.person_a, "persona_b": m.person_b, "estado_hoja": "", "estado_sistema": m.status, "obs_hoja": "", "obs_sistema": (m.observations or "")[:200], "tipo": tipo, "id_sistema": m.id})
        resumen3[(psi(m.psychologist_name), "pasó a otra psicóloga" if otras else "ya no está en la hoja")] += 1
    escribir("3_matches_hoja_vs_sistema.csv", sorted(f3, key=lambda r: (r["psicologa"], r["tipo"], r["persona_a"])), ["psicologa", "pestaña", "fila_hoja", "persona_a", "persona_b", "estado_hoja", "estado_sistema", "obs_hoja", "obs_sistema", "tipo", "id_sistema"])

    # ---------- resumen
    print("\n=== 1. Clientes HOJA vs SISTEMA (por psicóloga, campo y tipo)")
    por = defaultdict(Counter)
    for (p, c, t), v in resumen1.items():
        por[p][f"{c}/{t}"] += v
    for p, c in sorted(por.items(), key=lambda x: -sum(x[1].values())):
        print(f"  {p:18s} total {sum(c.values()):4d} | " + ", ".join(f"{k} {v}" for k, v in c.most_common(5)))
    print("\n=== 2. Clientes SISTEMA vs CRM")
    por = defaultdict(Counter)
    for (p, c, t), v in resumen2.items():
        por[p][f"{c}/{t}"] += v
    for p, c in sorted(por.items(), key=lambda x: -sum(x[1].values())):
        print(f"  {p:18s} total {sum(c.values()):4d} | " + ", ".join(f"{k} {v}" for k, v in c.most_common(5)))
    print("\n=== 3. Matches HOJA vs SISTEMA")
    por = defaultdict(Counter)
    for (p, t), v in resumen3.items():
        por[p][t] += v
    for p, c in sorted(por.items(), key=lambda x: -sum(x[1].values())):
        print(f"  {p:18s} total {sum(c.values()):4d} | " + ", ".join(f"{k} {v}" for k, v in c.most_common(5)))
    tot3 = Counter()
    for (p, t), v in resumen3.items():
        tot3[t] += v
    print("  TOTAL:", dict(tot3), "| filas en hoja:", len(ops), "| filas del sistema vinculadas a la hoja:", sum(1 for m in oms if m.sheet_row_index is not None))
    c2 = Counter()
    for r in f3:
        if r["tipo"] == "estado distinto: REVISAR":
            c2[(r["estado_hoja"], r["estado_sistema"])] += 1
    print("  cambios de estado más comunes (hoja -> sistema):", c2.most_common(10))


asyncio.run(main())
