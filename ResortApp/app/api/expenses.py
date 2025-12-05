from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.curd import expenses as expense_crud
from app.utils.auth import get_db, get_current_user
from app.schemas.expenses import ExpenseOut
from app.models.user import User
from app.models.employee import Employee
from app.utils.api_optimization import optimize_limit, MAX_LIMIT_LOW_NETWORK
import os
import shutil
from fastapi.responses import FileResponse
import uuid

router = APIRouter(prefix="/expenses", tags=["Expenses"])

UPLOAD_DIR = "uploads/expenses"


@router.post("", response_model=ExpenseOut)
async def create_expense(
    category: str = Form(...),
    amount: float = Form(...),
    date: str = Form(...),
    description: str = Form(None),
    employee_id: int = Form(...),
    department: str = Form(None),
    image: UploadFile = File(None),
    # RCM fields
    rcm_applicable: bool = Form(False),
    rcm_tax_rate: float = Form(None),
    nature_of_supply: str = Form(None),
    original_bill_no: str = Form(None),
    vendor_id: int = Form(None),
    rcm_liability_date: str = Form(None),
    itc_eligible: bool = Form(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Ensure upload directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    image_path = None
    if image and image.filename:
        filename = f"{employee_id}_{uuid.uuid4().hex}_{image.filename}"
        file_location = os.path.join(UPLOAD_DIR, filename)
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        
        # Path to be used by frontend (relative to /uploads/)
        image_path = f"uploads/expenses/{filename}"

    # Store expense in DB using ExpenseCreate schema
    from app.schemas.expenses import ExpenseCreate
    from datetime import datetime
    from app.utils.accounting_helpers import generate_rcm_self_invoice_number, create_rcm_journal_entry
    from app.models.inventory import Vendor
    
    # Parse dates
    expense_date = datetime.strptime(date, "%Y-%m-%d").date() if isinstance(date, str) else date
    rcm_liability_dt = None
    if rcm_liability_date:
        rcm_liability_dt = datetime.strptime(rcm_liability_date, "%Y-%m-%d").date() if isinstance(rcm_liability_date, str) else rcm_liability_date
    
    # Generate self-invoice number if RCM is applicable
    self_invoice_number = None
    if rcm_applicable:
        self_invoice_number = generate_rcm_self_invoice_number(db)
    
    expense_data = ExpenseCreate(
        category=category,
        amount=amount,
        date=expense_date,
        description=description,
        employee_id=employee_id,
        department=department if department else None,
        rcm_applicable=rcm_applicable,
        rcm_tax_rate=rcm_tax_rate if rcm_applicable else None,
        nature_of_supply=nature_of_supply if rcm_applicable else None,
        original_bill_no=original_bill_no if rcm_applicable else None,
        vendor_id=vendor_id if vendor_id else None,
        rcm_liability_date=rcm_liability_dt if rcm_applicable else None,
        itc_eligible=itc_eligible if rcm_applicable else True
    )

    created = expense_crud.create_expense(db, data=expense_data, image_path=image_path)
    
    # Set self-invoice number if RCM is applicable
    if rcm_applicable and self_invoice_number:
        created.self_invoice_number = self_invoice_number
        db.commit()
        db.refresh(created)
    
    # Create RCM journal entry if applicable
    if rcm_applicable and rcm_tax_rate:
        try:
            # Get vendor details for journal entry
            vendor_name = "Unknown"
            is_interstate = False
            if vendor_id:
                vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
                if vendor:
                    vendor_name = (vendor.legal_name or vendor.name) if vendor else "Unknown"
                    # Check if inter-state (compare vendor state with resort state)
                    if vendor.gst_number and len(vendor.gst_number) >= 2:
                        vendor_state_code = vendor.gst_number[:2]
                        from app.api.gst_reports import RESORT_STATE_CODE
                        is_interstate = vendor_state_code != RESORT_STATE_CODE
            
            # Create journal entry for RCM
            create_rcm_journal_entry(
                db=db,
                expense_id=created.id,
                taxable_value=float(amount),
                tax_rate=float(rcm_tax_rate),
                is_interstate=is_interstate,
                nature_of_supply=nature_of_supply or "Other",
                vendor_name=vendor_name,
                self_invoice_number=self_invoice_number,
                itc_eligible=itc_eligible,
                created_by=current_user.id
            )
        except Exception as e:
            # Log error but don't fail expense creation
            import traceback
            print(f"Warning: Could not create RCM journal entry for expense {created.id}: {str(e)}\n{traceback.format_exc()}")

            print(f"Warning: Could not create RCM journal entry for expense {created.id}: {str(e)}\n{traceback.format_exc()}")

    # Create Standard Expense Journal Entry (Debit Expense, Credit Cash/Bank)
    try:
        from app.utils.accounting_helpers import create_expense_journal_entry
        create_expense_journal_entry(
            db=db,
            expense_id=created.id,
            amount=float(amount),
            category=category,
            description=description or "",
            created_by=current_user.id
        )
    except Exception as je_error:
        print(f"Warning: Failed to create expense journal entry: {je_error}")

    # Add employee name in the response
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    return {
        **created.__dict__,
        "employee_name": employee.name if employee else "N/A"
    }

@router.get("", response_model=list[ExpenseOut])
def get_expenses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), skip: int = 0, limit: int = 20):
    # Cap limit to prevent performance issues
    # Optimized for low network
    limit = optimize_limit(limit, MAX_LIMIT_LOW_NETWORK)
    if limit < 1:
        limit = 20
    
    expenses = expense_crud.get_all_expenses(db, skip=skip, limit=limit)
    result = []
    for exp in expenses:
        emp = db.query(Employee).filter(Employee.id == exp.employee_id).first()
        result.append({
            **exp.__dict__,
            "employee_name": emp.name if emp else "N/A"
        })
    return result

@router.get("/image/{filename}")
def get_expense_image(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)

@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = expense_crud.get_expense_by_id(db, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Delete associated image file if it exists
    if expense.image:
        image_path = expense.image
        if os.path.exists(image_path):
            try:
                os.remove(image_path)
            except Exception as e:
                # Log error but continue with expense deletion
                print(f"Error deleting image file {image_path}: {e}")
    
    expense_crud.delete_expense(db, expense_id)
    return {"message": "Expense deleted successfully"}
