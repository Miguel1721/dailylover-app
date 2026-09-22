import json
import re

def audit_pairs():
    with open('/home/ubuntu/dailylover/backend/batch_rich_200_pairs.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    pairs = data.get('pairs', [])
    print(f"Auditing {len(pairs)} pairs across 120 clients...\n")

    findings = {
        "recent_breakup": [],
        "sterility_vs_wants_kids": [],
        "pet_allergy_conflict": [],
        "smoking_vape_clash": [],
        "religion_radical_gap": [],
        "attachment_toxic_pairing": [],
        "distance_city_mismatch": [],
        "financial_socioeconomic_clash": [],
        "notes_discrepancy": []
    }

    for p in pairs:
        pid = p['pair_id']
        c = p['client']
        cand = p['candidate']

        c_notes = (c.get('notes') or '').lower()
        cand_notes = (cand.get('notes') or '').lower()

        c_text = f"{c_notes} {str(c.get('search_preferences', '')).lower()}"
        cand_text = f"{cand_notes} {str(cand.get('search_preferences', '')).lower()}"

        # 1. Duelo reciente / Ruptura muy fresca (< 6 meses o no superada)
        breakup_patterns = [r'lleva \d+ mes', r'hace \d+ mes', r'duelo reciente', r'tusa', r'separad[oa] hace poco', r'termin[oó] hace']
        c_fresh = any(re.search(pat, c_notes) for pat in [r'lleva [1-4] mes', r'hace [1-4] mes', r'duelo no superado', r'sigue enganchad'])
        cand_fresh = any(re.search(pat, cand_notes) for pat in [r'lleva [1-4] mes', r'hace [1-4] mes', r'duelo no superado', r'sigue enganchad'])
        if c_fresh or cand_fresh:
            findings["recent_breakup"].append({
                "pair_id": pid,
                "client": c.get('name'),
                "candidate": cand.get('name'),
                "detail": f"Cliente fresh={c_fresh}, Cand fresh={cand_fresh}"
            })

        # 2. Vasectomía / Ligadura vs Sueño de tener hijos biológicos
        c_vasect = "vasectom" in c_text or "ligadura" in c_text or "no puede tener hijos" in c_text
        cand_vasect = "vasectom" in cand_text or "ligadura" in cand_text or "no puede tener hijos" in cand_text
        c_wants_bio = "sueño de ser madre" in c_text or "quiere hijos" in c_text or "desea tener hijos" in c_text
        cand_wants_bio = "sueño de ser madre" in cand_text or "quiere hijos" in cand_text or "desea tener hijos" in cand_text
        if (c_vasect and cand_wants_bio) or (cand_vasect and c_wants_bio):
            findings["sterility_vs_wants_kids"].append({
                "pair_id": pid,
                "client": c.get('name'),
                "candidate": cand.get('name'),
                "detail": f"C_vasect={c_vasect}, Cand_wants_bio={cand_wants_bio} | Cand_vasect={cand_vasect}, C_wants_bio={c_wants_bio}"
            })

        # 3. Mascotas: Alergia / Rechazo severo vs Amante / Vive con perros
        c_dog_lover = "ama los perros" in c_text or "vive con su perro" in c_text or "perritas hacen parte" in c_text or "duerme con" in c_text
        cand_dog_lover = "ama los perros" in cand_text or "vive con su perro" in cand_text or "perritas hacen parte" in cand_text or "duerme con" in cand_text
        c_pet_allergy = "alergia a los perros" in c_text or "alergia a los gatos" in c_text or "alérgic" in c_text or "no le gustan los animales" in c_text or "no tolera mascotas" in c_text
        cand_pet_allergy = "alergia a los perros" in cand_text or "alergia a los gatos" in cand_text or "alérgic" in cand_text or "no le gustan los animales" in cand_text or "no tolera mascotas" in cand_text
        if (c_dog_lover and cand_pet_allergy) or (cand_dog_lover and c_pet_allergy):
            findings["pet_allergy_conflict"].append({
                "pair_id": pid,
                "client": c.get('name'),
                "candidate": cand.get('name'),
                "detail": f"C_dog_lover={c_dog_lover}, Cand_allergy={cand_pet_allergy} | Cand_dog_lover={cand_dog_lover}, C_allergy={c_pet_allergy}"
            })

        # 4. Fumar / Vapear vs No negociable radical
        c_smokes = "fuma" in c_text or "vapea" in c_text or "cigarrillo" in c_text
        cand_smokes = "fuma" in cand_text or "vapea" in cand_text or "cigarrillo" in cand_text
        c_no_smoke = "no fume" in c_text or "que no fume" in c_text or "cero cigarrillo" in c_text or "no tolera el humo" in c_text
        cand_no_smoke = "no fume" in cand_text or "que no fume" in cand_text or "cero cigarrillo" in cand_text or "no tolera el humo" in cand_text
        if (c_smokes and cand_no_smoke) or (cand_smokes and c_no_smoke):
            findings["smoking_vape_clash"].append({
                "pair_id": pid,
                "client": c.get('name'),
                "candidate": cand.get('name'),
                "detail": f"C_smokes={c_smokes}, Cand_no_smoke={cand_no_smoke} | Cand_smokes={cand_smokes}, C_no_smoke={c_no_smoke}"
            })

        # 5. Religión Radical vs No creyente
        c_devout = "cristiana practicante" in c_text or "cristiano practicante" in c_text or "iglesia todos los domingos" in c_text or "que comparta su fe" in c_text or "fundamental que sea cristiano" in c_text
        cand_devout = "cristiana practicante" in cand_text or "cristiano practicante" in cand_text or "iglesia todos los domingos" in cand_text or "que comparta su fe" in cand_text or "fundamental que sea cristiano" in cand_text
        c_atheist = "ateo" in c_text or "atea" in c_text or "agnóstic" in c_text or "cero religión" in c_text or "no cree en dios" in c_text
        cand_atheist = "ateo" in cand_text or "atea" in cand_text or "agnóstic" in cand_text or "cero religión" in cand_text or "no cree en dios" in cand_text
        if (c_devout and cand_atheist) or (cand_devout and c_atheist):
            findings["religion_radical_gap"].append({
                "pair_id": pid,
                "client": c.get('name'),
                "candidate": cand.get('name'),
                "detail": f"C_devout={c_devout}, Cand_atheist={cand_atheist} | Cand_devout={cand_devout}, C_atheist={c_atheist}"
            })

        # 6. Apego Ansioso vs Apego Evitativo
        c_apego = str(c.get('apego') or '').lower() + " " + c_notes
        cand_apego = str(cand.get('apego') or '').lower() + " " + cand_notes
        c_anx = "ansioso" in c_apego
        cand_anx = "ansioso" in cand_apego
        c_avoid = "evitativo" in c_apego
        cand_avoid = "evitativo" in cand_apego
        if (c_anx and cand_avoid) or (cand_anx and c_avoid):
            findings["attachment_toxic_pairing"].append({
                "pair_id": pid,
                "client": c.get('name'),
                "candidate": cand.get('name'),
                "detail": f"C_anx={c_anx}, Cand_avoid={cand_avoid} | Cand_anx={cand_anx}, C_avoid={c_avoid}"
            })

        # 7. Ciudades distintas
        c_city = (c.get('city') or '').strip().lower()
        cand_city = (cand.get('city') or '').strip().lower()
        if c_city and cand_city and c_city != cand_city and not (("bogot" in c_city and "chía" in cand_city) or ("chía" in c_city and "bogot" in cand_city) or ("medell" in c_city and "rionegro" in cand_city)):
            findings["distance_city_mismatch"].append({
                "pair_id": pid,
                "client": f"{c.get('name')} ({c.get('city')})",
                "candidate": f"{cand.get('name')} ({cand.get('city')})",
                "detail": f"{c.get('city')} vs {cand.get('city')}"
            })

    print("SUMMARY OF AUDIT DETECTIONS IN 208 PAIRS:")
    for k, v in findings.items():
        print(f"  - {k}: {len(v)} matches")

    out_file = '/home/ubuntu/dailylover/backend/audit_208_findings.json'
    with open(out_file, 'w', encoding='utf-8') as out:
        json.dump(findings, out, ensure_ascii=False, indent=2)
    print(f"\nSaved detailed findings to {out_file}")

if __name__ == '__main__':
    audit_pairs()
