from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class ExpenseBase(BaseModel):
    category: str
    amount: float
    date: date
    description: Optional[str] = None
    employee_id: int

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseUpdate(BaseModel):
    category: Optional[str]
    amount: Optional[float]
    date: Optional[date]
    description: Optional[str]
    employee_id: Optional[int]

class ExpenseOut(BaseModel):
    id: int
    category: str
    amount: float
    date: date
    description: Optional[str]
    employee_id: int
    image: Optional[str]
    employee_name: str
    created_at: datetime

    class Config:
        from_attributes = True
