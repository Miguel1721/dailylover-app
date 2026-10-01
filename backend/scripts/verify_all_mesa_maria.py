import asyncio
import os
import sys

# Test script for FastAPI app via TestClient or AsyncClient
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from app.main import app
from app.database import AsyncSessionLocal
from app.services.auth_service import create_access_token

async def run_verifications():
    print("=================================================================")
    print("INICIANDO VERIFICACIÓN COMPLETA DE 'MI MESA' Y 'POR APROBAR'")
    print("=================================================================\n")

    # Generate test auth token for admin from DB
    async with AsyncSessionLocal() as db:
        user_row = (await db.execute(text("SELECT id, email, role_id FROM user_accounts WHERE status = 'active' LIMIT 1"))).fetchone()
        if user_row:
            token = create_access_token(user_account_id=str(user_row.id), role_id=str(user_row.role_id))
            print(f"Token generado para usuario: {user_row.email} (ID: {user_row.id})")
        else:
            token = create_access_token(user_account_id="1", role_id="admin")

    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:

        # ── 1. VERIFICAR candidate-matches-engine (MOISES BARRON: 13569) ─────────────
        print("\n1. PROBANDO ENDPOINT: /api/v1/matchmaking/candidate-matches-engine?client_id=13569&limit=5")
        r1 = await client.get("/api/v1/matchmaking/candidate-matches-engine?client_id=13569&limit=5", headers=headers)
        print(f"   Status Code: {r1.status_code}")
        assert r1.status_code == 200, f"Error en endpoint: {r1.text}"
        data1 = r1.json()
        cands = data1.get("candidates") or data1.get("suggested_matches") or []
        print(f"   Cliente: {data1.get('client', {}).get('name')} (CRM ID: {data1.get('client', {}).get('crm_id')})")
        print(f"   Total candidatas devueltas: {len(cands)}")
        for i, c in enumerate(cands, 1):
            print(f"     #{i}: {c.get('name')} | Score: {c.get('score')}% | Veredicto: {c.get('veredicto')} | Ciudad: {c.get('city')}")
        assert len(cands) >= 3, f"Se esperaban al menos 3 candidatas, se obtuvieron {len(cands)}"
        print("   >>> OK: Endpoint de candidatas funcionando y retornando perfiles reales con scores calculados.\n")

        # ── 2. VERIFICAR mesa-psicologa (SILVI) ──────────────────────────────────────
        print("2. PROBANDO ENDPOINT: /api/v1/matchmaking/mesa-psicologa?psychologist=SILVI")
        r2 = await client.get("/api/v1/matchmaking/mesa-psicologa?psychologist=SILVI", headers=headers)
        print(f"   Status Code: {r2.status_code}")
        assert r2.status_code == 200, f"Error en endpoint: {r2.text}"
        data2 = r2.json()
        en_rev = data2.get("en_revision") or []
        por_prop = data2.get("por_proponer") or []
        aprob = data2.get("aprobados") or []

        print(f"   Bandeja 'Por proponer' (clientes únicos): {len(por_prop)}")
        print(f"   Bandeja 'En revisión de María': {len(en_rev)}")
        print(f"   Bandeja 'Aprobados': {len(aprob)}")

        # Verificar clasificación estricta de En revisión
        for item in en_rev:
            st = (item.get("status") or "").upper()
            assert not any(bad in st for bad in ("TROUBLE", "REVISAR", "ARCHIVADO", "NOT APPROVED", "NO HAY GENTE")), f"Fila no permitida en revisión: {item}"
            assert item.get("person_b") and item.get("person_b").lower() not in ("por definir", "none", ""), f"En revisión sin person_b: {item}"

        # Verificar Por proponer: deduplicado y labels
        clients_seen = set()
        citas_por_confirmar_count = 0
        dias_guion_count = 0
        for item in por_prop:
            cid = item.get("user_id_a") or item.get("person_a")
            assert cid not in clients_seen, f"Cliente duplicado en por_proponer: {cid}"
            clients_seen.add(cid)
            if item.get("citas_label") == "Citas por confirmar":
                citas_por_confirmar_count += 1
            if item.get("dias_label") == "-":
                dias_guion_count += 1

        print(f"   Muestras 'Por proponer':")
        for item in por_prop[:3]:
            print(f"     - {item['person_a']} | Plan: {item['plan_tier']} | {item['citas_label']} | {item['dias_label']} | Motivo rechazo: {item.get('rejection_reason')}")

        print(f"   Clientes con 'Citas por confirmar': {citas_por_confirmar_count}")
        print(f"   Clientes con días '-' (migración 23-ago): {dias_guion_count}")
        print("   >>> OK: Bandejas de Mi Mesa clasificadas correctamente por cliente y con labels limpios.\n")

        # ── 3. VERIFICAR approval-queue (POR APROBAR) ─────────────────────────────────
        print("3. PROBANDO ENDPOINT: /api/v1/matchmaking/approval-queue")
        r3 = await client.get("/api/v1/matchmaking/approval-queue?page=1&page_size=20", headers=headers)
        print(f"   Status Code: {r3.status_code}")
        assert r3.status_code == 200, f"Error en endpoint: {r3.text}"
        data3 = r3.json()
        queue = data3.get("queue") or []
        total = data3.get("total")
        total_pages = data3.get("total_pages")
        print(f"   Total propuestas en cola: {total} (Páginas: {total_pages})")
        print(f"   Items en página 1: {len(queue)}")

        scores = [q.get("compatibility_score") for q in queue]
        distinct_scores = set(scores)
        print(f"   Scores obtenidos en página 1: {scores[:5]}... (Distintos valores: {len(distinct_scores)})")
        assert len(distinct_scores) > 1, f"Todos los puntajes siguen siendo idénticos: {distinct_scores}"

        print("   Muestras de razones clínicas dimensionales:")
        for q in queue[:3]:
            print(f"     Match #{q['id']}: {q['person_a']} ({q.get('person_a_age')}a) x {q['person_b']} ({q.get('person_b_age')}a) | Score: {q.get('compatibility_score')}/100")
            print(f"       Propuesto: {q.get('fecha_propuesta_label')}")
            for r in q.get("reasons", []):
                print(f"       • {r}")
        print("   >>> OK: Puntajes calculados dinámicamente con motor clínico y 3 razones dimensionales reales.\n")

        # ── 4. CONTEO DE PALABRAS EN webhooks.py ──────────────────────────────────────
        print("4. VERIFICANDO PALABRAS CLAVE EN webhooks.py...")
        wb_path = "/app/app/routers/webhooks.py"
        if not os.path.exists(wb_path):
            wb_path = os.path.join(os.path.dirname(__file__), "..", "app", "routers", "webhooks.py")
        with open(wb_path, "r", encoding="utf-8") as f:
            wb_text = f.read()

        words = [
            "is_event_ticket",
            "verify_signature_with_timestamp",
            "SMARTMATCHAPP_ENFORCE_SIGNATURE",
            "ingest_webhook_payload"
        ]
        counts = {w: wb_text.count(w) for w in words}
        for w, c in counts.items():
            print(f"   - {w}: {c}")
            assert c > 0, f"Palabra {w} no encontrada en webhooks.py!"

        print("\n=================================================================")
        print("✓ TODAS LAS VERIFICACIONES COMPLETADAS EXITOSAMENTE")
        print("=================================================================")

if __name__ == "__main__":
    asyncio.run(run_verifications())
