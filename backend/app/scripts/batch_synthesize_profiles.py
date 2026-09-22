"""
Batch Synthesize Profiles — DailyLover
Genera y guarda el vector estructurado en 8 ejes (clinical_profile_360) para los perfiles.

Uso:
  python batch_synthesize_profiles.py --limit 500  (procesa los primeros 500 perfiles)
  python batch_synthesize_profiles.py --all        (procesa toda la base)
"""

import asyncio
import argparse
import json
import time
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.octagonal_persona_synthesizer import OctagonalPersonaSynthesizer

async def run_batch_synthesis(limit: int = 100, process_all: bool = False):
    print("=====================================================================")
    print("🚀 PROCESAMIENTO EN LOTE: SÍNTESIS CLÍNICA OCTAGONAL (8 EJES)")
    print("=====================================================================\n")

    start_time = time.time()
    
    async with AsyncSessionLocal() as db:
        limit_clause = "" if process_all else f"LIMIT {limit}"
        query = f"""
            SELECT p.user_id, u.name, p.city, p.gender, p.age, p.bio_notes, p.lifestyle, p.search_preferences
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.name IS NOT NULL
              AND (p.clinical_profile_360 IS NULL OR p.clinical_profile_360 = '{{}}'::jsonb OR p.clinical_profile_360->'metadata'->>'version_sintesis' IS NULL)
            ORDER BY p.updated_at DESC NULLS LAST
            {limit_clause};
        """
        
        res = await db.execute(text(query))
        rows = res.fetchall()
        total = len(rows)
        print(f"Perfiles pendientes de sintetizar: {total}\n")
        
        if total == 0:
            print("✅ Todos los perfiles ya cuentan con síntesis octagonal actualizada.")
            return

        batch_size = 200
        processed = 0
        
        for i in range(0, total, batch_size):
            chunk = rows[i:i + batch_size]
            for r in chunk:
                syn = OctagonalPersonaSynthesizer.synthesize_profile(
                    user_id=r.user_id,
                    name=r.name,
                    city=r.city or "",
                    gender=r.gender or "",
                    age=r.age,
                    bio_notes=r.bio_notes or "",
                    lifestyle=r.lifestyle or {},
                    search_preferences=r.search_preferences or {}
                )
                
                await db.execute(text("""
                    UPDATE profiles 
                    SET clinical_profile_360 = CAST(:syn_json AS jsonb)
                    WHERE user_id = :uid
                """), {
                    "syn_json": json.dumps(syn, ensure_ascii=False),
                    "uid": r.user_id
                })
            
            await db.commit()
            processed += len(chunk)
            elapsed = time.time() - start_time
            print(f"  ⚡ Progreso: {processed}/{total} perfiles sintetizados ({processed/elapsed:.1f} perfiles/seg)...")

        print(f"\n✅ ¡Síntesis completada con éxito! Total procesados: {processed} en {time.time()-start_time:.2f}s")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=200, help="Límite de perfiles a procesar")
    parser.add_argument("--all", action="store_true", help="Procesa todos los perfiles pendientes")
    args = parser.parse_args()
    
    asyncio.run(run_batch_synthesis(limit=args.limit, process_all=args.all))
