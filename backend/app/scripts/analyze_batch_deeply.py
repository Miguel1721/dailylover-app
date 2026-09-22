import json
from collections import Counter

def analyze_existing():
    with open('/home/ubuntu/dailylover/backend/app/scripts/batch_eval_dataset_100.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    pairs = data.get('pairs', [])
    print(f"Total pairs in existing dataset: {len(pairs)}")

    cities = Counter(p.get('client_city') for p in pairs)
    cand_cities = Counter(p.get('candidate_city') for p in pairs)
    print("\nClient Cities:", cities)
    print("Candidate Cities:", cand_cities)

    client_notes_lens = [p.get('client_notes_length', 0) for p in pairs]
    cand_notes_lens = [p.get('candidate_notes_length', 0) for p in pairs]
    print(f"\nClient notes len: min={min(client_notes_lens)}, max={max(client_notes_lens)}, avg={sum(client_notes_lens)//len(client_notes_lens)}")
    print(f"Cand notes len: min={min(cand_notes_lens)}, max={max(cand_notes_lens)}, avg={sum(cand_notes_lens)//len(cand_notes_lens)}")
    print(f"Client notes == 0: {sum(1 for l in client_notes_lens if l == 0)}")
    print(f"Cand notes == 0: {sum(1 for l in cand_notes_lens if l == 0)}")

if __name__ == '__main__':
    analyze_existing()
