import json

def inspect_pair_7():
    with open('/home/ubuntu/dailylover/backend/batch_rich_200_pairs.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    for p in data.get('pairs', []):
        if p['pair_id'] == 'PAIR-007-2':
            print("CLIENT 7:")
            c = p['client']
            print("  Name:", c.get('name'))
            print("  Lifestyle:", c.get('lifestyle'))
            print("  Search Prefs:", c.get('search_preferences'))
            print("  Notes:\n", c.get('notes')[:400])
            print("\nCANDIDATE SARA GUZMAN:")
            cand = p['candidate']
            print("  Name:", cand.get('name'))
            print("  Lifestyle:", cand.get('lifestyle'))
            print("  Search Prefs:", cand.get('search_preferences'))
            print("  Notes:\n", cand.get('notes')[:400])

if __name__ == '__main__':
    inspect_pair_7()
