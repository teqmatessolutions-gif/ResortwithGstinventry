from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.schemas.service_request import ServiceRequestCreate, ServiceRequestOut, ServiceRequestUpdate
from app.curd import service_request as crud
from app.utils.auth import get_db, get_current_user
from app.models.user import User
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

router = APIRouter(prefix="/service-requests", tags=["Service Requests"])

@router.post("", response_model=ServiceRequestOut)
def create_service_request(
    request: ServiceRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return crud.create_service_request(db, request)

@router.get("")
def get_service_requests(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    include_checkout_requests: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get service requests. If include_checkout_requests is True, also includes checkout requests.
    Returns a list of dicts (not ServiceRequestOut) to support both service requests and checkout requests.
    """
    service_requests = crud.get_service_requests(db, skip=skip, limit=limit, status=status)
    
    # Convert service requests to dict format
    result = []
    for sr in service_requests:
        import json
        refill_data = None
        if sr.refill_data:
            try:
                refill_data = json.loads(sr.refill_data)
            except:
                refill_data = None
        
        result.append({
            "id": sr.id,
            "food_order_id": sr.food_order_id,
            "room_id": sr.room_id,
            "employee_id": sr.employee_id,
            "request_type": sr.request_type,
            "description": sr.description,
            "status": sr.status,
            "created_at": sr.created_at.isoformat() if sr.created_at else None,
            "completed_at": sr.completed_at.isoformat() if sr.completed_at else None,
            "is_checkout_request": False,
            "room_number": getattr(sr, 'room_number', None),
            "employee_name": getattr(sr, 'employee_name', None),
            "refill_data": refill_data
        })
    
    # Also include checkout requests as service requests
    if include_checkout_requests:
        from app.models.checkout import CheckoutRequest as CheckoutRequestModel
        from app.models.room import Room
        from sqlalchemy.orm import joinedload
        
        checkout_query = db.query(CheckoutRequestModel).options(
            joinedload(CheckoutRequestModel.employee)
        )
        
        # Show all checkout requests except cancelled ones
        # If status filter is provided, apply it; otherwise show all active statuses
        if status:
            checkout_query = checkout_query.filter(CheckoutRequestModel.status == status)
        else:
            # Show all non-cancelled checkout requests
            checkout_query = checkout_query.filter(
                CheckoutRequestModel.status.notin_(["cancelled"])
            )
        
        checkout_requests = checkout_query.order_by(CheckoutRequestModel.created_at.desc()).limit(limit * 2).offset(skip).all()
        
        # Convert checkout requests to service request-like format
        for cr in checkout_requests:
            room = db.query(Room).filter(Room.number == cr.room_number).first()
            if room:
                result.append({
                    "id": cr.id + 1000000,  # Offset to avoid conflicts with regular service requests
                    "food_order_id": None,
                    "room_id": room.id,
                    "employee_id": cr.employee_id,
                    "request_type": "checkout_verification",
                    "description": f"Checkout inventory verification for Room {cr.room_number} - Guest: {cr.guest_name}",
                    "status": cr.status,
                    "created_at": cr.created_at.isoformat() if cr.created_at else None,
                    "completed_at": cr.completed_at.isoformat() if cr.completed_at else None,
                    "is_checkout_request": True,
                    "checkout_request_id": cr.id,
                    "room_number": cr.room_number,
                    "guest_name": cr.guest_name,
                    "employee_name": cr.employee.name if cr.employee else None
                })
    
    return result

@router.get("/{request_id}", response_model=ServiceRequestOut)
def get_service_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    request = crud.get_service_request(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Service request not found")
    return request

@router.put("/{request_id}", response_model=ServiceRequestOut)
def update_service_request(
    request_id: int,
    update: ServiceRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    updated = crud.update_service_request(db, request_id, update)
    if not updated:
        raise HTTPException(status_code=404, detail="Service request not found")
    return updated

@router.delete("/{request_id}")
def delete_service_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    deleted = crud.delete_service_request(db, request_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Service request not found")
    return {"message": "Service request deleted successfully"}

