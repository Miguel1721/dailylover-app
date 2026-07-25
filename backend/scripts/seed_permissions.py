import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.auth_service import hash_password

MODULES_AND_ACTIONS = {
    "dashboard":   ["view"],
    "clientes":    ["view", "create", "edit", "delete", "export"],
    "eventos":     ["view", "create", "edit", "delete", "close"],
    "importar":    ["view", "use"],
    "matching":    ["view", "manage"],
    "empleados":   ["view", "create", "edit", "delete"],
    "nomina":      ["view", "generate", "liquidate", "export"],
    "comisiones":  ["view", "manage"],
    "ingresos":    ["view", "create", "edit", "delete"],
    "gastos":      ["view", "create", "edit", "delete"],
    "flujo_caja":  ["view"],
    "roles":       ["view", "create", "edit", "delete"],
    "usuarios":    ["view", "create", "edit"],
}

ACTION_LABELS = {
    "view": "Ver",
    "create": "Crear",
    "edit": "Editar",
    "delete": "Eliminar",
    "export": "Exportar",
    "use": "Usar",
    "manage": "Gestionar",
    "close": "Cerrar",
    "generate": "Generar",
    "liquidate": "Liquidar"
}

MODULE_LABELS = {
    "dashboard": "Dashboard",
    "clientes": "Clientes (CRM)",
    "eventos": "Eventos",
    "importar": "Importar Excel",
    "matching": "Matchmaking",
    "empleados": "Empleados",
    "nomina": "Nómina",
    "comisiones": "Comisiones",
    "ingresos": "Ingresos",
    "gastos": "Gastos",
    "flujo_caja": "Flujo de Caja",
    "roles": "Roles de Sistema",
    "usuarios": "Cuentas de Usuario"
}

async def seed_rbac():
    async with AsyncSessionLocal() as db:
        print("[RBAC SEED] Iniciando seed de roles y permisos...")
        
        # 1. Clear existing RBAC if any (cascade deletes role_permissions, user_accounts)
        await db.execute(text("DELETE FROM role_permissions"))
        await db.execute(text("DELETE FROM user_accounts"))
        await db.execute(text("DELETE FROM roles"))
        await db.execute(text("DELETE FROM permissions"))
        await db.commit()
        
        # 2. Insert Permissions Catalog
        permission_map = {} # (module, action) -> uuid
        for module, actions in MODULES_AND_ACTIONS.items():
            for action in actions:
                action_label = ACTION_LABELS.get(action, action.capitalize())
                module_label = MODULE_LABELS.get(module, module.capitalize())
                label = f"{action_label} {module_label}"
                
                res = await db.execute(text("""
                    INSERT INTO permissions (module, action, label)
                    VALUES (:module, :action, :label)
                    RETURNING id
                """), {"module": module, "action": action, "label": label})
                
                perm_id = res.scalar()
                permission_map[(module, action)] = perm_id
                
        print(f"[RBAC SEED] Se crearon {len(permission_map)} permisos en el catálogo.")
        
        # 3. Create Admin Role (is_system = True)
        res_admin = await db.execute(text("""
            INSERT INTO roles (name, description, is_system)
            VALUES ('Admin', 'Acceso total y configuración del sistema.', true)
            RETURNING id
        """))
        admin_role_id = res_admin.scalar()
        
        # Associate all permissions to Admin
        for perm_id in permission_map.values():
            await db.execute(text("""
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES (:role_id, :perm_id)
            """), {"role_id": admin_role_id, "perm_id": perm_id})
            
        # 4. Create default "Sin asignar" Role
        await db.execute(text("""
            INSERT INTO roles (name, description, is_system)
            VALUES ('Sin asignar', 'Empleado registrado sin acceso asignado al panel.', false)
        """))
        
        print("[RBAC SEED] Roles 'Admin' y 'Sin asignar' creados exitosamente.")
        
        # 5. Create default Admin Employee if not exists (María Paula)
        # Check if Maria Paula employee exists
        chk_emp = await db.execute(text("SELECT id FROM employees WHERE email = 'mariapaula@dailylover.co'"))
        emp = chk_emp.fetchone()
        if not emp:
            res_emp = await db.execute(text("""
                INSERT INTO employees (full_name, role, phone, email, base_salary, contract_type, hire_date, status)
                VALUES ('María Paula', 'Administradora General', '+573000000000', 'mariapaula@dailylover.co', 5000000.0, 'nomina', '2026-01-01', 'active')
                RETURNING id
            """))
            emp_id = res_emp.scalar()
            print("[RBAC SEED] Empleado admin 'María Paula' creado.")
        else:
            emp_id = emp.id
            
        # 6. Create Admin User Account
        admin_email = "admin@dailylover.co"
        admin_pass = "admin12345"
        hashed = hash_password(admin_pass)
        
        await db.execute(text("""
            INSERT INTO user_accounts (employee_id, email, password_hash, role_id, status, must_change_password)
            VALUES (:emp_id, :email, :pass, :role_id, 'active', false)
        """), {"emp_id": emp_id, "email": admin_email, "pass": hashed, "role_id": admin_role_id})
        
        await db.commit()
        print(f"[RBAC SEED] Cuenta Admin creada. Email: {admin_email} | Password: {admin_pass}")

if __name__ == "__main__":
    asyncio.run(seed_rbac())
