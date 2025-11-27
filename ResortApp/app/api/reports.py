from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date
from pydantic import BaseModel

from app.utils.auth import get_db
from app.models.booking import Booking
from app.models.user import User
from app.models.expense import Expense
from app.models.service import AssignedService
from app.models.foodorder import FoodOrder
from app.models.Package import PackageBooking


router = APIRouter(prefix="/reports", tags=["Reports"])

# --- Pydantic Schemas for Report Outputs ---

class CheckinByEmployeeOut(BaseModel):
    employee_name: str
    checkin_count: int

class ExpenseOut(BaseModel):
    id: int
    category: str
    description: Optional[str]
    amount: float
    expense_date: date
    class Config: from_attributes = True

class ServiceChargeOut(BaseModel):
    id: int
    room_number: Optional[str]
    service_name: Optional[str]
    amount: Optional[float]
    employee_name: Optional[str]
    status: str
    created_at: date
    class Config: from_attributes = True

class FoodOrderOut(BaseModel):
    id: int
    room_number: Optional[str]
    item_count: int
    amount: float
    employee_name: Optional[str]
    status: str
    created_at: date
    class Config: from_attributes = True


# --- Report Endpoints ---

@router.get("/checkin-by-employee", response_model=List[CheckinByEmployeeOut])
def get_checkin_by_employee_report(from_date: Optional[date] = None, to_date: Optional[date] = None, db: Session = Depends(get_db)):
    """
    Generates a report of how many check-ins each employee has performed.
    Filters by the booking's check-in date.
    """
    query = (
        db.query(
            User.name.label("employee_name"),
            func.count(Booking.id).label("checkin_count"),
        )
        .join(User, Booking.user_id == User.id)
        .filter(Booking.status.in_(["checked-in", "checked_out"]))
    )

    if from_date:
        query = query.filter(Booking.check_in >= from_date)
    if to_date:
        query = query.filter(Booking.check_in <= to_date)

    results = (
        query.group_by(User.name)
        .order_by(func.count(Booking.id).desc())
        .all()
    )
    return results

@router.get("/expenses", response_model=List[ExpenseOut])
def get_expenses_report(from_date: Optional[date] = None, to_date: Optional[date] = None, db: Session = Depends(get_db)):
    query = db.query(Expense)
    if from_date: query = query.filter(Expense.expense_date >= from_date)
    if to_date: query = query.filter(Expense.expense_date <= to_date)
    return query.order_by(Expense.expense_date.desc()).all()

@router.get("/room-bookings", response_model=List)
def get_room_bookings_report(from_date: Optional[date] = None, to_date: Optional[date] = None, db: Session = Depends(get_db)):
    query = db.query(Booking)
    if from_date: query = query.filter(Booking.check_in >= from_date)
    if to_date: query = query.filter(Booking.check_in <= to_date)
    return query.order_by(Booking.check_in.desc()).all()

# NOTE: Stubs for other report endpoints. You would implement these similarly.
@router.get("/service-charges", response_model=List)
def get_service_charges_report(db: Session = Depends(get_db)): return []
@router.get("/food-orders", response_model=List)
def get_food_orders_report(db: Session = Depends(get_db)): return []
@router.get("/package-bookings", response_model=List)
def get_package_bookings_report(db: Session = Depends(get_db)): return []
@router.get("/employees", response_model=List)
def get_employees_report(db: Session = Depends(get_db)): return []