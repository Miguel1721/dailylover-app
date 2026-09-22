import json
import re

def check_gender_clashes():
    with open('/home/ubuntu/dailylover/backend/batch_rich_200_pairs.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    female_words = ['tranquila', 'ingeniera', 'abogada', 'médica', 'diseñadora', 'soltera', 'ella', 'laura', 'daniela', 'daniella', 'maria', 'paula', 'carolina', 'andrea', 'camila', 'alejandra', 'valeria', 'sofia', 'natalia', 'nathalia']
    male_words = ['tranquilo', 'ingeniero', 'abogado', 'médico', 'diseñador', 'soltero', 'él', 'juan', 'carlos', 'andres', 'andrés', 'felipe', 'camilo', 'sebastian', 'sebastián', 'santiago', 'daniel', 'alejandro', 'nicolas', 'nicolás']

    contradictions = []

    for p in data.get('pairs', []):
        for role in ['client', 'candidate']:
            person = p[role]
            uid = person.get('user_id')
            name = person.get('name', '')
            crm_gender = person.get('gender', '')
            notes = (person.get('notes') or '').lower()[:500]

            # Check if CRM says Hombre but notes scream Mujer
            if str(crm_gender).lower() in ['hombre', 'masculino', 'm']:
                female_hits = [w for w in ['es una mujer', 'ella es', 'es tranquila', 'es ingeniera', 'es abogada', 'es médica', 'es comunicadora'] if w in notes]
                if female_hits:
                    contradictions.append({
                        "pair_id": p['pair_id'],
                        "role": role,
                        "user_id": uid,
                        "name": name,
                        "crm_gender": crm_gender,
                        "hits": female_hits,
                        "snippet": notes[:200]
                    })

            # Check if CRM says Mujer but notes scream Hombre
            if str(crm_gender).lower() in ['mujer', 'femenino', 'f']:
                male_hits = [w for w in ['es un hombre', 'él es', 'es tranquilo', 'es ingeniero', 'es abogado', 'es médico'] if w in notes]
                if male_hits:
                    contradictions.append({
                        "pair_id": p['pair_id'],
                        "role": role,
                        "user_id": uid,
                        "name": name,
                        "crm_gender": crm_gender,
                        "hits": male_hits,
                        "snippet": notes[:200]
                    })

    # Deduplicate by user_id
    seen = set()
    unique = []
    for c in contradictions:
        if c['user_id'] not in seen:
            seen.add(c['user_id'])
            unique.append(c)

    print(f"Total gender contradictions found in batch: {len(unique)}")
    for u in unique:
        print(f"UID {u['user_id']} | {u['name']} | CRM Gender: {u['crm_gender']} | Hits: {u['hits']}")
        print(f"   Snippet: {u['snippet']}...\n")

if __name__ == '__main__':
    check_gender_clashes()
