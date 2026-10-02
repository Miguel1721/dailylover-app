"""Acceso de REVISION (solo lectura, 45 min): sesion para ver la web como otra persona del equipo.

Autorizado por Jorge el 2-oct-2026. Solo se puede ejecutar dentro del servidor (no hay ruta web que lo haga).
Cada uso queda registrado en view_as_audit. El token no puede guardar ni enviar nada (lo bloquea get_current_user).
Uso (en el contenedor):
  python /app/scripts/ver_como.py --lista
  python /app/scripts/ver_como.py "isa"      # busca por correo o nombre del empleado
Imprime una linea JSON: {"token": ..., "user": {...}}
"""
import asyncio
import json
import sys

from sqlalchemy import text

sys.path.insert(0, "/app")
from app.database import AsyncSessionLocal            # noqa: E402
from app.services.auth_service import create_view_token   # noqa: E402

SQL = """SELECT ua.id, ua.email, ua.role_id, COALESCE(ua.status,'active') status,
                r.name role_name, COALESCE(r.is_system,false) is_system, e.full_name
         FROM user_accounts ua LEFT JOIN roles r ON r.id = ua.role_id LEFT JOIN employees e ON e.id = ua.employee_id"""


async def main():
    arg = " ".join(a for a in sys.argv[1:] if not a.startswith("--")).strip()
    async with AsyncSessionLocal() as db:
        await db.execute(text("CREATE TABLE IF NOT EXISTS view_as_audit (id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW(), target_email TEXT, target_role TEXT, note TEXT)"))
        rows = (await db.execute(text(SQL + " ORDER BY r.name NULLS LAST, e.full_name"))).fetchall()
        if "--lista" in sys.argv or not arg:
            for r in rows:
                print(f"{(r.role_name or '-'):18s} {(r.full_name or '-'):32s} {r.email}  [{r.status}]")
            return
        q = arg.lower()
        hit = [r for r in rows if q in (r.email or "").lower() or q in (r.full_name or "").lower()]
        if len(hit) != 1:
            print(json.dumps({"error": f"{len(hit)} coincidencias para '{arg}'", "opciones": [f"{h.full_name} <{h.email}>" for h in hit][:10]}, ensure_ascii=False))
            return
        r = hit[0]
        if r.status != "active":
            print(json.dumps({"error": "la cuenta no esta activa"}))
            return
        if r.is_system:
            perms = [f"{p.module}.{p.action}" for p in (await db.execute(text("SELECT module, action FROM permissions"))).fetchall()]
        else:
            perms = [f"{p.module}.{p.action}" for p in (await db.execute(text("SELECT p.module, p.action FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = :r"), {"r": r.role_id})).fetchall()]
        await db.execute(text("INSERT INTO view_as_audit (target_email, target_role, note) VALUES (:e, :r, 'revision de solo lectura emitida desde el servidor')"), {"e": r.email, "r": r.role_name})
        await db.commit()
        token = create_view_token(r.id, r.role_id)
        user = {"id": str(r.id), "name": r.full_name or "Usuario", "email": r.email, "role": r.role_name or "Sin Asignar",
                "must_change_password": False, "permissions": perms}
        print(json.dumps({"token": token, "user": user}, ensure_ascii=False))


asyncio.run(main())
