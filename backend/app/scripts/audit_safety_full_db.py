"""
Script de Auditoría Determinista de Seguridad sobre el 100% de la Base de Datos.
Modo SOLO LECTURA (cero modificaciones a BD).
Escanea 8,000+ perfiles contra:
1. Regla Actual: Violencia, agresión física, antecedentes penales violentos.
2. Menores de edad (edad < 18).
3. Adicciones severas activas (drogas duras, alcoholismo activo severo, ludopatía).
4. Antecedentes penales / judiciales graves / estafas.
5. Riesgo psiquiátrico agudo / ideación suicida activa.
"""

import asyncio
import re
import json
from typing import Dict, List, Any
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.routers.matchmaking import check_safety_red_flags


async def run_full_safety_audit():
    print("==================================================================")
    print("🔍 INICIANDO AUDITORÍA DETERMINISTA DE SEGURIDAD (BASE COMPLETA)")
    print("==================================================================\n")

    async with AsyncSessionLocal() as db:
        query = text("""
            SELECT 
                u.id, 
                u.crm_id, 
                u.name, 
                p.age, 
                p.city, 
                p.occupation,
                p.bio_notes, 
                p.difficult_notes,
                p.search_preferences,
                p.lifestyle,
                e.synthesis_who_really_is
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN client_extended_profile e ON e.user_id = u.id
            ORDER BY u.id ASC
        """)
        res = await db.execute(query)
        rows = res.fetchall()

    total_profiles = len(rows)
    print(f"📊 Total de perfiles recuperados en DB: {total_profiles}\n")

    # Contenedores de hallazgos
    flagged_violence: List[Dict[str, Any]] = []
    flagged_minors: List[Dict[str, Any]] = []
    flagged_substances: List[Dict[str, Any]] = []
    flagged_legal_crimes: List[Dict[str, Any]] = []
    flagged_psychiatric_risk: List[Dict[str, Any]] = []

    # 1. Patrones para Adicciones Severas Activas
    substance_patterns = [
        r'\b(adicci[oó]n|adicto|adicta)\s+a\s+(las?\s+)?(drogas?|coca[ií]na|bazuco|hero[ií]na|sustancias?|alcohol|juego|apuestas)\b',
        r'\bconsumo\s+(problem[aá]tico|diario|descontrolado|compulsivo)\s+de\s+(drogas?|coca[ií]na|perico|bazuco|alcohol)\b',
        r'\balcoholismo\s+(severo|activo|cr[oó]nico|descontrolado)\b',
        r'\bludopat[ií]a\s+(severa|activa|grave)\b',
        r'\bconsume\s+(coca[ií]na|perico|bazuco|tusi)\s+(a\s+diario|frecuentemente|habitualmente)\b'
    ]
    substance_guards = [
        "no consume", "no tolera", "no acepta", "cero drogas", "cero adicciones", "no adicciones",
        "alejarse de", "victima de", "víctima de", "ex adicto", "recuperado", "sobrio hace",
        "su ex era", "su expareja era", "su papá", "su padre", "su madre", "su hermano",
        "familiar con", "no fuma", "socialmente", "ocasional", "tragos sociales"
    ]

    # 2. Patrones para Problemas Legales / Penales / Estafas Graves
    legal_patterns = [
        r'\b(estafador|estafadora|ha\s+estafado|condenad[oa]\s+por\s+estafa)\b',
        r'\b(estuvo|está|estuve)\s+(en\s+la\s+c[aá]rcel|en\s+prisi[oó]n|pres[oa])\b',
        r'\bcondena\s+penal\b',
        r'\b(orden\s+de\s+captura|prisi[oó]n\s+domiciliaria)\b',
        r'\b(investigad[oa]|imputad[oa])\s+por\s+(delitos?|fraude|estafa|lavado|narcotr[aá]fico)\b'
    ]
    legal_guards = [
        "abogado", "abogada", "penalista", "derecho penal", "defensor", "fiscal",
        "victima de estafa", "víctima de estafa", "le estafaron", "fue estafado", "fue estafada",
        "no tolera", "evitar estafas"
    ]

    # 3. Patrones para Riesgo Psiquiátrico Agudo / Ideación Suicida
    psych_patterns = [
        r'\b(intento|intentos)\s+de\s+suicidio\b',
        r'\b(ideaci[oó]n\s+suicida|pensamientos?\s+suicidas?)\b',
        r'\b(brote\s+psic[oó]tico|episodio\s+psic[oó]tico)\s+(reciente|activo)\b',
        r'\bhospitalizaci[oó]n\s+psiqui[aá]trica\s+(reciente|actual)\b',
        r'\b(esquizofrenia|trastorno\s+bipolar)\s+(no\s+controlad[oa]|descompensad[oa]|sin\s+tratamiento)\b'
    ]
    psych_guards = [
        "psiquiatra", "psicolog", "estudiante de psicología", "trabaja con", "superó",
        "hace 10 años", "hace muchos años", "familiar con", "su ex intentó", "su expareja"
    ]

    # Escaneo fila por fila
    for row in rows:
        uid = row.id
        crm_id = str(row.crm_id or "")
        name = row.name or "Sin nombre"
        age = row.age
        city = row.city or "Bogotá"
        occ = row.occupation or "No especificada"
        bio = str(row.bio_notes or "")
        synthesis = str(row.synthesis_who_really_is or "")
        diff_notes = str(row.difficult_notes or "")
        all_text = f"{bio} {synthesis} {diff_notes}".strip()
        all_text_lower = all_text.lower()

        person_dict = {
            "name": name,
            "bio_notes": bio,
            "synthesis": synthesis,
            "synthesis_who_really_is": synthesis,
            "difficult_notes": diff_notes
        }

        # A. Escaneo con la regla de Violencia actual
        is_viol, viol_reason = check_safety_red_flags(person_dict)
        if is_viol:
            flagged_violence.append({
                "user_id": uid,
                "crm_id": crm_id,
                "name": name,
                "age": age,
                "city": city,
                "reason": viol_reason
            })

        # B. Menores de edad
        # 1) Por campo edad
        is_minor = False
        minor_reason = None
        if age is not None:
            try:
                age_int = int(age)
                # Validar rango: menores de 18 (y filtrar edades absurdas tipo 0 o 1 que suelen ser placeholders de CRM)
                if 2 <= age_int < 18:
                    is_minor = True
                    minor_reason = f"Edad declarada en perfil: {age_int} años (< 18)"
            except Exception:
                pass
        
        # 2) En texto si no tiene edad en campo
        if not is_minor and bio:
            m_age = re.search(r'\b(1[0-7])\s*a[ñn]os\b', bio, re.IGNORECASE)
            if m_age:
                # Evitar "tiene un hijo de 15 años" o "hace 10 años"
                start = max(0, m_age.start() - 30)
                ctx = bio[start:m_age.end() + 30].lower()
                if not any(w in ctx for w in ["hijo", "hija", "sobrin", "hace", "hace 1", "experiencia"]):
                    is_minor = True
                    minor_reason = f"Texto en notas indica edad menor: '{m_age.group(0)}'"

        if is_minor:
            flagged_minors.append({
                "user_id": uid,
                "crm_id": crm_id,
                "name": name,
                "age": age,
                "city": city,
                "reason": minor_reason
            })

        # C. Adicciones severas activas
        if all_text:
            for pat in substance_patterns:
                m_sub = re.search(pat, all_text, re.IGNORECASE)
                if m_sub:
                    start = max(0, m_sub.start() - 80)
                    end = min(len(all_text), m_sub.end() + 80)
                    ctx = all_text[start:end].lower()
                    if not any(g in ctx for g in substance_guards):
                        flagged_substances.append({
                            "user_id": uid,
                            "crm_id": crm_id,
                            "name": name,
                            "age": age,
                            "city": city,
                            "match": m_sub.group(0),
                            "snippet": ctx.replace("\n", " ")
                        })
                        break

        # D. Problemas Legales / Penales / Estafas Graves
        if all_text:
            for pat in legal_patterns:
                m_leg = re.search(pat, all_text, re.IGNORECASE)
                if m_leg:
                    start = max(0, m_leg.start() - 80)
                    end = min(len(all_text), m_leg.end() + 80)
                    ctx = all_text[start:end].lower()
                    if not any(g in ctx for g in legal_guards):
                        flagged_legal_crimes.append({
                            "user_id": uid,
                            "crm_id": crm_id,
                            "name": name,
                            "age": age,
                            "city": city,
                            "match": m_leg.group(0),
                            "snippet": ctx.replace("\n", " ")
                        })
                        break

        # E. Riesgo Psiquiátrico Agudo / Ideación Suicida
        if all_text:
            for pat in psych_patterns:
                m_psy = re.search(pat, all_text, re.IGNORECASE)
                if m_psy:
                    start = max(0, m_psy.start() - 80)
                    end = min(len(all_text), m_psy.end() + 80)
                    ctx = all_text[start:end].lower()
                    if not any(g in ctx for g in psych_guards):
                        flagged_psychiatric_risk.append({
                            "user_id": uid,
                            "crm_id": crm_id,
                            "name": name,
                            "age": age,
                            "city": city,
                            "match": m_psy.group(0),
                            "snippet": ctx.replace("\n", " ")
                        })
                        break

    # Imprimir reporte estructurado
    print("==================================================================")
    print("📋 RESULTADOS DE LA AUDITORÍA DE SEGURIDAD")
    print("==================================================================\n")

    print(f"1. VIOLENCIA / AGRESIÓN FÍSICA (REGLA ACTUAL IMPLEMENTADA):")
    print(f"   Total detectados: {len(flagged_violence)}")
    for f in flagged_violence:
        print(f"   - UID: {f['user_id']} | CRM: {f['crm_id']} | {f['name']} ({f['city']}) -> {f['reason']}")
    print()

    print(f"2. MENORES DE EDAD (< 18 AÑOS):")
    print(f"   Total detectados: {len(flagged_minors)}")
    for f in flagged_minors:
        print(f"   - UID: {f['user_id']} | CRM: {f['crm_id']} | {f['name']} (Edad: {f['age']}) -> {f['reason']}")
    print()

    print(f"3. ADICCIONES SEVERAS ACTIVAS / LUDOPATÍA:")
    print(f"   Total detectados: {len(flagged_substances)}")
    for f in flagged_substances:
        print(f"   - UID: {f['user_id']} | CRM: {f['crm_id']} | {f['name']} -> Coincidencia: '{f['match']}'")
        print(f"     Contexto: \"...{f['snippet']}...\"")
    print()

    print(f"4. ANTECEDENTES PENALES / JUDICIALES GRAVES / ESTAFAS:")
    print(f"   Total detectados: {len(flagged_legal_crimes)}")
    for f in flagged_legal_crimes:
        print(f"   - UID: {f['user_id']} | CRM: {f['crm_id']} | {f['name']} -> Coincidencia: '{f['match']}'")
        print(f"     Contexto: \"...{f['snippet']}...\"")
    print()

    print(f"5. RIESGO PSIQUIÁTRICO AGUDO / IDEACIÓN SUICIDA:")
    print(f"   Total detectados: {len(flagged_psychiatric_risk)}")
    for f in flagged_psychiatric_risk:
        print(f"   - UID: {f['user_id']} | CRM: {f['crm_id']} | {f['name']} -> Coincidencia: '{f['match']}'")
        print(f"     Contexto: \"...{f['snippet']}...\"")
    print()

    summary_data = {
        "total_scanned": total_profiles,
        "violence_count": len(flagged_violence),
        "violence_records": flagged_violence,
        "minors_count": len(flagged_minors),
        "minors_records": flagged_minors,
        "substances_count": len(flagged_substances),
        "substances_records": flagged_substances,
        "legal_crimes_count": len(flagged_legal_crimes),
        "legal_crimes_records": flagged_legal_crimes,
        "psychiatric_risk_count": len(flagged_psychiatric_risk),
        "psychiatric_risk_records": flagged_psychiatric_risk
    }

    with open("/app/full_safety_audit_report.json", "w", encoding="utf-8") as out:
        json.dump(summary_data, out, ensure_ascii=False, indent=2)
    print("✅ Reporte completo guardado en /app/full_safety_audit_report.json")


if __name__ == "__main__":
    asyncio.run(run_full_safety_audit())
