import json

def inspect_daniella():
    with open('/home/ubuntu/dailylover/backend/batch_rich_200_pairs.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    for p in data.get('pairs', []):
        if p['pair_id'] == 'PAIR-027-1':
            c = p['client']
            cand = p['candidate']
            print("CLIENT DANIELLA:")
            print("  gender:", c.get('gender'))
            print("  preferred_gender:", c.get('search_preferences', {}).get('preferred_gender'))
            print("  preferred_orientation:", c.get('search_preferences', {}).get('preferred_orientation'))
            print("  orientation:", c.get('search_preferences', {}).get('orientation'))
            print("  what_searches:", c.get('search_preferences', {}).get('what_searches'))
            print("CANDIDATE MARCELA:")
            print("  gender:", cand.get('gender'))
            print("  preferred_gender:", cand.get('search_preferences', {}).get('preferred_gender'))
            print("  preferred_orientation:", cand.get('search_preferences', {}).get('preferred_orientation'))

if __name__ == '__main__':
    inspect_daniella()
