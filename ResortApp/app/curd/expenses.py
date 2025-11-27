from sqlalchemy.orm import Session
from app.models.expense import Expense
from app.schemas.expenses import ExpenseCreate, ExpenseUpdate

def create_expense(db: Session, data, image_path: str = None):
    # Handle both dict and Pydantic model
    if isinstance(data, dict):
        expense_data = ExpenseCreate(**data)
    else:
        expense_data = data
    
    # Create expense model
    new_expense = Expense(
        category=expense_data.category,
        amount=expense_data.amount,
        date=expense_data.date,
        description=expense_data.description,
        employee_id=expense_data.employee_id,
        image=image_path
    )
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)
    return new_expense

def get_all_expenses(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Expense).offset(skip).limit(limit).all()

def get_expense_by_id(db: Session, expense_id: int):
    return db.query(Expense).filter(Expense.id == expense_id).first()

def update_expense(db: Session, expense_id: int, data: ExpenseUpdate):
    expense = get_expense_by_id(db, expense_id)
    for field, value in data.dict(exclude_unset=True).items():
        setattr(expense, field, value)
    db.commit()
    return expense

def delete_expense(db: Session, expense_id: int):
    expense = get_expense_by_id(db, expense_id)
    db.delete(expense)
    db.commit()
