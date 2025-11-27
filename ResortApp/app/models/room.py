from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String, unique=True, nullable=False)
    type = Column(String)
    price = Column(Float)
    status = Column(String, default="Available")
    image_url = Column(String, nullable=True)
    adults = Column(Integer, default=2)      # max adults allowed
    children = Column(Integer, default=0)    # max children allowed
    inventory_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)  # Link to inventory locations
    
    # Room features/amenities
    air_conditioning = Column(Boolean, default=False)
    wifi = Column(Boolean, default=False)
    bathroom = Column(Boolean, default=False)
    living_area = Column(Boolean, default=False)
    terrace = Column(Boolean, default=False)
    parking = Column(Boolean, default=False)
    kitchen = Column(Boolean, default=False)
    family_room = Column(Boolean, default=False)
    bbq = Column(Boolean, default=False)
    garden = Column(Boolean, default=False)
    dining = Column(Boolean, default=False)
    breakfast = Column(Boolean, default=False)

    # Association (one-to-many with BookingRoom)
    booking_rooms = relationship(
        "BookingRoom",
        back_populates="room",
        cascade="all, delete-orphan"
    )

    package_booking_rooms = relationship(
        "PackageBookingRoom",
        back_populates="room",
        cascade="all, delete-orphan"
    )

    food_orders = relationship(
        "FoodOrder",
        back_populates="room"
    )
    
    # Relationship to inventory location
    inventory_location = relationship("Location", foreign_keys=[inventory_location_id])


    def __repr__(self):
        return f"<Room id={self.id} number={self.number} status={self.status}>"
