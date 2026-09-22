"""
Sanitizador Estructural de Base de Datos — DailyLover
Corrige inconsistencias detectadas en auditorías clínicas:
1. Ciudades con sufijos de metadatos contaminados ("Med 49 años", "VIP - HOLLYWOOD", "PIDIO REFUND")
2. Hijos fantasma: Sincroniza lifestyle.has_children cuando las notas clínicas confirman paternidad/maternidad
3. Reconciliación de género contradictorio CRM vs Notas clínicas (ej. Daniella Lozada)
4. Detección y etiquetado de disponibilidad operativa (EN_PAREJA, REFUND, INACTIVO)

Uso:
  python sanitize_database_structural_data.py --dry-run  (solo reporta)
  python sanitize_database_structural_data.py --apply    (aplica cambios a la BD)
"""

import asyncio
import argparse
import json
import re
import sys
from sqlalchemy import text
from app.database import AsyncSessionLocal

def clean_city_name(raw_city: str, bio_notes: str = "") -> str:
    if not raw_city:
        return raw_city
    c = raw_city.strip()
    c_lower = c.lower()
    
    if "med 49" in c_lower or c_lower == "med" or "medellin" in c_lower:
        return "Medellín"
    if "vip - hollywood" in c_lower or "hollywood" in c_lower:
        return "Hollywood, FL"
    if c_lower in ["mia", "miami"]:
        return "Miami, FL"
    if "pidio refund" in c_lower or "refund" in c_lower:
        # Infer city from notes if possible
        b_lower = bio_notes.lower()
        if "bogot" in b_lower:
            return "Bogotá"
        if "medell" in b_lower:
            return "Medellín"
        if "cali" in b_lower:
            return "Cali"
        return "No especificada"
    if "bgta" in c_lower or "bogota" in c_lower or "bogotá" in c_lower:
        return "Bogotá"
    if "cartagena" in c_lower:
        return "Cartagena"
    if "barranquilla" in c_lower:
        return "Barranquilla"
    return c

def detect_availability_status(bio_notes: str, city_raw: str = "") -> str:
    notes = (bio_notes or "").lower()
    city = (city_raw or "").lower()
    
    # Check first 200 chars for status markers
    head = notes[:250]
    if any(k in head for k in ["saliendo con", "de novio con", "de novia con", "en pareja con", "se caso con"]):
        return "EN_PAREJA"
    if any(k in head for k in ["refund", "refound", "pidio reembolso", "se le ofrecio refund"]) or "refund" in city:
        return "REFUND"
    if any(k in head for k in ["congelad", "no volvio a contestar", "inactiv", "pausad", "retirarse", "eliminar datos"]):
        return "INACTIVO"
    return "ACTIVO"

def detect_ghost_children(lifestyle: dict, bio_notes: str) -> tuple[bool, str]:
    """
    Retorna (es_hijo_fantasma, razon)
    """
    notes = (bio_notes or "").lower()
    current_has = (lifestyle or {}).get("has_children")
    
    # Si ya dice Sí o True, no es fantasma
    if current_has in ["Sí", "Si", True, "yes", "s"]:
        return False, ""
    
    # Buscar evidencia clara en notas
    patterns = [
        (r'(\b\d+\s*hijos?\b)', "Mención explícita de cantidad de hijos"),
        (r'(tiene\s+(un|dos|tres|\d+)\s+hijos?)', "Tiene hijos en notas"),
        (r'(padre\s+de|madre\s+de|mamá\s+de|papá\s+de)\s+(\d+|un|dos|tres)', "Rol parental con edad/cantidad"),
        (r'(custodia\s+compartida)', "Custodia compartida en notas"),
        (r'(hijo\s+de\s+\d+\s+años)', "Hijo con edad específica"),
        (r'(hija\s+de\s+\d+\s+años)', "Hija con edad específica"),
        (r'(hijos\s+viven\s+con)', "Hijos viviendo con la persona/ex")
    ]
    
    for pat, desc in patterns:
        m = re.search(pat, notes)
        if m:
            # Excluir falsos positivos comunes
            snippet = notes[max(0, m.start()-30):min(len(notes), m.end()+30)]
            if any(neg in snippet for neg in ["no tiene hijos", "sin hijos", "cero hijos", "no quiere hijos"]):
                continue
            return True, f"{desc}: '{m.group(0)}'"
            
    return False, ""

def detect_gender_inversion(current_gender: str, name: str, bio_notes: str) -> tuple[bool, str]:
    """
    Verifica si el género registrado en CRM choca evidentemente con el nombre y notas.
    """
    g = (current_gender or "").lower().strip()
    name_clean = (name or "").lower().strip()
    notes = (bio_notes or "").lower()
    
    # Femenino evidente en CRM como Hombre
    if g in ["hombre", "male"]:
        # Casos como Daniella, Camila, Laura, Andrea
        first_name = name_clean.split()[0] if name_clean else ""
        female_names = ["daniella", "daniela", "laura", "camila", "andrea", "sofia", "juliana", "valentina", "carolina", "natalia", "paula", "maria"]
        if first_name in female_names:
            if any(f in notes for f in ["ella es", "es una mujer", "chica", "abogada", "ingeniera", "psicologa", "soltera"]):
                return True, "Mujer"
    
    # Masculino evidente en CRM como Mujer
    if g in ["mujer", "female"]:
        first_name = name_clean.split()[0] if name_clean else ""
        male_names = ["juan", "carlos", "diego", "andres", "felipe", "daniel", "sebastian", "camilo", "miguel", "javier", "alvaro", "antonio"]
        if first_name in male_names:
            if any(m in notes for m in ["el es", "es un hombre", "chico", "abogado", "ingeniero", "soltero", "empresario"]):
                return True, "Hombre"
                
    return False, ""

async def sanitize_database(dry_run: bool = True):
    mode_str = "MODO SIMULACIÓN (DRY-RUN)" if dry_run else "MODO EJECUCIÓN REAL (--apply)"
    print(f"=====================================================================")
    print(f"🛠️ SANEADOR ESTRUCTURAL DE BASE DE DATOS: {mode_str}")
    print(f"=====================================================================\n")
    
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT p.user_id, u.name, p.city, p.gender, p.bio_notes, p.lifestyle
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.name IS NOT NULL
        """))
        rows = res.fetchall()
        print(f"Total perfiles cargados: {len(rows)}\n")
        
        city_fixes = []
        children_fixes = []
        gender_fixes = []
        status_counts = {"ACTIVO": 0, "EN_PAREJA": 0, "REFUND": 0, "INACTIVO": 0}
        
        for r in rows:
            uid = r.user_id
            name = r.name
            city = r.city or ""
            gender = r.gender or ""
            notes = r.bio_notes or ""
            lifestyle = r.lifestyle or {}
            
            # 1. Ciudad contaminada
            cleaned_city = clean_city_name(city, notes)
            if cleaned_city != city and city:
                city_fixes.append((uid, name, city, cleaned_city))
                
            # 2. Hijos fantasma
            is_ghost, reason = detect_ghost_children(lifestyle, notes)
            if is_ghost:
                children_fixes.append((uid, name, reason))
                
            # 3. Género invertido
            is_inverted, correct_gender = detect_gender_inversion(gender, name, notes)
            if is_inverted:
                gender_fixes.append((uid, name, gender, correct_gender))
                
            # 4. Estado operativo
            status = detect_availability_status(notes, city)
            status_counts[status] += 1

        print(f"📊 RESUMEN DE HALLAZGOS Y CORRECCIONES:")
        print(f"  📍 Ciudades corregidas: {len(city_fixes)}")
        for cf in city_fixes[:5]:
            print(f"     UID {cf[0]} ({cf[1]}): '{cf[2]}' -> '{cf[3]}'")
        if len(city_fixes) > 5:
            print(f"     ... y {len(city_fixes)-5} más.")

        print(f"\n  👶 Hijos fantasma reconciliados a has_children='Sí': {len(children_fixes)}")
        for ch in children_fixes[:5]:
            print(f"     UID {ch[0]} ({ch[1]}): {ch[2]}")
        if len(children_fixes) > 5:
            print(f"     ... y {len(children_fixes)-5} más.")

        print(f"\n  ⚧ Inversiones de género corregidas: {len(gender_fixes)}")
        for gf in gender_fixes:
            print(f"     UID {gf[0]} ({gf[1]}): '{gf[2]}' -> '{gf[3]}'")

        print(f"\n  🚦 Distribución de Disponibilidad Operativa detectada:")
        for k, v in status_counts.items():
            print(f"     - {k}: {v} perfiles")

        if not dry_run:
            print("\n⚙️ Aplicando cambios a la base de datos PostgreSQL...")
            
            # 1. Update cities
            for uid, _, _, new_city in city_fixes:
                await db.execute(text("UPDATE profiles SET city = :c WHERE user_id = :u"), {"c": new_city, "u": uid})
                
            # 2. Update ghost children
            for uid, _, _ in children_fixes:
                await db.execute(text("""
                    UPDATE profiles 
                    SET lifestyle = jsonb_set(COALESCE(lifestyle, '{}'::jsonb), '{has_children}', '"Sí"')
                    WHERE user_id = :u
                """), {"u": uid})
                
            # 3. Update inverted genders
            for uid, _, _, new_gender in gender_fixes:
                await db.execute(text("UPDATE profiles SET gender = :g WHERE user_id = :u"), {"g": new_gender, "u": uid})
                
            # 4. Update availability status in lifestyle
            for r in rows:
                st = detect_availability_status(r.bio_notes or "", r.city or "")
                await db.execute(text("""
                    UPDATE profiles 
                    SET lifestyle = jsonb_set(COALESCE(lifestyle, '{}'::jsonb), '{availability_status}', to_jsonb(CAST(:st AS text)))
                    WHERE user_id = :u
                """), {"st": st, "u": r.user_id})

            await db.commit()
            print("✅ ¡Todos los cambios han sido aplicados exitosamente y commiteados!")
        else:
            print("\n💡 Para aplicar estos cambios definitivamente, ejecuta con flag: --apply")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Aplica los cambios en la BD")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Solo simula")
    args = parser.parse_args()
    
    is_apply = args.apply
    asyncio.run(sanitize_database(dry_run=not is_apply))
