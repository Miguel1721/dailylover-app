import asyncio
import argparse
import random
import json
from datetime import datetime, timedelta
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.config import get_settings

settings = get_settings()

# Colombian Names and Data for seeding
NAMES = [
    "Andrés Mendoza", "Valentina Gómez", "Santiago Restrepo", "Mariana Córdoba",
    "Juan David Castro", "Camila Echeverry", "Mateo Pinzón", "Gabriela Rojas",
    "Felipe Londoño", "Isabella Duarte", "Sebastián Ortiz", "Daniela Vargas",
    "Alejandro Ruiz", "Sofía Henao", "Nicolás Torres", "Manuela Jaramillo",
    "Juliana Cardona", "Diego Montoya", "Carolina Silva", "Esteban Marín"
]

PHONES = [
    "+573151111111", "+573002222222", "+573103333333", "+573124444444",
    "+573205555555", "+573166666666", "+573177777777", "+573188888888",
    "+573199999999", "+573110000000", "+573211111111", "+573222222222",
    "+573233333333", "+573244444444", "+573155555555", "+573166666667",
    "+573177777778", "+573188888889", "+573199999990", "+573100000001"
]

EMAILS = [
    "andres.m@gmail.com", "vale.g@gmail.com", "santi.r@outlook.com", "mariana.c@gmail.com",
    "jd.castro@gmail.com", "camila.e@gmail.com", "mateo.p@gmail.com", "gaby.rojas@gmail.com",
    "felipe.l@gmail.com", "isa.duarte@gmail.com", "sebas.o@gmail.com", "danivargas@gmail.com",
    "alejo.ruiz@gmail.com", "sofia.henao@gmail.com", "nico.torres@gmail.com", "manu.jara@gmail.com",
    "juli.cardona@gmail.com", "diego.m@gmail.com", "caro.silva@gmail.com", "esteban.m@gmail.com"
]

MOTIVATIONS = ["exploracion", "conexion_profunda", "validacion", "diversion"]
ATTACHMENTS = ["seguro", "ansioso", "evitativo"]
ROLES = ["lider", "mediador", "oyente", "dinamizador"]
MOMENTOS = ["explorando", "listo_vinculo", "consolidado", "transitando"]

INTERESTS = ["Padel", "Cocina", "Libros", "Senderismo", "Cine", "Vinos", "Viajes", "Fotografía", "Café", "Yoga", "Música en vivo", "Baile"]
VALUES = ["Honestidad", "Lealtad", "Crecimiento", "Libertad", "Empatía", "Aventura", "Familia"]

async def seed_data(reset: bool = False):
    async with AsyncSessionLocal() as db:
        print("[SEED] Conectado a la base de datos.")
        
        if reset:
            print("[SEED] Reseteando tablas del sistema...")
            # We wipe the tables in correct foreign key order
            tables_to_wipe = [
                "payroll_items", "payroll_runs", "employee_event_commissions", "commission_rules", "employees",
                "income_records", "expense_records", "match_requests", "post_event_feedback", "event_attendees",
                "events", "profiles", "embeddings", "users"
            ]
            for table in tables_to_wipe:
                await db.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
            await db.commit()
            print("[SEED] Reset completado.")

        # Check if users already exist
        user_count = (await db.execute(text("SELECT COUNT(*) FROM users"))).scalar() or 0
        if user_count > 0:
            print("[SEED] La base de datos ya contiene registros. Omite o usa --reset.")
            return

        # 1. Insert Employees
        print("[SEED] Creando empleados...")
        emp_ids = []
        employees_data = [
            ("Sofía Silva", "Coordinadora de Eventos", "3114445566", "sofia.silva@dailylover.co", 2800000, "nomina", "2026-01-15"),
            ("Mateo Restrepo", "Logística y Montaje", "3156667788", "mateo.logistica@dailylover.co", 1800000, "prestacion_servicios", "2026-02-01"),
            ("Camila Hoyos", "Comunicaciones y Relaciones", "3108889900", "camila.comms@dailylover.co", 2200000, "nomina", "2026-03-10")
        ]
        
        for name, role, phone, email, base, contract, hire in employees_data:
            res = await db.execute(text("""
                INSERT INTO employees (full_name, role, phone, email, base_salary, contract_type, hire_date, status)
                VALUES (:name, :role, :phone, :email, :base, :contract, :hire, 'active')
                RETURNING id
            """), {"name": name, "role": role, "phone": phone, "email": email, "base": base, "contract": contract, "hire": datetime.strptime(hire, "%Y-%m-%d").date()})
            emp_ids.append(res.scalar())
        
        # 2. Insert Commission Rules
        print("[SEED] Creando reglas de comisiones...")
        # Sofia Silva -> 2% percentage commission on event revenue
        await db.execute(text("""
            INSERT INTO commission_rules (employee_id, commission_type, value, applies_to, active)
            VALUES (:emp_id, 'percentage', 2.0, 'event', true)
        """), {"emp_id": emp_ids[0]})
        
        # Mateo Restrepo -> 80,000 COP fixed commission per event
        await db.execute(text("""
            INSERT INTO commission_rules (employee_id, commission_type, value, applies_to, active)
            VALUES (:emp_id, 'fixed', 80000.0, 'event', true)
        """), {"emp_id": emp_ids[1]})

        # 3. Insert Users & Profiles
        print("[SEED] Creando usuarios y perfiles psicográficos...")
        user_ids = []
        for i in range(20):
            # Create user
            res = await db.execute(text("""
                INSERT INTO users (name, phone, created_at)
                VALUES (:name, :phone, :created_at)
                RETURNING id
            """), {"name": NAMES[i], "phone": PHONES[i], "created_at": datetime.now() - timedelta(days=random.randint(10, 60))})
            u_id = res.scalar()
            user_ids.append(u_id)
            
            # Create profile
            ocean = {
                "apertura": round(random.uniform(0.4, 0.95), 2),
                "responsabilidad": round(random.uniform(0.3, 0.9), 2),
                "extroversion": round(random.uniform(0.5, 0.98), 2),
                "amabilidad": round(random.uniform(0.4, 0.95), 2),
                "neuroticismo": round(random.uniform(0.1, 0.6), 2)
            }
            apego = {
                "estilo": random.choice(ATTACHMENTS),
                "intensidad": round(random.uniform(0.2, 0.8), 2)
            }
            motivacion = random.choice(MOTIVATIONS)
            rol_social = random.choice(ROLES)
            energia_social = round(random.uniform(0.3, 0.95), 2)
            momento_vital = random.choice(MOMENTOS)
            intereses = random.sample(INTERESTS, k=random.randint(2, 5))
            valores = random.sample(VALUES, k=random.randint(2, 4))
            raw_answers = ["Respuesta simulada 1", "Respuesta simulada 2"]
            
            await db.execute(text("""
                INSERT INTO profiles (user_id, ocean, apego, motivacion, rol_social, energia_social, momento_vital, intereses, valores, raw_answers)
                VALUES (:u_id, :ocean, :apego, :motivacion, :rol_social, :energia_social, :momento_vital, :intereses, :valores, :raw_answers)
            """), {
                "u_id": u_id,
                "ocean": json.dumps(ocean),
                "apego": json.dumps(apego),
                "motivacion": motivacion,
                "rol_social": rol_social,
                "energia_social": energia_social,
                "momento_vital": momento_vital,
                "intereses": intereses,
                "valores": valores,
                "raw_answers": raw_answers
            })

        # 4. Insert Events
        print("[SEED] Creando eventos...")
        event_ids = []
        events_data = [
            ("Speed Dating - Rooftop Bogotá", datetime.now() - timedelta(days=14), "Chapinero Alto", "Speed Dating", 20, 150000.0),
            ("Pádel & Vinos", datetime.now() - timedelta(days=7), "Club El Rincón", "Social Mixer", 16, 180000.0),
            ("Cena a Ciegas - Zona G", datetime.now() - timedelta(days=3), "Restaurante Vitto", "Dinner Date", 12, 220000.0),
            ("Cocktail Night - Chapinero", datetime.now() + timedelta(days=7), "Bar El Cohete", "Cocktail Party", 25, 120000.0)
        ]
        
        for name, dt, location, fmt, cap, price in events_data:
            res = await db.execute(text("""
                INSERT INTO events (name, date, location, format, capacity, price)
                VALUES (:name, :date, :location, :fmt, :cap, :price)
                RETURNING id
            """), {"name": name, "date": dt, "location": location, "fmt": fmt, "cap": cap, "price": price})
            event_ids.append(res.scalar())

        # 5. Insert Event Attendees
        print("[SEED] Registrando asistencia de usuarios a eventos...")
        for ev_id in event_ids[:-1]:  # Past events
            # select 12 random users for each past event
            selected_users = random.sample(user_ids, k=12)
            for u_id in selected_users:
                await db.execute(text("""
                    INSERT INTO event_attendees (event_id, user_id, status)
                    VALUES (:ev_id, :u_id, 'attended')
                """), {"ev_id": ev_id, "u_id": u_id})
                
        # Future event has pending/confirmed attendees
        selected_users_future = random.sample(user_ids, k=10)
        for u_id in selected_users_future[:6]:
            await db.execute(text("""
                INSERT INTO event_attendees (event_id, user_id, status)
                VALUES (:ev_id, :u_id, 'confirmed')
            """), {"ev_id": event_ids[-1], "u_id": u_id})
        for u_id in selected_users_future[6:]:
            await db.execute(text("""
                INSERT INTO event_attendees (event_id, user_id, status)
                VALUES (:ev_id, :u_id, 'pending')
            """), {"ev_id": event_ids[-1], "u_id": u_id})

        # 6. Insert Feedbacks and Match Requests for past events
        print("[SEED] Creando feedback de eventos y match requests...")
        for ev_id in event_ids[:-1]:
            # Get attendees
            attendees_res = await db.execute(text("SELECT user_id FROM event_attendees WHERE event_id = :ev_id AND status = 'attended'"), {"ev_id": ev_id})
            attendees = [r.user_id for r in attendees_res.fetchall()]
            
            # Insert feedback
            for u_id in attendees:
                satisfaccion = random.randint(7, 10)
                # target 1 or 2 positive connections description
                conex_pos = []
                potential_likes = [a for a in attendees if a != u_id]
                likes = random.sample(potential_likes, k=random.randint(1, 2))
                for l_id in likes:
                    like_phone = (await db.execute(text("SELECT phone FROM users WHERE id = :l_id"), {"l_id": l_id})).scalar()
                    conex_pos.append({
                        "descripcion": f"Persona con celular {like_phone}",
                        "intensidad": "alta",
                        "tipo": "romantico"
                    })
                
                await db.execute(text("""
                    INSERT INTO post_event_feedback (event_id, user_id, satisfaccion, conexiones_positivas, conexiones_negativas, raw_text)
                    VALUES (:ev_id, :u_id, :sat, :conex, '{}', 'Disfruté el evento, fue grandioso.')
                """), {"ev_id": ev_id, "u_id": u_id, "sat": satisfaccion, "conex": json.dumps(conex_pos)})
            
            # Create match requests (cross matches!)
            for i in range(len(attendees)):
                for j in range(i+1, len(attendees)):
                    u1 = attendees[i]
                    u2 = attendees[j]
                    
                    # 10% chance of mutual match (accepted)
                    # 20% chance of one-way match (pending)
                    r_val = random.random()
                    if r_val < 0.15:
                        # Mutual Accepted
                        await db.execute(text("""
                            INSERT INTO match_requests (event_id, from_user, to_user, status)
                            VALUES (:ev_id, :u1, :u2, 'accepted')
                            ON CONFLICT DO NOTHING
                        """), {"ev_id": ev_id, "u1": u1, "u2": u2})
                        await db.execute(text("""
                            INSERT INTO match_requests (event_id, from_user, to_user, status)
                            VALUES (:ev_id, :u2, :u1, 'accepted')
                            ON CONFLICT DO NOTHING
                        """), {"ev_id": ev_id, "u1": u2, "u2": u1})
                    elif r_val < 0.35:
                        # One way pending
                        await db.execute(text("""
                            INSERT INTO match_requests (event_id, from_user, to_user, status)
                            VALUES (:ev_id, :u1, :u2, 'pending')
                            ON CONFLICT DO NOTHING
                        """), {"ev_id": ev_id, "u1": u1, "u2": u2})

        # 7. Insert Financial Data for past 6 months (flujo de caja chart)
        print("[SEED] Generando historial financiero (ingresos y gastos de los últimos 6 meses)...")
        # Jan to Jun 2026
        # Monthly base expenses: Arriendo (1,200,000), Marketing (800,000), Logistica (500,000), Nomina (4,600,000)
        # Monthly income: Membresias (15 x 300,000), Inscripciones eventos (various)
        today = datetime.now().date()
        for m in range(1, 7):
            record_date = today - timedelta(days=30 * m)
            month_str = record_date.strftime("%Y-%m")
            
            # Base Expenses
            await db.execute(text("""
                INSERT INTO expense_records (category, description, amount, payment_method, paid_at)
                VALUES ('arriendo', :desc, 1200000.0, 'transferencia', :p_date),
                       ('marketing', 'Publicidad Facebook/Insta', 800000.0, 'tarjeta', :p_date),
                       ('logistica', 'Papelería e insumos', 350000.0, 'efectivo', :p_date)
            """), {"desc": f"Arriendo oficina {month_str}", "p_date": record_date})
            
            # Nomina Expense
            await db.execute(text("""
                INSERT INTO expense_records (category, description, amount, payment_method, paid_at)
                VALUES ('nomina', :desc, 5000000.0, 'transferencia', :p_date)
            """), {"desc": f"Nómina personal {month_str}", "p_date": record_date})
            
            # Income
            await db.execute(text("""
                INSERT INTO income_records (category, description, amount, payment_method, received_at)
                VALUES ('membresia', :desc, 4500000.0, 'transferencia', :r_date),
                       ('otro', 'Venta merchandising y extras', 600000.0, 'transferencia', :r_date)
            """), {"desc": f"Suscripciones VIP {month_str}", "r_date": record_date})

        # Close the past events to generate event income and commissions
        # Event 1: Revenue = 150,000 * 12 = 1,800,000
        # Event 2: Revenue = 180,000 * 12 = 2,160,000
        # Event 3: Revenue = 220,000 * 12 = 2,640,000
        event_revenues = [1800000.0, 2160000.0, 2640000.0]
        for idx, ev_id in enumerate(event_ids[:-1]):
            revenue = event_revenues[idx]
            event_name = events_data[idx][0]
            
            # Record Income
            await db.execute(text("""
                INSERT INTO income_records (event_id, category, description, amount, payment_method, received_at)
                VALUES (:ev_id, 'inscripcion', :desc, :amount, 'transferencia', :date)
            """), {"ev_id": ev_id, "desc": f"Recaudo {event_name}", "amount": revenue, "date": events_data[idx][1].date()})
            
            # Record Commissions
            # Sofia Rule -> 2% of revenue
            sofia_comm = round(revenue * 0.02, 2)
            await db.execute(text("""
                INSERT INTO employee_event_commissions (employee_id, event_id, amount, status)
                VALUES (:emp_id, :ev_id, :amount, 'pending')
            """), {"emp_id": emp_ids[0], "ev_id": ev_id, "amount": sofia_comm})
            
            # Mateo Rule -> Fixed 80,000 COP
            await db.execute(text("""
                INSERT INTO employee_event_commissions (employee_id, event_id, amount, status)
                VALUES (:emp_id, :ev_id, 80000.0, 'pending')
            """), {"emp_id": emp_ids[1], "ev_id": ev_id})

        await db.commit()
        print("[SEED] ¡Seembra de base de datos de demostración completada de forma exitosa!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed database for demo.")
    parser.add_argument("--reset", action="store_true", help="Reset all database tables before seeding.")
    args = parser.parse_args()
    
    asyncio.run(seed_data(reset=args.reset))
