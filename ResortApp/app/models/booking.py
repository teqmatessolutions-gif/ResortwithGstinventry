from sqlalchemy import Column, Float, Integer, String, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.database import Base
from .room import Room
from .user import User

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, default="booked")
    guest_name = Column(String, nullable=False)
    guest_mobile = Column(String, nullable=True)
    guest_email = Column(String, nullable=True)
    check_in = Column(Date, nullable=False)
    check_out = Column(Date, nullable=False)
    adults = Column(Integer, default=2)
    children = Column(Integer, default=0)
    id_card_image_url = Column(String, nullable=True)
    guest_photo_url = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    total_amount = Column(Float, default=0.0)
    # Relationships
    checkout = relationship("Checkout", back_populates="booking", uselist=False)
    user = relationship("User", back_populates="bookings")
    booking_rooms = relationship(
        "BookingRoom",
        back_populates="booking",
        cascade="all, delete-orphan"
    )

class BookingRoom(Base):
    __tablename__ = "booking_rooms"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"))
    room_id = Column(Integer, ForeignKey("rooms.id"))

    booking = relationship("Booking", back_populates="booking_rooms")
    room = relationship("Room", back_populates="booking_rooms")
