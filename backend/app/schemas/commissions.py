from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional

class CommissionRuleCreate(BaseModel):
    employee_id: UUID
    commission_type: str = Field(..., description="percentage or fixed")
    value: float

class CommissionRuleOut(CommissionRuleCreate):
    id: UUID
    applies_to: str
    active: bool

    class Config:
        from_attributes = True

class EventCloseRequest(BaseModel):
    revenue: float = Field(..., ge=0, description="Total revenue collected from the event")
