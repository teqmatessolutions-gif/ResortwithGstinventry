from sqlalchemy.orm import Session
from app.models.foodorder import FoodOrder, FoodOrderItem
from app.models.booking import Booking, BookingRoom
from app.models.Package import PackageBooking, PackageBookingRoom
from app.models.service_request import ServiceRequest
from app.schemas.foodorder import FoodOrderCreate, FoodOrderUpdate
from datetime import datetime

def get_guest_for_room(room_id, db: Session):
    """Get guest name for a room from either regular or package bookings"""
    if not room_id:
        return None
    
    # Check regular bookings first
    active_booking = (
        db.query(Booking)
        .join(BookingRoom)
        .filter(BookingRoom.room_id == room_id)
        .filter(Booking.status.in_(["checked-in", "booked"]))
        .order_by(Booking.id.desc())
        .first()
    )
    
    if active_booking:
        return active_booking.guest_name
    
    # Check package bookings
    active_package_booking = (
        db.query(PackageBooking)
        .join(PackageBookingRoom)
        .filter(PackageBookingRoom.room_id == room_id)
        .filter(PackageBooking.status.in_(["checked-in", "booked"]))
        .order_by(PackageBooking.id.desc())
        .first()
    )
    
    if active_package_booking:
        return active_package_booking.guest_name
    
    return None

def create_food_order(db: Session, order_data: FoodOrderCreate):
    order = FoodOrder(
        room_id=order_data.room_id,
        amount=order_data.amount,
        assigned_employee_id=order_data.assigned_employee_id,
        status="active",
        billing_status="unbilled",
        order_type=getattr(order_data, 'order_type', 'dine_in'),
        delivery_request=getattr(order_data, 'delivery_request', None)
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    for item_data in order_data.items:
        item = FoodOrderItem(
            order_id=order.id,
            food_item_id=item_data.food_item_id,
            quantity=item_data.quantity,
        )
        db.add(item)
    db.commit()
    db.refresh(order)
    
    # Create service request immediately for room service orders
    if order.order_type == "room_service":
        # Check if service request already exists
        existing_request = db.query(ServiceRequest).filter(
            ServiceRequest.food_order_id == order.id
        ).first()
        if not existing_request:
            service_request = ServiceRequest(
                food_order_id=order.id,
                room_id=order.room_id,
                employee_id=order.assigned_employee_id,
                request_type="delivery",
                description=order.delivery_request or f"Room service delivery for food order #{order.id}",
                status="pending"
            )
            db.add(service_request)
            db.commit()
    
    return order

def get_food_orders(db: Session, skip: int = 0, limit: int = 100):
    from sqlalchemy.orm import joinedload
    
    # Cap limit to prevent performance issues
    if limit > 200:
        limit = 200
    if limit < 1:
        limit = 20
    
    # Eager load relationships so guest/employee names are available
    try:
        orders = (
            db.query(FoodOrder)
            .options(
                joinedload(FoodOrder.employee),  # Load employee for employee name
                joinedload(FoodOrder.room),      # Load room for room number
                joinedload(FoodOrder.items).joinedload(FoodOrderItem.food_item)  # Load items and food details
            )
            .order_by(FoodOrder.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        
        # Populate computed fields
        for order in orders:
            # Set employee name
            if order.employee:
                order.employee_name = order.employee.name
            else:
                order.employee_name = None
            
            # Set room number
            if order.room:
                order.room_number = order.room.number
            else:
                order.room_number = None
            
            # Set guest name from room's active booking
            order.guest_name = get_guest_for_room(order.room_id, db)
        
        return orders
    except Exception as e:
        print(f"[ERROR] Error in get_food_orders: {str(e)}")
        import traceback
        traceback.print_exc()
        return []

def delete_food_order(db: Session, order_id: int):
    order = db.query(FoodOrder).filter(FoodOrder.id == order_id).first()
    if order:
        db.delete(order)
        db.commit()
    return order

def update_food_order_status(db: Session, order_id: int, status: str):
    order = db.query(FoodOrder).filter(FoodOrder.id == order_id).first()
    if order:
        order.status = status
        db.commit()
        db.refresh(order)
    return order

def update_food_order(db: Session, order_id: int, update_data: FoodOrderUpdate):
    order = db.query(FoodOrder).filter(FoodOrder.id == order_id).first()
    if not order:
        return None

    if update_data.room_id is not None:
        order.room_id = update_data.room_id
    if update_data.amount is not None:
        order.amount = update_data.amount
    if update_data.assigned_employee_id is not None:
        order.assigned_employee_id = update_data.assigned_employee_id
    if update_data.status is not None:
        order.status = update_data.status
        # If completing a room service order, create a service request
        if update_data.status == "completed" and order.order_type == "room_service":
            # Check if service request already exists
            existing_request = db.query(ServiceRequest).filter(
                ServiceRequest.food_order_id == order.id
            ).first()
            if not existing_request:
                service_request = ServiceRequest(
                    food_order_id=order.id,
                    room_id=order.room_id,
                    employee_id=order.assigned_employee_id,
                    request_type="delivery",
                    description=order.delivery_request or f"Room service delivery for food order #{order.id}",
                    status="pending"
                )
                db.add(service_request)
    if update_data.billing_status is not None:
        order.billing_status = update_data.billing_status
    if update_data.order_type is not None:
        order.order_type = update_data.order_type
    if update_data.delivery_request is not None:
        order.delivery_request = update_data.delivery_request

    if update_data.items is not None:
        db.query(FoodOrderItem).filter(FoodOrderItem.order_id == order.id).delete()
        for item_data in update_data.items:
            item = FoodOrderItem(
                order_id=order.id,
                food_item_id=item_data.food_item_id,
                quantity=item_data.quantity,
            )
            db.add(item)

    db.commit()
    db.refresh(order)
    return order
