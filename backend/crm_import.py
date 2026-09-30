"""Carga completa (SOLO LECTURA del CRM) a una tabla de respaldo. No modifica profiles/users."""
import os, json, base64, time, asyncio, urllib.request, urllib.error
from sqlalchemy import text
from app.database import AsyncSessionLocal as SL

tok = os.environ["SMARTMATCHAPP_API_TOKEN"]; base = os.environ.get("SMARTMATCHAPP_API_BASE_URL", "https://dailylover.smartmatchapp.com/api3").rstrip("/")
auth = "Basic " + base64.b64encode(f"{tok}:".encode()).decode()
LOG = "/tmp/crm_import.log"

def log(m):
    with open(LOG, "a") as f: f.write(f"{time.strftime('%H:%M:%S')} {m}\n")

def get(path, tries=4):
    for i in range(tries):
        req = urllib.request.Request(base + path, headers={"Authorization": auth, "Accept": "application/json", "User-Agent": "DailyLover/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.status, json.loads(r.read().decode("utf-8", "ignore") or "null")
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503, 504): time.sleep(2 * (i + 1)); continue
            return e.code, None
        except Exception:
            time.sleep(1.5)
    return "ERR", None

async def main():
    async with SL() as db:
        await db.execute(text("""CREATE TABLE IF NOT EXISTS crm_client_snapshots (
            crm_id INT PRIMARY KEY, stype TEXT, is_archived BOOLEAN, is_submitted BOOLEAN, created TEXT,
            profile JSONB, preferences JSONB, fetched_at TIMESTAMPTZ DEFAULT NOW())"""))
        await db.commit()
    # 1) todos los ids
    ids, offset = [], 0
    while True:
        st, b = await asyncio.to_thread(get, f"/clients/?limit=100&offset={offset}")
        if st != 200 or not b or not b.get("objects"): break
        ids += [o["id"] for o in b["objects"]]
        offset += len(b["objects"])
        if offset >= b["total_count"]: break
    ids = list(dict.fromkeys(ids))
    log(f"ids obtenidos: {len(ids)}")
    async with SL() as db:
        have = {r[0] for r in (await db.execute(text("SELECT crm_id FROM crm_client_snapshots"))).fetchall()}
    ids = [i for i in ids if i not in have]
    log(f"pendientes (ya guardados: {len(have)}): {len(ids)}")
    sem = asyncio.Semaphore(3); done = 0; errs = 0

    async def work(cid):
        nonlocal done, errs
        async with sem:
            s1, base_d = await asyncio.to_thread(get, f"/clients/{cid}/")
            s2, prof = await asyncio.to_thread(get, f"/clients/{cid}/profile/")
            s3, pref = await asyncio.to_thread(get, f"/clients/{cid}/preferences/")
        if s1 != 200:
            errs += 1
            if s1 in (401, 403) and errs in (1, 25): log(f"ERROR de autenticación {s1} (errores {errs}); revisar el token")
            return
        async with SL() as db:
            await db.execute(text("""INSERT INTO crm_client_snapshots (crm_id, stype, is_archived, is_submitted, created, profile, preferences)
                VALUES (:i, :st, :a, :s, :c, CAST(:p AS JSONB), CAST(:q AS JSONB))
                ON CONFLICT (crm_id) DO UPDATE SET stype=EXCLUDED.stype, is_archived=EXCLUDED.is_archived, is_submitted=EXCLUDED.is_submitted,
                  created=EXCLUDED.created, profile=EXCLUDED.profile, preferences=EXCLUDED.preferences, fetched_at=NOW()"""),
                {"i": cid, "st": (base_d.get("stype") or {}).get("name"), "a": bool(base_d.get("is_archived")), "s": bool(base_d.get("is_submitted")),
                 "c": base_d.get("created"), "p": json.dumps(prof if s2 == 200 else None), "q": json.dumps(pref if s3 == 200 else None)})
            await db.commit()
        done += 1
        if done % 100 == 0: log(f"progreso: {done}/{len(ids)} (errores {errs})")

    await asyncio.gather(*(work(c) for c in ids))
    log(f"TERMINADO: {done} guardados, {errs} errores")

asyncio.run(main())
