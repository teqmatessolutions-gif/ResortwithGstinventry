from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from typing import List, Optional
from datetime import date, datetime, timedelta

# Assume your utility and model imports are set up correctly
from app.utils.auth import get_db, get_current_user
from app.models.room import Room
from app.models.booking import Booking, BookingRoom
from app.models.Package import Package, PackageBooking, PackageBookingRoom
from app.models.user import User
from app.models.foodorder import FoodOrder, FoodOrderItem
from app.models.service import AssignedService, Service
from app.models.checkout import Checkout, CheckoutVerification, CheckoutPayment, CheckoutRequest as CheckoutRequestModel
from app.schemas.checkout import BillSummary, BillBreakdown, CheckoutFull, CheckoutSuccess, CheckoutRequest, InventoryCheckRequest
from app.utils.checkout_helpers import (
    calculate_late_checkout_fee, process_consumables_audit, process_asset_damage_check,
    deduct_room_consumables, trigger_linen_cycle, create_checkout_verification,
    process_split_payments, generate_invoice_number, calculate_gst_breakdown
)

router = APIRouter(prefix="/bill", tags=["checkout"])

# IMPORTANT: To support this new logic, you must update your BillSummary schema.
# In `app/schemas/checkout.py`, please change the `room_number: str` field to:
# room_numbers: List[str]


@router.post("/checkout-request")
def create_checkout_request(
    room_number: str = Query(..., description="Room number to create checkout request for"),
    checkout_mode: str = Query("multiple", description="Checkout mode: 'single' or 'multiple'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a checkout request for inventory verification before checkout.
    """
    # Find the booking for this room
    room = db.query(Room).filter(Room.number == room_number).first()
    if not room:
        raise HTTPException(status_code=404, detail=f"Room {room_number} not found")
    
    # Find active booking
    booking_link = (db.query(BookingRoom)
                    .join(Booking)
                    .filter(BookingRoom.room_id == room.id, Booking.status.in_(['checked-in', 'checked_in', 'booked']))
                    .order_by(Booking.id.desc()).first())
    
    package_link = None
    booking = None
    is_package = False
    
    if booking_link:
        booking = booking_link.booking
    else:
        package_link = (db.query(PackageBookingRoom)
                        .join(PackageBooking)
                        .filter(PackageBookingRoom.room_id == room.id, PackageBooking.status.in_(['checked-in', 'checked_in', 'booked']))
                        .order_by(PackageBooking.id.desc()).first())
        if package_link:
            booking = package_link.package_booking
            is_package = True
    
    if not booking:
        raise HTTPException(status_code=404, detail=f"No active booking found for room {room_number}")
    
    # Check if there's already a pending checkout request
    existing_request = None
    if is_package:
        existing_request = db.query(CheckoutRequestModel).filter(
            CheckoutRequestModel.package_booking_id == booking.id,
            CheckoutRequestModel.status.in_(["pending", "inventory_checked"])
        ).first()
    else:
        existing_request = db.query(CheckoutRequestModel).filter(
            CheckoutRequestModel.booking_id == booking.id,
            CheckoutRequestModel.status.in_(["pending", "inventory_checked"])
        ).first()
    
    if existing_request:
        return {
            "message": "Checkout request already exists",
            "request_id": existing_request.id,
            "status": existing_request.status,
            "inventory_checked": existing_request.inventory_checked
        }
    
    # Create new checkout request
    try:
        requested_by_name = getattr(current_user, 'name', None) or getattr(current_user, 'email', None) or "system"
        
        new_request = CheckoutRequestModel(
            booking_id=booking.id if not is_package else None,
            package_booking_id=booking.id if is_package else None,
            room_number=room_number,
            guest_name=booking.guest_name,
            status="pending",
            requested_by=requested_by_name,
            inventory_checked=False
        )
        
        db.add(new_request)
        db.commit()
        db.refresh(new_request)
        
        return {
            "message": "Checkout request created successfully",
            "request_id": new_request.id,
            "status": new_request.status,
            "room_number": room_number,
            "guest_name": booking.guest_name
        }
    except Exception as e:
        db.rollback()
        import traceback
        error_details = traceback.format_exc()
        print(f"Error creating checkout request: {error_details}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout request: {str(e)}")


@router.get("/checkout-request/{room_number}")
def get_checkout_request(
    room_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get checkout request status for a room.
    """
    room = db.query(Room).filter(Room.number == room_number).first()
    if not room:
        raise HTTPException(status_code=404, detail=f"Room {room_number} not found")
    
    # Find active booking
    booking_link = (db.query(BookingRoom)
                    .join(Booking)
                    .filter(BookingRoom.room_id == room.id, Booking.status.in_(['checked-in', 'checked_in', 'booked']))
                    .order_by(Booking.id.desc()).first())
    
    package_link = None
    booking = None
    is_package = False
    
    if booking_link:
        booking = booking_link.booking
    else:
        package_link = (db.query(PackageBookingRoom)
                        .join(PackageBooking)
                        .filter(PackageBookingRoom.room_id == room.id, PackageBooking.status.in_(['checked-in', 'checked_in', 'booked']))
                        .order_by(PackageBooking.id.desc()).first())
        if package_link:
            booking = package_link.package_booking
            is_package = True
    
    if not booking:
        return {"exists": False, "status": None}
    
    # Find checkout request
    checkout_request = None
    if is_package:
        checkout_request = db.query(CheckoutRequestModel).filter(
            CheckoutRequestModel.package_booking_id == booking.id
        ).order_by(CheckoutRequestModel.id.desc()).first()
    else:
        checkout_request = db.query(CheckoutRequestModel).filter(
            CheckoutRequestModel.booking_id == booking.id
        ).order_by(CheckoutRequestModel.id.desc()).first()
    
    if not checkout_request:
        return {"exists": False, "status": None}
    
    return {
        "exists": True,
        "request_id": checkout_request.id,
        "status": checkout_request.status,
        "inventory_checked": checkout_request.inventory_checked,
        "inventory_checked_by": checkout_request.inventory_checked_by,
        "inventory_checked_at": checkout_request.inventory_checked_at.isoformat() if checkout_request.inventory_checked_at else None,
        "inventory_notes": checkout_request.inventory_notes,
        "requested_at": checkout_request.requested_at.isoformat() if checkout_request.requested_at else None,
        "requested_by": checkout_request.requested_by,
        "employee_id": checkout_request.employee_id,
        "employee_name": checkout_request.employee.name if checkout_request.employee else None
    }


@router.put("/checkout-request/{request_id}/status")
def update_checkout_request_status(
    request_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update checkout request status directly.
    Allowed transitions: pending -> in_progress/inventory_checked/completed
    """
    checkout_request = db.query(CheckoutRequestModel).filter(CheckoutRequestModel.id == request_id).first()
    if not checkout_request:
        raise HTTPException(status_code=404, detail="Checkout request not found")
    
    valid_statuses = ["pending", "in_progress", "inventory_checked", "completed", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    # Update status
    checkout_request.status = status
    
    # If moving to completed, mark inventory as checked
    if status == "completed":
        checkout_request.inventory_checked = True
        checkout_request.inventory_checked_by = getattr(current_user, 'name', None) or getattr(current_user, 'email', None) or "system"
        checkout_request.inventory_checked_at = datetime.utcnow()
        checkout_request.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(checkout_request)
    
    return {
        "message": f"Checkout request status updated to {status}",
        "request_id": checkout_request.id,
        "status": checkout_request.status,
        "inventory_checked": checkout_request.inventory_checked
    }


@router.put("/checkout-request/{request_id}/assign")
def assign_employee_to_checkout_request(
    request_id: int,
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Assign an employee to a checkout request.
    """
    from app.models.employee import Employee
    
    checkout_request = db.query(CheckoutRequestModel).filter(CheckoutRequestModel.id == request_id).first()
    if not checkout_request:
        raise HTTPException(status_code=404, detail="Checkout request not found")
    
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    checkout_request.employee_id = employee_id
    checkout_request.status = "in_progress"
    
    db.commit()
    db.refresh(checkout_request)
    
    return {
        "message": "Employee assigned successfully",
        "request_id": checkout_request.id,
        "employee_id": checkout_request.employee_id,
        "employee_name": employee.name,
        "status": checkout_request.status
    }


@router.get("/checkout-request/{request_id}/inventory-details")
def get_checkout_request_inventory_details(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get current inventory details for a checkout request room.
    """
    checkout_request = db.query(CheckoutRequestModel).filter(CheckoutRequestModel.id == request_id).first()
    if not checkout_request:
        raise HTTPException(status_code=404, detail="Checkout request not found")
    
    room = db.query(Room).filter(Room.number == checkout_request.room_number).first()
    if not room:
        raise HTTPException(status_code=404, detail=f"Room {checkout_request.room_number} not found")
    
    # Get inventory items for the room location
    from app.models.inventory import Location
    
    if not room.inventory_location_id:
        return {
            "room_number": checkout_request.room_number,
            "items": [],
            "message": "No inventory location assigned to this room"
        }
    
    # Get location items using the inventory API endpoint logic
    location = db.query(Location).filter(Location.id == room.inventory_location_id).first()
    if not location:
        return {
            "room_number": checkout_request.room_number,
            "items": [],
            "message": "Inventory location not found"
        }
    
    # Get location items directly using the same logic as inventory endpoint
    try:
        from app.models.inventory import InventoryItem, StockIssue, StockIssueDetail
        
        # Get all items that have been issued to this location
        # Query through StockIssueDetail to find items at this location
        issued_items = (
            db.query(InventoryItem)
            .join(StockIssueDetail, StockIssueDetail.item_id == InventoryItem.id)
            .join(StockIssue, StockIssue.id == StockIssueDetail.issue_id)
            .filter(StockIssue.destination_location_id == room.inventory_location_id)
            .distinct()
            .all()
        )
        
        items_list = []
        for item in issued_items:
            # Get issue details for this item at this location
            issue_details = db.query(StockIssueDetail).join(StockIssue).filter(
                StockIssueDetail.item_id == item.id,
                StockIssue.destination_location_id == room.inventory_location_id
            ).all()
            
            # Calculate complimentary and payable quantities
            complimentary_qty = 0
            payable_qty = 0
            stock_value = 0
            
            for detail in issue_details:
                # Parse notes to check if payable
                notes = detail.notes or ""
                is_payable = "is_payable:true" in notes.lower() or "payable" in notes.lower()
                
                if is_payable:
                    payable_qty += detail.quantity
                    stock_value += detail.quantity * (item.unit_price or 0)
                else:
                    complimentary_qty += detail.quantity
            
            items_list.append({
                "id": item.id,
                "name": item.name,
                "item_code": item.item_code,
                "current_stock": item.current_stock or 0,
                "complimentary_qty": complimentary_qty,
                "payable_qty": payable_qty,
                "stock_value": stock_value,
                "unit": item.unit,
                "unit_price": item.unit_price or 0
            })
        
        return {
            "room_number": checkout_request.room_number,
            "guest_name": checkout_request.guest_name,
            "items": items_list,
            "location_name": location.name
        }
    except Exception as e:
        import traceback
        print(f"Error getting inventory details: {traceback.format_exc()}")
        return {
            "room_number": checkout_request.room_number,
            "items": [],
            "error": str(e)
        }


@router.post("/checkout-request/{request_id}/check-inventory")
def check_inventory_for_checkout(
    request_id: int,
    payload: InventoryCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark inventory as checked and complete the checkout request.
    Stores used/missing items in inventory_data.
    Calculates charges for missing items.
    """
    from app.models.inventory import InventoryItem
    
    checkout_request = db.query(CheckoutRequestModel).filter(CheckoutRequestModel.id == request_id).first()
    if not checkout_request:
        raise HTTPException(status_code=404, detail="Checkout request not found")
    
    if checkout_request.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot check inventory for a cancelled request")
    
    checkout_request.inventory_checked = True
    checkout_request.inventory_checked_by = getattr(current_user, 'name', None) or getattr(current_user, 'email', None) or "system"
    checkout_request.inventory_checked_at = datetime.utcnow()
    checkout_request.inventory_notes = payload.inventory_notes
    
    # Store inventory data and calculate charges for missing items
    total_missing_charges = 0.0
    missing_items_details = []
    
    if payload.items:
        inventory_data_with_charges = []
        
        for item in payload.items:
            item_dict = item.dict()
            
            # Calculate charge for missing items
            if item.missing_qty and item.missing_qty > 0:
                inv_item = db.query(InventoryItem).filter(InventoryItem.id == item.item_id).first()
                if inv_item:
                    if inv_item.price:
                        item_charge = float(inv_item.price) * item.missing_qty
                        total_missing_charges += item_charge
                        item_dict['missing_item_charge'] = item_charge
                        item_dict['unit_price'] = float(inv_item.price)
                        
                        missing_items_details.append({
                            "item_name": inv_item.name,
                            "item_code": inv_item.item_code,
                            "missing_qty": item.missing_qty,
                            "unit_price": float(inv_item.price),
                            "total_charge": item_charge
                        })
                    
                    item_dict['item_name'] = inv_item.name
                    item_dict['item_code'] = inv_item.item_code
            
            inventory_data_with_charges.append(item_dict)
        
        checkout_request.inventory_data = inventory_data_with_charges
        
    checkout_request.status = "completed"
    checkout_request.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(checkout_request)
    
    return {
        "message": "Inventory checked and checkout request completed successfully",
        "request_id": checkout_request.id,
        "status": checkout_request.status,
        "inventory_checked": True,
        "missing_items_charge": total_missing_charges,
        "missing_items_details": missing_items_details
    }


@router.get("/pre-checkout/{room_number}/verification-data")
def get_pre_checkout_verification_data(room_number: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Get pre-checkout verification data for a room:
    - Room inspection status from housekeeping
    - Consumables list with complimentary limits
    - Room assets that can be damaged
    - Current room status
    """
    room = db.query(Room).filter(Room.number == room_number).first()
    if not room:
        raise HTTPException(status_code=404, detail=f"Room {room_number} not found")
    
    # Get booking info
    booking_link = (db.query(BookingRoom)
                    .join(Booking)
                    .filter(BookingRoom.room_id == room.id, Booking.status.in_(['checked-in', 'checked_in', 'booked']))
                    .order_by(Booking.id.desc()).first())
    
    package_link = None
    booking = None
    if booking_link:
        booking = booking_link.booking
    else:
        package_link = (db.query(PackageBookingRoom)
                        .join(PackageBooking)
                        .filter(PackageBookingRoom.room_id == room.id, PackageBooking.status.in_(['checked-in', 'checked_in', 'booked']))
                        .order_by(PackageBooking.id.desc()).first())
        if package_link:
            booking = package_link.package_booking
    
    if not booking:
        raise HTTPException(status_code=404, detail=f"No active booking found for room {room_number}")
    
    # Get consumables from room inventory location
    consumables = []
    if room.inventory_location_id:
        from app.models.inventory import InventoryItem, InventoryCategory
        location_items = db.query(InventoryItem).join(InventoryCategory).filter(
            InventoryItem.category_id == InventoryCategory.id,
            InventoryCategory.consumable_instant == True,  # Only consumable items
            InventoryItem.is_sellable_to_guest == True
        ).all()
        
        for item in location_items:
            consumables.append({
                "item_id": item.id,
                "item_name": item.name,
                "complimentary_limit": item.complimentary_limit or 0,
                "charge_per_unit": item.selling_price or item.unit_price or 0.0,
                "unit": item.unit
            })
    
    # Get room assets (items that can be damaged - typically fixed assets)
    from app.models.inventory import InventoryItem
    room_assets = db.query(InventoryItem).filter(
        InventoryItem.is_asset_fixed == True,
        InventoryItem.is_sellable_to_guest == False
    ).limit(20).all()  # Common room assets
    
    assets = [
        {
            "item_name": asset.name,
            "replacement_cost": asset.selling_price or asset.unit_price or 0.0
        }
        for asset in room_assets
    ]
    
    # Default key card fee (configurable)
    key_card_fee = 50.0
    
    return {
        "room_number": room_number,
        "room_status": room.status,
        "housekeeping_status": "pending",  # Will be updated by housekeeping module
        "consumables": consumables,
        "assets": assets,
        "key_card_fee": key_card_fee,
        "booking_info": {
            "guest_name": booking.guest_name,
            "check_in": str(booking.check_in),
            "check_out": str(booking.check_out),
            "advance_deposit": getattr(booking, 'advance_deposit', 0.0) or 0.0
        }
    }


@router.get("/checkout/{checkout_id}/invoice")
def generate_invoice(checkout_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Generate tax invoice PDF for a checkout
    Includes HSN codes, tax breakdown, QR code, and GSTIN if B2B
    """
    checkout = db.query(Checkout).filter(Checkout.id == checkout_id).first()
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout not found")
    
    # Get booking details
    booking = None
    if checkout.booking_id:
        booking = db.query(Booking).filter(Booking.id == checkout.booking_id).first()
    elif checkout.package_booking_id:
        booking = db.query(PackageBooking).filter(PackageBooking.id == checkout.package_booking_id).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found for this checkout")
    
    # Get verification data
    verifications = db.query(CheckoutVerification).filter(CheckoutVerification.checkout_id == checkout_id).all()
    
    # Get payment details
    payments = db.query(CheckoutPayment).filter(CheckoutPayment.checkout_id == checkout_id).all()
    
    # Build invoice data
    invoice_data = {
        "invoice_number": checkout.invoice_number or f"INV-{checkout_id}",
        "invoice_date": checkout.checkout_date.strftime("%d-%m-%Y") if checkout.checkout_date else datetime.now().strftime("%d-%m-%Y"),
        "guest_name": checkout.guest_name,
        "guest_mobile": booking.guest_mobile if booking else None,
        "guest_email": booking.guest_email if booking else None,
        "guest_gstin": checkout.guest_gstin,
        "is_b2b": checkout.is_b2b,
        "room_number": checkout.room_number,
        "check_in": str(booking.check_in) if booking else None,
        "check_out": str(booking.check_out) if booking else None,
        "charges": {
            "room_total": checkout.room_total,
            "food_total": checkout.food_total,
            "service_total": checkout.service_total,
            "package_total": checkout.package_total,
            "consumables_charges": checkout.consumables_charges,
            "asset_damage_charges": checkout.asset_damage_charges,
            "key_card_fee": checkout.key_card_fee,
            "late_checkout_fee": checkout.late_checkout_fee,
            "subtotal": checkout.room_total + checkout.food_total + checkout.service_total + 
                       checkout.package_total + checkout.consumables_charges + 
                       checkout.asset_damage_charges + checkout.key_card_fee + checkout.late_checkout_fee,
            "tax_amount": checkout.tax_amount,
            "discount_amount": checkout.discount_amount,
            "advance_deposit": checkout.advance_deposit,
            "tips_gratuity": checkout.tips_gratuity,
            "grand_total": checkout.grand_total
        },
        "verifications": [
            {
                "room_number": v.room_number,
                "housekeeping_status": v.housekeeping_status,
                "consumables_total": v.consumables_total_charge,
                "asset_damage_total": v.asset_damage_total,
                "key_card_fee": v.key_card_fee
            }
            for v in verifications
        ],
        "payments": [
            {
                "method": p.payment_method,
                "amount": p.amount,
                "transaction_id": p.transaction_id
            }
            for p in payments
        ]
    }
    
    # TODO: Generate actual PDF using reportlab or similar
    # For now, return JSON data that frontend can use to generate PDF
    return invoice_data


@router.get("/checkout/{checkout_id}/gate-pass")
def generate_gate_pass(checkout_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Generate gate pass for security (proof of payment for vehicle exit)
    """
    checkout = db.query(Checkout).filter(Checkout.id == checkout_id).first()
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout not found")
    
    gate_pass_data = {
        "gate_pass_number": f"GP-{checkout_id}-{datetime.now().strftime('%Y%m%d')}",
        "checkout_id": checkout_id,
        "guest_name": checkout.guest_name,
        "room_number": checkout.room_number,
        "checkout_date": checkout.checkout_date.strftime("%d-%m-%Y %H:%M") if checkout.checkout_date else None,
        "payment_status": checkout.payment_status,
        "grand_total": checkout.grand_total,
        "generated_at": datetime.now().strftime("%d-%m-%Y %H:%M:%S")
    }
    
    # TODO: Generate actual gate pass PDF/slip
    return gate_pass_data


@router.post("/checkout/{checkout_id}/send-feedback")
def send_feedback_form(checkout_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Trigger guest feedback form email/SMS
    """
    checkout = db.query(Checkout).filter(Checkout.id == checkout_id).first()
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout not found")
    
    booking = None
    if checkout.booking_id:
        booking = db.query(Booking).filter(Booking.id == checkout.booking_id).first()
    elif checkout.package_booking_id:
        booking = db.query(PackageBooking).filter(PackageBooking.id == checkout.package_booking_id).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Mark feedback as sent
    checkout.feedback_sent = True
    db.commit()
    
    # TODO: Send actual email/SMS with feedback link
    # For now, return feedback link
    feedback_link = f"https://your-resort.com/feedback/{checkout_id}"
    
    return {
        "message": "Feedback form sent successfully",
        "feedback_link": feedback_link,
        "guest_email": booking.guest_email,
        "guest_mobile": booking.guest_mobile
    }


@router.get("/checkouts", response_model=List[CheckoutFull])
def get_all_checkouts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), skip: int = 0, limit: int = 20):
    """Retrieves a list of all completed checkouts, ordered by most recent - optimized for low network"""
    from app.utils.api_optimization import optimize_limit, MAX_LIMIT_LOW_NETWORK
    limit = optimize_limit(limit, MAX_LIMIT_LOW_NETWORK)
    checkouts = db.query(Checkout).order_by(Checkout.id.desc()).offset(skip).limit(limit).all()
    return checkouts if checkouts else []

@router.post("/cleanup-orphaned-checkouts")
def cleanup_orphaned_checkouts_endpoint(
    room_number: Optional[str] = Query(None),
    booking_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manual cleanup endpoint for orphaned checkouts.
    Can clean up by room_number or booking_id.
    """
    try:
        deleted_count = 0
        checkouts_to_delete = []
        
        if room_number:
            # Find checkouts for this room where room is still checked-in
            room = db.query(Room).filter(Room.number == room_number).first()
            if not room:
                raise HTTPException(status_code=404, detail=f"Room {room_number} not found")
            
            if room.status != "Available":
                checkouts = db.query(Checkout).filter(
                    Checkout.room_number == room_number
                ).all()
                checkouts_to_delete.extend(checkouts)
        
        if booking_id:
            # Find checkouts for this booking
            booking = db.query(Booking).filter(Booking.id == booking_id).first()
            if not booking:
                raise HTTPException(status_code=404, detail=f"Booking {booking_id} not found")
            
            checkouts = db.query(Checkout).filter(
                Checkout.booking_id == booking_id
            ).all()
            checkouts_to_delete.extend(checkouts)
        
        # Remove duplicates
        unique_checkouts = {c.id: c for c in checkouts_to_delete}.values()
        
        for checkout in unique_checkouts:
            room = db.query(Room).filter(Room.number == checkout.room_number).first()
            if room and room.status != "Available":
                db.delete(checkout)
                deleted_count += 1
                print(f"[CLEANUP] Deleted orphaned checkout {checkout.id} for room {checkout.room_number}")
        
        db.commit()
        
        return {
            "message": f"Cleaned up {deleted_count} orphaned checkout(s)",
            "deleted_count": deleted_count
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

@router.post("/repair-room-status/{room_number}")
def repair_room_checkout_status(room_number: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Repair function to fix mismatched checkout status.
    If a checkout record exists but room is not marked as Available, fix the room status.
    If room is Available but no checkout record exists, create a minimal checkout record.
    """
    from app.models.room import Room
    from app.models.booking import Booking, BookingRoom
    from app.models.packages import PackageBooking, PackageBookingRoom
    
    room = db.query(Room).filter(Room.number == room_number).first()
    if not room:
        raise HTTPException(status_code=404, detail=f"Room {room_number} not found")
    
    # Check for existing checkout records
    today = date.today()
    existing_checkout = db.query(Checkout).filter(
        Checkout.room_number == room_number,
        func.date(Checkout.checkout_date) == today
    ).first()
    
    # Find the booking
    booking_link = (db.query(BookingRoom)
                    .join(Booking)
                    .filter(BookingRoom.room_id == room.id)
                    .order_by(Booking.id.desc()).first())
    
    package_link = None
    booking = None
    is_package = False
    
    if booking_link:
        booking = booking_link.booking
    else:
        package_link = (db.query(PackageBookingRoom)
                       .join(PackageBooking)
                       .filter(PackageBookingRoom.room_id == room.id)
                       .order_by(PackageBooking.id.desc()).first())
        if package_link:
            booking = package_link.package_booking
            is_package = True
    
    repairs_made = []
    
    # Case 1: Checkout record exists but room is not Available
    if existing_checkout and room.status != "Available":
        room.status = "Available"
        repairs_made.append(f"Updated room {room_number} status to 'Available' (checkout record exists)")
        
        # Check if all rooms in booking are checked out
        if booking:
            if is_package:
                remaining_rooms = [link.room for link in booking.rooms if link.room.status != "Available"]
            else:
                remaining_rooms = [link.room for link in booking.booking_rooms if link.room.status != "Available"]
            
            if not remaining_rooms and booking.status not in ['checked_out', 'checked-out']:
                booking.status = "checked_out"
                repairs_made.append(f"Updated booking {booking.id} status to 'checked_out' (all rooms checked out)")
    
    # Case 2: Room is Available but no checkout record (might have been manually set)
    elif room.status == "Available" and not existing_checkout:
        # Room is available but no checkout record - this is okay, just note it
        repairs_made.append(f"Room {room_number} is Available but no checkout record found (this is okay if room was manually set)")
    
    # Case 3: Booking status is checked_out but room is not Available
    elif booking and booking.status in ['checked_out', 'checked-out'] and room.status != "Available":
        # This shouldn't happen, but fix it
        if existing_checkout:
            room.status = "Available"
            repairs_made.append(f"Fixed room {room_number} status to match booking status")
        else:
            # Booking says checked out but room and checkout don't match - reset booking status
            booking.status = "checked-in"
            repairs_made.append(f"Reset booking {booking.id} status to 'checked-in' (room not actually checked out)")
    
    if repairs_made:
        db.commit()
        return {"message": "Repairs completed", "repairs": repairs_made}
    else:
        return {"message": "No repairs needed", "status": "Room and booking status are consistent"}

@router.get("/checkouts/{checkout_id}/details")
def get_checkout_details(checkout_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get detailed checkout information including food orders and services."""
    checkout = db.query(Checkout).filter(Checkout.id == checkout_id).first()
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout not found")
    
    # Get room numbers from booking
    room_numbers = []
    booking_details = None
    
    if checkout.booking_id:
        booking = db.query(Booking).options(
            joinedload(Booking.booking_rooms).joinedload(BookingRoom.room)
        ).filter(Booking.id == checkout.booking_id).first()
        if booking:
            room_numbers = [br.room.number for br in booking.booking_rooms if br.room]
            booking_details = {
                "check_in": str(booking.check_in),
                "check_out": str(booking.check_out),
                "adults": booking.adults,
                "children": booking.children,
                "status": booking.status
            }
    elif checkout.package_booking_id:
        package_booking = db.query(PackageBooking).options(
            joinedload(PackageBooking.rooms).joinedload(PackageBookingRoom.room)
        ).filter(PackageBooking.id == checkout.package_booking_id).first()
        if package_booking:
            room_numbers = [pbr.room.number for pbr in package_booking.rooms if pbr.room]
            booking_details = {
                "check_in": str(package_booking.check_in),
                "check_out": str(package_booking.check_out),
                "adults": package_booking.adults,
                "children": package_booking.children,
                "status": package_booking.status,
                "package_name": package_booking.package.title if package_booking.package else None
            }
    
    # Get food orders for these rooms
    food_orders = []
    if room_numbers:
        rooms = db.query(Room).filter(Room.number.in_(room_numbers)).all()
        room_ids = [r.id for r in rooms]
        if room_ids:
            orders = db.query(FoodOrder).options(
                joinedload(FoodOrder.items).joinedload(FoodOrderItem.food_item)
            ).filter(FoodOrder.room_id.in_(room_ids)).all()
            for order in orders:
                food_orders.append({
                    "id": order.id,
                    "room_number": next((r.number for r in rooms if r.id == order.room_id), None),
                    "amount": order.amount,
                    "status": order.status,
                    "created_at": order.created_at.isoformat() if order.created_at else None,
                    "items": [
                        {
                            "item_name": item.food_item.name if item.food_item else "Unknown",
                            "quantity": item.quantity,
                            "price": item.food_item.price if item.food_item else 0,
                            "total": item.quantity * (item.food_item.price if item.food_item else 0)
                        }
                        for item in order.items
                    ]
                })
    
    # Get services for these rooms
    services = []
    if room_numbers:
        rooms = db.query(Room).filter(Room.number.in_(room_numbers)).all()
        room_ids = [r.id for r in rooms]
        if room_ids:
            assigned_services = db.query(AssignedService).options(
                joinedload(AssignedService.service)
            ).filter(AssignedService.room_id.in_(room_ids)).all()
            for ass in assigned_services:
                services.append({
                    "id": ass.id,
                    "room_number": next((r.number for r in rooms if r.id == ass.room_id), None),
                    "service_name": ass.service.name if ass.service else "Unknown",
                    "charges": ass.service.charges if ass.service else 0,
                    "status": ass.status,
                    "created_at": ass.assigned_at.isoformat() if ass.assigned_at else None
                })
    
    return {
        "id": checkout.id,
        "booking_id": checkout.booking_id,
        "package_booking_id": checkout.package_booking_id,
        "room_total": checkout.room_total,
        "food_total": checkout.food_total,
        "service_total": checkout.service_total,
        "package_total": checkout.package_total,
        "tax_amount": checkout.tax_amount,
        "discount_amount": checkout.discount_amount,
        "grand_total": checkout.grand_total,
        "payment_method": checkout.payment_method,
        "payment_status": checkout.payment_status,
        "created_at": checkout.created_at.isoformat() if checkout.created_at else None,
        "guest_name": checkout.guest_name,
        "room_number": checkout.room_number,
        "room_numbers": room_numbers,
        "food_orders": food_orders,
        "services": services,
        "booking_details": booking_details
    }

@router.get("/active-rooms", response_model=List[dict])
def get_active_rooms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), skip: int = 0, limit: int = 20):
    """
    Returns a list of active rooms available for checkout with two options:
    1. Individual rooms (for single room checkout)
    2. Grouped bookings (for multiple room checkout together)
    Used to populate the checkout dropdown on the frontend.
    """
    try:
        # Fetch active bookings and package bookings with their rooms preloaded
        # Include both 'checked-in' and 'CHECKED-IN' status (case-insensitive matching)
        # Exclude 'booked' status - only show rooms that are already checked-in
        active_bookings = db.query(Booking).options(
            joinedload(Booking.booking_rooms).joinedload(BookingRoom.room)
        ).filter(
            func.lower(Booking.status).in_(['checked-in', 'checked_in', 'checked in'])
        ).all()
        
        active_package_bookings = db.query(PackageBooking).options(
            joinedload(PackageBooking.rooms).joinedload(PackageBookingRoom.room)
        ).filter(
            func.lower(PackageBooking.status).in_(['checked-in', 'checked_in', 'checked in'])
        ).all()
        
        result = []
        
        # Debug: Log what we found
        print(f"[DEBUG active-rooms] Found {len(active_bookings)} regular bookings and {len(active_package_bookings)} package bookings")
        for b in active_bookings[:5]:  # Log first 5 to avoid spam
            print(f"[DEBUG] Booking {b.id}: status='{b.status}', rooms={len(b.booking_rooms)}")
            for br in b.booking_rooms[:3]:  # Log first 3 rooms per booking
                if br.room:
                    print(f"[DEBUG]   Room {br.room.number}: status='{br.room.status}'")
        
        # Helper function to safely get room number
        def get_room_number(link):
            """Safely extract room number from booking room link"""
            try:
                if not link:
                    return None
                if not link.room:
                    return None
                room_num = link.room.number
                if room_num is None or (isinstance(room_num, str) and room_num.strip() == ""):
                    return None
                return str(room_num).strip()
            except (AttributeError, Exception):
                return None
        
        # Process regular bookings
        for booking in active_bookings:
            # CRITICAL FIX: If booking is checked-in but rooms are "Available", repair the room status
            # This handles cases where room status was incorrectly set or changed
            for link in booking.booking_rooms:
                if link.room and link.room.status and link.room.status.lower() == "available":
                    # Booking is checked-in but room shows as Available - this is inconsistent
                    # Repair: Set room status to "Checked-in" to match booking status
                    print(f"[DEBUG active-rooms] Repairing room {link.room.number}: status was 'Available', setting to 'Checked-in' (booking {booking.id} is checked-in)")
                    link.room.status = "Checked-in"
                    db.add(link.room)
            
            # Commit room status repairs before filtering
            db.commit()
            
            # Extract room numbers with proper null checks using helper function
            # Also filter out rooms that are already checked out (status = "Available")
            room_numbers = sorted([
                room_num for link in booking.booking_rooms 
                if (room_num := get_room_number(link)) is not None
                and link.room 
                and link.room.status 
                and link.room.status.lower() not in ["available", "checked-out", "checked_out", "checked out"]  # Exclude already checked-out rooms
            ])
            if room_numbers:
                # Add individual room options (one per room)
                for room_num in room_numbers:
                    result.append({
                        "room_number": room_num,
                        "room_numbers": [room_num],  # Single room
                        "guest_name": booking.guest_name,
                        "booking_id": booking.id,
                        "booking_type": "regular",
                        "checkout_mode": "single",
                        "display_label": f"Room {room_num} ({booking.guest_name})"
                    })
                
                # Add grouped booking option (all rooms together) - only if more than 1 room
                if len(room_numbers) > 1:
                    first_room = room_numbers[0]
                    result.append({
                        "room_number": first_room,  # Primary room for checkout API
                        "room_numbers": room_numbers,  # All rooms in this booking
                        "guest_name": booking.guest_name,
                        "booking_id": booking.id,
                        "booking_type": "regular",
                        "checkout_mode": "multiple",
                        "display_label": f"All Rooms in Booking #{booking.id}: {', '.join(room_numbers)} ({booking.guest_name})"
                    })
        
        # Process package bookings
        for pkg_booking in active_package_bookings:
            # CRITICAL FIX: If booking is checked-in but rooms are "Available", repair the room status
            for link in pkg_booking.rooms:
                if link.room and link.room.status and link.room.status.lower() == "available":
                    # Booking is checked-in but room shows as Available - this is inconsistent
                    # Repair: Set room status to "Checked-in" to match booking status
                    print(f"[DEBUG active-rooms] Repairing room {link.room.number}: status was 'Available', setting to 'Checked-in' (package booking {pkg_booking.id} is checked-in)")
                    link.room.status = "Checked-in"
                    db.add(link.room)
            
            # Commit room status repairs before filtering
            db.commit()
            
            # Extract room numbers with proper null checks using helper function
            # Also filter out rooms that are already checked out (status = "Available" or "available")
            # Include rooms with status "Checked-in", "Checked_in", "checked-in", etc.
            room_numbers = sorted([
                room_num for link in pkg_booking.rooms 
                if (room_num := get_room_number(link)) is not None
                and link.room 
                and link.room.status 
                and link.room.status.lower() not in ["available", "checked-out", "checked_out", "checked out"]  # Exclude already checked-out rooms
            ])
            if room_numbers:
                # Add individual room options (one per room)
                for room_num in room_numbers:
                    result.append({
                        "room_number": room_num,
                        "room_numbers": [room_num],  # Single room
                        "guest_name": pkg_booking.guest_name,
                        "booking_id": pkg_booking.id,
                        "booking_type": "package",
                        "checkout_mode": "single",
                        "display_label": f"Room {room_num} ({pkg_booking.guest_name})"
                    })
                
                # Add grouped booking option (all rooms together) - only if more than 1 room
                if len(room_numbers) > 1:
                    first_room = room_numbers[0]
                    result.append({
                        "room_number": first_room,  # Primary room for checkout API
                        "room_numbers": room_numbers,  # All rooms in this booking
                        "guest_name": pkg_booking.guest_name,
                        "booking_id": pkg_booking.id,
                        "booking_type": "package",
                        "checkout_mode": "multiple",
                        "display_label": f"All Rooms in Package #{pkg_booking.id}: {', '.join(room_numbers)} ({pkg_booking.guest_name})"
                    })
        
        # Sort by booking ID descending (most recent first)
        result = sorted(result, key=lambda x: x['booking_id'], reverse=True)
        
        # Debug: Log final result
        print(f"[DEBUG active-rooms] Final result: {len(result)} room options")
        if len(result) == 0:
            print("[DEBUG active-rooms] WARNING: No rooms found! Possible reasons:")
            print(f"  - No bookings with status 'checked-in' or 'checked_in'")
            print(f"  - All rooms in checked-in bookings have status 'Available' (already checked out)")
            print(f"  - Room status values don't match expected format")
        
        return result[skip:skip+limit]
    except Exception as e:
        # Return empty list on error to prevent 500 response
        import traceback
        print(f"[ERROR active-rooms] Exception: {str(e)}")
        print(traceback.format_exc())
        return []

def _calculate_bill_for_single_room(db: Session, room_number: str):
    """
    Calculates bill for a single room only, regardless of how many rooms are in the booking.
    """
    # 1. Find the room
    room = db.query(Room).filter(Room.number == room_number).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")
    
    # 2. Find the active parent booking (regular or package) linked to this room
    booking, is_package = None, False
    
    booking_link = (db.query(BookingRoom)
                    .join(Booking)
                    .options(joinedload(BookingRoom.booking))
                    .filter(BookingRoom.room_id == room.id, Booking.status.in_(['checked-in', 'checked_in', 'booked']))
                    .order_by(Booking.id.desc()).first())
    
    if booking_link:
        booking = booking_link.booking
        if booking.status not in ['checked-in', 'checked_in', 'booked']:
            raise HTTPException(status_code=400, detail=f"Booking is not in a valid state for checkout. Current status: {booking.status}")
    else:
        package_link = (db.query(PackageBookingRoom)
                        .join(PackageBooking)
                        .options(joinedload(PackageBookingRoom.package_booking))
                        .filter(PackageBookingRoom.room_id == room.id, PackageBooking.status.in_(['checked-in', 'checked_in', 'booked']))
                        .order_by(PackageBooking.id.desc()).first())
        if package_link:
            booking = package_link.package_booking
            is_package = True
            if booking.status not in ['checked-in', 'checked_in', 'booked']:
                raise HTTPException(status_code=400, detail=f"Package booking is not in a valid state for checkout. Current status: {booking.status}")
    
    if not booking:
        raise HTTPException(status_code=404, detail=f"No active booking found for room {room_number}.")
    
    # 3. Calculate charges for THIS ROOM ONLY
    charges = BillBreakdown()
    
    # Calculate effective checkout date:
    # If actual checkout date (today) > booking.check_out (late checkout): use today
    # If actual checkout date (today) < booking.check_out (early checkout): use booking.check_out
    today = date.today()
    effective_checkout_date = max(today, booking.check_out)
    stay_days = max(1, (effective_checkout_date - booking.check_in).days)
    
    if is_package:
        # Check if this is a whole_property package
        package = booking.package if booking.package else None
        is_whole_property = False
        if package:
            # Check booking_type field
            booking_type = getattr(package, 'booking_type', None)
            if booking_type:
                is_whole_property = booking_type.lower() in ['whole_property', 'whole property']
            else:
                # Fallback: if no room_types specified, treat as whole_property (legacy packages)
                room_types = getattr(package, 'room_types', None)
                is_whole_property = not room_types or not room_types.strip()
        
        package_price = package.price if package else 0
        
        if is_whole_property:
            # For whole_property packages: package price is the total amount (not multiplied by days)
            # Note: For single room checkout, we still use the full package price
            # as it's a whole property package (all rooms included)
            charges.package_charges = package_price
            charges.room_charges = 0
        else:
            # For room_type packages: package price is per room, per night
            charges.package_charges = package_price * stay_days
            charges.room_charges = 0
    else:
        charges.package_charges = 0
        # For regular bookings: calculate room charges as days * room price
        charges.room_charges = (room.price or 0) * stay_days
    
    # Determine start time for billing to include orders created before formal check-in
    # 1. Start with booking check-in date at 00:00:00
    check_in_datetime = datetime.combine(booking.check_in, datetime.min.time())
    
    # 2. Find the most recent checkout for this room to ensure we don't overlap with previous guest
    # Exclude checkouts for the current booking
    last_checkout_query = db.query(Checkout).filter(Checkout.room_number == room.number)
    
    if is_package:
        last_checkout_query = last_checkout_query.filter(Checkout.package_booking_id != booking.id)
    else:
        last_checkout_query = last_checkout_query.filter(Checkout.booking_id != booking.id)
        
    last_checkout = last_checkout_query.order_by(Checkout.checkout_date.desc()).first()
    
    if last_checkout and last_checkout.checkout_date:
        # If last checkout was after the calculated start time, use it as the new start time
        # This handles cases where previous guest checked out on the same day as new guest check-in
        if last_checkout.checkout_date > check_in_datetime:
            check_in_datetime = last_checkout.checkout_date
            print(f"[DEBUG] Adjusted check-in datetime based on previous checkout: {check_in_datetime}")
            
    print(f"[DEBUG] Using billing start time: {check_in_datetime}")

    # Get food and service charges for THIS ROOM ONLY, filtered by check-in datetime
    # Include ALL food orders (both billed and unbilled) - show paid ones with zero amount
    all_food_order_items = (db.query(FoodOrderItem)
                           .join(FoodOrder)
                           .options(joinedload(FoodOrderItem.food_item), joinedload(FoodOrderItem.order))
                           .filter(
                               FoodOrder.room_id == room.id,
                               FoodOrder.created_at >= check_in_datetime
                           )
                           .all())
    
    # Separate food orders by billing status:
    # - Unbilled: billing_status is None, "unbilled", or "unpaid" (add to bill)
    # - Paid: billing_status is "paid" (show as paid, don't add to bill)
    # - Billed: billing_status is "billed" (already billed, show as paid)
    unbilled_food_order_items = [item for item in all_food_order_items 
                                 if not item.order or item.order.billing_status in ["unbilled", "unpaid"] or item.order.billing_status is None]
    paid_food_order_items = [item for item in all_food_order_items 
                            if item.order and item.order.billing_status == "paid"]
    billed_food_order_items = [item for item in all_food_order_items 
                               if item.order and item.order.billing_status == "billed"]
    
    # Get ALL unbilled services for this room
    # Note: Services can be pre-assigned before check-in, so we don't filter by assigned_at
    # We only filter by billing_status to avoid double-billing
    unbilled_services = db.query(AssignedService).options(joinedload(AssignedService.service)).filter(
        AssignedService.room_id == room.id, 
        AssignedService.billing_status == "unbilled"
    ).all()
    
    # Calculate charges: only unbilled items contribute to charges
    charges.food_charges = sum(item.quantity * item.food_item.price for item in unbilled_food_order_items if item.food_item)
    charges.service_charges = sum(ass.service.charges for ass in unbilled_services)
    
    # Include ALL food items in the list with payment status
    charges.food_items = []
    
    # Add unbilled items with their actual amounts
    for item in unbilled_food_order_items:
        if item.food_item:
            charges.food_items.append({
                "item_name": item.food_item.name, 
                "quantity": item.quantity, 
                "amount": item.quantity * item.food_item.price,
                "is_paid": False,
                "payment_status": "Unpaid"
            })
    
    # Add paid items (paid at delivery) with payment details
    for item in paid_food_order_items:
        if item.food_item and item.order:
            charges.food_items.append({
                "item_name": item.food_item.name, 
                "quantity": item.quantity, 
                "amount": 0.0,  # Don't add to bill
                "is_paid": True,
                "payment_status": f"PAID ({item.order.payment_method or 'cash'})",
                "payment_method": item.order.payment_method,
                "payment_time": item.order.payment_time.isoformat() if item.order.payment_time else None,
                "gst_amount": item.order.gst_amount,
                "total_with_gst": item.order.total_with_gst
            })
    
    # Add billed items (already in previous bills)
    for item in billed_food_order_items:
        if item.food_item:
            charges.food_items.append({
                "item_name": item.food_item.name, 
                "quantity": item.quantity, 
                "amount": 0.0,
                "is_paid": True,
                "payment_status": "Previously Billed"
            })
    
    charges.service_items = [{"service_name": ass.service.name, "charges": ass.service.charges} for ass in unbilled_services]
    
    # Calculate Consumables Charges from CheckoutRequest
    from app.models.inventory import InventoryItem
    
    checkout_request = None
    if is_package:
        checkout_request = db.query(CheckoutRequestModel).filter(
            CheckoutRequestModel.package_booking_id == booking.id,
            CheckoutRequestModel.room_number == room_number,
            CheckoutRequestModel.status == "completed"
        ).order_by(CheckoutRequestModel.id.desc()).first()
    else:
        checkout_request = db.query(CheckoutRequestModel).filter(
            CheckoutRequestModel.booking_id == booking.id,
            CheckoutRequestModel.room_number == room_number,
            CheckoutRequestModel.status == "completed"
        ).order_by(CheckoutRequestModel.id.desc()).first()
        
    if checkout_request and checkout_request.inventory_data:
        for item_data in checkout_request.inventory_data:
            item_id = item_data.get('item_id')
            used_qty = float(item_data.get('used_qty', 0))
            missing_qty = float(item_data.get('missing_qty', 0))
            missing_item_charge = item_data.get('missing_item_charge', 0)
            
            # Add charges for used consumables (over complimentary limit)
            if used_qty > 0:
                inv_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
                if inv_item and inv_item.is_sellable_to_guest:
                    limit = inv_item.complimentary_limit or 0
                    chargeable_qty = max(0, used_qty - limit)
                    
                    if chargeable_qty > 0:
                        price = inv_item.selling_price or inv_item.unit_price or 0
                        amount = chargeable_qty * price
                        charges.consumables_charges = (charges.consumables_charges or 0) + amount
                        
                        charges.consumables_items.append({
                            "item_id": item_id,
                            "item_name": inv_item.name,
                            "actual_consumed": used_qty,
                            "complimentary_limit": limit,
                            "charge_per_unit": price,
                            "total_charge": amount
                        })
            
            # Add charges for missing/damaged items
            if missing_qty > 0 and missing_item_charge > 0:
                item_name = item_data.get('item_name', f'Item #{item_id}')
                unit_price = item_data.get('unit_price', 0)
                
                charges.consumables_charges = (charges.consumables_charges or 0) + missing_item_charge
                
                charges.consumables_items.append({
                    "item_id": item_id,
                    "item_name": f"{item_name} (Missing/Damaged)",
                    "actual_consumed": missing_qty,
                    "complimentary_limit": 0,
                    "charge_per_unit": unit_price,
                    "total_charge": missing_item_charge
                })
    
    # Calculate GST
    # Room charges: 5% GST if < 5000, 12% GST if 5000-7500, 18% GST if > 7500
    # FIX: Use room.price (per night rate) to determine slab
    room_price = room.price or 0
    room_gst_rate = 0.18 # Default > 7500
    
    if room_price < 5000:
        room_gst_rate = 0.05
    elif room_price <= 7500:
        room_gst_rate = 0.12
        
    charges.room_gst = (charges.room_charges or 0) * room_gst_rate
    
    # Package charges: Same rule as room charges
    # Determine daily rate for package to find the slab
    package_daily_rate = 0
    if is_package:
        if is_whole_property:
            package_daily_rate = (package.price if package else 0) / max(1, stay_days)
        else:
            package_daily_rate = package.price if package else 0
            
    package_gst_rate = 0.18
    if package_daily_rate > 0:
        if package_daily_rate < 5000:
            package_gst_rate = 0.05
        elif package_daily_rate <= 7500:
            package_gst_rate = 0.12
            
    charges.package_gst = (charges.package_charges or 0) * package_gst_rate
    
    # Food charges: 5% GST always
    food_charge_amount = charges.food_charges or 0
    if food_charge_amount > 0:
        charges.food_gst = food_charge_amount * 0.05
        
    # Service GST: Calculate based on individual service rates
    charges.service_gst = 0.0
    for ass in unbilled_services:
        gst_rate = getattr(ass.service, 'gst_rate', 0.18) or 0.18
        charges.service_gst += ass.service.charges * gst_rate
        
    # Consumables GST: 5%
    if charges.consumables_charges and charges.consumables_charges > 0:
        charges.consumables_gst = charges.consumables_charges * 0.05
    
    # Total GST
    charges.total_gst = (charges.room_gst or 0) + (charges.food_gst or 0) + (charges.service_gst or 0) + (charges.package_gst or 0) + (charges.consumables_gst or 0)
    
    # Total due (subtotal before GST)
    charges.total_due = sum([
        charges.room_charges or 0, 
        charges.food_charges or 0, 
        charges.service_charges or 0, 
        charges.package_charges or 0,
        charges.consumables_charges or 0
    ])
    
    # Add advance deposit info to charges
    charges.advance_deposit = getattr(booking, 'advance_deposit', 0.0) or 0.0
    
    number_of_guests = getattr(booking, 'number_of_guests', 1)
    
    return {
        "booking": booking, "room": room, "charges": charges,
        "is_package": is_package, "stay_nights": stay_days, "number_of_guests": number_of_guests,
        "effective_checkout_date": effective_checkout_date
    }

def _calculate_bill_for_entire_booking(db: Session, room_number: str):
    """
    Core logic: Finds an entire booking from a single room number and calculates the total bill
    for all associated rooms and services.
    """
    # 1. Find the initial room to identify the parent booking
    initial_room = db.query(Room).filter(Room.number == room_number).first()
    if not initial_room:
        raise HTTPException(status_code=404, detail="Initial room not found.")

    # 2. Find the active parent booking (regular or package) linked to this room
    booking, is_package = None, False
    
    # Eagerly load the booking relationship to avoid extra queries
    # Order by descending ID to get the MOST RECENT booking for the room first.
    # Handle both 'checked-in' and 'checked_in' status formats
    booking_link = (db.query(BookingRoom)
                    .join(Booking)
                    .options(joinedload(BookingRoom.booking)) # Eager load the booking
                    .filter(BookingRoom.room_id == initial_room.id, Booking.status.in_(['checked-in', 'checked_in', 'booked']))
                    .order_by(Booking.id.desc()).first())

    if booking_link:
        booking = booking_link.booking
        # Validate booking status before proceeding
        if booking.status not in ['checked-in', 'checked_in', 'booked']:
            raise HTTPException(status_code=400, detail=f"Booking is not in a valid state for checkout. Current status: {booking.status}")
    else:
        package_link = (db.query(PackageBookingRoom)
                        .join(PackageBooking)
                        .options(joinedload(PackageBookingRoom.package_booking)) # Eager load the booking
                        .filter(PackageBookingRoom.room_id == initial_room.id, PackageBooking.status.in_(['checked-in', 'checked_in', 'booked']))
                        .order_by(PackageBooking.id.desc()).first())
        if package_link:
            booking = package_link.package_booking
            is_package = True
            # Validate booking status before proceeding
            if booking.status not in ['checked-in', 'checked_in', 'booked']:
                raise HTTPException(status_code=400, detail=f"Package booking is not in a valid state for checkout. Current status: {booking.status}")

    if not booking:
        raise HTTPException(status_code=404, detail=f"No active booking found for room {room_number}.")

    # 3. Get ALL rooms and their IDs associated with the found booking
    all_rooms = []
    if is_package:
        # For package bookings, the relationship is `booking.rooms` -> `PackageBookingRoom` -> `room`
        all_rooms = [link.room for link in booking.rooms]
    else:
        # For regular bookings, the relationship is `booking.booking_rooms` -> `BookingRoom` -> `room`
        all_rooms = [link.room for link in booking.booking_rooms]
    
    room_ids = [room.id for room in all_rooms]
    
    if not all_rooms:
         raise HTTPException(status_code=404, detail="Booking found, but no rooms are linked to it.")

    # 4. Calculate total charges across ALL rooms
    charges = BillBreakdown()
    
    # Calculate effective checkout date:
    # If actual checkout date (today) > booking.check_out (late checkout): use today
    # If actual checkout date (today) < booking.check_out (early checkout): use booking.check_out
    today = date.today()
    effective_checkout_date = max(today, booking.check_out)
    stay_days = max(1, (effective_checkout_date - booking.check_in).days)

    if is_package:
        # Check if this is a whole_property package
        package = booking.package if booking.package else None
        is_whole_property = False
        if package:
            # Check booking_type field
            booking_type = getattr(package, 'booking_type', None)
            if booking_type:
                is_whole_property = booking_type.lower() in ['whole_property', 'whole property']
            else:
                # Fallback: if no room_types specified, treat as whole_property (legacy packages)
                room_types = getattr(package, 'room_types', None)
                is_whole_property = not room_types or not room_types.strip()
        
        package_price = package.price if package else 0
        
        if is_whole_property:
            # For whole_property packages: package price is the total amount (not multiplied by rooms/days)
            charges.package_charges = package_price
            charges.room_charges = 0  # Room charges are included in the package price
        else:
            # For room_type packages: package price is per room, per night
            num_rooms_in_package = len(all_rooms)
            charges.package_charges = package_price * num_rooms_in_package * stay_days
            charges.room_charges = 0  # Room charges are included in the package price
    else:
        charges.package_charges = 0
        # For regular bookings: calculate room charges as number of rooms * days * room price
        charges.room_charges = sum((room.price or 0) * stay_days for room in all_rooms)
    
    # Determine start time for billing to include orders created before formal check-in
    # 1. Start with booking check-in date at 00:00:00
    check_in_datetime = datetime.combine(booking.check_in, datetime.min.time())
    
    # 2. Find the most recent checkout for ANY of the rooms to ensure we don't overlap with previous guest
    # This is a bit complex for multiple rooms, but we can take the latest checkout timestamp across all rooms
    # excluding the current booking.
    
    # Get room numbers
    room_numbers = [r.number for r in all_rooms]
    
    last_checkout_query = db.query(Checkout).filter(Checkout.room_number.in_(room_numbers))
    
    if is_package:
        last_checkout_query = last_checkout_query.filter(Checkout.package_booking_id != booking.id)
    else:
        last_checkout_query = last_checkout_query.filter(Checkout.booking_id != booking.id)
        
    last_checkout = last_checkout_query.order_by(Checkout.checkout_date.desc()).first()
    
    if last_checkout and last_checkout.checkout_date:
        if last_checkout.checkout_date > check_in_datetime:
            check_in_datetime = last_checkout.checkout_date
            print(f"[DEBUG] Adjusted check-in datetime based on previous checkout: {check_in_datetime}")
            
    print(f"[DEBUG] Using billing start time: {check_in_datetime}")

    # Sum up additional food and service charges from all rooms
    # Include ALL food orders (both billed and unbilled) - show paid ones with zero amount
    all_food_order_items = (db.query(FoodOrderItem)
                           .join(FoodOrder)
                           .options(joinedload(FoodOrderItem.food_item), joinedload(FoodOrderItem.order))
                           .filter(
                               FoodOrder.room_id.in_(room_ids),
                               FoodOrder.created_at >= check_in_datetime
                           )
                           .all())

    # Separate billed and unbilled items
    # Unbilled: billing_status is None, "unbilled", "unpaid", or anything other than "billed"
    # Billed: billing_status is explicitly "billed"
    unbilled_food_order_items = [item for item in all_food_order_items 
                                 if not item.order or item.order.billing_status != "billed"]
    billed_food_order_items = [item for item in all_food_order_items 
                               if item.order and item.order.billing_status == "billed"]

    unbilled_services = db.query(AssignedService).options(joinedload(AssignedService.service)).filter(AssignedService.room_id.in_(room_ids), AssignedService.billing_status == "unbilled").all()

    # Calculate total food charges from the individual items (only unbilled items)
    charges.food_charges = sum(item.quantity * item.food_item.price for item in unbilled_food_order_items if item.food_item)
    charges.service_charges = sum(ass.service.charges for ass in unbilled_services)

    # Populate detailed item lists for the bill summary - include ALL items
    charges.food_items = []
    # Add unbilled items with their actual amounts
    for item in unbilled_food_order_items:
        if item.food_item:
            charges.food_items.append({
                "item_name": item.food_item.name, 
                "quantity": item.quantity, 
                "amount": item.quantity * item.food_item.price,
                "is_paid": False
            })
    # Add billed items with zero amount
    for item in billed_food_order_items:
        if item.food_item:
            charges.food_items.append({
                "item_name": item.food_item.name, 
                "quantity": item.quantity, 
                "amount": 0.0,
                "is_paid": True
            })
    
    charges.service_items = [{"service_name": ass.service.name, "charges": ass.service.charges} for ass in unbilled_services]

    # Calculate Consumables Charges from CheckoutRequest
    from app.models.inventory import InventoryItem
    
    checkout_requests = []
    if is_package:
        checkout_requests = db.query(CheckoutRequestModel).filter(
            CheckoutRequestModel.package_booking_id == booking.id,
            CheckoutRequestModel.status == "completed"
        ).all()
    else:
        checkout_requests = db.query(CheckoutRequestModel).filter(
            CheckoutRequestModel.booking_id == booking.id,
            CheckoutRequestModel.status == "completed"
        ).all()
        
    for checkout_request in checkout_requests:
        if checkout_request.inventory_data:
            for item_data in checkout_request.inventory_data:
                item_id = item_data.get('item_id')
                used_qty = float(item_data.get('used_qty', 0))
                
                if used_qty > 0:
                    inv_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
                    if inv_item and inv_item.is_sellable_to_guest:
                        limit = inv_item.complimentary_limit or 0
                        chargeable_qty = max(0, used_qty - limit)
                        
                        if chargeable_qty > 0:
                            price = inv_item.selling_price or inv_item.unit_price or 0
                            amount = chargeable_qty * price
                            charges.consumables_charges = (charges.consumables_charges or 0) + amount
                            
                            charges.consumables_items.append({
                                "item_id": item_id,
                                "item_name": inv_item.name,
                                "actual_consumed": used_qty,
                                "complimentary_limit": limit,
                                "charge_per_unit": price,
                                "total_charge": amount
                            })

    # Calculate GST
    # Room charges: 5% GST if < 5000, 12% GST if 5000-7500, 18% GST if > 7500
    # FIX: Calculate GST for each room individually based on its nightly rate
    charges.room_gst = 0.0
    if not is_package:
        for room in all_rooms:
            room_price = room.price or 0
            room_gst_rate = 0.18
            if room_price < 5000:
                room_gst_rate = 0.05
            elif room_price <= 7500:
                room_gst_rate = 0.12
            
            # Calculate total charge for this room
            room_total = room_price * stay_days
            charges.room_gst += room_total * room_gst_rate
    
    # Package charges: Same rule as room charges
    # Determine daily rate for package to find the slab
    package_daily_rate = 0
    if is_package:
        if is_whole_property:
            package_daily_rate = (package.price if package else 0) / max(1, stay_days)
        else:
            package_daily_rate = package.price if package else 0
            
    package_gst_rate = 0.18
    if package_daily_rate > 0:
        if package_daily_rate < 5000:
            package_gst_rate = 0.05
        elif package_daily_rate <= 7500:
            package_gst_rate = 0.12
            
    charges.package_gst = (charges.package_charges or 0) * package_gst_rate
    
    # Food charges: 5% GST always
    food_charge_amount = charges.food_charges or 0
    if food_charge_amount > 0:
        charges.food_gst = food_charge_amount * 0.05
        
    # Service GST: Calculate based on individual service rates
    charges.service_gst = 0.0
    for ass in unbilled_services:
        gst_rate = getattr(ass.service, 'gst_rate', 0.18) or 0.18
        charges.service_gst += ass.service.charges * gst_rate
        
    # Consumables GST: 5%
    if charges.consumables_charges and charges.consumables_charges > 0:
        charges.consumables_gst = charges.consumables_charges * 0.05
    
    # Total GST
    charges.total_gst = (charges.room_gst or 0) + (charges.food_gst or 0) + (charges.service_gst or 0) + (charges.package_gst or 0) + (charges.consumables_gst or 0)
    
    # Total due (subtotal before GST)
    charges.total_due = sum([
        charges.room_charges or 0, 
        charges.food_charges or 0, 
        charges.service_charges or 0, 
        charges.package_charges or 0,
        charges.consumables_charges or 0
    ])
    
    # Add advance deposit info to charges
    charges.advance_deposit = getattr(booking, 'advance_deposit', 0.0) or 0.0

    # Assume number_of_guests is a field on the booking model. Default to 1 if not present.
    number_of_guests = getattr(booking, 'number_of_guests', 1)

    return {
        "booking": booking, "all_rooms": all_rooms, "charges": charges, 
        "is_package": is_package, "stay_nights": stay_days, "number_of_guests": number_of_guests,
        "effective_checkout_date": effective_checkout_date
    }


@router.get("/{room_number}", response_model=BillSummary)
def get_bill_for_booking(room_number: str, checkout_mode: str = "multiple", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Returns a bill summary for the booking associated with the given room number.
    If checkout_mode is 'single', calculates bill for that room only.
    If checkout_mode is 'multiple', calculates bill for all rooms in the booking.
    """
    if checkout_mode == "single":
        bill_data = _calculate_bill_for_single_room(db, room_number)
        effective_checkout = bill_data.get("effective_checkout_date", bill_data["booking"].check_out)
        return BillSummary(
            guest_name=bill_data["booking"].guest_name,
            room_numbers=[bill_data["room"].number],
            number_of_guests=bill_data["number_of_guests"],
            stay_nights=bill_data["stay_nights"],
            check_in=bill_data["booking"].check_in,
            check_out=effective_checkout,  # Use effective checkout date (today if late, booking.check_out if early)
            charges=bill_data["charges"]
        )
    else:
        bill_data = _calculate_bill_for_entire_booking(db, room_number)
        effective_checkout = bill_data.get("effective_checkout_date", bill_data["booking"].check_out)
        return BillSummary(
            guest_name=bill_data["booking"].guest_name,
            room_numbers=sorted([room.number for room in bill_data["all_rooms"]]),
            number_of_guests=bill_data["number_of_guests"],
            stay_nights=bill_data["stay_nights"],
            check_in=bill_data["booking"].check_in,
            check_out=effective_checkout,  # Use effective checkout date (today if late, booking.check_out if early)
            charges=bill_data["charges"]
        )


@router.post("/checkout/{room_number}", response_model=CheckoutSuccess)
def process_booking_checkout(room_number: str, request: CheckoutRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Finalizes the checkout for a room or entire booking.
    If checkout_mode is 'single', only the specified room is checked out.
    If checkout_mode is 'multiple', all rooms in the booking are checked out together.
    """
    checkout_mode = request.checkout_mode or "multiple"
    
    # Ensure checkout_mode is valid
    if checkout_mode not in ["single", "multiple"]:
        checkout_mode = "multiple"  # Default to multiple if invalid
    
    # Check if checkout request exists and inventory is verified
    room = db.query(Room).filter(Room.number == room_number).first()
    if room:
        # Find active booking
        booking_link = (db.query(BookingRoom)
                        .join(Booking)
                        .filter(BookingRoom.room_id == room.id, Booking.status.in_(['checked-in', 'checked_in', 'booked']))
                        .order_by(Booking.id.desc()).first())
        
        package_link = None
        booking = None
        is_package = False
        
        if booking_link:
            booking = booking_link.booking
        else:
            package_link = (db.query(PackageBookingRoom)
                            .join(PackageBooking)
                            .filter(PackageBookingRoom.room_id == room.id, PackageBooking.status.in_(['checked-in', 'checked_in', 'booked']))
                            .order_by(PackageBooking.id.desc()).first())
            if package_link:
                booking = package_link.package_booking
                is_package = True
        
        if booking:
            # Check for checkout request
            checkout_request = None
            if is_package:
                checkout_request = db.query(CheckoutRequestModel).filter(
                    CheckoutRequestModel.package_booking_id == booking.id,
                    CheckoutRequestModel.status.in_(["pending", "inventory_checked"])
                ).order_by(CheckoutRequestModel.id.desc()).first()
            else:
                checkout_request = db.query(CheckoutRequestModel).filter(
                    CheckoutRequestModel.booking_id == booking.id,
                    CheckoutRequestModel.status.in_(["pending", "inventory_checked"])
                ).order_by(CheckoutRequestModel.id.desc()).first()
            
            # Block checkout if inventory is not checked
            if checkout_request and checkout_request.status == "pending" and not checkout_request.inventory_checked:
                raise HTTPException(
                    status_code=400, 
                    detail="Inventory must be checked before completing checkout. Please verify room inventory first."
                )
    
    if checkout_mode == "single":
        # Single room checkout
        # Calculate bill first - this will validate that there's an active booking
        bill_data = _calculate_bill_for_single_room(db, room_number)
        booking = bill_data["booking"]
        room = bill_data["room"]
        charges = bill_data["charges"]
        is_package = bill_data["is_package"]
        
        # Validate booking is in a valid state (this is the source of truth, not room status)
        if booking.status not in ['checked-in', 'checked_in', 'booked']:
            raise HTTPException(status_code=400, detail=f"Booking cannot be checked out. Current status: {booking.status}")
        
        # PRE-CHECKOUT CLEANUP: Check for and delete any orphaned checkouts BEFORE attempting checkout
        # This prevents unique constraint violations
        today = date.today()
        existing_room_checkout = db.query(Checkout).filter(
            Checkout.room_number == room_number,
            func.date(Checkout.checkout_date) == today
        ).first()
        
        # Also check for any checkout for this booking (not just today)
        existing_booking_checkout = None
        if not is_package:
            existing_booking_checkout = db.query(Checkout).filter(
                Checkout.booking_id == booking.id
            ).first()
        else:
            existing_booking_checkout = db.query(Checkout).filter(
                Checkout.package_booking_id == booking.id
            ).first()
        
        # If checkout exists, verify the room status matches
        if existing_room_checkout or existing_booking_checkout:
            # Use the most recent checkout
            checkout_to_check = existing_room_checkout or existing_booking_checkout
            
            # If room is still not "Available", the checkout didn't complete properly - delete and allow retry
            if room.status != "Available":
                # Delete the orphaned checkout record(s) and allow retry
                print(f"[CLEANUP] Found orphaned checkout(s) for room {room_number}, booking {booking.id}. Cleaning up...")
                try:
                    deleted_count = 0
                    if existing_room_checkout:
                        db.delete(existing_room_checkout)
                        deleted_count += 1
                        print(f"[CLEANUP] Deleted orphaned room checkout record {existing_room_checkout.id}")
                    if existing_booking_checkout and existing_booking_checkout.id != (existing_room_checkout.id if existing_room_checkout else None):
                        db.delete(existing_booking_checkout)
                        deleted_count += 1
                        print(f"[CLEANUP] Deleted orphaned booking checkout record {existing_booking_checkout.id}")
                    db.commit()
                    print(f"[CLEANUP] Successfully deleted {deleted_count} orphaned checkout record(s). Proceeding with new checkout.")
                    # Continue to create new checkout - don't return error
                except Exception as del_error:
                    print(f"[ERROR] Failed to delete orphaned checkout: {str(del_error)}")
                    db.rollback()
                    # Still try to proceed - maybe the checkout will work
            else:
                # Room is already checked out - return existing checkout info instead of error
                print(f"[INFO] Valid checkout already exists for room {room_number} (ID: {checkout_to_check.id})")
                return CheckoutSuccess(
                    checkout_id=checkout_to_check.id,
                    grand_total=checkout_to_check.grand_total,
                    checkout_date=checkout_to_check.checkout_date or checkout_to_check.created_at
                )
        
        # Check if room is already available (already checked out)
        if room.status == "Available":
            # Try to find the existing checkout
            existing = db.query(Checkout).filter(
                Checkout.room_number == room_number
            ).order_by(Checkout.created_at.desc()).first()
            if existing:
                return CheckoutSuccess(
                    checkout_id=existing.id,
                    grand_total=existing.grand_total,
                    checkout_date=existing.checkout_date or existing.created_at
                )
            raise HTTPException(
                status_code=409,
                detail=f"Room {room_number} is already available (checked out). Please refresh the page to see updated status."
            )
        
        # Check if booking is already checked out (more reliable than room status)
        if booking.status in ['checked_out', 'checked-out']:
            # But verify - if room is not Available, booking status might be wrong
            if room.status != "Available":
                # Booking status is wrong - fix it
                booking.status = "checked-in"
                db.commit()
            else:
                raise HTTPException(
                    status_code=409, 
                    detail=f"Booking for room {room_number} has already been checked out. Please refresh the page to see updated status."
                )
        
        try:
            # ===== ENHANCED CHECKOUT PROCESSING =====
            
            # 1. Process Pre-Checkout Verification
            consumables_charges = 0.0
            asset_damage_charges = 0.0
            key_card_fee = 0.0
            
            if request.room_verifications:
                # Find verification for this room
                room_verification = next(
                    (rv for rv in request.room_verifications if rv.room_number == room.number),
                    None
                )
                if room_verification:
                    # Process consumables audit
                    consumables_audit = process_consumables_audit(
                        db, room.id, room_verification.consumables
                    )
                    consumables_charges = consumables_audit["total_charge"]
                    
                    # Process asset damages
                    asset_damage = process_asset_damage_check(room_verification.asset_damages)
                    asset_damage_charges = asset_damage["total_charge"]
                    
                    # Key card fee
                    if not room_verification.key_card_returned:
                        key_card_fee = 50.0  # Default lost key fee
            
            # 2. Calculate Late Checkout Fee
            actual_checkout_time = request.actual_checkout_time or datetime.now()
            late_checkout_fee = calculate_late_checkout_fee(
                booking.check_out,
                actual_checkout_time,
                room.price or 0.0
            )
            
            # 3. Get Advance Deposit
            advance_deposit = getattr(booking, 'advance_deposit', 0.0) or 0.0
            
            # 4. Calculate final bill with all charges
            subtotal = charges.total_due + consumables_charges + asset_damage_charges + key_card_fee + late_checkout_fee
            
            # Recalculate GST with new charges (consumables and asset damages may have GST)
            # For simplicity, apply same GST rate to consumables as food (5%)
            consumables_gst = consumables_charges * 0.05
            asset_damage_gst = asset_damage_charges * 0.18  # Asset replacement typically 18%
            
            # Use the calculated GST from charges (already includes room, food, and package GST)
            tax_amount = (charges.total_gst or 0) + consumables_gst + asset_damage_gst
            
            discount_amount = max(0, request.discount_amount or 0)
            tips_gratuity = max(0, request.tips_gratuity or 0.0)
            
            # Grand total before advance deposit deduction
            grand_total_before_advance = max(0, subtotal + tax_amount - discount_amount + tips_gratuity)
            
            # Deduct advance deposit
            grand_total = max(0, grand_total_before_advance - advance_deposit)
            
            # 5. Get effective checkout date for billing
            effective_checkout = bill_data.get("effective_checkout_date", booking.check_out)
            effective_checkout_datetime = datetime.combine(effective_checkout, datetime.min.time())
            
            # 6. Generate invoice number (with retry logic for uniqueness)
            invoice_number = None
            max_retries = 5
            for attempt in range(max_retries):
                try:
                    invoice_number = generate_invoice_number(db)
                    # Check if this invoice number already exists
                    existing_invoice = db.query(Checkout).filter(Checkout.invoice_number == invoice_number).first()
                    if not existing_invoice:
                        break  # Invoice number is unique, proceed
                    else:
                        print(f"[WARNING] Generated duplicate invoice number {invoice_number}, retrying... (attempt {attempt + 1}/{max_retries})")
                        if attempt == max_retries - 1:
                            # Last attempt failed, use checkout ID-based fallback
                            print(f"[WARNING] All retries failed, will use checkout ID-based invoice number")
                            invoice_number = None
                except Exception as inv_error:
                    print(f"[WARNING] Error generating invoice number: {str(inv_error)}")
                    if attempt == max_retries - 1:
                        invoice_number = None
            
            # 7. Check if there's already a checkout with this booking_id (unique constraint)
            # This MUST be checked BEFORE creating the checkout to avoid unique constraint violation
            # Also check for orphaned checkouts and clean them up
            existing_booking_checkout = None
            if not is_package:
                existing_booking_checkout = db.query(Checkout).filter(Checkout.booking_id == booking.id).first()
            else:
                existing_booking_checkout = db.query(Checkout).filter(Checkout.package_booking_id == booking.id).first()
            
            # If checkout already exists, check if it's orphaned (room still checked-in)
            if existing_booking_checkout:
                # Check room status - if room is still checked-in, this is an orphaned checkout
                if room.status != "Available":
                    print(f"[CLEANUP] Found orphaned checkout {existing_booking_checkout.id} for booking {booking.id} (room {room_number} status: {room.status}). Deleting it.")
                    try:
                        # Also delete related records first to avoid foreign key constraints
                        # Delete checkout verifications
                        db.query(CheckoutVerification).filter(CheckoutVerification.checkout_id == existing_booking_checkout.id).delete()
                        # Delete checkout payments
                        db.query(CheckoutPayment).filter(CheckoutPayment.checkout_id == existing_booking_checkout.id).delete()
                        # Now delete the checkout
                        db.delete(existing_booking_checkout)
                        db.commit()
                        print(f"[CLEANUP] Successfully deleted orphaned checkout {existing_booking_checkout.id} and related records")
                        # Continue to create new checkout
                        existing_booking_checkout = None
                    except Exception as del_error:
                        print(f"[ERROR] Failed to delete orphaned checkout: {str(del_error)}")
                        import traceback
                        print(traceback.format_exc())
                        db.rollback()
                        # Raise error so user knows to retry
                        raise HTTPException(
                            status_code=409,
                            detail=f"Found an orphaned checkout record but couldn't delete it. Please try again or contact support. Error: {str(del_error)}"
                        )
                else:
                    # Room is available, checkout is valid - return it
                    print(f"[INFO] Valid checkout already exists for booking {booking.id} (ID: {existing_booking_checkout.id}), returning it")
                    return CheckoutSuccess(
                        checkout_id=existing_booking_checkout.id,
                        grand_total=existing_booking_checkout.grand_total,
                        checkout_date=existing_booking_checkout.checkout_date or existing_booking_checkout.created_at
                    )
            
            booking_id_to_set = None
            package_booking_id_to_set = None
            
            if True:  # Always set booking_id since we've confirmed no existing checkout
                booking_id_to_set = booking.id if not is_package else None
                package_booking_id_to_set = booking.id if is_package else None
            
            # 8. Create enhanced checkout record
            new_checkout = Checkout(
                booking_id=booking_id_to_set,
                package_booking_id=package_booking_id_to_set,
                room_total=charges.room_charges,
                food_total=charges.food_charges,
                service_total=charges.service_charges,
                package_total=charges.package_charges,
                tax_amount=tax_amount,
                discount_amount=discount_amount,
                grand_total=grand_total,
                payment_method=request.payment_method or "cash",  # Default if not provided
                payment_status="Paid",
                guest_name=booking.guest_name,
                room_number=room.number,
                checkout_date=effective_checkout_datetime,
                # Enhanced fields
                late_checkout_fee=late_checkout_fee,
                consumables_charges=consumables_charges,
                asset_damage_charges=asset_damage_charges,
                key_card_fee=key_card_fee,
                advance_deposit=advance_deposit,
                tips_gratuity=tips_gratuity,
                guest_gstin=request.guest_gstin,
                is_b2b=request.is_b2b or False,
                invoice_number=invoice_number
            )
            # Add checkout to session first, then set invoice_number if needed
            db.add(new_checkout)
            db.flush()  # Flush to get checkout ID
            
            # If invoice_number wasn't generated or is duplicate, create one based on checkout ID
            if not invoice_number:
                invoice_number = f"INV-{new_checkout.id:06d}"
                new_checkout.invoice_number = invoice_number
            else:
                # Double-check invoice number is still unique (race condition protection)
                existing_invoice = db.query(Checkout).filter(
                    Checkout.invoice_number == invoice_number,
                    Checkout.id != new_checkout.id
                ).first()
                if existing_invoice:
                    print(f"[WARNING] Invoice number {invoice_number} became duplicate, using checkout ID-based number")
                    invoice_number = f"INV-{new_checkout.id:06d}"
                    new_checkout.invoice_number = invoice_number
            
            # 9. Create checkout verification records
            if request.room_verifications:
                room_verification = next(
                    (rv for rv in request.room_verifications if rv.room_number == room.number),
                    None
                )
                if room_verification:
                    create_checkout_verification(db, new_checkout.id, room_verification, room.id)
            
            # 10. Process split payments
            if request.split_payments:
                process_split_payments(db, new_checkout.id, request.split_payments)
            elif request.payment_method:
                # Legacy single payment method
                payment_record = CheckoutPayment(
                    checkout_id=new_checkout.id,
                    payment_method=request.payment_method,
                    amount=grand_total,
                    notes="Single payment method"
                )
                db.add(payment_record)
            
            # 11. Update billing status for food orders and services
            db.query(FoodOrder).filter(
                FoodOrder.room_id == room.id, 
                FoodOrder.billing_status == "unbilled"
            ).update({"billing_status": "billed"})
            
            db.query(AssignedService).filter(
                AssignedService.room_id == room.id, 
                AssignedService.billing_status == "unbilled"
            ).update({
                "billing_status": "billed",
                "last_used_at": datetime.utcnow()
            })
            
            # 12. Inventory Triggers
            # Check for CheckoutRequest first
            checkout_request = None
            if is_package:
                checkout_request = db.query(CheckoutRequestModel).filter(
                    CheckoutRequestModel.package_booking_id == booking.id,
                    CheckoutRequestModel.status == "completed"
                ).order_by(CheckoutRequestModel.id.desc()).first()
            else:
                checkout_request = db.query(CheckoutRequestModel).filter(
                    CheckoutRequestModel.booking_id == booking.id,
                    CheckoutRequestModel.status == "completed"
                ).order_by(CheckoutRequestModel.id.desc()).first()

            if checkout_request and checkout_request.inventory_data:
                # Convert inventory_data to list of objects with item_id and actual_consumed
                class SimpleConsumable:
                    def __init__(self, item_id, actual_consumed):
                        self.item_id = item_id
                        self.actual_consumed = actual_consumed
                
                consumables_list = []
                for item in checkout_request.inventory_data:
                    if float(item.get('used_qty', 0)) > 0:
                        consumables_list.append(SimpleConsumable(item.get('item_id'), float(item.get('used_qty', 0))))
                
                if consumables_list:
                    deduct_room_consumables(
                        db, room.id, consumables_list, 
                        new_checkout.id, current_user.id if current_user else None
                    )
            elif request.room_verifications:
                room_verification = next(
                    (rv for rv in request.room_verifications if rv.room_number == room.number),
                    None
                )
                if room_verification:
                    # Deduct consumables from inventory
                    deduct_room_consumables(
                        db, room.id, room_verification.consumables, 
                        new_checkout.id, current_user.id if current_user else None
                    )

            # Clear remaining consumables from room inventory
            if room.inventory_location_id:
                from app.models.inventory import InventoryItem, StockIssue, StockIssueDetail
                # Find all sellable items that have been issued to this room location
                room_items = (
                    db.query(InventoryItem)
                    .join(StockIssueDetail, StockIssueDetail.item_id == InventoryItem.id)
                    .join(StockIssue, StockIssue.id == StockIssueDetail.issue_id)
                    .filter(
                        StockIssue.destination_location_id == room.inventory_location_id,
                        InventoryItem.is_sellable_to_guest == True
                    )
                    .distinct()
                    .all()
                )
                
                for item in room_items:
                    # Reset stock to 0
                    item.current_stock = 0.0
            
            # Trigger linen cycle (move bed sheets/towels to laundry)
            trigger_linen_cycle(db, room.id, new_checkout.id)
            
            # 13. Update room status
            room.status = "Available"  # Room moves to "Dirty" status (ready for housekeeping)
            
            # 13.5. Automatically create cleaning and refill service requests
            try:
                from app.curd import service_request as service_request_crud
                # Create cleaning service request
                service_request_crud.create_cleaning_service_request(
                    db, room.id, room.number, booking.guest_name
                )
                # Create refill service request with checkout_id to get consumables data
                service_request_crud.create_refill_service_request(
                    db, room.id, room.number, booking.guest_name, new_checkout.id
                )
            except Exception as service_request_error:
                # Don't fail checkout if service request creation fails
                print(f"[WARNING] Failed to create service requests for room {room.number}: {service_request_error}")
            
            # 14. Check if all rooms in booking are checked out
            if is_package:
                remaining_rooms = [link.room for link in booking.rooms if link.room.status != "Available"]
            else:
                remaining_rooms = [link.room for link in booking.booking_rooms if link.room.status != "Available"]
            
            if not remaining_rooms:
                booking.status = "checked_out"
            
            db.commit()
            db.refresh(new_checkout)
            
            # 15. Automatically create journal entry for checkout (Scenario 2: Guest Checkout)
            # Debit: Bank Account / Cash | Credit: Room Revenue, Output CGST, Output SGST
            try:
                from app.utils.accounting_helpers import create_complete_checkout_journal_entry
                
                payment_method = request.payment_method or "cash"
                create_complete_checkout_journal_entry(
                    db=db,
                    checkout_id=new_checkout.id,
                    room_total=float(new_checkout.room_total or 0),
                    food_total=float(new_checkout.food_total or 0),
                    service_total=float(new_checkout.service_total or 0),
                    package_total=float(new_checkout.package_total or 0),
                    tax_amount=float(new_checkout.tax_amount or 0),
                    discount_amount=float(new_checkout.discount_amount or 0),
                    grand_total=float(new_checkout.grand_total or 0),
                    guest_name=new_checkout.guest_name or "Guest",
                    room_number=new_checkout.room_number or room_number,
                    gst_rate=18.0,  # Default, can be calculated from tax_amount
                    payment_method=payment_method,
                    created_by=current_user.id if current_user else None,
                    advance_amount=float(new_checkout.advance_deposit or 0)
                )
            except Exception as journal_error:
                # Log error but don't fail checkout
                import traceback
                error_msg = f"[WARNING] Failed to create journal entry for checkout {new_checkout.id}: {str(journal_error)}"
                print(error_msg)
                print(traceback.format_exc())
                # Store error in checkout notes for later reference
                if not new_checkout.notes:
                    new_checkout.notes = f"Journal entry creation failed: {str(journal_error)}"
                else:
                    new_checkout.notes += f"\nJournal entry creation failed: {str(journal_error)}"
            
        except Exception as e:
            db.rollback()
            error_detail = str(e)
            import traceback
            print(f"[ERROR] Checkout failed for room {room_number}, booking {booking.id}: {error_detail}")
            print(traceback.format_exc())
            
            # Check for unique constraint violation
            if "unique constraint" in error_detail.lower() or "duplicate key" in error_detail.lower() or "23505" in error_detail:
                # Try to find the existing checkout (check by booking_id first, then room_number)
                try:
                    existing_checkout = None
                    
                    # First check by booking_id (most reliable - unique constraint)
                    if not is_package:
                        existing_checkout = db.query(Checkout).filter(
                            Checkout.booking_id == booking.id
                        ).order_by(Checkout.created_at.desc()).first()
                    else:
                        existing_checkout = db.query(Checkout).filter(
                            Checkout.package_booking_id == booking.id
                        ).order_by(Checkout.created_at.desc()).first()
                    
                    # If not found by booking, check by room number and today
                    if not existing_checkout:
                        today = date.today()
                        existing_checkout = db.query(Checkout).filter(
                            Checkout.room_number == room_number,
                            func.date(Checkout.checkout_date) == today
                        ).order_by(Checkout.created_at.desc()).first()
                    
                    if existing_checkout:
                        # If room is still checked-in, this is an orphaned checkout - delete it
                        if room.status != "Available":
                            print(f"[CLEANUP] Found orphaned checkout {existing_checkout.id} for room {room_number} (room still checked-in). Deleting it.")
                            try:
                                db.delete(existing_checkout)
                                db.commit()
                                print(f"[CLEANUP] Successfully deleted orphaned checkout {existing_checkout.id}")
                                # After cleanup, we need to retry the checkout
                                # But we're in an exception handler, so we can't just continue
                                # Instead, raise a specific error that tells the user to retry
                                # The cleanup is done, so next attempt should work
                                raise HTTPException(
                                    status_code=409, 
                                    detail=f"Cleaned up an orphaned checkout record. Please click 'Complete Checkout' again - it should work now."
                                )
                            except HTTPException:
                                raise  # Re-raise HTTPException
                            except Exception as del_error:
                                print(f"[ERROR] Failed to delete orphaned checkout: {str(del_error)}")
                                db.rollback()
                                raise HTTPException(
                                    status_code=409, 
                                    detail=f"Found an orphaned checkout but couldn't delete it. Please contact support or try refreshing the page."
                                )
                        else:
                            # Room is available, checkout is valid - return it
                            print(f"[INFO] Found existing checkout {existing_checkout.id} for room {room_number}")
                            return CheckoutSuccess(
                                checkout_id=existing_checkout.id,
                                grand_total=existing_checkout.grand_total,
                                checkout_date=existing_checkout.checkout_date or existing_checkout.created_at
                            )
                except HTTPException:
                    raise  # Re-raise HTTPException from cleanup
                except Exception as lookup_error:
                    print(f"[WARNING] Error looking up existing checkout: {str(lookup_error)}")
                
                # If we get here and room is still checked-in, it means we couldn't find the orphaned checkout
                # But we got a unique constraint violation, so something is wrong
                # Try one more time to find and delete any checkout for this booking
                if room.status != "Available":
                    print(f"[ERROR] Unique constraint violation but couldn't find orphaned checkout. Room {room_number} is still checked-in.")
                    print(f"[CLEANUP] Attempting final cleanup for booking {booking.id}...")
                    try:
                        # Final attempt: delete ANY checkout for this booking, regardless of date
                        final_checkout = None
                        if not is_package:
                            final_checkout = db.query(Checkout).filter(Checkout.booking_id == booking.id).first()
                        else:
                            final_checkout = db.query(Checkout).filter(Checkout.package_booking_id == booking.id).first()
                        
                        if final_checkout:
                            # Delete related records
                            db.query(CheckoutVerification).filter(CheckoutVerification.checkout_id == final_checkout.id).delete()
                            db.query(CheckoutPayment).filter(CheckoutPayment.checkout_id == final_checkout.id).delete()
                            db.delete(final_checkout)
                            db.commit()
                            print(f"[CLEANUP] Successfully deleted checkout {final_checkout.id} in final cleanup attempt")
                            raise HTTPException(
                                status_code=409,
                                detail=f"Found and cleaned up a conflicting checkout record. Please click 'Complete Checkout' again - it should work now."
                            )
                        else:
                            # No checkout found, but constraint violation occurred - might be invoice_number
                            raise HTTPException(
                                status_code=409, 
                                detail=f"Checkout failed due to a database constraint (possibly duplicate invoice number). Please try again - the system will generate a new invoice number."
                            )
                    except HTTPException:
                        raise
                    except Exception as final_error:
                        print(f"[ERROR] Final cleanup attempt failed: {str(final_error)}")
                        db.rollback()
                        raise HTTPException(
                            status_code=409, 
                            detail=f"Checkout failed due to a database constraint. Please refresh the page and try again, or contact support. Error: {str(final_error)}"
                        )
                else:
                    raise HTTPException(
                        status_code=409, 
                        detail=f"Checkout failed: A checkout record may already exist for this booking. Please refresh the page."
                    )
            raise HTTPException(status_code=500, detail=f"Checkout failed due to an internal error: {error_detail}")
        
        return CheckoutSuccess(
            checkout_id=new_checkout.id,
            grand_total=new_checkout.grand_total,
            checkout_date=new_checkout.checkout_date or new_checkout.created_at
        )
    
    else:
        # Multiple room checkout (entire booking)
        bill_data = _calculate_bill_for_entire_booking(db, room_number)

        booking = bill_data["booking"]
        all_rooms = bill_data["all_rooms"]
        charges = bill_data["charges"]
        is_package = bill_data["is_package"]
        room_ids = [room.id for room in all_rooms]

        # Check if booking is already checked out
        if booking.status in ["checked_out", "checked-out"]:
            raise HTTPException(status_code=409, detail=f"This booking has already been checked out.")
        
        # Validate booking is in a valid state for checkout
        if booking.status not in ['checked-in', 'checked_in', 'booked']:
            raise HTTPException(status_code=400, detail=f"Booking cannot be checked out. Current status: {booking.status}")
        
        # Check if a checkout record already exists for this booking TODAY (allow multiple checkouts on different dates)
        today = date.today()
        existing_checkout = None
        if not is_package:
            # First check for today's checkout
            existing_checkout = db.query(Checkout).filter(
                Checkout.booking_id == booking.id,
                func.date(Checkout.checkout_date) == today
            ).first()
            # If not found, check for any recent checkout (within last 7 days)
            if not existing_checkout:
                week_ago = date.today() - timedelta(days=7)
                existing_checkout = db.query(Checkout).filter(
                    Checkout.booking_id == booking.id,
                    func.date(Checkout.checkout_date) >= week_ago
                ).order_by(Checkout.created_at.desc()).first()
        else:
            existing_checkout = db.query(Checkout).filter(
                Checkout.package_booking_id == booking.id,
                func.date(Checkout.checkout_date) == today
            ).first()
            if not existing_checkout:
                week_ago = today - timedelta(days=7)
                existing_checkout = db.query(Checkout).filter(
                    Checkout.package_booking_id == booking.id,
                    func.date(Checkout.checkout_date) >= week_ago
                ).order_by(Checkout.created_at.desc()).first()
        
        if existing_checkout:
            # Return existing checkout instead of error
            print(f"[INFO] Found existing checkout {existing_checkout.id} for booking {booking.id}, returning it")
            return CheckoutSuccess(
                checkout_id=existing_checkout.id,
                grand_total=existing_checkout.grand_total,
                checkout_date=existing_checkout.checkout_date or existing_checkout.created_at
            )
        
        # Check if any rooms are already checked out
        already_checked_out_rooms = [room.number for room in all_rooms if room.status == "Available"]
        if already_checked_out_rooms:
            raise HTTPException(
                status_code=409, 
                detail=f"Some rooms in this booking are already checked out: {', '.join(already_checked_out_rooms)}. Please checkout remaining rooms individually or select rooms that are still checked in."
            )
        
        try:
            # ===== ENHANCED MULTIPLE ROOM CHECKOUT PROCESSING =====
            
            # 1. Process Pre-Checkout Verification for all rooms
            total_consumables_charges = 0.0
            total_asset_damage_charges = 0.0
            total_key_card_fee = 0.0
            
            # Check for CheckoutRequest
            checkout_requests = []
            if is_package:
                checkout_requests = db.query(CheckoutRequestModel).filter(
                    CheckoutRequestModel.package_booking_id == booking.id,
                    CheckoutRequestModel.status == "completed"
                ).all()
            else:
                checkout_requests = db.query(CheckoutRequestModel).filter(
                    CheckoutRequestModel.booking_id == booking.id,
                    CheckoutRequestModel.status == "completed"
                ).all()

            for checkout_request in checkout_requests:
                if checkout_request.inventory_data:
                    from app.models.inventory import InventoryItem
                    for item_data in checkout_request.inventory_data:
                        item_id = item_data.get('item_id')
                        used_qty = float(item_data.get('used_qty', 0))
                        
                        if used_qty > 0:
                            inv_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
                            if inv_item and inv_item.is_sellable_to_guest:
                                limit = inv_item.complimentary_limit or 0
                                chargeable_qty = max(0, used_qty - limit)
                                
                                if chargeable_qty > 0:
                                    price = inv_item.selling_price or inv_item.unit_price or 0
                                    total_consumables_charges += chargeable_qty * price
            
            if request.room_verifications:
                for room_verification in request.room_verifications:
                    # Find the room
                    room_obj = next((r for r in all_rooms if r.number == room_verification.room_number), None)
                    if not room_obj:
                        continue
                    
                    # Process consumables audit
                    consumables_audit = process_consumables_audit(
                        db, room_obj.id, room_verification.consumables
                    )
                    total_consumables_charges += consumables_audit["total_charge"]
                    
                    # Process asset damages
                    asset_damage = process_asset_damage_check(room_verification.asset_damages)
                    total_asset_damage_charges += asset_damage["total_charge"]
                    
                    # Key card fee
                    if not room_verification.key_card_returned:
                        total_key_card_fee += 50.0
            
            # 2. Calculate Late Checkout Fee (based on average room rate)
            actual_checkout_time = request.actual_checkout_time or datetime.now()
            avg_room_rate = sum((r.price or 0.0) for r in all_rooms) / len(all_rooms) if all_rooms else 0.0
            late_checkout_fee = calculate_late_checkout_fee(
                booking.check_out,
                actual_checkout_time,
                avg_room_rate
            )
            
            # 3. Get Advance Deposit
            advance_deposit = getattr(booking, 'advance_deposit', 0.0) or 0.0
            
            # 4. Calculate final bill with all charges
            subtotal = charges.total_due + total_consumables_charges + total_asset_damage_charges + total_key_card_fee + late_checkout_fee
            
            # Recalculate GST
            consumables_gst = total_consumables_charges * 0.05
            asset_damage_gst = total_asset_damage_charges * 0.18
            
            tax_amount = (charges.total_gst or 0) + consumables_gst + asset_damage_gst
            
            discount_amount = max(0, request.discount_amount or 0)
            tips_gratuity = max(0, request.tips_gratuity or 0.0)
            
            grand_total_before_advance = max(0, subtotal + tax_amount - discount_amount + tips_gratuity)
            grand_total = max(0, grand_total_before_advance - advance_deposit)
            
            # 5. Get effective checkout date
            effective_checkout = bill_data.get("effective_checkout_date", booking.check_out)
            effective_checkout_datetime = datetime.combine(effective_checkout, datetime.min.time())
            
            # 6. Generate invoice number
            invoice_number = generate_invoice_number(db)
            
            # 7. Create enhanced checkout record
            new_checkout = Checkout(
                booking_id=booking.id if not is_package else None,
                package_booking_id=booking.id if is_package else None,
                room_total=charges.room_charges,
                food_total=charges.food_charges,
                service_total=charges.service_charges,
                package_total=charges.package_charges,
                tax_amount=tax_amount,
                discount_amount=discount_amount,
                grand_total=grand_total,
                payment_method=request.payment_method or "cash",
                payment_status="Paid",
                guest_name=booking.guest_name,
                room_number=", ".join(sorted([room.number for room in all_rooms])),
                checkout_date=effective_checkout_datetime,
                # Enhanced fields
                late_checkout_fee=late_checkout_fee,
                consumables_charges=total_consumables_charges,
                asset_damage_charges=total_asset_damage_charges,
                key_card_fee=total_key_card_fee,
                advance_deposit=advance_deposit,
                tips_gratuity=tips_gratuity,
                guest_gstin=request.guest_gstin,
                is_b2b=request.is_b2b or False,
                invoice_number=invoice_number
            )
            # If invoice_number wasn't generated, create one based on checkout ID after flush
            if not invoice_number:
                db.add(new_checkout)
                db.flush()  # Flush to get checkout ID
                invoice_number = f"INV-{new_checkout.id:06d}"
                new_checkout.invoice_number = invoice_number
            else:
                db.add(new_checkout)
                db.flush()  # Flush to get checkout ID
            
            # 8. Create checkout verification records for all rooms
            if request.room_verifications:
                for room_verification in request.room_verifications:
                    room_obj = next((r for r in all_rooms if r.number == room_verification.room_number), None)
                    if room_obj:
                        create_checkout_verification(db, new_checkout.id, room_verification, room_obj.id)
                        # Deduct consumables
                        deduct_room_consumables(
                            db, room_obj.id, room_verification.consumables, 
                            new_checkout.id, current_user.id if current_user else None
                        )
            
            # Deduct from CheckoutRequest if available
            for checkout_request in checkout_requests:
                if checkout_request.inventory_data:
                    # Find the room for this request
                    room_obj = next((r for r in all_rooms if r.number == checkout_request.room_number), None)
                    if room_obj:
                         # Convert inventory_data to list of objects with item_id and actual_consumed
                        class SimpleConsumable:
                            def __init__(self, item_id, actual_consumed):
                                self.item_id = item_id
                                self.actual_consumed = actual_consumed
                        
                        consumables_list = []
                        for item in checkout_request.inventory_data:
                            if float(item.get('used_qty', 0)) > 0:
                                consumables_list.append(SimpleConsumable(item.get('item_id'), float(item.get('used_qty', 0))))
                        
                        if consumables_list:
                            deduct_room_consumables(
                                db, room_obj.id, consumables_list, 
                                new_checkout.id, current_user.id if current_user else None
                            )
            
            # Clear remaining consumables from room inventory
            from app.models.inventory import InventoryItem, Location, StockIssue, StockIssueDetail
            for room in all_rooms:
                if room.inventory_location_id:
                    # Find all sellable items that have been issued to this room location
                    room_items = (
                        db.query(InventoryItem)
                        .join(StockIssueDetail, StockIssueDetail.item_id == InventoryItem.id)
                        .join(StockIssue, StockIssue.id == StockIssueDetail.issue_id)
                        .filter(
                            StockIssue.destination_location_id == room.inventory_location_id,
                            InventoryItem.is_sellable_to_guest == True
                        )
                        .distinct()
                        .all()
                    )
                    
                    for item in room_items:
                        # Reset stock to 0
                        item.current_stock = 0.0
            
            # 9. Process split payments
            if request.split_payments:
                process_split_payments(db, new_checkout.id, request.split_payments)
            elif request.payment_method:
                payment_record = CheckoutPayment(
                    checkout_id=new_checkout.id,
                    payment_method=request.payment_method,
                    amount=grand_total,
                    notes="Single payment method"
                )
                db.add(payment_record)
            
            # 10. Update billing status
            db.query(FoodOrder).filter(
                FoodOrder.room_id.in_(room_ids), 
                FoodOrder.billing_status == "unbilled"
            ).update({"billing_status": "billed"})
            
            db.query(AssignedService).filter(
                AssignedService.room_id.in_(room_ids), 
                AssignedService.billing_status == "unbilled"
            ).update({
                "billing_status": "billed",
                "last_used_at": datetime.utcnow()
            })
            
            # 11. Inventory Triggers for all rooms
            if request.room_verifications:
                for room_verification in request.room_verifications:
                    room_obj = next((r for r in all_rooms if r.number == room_verification.room_number), None)
                    if room_obj:
                        deduct_room_consumables(
                            db, room_obj.id, room_verification.consumables,
                            new_checkout.id, current_user.id if current_user else None
                        )
                        trigger_linen_cycle(db, room_obj.id, new_checkout.id)
            
            # 12. Update booking and room statuses
            booking.status = "checked_out"
            db.query(Room).filter(Room.id.in_(room_ids)).update({"status": "Available"})
            
            # 12.5. Automatically create cleaning and refill service requests for all rooms
            try:
                from app.curd import service_request as service_request_crud
                for room in all_rooms:
                    try:
                        # Create cleaning service request
                        service_request_crud.create_cleaning_service_request(
                            db, room.id, room.number, booking.guest_name
                        )
                        # Create refill service request with checkout_id to get consumables data
                        service_request_crud.create_refill_service_request(
                            db, room.id, room.number, booking.guest_name, new_checkout.id
                        )
                    except Exception as room_service_error:
                        # Don't fail checkout if service request creation fails for one room
                        print(f"[WARNING] Failed to create service requests for room {room.number}: {room_service_error}")
            except Exception as service_error:
                # Don't fail checkout if service request creation fails
                print(f"[WARNING] Failed to create service requests: {service_error}")

            db.commit()
            db.refresh(new_checkout)
            
            # 12. Automatically create journal entry for checkout (Scenario 2: Guest Checkout)
            # Debit: Bank Account / Cash | Credit: Room Revenue, Output CGST, Output SGST
            # Only create if grand_total > 0 and we have valid data
            if new_checkout.grand_total and new_checkout.grand_total > 0:
                try:
                    from app.utils.accounting_helpers import create_complete_checkout_journal_entry
                    
                    payment_method = request.payment_method or "cash"
                    result = create_complete_checkout_journal_entry(
                        db=db,
                        checkout_id=new_checkout.id,
                        room_total=float(new_checkout.room_total or 0),
                        food_total=float(new_checkout.food_total or 0),
                        service_total=float(new_checkout.service_total or 0),
                        package_total=float(new_checkout.package_total or 0),
                        tax_amount=float(new_checkout.tax_amount or 0),
                        discount_amount=float(new_checkout.discount_amount or 0),
                        grand_total=float(new_checkout.grand_total or 0),
                        guest_name=new_checkout.guest_name or "Guest",
                        room_number=room_number,  # Primary room number
                        gst_rate=18.0,
                        payment_method=payment_method,
                        created_by=current_user.id if current_user else None,
                        advance_amount=float(new_checkout.advance_deposit or 0)
                    )
                    if result is None:
                        print(f"[INFO] Journal entry not created for checkout {new_checkout.id} (ledgers may not be set up yet)")
                except Exception as journal_error:
                    import traceback
                    print(f"[WARNING] Failed to create journal entry for checkout {new_checkout.id}: {str(journal_error)}\n{traceback.format_exc()}")

        except Exception as e:
            db.rollback()
            error_detail = str(e)
            # Check for unique constraint violation (postgres error code 23505)
            if "unique constraint" in error_detail.lower() or "duplicate key" in error_detail.lower() or "23505" in error_detail:
                raise HTTPException(
                    status_code=409, 
                    detail=f"This booking has already been checked out. A checkout record already exists for this booking."
                )
            raise HTTPException(status_code=500, detail=f"Checkout failed due to an internal error: {error_detail}")

        # Return the data from the newly created checkout record
        return CheckoutSuccess(
            checkout_id=new_checkout.id,
            grand_total=new_checkout.grand_total,
            checkout_date=new_checkout.checkout_date or new_checkout.created_at
        )
