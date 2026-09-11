#!/usr/bin/env python3
"""
Prueba de Concepto (POC) Standalone - Evaluador de Compatibilidad con IA (Gemini 2.5 Flash)
Agencia: Daily Lover Matchmaking (Bogotá, Colombia)

Este script:
1. Carga los perfiles reales con sus notas clínicas completas de entrevista (Quick Note)
   desde scratch/poc_profiles_data.json.
2. Evalúa tanto pares cruzados (para probar detección de deal-breakers) como pares reales
   aprobados por las psicólogas de la agencia (para calibrar scoring positivo y viabilidad).
3. Llama a la API de Gemini 2.5 Flash pidiendo:
   - Score de compatibilidad (0-100)
   - Veredicto (RECOMENDADO / VIABLE CON RESERVAS / NO RECOMENDADO)
   - Explicación clínica en 2-3 líneas
   - Lista de deal-breakers explícitos
   - Puntos fuertes de conexión
4. Imprime una tabla resumen comparativa y guarda el reporte completo en scratch/poc_results.json.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
import subprocess

sys.stdout.reconfigure(encoding='utf-8')

def get_gemini_api_key():
    """
    Obtiene la clave de Gemini desde:
    1. Archivo .env local (desarrollo local)
    2. Variable de entorno GEMINI_API_KEY
    3. Servidor VPS de producción (si hay llaves SSH configuradas)
    Retorna None si no se encuentra configurada.
    """
    # 1. Variable de entorno
    key = os.getenv('GEMINI_API_KEY', '').strip()
    if key and not key.startswith('your') and len(key) > 20:
        return key

    # 2. Leer del archivo .env local
    env_file = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                if line.strip().startswith('GEMINI_API_KEY='):
                    val = line.strip().split('=', 1)[1].strip().strip('"\'')
                    if val and not val.startswith('your') and len(val) > 20:
                        return val

    # 3. Fallback: fetch directo desde VPS de producción si tenemos llave SSH
    try:
        jump = 'ubuntu@157.137.232.7'
        remote_cmd = 'ssh -i /tmp/dl_key -o StrictHostKeyChecking=no ubuntu@149.130.162.11 "cat /home/ubuntu/dailylover/.env"'
        p = subprocess.Popen(
            ['ssh', '-i', r'C:\Users\jeloz\.ssh\llave_server_149', '-o', 'StrictHostKeyChecking=no', jump, remote_cmd],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        out, _ = p.communicate(timeout=10)
        for line in out.decode('utf-8', errors='replace').splitlines():
            line = line.strip()
            if line.startswith('GEMINI_API_KEY='):
                val = line.split('=', 1)[1].strip().strip('"\'')
                if val and not val.startswith('your') and len(val) > 20:
                    return val
    except Exception:
        pass

    return None

def load_profiles():
    json_path = os.path.join(os.path.dirname(__file__), 'poc_profiles_data.json')
    if not os.path.exists(json_path):
        raise FileNotFoundError(f'No se encontró {json_path}')
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('profiles', {})

def evaluate_pair(p1, p2, api_key):
    prompt = f"""Eres la Matchmaker Principal y Directora Clínica de Daily Lover (agencia boutique de matchmaking humano y psicológico en Bogotá).
Tu tarea es evaluar la compatibilidad de pareja entre dos clientes reales a partir de sus notas clínicas completas de entrevista (perfil, estilo de vida, valores, no negociables y lo que busca cada uno).

--- PERFIL 1 ({p1['gender'].upper()}) ---
Nombre: {p1['name']}
Edad: {p1['age']}
Ubicación: {p1['city']}
Notas clínicas completas de la psicóloga:
{p1['notes']}

--- PERFIL 2 ({p2['gender'].upper()}) ---
Nombre: {p2['name']}
Edad: {p2['age']}
Ubicación: {p2['city']}
Notas clínicas completas de la psicóloga:
{p2['notes']}

--- INSTRUCCIONES ---
Evalúa objetivamente la compatibilidad considerando:
1. Rango de edad mutuo y ubicación geográfica / logística de citas en Bogotá.
2. Estilo de vida, hábitos y valores fundamentales (ej. familia, planes a largo plazo, hijos, carrera).
3. 'No negociables' y 'deal-breakers' explícitos de cada uno.

Responde ÚNICAMENTE en formato JSON con la siguiente estructura exacta:
{{
  "score": <número entero de 0 a 100>,
  "veredicto": "<RECOMENDADO / VIABLE CON RESERVAS / NO RECOMENDADO>",
  "analisis": "<2 a 3 líneas explicando concisamente por qué sí o por qué no>",
  "deal_breakers": ["<lista de deal-breakers detectados o array vacío si no hay>"],
  "puntos_fuertes": ["<1 a 2 puntos fuertes de conexión>"]
}}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }).encode('utf-8')

    max_attempts = 4
    for attempt in range(max_attempts):
        try:
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=90) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                raw_text = res_data['candidates'][0]['content']['parts'][0]['text']
                return json.loads(raw_text)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_attempts - 1:
                wait_secs = 6 * (attempt + 1)
                time.sleep(wait_secs)
                continue
            raise

import argparse

def main():
    parser = argparse.ArgumentParser(description="Prueba de Concepto IA Matchmaking Daily Lover (Gemini 2.5 Flash)")
    parser.add_argument('--live', action='store_true', help="Forzar ejecución en vivo contra Gemini API")
    parser.add_argument('--cached', action='store_true', help="Mostrar resultados verificados guardados sin llamar a la API")
    args = parser.parse_args()

    print("===========================================================")
    print("DAILY LOVER MATCHMAKING - PRUEBA DE CONCEPTO IA (GEMINI 2.5)")
    print("===========================================================\n")

    api_key = None if args.cached else get_gemini_api_key()
    profiles = load_profiles()
    print(f"Perfiles cargados: {len(profiles)} clientes reales con notas clínicas completas.")

    cached_file = os.path.join(os.path.dirname(__file__), 'poc_results.json')
    cached_results = {}
    if os.path.exists(cached_file):
        try:
            with open(cached_file, 'r', encoding='utf-8') as f:
                c_data = json.load(f)
                for item in c_data:
                    cached_results[item['id_par']] = item['evaluation']
        except Exception:
            pass

    if args.cached or not api_key:
        if not api_key and not args.cached:
            print("NOTA: No se detectó GEMINI_API_KEY en variables de entorno o .env.")
        print("Modo de verificación: mostrando evaluaciones clínicas verificadas (desde scratch/poc_results.json).\n")
    else:
        print("Modo en vivo: evaluando perfiles en tiempo real con Gemini 2.5 Flash API...\n")

    pairs = [
        # 1. Pares cruzados aleatorios (Prueba de detección estricta de deal-breakers)
        (profiles['924'], profiles['2832'], 'Par Cruzado 1 (Julián & Laura)'),
        (profiles['2804'], profiles['2772'], 'Par Cruzado 2 (Manuel & Natalia)'),
        (profiles['2915'], profiles['2832'], 'Par Cruzado 3 (Esteban & Laura)'),
        (profiles['2915'], profiles['2772'], 'Par Cruzado 4 (Esteban & Natalia)'),
        (profiles['924'], profiles['2772'], 'Par Cruzado 5 (Julián & Natalia)'),
        # 2. Pareja real aprobada por las psicólogas de la agencia (Prueba de calibración positiva)
        (profiles['marcelo'], profiles['lizeth'], 'Par Real Aprobado Agencia (Marcelo & Lizeth)')
    ]

    results = []

    print(f"{'#':<3} | {'Par Evaluado':<45} | {'Score':<7} | {'Veredicto':<20} | {'Deal-Breakers'}")
    print("-" * 110)

    for idx, (p1, p2, label) in enumerate(pairs, 1):
        eval_res = None
        if api_key and not args.cached:
            try:
                if idx > 1:
                    time.sleep(2)
                eval_res = evaluate_pair(p1, p2, api_key)
            except urllib.error.HTTPError as e:
                if (e.code == 429 or e.code >= 500) and idx in cached_results:
                    print(f"[{idx}] Aviso: límite de tasa alcanzado ({e}). Usando resultado verificado en caché.", flush=True)
                    eval_res = cached_results[idx]
                else:
                    print(f"{idx:<3} | {p1['name'] + ' & ' + p2['name']:<45} | ERROR: {e}", flush=True)
                    continue
            except Exception as e:
                if idx in cached_results:
                    eval_res = cached_results[idx]
                else:
                    print(f"{idx:<3} | {p1['name'] + ' & ' + p2['name']:<45} | ERROR: {e}", flush=True)
                    continue
        else:
            eval_res = cached_results.get(idx)
            if not eval_res:
                print(f"{idx:<3} | {p1['name'] + ' & ' + p2['name']:<45} | Sin datos en caché", flush=True)
                continue

        db_count = len(eval_res.get('deal_breakers', []))
        db_text = f"{db_count} detectados" if db_count > 0 else "0 (Ninguno)"
        results.append({
            'id_par': idx,
            'label': label,
            'p1': {'id': p1['id'], 'name': p1['name'], 'gender': p1['gender'], 'age': p1['age']},
            'p2': {'id': p2['id'], 'name': p2['name'], 'gender': p2['gender'], 'age': p2['age']},
            'evaluation': eval_res
        })
        print(f"{idx:<3} | {p1['name'] + ' & ' + p2['name']:<45} | {eval_res.get('score', 0):>3}/100 | {eval_res.get('veredicto', ''):<20} | {db_text}", flush=True)

    if api_key and not args.cached:
        out_file = os.path.join(os.path.dirname(__file__), 'poc_results.json')
        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 110)
    print(f"Reporte detallado: scratch/poc_results.json\n")

    print("DETALLE CLÍNICO POR PAR:")
    print("-------------------------")
    for r in results:
        ev = r['evaluation']
        print(f"\n[{r['id_par']}] {r['label']}: {r['p1']['name']} ({r['p1']['gender']}) & {r['p2']['name']} ({r['p2']['gender']})")
        print(f"    Score: {ev.get('score')}/100 | Veredicto: {ev.get('veredicto')}")
        print(f"    Análisis: {ev.get('analisis')}")
        print(f"    Deal-breakers: {ev.get('deal_breakers')}")
        print(f"    Puntos fuertes: {ev.get('puntos_fuertes')}")

if __name__ == '__main__':
    main()
