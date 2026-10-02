"""Exige sesion en todo un router. Las llamadas internas (curl desde el propio contenedor, crons) pasan sin token
solo si vienen de loopback y NO traen X-Forwarded-For (las que llegan por el proxy siempre lo traen)."""
from typing import Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_current_user
from app.database import get_db

_bearer = HTTPBearer(auto_error=False)


async def exigir_sesion(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> None:
    host = request.client.host if request.client else ""
    if host in ("127.0.0.1", "::1") and "x-forwarded-for" not in request.headers:
        return None
    if credentials is None:
        raise HTTPException(status_code=401, detail="Inicia sesión para continuar.")
    await get_current_user(credentials, db)
    return None
