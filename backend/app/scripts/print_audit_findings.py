import json

def print_findings():
    with open('/home/ubuntu/dailylover/backend/audit_208_findings.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    for cat in ["recent_breakup", "smoking_vape_clash", "attachment_toxic_pairing", "distance_city_mismatch"]:
        items = data.get(cat, [])
        print("="*60)
        print(f"CATEGORY: {cat} ({len(items)} items)")
        print("="*60)
        for it in items[:4]:
            print(f"[{it.get('pair_id')}] Client: {it.get('client')} -> Cand: {it.get('candidate')}")
            print(f"  Detail: {it.get('detail')}")

if __name__ == '__main__':
    print_findings()
