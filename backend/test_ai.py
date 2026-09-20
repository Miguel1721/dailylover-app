import os, httpx, time
from app.config import get_settings

s = get_settings()
key = s.gemini_api_key or os.environ.get('GEMINI_API_KEY', '')
print('Gemini Key:', key[:10] if key else 'None')
t0 = time.time()
url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}'
try:
    r = httpx.post(url, json={'contents': [{'parts': [{'text': 'Hola, responde con una palabra'}]}]}, timeout=10.0)
    print('Status:', r.status_code, 'time:', round(time.time()-t0, 2), 's')
    if r.status_code == 200:
        print('Reply:', r.json()['candidates'][0]['content']['parts'][0]['text'])
    else:
        print('Err:', r.text[:200])
except Exception as e:
    print('Exception:', e)
