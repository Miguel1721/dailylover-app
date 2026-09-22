import json

def check_intercity():
    with open('/home/ubuntu/dailylover/backend/batch_rich_200_pairs.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    intercity_real = []
    metro_area = [
        {"bogotá", "chía", "cajicá", "la calera", "tabio", "tenjo", "zipaquirá", "sopó"},
        {"medellín", "envigado", "sabaneta", "itagüí", "la estrella", "rionegro", "el retiro", "bello"}
    ]

    for p in data.get('pairs', []):
        c = p['client']
        cand = p['candidate']
        c_city = (c.get('city') or '').strip().lower()
        cand_city = (cand.get('city') or '').strip().lower()

        # normalize
        c_city = c_city.replace('?', 'i').replace('medellin', 'medellín').replace('bogota', 'bogotá')
        cand_city = cand_city.replace('?', 'i').replace('medellin', 'medellín').replace('bogota', 'bogotá')

        is_same_metro = False
        for area in metro_area:
            if c_city in area and cand_city in area:
                is_same_metro = True
                break

        if c_city and cand_city and c_city != cand_city and not is_same_metro:
            intercity_real.append({
                "pair_id": p['pair_id'],
                "client": f"{c['name']} ({c['city']})",
                "candidate": f"{cand['name']} ({cand['city']})",
                "notes_distance_mention": "distancia" in (cand.get('notes') or '').lower() or "distancia" in (c.get('notes') or '').lower()
            })

    print(f"Total REAL Intercity pairs (not in same metro area): {len(intercity_real)}")
    for x in intercity_real:
        print(f"[{x['pair_id']}] {x['client']} <--> {x['candidate']}")

if __name__ == '__main__':
    check_intercity()
