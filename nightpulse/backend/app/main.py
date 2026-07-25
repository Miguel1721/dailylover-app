from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from app.config import get_settings
from app.routers import auth, brands, dashboard, inventory, cash_register, staff, crm, analytics, compliance, alerts
import structlog
import os

logger = structlog.get_logger()
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Backend orquestador para NightPulse AI — Control y analítica de discotecas"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[s.strip() for s in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API ROUTES ───────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["Health"])
async def health_check():
    """Endpoint de monitoreo de salud."""
    return {"status": "ok", "app": settings.app_name}

@app.get("/", include_in_schema=False)
async def root():
    """Redirect root path to the frontend dashboard."""
    return RedirectResponse(url="/dashboard/")

# Register Routers
app.include_router(auth.router)
app.include_router(brands.router)
app.include_router(dashboard.router)
app.include_router(inventory.router)
app.include_router(cash_register.router)
app.include_router(staff.router)
app.include_router(crm.router)
app.include_router(analytics.router)
app.include_router(compliance.router)
app.include_router(alerts.router)

# ─── STATIC FILES (Frontend Client App SPA) ───────────────────────────────────

# In Docker container, static frontend is compiled to app/static/frontend/ or backend/app/static/frontend/
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static", "frontend")

if os.path.isdir(STATIC_DIR):
    # Mount static assets directory
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/dashboard/assets", StaticFiles(directory=assets_dir), name="frontend_assets")

    @app.get("/dashboard", include_in_schema=False)
    @app.get("/dashboard/", include_in_schema=False)
    @app.get("/dashboard/{path:path}", include_in_schema=False)
    async def serve_frontend(path: str = ""):
        """Serve the React app SPA — all routes fall back to index.html."""
        index_file = os.path.join(STATIC_DIR, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
        return {"error": f"Frontend build not found at {STATIC_DIR}. Please build the frontend."}
else:
    # If the directory doesn't exist yet, we still configure the fallback
    @app.get("/dashboard", include_in_schema=False)
    async def serve_frontend_missing():
        return {"error": f"Static directory {STATIC_DIR} does not exist. Frontend needs to be built."}
