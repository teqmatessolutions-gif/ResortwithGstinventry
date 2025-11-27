from pydantic import BaseModel
from typing import Optional, List
from datetime import date

# This schema is used for the API request body when creating a new employee.
# It now includes the required fields: email and password.
class EmployeeCreate(BaseModel):
    name: str
    role: str
    salary: float
    join_date: date
    email: str
    phone: Optional[str] = None
    password: str

# This schema is used for the API response body. It defines the data
# that will be returned to the frontend.
class Employee(BaseModel):
    id: int
    name: str
    role: str
    salary: float
    join_date: date
    # ✅ It must use 'image_url' to match the database column.
    image_url: Optional[str] = None
    # ✅ It must include 'user_id' to match the database model.
    user_id: Optional[int] = None
    
    class Config:
        # Use from_attributes for Pydantic V2 and above
        from_attributes = True

# Your other schemas for Leave can remain as they are.
class LeaveBase(BaseModel):
    employee_id: int
    from_date: date
    to_date: date
    reason: str

class LeaveCreate(LeaveBase):
    pass

class LeaveOut(LeaveBase):
    id: int
    status: str
    class Config:
        from_attributes = True

class EmployeeStatusOverview(BaseModel):
    active_employees: List[Employee]
    inactive_employees: List[Employee]
    on_paid_leave: List[Employee]
    on_sick_leave: List[Employee]
    on_unpaid_leave: List[Employee]
    class Config: from_attributes = True
