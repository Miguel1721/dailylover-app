import asyncio
import json
import os
import re
import unicodedata
import difflib
from datetime import datetime, date
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.routers.matchmaking import normalize_city, synthesize_structured_bio_notes
from app.services.clinical_profile_extractor import infer_gender_from_name_and_bio, infer_city_from_text

def unaccent(s):
    if not s:
        return ""
    t = unicodedata.normalize('NFD', str(s))
    return ''.join(c for c in t if unicodedata.category(c) != 'Mn').lower().strip()

def norm_name(s):
    s = unaccent(s)
    s = re.sub(r'[^a-z0-9\s]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def norm_phone(p):
    if not p:
        return ""
    s = str(p).strip()
    if s.startswith("GEN_") or s.startswith("+57300000"):
        return ""
    digits = re.sub(r'\D', '', s)
    if digits.startswith("57") and len(digits) == 12:
        digits = digits[2:]
    return digits if len(digits) >= 7 else ""

def is_event_payment(plan_tier, description):
    comb = f"{plan_tier or ''} {description or ''}".lower()
    event_keywords = [
        'evento', 'hot & single', 'hot and single', 'singles party', 'party',
        'speed dating', 'padel', 'rooftop', 'running', 'cata', 'dinner',
        'taller', 'workshop', 'experiencia grupal', 'ticket', 'boleta', 'entrada'
    ]
    return any(k in comb for k in event_keywords)

ACTIVE_OM_STATUSES = {
    'LISTO PARA MATCH', 'PENDIENTE', 'URGENTE', 'EN ESPERA',
    'REVISAR', 'REVISAR POR SI TOCA OTRO MATCH', 'TROUBLE', 'TROUBLEMAKER',
    'CITA PROGRAMADA', 'CITA RESERVADA', 'AGENDADA', 'CONFIRMADA',
    'AGENDANDO', 'POR CONFIRMAR', 'REPROGRAMAR', 'REQUEST PROFILE UPDATE'
}

def names_are_compatible(name_a, name_b):
    nn_a = norm_name(name_a)
    nn_b = norm_name(name_b)
    if not nn_a or not nn_b:
        return False
    if nn_a == nn_b:
        return True
    toks_a = [t for t in nn_a.split() if len(t) >= 3]
    toks_b = [t for t in nn_b.split() if len(t) >= 3]
    if set(toks_a) & set(toks_b):
        return True
    # Prefix nickname match (e.g. 'leo' in 'leonardo', 'caro' in 'carolina')
    for ta in toks_a:
        for tb in toks_b:
            if (len(ta) >= 3 and tb.startswith(ta)) or (len(tb) >= 3 and ta.startswith(tb)):
                return True
    if difflib.SequenceMatcher(None, nn_a, nn_b).ratio() >= 0.65:
        return True
    return False

def classify_twin_match(u_no_prof, prof_by_crm, prof_by_email, prof_by_name, prof_by_phone, prof_by_em_local, prof_by_first_tok, prof_by_last_tok):
    cid = str(u_no_prof['crm_id'] or '').strip()
    em = str(u_no_prof['email'] or '').strip().lower()
    nn = norm_name(u_no_prof['name'])
    ph = norm_phone(u_no_prof['phone'])
    email_collision = None

    # 1. Exact CRM ID
    if cid and cid in prof_by_crm:
        pu = prof_by_crm[cid]
        return "NIVEL_1_CRM_EXACTO", f"Mismo crm_id ({cid})", pu, None

    # 2. Exact Email (must check name compatibility to avoid +57300000 shifted-email collisions!)
    if em and '@' in em and em in prof_by_email:
        pu = prof_by_email[em]
        p_nn = pu['_nn']
        if nn == p_nn:
            return "NIVEL_1_EMAIL_Y_NOMBRE_EXACTO", f"Mismo email exacto ({em}) y mismo nombre ({u_no_prof['name']})", pu, None
        elif names_are_compatible(u_no_prof['name'], pu['name']):
            return "NIVEL_1B_EMAIL_EXACTO_Y_NOMBRE_COMPATIBLE", f"Mismo email exacto ({em}) y nombre compatible (A='{u_no_prof['name']}' <-> B='{pu['name']}')", pu, None
        elif str(u_no_prof['phone'] or '').startswith('+57300000') or str(pu['phone'] or '').startswith('+57300000'):
            email_collision = {
                "collision_type": "COLISION_EMAIL_DESFASADO_IMPORT_HISTORICO_NO_FUSIONAR",
                "reason": f"Email '{em}' desfasado en fila histórica +57300000: A='{u_no_prof['name']}' (Tel: {u_no_prof['phone']}) vs B='{pu['name']}' (UID={pu['id']}, CRM={pu['crm_id']}). Personas distintas — PROHIBIDO FUSIONAR POR EMAIL.",
                "other_user": pu,
            }
        else:
            return (
                "NIVEL_2_EMAIL_EXACTO_TARJETAHABIENTE_O_TERCERO_REVISAR",
                f"Mismo email exacto ({em}), pero nombre distinto en Stripe/CRM (A='{u_no_prof['name']}' vs B='{pu['name']}') — posible tarjetahabiente, razón social o pareja",
                pu,
                None,
            )

    # 3. Exact Real Phone
    if ph and ph in prof_by_phone:
        pu = prof_by_phone[ph][0]
        if names_are_compatible(u_no_prof['name'], pu['name']):
            return "NIVEL_1_TELEFONO_REAL_EXACTO", f"Mismo teléfono real ({u_no_prof['phone']} == {pu['phone']}) y nombre compatible", pu, email_collision

    # 4. Exact Normalized Name
    if nn and nn in prof_by_name:
        pu = prof_by_name[nn][0]
        p_em = str(pu['email'] or '').strip().lower()
        toks = nn.split()
        if em and p_em and em != p_em and not email_collision:
            em_loc = em.split('@')[0]
            p_loc = p_em.split('@')[0] if '@' in p_em else ''
            if em_loc == p_loc:
                return "NIVEL_2_NOMBRE_EXACTO_Y_PREFIJO_EMAIL", f"Nombre exacto ('{u_no_prof['name']}') y mismo usuario de correo ({em_loc}@...)", pu, email_collision
            elif len(toks) >= 3:
                return "NIVEL_3_NOMBRE_COMPLETO_3_TOKENS_DISTINTO_EMAIL", f"Nombre completo de {len(toks)} palabras idéntico ('{u_no_prof['name']}'), pero emails distintos ({em} vs {p_em})", pu, email_collision
            else:
                return "NIVEL_4_HOMONIMO_O_EMAIL_DISTINTO_REVISAR", f"Nombre de 2 palabras igual ('{u_no_prof['name']}') pero emails distintos ({em} vs {p_em}) — posible homónimo o segundo correo", pu, email_collision
        else:
            note_col = f" (Nota: email en A '{em}' está corrido/colisionado con otra persona)" if email_collision else ""
            return "NIVEL_3_NOMBRE_EXACTO_SIN_CONFLICTO_EMAIL", f"Nombre normalizado idéntico ('{u_no_prof['name']}'){note_col}", pu, email_collision

    # 5. Email prefix match (typo in domain like @gmail.con / @hotnail.com) — require compatible name
    em_local = em.split('@')[0] if '@' in em else ''
    if em_local and len(em_local) >= 6 and em_local in prof_by_em_local and not email_collision:
        for pu in prof_by_em_local[em_local]:
            if names_are_compatible(u_no_prof['name'], pu['name']):
                return "NIVEL_2_TYPO_DOMINIO_EMAIL", f"Mismo prefijo de email ({em} vs {pu['email']}) y nombre compatible '{u_no_prof['name']}' vs '{pu['name']}'", pu, email_collision

    # 6. Fuzzy name / token subset
    toks = [t for t in nn.split() if len(t) >= 3]
    if not toks:
        return None, None, None, email_collision

    candidates = []
    seen_ids = set()
    for pu in prof_by_first_tok.get(toks[0], []) + prof_by_last_tok.get(toks[-1], []):
        if pu['id'] not in seen_ids:
            seen_ids.add(pu['id'])
            candidates.append(pu)

    s1 = set(toks)
    for pu in candidates:
        p_nn = pu['_nn']
        p_toks = pu['_toks']
        if len(toks) >= 2 and len(p_toks) >= 2 and toks[0] == p_toks[0]:
            s2 = pu['_tok_set']
            if len(s1) >= 2 and len(s2) >= 2 and (s1.issubset(s2) or s2.issubset(s1)):
                return "NIVEL_4_SUBCONJUNTO_NOMBRE_DIFUSO", f"Tokens de nombre contenidos ('{u_no_prof['name']}' <-> '{pu['name']}'), emails: {em or 'vacío'} vs {pu['email'] or 'vacío'}", pu, email_collision
        if len(nn) >= 10 and len(p_nn) >= 10:
            ratio = difflib.SequenceMatcher(None, nn, p_nn).ratio()
            if ratio >= 0.90:
                return "NIVEL_4_SIMILITUD_NOMBRE_DIFUSO", f"Similitud ortográfica {ratio:.0%} ('{u_no_prof['name']}' <-> '{pu['name']}'), emails: {em or 'vacío'} vs {pu['email'] or 'vacío'}", pu, email_collision

    return None, None, None, email_collision


async def main():
    async with AsyncSessionLocal() as db:
        # 1. Load all 2,685 users without profile
        r_no_prof = await db.execute(text("""
            SELECT u.id, u.crm_id, u.name, u.email, u.phone, u.client_code, u.created_at
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.merged_into_id IS NULL AND p.user_id IS NULL
            ORDER BY u.id ASC
        """))
        no_prof_users = [dict(r._mapping) for r in r_no_prof.fetchall()]

        # 2. Load all 5,420 users with profile
        r_with_prof = await db.execute(text("""
            SELECT u.id, u.crm_id, u.name, u.email, u.phone, u.client_code, u.created_at,
                   p.gender, p.age, p.city, p.plan_tier, p.bio_notes, p.responsable,
                   p.occupation, p.education, p.estatura
            FROM users u
            JOIN profiles p ON p.user_id = u.id
            WHERE u.merged_into_id IS NULL
            ORDER BY u.id ASC
        """))
        with_prof_users = [dict(r._mapping) for r in r_with_prof.fetchall()]

        prof_by_crm = {str(u['crm_id']).strip(): u for u in with_prof_users if u['crm_id']}
        prof_by_email = {str(u['email']).strip().lower(): u for u in with_prof_users if u['email'] and '@' in str(u['email'])}
        prof_by_name = {}
        prof_by_phone = {}
        prof_by_em_local = {}
        prof_by_first_tok = {}
        prof_by_last_tok = {}
        for u in with_prof_users:
            nn = norm_name(u['name'])
            toks = [t for t in nn.split() if len(t) >= 3]
            u['_nn'] = nn
            u['_toks'] = toks
            u['_tok_set'] = set(toks)
            if nn:
                prof_by_name.setdefault(nn, []).append(u)
            if toks:
                prof_by_first_tok.setdefault(toks[0], []).append(u)
                prof_by_last_tok.setdefault(toks[-1], []).append(u)
            ph = norm_phone(u['phone'])
            if ph:
                prof_by_phone.setdefault(ph, []).append(u)
            em = str(u['email'] or '').strip().lower()
            if '@' in em:
                loc = em.split('@')[0]
                if len(loc) >= 6:
                    prof_by_em_local.setdefault(loc, []).append(u)

        np_by_uid = {u['id']: u for u in no_prof_users}
        np_by_cid = {str(u['crm_id']).strip(): u for u in no_prof_users if u['crm_id'] and str(u['crm_id']).strip()}
        np_by_email = {}
        np_by_name = {}
        for u in no_prof_users:
            em = str(u['email'] or '').strip().lower()
            if em and '@' in em:
                np_by_email.setdefault(em, []).append(u)
            nn = norm_name(u['name'])
            if nn:
                np_by_name.setdefault(nn, []).append(u)

        # 3. Load stripe_payments
        r_sp = await db.execute(text("""
            SELECT id, user_id, customer_name, customer_email, customer_phone,
                   amount, currency, description, plan_tier, payment_status, payment_date
            FROM stripe_payments
            WHERE payment_status = 'succeeded'
            ORDER BY payment_date DESC
        """))
        all_sp = [dict(r._mapping) for r in r_sp.fetchall()]
        sp_by_uid = {}
        sp_match_how = {}
        for sp in all_sp:
            if sp['user_id'] in np_by_uid:
                u_fk = np_by_uid[sp['user_id']]
                if not names_are_compatible(u_fk['name'], sp['customer_name']) and str(u_fk['phone'] or '').startswith('+57300000'):
                    sp_match_how.setdefault(u_fk['id'], set()).add("FK_ERRONEA_POR_EMAIL_CORRIDO")
                else:
                    sp_match_how.setdefault(u_fk['id'], set()).add("FK_DIRECTA")
                sp_by_uid.setdefault(sp['user_id'], []).append(sp)
            else:
                em = str(sp['customer_email'] or '').strip().lower()
                nn = norm_name(sp['customer_name'])
                if em and em in np_by_email:
                    for u in np_by_email[em]:
                        if names_are_compatible(u['name'], sp['customer_name']) or not str(u['phone'] or '').startswith('+57300000'):
                            sp_by_uid.setdefault(u['id'], []).append(sp)
                            sp_match_how.setdefault(u['id'], set()).add("EMAIL_STRIPE")
                elif nn and len(nn) > 5 and nn in np_by_name:
                    for u in np_by_name[nn]:
                        sp_by_uid.setdefault(u['id'], []).append(sp)
                        sp_match_how.setdefault(u['id'], set()).add("NOMBRE_STRIPE")

        # 4. Load operational_matches + scheduled_dates
        r_om = await db.execute(text("""
            SELECT om.id, om.person_a, om.person_b, om.user_id_a, om.user_id_b,
                   om.person_a_crm_id, om.person_b_crm_id, om.status, om.plan_tier,
                   om.city, om.pref, om.psychologist_name, om.observations,
                   om.created_at, om.updated_at,
                   sd.date_time, sd.had_date, sd.venue
            FROM operational_matches om
            LEFT JOIN scheduled_dates sd ON sd.match_id = om.id
        """))
        all_om = [dict(r._mapping) for r in r_om.fetchall()]
        om_by_uid = {}
        om_fk_by_uid = {}
        for m in all_om:
            for side, uid_col, cid_col, name_col in [
                ('A', 'user_id_a', 'person_a_crm_id', 'person_a'),
                ('B', 'user_id_b', 'person_b_crm_id', 'person_b')
            ]:
                if m[uid_col] in np_by_uid:
                    uid = m[uid_col]
                    om_by_uid.setdefault(uid, []).append((side, m, "FK_DIRECTA"))
                    om_fk_by_uid.setdefault(uid, []).append((side, m))
                elif m[cid_col] and str(m[cid_col]).strip() in np_by_cid:
                    uid = np_by_cid[str(m[cid_col]).strip()]['id']
                    om_by_uid.setdefault(uid, []).append((side, m, "CRM_ID"))
                else:
                    nn = norm_name(m[name_col])
                    if nn and nn in np_by_name:
                        for u in np_by_name[nn]:
                            om_by_uid.setdefault(u['id'], []).append((side, m, "NOMBRE"))

        # 5. Load priority_client_tracking + client_notes + historical_matches for extra enrichment
        r_pct = await db.execute(text("SELECT * FROM priority_client_tracking"))
        pct_by_uid = {}
        pct_by_name = {}
        for r in r_pct.fetchall():
            d = dict(r._mapping)
            if d.get('user_id'):
                pct_by_uid[d['user_id']] = d
            nn = norm_name(d.get('client_name'))
            if nn:
                pct_by_name[nn] = d

        r_cn = await db.execute(text("SELECT * FROM client_notes"))
        cn_by_uid = {}
        for r in r_cn.fetchall():
            d = dict(r._mapping)
            txt = str(d.get('note') or d.get('content') or d.get('text') or '').strip()
            if d.get('user_id') and txt:
                cn_by_uid.setdefault(d['user_id'], []).append(txt)

        # 6. Load smartmatch_canonical_3933.json
        with open('/tmp/smartmatch_canonical_3933.json', 'r', encoding='utf-8') as f:
            canon_list = json.load(f)
        canon_by_cid = {}
        canon_by_email = {}
        canon_by_name = {}
        for c in canon_list:
            if c.get('crm_id') is not None:
                canon_by_cid[str(c['crm_id']).strip()] = c
            if c.get('email') and '@' in str(c['email']):
                canon_by_email[str(c['email']).strip().lower()] = c
            if c.get('name'):
                canon_by_name[norm_name(c['name'])] = c

        def find_canonical_record(u):
            cid = str(u['crm_id'] or '').strip()
            if cid:
                return canon_by_cid.get(cid)
            em = str(u['email'] or '').strip().lower()
            nn = norm_name(u['name'])
            if em and em in canon_by_email:
                c_em = canon_by_email[em]
                if names_are_compatible(u['name'], c_em.get('name', '')) or not str(u['phone'] or '').startswith('+57300000'):
                    return c_em
            if nn and nn in canon_by_name:
                return canon_by_name[nn]
            return None

        # 6b. Load webhook_events_raw for extra fields (neighborhood, income_range, partner_red_flags, min_age, max_age)
        r_wh = await db.execute(text("""
            SELECT COALESCE(payload->'payload'->>'id', payload->>'id', payload->'payload'->>'client_id', payload->>'client_id') AS cid,
                   payload
            FROM webhook_events_raw
            ORDER BY id ASC
        """))
        wh_by_cid = {}
        for cid_val, pl in r_wh.fetchall():
            if not cid_val:
                continue
            cid_s = str(cid_val).strip()
            outer = pl if isinstance(pl, dict) else {}
            p = outer.get("payload") if isinstance(outer.get("payload"), dict) else outer
            merged = wh_by_cid.setdefault(cid_s, {})
            for k, v in p.items():
                if v is None or v == "" or v == []:
                    continue
                if isinstance(v, dict):
                    non_empty = [val for val in v.values() if val is not None and val != "" and val != []]
                    if not non_empty:
                        continue
                    if isinstance(merged.get(k), dict):
                        mc = dict(merged[k])
                        for sk, sv in v.items():
                            if sv is not None and sv != "" and sv != []:
                                mc[sk] = sv
                        merged[k] = mc
                        continue
                merged[k] = v

        def _choice_str(val) -> str:
            if isinstance(val, dict):
                return str(val.get("choice_label") or val.get("name") or val.get("label") or "").strip()
            if isinstance(val, list):
                return ", ".join(s for s in (_choice_str(x) for x in val) if s)
            return str(val or "").strip()

        def _choice_list(val) -> list:
            if isinstance(val, list):
                return [s for s in (_choice_str(x) for x in val) if s]
            s = _choice_str(val)
            return [s] if s else []

        # 7. Classify all 2,685 users
        for u in no_prof_users:
            lvl, reason, twin, email_col = classify_twin_match(
                u, prof_by_crm, prof_by_email, prof_by_name, prof_by_phone,
                prof_by_em_local, prof_by_first_tok, prof_by_last_tok
            )
            u['twin_level'] = lvl
            u['twin_reason'] = reason
            u['twin'] = twin
            u['email_collision'] = email_col
            em = str(u['email'] or '').strip().lower()
            nn = norm_name(u['name'])
            cid = str(u['crm_id'] or '').strip()
            u['has_exact_twin'] = bool(
                (cid and cid in prof_by_crm)
                or (em and '@' in em and em in prof_by_email and (names_are_compatible(u['name'], prof_by_email[em]['name']) or not str(u['phone'] or '').startswith('+57300000')))
                or (nn and nn in prof_by_name)
            )

        # =========================================================================
        # BUILD FASE 2 DRY-RUN AUDIT (575 with crm_id + unique without crm_id in canon + unique Stripe payers)
        # =========================================================================
        def build_proposed_profile(u):
            uid = u['id']
            cid = str(u['crm_id'] or '').strip()
            nn = norm_name(u['name'])

            c_rec = find_canonical_record(u)
            eff_cid = cid or (str(c_rec.get('crm_id')).strip() if c_rec and c_rec.get('crm_id') else '')
            wh_m = wh_by_cid.get(eff_cid, {}) if eff_cid else {}

            splist = [
                p for p in sp_by_uid.get(uid, [])
                if "FK_ERRONEA_POR_EMAIL_CORRIDO" not in sp_match_how.get(uid, set())
                or names_are_compatible(u['name'], p['customer_name'])
            ]
            mmlist = [p for p in splist if not is_event_payment(p['plan_tier'], p['description'])]
            omlist = om_by_uid.get(uid, [])
            pct = pct_by_uid.get(uid) or pct_by_name.get(nn)
            notes_list = cn_by_uid.get(uid, [])

            # City & Neighborhood
            city_raw = (c_rec.get('city') if c_rec else None) or ''
            neighborhood = ''
            if isinstance(wh_m.get('prof_191'), dict):
                if not city_raw:
                    city_raw = str(wh_m['prof_191'].get('city') or wh_m['prof_191'].get('state') or '').strip()
                neighborhood = str(wh_m['prof_191'].get('street') or '').strip()
            if not city_raw:
                for _, m, _ in omlist:
                    if m.get('city'):
                        city_raw = m['city']
                        break
            if not city_raw and pct and pct.get('city'):
                city_raw = pct['city']
            city = normalize_city(city_raw) if city_raw else ''

            # Gender
            gender = (c_rec.get('gender') if c_rec else None) or ''
            if not gender:
                inferred_g = infer_gender_from_name_and_bio(u['name'], '')
                if inferred_g in ('Hombre', 'Mujer'):
                    gender = inferred_g

            # Age & Birth Date
            age = c_rec.get('age') if c_rec else None
            birth_date = c_rec.get('birth_date') if c_rec else None
            if birth_date and not age:
                try:
                    b_parts = [int(x) for x in str(birth_date)[:10].split('-')]
                    today = date.today()
                    age = today.year - b_parts[0] - ((today.month, today.day) < (b_parts[1], b_parts[2]))
                except Exception:
                    pass

            estatura = (c_rec.get('estatura') if c_rec else None) or ''
            occupation = (c_rec.get('occupation') if c_rec else None) or ''
            education = (c_rec.get('education') if c_rec else None) or ''
            religion = (c_rec.get('religion') if c_rec else None) or ''
            love_language = (c_rec.get('love_language') if c_rec else None) or ''
            orientation = (c_rec.get('orientation') if c_rec else None) or ''
            apego_raw = (c_rec.get('apego_style') if c_rec else None) or ''
            apego = {"estilo": apego_raw} if apego_raw else {}

            lifestyle = dict(c_rec.get('lifestyle') or {}) if c_rec else {}
            inc_wh = _choice_str(wh_m.get('prof_289')) or _choice_str(wh_m.get('prof_285'))
            if inc_wh and not lifestyle.get('income_range'):
                lifestyle['income_range'] = inc_wh

            search_preferences = dict(c_rec.get('search_preferences') or {}) if c_rec else {}
            prf_wh = _choice_list(wh_m.get('pref_67'))
            if prf_wh and not search_preferences.get('partner_red_flags'):
                search_preferences['partner_red_flags'] = prf_wh
            if isinstance(wh_m.get('pref_68'), dict):
                p68 = wh_m['pref_68']
                if p68.get('start') and not search_preferences.get('min_age'):
                    try:
                        search_preferences['min_age'] = int(p68['start'])
                    except Exception:
                        pass
                if p68.get('end') and not search_preferences.get('max_age'):
                    try:
                        search_preferences['max_age'] = int(p68['end'])
                    except Exception:
                        pass

            # Plan tier & responsable
            plan_tier = ''
            if mmlist:
                plan_tier = mmlist[0].get('plan_tier') or ''
            if not plan_tier:
                for s, m, _ in omlist:
                    if s == 'A' and m.get('plan_tier'):
                        plan_tier = m['plan_tier']
                        break
            if not plan_tier and pct and (pct.get('plan_tier') or pct.get('plan_type')):
                plan_tier = pct.get('plan_tier') or pct.get('plan_type')

            responsable = ''
            for s, m, _ in omlist:
                if s == 'A' and m.get('psychologist_name'):
                    responsable = m['psychologist_name']
                    break
            if not responsable and pct and (pct.get('psychologist') or pct.get('psychologist_name') or pct.get('responsible')):
                responsable = pct.get('psychologist') or pct.get('psychologist_name') or pct.get('responsible')

            # Bio notes: CRM bio_essay + operational/client notes + structured synthesis if <= 40 chars
            bio_parts = []
            if c_rec and c_rec.get('bio_essay'):
                bio_parts.append(str(c_rec['bio_essay']).strip())
            for nt in notes_list:
                if nt not in bio_parts:
                    bio_parts.append(nt)
            for s, m, _ in omlist:
                if s == 'A' and m.get('observations') and str(m['observations']).strip():
                    obs = str(m['observations']).strip()
                    if obs not in bio_parts:
                        bio_parts.append(obs)
            raw_bio = " | ".join(bio_parts).strip()

            temp_prof = {
                "bio_notes": raw_bio,
                "age": age,
                "city": city,
                "estatura": estatura,
                "occupation": occupation,
                "education": education,
                "love_language": love_language,
                "lifestyle": lifestyle,
                "search_preferences": search_preferences,
            }
            final_bio = synthesize_structured_bio_notes(temp_prof)

            return {
                "in_canonical_json": bool(c_rec),
                "canonical_crm_id": str(c_rec.get('crm_id')) if c_rec and c_rec.get('crm_id') else None,
                "gender": gender or None,
                "age": age,
                "birth_date": birth_date,
                "city": city or None,
                "neighborhood": neighborhood or None,
                "estatura": estatura or None,
                "occupation": occupation or None,
                "education": education or None,
                "religion": religion or None,
                "love_language": love_language or None,
                "orientation": orientation or None,
                "apego": apego if apego else None,
                "plan_tier": plan_tier or None,
                "responsable": responsable or None,
                "bio_notes": final_bio or None,
                "bio_notes_source": "CRM/Notas" if len(raw_bio) > 40 else ("Síntesis estructurada" if final_bio else None),
                "lifestyle": lifestyle if lifestyle else None,
                "search_preferences": search_preferences if search_preferences else None,
            }

        # Collect the unique Stripe Matchmaking Plan payers + the 575 with crm_id + the unique without crm_id in canon
        unique_stripe_ids = set()
        unique_stripe_records = []
        for u in no_prof_users:
            if u['twin'] is None:
                splist = [
                    p for p in sp_by_uid.get(u['id'], [])
                    if "FK_ERRONEA_POR_EMAIL_CORRIDO" not in sp_match_how.get(u['id'], set())
                    or names_are_compatible(u['name'], p['customer_name'])
                ]
                mmlist = [p for p in splist if not is_event_payment(p['plan_tier'], p['description'])]
                if mmlist:
                    unique_stripe_ids.add(u['id'])
                    unique_stripe_records.append((u, mmlist))
        unique_stripe_records.sort(key=lambda x: max(p['payment_date'] for p in x[1]), reverse=True)

        fase2_records = []
        seen_fase2_uids = set()

        # First: all unique Stripe Matchmaking Plan payers without a twin in profiles
        for u, mmlist in unique_stripe_records:
            seen_fase2_uids.add(u['id'])
            prop = build_proposed_profile(u)
            lp = mmlist[0]
            oml = om_by_uid.get(u['id'], [])
            fase2_records.append({
                "section": "1_STRIPE_UNICOS",
                "user_id": u['id'],
                "crm_id": u['crm_id'],
                "name": u['name'],
                "email": u['email'],
                "phone": u['phone'],
                "twin_status": "UNICO_SIN_PERFIL",
                "stripe_summary": f"{lp['payment_date'].strftime('%Y-%m-%d')}: ${lp['amount']:,.0f} ({lp['plan_tier']})",
                "om_summary": [f"{s}:{m['status']}" for s, m, _ in oml],
                "before_profile": None,
                "after_profile": prop,
            })

        # Second: all remaining of the 575 with crm_id + unique without crm_id (not exact twins) that match smartmatch_canonical_3933.json
        for u in no_prof_users:
            if u['id'] in seen_fase2_uids:
                continue
            cid = str(u['crm_id'] or '').strip()
            if cid:
                c_rec = find_canonical_record(u)
            elif not u['has_exact_twin']:
                c_rec = find_canonical_record(u)
            else:
                continue
            if not cid and not c_rec:
                continue
            seen_fase2_uids.add(u['id'])
            prop = build_proposed_profile(u)
            splist = [
                p for p in sp_by_uid.get(u['id'], [])
                if "FK_ERRONEA_POR_EMAIL_CORRIDO" not in sp_match_how.get(u['id'], set())
                or names_are_compatible(u['name'], p['customer_name'])
            ]
            mmlist = [p for p in splist if not is_event_payment(p['plan_tier'], p['description'])]
            lp_str = f"{mmlist[0]['payment_date'].strftime('%Y-%m-%d')}: ${mmlist[0]['amount']:,.0f} ({mmlist[0]['plan_tier']})" if mmlist else ""
            oml = om_by_uid.get(u['id'], [])
            twin = u['twin']
            twin_status = f"GEMELO_DE_UID={twin['id']} ({u['twin_level']})" if twin else "UNICO_SIN_PERFIL"
            fase2_records.append({
                "section": "2_CANONICAL_575_MAS_SIN_CRM",
                "user_id": u['id'],
                "crm_id": u['crm_id'],
                "name": u['name'],
                "email": u['email'],
                "phone": u['phone'],
                "twin_status": twin_status,
                "stripe_summary": lp_str,
                "om_summary": [f"{s}:{m['status']}" for s, m, _ in oml],
                "before_profile": None,
                "after_profile": prop,
            })

        # Write Fase 2 JSON and Markdown
        ts_now = datetime.utcnow().isoformat() + "Z"
        cnt_with_crm = sum(1 for r in fase2_records if r["crm_id"])
        cnt_no_crm_canon = sum(1 for r in fase2_records if not r["crm_id"] and r["after_profile"]["in_canonical_json"])
        cnt_no_crm_stripe = sum(1 for r in fase2_records if not r["crm_id"] and not r["after_profile"]["in_canonical_json"])
        fase2_json_obj = {
            "generated_at_utc": ts_now,
            "mode": "DRY_RUN_ADDITIVE_INSERT_PROFILES",
            "total_records": len(fase2_records),
            "stripe_unique_count": len(unique_stripe_records),
            "with_crm_id_count": cnt_with_crm,
            "without_crm_id_in_canonical_count": cnt_no_crm_canon,
            "without_crm_id_stripe_only_count": cnt_no_crm_stripe,
            "records": fase2_records,
        }
        with open('/tmp/fase2_profiles_insert_audit_before_after.json', 'w', encoding='utf-8') as f:
            json.dump(fase2_json_obj, f, ensure_ascii=False, indent=2, default=str)

        md2_lines = [
            "# Respaldo de Auditoría Pre-INSERT (Fase 2): Perfiles Nuevos (`Antes → Después`)",
            "",
            f"- **Fecha de generación (UTC, dry-run sin escrituras en BD):** `{ts_now}`",
            f"- **Total de usuarios auditados en este respaldo:** `{len(fase2_records)}` (`{cnt_with_crm + cnt_no_crm_canon}` en `smartmatch_canonical_3933.json` + `{cnt_no_crm_stripe}` pagadores únicos de Stripe fuera del export)",
            f"  - **{len(unique_stripe_records)}** pagadores únicos de Plan de Matchmaking en Stripe sin fila en `profiles` y sin gemelo en `profiles`.",
            f"  - **{cnt_with_crm}** usuarios con `crm_id` sin fila en `profiles` (`100%` presentes en `smartmatch_canonical_3933.json`).",
            f"  - **{cnt_no_crm_canon}** usuarios únicos sin `crm_id` que hacen match verificado (email+nombre compatible o nombre exacto) contra `smartmatch_canonical_3933.json`.",
            "- **Protección anti-colisión aplicada:** Al cruzar usuarios sin `crm_id` por email contra `smartmatch_canonical_3933.json` o `stripe_payments`, se exige compatibilidad de nombre para descartar filas históricas `+57300000` con emails corridos de otra persona.",
            "- **Regla aplicada:** `INSERT INTO profiles` 100% aditivo (creación de fila en `profiles` donde hoy `p.user_id IS NULL`, sin tocar filas existentes ni escribir `merged_into_id`).",
            "",
            "---",
            "",
            f"## 1. Los {len(unique_stripe_records)} Pagadores Únicos de Plan de Matchmaking en Stripe sin `profiles` (`Antes → Después`)",
            "",
            "| # | `user_id` | `crm_id` | Nombre / Email / Teléfono | Pago Stripe / Estado OM | `Antes` (`profiles`) | `Después` (Campos a insertar en `profiles`) |",
            "|---|---|---|---|---|---|---|",
        ]

        def fmt_after(prop):
            items = []
            for k in ["gender", "age", "birth_date", "city", "neighborhood", "estatura", "occupation", "education", "religion", "love_language", "orientation", "plan_tier", "responsable"]:
                if prop.get(k) is not None and prop.get(k) != "":
                    items.append(f"**`{k}`**: `{json.dumps(prop[k], ensure_ascii=False)}`")
            if prop.get("apego"):
                items.append(f"**`apego`**: `{json.dumps(prop['apego'], ensure_ascii=False)}`")
            if prop.get("lifestyle"):
                items.append(f"**`lifestyle`**: `{json.dumps(prop['lifestyle'], ensure_ascii=False)}`")
            if prop.get("search_preferences"):
                items.append(f"**`search_preferences`**: `{json.dumps(prop['search_preferences'], ensure_ascii=False)}`")
            if prop.get("bio_notes"):
                b_short = prop["bio_notes"] if len(prop["bio_notes"]) <= 180 else prop["bio_notes"][:177] + "..."
                items.append(f"**`bio_notes`** ({prop.get('bio_notes_source')}): `{json.dumps(b_short, ensure_ascii=False)}`")
            if prop.get("canonical_crm_id"):
                items.append(f"**`canonical_crm_id`**: `{prop['canonical_crm_id']}`")
            return "<br>".join(items) if items else "*Sin campos adicionales*"

        idx_s1 = 0
        for r in fase2_records:
            if r["section"] != "1_STRIPE_UNICOS":
                continue
            idx_s1 += 1
            ident = f"**{r['name']}**<br>`{r['email'] or '—'}`<br>`{r['phone'] or '—'}`"
            pay_om = f"**Stripe:** {r['stripe_summary']}<br>**OM:** `{r['om_summary']}`"
            md2_lines.append(
                f"| {idx_s1} | `{r['user_id']}` | `{r['crm_id'] or 'None'}` | {ident} | {pay_om} | `SIN FILA (NULL)` | {fmt_after(r['after_profile'])} |"
            )

        md2_lines.extend([
            "",
            "---",
            "",
            f"## 2. Listado Completo ({len(fase2_records)} usuarios: {cnt_with_crm} con `crm_id` + {cnt_no_crm_canon} sin `crm_id` en export canónico + {cnt_no_crm_stripe} pagadores Stripe) (`Antes → Después`)",
            "",
            "| # | `user_id` | `crm_id` | Nombre / Email / Teléfono | Clasificación / Actividad | `Antes` (`profiles`) | `Después` (Campos a insertar en `profiles`) |",
            "|---|---|---|---|---|---|---|",
        ])

        for idx_all, r in enumerate(fase2_records, 1):
            ident = f"**{r['name']}**<br>`{r['email'] or '—'}`<br>`{r['phone'] or '—'}`"
            act_bits = [f"`{r['twin_status']}`"]
            if r['stripe_summary']:
                act_bits.append(f"Stripe: {r['stripe_summary']}")
            if r['om_summary']:
                act_bits.append(f"OM: `{r['om_summary']}`")
            act_str = "<br>".join(act_bits)
            md2_lines.append(
                f"| {idx_all} | `{r['user_id']}` | `{r['crm_id'] or 'None'}` | {ident} | {act_str} | `SIN FILA (NULL)` | {fmt_after(r['after_profile'])} |"
            )

        with open('/tmp/fase2_profiles_insert_audit_before_after.md', 'w', encoding='utf-8') as f:
            f.write("\n".join(md2_lines) + "\n")

        # =========================================================================
        # BUILD FASE 1 CASE-BY-CASE DUPLICATE IDENTITY AUDIT REPORT (READ-ONLY)
        # =========================================================================
        fase1_cases = []
        collision_cases = []

        for u in no_prof_users:
            uid = u['id']
            splist = sp_by_uid.get(uid, [])
            omlist = om_by_uid.get(uid, [])
            om_fk_list = om_fk_by_uid.get(uid, [])
            has_cid = bool(u['crm_id'])
            has_active_om = any(str(m['status'] or '').strip().upper() in ACTIVE_OM_STATUSES for _, m, _ in omlist)
            mmlist = [p for p in splist if not is_event_payment(p['plan_tier'], p['description'])]
            sp_how = sorted(list(sp_match_how.get(uid, set())))

            # Record shifted-email collisions between different people
            if u['email_collision']:
                col_info = u['email_collision']
                pu = col_info['other_user']
                collision_cases.append({
                    "collision_type": col_info['collision_type'],
                    "reason": col_info['reason'],
                    "has_erroneous_stripe_fk": "FK_ERRONEA_POR_EMAIL_CORRIDO" in sp_how,
                    "has_om_direct_fk": bool(om_fk_list),
                    "side_a_no_profile": {
                        "user_id": u['id'],
                        "crm_id": u['crm_id'],
                        "name": u['name'],
                        "email": u['email'],
                        "phone": u['phone'],
                    },
                    "side_b_email_owner_with_profile": {
                        "user_id": pu['id'],
                        "crm_id": pu['crm_id'],
                        "name": pu['name'],
                        "email": pu['email'],
                        "phone": pu['phone'],
                        "city": pu['city'],
                        "age": pu['age'],
                        "plan_tier": pu['plan_tier'],
                    },
                    "actual_twin_by_name_if_any": {
                        "user_id": u['twin']['id'],
                        "crm_id": u['twin']['crm_id'],
                        "name": u['twin']['name'],
                        "email": u['twin']['email'],
                        "level": u['twin_level'],
                    } if u['twin'] else None,
                    "stripe_payments_linked": [
                        {
                            "id": p['id'],
                            "user_id_fk": p['user_id'],
                            "customer_name": p['customer_name'],
                            "date": p['payment_date'].strftime('%Y-%m-%d'),
                            "amount": float(p['amount']),
                            "plan_tier": p['plan_tier'],
                        }
                        for p in splist
                    ],
                    "operational_matches": [
                        {
                            "match_id": m['id'],
                            "side": side,
                            "linked_via": how,
                            "status": m['status'],
                        }
                        for side, m, how in omlist
                    ],
                })

            twin = u['twin']
            if not twin:
                continue
            if not (splist or omlist or has_cid):
                continue

            fase1_cases.append({
                "confidence_level": u['twin_level'],
                "why_same_person": u['twin_reason'],
                "safe_to_auto_merge": u['twin_level'] in (
                    "NIVEL_1_CRM_EXACTO",
                    "NIVEL_1_EMAIL_Y_NOMBRE_EXACTO",
                    "NIVEL_1B_EMAIL_EXACTO_Y_NOMBRE_COMPATIBLE",
                    "NIVEL_1_TELEFONO_REAL_EXACTO",
                    "NIVEL_2_NOMBRE_EXACTO_Y_PREFIJO_EMAIL",
                    "NIVEL_2_TYPO_DOMINIO_EMAIL",
                    "NIVEL_3_NOMBRE_EXACTO_SIN_CONFLICTO_EMAIL",
                ),
                "has_stripe_payment": bool(splist),
                "has_matchmaking_plan_payment": bool(mmlist),
                "has_stripe_direct_fk": "FK_DIRECTA" in sp_how,
                "has_active_om": has_active_om,
                "has_om_direct_fk": bool(om_fk_list),
                "has_crm_id_on_duplicate": has_cid,
                "side_a_duplicate_no_profile": {
                    "user_id": u['id'],
                    "crm_id": u['crm_id'],
                    "name": u['name'],
                    "email": u['email'],
                    "phone": u['phone'],
                    "created_at": str(u['created_at'])[:19] if u['created_at'] else None,
                },
                "side_b_target_with_profile": {
                    "user_id": twin['id'],
                    "crm_id": twin['crm_id'],
                    "name": twin['name'],
                    "email": twin['email'],
                    "phone": twin['phone'],
                    "created_at": str(twin['created_at'])[:19] if twin['created_at'] else None,
                    "city": twin['city'],
                    "age": twin['age'],
                    "plan_tier": twin['plan_tier'],
                },
                "stripe_payments": [
                    {
                        "id": p['id'],
                        "user_id_fk": p['user_id'],
                        "date": p['payment_date'].strftime('%Y-%m-%d'),
                        "amount": float(p['amount']),
                        "plan_tier": p['plan_tier'],
                        "is_event": is_event_payment(p['plan_tier'], p['description']),
                    }
                    for p in splist
                ],
                "operational_matches": [
                    {
                        "match_id": m['id'],
                        "side": side,
                        "linked_via": how,
                        "user_id_a": m['user_id_a'],
                        "user_id_b": m['user_id_b'],
                        "status": m['status'],
                        "is_active": str(m['status'] or '').strip().upper() in ACTIVE_OM_STATUSES,
                    }
                    for side, m, how in omlist
                ],
            })

        # Sort Fase 1 cases: first direct Stripe FK or MM payment + active OM, then confidence level
        fase1_cases.sort(key=lambda c: (
            not c['has_stripe_direct_fk'],
            not c['has_matchmaking_plan_payment'],
            not c['has_active_om'],
            not c['has_om_direct_fk'],
            c['confidence_level'],
            c['side_a_duplicate_no_profile']['user_id']
        ))

        collision_cases.sort(key=lambda c: (
            not c['has_erroneous_stripe_fk'],
            not c['has_om_direct_fk'],
            c['side_a_no_profile']['user_id']
        ))

        with open('/tmp/fase1_twins_merge_case_by_case_audit.json', 'w', encoding='utf-8') as f:
            json.dump({
                "generated_at_utc": ts_now,
                "total_twin_cases": len(fase1_cases),
                "total_shifted_email_collisions_blocked": len(collision_cases),
                "cases": fase1_cases,
                "blocked_email_collisions": collision_cases,
            }, f, ensure_ascii=False, indent=2, default=str)

        # Build Markdown for Fase 1
        by_lvl = {}
        for c in fase1_cases:
            by_lvl[c['confidence_level']] = by_lvl.get(c['confidence_level'], 0) + 1

        md1_lines = [
            "# Reporte Caso por Caso Pre-Fusión de Identidades (Fase 1 — Solo Lectura, `0` fusiones ejecutadas)",
            "",
            f"- **Fecha de generación (UTC):** `{ts_now}`",
            f"- **Total de pares \"gemelos\" con pagos en Stripe, matches en `operational_matches` o `crm_id` (Tabla 1):** `{len(fase1_cases)}`",
            f"  - Con pago de **Plan de Matchmaking en Stripe**: `{sum(1 for c in fase1_cases if c['has_matchmaking_plan_payment'])}` (`{sum(1 for c in fase1_cases if c['has_stripe_direct_fk'])}` con FK `stripe_payments.user_id` apuntando directo al duplicado sin perfil)",
            f"  - Con pago de **Evento en Stripe**: `{sum(1 for c in fase1_cases if c['has_stripe_payment'] and not c['has_matchmaking_plan_payment'])}`",
            f"  - Con match **activo/en espera en `operational_matches`**: `{sum(1 for c in fase1_cases if c['has_active_om'])}`",
            f"  - Con FK `operational_matches.user_id_a/b` apuntando directo al duplicado sin perfil: `{sum(1 for c in fase1_cases if c['has_om_direct_fk'])}`",
            f"  - Con `crm_id` en el duplicado sin perfil (`twin_575`): `{sum(1 for c in fase1_cases if c['has_crm_id_on_duplicate'])}`",
            f"- **HALLAZGO CRÍTICO DE INTEGRIDAD (Tabla 2):** Se detectaron y bloquearon **`{len(collision_cases)}` colisiones de email entre personas distintas** (principalmente filas históricas con teléfono sintético `+57300000...` donde la columna `email` quedó corrida/desfasada en una importación antigua, asignándole el correo de la Persona B a la Persona A). **Ninguna de estas `{len(collision_cases)}` colisiones debe fusionarse por email.**",
            "",
            "### Desglose por Nivel de Evidencia / Certeza (Tabla 1)",
            "",
            "| Nivel de Evidencia | Cantidad | ¿Seguro para fusión automática tras aprobación? |",
            "|---|---:|---|",
        ]
        for k in sorted(by_lvl.keys()):
            safe_str = "SÍ (Identificador único o correo + nombre compatible)" if not k.startswith("NIVEL_4") and "DISTINTO_EMAIL" not in k and "REVISAR" not in k else "NO — Requiere validación manual caso por caso (posible segundo correo, tarjetahabiente u homónimo)"
            md1_lines.append(f"| `{k}` | `{by_lvl[k]}` | {safe_str} |")

        md1_lines.extend([
            "",
            "---",
            "",
            "## 1. Detalle Caso por Caso de Gemelos (`Lado A: Duplicado sin profiles` → `Lado B: Usuario con profiles`)",
            "",
            "| # | Lado A (Duplicado SIN `profiles`: `UID` / `CRM` / Nombre / Email / Teléfono) | Lado B (Destino CON `profiles`: `UID` / `CRM` / Nombre / Email / Teléfono / Ciudad / Edad) | Pagos Stripe / Matches `operational_matches` | Nivel de Certeza y Razón Exacta |",
            "|---|---|---|---|---|",
        ])

        for idx, c in enumerate(fase1_cases, 1):
            sa = c['side_a_duplicate_no_profile']
            sb = c['side_b_target_with_profile']
            sa_str = f"**UID `{sa['user_id']}`** (CRM: `{sa['crm_id'] or 'None'}`)<br>**{sa['name']}**<br>Email: `{sa['email'] or '—'}`<br>Tel: `{sa['phone'] or '—'}`"
            sb_str = f"**UID `{sb['user_id']}`** (CRM: `{sb['crm_id'] or 'None'}`)<br>**{sb['name']}**<br>Email: `{sb['email'] or '—'}`<br>Tel: `{sb['phone'] or '—'}`<br>Perfil: `{sb['city'] or '—'}`, `{sb['age'] or '—'}` años, `{sb['plan_tier'] or '—'}`"

            sp_OM_bits = []
            if c['stripe_payments']:
                sp_items = [f"`${p['amount']:,.0f}` ({p['plan_tier']}, {p['date']}, FK=`{p['user_id_fk']}`)" for p in c['stripe_payments'][:2]]
                sp_OM_bits.append("Stripe: " + "; ".join(sp_items))
            if c['operational_matches']:
                om_items = [f"`#{m['match_id']}`({m['side']}:{m['status']}, via={m['linked_via']})" for m in c['operational_matches'][:3]]
                if len(c['operational_matches']) > 3:
                    om_items.append(f"+{len(c['operational_matches'])-3} más")
                sp_OM_bits.append("OM: " + ", ".join(om_items))
            sp_om_str = "<br>".join(sp_OM_bits) if sp_OM_bits else "Solo CRM ID duplicado"

            why_str = f"**`{c['confidence_level']}`**<br>{c['why_same_person']}"
            md1_lines.append(f"| {idx} | {sa_str} | {sb_str} | {sp_om_str} | {why_str} |")

        md1_lines.extend([
            "",
            "---",
            "",
            f"## 2. Alerta de Integridad: `{len(collision_cases)}` Colisiones de Email entre Personas Distintas (`PROHIBIDO FUSIONAR POR EMAIL`)",
            "",
            "> **Diagnóstico:** En una importación histórica de usuarios con teléfono sintético `+57300000...` (`UID` ~5390 a ~7700), la columna `email` quedó desfasada entre filas, asignándole el correo de un cliente real (`Lado B`) a otra persona distinta (`Lado A`). También incluye casos puntuales donde un cliente pagó un evento usando el correo de su pareja/amigo. **Estos pares NO son la misma persona y están bloqueados para fusión por email.**",
            "",
            "| # | Lado A (Fila SIN `profiles` con email corrido/prestado) | Lado B (Dueño real del email CON `profiles`) | Gemelo real de Lado A por Nombre (si existe) | Vínculos Stripe / OM en Lado A | Diagnóstico |",
            "|---|---|---|---|---|---|",
        ])

        for idx_col, col in enumerate(collision_cases, 1):
            sa = col['side_a_no_profile']
            sb = col['side_b_email_owner_with_profile']
            tw = col['actual_twin_by_name_if_any']
            sa_str = f"**UID `{sa['user_id']}`** (CRM: `{sa['crm_id'] or 'None'}`)<br>**{sa['name']}**<br>Email en fila: `{sa['email']}`<br>Tel: `{sa['phone']}`"
            sb_str = f"**UID `{sb['user_id']}`** (CRM: `{sb['crm_id'] or 'None'}`)<br>**{sb['name']}**<br>Email: `{sb['email']}`<br>Tel: `{sb['phone']}`"
            tw_str = f"**UID `{tw['user_id']}`** (CRM: `{tw['crm_id'] or 'None'}`)<br>**{tw['name']}**<br>Email: `{tw['email'] or '—'}`<br>(`{tw['level']}`)" if tw else "*Sin gemelo en `profiles`*"

            links_bits = []
            if col['stripe_payments_linked']:
                for p in col['stripe_payments_linked'][:2]:
                    links_bits.append(f"⚠️ Stripe FK=`{p['user_id_fk']}` (Pagador real: `{p['customer_name']}`, `${p['amount']:,.0f}`)")
            if col['operational_matches']:
                om_s = ", ".join(f"`#{m['match_id']}`({m['side']}:{m['status']}, {m['linked_via']})" for m in col['operational_matches'][:3])
                links_bits.append(f"OM: {om_s}")
            links_str = "<br>".join(links_bits) if links_bits else "—"

            md1_lines.append(f"| {idx_col} | {sa_str} | {sb_str} | {tw_str} | {links_str} | {col['reason']} |")

        with open('/tmp/fase1_twins_merge_case_by_case_audit.md', 'w', encoding='utf-8') as f:
            f.write("\n".join(md1_lines) + "\n")

        print(f"SUCCESS: Fase 2 records={len(fase2_records)}, Fase 1 twin cases={len(fase1_cases)}, Blocked email collisions={len(collision_cases)}")
        print("Fase 1 levels:", by_lvl)

if __name__ == '__main__':
    asyncio.run(main())
