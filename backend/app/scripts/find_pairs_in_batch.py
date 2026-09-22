import json

def find_pairs():
    with open('/home/ubuntu/dailylover/backend/app/scripts/batch_eval_dataset_100.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Total pairs in batch: {len(data.get('pairs', []))}")
    for p in data.get('pairs', []):
        c_name = p.get('client_name', '')
        cand_name = p.get('candidate_name', '')
        if any(k in c_name for k in ['Manuela', 'Katerine', 'Andres Felipe', 'Mariana', 'Felipe']):
            print(f"[{p.get('pair_id')}] Client: {c_name} -> Cand: {cand_name}")
            print(f"  Client notes len: {len(p.get('client_notes',''))} | Cand notes len: {len(p.get('candidate_notes',''))}")

if __name__ == '__main__':
    find_pairs()
