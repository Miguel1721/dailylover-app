from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from app.config import get_settings, Settings
from app.routers import admin, import_excel, auth, employees, commissions, payroll, finance, roles, user_accounts, incidents, vendors, reports, client, webhooks, cms_public, cms_admin, matchmaking
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

