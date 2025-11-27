from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ServiceInventoryItemBase(BaseModel):
    inventory_item_id: int
    quantity: float = 1.0

class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    charges: float
    is_visible_to_guest: bool = False  # Toggle for guest visibility

class ServiceCreate(ServiceBase):
    inventory_items: Optional[List[ServiceInventoryItemBase]] = []  # List of inventory items with quantities


class ServiceImageOut(BaseModel):
    id: int
    image_url: str

    class Config:
        from_attributes = True


class ServiceInventoryItemOut(BaseModel):
    id: int
    name: str
    item_code: Optional[str] = None
    unit: str
    quantity: float  # Quantity from association table
    unit_price: Optional[float] = 0.0
    selling_price: Optional[float] = None
    
    class Config:
        from_attributes = True

class ServiceOut(ServiceBase):
    id: int
    created_at: datetime
    images: List[ServiceImageOut] = []
    inventory_items: List[ServiceInventoryItemOut] = []  # Include inventory items
    is_visible_to_guest: bool  # Include visibility flag

    class Config:
        from_attributes = True

class ServiceVisibilityUpdate(BaseModel):
    is_visible_to_guest: bool

# For employee and room resolution
class EmployeeOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class RoomOut(BaseModel):
    id: int
    number: str

    class Config:
        from_attributes = True

class ServiceStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"

class AssignedServiceBase(BaseModel):
    service_id: int
    employee_id: int
    room_id: int

class AssignedServiceCreate(AssignedServiceBase):
    pass

class AssignedServiceUpdate(BaseModel):
    status: ServiceStatus

class AssignedServiceOut(BaseModel):
    id: int
    service: ServiceOut
    employee: EmployeeOut
    room: RoomOut
    assigned_at: datetime
    status: ServiceStatus

    class Config:
        from_attributes = True
