# booking.py
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session, joinedload, load_only
from sqlalchemy import or_, and_
from typing import List, Union
from app.utils.auth import get_db, get_current_user
from app.utils.booking_id import parse_display_id
from app.models.booking import Booking, BookingRoom
from app.models.user import User
from app.models.room import Room
from app.models.Package import Package, PackageBooking, PackageBookingRoom
from app.schemas.booking import BookingCreate, BookingOut
from app.schemas.room import RoomOut
from fastapi.responses import FileResponse
import os
import shutil
import uuid

UPLOAD_DIR = "uploads/checkin_proofs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
from app.schemas.booking import BookingOut, BookingRoomOut
from pydantic import BaseModel, ValidationError

class PaginatedBookingResponse(BaseModel):
    total: int
    bookings: List[BookingOut]

router = APIRouter(prefix="/bookings", tags=["Bookings"])

@router.get("", response_model=PaginatedBookingResponse)
def get_bookings(db: Session = Depends(get_db), skip: int = 0, limit: int = 20, order_by: str = "id", order: str = "desc"):
    try:
        # Get regular bookings with room details, ordered by latest first
        query = db.query(Booking).options(
            joinedload(Booking.booking_rooms).joinedload(BookingRoom.room),
            joinedload(Booking.user).joinedload(User.role)
        )
        
        # Apply ordering
        if order_by == "id" and order == "desc":
            query = query.order_by(Booking.id.desc())
        elif order_by == "id" and order == "asc":
            query = query.order_by(Booking.id.asc())
        elif order_by == "check_in" and order == "desc":
            query = query.order_by(Booking.check_in.desc())
        elif order_by == "check_in" and order == "asc":
            query = query.order_by(Booking.check_in.asc())
        
        regular_bookings = query.offset(skip).limit(limit).all()
        
        # Convert to BookingOut format
        booking_results = []
        for booking in regular_bookings:
            # Handle invalid emails gracefully
            user_obj = None
            if booking.user:
                try:
                    from app.schemas.user import UserOut
                    user_data = booking.user
                    email = user_data.email if hasattr(user_data, "email") else None
                    if email and "@" in email and "." not in email.split("@")[1]:
                        # Fix malformed email by appending .com
                        email = email + ".com"
                    user_dict = {
                        "id": user_data.id,
                        "name": user_data.name,
                        "email": email,
                        "phone": getattr(user_data, "phone", None),
                        "is_active": getattr(user_data, "is_active", True),
                        "role": user_data.role if hasattr(user_data, "role") else None
                    }
                    user_obj = UserOut.model_validate(user_dict)
                except Exception as e:
                    print(f"Warning: Could not create UserOut for booking {booking.id}: {str(e)}")
                    user_obj = None

            booking_out = BookingOut(
                id=booking.id,
                guest_name=booking.guest_name,
                guest_mobile=booking.guest_mobile,
                guest_email=booking.guest_email,
                status=booking.status,
                check_in=booking.check_in,
                check_out=booking.check_out,
                adults=booking.adults,
                children=booking.children,
                id_card_image_url=getattr(booking, 'id_card_image_url', None),
                guest_photo_url=getattr(booking, 'guest_photo_url', None),
                user=user_obj,
                is_package=False,
                rooms=[br.room for br in booking.booking_rooms if br.room]
            )
            booking_results.append(booking_out)
        
        # Get total count
        total_count = db.query(Booking).count()
        
        return {"total": total_count, "bookings": booking_results}
    except Exception as e:
        print(f"Error fetching bookings: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching bookings: {str(e)}")

# ----------------------------------------------------------------
# GET Detailed view for a SINGLE booking (regular or package)
# This is a more reliable way to get full details for the modal view.
# ----------------------------------------------------------------
@router.get("/details/{booking_id}", response_model=BookingOut)
def get_booking_details(booking_id: Union[str, int], is_package: bool, db: Session = Depends(get_db)):
    # Parse display ID (BK-000001 or PK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    
    # Validate booking type matches is_package parameter
    if booking_type:
        if booking_type == "package" and not is_package:
            raise HTTPException(status_code=400, detail=f"Booking ID {booking_id} is a package booking, but is_package parameter is False")
        if booking_type == "booking" and is_package:
            raise HTTPException(status_code=400, detail=f"Booking ID {booking_id} is a regular booking, but is_package parameter is True")
    
    booking_id = numeric_id
    
    if is_package:
        booking = db.query(PackageBooking).options(
            joinedload(PackageBooking.rooms).joinedload(PackageBookingRoom.room),
            joinedload(PackageBooking.user),
            joinedload(PackageBooking.package)
        ).filter(PackageBooking.id == booking_id).first()

        if not booking:
            raise HTTPException(status_code=404, detail="Package booking not found")

        return BookingOut(
            id=booking.id,
            guest_name=booking.guest_name,
            guest_mobile=booking.guest_mobile,
            guest_email=booking.guest_email,
            status=booking.status,
            check_in=booking.check_in,
            check_out=booking.check_out,
            adults=booking.adults,
            children=booking.children,
            id_card_image_url=getattr(booking, 'id_card_image_url', None),
            guest_photo_url=getattr(booking, 'guest_photo_url', None),
            user=booking.user,
            is_package=True,
            rooms=[pbr.room for pbr in booking.rooms if pbr.room]
        )
    else: # Regular booking
        booking = db.query(Booking).options(
            joinedload(Booking.booking_rooms).joinedload(BookingRoom.room),
            joinedload(Booking.user).joinedload(User.role)
        ).filter(Booking.id == booking_id).first()

        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Manually construct the response to ensure rooms and image URLs are correctly populated
        return BookingOut(
            id=booking.id,
            guest_name=booking.guest_name,
            guest_mobile=booking.guest_mobile,
            guest_email=booking.guest_email,
            status=booking.status,
            check_in=booking.check_in,
            check_out=booking.check_out,
            adults=booking.adults,
            children=booking.children,
            id_card_image_url=getattr(booking, 'id_card_image_url', None),
            guest_photo_url=getattr(booking, 'guest_photo_url', None),
            user=booking.user,
            is_package=False,
            rooms=[br.room for br in booking.booking_rooms if br.room]
        )


# -------------------------------
# Helper function to get or create guest user
# -------------------------------
def get_or_create_guest_user(db: Session, email: str, mobile: str, name: str):
    """
    Find or create a guest user based on email and mobile number.
    Returns the user_id to link bookings to the same user.
    """
    from app.models.user import User, Role
    import bcrypt
    
    # Normalize empty strings to None for easier handling
    email = email.strip() if email and isinstance(email, str) else None
    mobile = mobile.strip() if mobile and isinstance(mobile, str) else None
    name = name.strip() if name and isinstance(name, str) else "Guest User"
    
    # Need at least one identifier (email or mobile)
    if not email and not mobile:
        raise ValueError("Either email or mobile number must be provided")
    
    # First, try to find user by email (most reliable identifier)
    user = None
    if email:
        user = db.query(User).filter(User.email == email).first()
    
    # If not found by email, try by mobile/phone
    if not user and mobile:
        user = db.query(User).filter(User.phone == mobile).first()
    
    # If user exists, return the user_id
    if user:
        # Update name if provided and different
        if name and user.name != name:
            user.name = name
            db.commit()
        return user.id
    
    # If user doesn't exist, create a new guest user
    try:
        # First, ensure 'guest' role exists
        guest_role = db.query(Role).filter(Role.name == "guest").first()
        if not guest_role:
            # Create guest role if it doesn't exist
            guest_role = Role(name="guest", permissions="[]")
            db.add(guest_role)
            db.commit()
            db.refresh(guest_role)
        
        # Generate a placeholder password for guest users (they won't log in)
        password_bytes = "guest_user_no_password".encode("utf-8")
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password_bytes, salt).decode("utf-8")
        
        # Create email if not provided (use mobile-based email or generate unique one)
        if not email:
            if mobile:
                user_email = f"guest_{mobile}@temp.com"
            else:
                # Generate a unique email based on timestamp
                import time
                user_email = f"guest_{int(time.time())}@temp.com"
        else:
            user_email = email
        
        # Check if email already exists (race condition check)
        existing_user = db.query(User).filter(User.email == user_email).first()
        if existing_user:
            # User was created between our check and creation attempt
            return existing_user.id
        
        # Create new guest user
        new_user = User(
            name=name,
            email=user_email,
            phone=mobile if mobile else None,
            hashed_password=hashed_password,
            role_id=guest_role.id,
            is_active=True
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user.id
    except Exception as e:
        # If user creation fails due to unique constraint or other DB error, try to find existing user
        db.rollback()  # Rollback the failed transaction
        if email:
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                return existing_user.id
        if mobile:
            existing_user = db.query(User).filter(User.phone == mobile).first()
            if existing_user:
                return existing_user.id
        # Re-raise if we can't find existing user
        raise ValueError(f"Failed to create or find guest user: {str(e)}")

# -------------------------------
# POST a new booking
# -------------------------------
@router.post("", response_model=BookingOut) # Changed from "/" to ""
def create_booking(booking: BookingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Find or create guest user based on email and mobile
    guest_user_id = None
    # Normalize email and mobile - convert empty strings to None, handle None safely
    try:
        guest_email = booking.guest_email.strip() if (booking.guest_email and isinstance(booking.guest_email, str) and booking.guest_email.strip()) else None
    except (AttributeError, TypeError):
        guest_email = None
    
    try:
        guest_mobile = booking.guest_mobile.strip() if (booking.guest_mobile and isinstance(booking.guest_mobile, str) and booking.guest_mobile.strip()) else None
    except (AttributeError, TypeError):
        guest_mobile = None
    
    if guest_email or guest_mobile:
        try:
            guest_user_id = get_or_create_guest_user(
                db=db,
                email=guest_email,
                mobile=guest_mobile,
                name=booking.guest_name or "Guest User"
            )
        except Exception as e:
            # Log error but don't fail the booking if user creation fails
            print(f"Warning: Could not create/link guest user: {str(e)}")
    
    # Check for an existing booking to reuse guest details for consistency
    existing_booking = db.query(Booking).filter(
        (Booking.guest_email == booking.guest_email) & (Booking.guest_mobile == booking.guest_mobile)
    ).order_by(Booking.id.desc()).first()

    guest_name_to_use = booking.guest_name
    if existing_booking:
        # If a guest with the same email and mobile exists, use their established name
        guest_name_to_use = existing_booking.guest_name

    # Validate room capacity for adults and children separately
    selected_rooms = db.query(Room).filter(Room.id.in_(booking.room_ids)).all()
    if len(selected_rooms) != len(booking.room_ids):
        raise HTTPException(status_code=400, detail="One or more selected rooms are invalid.")
    
    total_adult_capacity = sum(room.adults or 0 for room in selected_rooms)
    total_children_capacity = sum(room.children or 0 for room in selected_rooms)
    
    if booking.adults > total_adult_capacity:
        raise HTTPException(
            status_code=400,
            detail=f"The number of adults ({booking.adults}) exceeds the total adult capacity of the selected rooms ({total_adult_capacity} adults max). Please select additional rooms or reduce the number of adults."
        )
    
    if booking.children > total_children_capacity:
        raise HTTPException(
            status_code=400,
            detail=f"The number of children ({booking.children}) exceeds the total children capacity of the selected rooms ({total_children_capacity} children max). Please select additional rooms or reduce the number of children."
        )

    # Check if rooms are available for the requested dates
    for room_id in booking.room_ids:
        # Check if room is already booked by regular bookings for overlapping dates (only check active bookings, not cancelled or checked-out)
        conflicting_regular_booking = db.query(BookingRoom).join(Booking).filter(
            BookingRoom.room_id == room_id,
            Booking.status.in_(['booked', 'checked-in']),  # Only check for active bookings
            Booking.check_in < booking.check_out,
            Booking.check_out > booking.check_in
        ).first()
        
        # Check if room is already booked by package bookings for overlapping dates
        conflicting_package_booking = db.query(PackageBookingRoom).join(PackageBooking).filter(
            PackageBookingRoom.room_id == room_id,
            PackageBooking.status.in_(['booked', 'checked-in']),  # Only check for active bookings
            PackageBooking.check_in < booking.check_out,
            PackageBooking.check_out > booking.check_in
        ).first()
        
        if conflicting_regular_booking or conflicting_package_booking:
            room = db.query(Room).filter(Room.id == room_id).first()
            raise HTTPException(
                status_code=400,
                detail=f"Room {room.number if room else room_id} is not available for the selected dates."
            )

    db_booking = Booking(
        guest_name=guest_name_to_use,
        guest_mobile=booking.guest_mobile,
        guest_email=booking.guest_email,
        check_in=booking.check_in,
        check_out=booking.check_out,
        adults=booking.adults,
        children=booking.children,
        user_id=guest_user_id,  # Link booking to guest user
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)

    # Create BookingRoom links and update room status
    for room_id in booking.room_ids:
        room = db.query(Room).filter(Room.id == room_id).first()
        if room:
            room.status = "Booked"
        db.add(BookingRoom(booking_id=db_booking.id, room_id=room_id))
    
    db.commit()

    db.refresh(db_booking)
    
    # Reload with room details for response
    booking_with_rooms = (
        db.query(Booking)
        .options(joinedload(Booking.booking_rooms).joinedload(BookingRoom.room))
        .filter(Booking.id == db_booking.id)
        .first()
    )
    
    # Convert to BookingOut format with rooms
    booking_out = BookingOut(
        id=booking_with_rooms.id,
        guest_name=booking_with_rooms.guest_name,
        guest_mobile=booking_with_rooms.guest_mobile,
        guest_email=booking_with_rooms.guest_email,
        status=booking_with_rooms.status,
        check_in=booking_with_rooms.check_in,
        check_out=booking_with_rooms.check_out,
        adults=booking_with_rooms.adults,
        children=booking_with_rooms.children,
        id_card_image_url=getattr(booking_with_rooms, 'id_card_image_url', None),
        guest_photo_url=getattr(booking_with_rooms, 'guest_photo_url', None),
        user=booking_with_rooms.user,
        is_package=False,
        rooms=[br.room for br in booking_with_rooms.booking_rooms if br.room]
    )
    
    # Calculate booking charges and send confirmation email if email address is provided
    if booking.guest_email:
        try:
            from app.utils.email import send_email, create_booking_confirmation_email
            from datetime import datetime, date
            
            # Calculate stay duration
            check_in_date = booking.check_in if isinstance(booking.check_in, date) else datetime.strptime(str(booking.check_in), '%Y-%m-%d').date()
            check_out_date = booking.check_out if isinstance(booking.check_out, date) else datetime.strptime(str(booking.check_out), '%Y-%m-%d').date()
            stay_nights = max(1, (check_out_date - check_in_date).days)
            
            # Calculate room charges
            room_charges = 0
            rooms_data = []
            for br in booking_with_rooms.booking_rooms:
                if br.room:
                    room_price = br.room.price or 0
                    room_charges_per_room = room_price * stay_nights
                    room_charges += room_charges_per_room
                    rooms_data.append({
                        'number': br.room.number,
                        'type': br.room.type or 'Standard',
                        'price': room_price
                    })
            
            # Format booking ID (BK-000001)
            formatted_booking_id = f"BK-{str(booking_with_rooms.id).zfill(6)}"
            
            email_html = create_booking_confirmation_email(
                guest_name=guest_name_to_use,
                booking_id=booking_with_rooms.id,
                booking_type='room',
                check_in=str(booking.check_in),
                check_out=str(booking.check_out),
                rooms=rooms_data,
                total_amount=room_charges,
                guests={'adults': booking.adults, 'children': booking.children},
                guest_mobile=booking.guest_mobile,
                room_charges=room_charges,
                stay_nights=stay_nights
            )
            
            send_email(
                to_email=booking.guest_email,
                subject=f"Booking Confirmation {formatted_booking_id} - Elysian Retreat",
                html_content=email_html,
                to_name=guest_name_to_use
            )
        except Exception as e:
            # Log error but don't fail the booking
            print(f"Failed to send confirmation email: {str(e)}")
    
    return booking_out

@router.post("/guest", response_model=BookingOut, summary="Create a booking as a guest")
def create_guest_booking(booking: BookingCreate, db: Session = Depends(get_db)):
    """
    Public endpoint for guests to create a booking without authentication.
    """
    try:
        # Find or create guest user based on email and mobile
        guest_user_id = None
        # Normalize email and mobile - convert empty strings to None, handle None safely
        try:
            guest_email = booking.guest_email.strip() if (booking.guest_email and isinstance(booking.guest_email, str) and booking.guest_email.strip()) else None
        except (AttributeError, TypeError):
            guest_email = None
        
        try:
            guest_mobile = booking.guest_mobile.strip() if (booking.guest_mobile and isinstance(booking.guest_mobile, str) and booking.guest_mobile.strip()) else None
        except (AttributeError, TypeError):
            guest_mobile = None
        
        if guest_email or guest_mobile:
            try:
                guest_user_id = get_or_create_guest_user(
                    db=db,
                    email=guest_email,
                    mobile=guest_mobile,
                    name=booking.guest_name or "Guest User"
                )
            except Exception as e:
                # Log error but don't fail the booking if user creation fails
                print(f"Warning: Could not create/link guest user: {str(e)}")
        
        # Check for duplicate booking with same details and dates
        # Only check for duplicates if we have at least email or mobile
        duplicate_booking = None
        if guest_email or guest_mobile:
            duplicate_query = db.query(Booking).filter(
                Booking.check_in == booking.check_in,
                Booking.check_out == booking.check_out,
                Booking.status.in_(['booked', 'checked-in'])
            )
            
            # Add email filter if normalized email exists
            if guest_email:
                duplicate_query = duplicate_query.filter(Booking.guest_email == guest_email)
            
            # Add mobile filter if normalized mobile exists
            if guest_mobile:
                duplicate_query = duplicate_query.filter(Booking.guest_mobile == guest_mobile)
            
            duplicate_booking = duplicate_query.first()
        
        if duplicate_booking:
            raise HTTPException(
                status_code=400, 
                detail="A booking with the same details and dates already exists. Please check your existing bookings."
            )

        # Check for an existing booking to reuse guest details for consistency
        # Only check if we have at least email or mobile
        existing_booking = None
        if guest_email or guest_mobile:
            existing_query = db.query(Booking)
            
            # Add email filter if normalized email exists
            if guest_email:
                existing_query = existing_query.filter(Booking.guest_email == guest_email)
            
            # Add mobile filter if normalized mobile exists
            if guest_mobile:
                existing_query = existing_query.filter(Booking.guest_mobile == guest_mobile)
            
            existing_booking = existing_query.order_by(Booking.id.desc()).first()

        guest_name_to_use = booking.guest_name or "Guest User"
        if existing_booking:
            # If a guest with the same email and mobile exists, use their established name
            guest_name_to_use = existing_booking.guest_name

        # Validate room capacity for adults and children separately
        selected_rooms = db.query(Room).filter(Room.id.in_(booking.room_ids)).all()
        if len(selected_rooms) != len(booking.room_ids):
            raise HTTPException(status_code=400, detail="One or more selected rooms are invalid.")
        
        total_adult_capacity = sum(room.adults or 0 for room in selected_rooms)
        total_children_capacity = sum(room.children or 0 for room in selected_rooms)
        
        if booking.adults > total_adult_capacity:
            raise HTTPException(
                status_code=400,
                detail=f"The number of adults ({booking.adults}) exceeds the total adult capacity of the selected rooms ({total_adult_capacity} adults max). Please select additional rooms or reduce the number of adults."
            )
        
        if booking.children > total_children_capacity:
            raise HTTPException(
                status_code=400,
                detail=f"The number of children ({booking.children}) exceeds the total children capacity of the selected rooms ({total_children_capacity} children max). Please select additional rooms or reduce the number of children."
            )

        # Check if rooms are available for the requested dates
        for room_id in booking.room_ids:
            # Check if room is already booked by regular bookings for overlapping dates (only check active bookings, not cancelled or checked-out)
            conflicting_regular_booking = db.query(BookingRoom).join(Booking).filter(
                BookingRoom.room_id == room_id,
                Booking.status.in_(['booked', 'checked-in']),  # Only check for active bookings
                Booking.check_in < booking.check_out,
                Booking.check_out > booking.check_in
            ).first()
            
            # Check if room is already booked by package bookings for overlapping dates
            conflicting_package_booking = db.query(PackageBookingRoom).join(PackageBooking).filter(
                PackageBookingRoom.room_id == room_id,
                PackageBooking.status.in_(['booked', 'checked-in']),  # Only check for active bookings
                PackageBooking.check_in < booking.check_out,
                PackageBooking.check_out > booking.check_in
            ).first()
            
            if conflicting_regular_booking or conflicting_package_booking:
                room = db.query(Room).filter(Room.id == room_id).first()
                raise HTTPException(
                    status_code=400,
                    detail=f"Room {room.number if room else room_id} is not available for the selected dates."
                )

        db_booking = Booking(
            guest_name=guest_name_to_use,
            guest_mobile=guest_mobile or booking.guest_mobile or None,  # Use normalized mobile or original, fallback to None
            guest_email=guest_email or booking.guest_email or None,  # Use normalized email or original, fallback to None
            check_in=booking.check_in,
            check_out=booking.check_out,
            adults=booking.adults,
            children=booking.children,
            user_id=guest_user_id,  # Link booking to guest user
        )
        db.add(db_booking)
        db.commit()
        db.refresh(db_booking)

        # Create BookingRoom links and update room status
        for room_id in booking.room_ids:
            db.query(Room).filter(Room.id == room_id).update({"status": "Booked"})
            db.add(BookingRoom(booking_id=db_booking.id, room_id=room_id))
        db.commit()
        db.refresh(db_booking)
        
        # Reload with room details for email and response
        booking_with_rooms = (
            db.query(Booking)
            .options(joinedload(Booking.booking_rooms).joinedload(BookingRoom.room))
            .filter(Booking.id == db_booking.id)
            .first()
        )
        
        # Calculate booking charges and send confirmation email if email address is provided
        if guest_email or booking.guest_email:
            try:
                from app.utils.email import send_email, create_booking_confirmation_email
                from datetime import datetime, date
                
                # Calculate stay duration
                check_in_date = booking.check_in if isinstance(booking.check_in, date) else datetime.strptime(str(booking.check_in), '%Y-%m-%d').date()
                check_out_date = booking.check_out if isinstance(booking.check_out, date) else datetime.strptime(str(booking.check_out), '%Y-%m-%d').date()
                stay_nights = max(1, (check_out_date - check_in_date).days)
                
                # Calculate room charges
                room_charges = 0
                rooms_data = []
                for br in booking_with_rooms.booking_rooms:
                    if br.room:
                        room_price = br.room.price or 0
                        room_charges_per_room = room_price * stay_nights
                        room_charges += room_charges_per_room
                        rooms_data.append({
                            'number': br.room.number,
                            'type': br.room.type or 'Standard',
                            'price': room_price
                        })
                
                # Format booking ID (BK-000001)
                formatted_booking_id = f"BK-{str(db_booking.id).zfill(6)}"
                
                email_to_use = guest_email or booking.guest_email
                if email_to_use:
                    email_html = create_booking_confirmation_email(
                        guest_name=guest_name_to_use,
                        booking_id=db_booking.id,
                        booking_type='room',
                        check_in=str(booking.check_in),
                        check_out=str(booking.check_out),
                        rooms=rooms_data,
                        total_amount=room_charges,
                        guests={'adults': booking.adults, 'children': booking.children},
                        guest_mobile=guest_mobile or booking.guest_mobile,
                        room_charges=room_charges,
                        stay_nights=stay_nights
                    )
                    
                    send_email(
                        to_email=email_to_use,
                        subject=f"Booking Confirmation {formatted_booking_id} - Elysian Retreat",
                        html_content=email_html,
                        to_name=guest_name_to_use
                    )
            except Exception as e:
                # Log error but don't fail the booking
                print(f"Failed to send confirmation email: {str(e)}")
        
        return booking_with_rooms
        
    except HTTPException:
        # Re-raise HTTP exceptions (like validation errors) as-is
        raise
    except Exception as e:
        # Log the full error for debugging
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in create_guest_booking: {str(e)}")
        print(f"Traceback: {error_trace}")
        
        # Return a user-friendly error message
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create booking: {str(e)}"
        )

# -------------------------------
# Check-in a booking
# -------------------------------
@router.put("/{booking_id}/check-in", response_model=BookingOut)
def check_in_booking(
    booking_id: Union[str, int],
    id_card_image: UploadFile = File(...),
    guest_photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Parse display ID (BK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    if booking_type and booking_type != "booking":
        raise HTTPException(status_code=400, detail=f"Invalid booking type. Expected regular booking, got: {booking_id}")
    booking_id = numeric_id
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "booked":
        raise HTTPException(status_code=400, detail=f"Booking is not in 'booked' state. Current status: {booking.status}")

    # Save ID card image
    id_card_filename = f"id_{booking_id}_{uuid.uuid4().hex}.jpg"
    id_card_path = os.path.join(UPLOAD_DIR, id_card_filename)
    with open(id_card_path, "wb") as buffer:
        shutil.copyfileobj(id_card_image.file, buffer)
    booking.id_card_image_url = id_card_filename

    # Save guest photo
    guest_photo_filename = f"guest_{booking_id}_{uuid.uuid4().hex}.jpg"
    guest_photo_path = os.path.join(UPLOAD_DIR, guest_photo_filename)
    with open(guest_photo_path, "wb") as buffer:
        shutil.copyfileobj(guest_photo.file, buffer)
    booking.guest_photo_url = guest_photo_filename

    booking.status = "checked-in"

    # Save the ID of the user who performed the check-in
    booking.user_id = current_user.id

    # CRITICAL FIX: Update the status of the associated rooms to 'Checked-in'
    if booking.booking_rooms:
        room_ids = [br.room_id for br in booking.booking_rooms]
        db.query(Room).filter(Room.id.in_(room_ids)).update({"status": "Checked-in"}, synchronize_session=False)

    db.commit()
    db.refresh(booking)
    return booking

# -------------------------------
# Cancel a booking
# -------------------------------
@router.put("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(booking_id: Union[str, int], db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Parse display ID (BK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    if booking_type and booking_type != "booking":
        raise HTTPException(status_code=400, detail=f"Invalid booking type. Expected regular booking, got: {booking_id}")
    booking_id = numeric_id
    
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Free up the rooms associated with the booking
    if booking.booking_rooms:
        room_ids = [br.room_id for br in booking.booking_rooms]
        db.query(Room).filter(Room.id.in_(room_ids)).update({"status": "Available"}, synchronize_session=False)

    booking.status = "cancelled"
    db.commit()
    db.refresh(booking)
    return booking
    
@router.put("/{booking_id}/extend", response_model=BookingOut)
def extend_checkout(booking_id: Union[str, int], new_checkout: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Extend the checkout date for a booking.
    Validates that the new checkout date is after the current checkout date
    and checks for conflicts with other bookings on the same rooms.
    Accepts both display ID (BK-000001) and numeric ID.
    """
    from datetime import datetime
    
    # Parse display ID (BK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    if booking_type and booking_type != "booking":
        raise HTTPException(status_code=400, detail=f"Invalid booking type. Expected regular booking, got: {booking_id}")
    booking_id = numeric_id
    
    # Parse the new checkout date string to a date object
    try:
        new_checkout_date = datetime.strptime(new_checkout, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD format")
    
    # Fetch the booking with its rooms
    booking = db.query(Booking).options(
        joinedload(Booking.booking_rooms).joinedload(BookingRoom.room)
    ).filter(Booking.id == booking_id).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if booking is in a valid state for extension
    # Normalize status: convert to lowercase and replace underscores/hyphens with hyphens for consistent comparison
    raw_status_lower = booking.status.lower().strip() if booking.status else ''
    normalized_status = raw_status_lower.replace('_', '-').replace(' ', '-')
    
    # Explicitly reject checked-out/checked_out statuses (guest has already left)
    # Be careful: "checked-in" normalizes to "checked-in", "checked-out" normalizes to "checked-out"
    # We need to check for "out" specifically, not just the normalized form
    is_checked_out = (
        'out' in normalized_status and normalized_status.startswith('checked-') and normalized_status.endswith('-out')
    ) or raw_status_lower in ['checked_out', 'checked-out', 'checked out']
    
    if is_checked_out:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot extend checkout for booking with status '{booking.status}'. The guest has already checked out."
        )
    
    # Allow extension for 'booked' or 'checked-in' statuses (handle variations like 'checked_in', 'checked-in', 'Checked In', etc.)
    if normalized_status not in ['booked', 'checked-in']:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot extend checkout for booking with status '{booking.status}'. Only 'booked' or 'checked-in' bookings can be extended."
        )
    
    # Validate that new checkout date is after current checkout date
    if new_checkout_date <= booking.check_out:
        raise HTTPException(
            status_code=400, 
            detail=f"New checkout date ({new_checkout_date}) must be after current checkout date ({booking.check_out})"
        )
    
    # Check for conflicts with other bookings on the same rooms
    room_ids = [br.room_id for br in booking.booking_rooms if br.room_id]
    
    if room_ids:
        # Check for conflicts with regular bookings
        # A conflict exists if another booking overlaps with the extended period
        # Extended period: from booking.check_out (exclusive) to new_checkout_date (inclusive)
        conflicting_bookings = db.query(Booking).join(BookingRoom).filter(
            Booking.id != booking_id,
            BookingRoom.room_id.in_(room_ids),
            Booking.status.in_(['booked', 'checked-in', 'checked_in']),
            and_(
                Booking.check_in < new_checkout_date,
                Booking.check_out > booking.check_out
            )
        ).first()
        
        if conflicting_bookings:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot extend checkout date. Room(s) are already booked by another booking (ID: {conflicting_bookings.id}) during the extended period."
            )
        
        # Check for conflicts with package bookings
        # A conflict exists if a package booking overlaps with the extended period
        conflicting_package_bookings = db.query(PackageBooking).join(PackageBookingRoom).filter(
            PackageBookingRoom.room_id.in_(room_ids),
            PackageBooking.status.in_(['booked', 'checked-in', 'checked_in']),
            and_(
                PackageBooking.check_in < new_checkout_date,
                PackageBooking.check_out > booking.check_out
            )
        ).first()
        
        if conflicting_package_bookings:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot extend checkout date. Room(s) are already booked by a package booking (ID: {conflicting_package_bookings.id}) during the extended period."
            )
    
    # Update the checkout date
    booking.check_out = new_checkout_date
    db.commit()
    db.refresh(booking)
    
    # Reload booking with relationships for response
    booking_with_rooms = db.query(Booking).options(
        joinedload(Booking.booking_rooms).joinedload(BookingRoom.room)
    ).filter(Booking.id == booking_id).first()

    return BookingOut(
        id=booking_with_rooms.id,
        status=booking_with_rooms.status,
        guest_name=booking_with_rooms.guest_name,
        guest_mobile=booking_with_rooms.guest_mobile,
        guest_email=booking_with_rooms.guest_email,
        check_in=booking_with_rooms.check_in,
        check_out=booking_with_rooms.check_out,
        adults=booking_with_rooms.adults,
        children=booking_with_rooms.children,
        id_card_image_url=booking_with_rooms.id_card_image_url,
        guest_photo_url=booking_with_rooms.guest_photo_url,
        user_id=booking_with_rooms.user_id,
        total_amount=booking_with_rooms.total_amount,
        rooms=[br.room for br in booking_with_rooms.booking_rooms if br.room]
    )
# -------------------------------
# GET booking by ID
# -------------------------------
@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: Union[str, int], db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Parse display ID (BK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    if booking_type and booking_type != "booking":
        raise HTTPException(status_code=400, detail=f"Invalid booking type. Expected regular booking, got: {booking_id}")
    booking_id = numeric_id
    
    booking = db.query(Booking).options(
        joinedload(Booking.booking_rooms).joinedload(BookingRoom.room)
    ).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

# -------------------------------
# GET check-in images
# -------------------------------
@router.get("/checkin-image/{filename}")
def get_checkin_image(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath) or not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)