from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List

class PayrollGenerate(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2020)

class PayrollRunOut(BaseModel):
    id: UUID
    period_month: int
    period_year: int
    status: str
    total_base: float
    total_commissions: float
    total_deductions: float
    total_paid: float
    liquidated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PayrollItemOut(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: Optional[str] = None
    employee_role: Optional[str] = None
    base_salary: float
    commissions: float
    deductions: float
    total: float

    class Config:
        from_attributes = True
