from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Package(Base):
    __tablename__ = "packages"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String)
    price = Column(Float, nullable=False)
    booking_type = Column(String, default="room_type")  # "whole_property" or "room_type"
    room_types = Column(String, nullable=True)  # Comma-separated list of room types (e.g., "Cottage,Non AC Double Room")

    # Relationships
    images = relationship("PackageImage", back_populates="package", cascade="all, delete-orphan")
    bookings = relationship("PackageBooking", back_populates="package")


class PackageImage(Base):
    __tablename__ = "package_images"
    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("packages.id"))
    image_url = Column(String, nullable=False)

    # Relationships
    package = relationship("Package", back_populates="images")


class PackageBooking(Base):
    __tablename__ = "package_bookings"
    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("packages.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    guest_name = Column(String, nullable=False)
    guest_email = Column(String, nullable=True)
    guest_mobile = Column(String, nullable=True)

    check_in = Column(Date, nullable=False)
    check_out = Column(Date, nullable=False)
    adults = Column(Integer, default=2)
    children = Column(Integer, default=0)
    id_card_image_url = Column(String, nullable=True)
    guest_photo_url = Column(String, nullable=True)
    status = Column(String)

    # Relationships
    package = relationship("Package", back_populates="bookings")
    user = relationship("User", back_populates="package_bookings")
    
    checkout = relationship("Checkout", back_populates="package_booking", uselist=False)

    rooms = relationship(
        "PackageBookingRoom",
        back_populates="package_booking",
        cascade="all, delete-orphan"
    )


class PackageBookingRoom(Base):
    __tablename__ = "package_booking_rooms"
    id = Column(Integer, primary_key=True, index=True)
    package_booking_id = Column(Integer, ForeignKey("package_bookings.id", ondelete="CASCADE"))
    room_id = Column(Integer, ForeignKey("rooms.id"))

    # Relationships
    package_booking = relationship("PackageBooking", back_populates="rooms")
    room = relationship("Room", back_populates="package_booking_rooms")
