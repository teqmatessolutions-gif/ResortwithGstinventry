from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime, Date, Enum, func
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class Checkout(Base):
    __tablename__ = "checkouts"
    id = Column(Integer, primary_key=True, index=True)

    room_total = Column(Float, default=0.0)
    food_total = Column(Float, default=0.0)
    service_total = Column(Float, default=0.0)
    package_total = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    grand_total = Column(Float, default=0.0)
    guest_name = Column(String, default="")
    room_number = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    checkout_date = Column(DateTime, default=datetime.utcnow)
    payment_method = Column(String, default="")
    
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, unique=True)
    package_booking_id = Column(Integer, ForeignKey("package_bookings.id"), nullable=True, unique=True)
    payment_status = Column(String) 

    booking = relationship("Booking", back_populates="checkout", uselist=False)
    package_booking = relationship("PackageBooking", back_populates="checkout", uselist=False)