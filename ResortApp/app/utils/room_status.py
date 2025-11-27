from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, DisconnectionError
from app.models.room import Room
from app.models.booking import Booking, BookingRoom
from datetime import date
import time

def update_room_statuses(db: Session):
    """
    Update room statuses based on current bookings.
    Only shows current day status - not future bookings.
    With improved error handling and retry logic.
    """
    max_retries = 3
    retry_delay = 1
    
    for attempt in range(max_retries):
        try:
            today = date.today()
            
            # Use with_for_update(nowait=True) to prevent deadlocks, but fallback if it fails
            try:
                rooms = db.query(Room).with_for_update(skip_locked=True).all()
            except Exception:
                # Fallback to regular query if row-level locking fails
                rooms = db.query(Room).all()
            
            updated_count = 0
            for room in rooms:
                try:
                    # Check if room has active bookings (currently occupied or checked-in)
                    # Normalize status values to handle both formats
                    active_booking = db.query(BookingRoom).join(Booking).filter(
                        BookingRoom.room_id == room.id,
                        Booking.status.in_(['booked', 'checked-in', 'checked_in']),
                        Booking.check_in <= today,
                        Booking.check_out > today
                    ).first()
                    
                    # Check for active package bookings too
                    from app.models.Package import PackageBooking, PackageBookingRoom
                    active_package_booking = db.query(PackageBookingRoom).join(PackageBooking).filter(
                        PackageBookingRoom.room_id == room.id,
                        PackageBooking.status.in_(['booked', 'checked-in', 'checked_in']),
                        PackageBooking.check_in <= today,
                        PackageBooking.check_out > today
                    ).first()
                    
                    new_status = None
                    if active_booking or active_package_booking:
                        # Check if the booking is actually checked-in (not just booked)
                        is_checked_in = False
                        if active_booking:
                            normalized_status = active_booking.booking.status.lower().replace('-', '').replace('_', '').replace(' ', '')
                            is_checked_in = normalized_status == 'checkedin'
                        if not is_checked_in and active_package_booking:
                            normalized_status = active_package_booking.package_booking.status.lower().replace('-', '').replace('_', '').replace(' ', '')
                            is_checked_in = normalized_status == 'checkedin'
                        
                        # Set status based on whether booking is checked-in or just booked
                        if is_checked_in:
                            new_status = "Checked-in"
                        else:
                            new_status = "Occupied"
                    else:
                        # Check if booking has ended today or before
                        past_booking = db.query(BookingRoom).join(Booking).filter(
                            BookingRoom.room_id == room.id,
                            Booking.status.in_(['booked', 'checked-in', 'checked_in']),
                            Booking.check_out <= today
                        ).first()
                        
                        # No active booking, make available
                        new_status = "Available"
                    
                    # Only update if status changed to reduce unnecessary commits
                    if room.status != new_status:
                        room.status = new_status
                        updated_count += 1
                        
                except Exception as room_error:
                    # Log individual room errors but continue processing
                    print(f"Error updating room {room.id}: {room_error}")
                    continue
            
            try:
                db.commit()
            except Exception as commit_err:
                # Roll back any failed commit to avoid pending transaction errors
                db.rollback()
                print(f"Commit failed during room status update: {commit_err}")
                return 0
            if updated_count > 0:
                print(f"Updated room statuses for {updated_count} out of {len(rooms)} rooms")
            return updated_count
            
        except (OperationalError, DisconnectionError) as e:
            db.rollback()
            if attempt < max_retries - 1:
                print(f"Database error (attempt {attempt + 1}/{max_retries}): {e}. Retrying...")
                time.sleep(retry_delay * (attempt + 1))
                # Try to refresh the session
                db.expire_all()
                continue
            else:
                print(f"Error updating room statuses after {max_retries} attempts: {e}")
                # Don't raise - let the endpoint handle gracefully
                return 0
        except Exception as e:
            db.rollback()
            print(f"Error updating room statuses: {e}")
            print(f"Error type: {type(e)}")
            # Don't raise - allow room fetching to continue even if status update fails
            return 0
    
    return 0
