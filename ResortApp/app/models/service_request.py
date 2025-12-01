from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class ServiceRequest(Base):
    __tablename__ = "service_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    food_order_id = Column(Integer, ForeignKey("food_orders.id"), nullable=True)  # Nullable for cleaning/other non-food requests
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    request_type = Column(String, default="delivery")  # "delivery" or other types
    description = Column(Text, nullable=True)  # Delivery request details
    status = Column(String, default="pending")  # "pending", "in_progress", "completed", "cancelled"
    refill_data = Column(Text, nullable=True)  # JSON string for refill items data
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    food_order = relationship("FoodOrder", foreign_keys=[food_order_id])
    room = relationship("Room", foreign_keys=[room_id])
    employee = relationship("Employee", foreign_keys=[employee_id])

