import json

def inspect_details():
    with open('/home/ubuntu/dailylover/backend/batch_rich_200_pairs.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    target_pairs = ["PAIR-027-1", "PAIR-077-2", "PAIR-102-2", "PAIR-007-2", "PAIR-046-1", "PAIR-014-1", "PAIR-097-2"]

    for p in data.get('pairs', []):
        pid = p['pair_id']
        if pid in target_pairs:
            print("="*80)
            print(f"PAIR: {pid}")
            c = p['client']
            cand = p['candidate']
            print(f"CLIENT: {c.get('name')} | Age: {c.get('age')} | City: {c.get('city')} | Psyc: {c.get('psyc')}")
            print(f"  Notes snippet ({c.get('notes_len')} ch): {c.get('notes')[:350]}...")
            print(f"  Non-negotiables: {c.get('search_preferences', {}).get('non_negotiables')}")
            print(f"\nCANDIDATE: {cand.get('name')} | Age: {cand.get('age')} | City: {cand.get('city')}")
            print(f"  Notes snippet ({cand.get('notes_len')} ch): {cand.get('notes')[:350]}...")
            print(f"  Non-negotiables: {cand.get('search_preferences', {}).get('non_negotiables')}")
            print(f"\nSTRUCTURAL SCORE: {p.get('structural_score')}")

if __name__ == '__main__':
    inspect_details()
