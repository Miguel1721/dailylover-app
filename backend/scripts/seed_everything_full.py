"""
seed_everything_full.py
Completely seeds the dailylover database with rich, realistic, consistent data across all modules:
- Permissions catalog
- Roles (Admin, Ventas, Finanzas, Sin Asignar) with specific permissions
- Employees (María Paula, Sofía Silva, Mateo Restrepo, Camila Hoyos)
- User Accounts linked to employees
- Commission Rules
- 30 Clients (users & profiles)
- 6 Past events and 2 Future events
- Event Attendees
- Feedback & Match Requests
- Event Commissions (paid for Jan-May, pending for Jun)
- Financial Ledger records (incomes/expenses for Jan-Jun)
- Payroll Runs & Items (liquidated Jan-May, draft for Jun)
"""
import asyncio
import sys
import json
import random
from datetime import datetime, timedelta, date

sys.path.insert(0, '/app')

from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.auth_service import hash_password

# ─── DATA CONFIGURATIONS ──────────────────────────────────────────────────────

NAMES = [
    "Andrés Mendoza", "Valentina Gómez", "Santiago Restrepo", "Mariana Córdoba",
    "Juan David Castro", "Camila Echeverry", "Mateo Pinzón", "Gabriela Rojas",
    "Felipe Londoño", "Isabella Duarte", "Sebastián Ortiz", "Daniela Vargas",
    "Alejandro Ruiz", "Sofía Henao", "Nicolás Torres", "Manuela Jaramillo",
    "Juliana Cardona", "Diego Montoya", "Carolina Silva", "Esteban Marín",
    "Laura Bermúdez", "Carlos Quintero", "Natalia Flórez", "Daniel Restrepo",
    "Paula Salazar", "Felipe Gómez", "Andrea Peña", "Sebastián Rivas",
    "Camila Castro", "José Luis Díaz"
]

PHONES = [
    "+573151111111", "+573002222222", "+573103333333", "+573124444444",
    "+573205555555", "+573166666666", "+573177777777", "+573188888888",
    "+573199999999", "+573110000000", "+573211111111", "+573222222222",
    "+573233333333", "+573244444444", "+573155555555", "+573166666667",
    "+573177777778", "+573188888889", "+573199999990", "+573100000001",
    "+573123456780", "+573123456781", "+573123456782", "+573123456783",
    "+573123456784", "+573123456785", "+573123456786", "+573123456787",
    "+573123456788", "+573123456789"
]

MOTIVATIONS = ["exploracion", "conexion_profunda", "validacion", "diversion"]
ATTACHMENTS = ["seguro", "ansioso", "evitativo"]
ROLES_SOCIAL = ["lider", "mediador", "oyente", "dinamizador"]
MOMENTOS = ["explorando", "listo_vinculo", "consolidado", "transitando"]

INTERESTS = ["Padel", "Cocina", "Libros", "Senderismo", "Cine", "Vinos", "Viajes", "Fotografía", "Café", "Yoga", "Música en vivo", "Baile"]
VALUES = ["Honestidad", "Lealtad", "Crecimiento", "Libertad", "Empatía", "Aventura", "Familia"]

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
    "view": "Ver", "create": "Crear", "edit": "Editar", "delete": "Eliminar",
    "export": "Exportar", "use": "Usar", "manage": "Gestionar", "close": "Cerrar",
    "generate": "Generar", "liquidate": "Liquidar"
}

MODULE_LABELS = {
    "dashboard": "Dashboard", "clientes": "Clientes (CRM)", "eventos": "Eventos",
    "importar": "Importar Excel", "matching": "Matchmaking", "empleados": "Empleados",
    "nomina": "Nómina", "comisiones": "Comisiones", "ingresos": "Ingresos",
    "gastos": "Gastos", "flujo_caja": "Flujo de Caja", "roles": "Roles de Sistema",
    "usuarios": "Cuentas de Usuario"
}

async def seed_everything():
    async with AsyncSessionLocal() as db:
        print("[SEED] Conectando a la base de datos...")
        await db.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent;"))

        # ── 1. Wipe all tables in order ──────────────────────────────────────
        print("[SEED] Limpiando tablas de base de datos...")
        tables_to_wipe = [
            "payroll_items", "payroll_runs", "employee_event_commissions", 
            "commission_rules", "user_accounts", "role_permissions", "roles", 
            "employees", "income_records", "expense_records", "match_requests", 
            "post_event_feedback", "event_attendees", "events", "profiles", 
            "embeddings", "users", "permissions"
        ]
        for table in tables_to_wipe:
            await db.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
        await db.commit()
        print("[SEED] Base de datos limpia.")

        # ── 2. Create Permissions Catalog ─────────────────────────────────────
        print("[SEED] Creando catálogo de permisos...")
        permission_map = {}
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
                permission_map[(module, action)] = res.scalar()
        print(f"[SEED] Creados {len(permission_map)} permisos.")

        # ── 3. Create Roles ──────────────────────────────────────────────────
        print("[SEED] Creando roles y asignando permisos...")
        
        # 3.1 Admin (System)
        res_admin = await db.execute(text("""
            INSERT INTO roles (name, description, is_system)
            VALUES ('Admin', 'Acceso total y configuración del sistema.', true)
            RETURNING id
        """))
        admin_role_id = res_admin.scalar()
        for perm_id in permission_map.values():
            await db.execute(text("""
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES (:role_id, :perm_id)
            """), {"role_id": admin_role_id, "perm_id": perm_id})

        # 3.2 Ventas
        res_ventas = await db.execute(text("""
            INSERT INTO roles (name, description, is_system)
            VALUES ('Ventas', 'Gestión de clientes y eventos comerciales.', false)
            RETURNING id
        """))
        ventas_role_id = res_ventas.scalar()
        ventas_perms = ["clientes.view", "clientes.create", "clientes.edit",
                        "eventos.view", "eventos.create", "dashboard.view", 
                        "matching.view", "matching.manage", "importar.view", "importar.use"]
        for perm in ventas_perms:
            m, a = perm.split(".")
            await db.execute(text("""
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES (:role_id, :perm_id)
            """), {"role_id": ventas_role_id, "perm_id": permission_map[(m, a)]})

        # 3.3 Finanzas
        res_finanzas = await db.execute(text("""
            INSERT INTO roles (name, description, is_system)
            VALUES ('Finanzas', 'Control contable, flujo de caja y nóminas.', false)
            RETURNING id
        """))
        finanzas_role_id = res_finanzas.scalar()
        finanzas_perms = ["dashboard.view", "ingresos.view", "ingresos.create", "ingresos.edit",
                          "gastos.view", "gastos.create", "gastos.edit", "flujo_caja.view",
                          "nomina.view", "nomina.generate", "nomina.liquidate", "nomina.export",
                          "comisiones.view", "comisiones.manage"]
        for perm in finanzas_perms:
            m, a = perm.split(".")
            await db.execute(text("""
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES (:role_id, :perm_id)
            """), {"role_id": finanzas_role_id, "perm_id": permission_map[(m, a)]})

        # 3.4 Logística
        res_logistica = await db.execute(text("""
            INSERT INTO roles (name, description, is_system)
            VALUES ('Logística', 'Gestión operativa de montaje y check-in en eventos.', false)
            RETURNING id
        """))
        logistica_role_id = res_logistica.scalar()
        logistica_perms = ["dashboard.view", "eventos.view", "eventos.close"]
        for perm in logistica_perms:
            m, a = perm.split(".")
            await db.execute(text("""
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES (:role_id, :perm_id)
            """), {"role_id": logistica_role_id, "perm_id": permission_map[(m, a)]})

        # 3.5 Sin Asignar
        await db.execute(text("""
            INSERT INTO roles (name, description, is_system)
            VALUES ('Sin asignar', 'Empleado registrado sin accesos específicos.', false)
        """))
        
        await db.commit()

        # ── 4. Create Employees ───────────────────────────────────────────────
        print("[SEED] Creando empleados...")
        employees_data = [
            ("María Paula", "Administradora General", "3000000000", "mariapaula@dailylover.co", 5000000.0, "nomina", "2026-01-01"),
            ("Sofía Silva", "Coordinadora de Eventos", "3114445566", "sofia.silva@dailylover.co", 2800000.0, "nomina", "2026-01-15"),
            ("Mateo Restrepo", "Logística y Montaje", "3156667788", "mateo.logistica@dailylover.co", 1800000.0, "prestacion_servicios", "2026-02-01"),
            ("Camila Hoyos", "Comunicaciones y Relaciones", "3108889900", "camila.comms@dailylover.co", 2200000.0, "nomina", "2026-03-10")
        ]
        
        emp_ids = {}
        for name, role, phone, email, base, contract, hire in employees_data:
            res = await db.execute(text("""
                INSERT INTO employees (full_name, role, phone, email, base_salary, contract_type, hire_date, status)
                VALUES (:name, :role, :phone, :email, :base, :contract, :hire, 'active')
                RETURNING id
            """), {
                "name": name, "role": role, "phone": phone, "email": email, 
                "base": base, "contract": contract, "hire": datetime.strptime(hire, "%Y-%m-%d").date()
            })
            emp_ids[name] = res.scalar()
        
        # ── 5. Create User Accounts ───────────────────────────────────────────
        print("[SEED] Creando cuentas de usuario y asociando roles...")
        users_to_create = [
            ("admin@dailylover.co", "admin12345", admin_role_id, emp_ids["María Paula"], False),
            ("sofia@dailylover.co", "sofia2024", ventas_role_id, emp_ids["Sofía Silva"], False),
            ("mateo@dailylover.co", "mateo2024", logistica_role_id, emp_ids["Mateo Restrepo"], False),
            ("camila@dailylover.co", "camila2024", finanzas_role_id, emp_ids["Camila Hoyos"], False),
            ("ventas@dailylover.co", "ventas2024", ventas_role_id, emp_ids["Sofía Silva"], False),
            ("finanzas@dailylover.co", "finanzas2024", finanzas_role_id, emp_ids["Camila Hoyos"], False),
            ("nueva@dailylover.co", "cambiar123", ventas_role_id, emp_ids["Mateo Restrepo"], True)
        ]
        
        for email, pw, role_id, emp_id, must_change in users_to_create:
            hashed = hash_password(pw)
            await db.execute(text("""
                INSERT INTO user_accounts (employee_id, email, password_hash, role_id, status, must_change_password)
                VALUES (:emp_id, :email, :pass, :role_id, 'active', :must_change)
            """), {"emp_id": emp_id, "email": email, "pass": hashed, "role_id": role_id, "must_change": must_change})
        await db.commit()

        # ── 6. Create Commission Rules ────────────────────────────────────────
        print("[SEED] Creando reglas de comisión...")
        # Sofía Silva: 2.0% percentage commission on event revenue
        await db.execute(text("""
            INSERT INTO commission_rules (employee_id, commission_type, value, applies_to, active)
            VALUES (:emp_id, 'percentage', 2.0, 'event', true)
        """), {"emp_id": emp_ids["Sofía Silva"]})
        
        # Mateo Restrepo: 80,000 COP fixed commission per event
        await db.execute(text("""
            INSERT INTO commission_rules (employee_id, commission_type, value, applies_to, active)
            VALUES (:emp_id, 'fixed', 80000.0, 'event', true)
        """), {"emp_id": emp_ids["Mateo Restrepo"]})
        await db.commit()

        # ── 7. Create Clients (Users & Psychographic Profiles) ───────────────
        print("[SEED] Creando 30 clientes con perfiles psicográficos...")
        client_ids = []
        for i in range(30):
            created_at = datetime.now() - timedelta(days=random.randint(15, 100))
            res = await db.execute(text("""
                INSERT INTO users (name, phone, created_at)
                VALUES (:name, :phone, :created_at)
                RETURNING id
            """), {"name": NAMES[i], "phone": PHONES[i], "created_at": created_at})
            u_id = res.scalar()
            client_ids.append(u_id)
            
            ocean = {
                "apertura": round(random.uniform(0.4, 0.95), 2),
                "responsabilidad": round(random.uniform(0.3, 0.95), 2),
                "extroversion": round(random.uniform(0.4, 0.98), 2),
                "amabilidad": round(random.uniform(0.5, 0.95), 2),
                "neuroticismo": round(random.uniform(0.1, 0.55), 2)
            }
            apego = {
                "estilo": random.choice(ATTACHMENTS),
                "intensidad": round(random.uniform(0.2, 0.8), 2)
            }
            
            await db.execute(text("""
                INSERT INTO profiles (user_id, ocean, apego, motivacion, rol_social, energia_social, momento_vital, intereses, valores, raw_answers)
                VALUES (:u_id, :ocean, :apego, :motivacion, :rol_social, :energia_social, :momento_vital, :intereses, :valores, :raw_answers)
            """), {
                "u_id": u_id,
                "ocean": json.dumps(ocean),
                "apego": json.dumps(apego),
                "motivacion": random.choice(MOTIVATIONS),
                "rol_social": random.choice(ROLES_SOCIAL),
                "energia_social": round(random.uniform(0.35, 0.95), 2),
                "momento_vital": random.choice(MOMENTOS),
                "intereses": random.sample(INTERESTS, k=random.randint(2, 5)),
                "valores": random.sample(VALUES, k=random.randint(2, 4)),
                "raw_answers": ["Me encanta conocer gente nueva en entornos activos.", "Busco una relación estable basada en valores compartidos."]
            })
        await db.commit()

        # ── 8. Create Events ──────────────────────────────────────────────────
        print("[SEED] Creando 6 eventos pasados y 2 futuros...")
        events_data = [
            # Past
            ("Speed Dating Chapinero Alto", "2026-01-15 19:30:00", "Chapinero Alto", "Speed Dating", 20, 150000.0),
            ("San Valentín Rooftop", "2026-02-14 20:00:00", "Rooftop Parque 93", "Cocktail Party", 24, 180000.0),
            ("Pádel & Vinos Singles", "2026-03-12 18:30:00", "Club El Rincón", "Social Mixer", 16, 200000.0),
            ("Cena a Ciegas Zona G", "2026-04-15 20:00:00", "Restaurante Vitto", "Dinner Date", 12, 220000.0),
            ("Cocktails & Jazz Chapinero", "2026-05-20 19:30:00", "Bar El Cohete", "Cocktail Party", 20, 130000.0),
            ("Speed Dating Chicó", "2026-06-12 19:00:00", "Club Privado Chicó", "Speed Dating", 20, 150000.0),
            # Future
            ("Singles BBQ Usaquén", "2026-07-18 13:00:00", "Jardín Usaquén", "Social Mixer", 25, 120000.0),
            ("Pádel & Mimosa Mixer", "2026-08-08 10:00:00", "Complejo Pádel 109", "Social Mixer", 16, 180000.0)
        ]
        
        event_records = []
        for idx, (name, dt_str, loc, fmt, cap, price) in enumerate(events_data):
            dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
            res = await db.execute(text("""
                INSERT INTO events (name, date, location, format, capacity, price)
                VALUES (:name, :date, :location, :fmt, :cap, :price)
                RETURNING id
            """), {"name": name, "date": dt, "location": loc, "fmt": fmt, "cap": cap, "price": price})
            
            event_records.append({
                "id": res.scalar(),
                "name": name,
                "date": dt,
                "price": price,
                "is_past": idx < 6
            })
        await db.commit()

        # ── 9. Register Attendees, Feedback, and Matches ──────────────────────
        print("[SEED] Registrando asistencia, feedback y cruces...")
        
        for ev in event_records:
            if ev["is_past"]:
                # Select random 12-16 attendees
                k = random.randint(12, 16)
                attendees = random.sample(client_ids, k=k)
                
                # Insert attendees
                for u_id in attendees:
                    await db.execute(text("""
                        INSERT INTO event_attendees (event_id, user_id, status)
                        VALUES (:ev_id, :u_id, 'attended')
                    """), {"ev_id": ev["id"], "u_id": u_id})
                    
                    # Feedback
                    sat = random.randint(7, 10)
                    conex_pos = []
                    others = [x for x in attendees if x != u_id]
                    likes = random.sample(others, k=random.randint(1, 2))
                    for like_id in likes:
                        phone = (await db.execute(text("SELECT phone FROM users WHERE id = :id"), {"id": like_id})).scalar()
                        conex_pos.append({
                            "descripcion": f"Persona con celular {phone}",
                            "intensidad": "alta",
                            "tipo": "romantico"
                        })
                    await db.execute(text("""
                        INSERT INTO post_event_feedback (event_id, user_id, satisfaccion, conexiones_positivas, conexiones_negativas, raw_text)
                        VALUES (:ev_id, :u_id, :sat, :conex, '{}', 'Me encantó la dinámica y la gente.')
                    """), {"ev_id": ev["id"], "u_id": u_id, "sat": sat, "conex": json.dumps(conex_pos)})
                
                # Match Requests
                for i in range(len(attendees)):
                    for j in range(i+1, len(attendees)):
                        u1, u2 = attendees[i], attendees[j]
                        r = random.random()
                        if r < 0.15: # Mutual Match
                            await db.execute(text("INSERT INTO match_requests (event_id, from_user, to_user, status) VALUES (:ev_id, :u1, :u2, 'accepted') ON CONFLICT DO NOTHING"), {"ev_id": ev["id"], "u1": u1, "u2": u2})
                            await db.execute(text("INSERT INTO match_requests (event_id, from_user, to_user, status) VALUES (:ev_id, :u2, :u1, 'accepted') ON CONFLICT DO NOTHING"), {"ev_id": ev["id"], "u1": u2, "u2": u1})
                        elif r < 0.35: # Pending One-way
                            await db.execute(text("INSERT INTO match_requests (event_id, from_user, to_user, status) VALUES (:ev_id, :u1, :u2, 'pending') ON CONFLICT DO NOTHING"), {"ev_id": ev["id"], "u1": u1, "u2": u2})
            else:
                # Future events (confirmed/pending)
                k = random.randint(8, 12)
                registrants = random.sample(client_ids, k=k)
                for idx_u, u_id in enumerate(registrants):
                    status_att = "confirmed" if idx_u < (k - 3) else "pending"
                    await db.execute(text("""
                        INSERT INTO event_attendees (event_id, user_id, status)
                        VALUES (:ev_id, :u_id, :status)
                    """), {"ev_id": ev["id"], "u_id": u_id, "status": status_att})
        await db.commit()

        # ── 10. Financial Ledger (Jan - Jun 2026) ──────────────────────────────
        print("[SEED] Generando contabilidad de los últimos 6 meses (ingresos y gastos)...")
        # Base monthly values
        base_rent = 1200000.0
        base_mkt = 800000.0
        base_log = 350000.0
        
        # Monthly Memberships
        for m in range(1, 7):
            record_date = date(2026, m, 28)
            month_str = f"2026-{m:02d}"
            
            # Expenses: Rent, Marketing, Logistics
            await db.execute(text("""
                INSERT INTO expense_records (category, description, amount, payment_method, paid_at)
                VALUES ('arriendo', :desc_rent, :rent, 'transferencia', :date),
                       ('marketing', 'Anuncios Meta / Google', :mkt, 'tarjeta', :date),
                       ('logistica', 'Insumos y servicios oficina', :log, 'efectivo', :date)
            """), {
                "desc_rent": f"Arriendo oficina {month_str}", "rent": base_rent,
                "mkt": base_mkt, "log": base_log, "date": record_date
            })
            
            # Income: Memberships
            members_count = random.randint(15, 22)
            amount_mem = members_count * 300000.0
            await db.execute(text("""
                INSERT INTO income_records (category, description, amount, payment_method, received_at)
                VALUES ('membresia', :desc, :amount, 'transferencia', :date)
            """), {"desc": f"Membresías VIP {members_count} clientes - {month_str}", "amount": amount_mem, "date": record_date})
            
            # Other random income
            await db.execute(text("""
                INSERT INTO income_records (category, description, amount, payment_method, received_at)
                VALUES ('otro', :desc, :amount, 'tarjeta', :date)
            """), {"desc": f"Ventas merchandising y extras - {month_str}", "amount": float(random.randint(4, 9) * 100000), "date": record_date})
        
        await db.commit()

        # ── 11. Event Income & Commissions + Payroll Runs (Jan - Jun) ─────────
        print("[SEED] Calculando comisiones e integrando nóminas e ingresos de eventos...")
        
        # We group events by month to generate payrolls and paid commissions
        events_by_month = {m: [] for m in range(1, 7)}
        for ev in event_records:
            if ev["is_past"]:
                events_by_month[ev["date"].month].append(ev)
                
        # Deduction rate
        DEDUCTION_RATE = 0.08
        
        # Active employees timeline:
        # - Jan (month 1): María Paula, Sofía Silva
        # - Feb (month 2): María Paula, Sofía Silva, Mateo Restrepo
        # - Mar to Jun (months 3-6): María Paula, Sofía Silva, Mateo Restrepo, Camila Hoyos
        
        for m in range(1, 7):
            payroll_status = "liquidated" if m < 6 else "draft"
            run_date = date(2026, m, 28)
            liquidated_at = (run_date + timedelta(days=2)) if payroll_status == "liquidated" else None
            
            # Calculate event revenues and insert event income records
            monthly_commissions = {
                emp_ids["Sofía Silva"]: 0.0,
                emp_ids["Mateo Restrepo"]: 0.0
            }
            
            for ev in events_by_month[m]:
                # Get attendee count
                count_res = await db.execute(text("SELECT COUNT(*) FROM event_attendees WHERE event_id = :ev_id"), {"ev_id": ev["id"]})
                att_count = count_res.scalar()
                revenue = att_count * ev["price"]
                
                # Insert Event Income
                await db.execute(text("""
                    INSERT INTO income_records (event_id, category, description, amount, payment_method, received_at)
                    VALUES (:ev_id, 'inscripcion', :desc, :amount, 'transferencia', :date)
                """), {"ev_id": ev["id"], "desc": f"Recaudo {ev['name']}", "amount": revenue, "date": ev["date"].date()})
                
                # Calculate Sofia's Commission (2% of revenue)
                sofia_comm = round(revenue * 0.02, 2)
                monthly_commissions[emp_ids["Sofía Silva"]] += sofia_comm
                await db.execute(text("""
                    INSERT INTO employee_event_commissions (employee_id, event_id, amount, status)
                    VALUES (:emp_id, :ev_id, :amount, :status)
                """), {
                    "emp_id": emp_ids["Sofía Silva"], "ev_id": ev["id"], 
                    "amount": sofia_comm, "status": "paid" if payroll_status == "liquidated" else "pending"
                })
                
                # Calculate Mateo's Commission (Fixed 80k per event)
                monthly_commissions[emp_ids["Mateo Restrepo"]] += 80000.0
                await db.execute(text("""
                    INSERT INTO employee_event_commissions (employee_id, event_id, amount, status)
                    VALUES (:emp_id, :ev_id, 80000.0, :status)
                """), {
                    "emp_id": emp_ids["Mateo Restrepo"], "ev_id": ev["id"], 
                    "status": "paid" if payroll_status == "liquidated" else "pending"
                })
            
            # Active employees in this month
            active_emps = [emp_ids["María Paula"], emp_ids["Sofía Silva"]]
            if m >= 2:
                active_emps.append(emp_ids["Mateo Restrepo"])
            if m >= 3:
                active_emps.append(emp_ids["Camila Hoyos"])
                
            # Create Payroll Run
            run_res = await db.execute(text("""
                INSERT INTO payroll_runs (period_month, period_year, status, total_base, total_commissions, total_deductions, total_paid, liquidated_at, created_at)
                VALUES (:month, 2026, :status, 0, 0, 0, 0, :liq_at, :created_at)
                RETURNING id
            """), {
                "month": m, "status": payroll_status, "liq_at": liquidated_at, 
                "created_at": datetime.combine(run_date, datetime.min.time())
            })
            run_id = run_res.scalar()
            
            tot_base = 0.0
            tot_comm = 0.0
            tot_ded = 0.0
            tot_paid = 0.0
            
            for emp_id in active_emps:
                # Fetch employee base salary
                salary_res = await db.execute(text("SELECT base_salary FROM employees WHERE id = :id"), {"id": emp_id})
                base = float(salary_res.scalar())
                
                # Get commissions
                comm = float(monthly_commissions.get(emp_id, 0.0))
                ded = round(base * DEDUCTION_RATE, 2)
                total = base + comm - ded
                
                tot_base += base
                tot_comm += comm
                tot_ded += ded
                tot_paid += total
                
                await db.execute(text("""
                    INSERT INTO payroll_items (payroll_run_id, employee_id, base_salary, commissions, deductions, total, created_at)
                    VALUES (:run_id, :emp_id, :base, :comm, :ded, :total, NOW())
                """), {"run_id": run_id, "emp_id": emp_id, "base": base, "comm": comm, "ded": ded, "total": total})
            
            # Update Payroll Run totals
            await db.execute(text("""
                UPDATE payroll_runs
                SET total_base = :base, total_commissions = :comm, total_deductions = :ded, total_paid = :total
                WHERE id = :run_id
            """), {"base": tot_base, "comm": tot_comm, "ded": tot_ded, "total": tot_paid, "run_id": run_id})
            
            # If liquidated, insert payroll expense record
            if payroll_status == "liquidated":
                await db.execute(text("""
                    INSERT INTO expense_records (category, description, amount, payment_method, paid_at)
                    VALUES ('nomina', :desc, :amount, 'transferencia', :date)
                """), {
                    "desc": f"Liquidación Nómina Periodo {m}/2026", 
                    "amount": tot_paid, 
                    "date": run_date
                })
        
        await db.commit()
        print("[SEED] ¡Base de datos de demostración sembrada por completo y con éxito!")

if __name__ == "__main__":
    asyncio.run(seed_everything())
