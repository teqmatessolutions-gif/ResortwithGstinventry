from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"))
    amount = Column(Float)
    method = Column(String)  # upi, card, cash
    status = Column(String, default="paid")
    created_at = Column(DateTime, default=datetime.utcnow)

    booking = relationship("Booking")


class Voucher(Base):
    __tablename__ = "vouchers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True)
    discount_percent = Column(Float)
    expiry_date = Column(DateTime)
