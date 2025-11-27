from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from typing import List
from datetime import date, datetime

# Assume your utility and model imports are set up correctly
from app.utils.auth import get_db, get_current_user
from app.models.room import Room
from app.models.booking import Booking, BookingRoom
from app.models.Package import Package, PackageBooking, PackageBookingRoom
from app.models.user import User
from app.models.foodorder import FoodOrder, FoodOrderItem
from app.models.service import AssignedService, Service
from app.models.checkout import Checkout
from app.schemas.checkout import BillSummary, BillBreakdown, CheckoutFull, CheckoutSuccess, CheckoutRequest

router = APIRouter(prefix="/bill", tags=["checkout"])

# IMPORTANT: To support this new logic, you must update your BillSummary schema.
# In `app/schemas/checkout.py`, please change the `room_number: str` field to:
# room_numbers: List[str]


@router.get("/checkouts", response_model=List[CheckoutFull])
def get_all_checkouts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), skip: int = 0, limit: int = 20):
    """Retrieves a list of all completed checkouts, ordered by most recent."""
    checkouts = db.query(Checkout).order_by(Checkout.id.desc()).offset(skip).limit(limit).all()
    return checkouts if checkouts else []

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
    
    # Get food and service charges for THIS ROOM ONLY
    # Include food orders with billing_status "unbilled" or NULL (for orders created before billing_status was added)
    # Exclude only orders that are explicitly marked as "billed"
    unbilled_food_order_items = (db.query(FoodOrderItem)
                                 .join(FoodOrder)
                                 .options(joinedload(FoodOrderItem.food_item))
                                 .filter(FoodOrder.room_id == room.id, 
                                        or_(FoodOrder.billing_status == "unbilled", 
                                            FoodOrder.billing_status.is_(None)))
                                 .all())
    
    unbilled_services = db.query(AssignedService).options(joinedload(AssignedService.service)).filter(AssignedService.room_id == room.id, AssignedService.billing_status == "unbilled").all()
    
    charges.food_charges = sum(item.quantity * item.food_item.price for item in unbilled_food_order_items if item.food_item)
    charges.service_charges = sum(ass.service.charges for ass in unbilled_services)
    
    charges.food_items = [{"item_name": item.food_item.name, "quantity": item.quantity, "amount": item.quantity * item.food_item.price} for item in unbilled_food_order_items if item.food_item]
    charges.service_items = [{"service_name": ass.service.name, "charges": ass.service.charges} for ass in unbilled_services]
    
    # Calculate GST
    # Room charges: 5% GST if < 5000, 12% GST if 5000-7500, 18% GST if > 7500
    room_charge_amount = charges.room_charges or 0
    if room_charge_amount > 0:
        if room_charge_amount < 5000:
            charges.room_gst = room_charge_amount * 0.05
        elif room_charge_amount <= 7500:
            charges.room_gst = room_charge_amount * 0.12
        else:
            charges.room_gst = room_charge_amount * 0.18
    
    # Package charges: Same rule as room charges (5% if < 5000, 12% if 5000-7500, 18% if > 7500)
    package_charge_amount = charges.package_charges or 0
    if package_charge_amount > 0:
        if package_charge_amount < 5000:
            charges.package_gst = package_charge_amount * 0.05
        elif package_charge_amount <= 7500:
            charges.package_gst = package_charge_amount * 0.12
        else:
            charges.package_gst = package_charge_amount * 0.18
    
    # Food charges: 5% GST always
    food_charge_amount = charges.food_charges or 0
    if food_charge_amount > 0:
        charges.food_gst = food_charge_amount * 0.05
    
    # Total GST
    charges.total_gst = (charges.room_gst or 0) + (charges.food_gst or 0) + (charges.package_gst or 0)
    
    # Total due (subtotal before GST)
    charges.total_due = sum([charges.room_charges, charges.food_charges, charges.service_charges, charges.package_charges])
    
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
    
    # Sum up additional food and service charges from all rooms
    # We need to get the individual items from the orders to display them.
    # Include food orders with billing_status "unbilled" or NULL (for orders created before billing_status was added)
    # Exclude only orders that are explicitly marked as "billed"
    unbilled_food_order_items = (db.query(FoodOrderItem)
                                 .join(FoodOrder)
                                 .options(joinedload(FoodOrderItem.food_item))
                                 .filter(FoodOrder.room_id.in_(room_ids), 
                                        or_(FoodOrder.billing_status == "unbilled", 
                                            FoodOrder.billing_status.is_(None)))
                                 .all())

    unbilled_services = db.query(AssignedService).options(joinedload(AssignedService.service)).filter(AssignedService.room_id.in_(room_ids), AssignedService.billing_status == "unbilled").all()

    # Calculate total food charges from the individual items.
    charges.food_charges = sum(item.quantity * item.food_item.price for item in unbilled_food_order_items if item.food_item)
    charges.service_charges = sum(ass.service.charges for ass in unbilled_services)

    # Populate detailed item lists for the bill summary
    charges.food_items = [{"item_name": item.food_item.name, "quantity": item.quantity, "amount": item.quantity * item.food_item.price} for item in unbilled_food_order_items if item.food_item]
    charges.service_items = [{"service_name": ass.service.name, "charges": ass.service.charges} for ass in unbilled_services]

    # Calculate GST
    # Room charges: 5% GST if < 5000, 12% GST if 5000-7500, 18% GST if > 7500
    room_charge_amount = charges.room_charges or 0
    if room_charge_amount > 0:
        if room_charge_amount < 5000:
            charges.room_gst = room_charge_amount * 0.05
        elif room_charge_amount <= 7500:
            charges.room_gst = room_charge_amount * 0.12
        else:
            charges.room_gst = room_charge_amount * 0.18
    
    # Package charges: Same rule as room charges (5% if < 5000, 12% if 5000-7500, 18% if > 7500)
    package_charge_amount = charges.package_charges or 0
    if package_charge_amount > 0:
        if package_charge_amount < 5000:
            charges.package_gst = package_charge_amount * 0.05
        elif package_charge_amount <= 7500:
            charges.package_gst = package_charge_amount * 0.12
        else:
            charges.package_gst = package_charge_amount * 0.18
    
    # Food charges: 5% GST always
    food_charge_amount = charges.food_charges or 0
    if food_charge_amount > 0:
        charges.food_gst = food_charge_amount * 0.05
    
    # Total GST
    charges.total_gst = (charges.room_gst or 0) + (charges.food_gst or 0) + (charges.package_gst or 0)

    # Total due (subtotal before GST)
    charges.total_due = sum([charges.room_charges, charges.food_charges, charges.service_charges, charges.package_charges])

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
        
        # Check if there's already a checkout for this specific room today (to prevent duplicates)
        today = date.today()
        existing_room_checkout = db.query(Checkout).filter(
            Checkout.room_number == room_number,
            func.date(Checkout.checkout_date) == today
        ).first()
        
        # If checkout exists, verify the room status matches
        if existing_room_checkout:
            # If room is still not "Available", the checkout didn't complete properly - allow retry
            if room.status != "Available":
                # Delete the orphaned checkout record and allow retry
                db.delete(existing_room_checkout)
                db.commit()
            else:
                # Room is already checked out - raise error
                raise HTTPException(
                    status_code=409,
                    detail=f"Room {room_number} was already checked out today (Checkout ID: {existing_room_checkout.id}). Please refresh the page to see updated room status."
                )
        
        # Check if room is already available (already checked out)
        if room.status == "Available":
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
            # Calculate final bill with GST
            subtotal = charges.total_due
            # Use the calculated GST from charges (already includes room, food, and package GST)
            tax_amount = charges.total_gst or 0
            discount_amount = max(0, request.discount_amount or 0)
            grand_total = max(0, subtotal + tax_amount - discount_amount)
            
            # Get effective checkout date for billing (today if late checkout, booking.check_out if early)
            effective_checkout = bill_data.get("effective_checkout_date", booking.check_out)
            # Convert date to datetime for checkout_date field
            effective_checkout_datetime = datetime.combine(effective_checkout, datetime.min.time())
            
            # Create checkout record for single room
            # For single room checkout, we need to link to booking_id/package_booking_id for display
            # However, unique constraint on booking_id prevents multiple single-room checkouts from same booking
            # Solution: Only set booking_id/package_booking_id if this is the first checkout for this booking
            # Otherwise, leave it NULL and rely on room_number for tracking
            
            # Check if there's already a checkout with this booking_id (multiple room checkout case)
            existing_booking_checkout = None
            if not is_package:
                existing_booking_checkout = db.query(Checkout).filter(Checkout.booking_id == booking.id).first()
            else:
                existing_booking_checkout = db.query(Checkout).filter(Checkout.package_booking_id == booking.id).first()
            
            # Set booking_id/package_booking_id only if no checkout exists for this booking yet
            # This ensures at least one checkout per booking shows the booking_id
            booking_id_to_set = None
            package_booking_id_to_set = None
            
            if not existing_booking_checkout:
                # First checkout for this booking - set the IDs
                booking_id_to_set = booking.id if not is_package else None
                package_booking_id_to_set = booking.id if is_package else None
            
            new_checkout = Checkout(
                booking_id=booking_id_to_set,  # Set only for first checkout per booking
                package_booking_id=package_booking_id_to_set,  # Set only for first checkout per booking
                room_total=charges.room_charges,
                food_total=charges.food_charges,
                service_total=charges.service_charges,
                package_total=charges.package_charges,
                tax_amount=tax_amount,
                discount_amount=discount_amount,
                grand_total=grand_total,
                payment_method=request.payment_method,
                payment_status="Paid",
                guest_name=booking.guest_name,
                room_number=room.number,
                checkout_date=effective_checkout_datetime  # Use effective checkout date
            )
            db.add(new_checkout)
            
            # Update only this room's related records
            db.query(FoodOrder).filter(FoodOrder.room_id == room.id, FoodOrder.billing_status == "unbilled").update({"billing_status": "billed"})
            db.query(AssignedService).filter(AssignedService.room_id == room.id, AssignedService.billing_status == "unbilled").update({"billing_status": "billed"})
            
            # Update room status only (don't change booking status)
            room.status = "Available"
            
            # Check if all rooms in booking are checked out, then update booking status
            if is_package:
                remaining_rooms = [link.room for link in booking.rooms if link.room.status != "Available"]
            else:
                remaining_rooms = [link.room for link in booking.booking_rooms if link.room.status != "Available"]
            
            if not remaining_rooms:
                # All rooms checked out, mark booking as checked out
                booking.status = "checked_out"
            
            db.commit()
            db.refresh(new_checkout)
            
        except Exception as e:
            db.rollback()
            error_detail = str(e)
            # Check for unique constraint violation
            if "unique constraint" in error_detail.lower() or "duplicate key" in error_detail.lower() or "23505" in error_detail:
                raise HTTPException(
                    status_code=409, 
                    detail=f"Checkout failed: A checkout record may already exist for this booking."
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
        
        # Check if a checkout record already exists for this booking (unique constraint)
        existing_checkout = None
        if not is_package:
            existing_checkout = db.query(Checkout).filter(Checkout.booking_id == booking.id).first()
        else:
            existing_checkout = db.query(Checkout).filter(Checkout.package_booking_id == booking.id).first()
        
        if existing_checkout:
            raise HTTPException(status_code=409, detail=f"This booking has already been checked out. Checkout ID: {existing_checkout.id}")
        
        # Check if any rooms are already checked out
        already_checked_out_rooms = [room.number for room in all_rooms if room.status == "Available"]
        if already_checked_out_rooms:
            raise HTTPException(
                status_code=409, 
                detail=f"Some rooms in this booking are already checked out: {', '.join(already_checked_out_rooms)}. Please checkout remaining rooms individually or select rooms that are still checked in."
            )
        
        try:
            # Calculate final bill with GST
            subtotal = charges.total_due
            # Use the calculated GST from charges (already includes room, food, and package GST)
            tax_amount = charges.total_gst or 0
            # Apply discount from the request, ensuring it's not negative
            discount_amount = max(0, request.discount_amount or 0)
            grand_total = max(0, subtotal + tax_amount - discount_amount)
            
            # Get effective checkout date for billing (today if late checkout, booking.check_out if early)
            effective_checkout = bill_data.get("effective_checkout_date", booking.check_out)
            # Convert date to datetime for checkout_date field
            effective_checkout_datetime = datetime.combine(effective_checkout, datetime.min.time())

            # Create a single checkout record for the entire booking
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
                payment_method=request.payment_method,
                payment_status="Paid",
                guest_name=booking.guest_name,
                room_number=", ".join(sorted([room.number for room in all_rooms])),
                checkout_date=effective_checkout_datetime  # Use effective checkout date
            )
            db.add(new_checkout)

            # Atomically update all related records
            db.query(FoodOrder).filter(FoodOrder.room_id.in_(room_ids), FoodOrder.billing_status == "unbilled").update({"billing_status": "billed"})
            db.query(AssignedService).filter(AssignedService.room_id.in_(room_ids), AssignedService.billing_status == "unbilled").update({"billing_status": "billed"})
            
            booking.status = "checked_out"
            db.query(Room).filter(Room.id.in_(room_ids)).update({"status": "Available"})

            db.commit()
            db.refresh(new_checkout)

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
