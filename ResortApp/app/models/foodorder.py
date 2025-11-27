from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class FoodOrder(Base):
    __tablename__ = "food_orders"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    amount = Column(Float)
    assigned_employee_id = Column(Integer, ForeignKey("employees.id"))
    status = Column(String, default="active")
    billing_status = Column(String, default="unbilled")
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("FoodOrderItem", back_populates="order", cascade="all, delete-orphan")
    employee = relationship("Employee")
    room = relationship("Room", back_populates="food_orders")

class FoodOrderItem(Base):
    __tablename__ = "food_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("food_orders.id"))
    food_item_id = Column(Integer, ForeignKey("food_items.id"))
    quantity = Column(Integer)

    order = relationship("FoodOrder", back_populates="items")
    food_item = relationship("FoodItem")