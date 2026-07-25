from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.services.auth_service import decode_token

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> dict:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )
    
    user_id_str = str(payload["sub"])
    
    if user_id_str.isdigit():
        client_res = await db.execute(text("SELECT id, name, phone FROM users WHERE id = :user_id"), {"user_id": int(user_id_str)})
        client = client_res.fetchone()
        if not client:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Perfil de cliente no encontrado"
            )
        return {
            "id": client.id,
            "name": client.name,
            "phone": client.phone,
            "is_client": True,
            "permissions": ["client.view"]
        }
    
    # Query admin user account details
    user_res = await db.execute(text("""
        SELECT 
            ua.id, ua.email, ua.role_id, ua.status, ua.must_change_password,
            r.name as role_name, r.is_system as role_is_system,
            e.full_name as employee_name
        FROM user_accounts ua
        LEFT JOIN roles r ON r.id = ua.role_id
        LEFT JOIN employees e ON e.id = ua.employee_id
        WHERE ua.id = :user_id
    """), {"user_id": user_id_str})
    
    user = user_res.fetchone()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta de usuario no encontrada"
        )
    
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta de acceso está suspendida"
        )
        
    # Get permissions list
    permissions = []
    if user.role_is_system:
        # Admin gets ALL permissions
        all_perms_res = await db.execute(text("SELECT module, action FROM permissions"))
        permissions = [f"{p.module}.{p.action}" for p in all_perms_res.fetchall()]
    else:
        if user.role_id:
            perms_res = await db.execute(text("""
                SELECT p.module, p.action 
                FROM role_permissions rp
                JOIN permissions p ON p.id = rp.permission_id
                WHERE rp.role_id = :role_id
            """), {"role_id": user.role_id})
            permissions = [f"{p.module}.{p.action}" for p in perms_res.fetchall()]

    return {
        "id": user.id,
        "email": user.email,
        "employee_name": user.employee_name or "Usuario",
        "role_id": user.role_id,
        "role_name": user.role_name or "Sin Asignar",
        "must_change_password": user.must_change_password,
        "permissions": permissions
    }

def require_permission(module: str, action: str):
    async def checker(current_user: dict = Depends(get_current_user)):
        permission_key = f"{module}.{action}"
        if permission_key not in current_user["permissions"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No tienes permiso para realizar esta acción ({module}.{action})"
            )
        return current_user
    return checker
