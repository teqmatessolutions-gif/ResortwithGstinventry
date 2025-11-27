from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime

class FoodOrderItem(BaseModel):
    item_name: str
    quantity: int
    amount: float

    class Config:
        from_attributes = True

class ServiceItem(BaseModel):
    service_name: str
    charges: float

    class Config:
        from_attributes = True

class BillBreakdown(BaseModel):
    room_charges: Optional[float] = 0.0
    food_charges: Optional[float] = 0.0
    service_charges: Optional[float] = 0.0
    package_charges: Optional[float] = 0.0
    
    # GST breakdown
    room_gst: Optional[float] = 0.0  # GST on room charges (5% if < 5000, 12% if 5000-7500, 18% if > 7500)
    food_gst: Optional[float] = 0.0  # GST on food charges (5% always)
    package_gst: Optional[float] = 0.0  # GST on package charges (5% if < 5000, 12% if 5000-7500, 18% if > 7500)
    total_gst: Optional[float] = 0.0  # Total GST amount
    
    # Detailed lists
    food_items: List[FoodOrderItem] = []
    service_items: List[ServiceItem] = []
    
    total_due: float = 0.0

class BillSummary(BaseModel):
    guest_name: str
    room_numbers: List[str]
    number_of_guests: int
    stay_nights: int
    check_in: date
    check_out: date
    charges: BillBreakdown

class CheckoutFull(BaseModel):
    id: int
    booking_id: Optional[int]
    package_booking_id: Optional[int]
    room_total: float = 0
    food_total: float = 0
    service_total: float = 0
    package_total: float = 0
    tax_amount: float = 0
    discount_amount: float = 0
    grand_total: float = 0
    payment_method: Optional[str] = ""
    payment_status: Optional[str] = "Paid"
    created_at: Optional[datetime]
    guest_name: Optional[str] = ""
    room_number: Optional[str] = ""

    class Config:
        from_attributes = True

class CheckoutDetail(BaseModel):
    id: int
    booking_id: Optional[int]
    package_booking_id: Optional[int]
    room_total: float = 0
    food_total: float = 0
    service_total: float = 0
    package_total: float = 0
    tax_amount: float = 0
    discount_amount: float = 0
    grand_total: float = 0
    payment_method: Optional[str] = ""
    payment_status: Optional[str] = "Paid"
    created_at: Optional[datetime]
    guest_name: Optional[str] = ""
    room_number: Optional[str] = ""
    food_orders: List[dict] = []
    services: List[dict] = []
    booking_details: Optional[dict] = None

    class Config:
        from_attributes = True

class CheckoutSuccess(BaseModel):
    message: str = "Checkout successful"
    checkout_id: int
    grand_total: float
    checkout_date: datetime
    
class CheckoutRequest(BaseModel):
    payment_method: str = Field(..., description="The method of payment (e.g., 'Card', 'Cash').")
    discount_amount: Optional[float] = Field(0.0, description="Optional discount amount to be applied.")
    checkout_mode: Optional[str] = Field("multiple", description="Checkout mode: 'single' for single room checkout or 'multiple' for all rooms in booking.")
