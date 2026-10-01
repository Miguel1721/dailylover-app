"""Proyección de los campos del CRM (tabla crm_profile_fields) hacia `profiles`.

1) NEW_FIELDS: campos del CRM que el sistema NO guardaba; se escriben en claves nuevas de profiles.lifestyle / search_preferences (aditivo).
2) REFRESH: campos de selección 1 a 1 con evidencia >= 95 %; el valor del CRM pasa al sistema cuando difiere (el CRM manda).
Todo cambio queda en `profile_field_changes` (valor anterior y nuevo) para poder revertir. Los datos sensibles (cédula, ingresos
numéricos) NO se proyectan: quedan solo en crm_profile_fields. Texto libre y campos mezclados NO se refrescan.
"""
import json
import os
import logging
import re
import unicodedata
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# (campo CRM) -> (tipo de destino, clave)
NEW_FIELDS = {
    "prof_195": ("lifestyle", "marital_status"),
    "prof_196": ("lifestyle", "ethnicity"),
    "prof_207": ("lifestyle", "languages"),
    "prof_205": ("lifestyle", "hair_color"),
    "prof_206": ("lifestyle", "eye_color"),
    "prof_212": ("lifestyle", "instagram"),
    "prof_231": ("lifestyle", "comfort_introverts"),
    "prof_230": ("lifestyle", "comfort_calm"),
    "prof_248": ("lifestyle", "social_group"),
    "prof_236": ("lifestyle", "preferred_date_times"),
    "prof_238": ("lifestyle", "date_budget"),
    "pref_69": ("search_preferences", "preferred_social_group"),
    "pref_103": ("search_preferences", "most_valued_choices"),
    "prof_211": ("lifestyle", "pet_allergies"),
    "pref_64": ("search_preferences", "wants_partner_to_understand"),
    "pref_63": ("search_preferences", "important_values_text"),
    "pref_52": ("search_preferences", "desired_interests"),
    "prof_229": ("lifestyle", "style_represents"),
    "prof_235": ("lifestyle", "own_physical_traits"),
    "prof_243": ("lifestyle", "personal_red_flags"),
}
REFRESH = {
    "prof_187": ("col", "photo_url"),
    "prof_192": ("col", "gender"), "prof_193": ("col", "orientation"), "prof_197": ("col", "religion"), "prof_220": ("col", "love_language"),
    "prof_201": ("lifestyle", "has_children"), "prof_202": ("lifestyle", "wants_children"), "prof_204": ("lifestyle", "body_type"),
    "prof_208": ("lifestyle", "smoker"), "prof_209": ("lifestyle", "drinks_alcohol"), "prof_210": ("lifestyle", "has_pets"),
    "prof_216": ("lifestyle", "fitness_level"), "prof_217": ("lifestyle", "fitness_preferences"), "prof_218": ("lifestyle", "energy_level"),
    "prof_224": ("lifestyle", "rumba"), "prof_225": ("lifestyle", "financial_vibe"), "prof_226": ("lifestyle", "politics"),
    "prof_228": ("lifestyle", "values"), "prof_232": ("lifestyle", "work_style"), "prof_233": ("lifestyle", "housing_status"),
    "prof_234": ("lifestyle", "sociability"), "prof_237": ("lifestyle", "preferred_plans"), "prof_239": ("lifestyle", "ideal_weekend"),
    "pref_54": ("search_preferences", "preferred_gender"), "pref_56": ("search_preferences", "preferred_energy"),
    "pref_57": ("search_preferences", "preferred_housing"), "pref_58": ("search_preferences", "preferred_work_style"),
    "pref_59": ("search_preferences", "preferred_fitness"), "pref_60": ("search_preferences", "preferred_social_level"),
    "pref_61": ("search_preferences", "preferred_physical_traits"),
}
_ready = False
# Datos de identidad / búsqueda: si CRM y sistema se CONTRADICEN, no se aplica solo: queda para revisión humana.
CRITICAL = set() if os.environ.get("CRM_PROJECTION_APPLY_CRITICAL") == "1" else {"col.gender", "search_preferences.preferred_gender", "col.orientation"}
EQUIV = {"hetero": "heterosexual", "yes": "si", "sí": "si", "no": "no", "true": "si", "false": "no"}


def _same_meaning(old: str, new: str) -> bool:
    """Mismo significado con distinto formato (hetero/Heterosexual, Yes/Sí...)."""
    a = {EQUIV.get(_norm(x), _norm(x)) for x in re.split(r"[;,]", old or "") if x.strip()}
    b = {EQUIV.get(_norm(x), _norm(x)) for x in re.split(r"[;,]", new or "") if x.strip()}
    return a == b


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()).strip()


def labels(value: Any) -> List[str]:
    """Etiquetas de un valor del CRM (selección, multi-selección o texto)."""
    out: List[str] = []
    if value is None:
        return out
    if isinstance(value, list):
        for x in value:
            out += labels(x)
    elif isinstance(value, dict):
        for k in ("choice_label", "label", "name"):
            if isinstance(value.get(k), str) and value[k].strip():
                return [value[k].strip()]
    elif isinstance(value, bool):
        out.append("Sí" if value else "No")
    elif isinstance(value, (int, float, str)):
        t = str(value).strip()
        if t:
            out.append(t)
    return out


def joined(value: Any) -> str:
    return "; ".join(labels(value))


def same_set(a: str, b: str) -> bool:
    sa = {_norm(x) for x in re.split(r"[;,]", a or "") if x.strip()}
    sb = {_norm(x) for x in re.split(r"[;,]", b or "") if x.strip()}
    return sa == sb


async def ensure_projection_tables(db: AsyncSession) -> None:
    global _ready
    if _ready:
        return
    await db.execute(text("""CREATE TABLE IF NOT EXISTS profile_field_changes (
        id SERIAL PRIMARY KEY, user_id INT NOT NULL, target TEXT NOT NULL, old_value TEXT, new_value TEXT, source TEXT, kind TEXT,
        changed_at TIMESTAMPTZ DEFAULT NOW())"""))
    await db.execute(text("CREATE INDEX IF NOT EXISTS idx_pfc_user ON profile_field_changes (user_id)"))
    await db.commit()
    _ready = True


def _current(row: Dict[str, Any], kind: str, key: str) -> str:
    if kind == "col":
        return str(row.get(key) or "")
    blob = row.get(kind) if isinstance(row.get(kind), dict) else {}
    v = blob.get(key)
    return "; ".join(str(x) for x in v) if isinstance(v, list) else ("" if v is None else str(v))


async def project_user(db: AsyncSession, user_id: int, apply: bool = True, source: str = "crm_projection",
                       only_new: bool = False, only_refresh: bool = False) -> List[Dict[str, Any]]:
    """Calcula (y si apply=True aplica) los cambios de un usuario. Usa solo el registro primario del CRM (users.crm_id)."""
    row = (await db.execute(text("""SELECT to_jsonb(p) AS p, u.crm_id FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = :u"""), {"u": user_id})).fetchone()
    if not row or not row[1]:
        return []
    prof, crm_id = dict(row[0]), str(row[1])
    fields = {r[0]: r[1] for r in (await db.execute(text("SELECT field_id, value FROM crm_profile_fields WHERE crm_id = :c"), {"c": int(crm_id)})).fetchall()}
    # ¿la ficha del CRM es de la misma persona? (el primer nombre debe aparecer en el nombre del usuario o viceversa)
    uname = (await db.execute(text("SELECT name FROM users WHERE id = :u"), {"u": user_id})).scalar() or ""
    first = _norm(joined(fields.get("prof_188"))).split(" ")[0] if fields.get("prof_188") else ""
    utoks = set(_norm(uname).split())
    if first and utoks and first not in utoks and not any(t.startswith(first[:4]) for t in utoks):
        return [{"target": "-", "old": uname[:1] + "…", "new": first[:1] + "…", "campo": "-", "tipo": "vinculo_dudoso"}]
    changes: List[Dict[str, Any]] = []
    plan: Dict[str, Dict[str, Any]] = {"lifestyle": {}, "search_preferences": {}}
    col_updates: Dict[str, str] = {}
    for table, kind_name in ((NEW_FIELDS, "nuevo"), (REFRESH, "refresco")):
        if (kind_name == "nuevo" and only_refresh) or (kind_name == "refresco" and only_new):
            continue
        for fid, (kind, key) in table.items():
            if fid not in fields:
                continue
            if fid == "prof_187":
                raw_f = fields[fid]
                if isinstance(raw_f, dict) and raw_f.get("url"):
                    new = str(raw_f["url"]).strip()
                elif isinstance(raw_f, str) and raw_f.startswith("http"):
                    new = raw_f.strip()
                else:
                    new = ""
            else:
                new = joined(fields[fid])
                if fid == "prof_212":
                    new = new.lstrip("@").strip()
            if not new:
                continue
            old = _current(prof, kind, key)
            if kind_name == "refresco" and old and same_set(old, new):
                continue
            if kind_name == "nuevo" and old and _norm(old) == _norm(new):
                continue
            target = f"{kind}.{key}"
            if kind_name == "refresco" and not old:
                kind_name_eff = "relleno"
            elif kind_name == "refresco" and _same_meaning(old, new):
                kind_name_eff = "normalizacion"
            elif kind_name == "refresco" and target in CRITICAL:
                kind_name_eff = "revision"
            else:
                kind_name_eff = kind_name
            changes.append({"target": target, "old": old, "new": new, "campo": fid, "tipo": kind_name_eff})
            if kind_name_eff in ("revision",):
                continue
            if kind == "col":
                col_updates[key] = new
            else:
                plan[kind][key] = new
    if apply and changes and not (len(changes) == 1 and changes[0]["tipo"] == "vinculo_dudoso"):
        await ensure_projection_tables(db)
        for kind in ("lifestyle", "search_preferences"):
            if plan[kind]:
                await db.execute(text(f"UPDATE profiles SET {kind} = COALESCE({kind}, CAST('{{}}' AS JSONB)) || CAST(:p AS JSONB), updated_at = NOW() WHERE user_id = :u"),
                                 {"p": json.dumps(plan[kind], ensure_ascii=False), "u": user_id})
        for col, val in col_updates.items():
            await db.execute(text(f"UPDATE profiles SET {col} = :v, updated_at = NOW() WHERE user_id = :u"), {"v": val, "u": user_id})
        for c in changes:
            await db.execute(text("""INSERT INTO profile_field_changes (user_id, target, old_value, new_value, source, kind)
                VALUES (:u, :t, :o, :n, :s, :k)"""), {"u": user_id, "t": c["target"], "o": c["old"], "n": c["new"], "s": source, "k": c["tipo"]})
    return changes


async def project_all(db: AsyncSession, apply: bool = False, only_new: bool = False, only_refresh: bool = False) -> Dict[str, Any]:
    ids = [r[0] for r in (await db.execute(text("""SELECT DISTINCT u.id FROM users u JOIN profiles p ON p.user_id = u.id
        JOIN crm_profile_fields f ON f.crm_id = cast(u.crm_id AS int) WHERE u.crm_id ~ '^[0-9]+$'"""))).fetchall()]
    by_target: Dict[str, Counter] = defaultdict(Counter)
    trans: Dict[str, Counter] = defaultdict(Counter)
    users_changed = 0
    total = 0
    for i, uid in enumerate(ids, 1):
        ch = await project_user(db, uid, apply=apply, only_new=only_new, only_refresh=only_refresh)
        if ch:
            users_changed += 1
        for c in ch:
            total += 1
            by_target[c["target"]][c["tipo"]] += 1
            if c["tipo"] == "refresco":
                trans[c["target"]][f"{c['old'][:28]} → {c['new'][:28]}"] += 1
        if apply and i % 400 == 0:
            await db.commit()
    if apply:
        await db.commit()
    return {"usuarios_evaluados": len(ids), "usuarios_con_cambios": users_changed, "cambios_totales": total,
            "por_destino": {k: dict(v) for k, v in by_target.items()}, "transiciones_refresco": {k: v.most_common(3) for k, v in trans.items()}}


async def repair_bloque_c2(db: AsyncSession, apply: bool = False, source: str = "crm_projection_repair") -> Dict[str, Any]:
    """Pasada de corrección del Bloque C.2:
    1. Quitar lifestyle.pet_type cuando sea igual a prof_211 (alergias guardadas como tipo de mascota).
    2. Actualizar search_preferences.what_searches_in_partner con pref_62 cuando hoy sea igual a pref_64 o esté vacío.
    3. Rellenar lifestyle.free_time con prof_214 cuando esté vacío.
    """
    await ensure_projection_tables(db)

    res = await db.execute(text("""
        SELECT u.id AS user_id, u.crm_id, p.lifestyle, p.search_preferences
        FROM users u
        JOIN profiles p ON p.user_id = u.id
        WHERE u.crm_id ~ '^[0-9]+$'
    """))
    users = res.fetchall()

    crm_map = defaultdict(dict)
    res_fields = await db.execute(text("""
        SELECT crm_id, field_id, value
        FROM crm_profile_fields
        WHERE field_id IN ('prof_211', 'pref_64', 'pref_62', 'prof_214')
    """))
    for cid, fid, val in res_fields.fetchall():
        crm_map[cid][fid] = val

    stats = {
        "pet_type_removals": 0,
        "what_searches_updates": 0,
        "free_time_fills": 0,
        "total_users_affected": 0,
    }

    for u in users:
        cid = int(u.crm_id)
        fields = crm_map.get(cid, {})
        ls = dict(u.lifestyle) if isinstance(u.lifestyle, dict) else {}
        sp = dict(u.search_preferences) if isinstance(u.search_preferences, dict) else {}
        user_changes = []

        # 1. Quitar lifestyle.pet_type cuando sea igual a prof_211
        cur_pet = ls.get("pet_type")
        if cur_pet and "prof_211" in fields:
            val_211 = joined(fields["prof_211"])
            if val_211 and _norm(str(cur_pet)) == _norm(val_211):
                user_changes.append({
                    "target": "lifestyle.pet_type",
                    "old": str(cur_pet),
                    "new": None,
                })
                del ls["pet_type"]
                stats["pet_type_removals"] += 1

        # 2. search_preferences.what_searches_in_partner = pref_62 cuando hoy sea igual a pref_64 o esté vacío
        if "pref_62" in fields:
            new_what = joined(fields["pref_62"])
            if new_what:
                cur_what = sp.get("what_searches_in_partner")
                val_64 = joined(fields.get("pref_64")) if "pref_64" in fields else None
                if not cur_what or (val_64 and _norm(str(cur_what)) == _norm(val_64)):
                    user_changes.append({
                        "target": "search_preferences.what_searches_in_partner",
                        "old": str(cur_what) if cur_what else None,
                        "new": new_what,
                    })
                    sp["what_searches_in_partner"] = new_what
                    stats["what_searches_updates"] += 1

        # 3. Rellenar lifestyle.free_time con prof_214 cuando esté vacío
        cur_ft = ls.get("free_time")
        if not cur_ft and "prof_214" in fields:
            val_214 = joined(fields["prof_214"])
            if val_214:
                user_changes.append({
                    "target": "lifestyle.free_time",
                    "old": None,
                    "new": val_214,
                })
                ls["free_time"] = val_214
                stats["free_time_fills"] += 1

        if user_changes:
            stats["total_users_affected"] += 1
            if apply:
                await db.execute(text("""
                    UPDATE profiles
                    SET lifestyle = CAST(:ls AS JSONB), search_preferences = CAST(:sp AS JSONB), updated_at = NOW()
                    WHERE user_id = :uid
                """), {
                    "ls": json.dumps(ls, ensure_ascii=False),
                    "sp": json.dumps(sp, ensure_ascii=False),
                    "uid": u.user_id
                })
                for ch in user_changes:
                    await db.execute(text("""
                        INSERT INTO profile_field_changes (user_id, target, old_value, new_value, source, kind)
                        VALUES (:u, :t, :o, :n, :s, 'correccion')
                    """), {
                        "u": u.user_id,
                        "t": ch["target"],
                        "o": ch["old"],
                        "n": ch["new"],
                        "s": source
                    })

    if apply:
        await db.commit()

    return stats


async def revert_all(db: AsyncSession, source: str = "crm_projection") -> Dict[str, int]:
    """Revierte TODOS los cambios aplicados por la proyección (usa profile_field_changes; ignora las 'revision', que nunca se aplicaron)."""
    await ensure_projection_tables(db)
    rows = (await db.execute(text("""SELECT id, user_id, target, old_value FROM profile_field_changes
        WHERE source = :s AND kind IN ('nuevo','relleno','normalizacion','refresco','correccion') ORDER BY id DESC"""), {"s": source})).fetchall()
    n = 0
    for _id, uid, target, old in rows:
        kind, key = target.split(".", 1)
        if kind == "col":
            await db.execute(text(f"UPDATE profiles SET {key} = :v WHERE user_id = :u"), {"v": old or None, "u": uid})
        elif old:
            await db.execute(text(f"UPDATE profiles SET {kind} = COALESCE({kind}, CAST('{{}}' AS JSONB)) || CAST(:p AS JSONB) WHERE user_id = :u"),
                             {"p": json.dumps({key: old}, ensure_ascii=False), "u": uid})
        else:
            await db.execute(text(f"UPDATE profiles SET {kind} = {kind} - :k WHERE user_id = :u"), {"k": key, "u": uid})
        n += 1
        if n % 500 == 0:
            await db.commit()
    await db.execute(text("DELETE FROM profile_field_changes WHERE source = :s AND kind IN ('nuevo','relleno','normalizacion','refresco','correccion')"), {"s": source})
    await db.commit()
    return {"cambios_revertidos": n}
