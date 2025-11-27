from pydantic import BaseModel, validator, field_validator, model_validator
from typing import List, Optional
from datetime import date
from .user import UserOut

# This schema is used for displaying Room details within a Booking
class RoomOut(BaseModel):
    id: int
    number: str
    type: str
    price: float
    adults: int
    children: int
    status: str
    image_url: Optional[str] = None

    class Config:
        from_attributes = True

# This schema represents the link between a Booking and a Room
class BookingRoomOut(BaseModel):
    booking_id: int
    room_id: int
    room: RoomOut

    class Config:
        from_attributes = True


# This schema is used when creating a new booking
class BookingCreate(BaseModel):
    room_ids: List[int]
    guest_name: str
    guest_mobile: str
    guest_email: str
    check_in: date
    check_out: date
    adults: int
    children: int

    @validator('check_out')
    def validate_booking_duration(cls, v, values):
        """Ensure minimum booking duration of 1 day"""
        if 'check_in' in values:
            check_in = values['check_in']
            if v <= check_in:
                raise ValueError('Check-out date must be at least 1 day after check-in date')
        return v

# This is the main output schema for displaying bookings
class BookingOut(BaseModel):
    id: int
    display_id: Optional[str] = None  # Format: BK-000001
    guest_name: str
    guest_mobile: str
    guest_email: str
    status: str
    check_in: date
    check_out: date
    adults: int
    children: int
    # --- CRITICAL FIX: Add the missing image URL fields ---
    id_card_image_url: Optional[str] = None
    guest_photo_url: Optional[str] = None
    user: Optional[UserOut] = None
    is_package: bool = False
    # ----------------------------------------------------
    rooms: List[RoomOut] = []
    
    @model_validator(mode='after')
    def set_display_id(self):
        """Auto-generate display_id if not provided"""
        if not self.display_id:
            self.display_id = f"BK-{str(self.id).zfill(6)}"
        return self

    class Config:
        from_attributes = True
