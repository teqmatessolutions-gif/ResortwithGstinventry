from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime, Time
from sqlalchemy.orm import relationship, declarative_base
from app.database import Base # Assuming you have a Base instance

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    role = Column(String)
    salary = Column(Float)
    join_date = Column(Date)
    image_url = Column(String, nullable=True) # ✅ Changed 'image' to 'image_url' for clarity
    
    # ✅ Add this foreign key column to link to the users table
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # ✅ Add this relationship for easy access to the user's data
    user = relationship("User", back_populates="employee")
    
    leaves = relationship("Leave", back_populates="employee")
    expenses = relationship("Expense", back_populates="employee")
    attendances = relationship("Attendance", back_populates="employee")
    working_logs = relationship("WorkingLog", back_populates="employee")

class Leave(Base):
    __tablename__ = "leaves"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    from_date = Column(Date)
    to_date = Column(Date)
    reason = Column(String)
    leave_type = Column(String, default="Paid") # Add leave_type, e.g., 'Paid', 'Sick'
    status = Column(String, default="pending")

    employee = relationship("Employee", back_populates="leaves")

class Attendance(Base):
    __tablename__ = "attendances"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String, nullable=False) # e.g., 'Present', 'Absent', 'Leave'
    
    employee = relationship("Employee", back_populates="attendances")

class WorkingLog(Base):
    __tablename__ = "working_logs"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    check_in_time = Column(Time)
    check_out_time = Column(Time)
    location = Column(String, nullable=True) # e.g., 'Office', 'Remote'
    
    employee = relationship("Employee", back_populates="working_logs")