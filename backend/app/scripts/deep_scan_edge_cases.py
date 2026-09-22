import json
import re

def deep_scan():
    with open('/home/ubuntu/dailylover/backend/batch_rich_200_pairs.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    pairs = data.get('pairs', [])
    print(f"Deep scanning {len(pairs)} pairs for rare clinical edge cases...\n")

    cases = {
        "status_in_notes": [],
        "age_gap_violation": [],
        "height_mismatch": [],
        "religion_conflict": [],
        "kids_conflict_in_notes": [],
        "ex_partner_conflict": []
    }

    status_kw = ['saliendo con alguien', 'saliendo con su', 'no volver a llamar', 'no nos volvio a contestar', 'refound', 'reembolso', 'no enviar mas dates', 'ya esta de novia', 'ya esta de novio']

    for p in pairs:
        pid = p['pair_id']
        c = p['client']
        cand = p['candidate']

        c_notes = (c.get('notes') or '').lower()
        cand_notes = (cand.get('notes') or '').lower()

        # Check status flags in candidate notes header
        for kw in status_kw:
            if kw in cand_notes[:150]:
                cases["status_in_notes"].append({
                    "pair_id": pid,
                    "client": c.get('name'),
                    "candidate": cand.get('name'),
                    "kw": kw,
                    "snippet": cand_notes[:120].replace('\n', ' ')
                })
                break

        # Check age preferences vs actual candidate age
        c_sp = c.get('search_preferences') or {}
        c_min_age = c_sp.get('min_age')
        c_max_age = c_sp.get('max_age')
        cand_age = cand.get('age')
        if cand_age and isinstance(cand_age, int):
            if c_min_age and cand_age < (c_min_age - 1):
                cases["age_gap_violation"].append({
                    "pair_id": pid,
                    "client": f"{c.get('name')} (pide {c_min_age}-{c_max_age})",
                    "candidate": f"{cand.get('name')} ({cand_age} años)",
                    "gap": f"Menor por {c_min_age - cand_age} años"
                })
            elif c_max_age and cand_age > (c_max_age + 1):
                cases["age_gap_violation"].append({
                    "pair_id": pid,
                    "client": f"{c.get('name')} (pide {c_min_age}-{c_max_age})",
                    "candidate": f"{cand.get('name')} ({cand_age} años)",
                    "gap": f"Mayor por {cand_age - c_max_age} años"
                })

        # Check ex-partner conflicts (e.g. living with ex or unresolved custody)
        if "vive con su ex" in cand_notes or "vive con la ex" in cand_notes or "vive con el ex" in cand_notes:
            cases["ex_partner_conflict"].append({
                "pair_id": pid,
                "client": c.get('name'),
                "candidate": cand.get('name'),
                "detail": "Candidato vive con su ex pareja"
            })

    print("SCAN RESULTS:")
    for k, v in cases.items():
        print(f"  {k}: {len(v)} occurrences")

    if cases["status_in_notes"]:
        print("\n--- SAMPLE STATUS IN CANDIDATE NOTES ---")
        for x in cases["status_in_notes"][:5]:
            print(f"[{x['pair_id']}] Cand {x['candidate']} -> {x['kw']} (Client: {x['client']})")
            print(f"   Notes: {x['snippet']}")

    if cases["age_gap_violation"]:
        print("\n--- SAMPLE AGE GAP VIOLATIONS IN SUGGESTED ---")
        for x in cases["age_gap_violation"][:5]:
            print(f"[{x['pair_id']}] {x['client']} vs {x['candidate']} ({x['gap']})")

if __name__ == '__main__':
    deep_scan()
