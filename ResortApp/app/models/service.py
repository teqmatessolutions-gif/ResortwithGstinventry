from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Table, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum

class ServiceStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"

# Association table for many-to-many relationship between Service and InventoryItem
service_inventory_item = Table(
    'service_inventory_items',
    Base.metadata,
    Column('service_id', Integer, ForeignKey('services.id'), primary_key=True),
    Column('inventory_item_id', Integer, ForeignKey('inventory_items.id'), primary_key=True),
    Column('quantity', Float, default=1.0, nullable=False),  # Quantity of item needed for this service
    Column('created_at', DateTime, default=datetime.utcnow)
)

class Service(Base):
    __tablename__ = "services"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    charges = Column(Float, nullable=False)
    is_visible_to_guest = Column(Boolean, default=False, nullable=False)  # Toggle for guest visibility
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    images = relationship("ServiceImage", back_populates="service", cascade="all, delete-orphan")
    inventory_items = relationship(
        "InventoryItem",
        secondary=service_inventory_item,
        back_populates="services"
    )

class AssignedService(Base):
    __tablename__ = "assigned_services"
    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"))
    employee_id = Column(Integer, ForeignKey("employees.id"))
    room_id = Column(Integer, ForeignKey("rooms.id"))
    assigned_at = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(ServiceStatus), default=ServiceStatus.pending)
    billing_status = Column(String, default="unbilled")

    service = relationship("Service")
    employee = relationship("Employee")
    room = relationship("Room")
    # inventory_assignments relationship is defined in employee_inventory.py via backref


class ServiceImage(Base):
    __tablename__ = "service_images"
    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"))
    image_url = Column(String, nullable=False)
    
    # Relationships
    service = relationship("Service", back_populates="images")
