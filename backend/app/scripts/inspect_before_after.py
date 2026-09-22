import json

def main():
    try:
        with open('/home/ubuntu/dailylover/backend/app/scripts/benchmark_results_production.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print("Error loading json:", e)
        return

    if isinstance(data, dict):
        print("Keys in data:", list(data.keys()))
        items = data.get('results', [])
        print("Type of items:", type(items), "Length:", len(items))
        if isinstance(items, dict):
            items = list(items.values())
    print("Item 4 in results:")
    item4 = items[3]
    print("Client name:", item4.get('client_real_name'))
    print("Target:", item4.get('target_client'))
    print("Top match:", item4.get('top_match'))
    print("Suggested count:", item4.get('suggested_matches_count'))
    print("Discarded count:", item4.get('discarded_count'))

    for c in items:
        name = c.get('client_real_name', c.get('target_client', ''))
        if any(k in name for k in ['Manuela', 'Katerine', 'Andres Felipe']):
            print('='*60)
            print('CLIENT:', name)
            top = c.get('top_match', {})
            if top:
                print('Top Match:', top.get('name'), f'({top.get("compatibility_pct")}%)')
                print('Veredicto:', top.get('ai_veredicto'))
                print('Puntos Fuertes:', json.dumps(top.get('puntos_fuertes'), ensure_ascii=False, indent=2))
                print('Deal Breakers:', json.dumps(top.get('deal_breakers'), ensure_ascii=False, indent=2))
                print('Analisis:', top.get('analisis'))

if __name__ == '__main__':
    main()
