# NightPulse AI — Task List

## Phase 1: Infrastructure
- [x] Create project directory structure (`nightpulse/`)
- [x] Create `docker-compose.yml` (PostgreSQL, Redis, FastAPI, Celery, Frontend)
- [x] Create `.env` with configuration
- [x] Create `db/init.sql` with complete schema
- [x] Create `db/seed.sql` with demo data for 5 Evedesa brands
- [x] Create Traefik labels for `nightpulse.agentesia.cloud`

## Phase 2: Backend (FastAPI)
- [x] `backend/Dockerfile`
- [x] `backend/requirements.txt`
- [x] `backend/app/main.py` — FastAPI app with CORS, routes
- [x] `backend/app/config.py` — Settings
- [x] `backend/app/database.py` — Async SQLAlchemy
- [x] Models: brand, venue, inventory, cash, staff, customer, reservation, event, compliance (handled via raw queries)
- [x] Router: `dashboard.py` — KPIs consolidados
- [x] Router: `inventory.py` — Control de inventario + mermas
- [x] Router: `cash_register.py` — Cierre de caja + anomalías
- [x] Router: `staff.py` — Turnos + recargos
- [x] Router: `crm.py` — Clientes + reservas
- [x] Router: `analytics.py` — Rentabilidad + insights
- [x] Router: `compliance.py` — Checklists regulatorios
- [x] Router: `auth.py` — Autenticación JWT
- [x] Service: `ai_service.py` — Generación de insights con IA
- [x] Service: `forecast.py` — Predicción de demanda
- [x] Service: `anomaly.py` — Detección de anomalías
- [x] `seed/demo_data.py` — Datos simulados de 5 marcas Evedesa

## Phase 3: Frontend (React + Vite)
- [x] `frontend/package.json` + Vite config
- [x] `frontend/index.html`
- [x] `frontend/src/index.css` — Design system oscuro/premium
- [x] `frontend/src/main.jsx`
- [x] `frontend/src/App.jsx` — Router + Layout
- [x] Component: `Sidebar.jsx`
- [x] Component: `KPICard.jsx`
- [x] Component: `AlertBanner.jsx`
- [x] Component: `BrandSelector.jsx`
- [x] Component: `AIInsightCard.jsx`
- [x] Page: `Dashboard.jsx` — Landing ejecutivo
- [x] Page: `Inventory.jsx` — Control de inventario
- [x] Page: `CashRegister.jsx` — Cierre de caja
- [x] Page: `Staff.jsx` — Gestión de personal
- [x] Page: `CRM.jsx` — CRM + reservas
- [x] Page: `Analytics.jsx` — Analytics + IA
- [x] Page: `Compliance.jsx` — Cumplimiento
- [x] Landing page de presentación con calculadora ROI

## Phase 4: Deploy
- [x] Configure DNS/Paths for `prueba-daily.agentesia.cloud/dashboard/`
- [x] SCP project to server
- [x] Docker compose up
- [x] Verify all endpoints
- [x] Verify Daily Lover still works
- [x] Seed demo data
- [x] Take screenshots / write walkthrough
