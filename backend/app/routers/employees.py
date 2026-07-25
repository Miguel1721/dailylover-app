from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.core.permissions import require_permission
from app.schemas.employees import EmployeeCreate, EmployeeUpdate, EmployeeOut
from typing import List, Optional
from uuid import UUID

router = APIRouter(prefix="/api/v1/admin", tags=["Employees"])

@router.get("/employees", response_model=List[EmployeeOut])
async def list_employees(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("empleados", "view"))
):
    """List employees with pagination and optional search."""
    offset = (page - 1) * limit
    search_param = f"%{search.lower()}%" if search else None
    
    query = """
        SELECT id, full_name, role, phone, email, base_salary, contract_type, hire_date, status
        FROM employees
        WHERE (CAST(:search AS VARCHAR) IS NULL OR LOWER(full_name) LIKE :search)
        ORDER BY status ASC, full_name ASC
        LIMIT :limit OFFSET :offset
    """
    
    res = await db.execute(text(query), {"search": search_param, "limit": limit, "offset": offset})
    
    return [
        EmployeeOut(
            id=r.id,
            full_name=r.full_name,
            role=r.role,
            phone=r.phone,
            email=r.email,
            base_salary=float(r.base_salary),
            contract_type=r.contract_type,
            hire_date=r.hire_date,
            status=r.status
        ) for r in res.fetchall()
    ]

@router.post("/employees", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(
    req: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("empleados", "create"))
):
    """Create a new employee record."""
    res = await db.execute(text("""
        INSERT INTO employees (full_name, role, phone, email, base_salary, contract_type, hire_date, status)
        VALUES (:name, :role, :phone, :email, :base, :contract, :hire, 'active')
        RETURNING id, full_name, role, phone, email, base_salary, contract_type, hire_date, status
    """), {
        "name": req.full_name,
        "role": req.role,
        "phone": req.phone,
        "email": req.email,
        "base": req.base_salary,
        "contract": req.contract_type,
        "hire": req.hire_date
    })
    
    await db.commit()
    r = res.fetchone()
    return EmployeeOut(
        id=r.id,
        full_name=r.full_name,
        role=r.role,
        phone=r.phone,
        email=r.email,
        base_salary=float(r.base_salary),
        contract_type=r.contract_type,
        hire_date=r.hire_date,
        status=r.status
    )

@router.put("/employees/{emp_id}", response_model=EmployeeOut)
async def update_employee(
    emp_id: UUID,
    req: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("empleados", "edit"))
):
    """Update employee details."""
    check_res = await db.execute(text("SELECT id FROM employees WHERE id = :id"), {"id": emp_id})
    if not check_res.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empleado no encontrado")
        
    await db.execute(text("""
        UPDATE employees 
        SET full_name = :name, role = :role, phone = :phone, email = :email, 
            base_salary = :base, contract_type = :contract, hire_date = :hire,
            status = COALESCE(:status, status)
        WHERE id = :id
    """), {
        "name": req.full_name,
        "role": req.role,
        "phone": req.phone,
        "email": req.email,
        "base": req.base_salary,
        "contract": req.contract_type,
        "hire": req.hire_date,
        "status": req.status,
        "id": emp_id
    })
    
    await db.commit()
    
    # Return updated employee
    res = await db.execute(text("""
        SELECT id, full_name, role, phone, email, base_salary, contract_type, hire_date, status
        FROM employees WHERE id = :id
    """), {"id": emp_id})
    r = res.fetchone()
    return EmployeeOut(
        id=r.id,
        full_name=r.full_name,
        role=r.role,
        phone=r.phone,
        email=r.email,
        base_salary=float(r.base_salary),
        contract_type=r.contract_type,
        hire_date=r.hire_date,
        status=r.status
    )

@router.delete("/employees/{emp_id}")
async def deactivate_employee(
    emp_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("empleados", "delete"))
):
    """Mark an employee as inactive (soft delete)."""
    check_res = await db.execute(text("SELECT status FROM employees WHERE id = :id"), {"id": emp_id})
    row = check_res.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empleado no encontrado")
        
    await db.execute(text("UPDATE employees SET status = 'inactive' WHERE id = :id"), {"id": emp_id})
    
    # Also suspend user account associated to this employee if exists
    await db.execute(text("UPDATE user_accounts SET status = 'suspended' WHERE employee_id = :id"), {"id": emp_id})
    
    await db.commit()
    return {"message": "Empleado marcado como inactivo y acceso al panel revocado."}
