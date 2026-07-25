from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import require_permission
from typing import List, Optional
from uuid import UUID

router = APIRouter(prefix="/api/v1/admin", tags=["Roles & Permissions"])

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None

class RoleUpdate(BaseModel):
    name: str
    description: Optional[str] = None

class RolePermissionsUpdate(BaseModel):
    permission_ids: List[UUID]

@router.get("/roles")
async def list_roles(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("roles", "view"))
):
    """List all roles with user count."""
    roles_res = await db.execute(text("""
        SELECT r.id, r.name, r.description, r.is_system, COUNT(ua.id) as user_count
        FROM roles r
        LEFT JOIN user_accounts ua ON ua.role_id = r.id
        GROUP BY r.id, r.name, r.description, r.is_system
        ORDER BY r.name
    """))
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "description": r.description,
            "is_system": r.is_system,
            "user_count": r.user_count
        } for r in roles_res.fetchall()
    ]

@router.post("/roles", status_code=status.HTTP_201_CREATED)
async def create_role(
    req: RoleCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("roles", "create"))
):
    """Create a new role."""
    # Check duplicate
    dup_res = await db.execute(text("SELECT id FROM roles WHERE name = :name"), {"name": req.name})
    if dup_res.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un rol con este nombre"
        )
        
    res = await db.execute(text("""
        INSERT INTO roles (name, description, is_system)
        VALUES (:name, :desc, false)
        RETURNING id, name, description, is_system
    """), {"name": req.name, "desc": req.description})
    await db.commit()
    r = res.fetchone()
    return {
        "id": str(r.id),
        "name": r.name,
        "description": r.description,
        "is_system": r.is_system
    }

@router.put("/roles/{role_id}")
async def update_role(
    role_id: UUID,
    req: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("roles", "edit"))
):
    """Update a role's name/description."""
    role_res = await db.execute(text("SELECT is_system FROM roles WHERE id = :id"), {"id": role_id})
    role = role_res.fetchone()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado")
        
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pueden editar los roles de sistema"
        )
        
    await db.execute(text("""
        UPDATE roles 
        SET name = :name, description = :desc
        WHERE id = :id
    """), {"name": req.name, "desc": req.description, "id": role_id})
    await db.commit()
    return {"message": "Rol actualizado correctamente"}

@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("roles", "delete"))
):
    """Delete a role."""
    role_res = await db.execute(text("SELECT is_system FROM roles WHERE id = :id"), {"id": role_id})
    role = role_res.fetchone()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado")
        
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pueden borrar los roles de sistema"
        )
        
    # Check assigned users
    users_res = await db.execute(text("SELECT COUNT(*) FROM user_accounts WHERE role_id = :id"), {"id": role_id})
    if users_res.scalar() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede borrar el rol porque tiene usuarios asignados. Reasigna los usuarios primero."
        )
        
    await db.execute(text("DELETE FROM roles WHERE id = :id"), {"id": role_id})
    await db.commit()
    return {"message": "Rol eliminado correctamente"}

@router.get("/permissions")
async def list_permissions(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("roles", "view"))
):
    """Get the full catalog of permissions."""
    perms_res = await db.execute(text("SELECT id, module, action, label FROM permissions ORDER BY module, action"))
    return [
        {
            "id": str(p.id),
            "module": p.module,
            "action": p.action,
            "label": p.label
        } for p in perms_res.fetchall()
    ]

@router.get("/roles/{role_id}/permissions")
async def get_role_permissions(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("roles", "view"))
):
    """Get permission IDs assigned to a role."""
    perms_res = await db.execute(text("SELECT permission_id FROM role_permissions WHERE role_id = :role_id"), {"role_id": role_id})
    return [str(r.permission_id) for r in perms_res.fetchall()]

@router.put("/roles/{role_id}/permissions")
async def update_role_permissions(
    role_id: UUID,
    req: RolePermissionsUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("roles", "edit"))
):
    """Update role permission associations."""
    role_res = await db.execute(text("SELECT is_system FROM roles WHERE id = :id"), {"id": role_id})
    role = role_res.fetchone()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado")
        
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pueden editar los permisos del rol de administrador del sistema"
        )
        
    # Delete current mappings
    await db.execute(text("DELETE FROM role_permissions WHERE role_id = :role_id"), {"role_id": role_id})
    
    # Insert new ones
    for p_id in req.permission_ids:
        await db.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (:role_id, :perm_id)
        """), {"role_id": role_id, "perm_id": p_id})
        
    await db.commit()
    return {"message": "Permisos actualizados exitosamente"}
