import json

def get_case_studies():
    with open('/home/ubuntu/dailylover/backend/batch_rich_200_pairs.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    selected = ["PAIR-076-1", "PAIR-027-1", "PAIR-007-2", "PAIR-046-1", "PAIR-102-2"]

    for p in data.get('pairs', []):
        if p['pair_id'] in selected:
            print("="*80)
            print(f"CASE STUDY: {p['pair_id']}")
            c = p['client']
            cand = p['candidate']
            print(f"CLIENT: {c['name']} (Age: {c['age']}, City: {c['city']}, Gender: {c['gender']})")
            print(f"  Notes ({len(c['notes'])} ch):\n  {c['notes'][:500]}...\n")
            print(f"CANDIDATE: {cand['name']} (Age: {cand['age']}, City: {cand['city']}, Gender: {cand['gender']})")
            print(f"  Notes ({len(cand['notes'])} ch):\n  {cand['notes'][:500]}...\n")

if __name__ == '__main__':
    get_case_studies()
