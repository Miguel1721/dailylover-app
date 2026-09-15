from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from app.config import get_settings, Settings
from app.routers import admin, import_excel, auth, employees, commissions, payroll, finance, roles, user_accounts, incidents, vendors, reports, client, webhooks, cms_public, cms_admin, matchmaking, scheduling
import structlog
import os

# Initialize structured logging
logger = structlog.get_logger()

# Load settings
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Backend orquestador para Daily Lover - CRM, Panel Admin y Matching con IA"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ATRASADOS_ALLOWED_PREFIXES = (
    "/api/v1/auth/me",
    "/api/v1/auth/logout",
    "/api/v1/config",
    "/api/v1/matchmaking/agosto27-queue",
    "/api/v1/matchmaking/agosto27-discard",
    "/api/v1/matchmaking/approve-interview-match",
    "/api/v1/matchmaking/matches-atrasados",
    "/api/v1/matchmaking/matches",
    "/api/v1/matchmaking/restaurants",
    "/api/v1/matchmaking/recent-extended-clients",
    "/api/v1/matchmaking/schedule-match",
    "/api/v1/matchmaking/update-stage",
    "/docs",
    "/openapi.json",
    "/favicon.ico"
)

# ─── GUARDA DE SEGURIDAD PARA ROL RESTRINGIDO (MARÍA ATRASADOS) ──────────────
@app.middleware("http")
async def atrasados_role_guard(request, call_next):
    path = request.url.path
    if path.startswith("/api/"):
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            try:
                from app.services.auth_service import decode_token
                payload = decode_token(token)
                if payload and payload.get("role_id"):
                    atrasados_id = getattr(request.app.state, "atrasados_role_id", "5c528b9d-f2de-4e85-a03e-2ee2798e2da0")
                    if str(payload.get("role_id")) == str(atrasados_id):
                        if not any(path.startswith(prefix) for prefix in ATRASADOS_ALLOWED_PREFIXES):
                            from fastapi.responses import JSONResponse
                            return JSONResponse(
                                status_code=403,
                                content={"detail": "Acceso restringido: este usuario solo tiene acceso a la Cola de Atrasados y Matches Atrasados."}
                            )
            except Exception:
                pass
    return await call_next(request)

# ─── CIBERSEGURIDAD: SECURITY HEADERS MIDDLEWARE ─────────────────────────────
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# ─── API ROUTES ───────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_seed():
    """Ensure system roles and admin user account exist for María Paula."""
    try:
        from app.database import AsyncSessionLocal
        from app.services.auth_service import hash_password
        from sqlalchemy import text
        async with AsyncSessionLocal() as db:
            # Ensure admin role
            await db.execute(text("""
                INSERT INTO roles (name, is_system) VALUES ('Super Admin', true)
                ON CONFLICT (name) DO NOTHING;
            """))
            # Ensure atrasados_only role and cache ID
            await db.execute(text("""
                INSERT INTO roles (name, is_system) VALUES ('atrasados_only', false)
                ON CONFLICT (name) DO NOTHING;
            """))
            r_atrasados = await db.execute(text("SELECT id FROM roles WHERE name = 'atrasados_only'"))
            atrasados_row = r_atrasados.scalar()
            if atrasados_row:
                app.state.atrasados_role_id = str(atrasados_row)

            # Ensure maria.atrasados user account
            h_atrasados = hash_password('MariaAtrasados2026!*')
            await db.execute(text("""
                INSERT INTO user_accounts (email, password_hash, role_id, status, must_change_password)
                VALUES ('maria.atrasados@dailylover.com', :pass, :rid, 'active', false)
                ON CONFLICT (email) DO UPDATE SET password_hash = :pass, role_id = :rid;
            """), {'pass': h_atrasados, 'rid': atrasados_row})

            h_pass = hash_password('Daily2026!')
            # Ensure Maria Paula in user_accounts
            await db.execute(text("""
                INSERT INTO user_accounts (email, password_hash, status, must_change_password)
                VALUES ('mariapaula@dailylover.com', :pass, 'active', false)
                ON CONFLICT (email) DO UPDATE SET password_hash = :pass;
            """), {'pass': h_pass})
            # Ensure tables webhook_events_raw and client_notes exist
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS webhook_events_raw (
                    id SERIAL PRIMARY KEY,
                    source VARCHAR(50) NOT NULL DEFAULT 'smartmatchapp',
                    event_type VARCHAR(100),
                    payload JSONB NOT NULL,
                    processed BOOLEAN DEFAULT FALSE,
                    error_log TEXT,
                    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """))
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS client_notes (
                    id SERIAL PRIMARY KEY,
                    user_id INT REFERENCES users(id) ON DELETE CASCADE,
                    note TEXT NOT NULL,
                    source VARCHAR(50) DEFAULT 'smartmatchapp',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """))
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS client_images (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    s3_key_main VARCHAR(500) NOT NULL,
                    s3_key_thumb VARCHAR(500) NOT NULL,
                    is_primary BOOLEAN DEFAULT FALSE,
                    original_filename VARCHAR(300),
                    width INTEGER,
                    height INTEGER,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """))
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_client_images_user_id ON client_images(user_id);
            """))
            await db.execute(text("""
                ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);
            """))
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS client_extended_profile (
                    id SERIAL PRIMARY KEY,
                    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    crm_id VARCHAR(50),
                    social_group_score NUMERIC(3,1),
                    education_level INT,
                    mobility_travel INT,
                    physical_activity_level INT,
                    social_energy_level INT,
                    life_structure_level INT,
                    weekend_style TEXT[],
                    religion_importance INT,
                    political_self_placement VARCHAR(20),
                    kids_importance INT,
                    traditionalism_level INT,
                    punctuality VARCHAR(50),
                    presentation_camera BOOLEAN,
                    presentation_style VARCHAR(50),
                    presentation_background VARCHAR(50),
                    speaking_confidence INT,
                    conversation_lead INT,
                    emotional_processing INT,
                    months_single INT,
                    self_awareness INT,
                    love_language_given VARCHAR(50),
                    love_language_received VARCHAR(50),
                    love_language_flexibility INT,
                    non_negotiables JSONB,
                    physical_complexion TEXT[],
                    physical_importance INT,
                    physical_traits_notes TEXT,
                    behavioral_risk_level INT,
                    flags_notes TEXT,
                    synthesis_who_really_is VARCHAR(250),
                    synthesis_first_date_behavior VARCHAR(250),
                    synthesis_best_match_type VARCHAR(250),
                    attachment_style VARCHAR(50),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_by VARCHAR(100)
                )
            """))
            await db.execute(text("ALTER TABLE client_extended_profile ADD COLUMN IF NOT EXISTS attachment_style VARCHAR(50)"))
            await db.execute(text("CREATE INDEX IF NOT EXISTS idx_client_ext_user_id ON client_extended_profile(user_id)"))
            await db.execute(text("CREATE INDEX IF NOT EXISTS idx_client_ext_crm_id ON client_extended_profile(crm_id)"))

            # Ensure tables for Agosto 27 AI Matchmaking Pipeline
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS august27_ai_match_proposals (
                    id SERIAL PRIMARY KEY,
                    sheet_row INT,
                    client_name TEXT,
                    client_user_id INT,
                    client_crm_id TEXT,
                    dates_pend TEXT,
                    responsable TEXT,
                    candidate_name TEXT,
                    candidate_user_id INT,
                    candidate_crm_id TEXT,
                    punctuation TEXT,
                    status TEXT,
                    points_to_consider TEXT,
                    strong_points TEXT,
                    decision TEXT DEFAULT 'pending',
                    decided_at TIMESTAMP WITH TIME ZONE,
                    decided_by TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            await db.execute(text("CREATE INDEX IF NOT EXISTS idx_aug27_client_uid ON august27_ai_match_proposals(client_user_id)"))
            await db.execute(text("CREATE INDEX IF NOT EXISTS idx_aug27_decision ON august27_ai_match_proposals(decision)"))
            await db.execute(text("ALTER TABLE august27_ai_match_proposals ADD COLUMN IF NOT EXISTS decision TEXT DEFAULT 'pending'"))
            await db.execute(text("ALTER TABLE august27_ai_match_proposals ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP WITH TIME ZONE"))
            await db.execute(text("ALTER TABLE august27_ai_match_proposals ADD COLUMN IF NOT EXISTS decided_by TEXT"))

            # Ensure batch_tag in operational_matches
            await db.execute(text("ALTER TABLE operational_matches ADD COLUMN IF NOT EXISTS batch_tag TEXT"))
            await db.execute(text("CREATE INDEX IF NOT EXISTS idx_operational_matches_batch_tag ON operational_matches(batch_tag)"))

            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS august27_unmatched_clients (
                    id SERIAL PRIMARY KEY,
                    sheet_row INT,
                    sheet_name TEXT,
                    clean_name TEXT,
                    dates_pend TEXT,
                    responsable TEXT,
                    nota TEXT,
                    reason TEXT DEFAULT 'No encontrado en base de datos',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            await db.commit()


    except Exception as e:
        logger.warning(f"Startup seed warning: {e}")


@app.get("/api/health", tags=["Health"])
async def health_check():
    """Endpoint de monitoreo de salud para Traefik y despliegue continuo."""
    return {"status": "ok", "app": settings.app_name}
@app.get("/", include_in_schema=False)
async def root():
    """Redirect root path to the admin panel."""
    return RedirectResponse(url="/admin/")


@app.get("/api/v1/config", tags=["Config"])
async def get_config():
    """Retorna configuraciones públicas del backend (ej: si está activo el modo demo)."""
    return {"demo_mode": settings.demo_mode}

# Register admin and import routers
app.include_router(auth.router)
app.include_router(cms_public.router)
app.include_router(cms_admin.router)
app.include_router(client.router)
app.include_router(admin.router)
app.include_router(import_excel.router)
app.include_router(employees.router)
app.include_router(commissions.router)
app.include_router(payroll.router)
app.include_router(finance.router)
app.include_router(roles.router)
app.include_router(user_accounts.router)
app.include_router(incidents.router)
app.include_router(vendors.router)
app.include_router(reports.router)
app.include_router(webhooks.router)
app.include_router(matchmaking.router)
app.include_router(scheduling.router)

# ─── STATIC FILES (Admin Panel & App Preview) ─────────────────────────────────

ADMIN_STATIC = os.path.join(os.path.dirname(__file__), "static", "admin")
APP_PREVIEW_STATIC = os.path.join(os.path.dirname(__file__), "static", "app-preview")
UPLOADS_STATIC = os.path.join(os.path.dirname(__file__), "static", "uploads")
os.makedirs(UPLOADS_STATIC, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=UPLOADS_STATIC), name="static_uploads")
FAVICON_PATH = os.path.join(APP_PREVIEW_STATIC, "favicon.svg")

@app.get("/login", include_in_schema=False)
async def login_redirect():
    """Redirect /login to /admin/login."""
    return RedirectResponse(url="/admin/login")

@app.get("/favicon.ico", include_in_schema=False)
@app.get("/favicon.svg", include_in_schema=False)
@app.get("/admin/favicon.svg", include_in_schema=False)
async def serve_favicon():
    """Serve favicon SVG or return 204 if missing."""
    if os.path.isfile(FAVICON_PATH):
        return FileResponse(FAVICON_PATH, media_type="image/svg+xml")
    return Response(status_code=204)

if os.path.isdir(ADMIN_STATIC):
    # Mount static assets (JS, CSS, etc.)
    app.mount("/admin/assets", StaticFiles(directory=os.path.join(ADMIN_STATIC, "assets")), name="admin_assets")

    @app.get("/admin", include_in_schema=False)
    @app.get("/admin/", include_in_schema=False)
    @app.get("/admin/{path:path}", include_in_schema=False)
    async def serve_admin(path: str = ""):
        """Serve the React admin SPA — all routes fall back to index.html."""
        index = os.path.join(ADMIN_STATIC, "index.html")
        if os.path.isfile(index):
            return FileResponse(index, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
        return {"error": "Admin panel not built yet. Run npm run build in frontend/admin/"}

if os.path.isdir(APP_PREVIEW_STATIC):
    # Mount static assets (JS, CSS, etc.)
    app.mount("/app-preview/assets", StaticFiles(directory=os.path.join(APP_PREVIEW_STATIC, "assets")), name="app_preview_assets")

    @app.get("/app-preview", include_in_schema=False)
    @app.get("/app-preview/", include_in_schema=False)
    @app.get("/app-preview/{path:path}", include_in_schema=False)
    async def serve_app_preview(path: str = ""):
        """Serve the React app preview SPA — all routes fall back to index.html."""
        index = os.path.join(APP_PREVIEW_STATIC, "index.html")
        if os.path.isfile(index):
            return FileResponse(index, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
        return {"error": "App preview not built yet. Run npm run build in frontend/app-preview/"}

