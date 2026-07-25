from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import require_permission
from app.services.auth_service import hash_password
from typing import Optional
from uuid import UUID
import random
import string

router = APIRouter(prefix="/api/v1/admin", tags=["User Accounts"])

class AccountCreate(BaseModel):
    employee_id: UUID
    email: EmailStr
    role_id: UUID

class RoleChangeRequest(BaseModel):
    role_id: UUID

class StatusChangeRequest(BaseModel):
    status: str # active or suspended

@router.get("/user-accounts")
async def list_user_accounts(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("usuarios", "view"))
):
    """List all employee login accounts."""
    accounts_res = await db.execute(text("""
        SELECT 
            ua.id, ua.email, ua.role_id, ua.status, ua.must_change_password, ua.last_login_at,
            r.name as role_name,
            e.full_name as employee_name, e.id as employee_id
        FROM user_accounts ua
        LEFT JOIN roles r ON r.id = ua.role_id
        LEFT JOIN employees e ON e.id = ua.employee_id
        ORDER BY e.full_name
    """))
    return [
        {
            "id": str(a.id),
            "employee_id": str(a.employee_id),
            "employee_name": a.employee_name,
            "email": a.email,
            "role_id": str(a.role_id) if a.role_id else None,
            "role_name": a.role_name or "Sin Asignar",
            "status": a.status,
            "must_change_password": a.must_change_password,
            "last_login_at": a.last_login_at.isoformat() if a.last_login_at else None
        } for a in accounts_res.fetchall()
    ]

@router.post("/user-accounts", status_code=status.HTTP_201_CREATED)
async def create_user_account(
    req: AccountCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("usuarios", "create"))
):
    """Create a new login account for an employee."""
    # Check if employee exists
    emp_res = await db.execute(text("SELECT id FROM employees WHERE id = :id"), {"id": req.employee_id})
    if not emp_res.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empleado no encontrado")
        
    # Check duplicate email
    dup_res = await db.execute(text("SELECT id FROM user_accounts WHERE email = :email"), {"email": req.email})
    if dup_res.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una cuenta con este correo electrónico"
        )
        
    # Generate temporal password
    temp_pass = "DL-" + "".join(random.choices(string.digits, k=6))
    hashed_pass = hash_password(temp_pass)
    
    res = await db.execute(text("""
        INSERT INTO user_accounts (employee_id, email, password_hash, role_id, status, must_change_password)
        VALUES (:emp_id, :email, :pass, :role_id, 'active', true)
        RETURNING id
    """), {"emp_id": req.employee_id, "email": req.email, "pass": hashed_pass, "role_id": req.role_id})
    
    await db.commit()
    return {
        "id": str(res.scalar()),
        "email": req.email,
        "temporary_password": temp_pass,
        "message": "Cuenta creada. Entrega esta contraseña temporal al empleado."
    }

@router.put("/user-accounts/{account_id}/role")
async def change_user_role(
    account_id: UUID,
    req: RoleChangeRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("usuarios", "edit"))
):
    """Reassign role to a user account."""
    # Check if role exists
    role_res = await db.execute(text("SELECT id FROM roles WHERE id = :id"), {"id": req.role_id})
    if not role_res.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado")
        
    # Check account
    acc_res = await db.execute(text("SELECT id FROM user_accounts WHERE id = :id"), {"id": account_id})
    if not acc_res.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta de usuario no encontrada")
        
    await db.execute(text("""
        UPDATE user_accounts 
        SET role_id = :role_id 
        WHERE id = :id
    """), {"role_id": req.role_id, "id": account_id})
    await db.commit()
    return {"message": "Rol de la cuenta actualizado exitosamente"}

@router.put("/user-accounts/{account_id}/status")
async def change_user_status(
    account_id: UUID,
    req: StatusChangeRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("usuarios", "edit"))
):
    """Suspend or activate a user account."""
    if req.status not in ["active", "suspended"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Estado inválido")
        
    # Check account
    acc_res = await db.execute(text("""
        SELECT ua.id, r.is_system as role_is_system, ua.status
        FROM user_accounts ua
        LEFT JOIN roles r ON r.id = ua.role_id
        WHERE ua.id = :id
    """), {"id": account_id})
    acc = acc_res.fetchone()
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta de usuario no encontrada")
        
    # Lockout safety: Prevent suspending the last active administrator
    if acc.role_is_system and req.status == "suspended":
        active_admins_res = await db.execute(text("""
            SELECT COUNT(*) 
            FROM user_accounts ua
            JOIN roles r ON r.id = ua.role_id
            WHERE r.is_system = true AND ua.status = 'active'
        """))
        if active_admins_res.scalar() <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede suspender el único Administrador activo del sistema."
            )
            
    await db.execute(text("""
        UPDATE user_accounts 
        SET status = :status 
        WHERE id = :id
    """), {"status": req.status, "id": account_id})
    await db.commit()
    return {"message": f"Cuenta de usuario puesta en estado: {req.status}"}
