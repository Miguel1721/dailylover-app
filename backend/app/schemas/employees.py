from pydantic import BaseModel, EmailStr
from datetime import date
from typing import Optional
from uuid import UUID

class EmployeeBase(BaseModel):
    full_name: str
    role: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    base_salary: float
    contract_type: str = "nomina"
    hire_date: date

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(EmployeeBase):
    status: Optional[str] = None

class EmployeeOut(EmployeeBase):
    id: UUID
    status: str

    class Config:
        from_attributes = True
