from sqlalchemy.orm import Session, joinedload
from app.models.service_request import ServiceRequest
from app.models.foodorder import FoodOrder
from app.models.room import Room
from app.models.employee import Employee
from app.schemas.service_request import ServiceRequestCreate, ServiceRequestUpdate
from typing import List, Optional
from datetime import datetime

def create_service_request(db: Session, request_data: ServiceRequestCreate):
    request = ServiceRequest(
        food_order_id=request_data.food_order_id,
        room_id=request_data.room_id,
        employee_id=request_data.employee_id,
        request_type=request_data.request_type,
        description=request_data.description,
        status="pending"
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request

def create_cleaning_service_request(db: Session, room_id: int, room_number: str, guest_name: str = None):
    """
    Create a cleaning service request after checkout.
    This is automatically triggered when a room is checked out.
    """
    request = ServiceRequest(
        food_order_id=None,  # Cleaning requests don't have food orders
        room_id=room_id,
        employee_id=None,  # Will be assigned later
        request_type="cleaning",
        description=f"Room cleaning required after checkout - Room {room_number}" + (f" (Guest: {guest_name})" if guest_name else ""),
        status="pending"
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request

def create_refill_service_request(db: Session, room_id: int, room_number: str, guest_name: str = None, checkout_id: int = None):
    """
    Create a refill service request after checkout.
    This is automatically triggered when a room is checked out to replenish inventory items.
    Refill requirements are calculated from the checkout consumables audit.
    """
    import json
    refill_items = []
    
    # Get refill requirements from checkout verification if checkout_id is provided
    if checkout_id:
        from app.models.checkout import CheckoutVerification
        from app.models.inventory import InventoryItem
        
        # Get the checkout verification for this room
        verification = db.query(CheckoutVerification).filter(
            CheckoutVerification.checkout_id == checkout_id,
            CheckoutVerification.room_number == room_number
        ).first()
        
        if verification and verification.consumables_audit_data:
            # Extract consumables data and calculate refill requirements
            consumables_data = verification.consumables_audit_data
            
            for item_id_str, item_data in consumables_data.items():
                try:
                    item_id = int(item_id_str)
                    actual_consumed = item_data.get("actual", 0)
                    
                    # Get inventory item details
                    inv_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
                    if inv_item and actual_consumed > 0:
                        # What was consumed needs to be refilled
                        refill_items.append({
                            "item_id": item_id,
                            "item_name": inv_item.name,
                            "item_code": inv_item.item_code,
                            "quantity_to_refill": actual_consumed,
                            "unit": inv_item.unit or "pcs"
                        })
                except (ValueError, KeyError):
                    continue
    
    # Build description with refill requirements
    description_parts = [f"Room inventory refill required after checkout - Room {room_number}"]
    if guest_name:
        description_parts.append(f"Previous Guest: {guest_name}")
    
    if refill_items:
        description_parts.append("Refill Requirements:")
        for item in refill_items:
            description_parts.append(f"- {item['item_name']}: {item['quantity_to_refill']} {item['unit']}")
    else:
        description_parts.append("Standard inventory refill required")
    
    request = ServiceRequest(
        food_order_id=None,  # Refill requests don't have food orders
        room_id=room_id,
        employee_id=None,  # Will be assigned later
        request_type="refill",
        description=" | ".join(description_parts),
        refill_data=json.dumps(refill_items) if refill_items else None,  # Store as JSON
        status="pending"
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request

def get_service_requests(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None):
    query = db.query(ServiceRequest).options(
        joinedload(ServiceRequest.food_order),
        joinedload(ServiceRequest.room),
        joinedload(ServiceRequest.employee)
    )
    
    if status:
        query = query.filter(ServiceRequest.status == status)
    
    requests = query.offset(skip).limit(limit).all()
    
    # Enrich with additional data
    for req in requests:
        if req.food_order:
            req.food_order_amount = req.food_order.amount
            req.food_order_status = req.food_order.status
        if req.room:
            req.room_number = req.room.number
        # Always set employee_name, even if None
        req.employee_name = req.employee.name if req.employee else None
    
    return requests

def get_service_request(db: Session, request_id: int):
    request = db.query(ServiceRequest).options(
        joinedload(ServiceRequest.food_order),
        joinedload(ServiceRequest.room),
        joinedload(ServiceRequest.employee)
    ).filter(ServiceRequest.id == request_id).first()
    
    if request:
        if request.food_order:
            request.food_order_amount = request.food_order.amount
            request.food_order_status = request.food_order.status
        if request.room:
            request.room_number = request.room.number
        # Always set employee_name, even if None
        request.employee_name = request.employee.name if request.employee else None
    
    return request

def update_service_request(db: Session, request_id: int, update_data: ServiceRequestUpdate):
    request = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not request:
        return None
    
    if update_data.status is not None:
        request.status = update_data.status
        if update_data.status == "completed":
            request.completed_at = datetime.utcnow()
    if update_data.employee_id is not None:
        request.employee_id = update_data.employee_id
    if update_data.description is not None:
        request.description = update_data.description
    
    db.commit()
    db.refresh(request)
    return request

def delete_service_request(db: Session, request_id: int):
    request = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if request:
        db.delete(request)
        db.commit()
    return request

