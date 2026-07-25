from pydantic import BaseModel, Field
from uuid import UUID
from datetime import date, datetime
from typing import Optional, List, Dict

class IncomeCreate(BaseModel):
    event_id: Optional[int] = None
    category: str = Field(..., description="inscripcion / membresia / otro")
    description: Optional[str] = None
    amount: float = Field(..., gt=0)
    payment_method: Optional[str] = None
    received_at: date

class IncomeOut(IncomeCreate):
    id: UUID
    created_at: datetime
    event_name: Optional[str] = None

    class Config:
        from_attributes = True

class ExpenseCreate(BaseModel):
    event_id: Optional[int] = None
    category: str = Field(..., description="logistica / marketing / nomina / arriendo / comision_aliado / otro")
    description: Optional[str] = None
    amount: float = Field(..., gt=0)
    payment_method: Optional[str] = None
    paid_at: date
    is_recurring: Optional[bool] = False

class ExpenseOut(ExpenseCreate):
    id: UUID
    created_at: datetime
    event_name: Optional[str] = None

    class Config:
        from_attributes = True

class CashflowOut(BaseModel):
    current_balance: float
    monthly_summary: List[Dict]
    projection_30d: float
    by_category: Dict[str, Dict[str, float]]
    projection_90d: Optional[List[Dict]] = None
