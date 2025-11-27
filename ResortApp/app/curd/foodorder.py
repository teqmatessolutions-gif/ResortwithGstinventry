from sqlalchemy.orm import Session
from app.models.foodorder import FoodOrder, FoodOrderItem
from app.models.booking import Booking, BookingRoom
from app.models.Package import PackageBooking, PackageBookingRoom
from app.schemas.foodorder import FoodOrderCreate, FoodOrderUpdate

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
        billing_status="unbilled"
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
    return order

def get_food_orders(db: Session, skip: int = 0, limit: int = 100):
    orders = db.query(FoodOrder).offset(skip).limit(limit).all()
    for order in orders:
        for item in order.items:
            item.food_item_name = item.food_item.name if item.food_item else "Unknown"
        # Add guest_name by looking up active bookings for the room
        if hasattr(order, 'room_id') and order.room_id:
            guest_name = get_guest_for_room(order.room_id, db)
            if guest_name:
                order.guest_name = guest_name
    return orders

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
    if update_data.billing_status is not None:  # ✅ Now handled
        order.billing_status = update_data.billing_status

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
