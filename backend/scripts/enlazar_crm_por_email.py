"""Enlaza usuarios del sistema con su ficha del CRM por correo (users.crm_id y crm_profile_fields.user_id).
Uso: python enlazar_crm_por_email.py [--aplicar]
Reglas de seguridad (si falla una, NO se enlaza y queda en el reporte):
  - el usuario no tiene crm_id y el correo (sin mayusculas ni espacios) es el de UNA sola ficha del CRM, y esa ficha no la usa ningun otro usuario
  - ningun otro usuario del sistema comparte ese correo
  - el nombre del sistema y el del CRM comparten al menos una palabra (evita enlazar a familiares o correos compartidos)
"""
import asyncio, csv, re, sys, unicodedata
from collections import Counter, defaultdict

sys.path.insert(0, "/app")
from sqlalchemy import text                                   # noqa: E402
from app.database import AsyncSessionLocal                    # noqa: E402

APLICAR = "--aplicar" in sys.argv


def toks(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return {t for t in re.findall(r"[a-z]{3,}", s)}


async def main():
    async with AsyncSessionLocal() as db:
        crm = defaultdict(list)
        for r in (await db.execute(text("""SELECT f.crm_id, LOWER(TRIM(BOTH '"' FROM f.value::text)) AS email FROM crm_profile_fields f WHERE f.field_id = 'prof_180'"""))).fetchall():
            if r.email and "@" in r.email:
                crm[r.email].append(r.crm_id)
        nombres = {}
        for r in (await db.execute(text("""SELECT crm_id, MAX(CASE WHEN field_id = 'prof_188' THEN TRIM(BOTH '"' FROM value::text) END) AS n, MAX(CASE WHEN field_id = 'prof_189' THEN TRIM(BOTH '"' FROM value::text) END) AS a
            FROM crm_profile_fields WHERE field_id IN ('prof_188', 'prof_189') GROUP BY crm_id"""))).fetchall():
            nombres[r.crm_id] = f"{r.n or ''} {r.a or ''}"
        usados = {int(r[0]) for r in (await db.execute(text("SELECT crm_id FROM users WHERE crm_id ~ '^[0-9]+$'"))).fetchall()}
        usados |= {r[0] for r in (await db.execute(text("SELECT crm_id FROM crm_client_aliases"))).fetchall()}
        users = (await db.execute(text("SELECT id, name, LOWER(TRIM(email)) AS email, crm_id FROM users WHERE COALESCE(status, 'active') = 'active' AND merged_into_id IS NULL"))).fetchall()
        por_email = defaultdict(list)
        for u in users:
            if u.email:
                por_email[u.email].append(u)
        res, pares, revisar = Counter(), [], []
        for u in users:
            if (u.crm_id or "").strip().isdigit() or not u.email:
                continue
            cs = crm.get(u.email, [])
            if not cs:
                res["sin ficha en el CRM con ese correo"] += 1
                continue
            if len(set(cs)) > 1:
                res["el correo esta en varias fichas del CRM"] += 1
                revisar.append((u.id, u.name, u.email, "varias fichas CRM: " + ",".join(map(str, sorted(set(cs))))))
                continue
            if len(por_email[u.email]) > 1:
                res["otro usuario del sistema comparte el correo"] += 1
                revisar.append((u.id, u.name, u.email, "correo compartido por varios usuarios"))
                continue
            c = cs[0]
            if c in usados:
                res["la ficha ya esta enlazada a otro usuario"] += 1
                revisar.append((u.id, u.name, u.email, f"ficha {c} ya enlazada"))
                continue
            if not (toks(u.name) & toks(nombres.get(c, ""))):
                res["el nombre no coincide (se deja a revision)"] += 1
                revisar.append((u.id, u.name, u.email, f"nombre CRM: {nombres.get(c, '')}"))
                continue
            pares.append((u.id, c))
            usados.add(c)
            res["ENLAZABLE"] += 1
        print("usuarios revisados:", len(users), "| sin crm_id:", sum(1 for u in users if not (u.crm_id or '').strip().isdigit()))
        for k, v in res.most_common():
            print(f"  {k}: {v}")
        with open("/app/exports/enlaces_crm_a_revisar.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["user_id", "nombre_sistema", "correo", "motivo"])
            w.writerows(revisar)
        if not APLICAR:
            print("SIMULACION (no se cambio nada)")
            return
        for uid, c in pares:
            await db.execute(text("UPDATE users SET crm_id = :c WHERE id = :u AND (crm_id IS NULL OR crm_id !~ '^[0-9]+$')"), {"c": str(c), "u": uid})
            await db.execute(text("UPDATE crm_profile_fields SET user_id = :u WHERE crm_id = :c AND user_id IS NULL"), {"c": c, "u": uid})
        await db.commit()
        print(f"APLICADO: {len(pares)} usuarios enlazados con su ficha del CRM")


asyncio.run(main())
