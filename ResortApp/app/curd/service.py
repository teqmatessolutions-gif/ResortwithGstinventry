from sqlalchemy.orm import Session, joinedload, noload
from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError, SQLAlchemyError, IntegrityError
from typing import List, Optional
from datetime import date, datetime
from app.models.service import Service, AssignedService, ServiceImage, service_inventory_item
from app.models.inventory import InventoryItem, InventoryTransaction, Location
from app.models.booking import Booking, BookingRoom
from app.models.Package import PackageBooking, PackageBookingRoom
from app.models.employee import Employee
from app.models.room import Room
from app.schemas.service import ServiceCreate, AssignedServiceCreate, AssignedServiceUpdate, ServiceInventoryItemBase

def create_service(
    db: Session,
    name: str,
    description: str,
    charges: float,
    image_urls: List[str] = None,
    inventory_items: Optional[List[ServiceInventoryItemBase]] = None,
    is_visible_to_guest: bool = False,
    average_completion_time: Optional[str] = None
):
    """
    Create a new service with optional images and inventory items.
    Gracefully handles missing permissions on the service_inventory_items table
    by creating the service and skipping the association instead of failing.
    """
    import traceback

    try:
        # 1. Create the service record
        db_service = Service(
            name=name,
            description=description,
            charges=charges,
            is_visible_to_guest=is_visible_to_guest,
            average_completion_time=average_completion_time
        )
        db.add(db_service)
        db.commit()
        db.refresh(db_service)
    except Exception as create_error:
        db.rollback()
        error_msg = f"Failed to create service: {str(create_error)}"
        print(f"[ERROR create_service CRUD] {error_msg}")
        print(traceback.format_exc())
        raise ValueError(error_msg) from create_error

    # 2. Attach images (if any)
    if image_urls:
        try:
            for url in image_urls:
                if url:
                    db.add(ServiceImage(service_id=db_service.id, image_url=url))
            db.commit()
            db.refresh(db_service)
        except Exception as img_error:
            db.rollback()
            error_msg = f"Failed to add service images: {str(img_error)}"
            print(f"[ERROR create_service CRUD] {error_msg}")
            print(traceback.format_exc())
            raise ValueError(error_msg) from img_error

    # 3. Link inventory items (best-effort; skip if insufficient privileges)
    if inventory_items:
        inventory_insert_failed = False
        permission_error = False
        inserted_count = 0
        try:
            print(f"[DEBUG create_service] Attempting to link {len(inventory_items)} inventory items to service {db_service.id}")
            for item_data in inventory_items:
                print(f"[DEBUG create_service] Processing inventory item: id={item_data.inventory_item_id}, quantity={item_data.quantity}")
                inventory_item = (
                    db.query(InventoryItem)
                    .filter(InventoryItem.id == item_data.inventory_item_id)
                    .first()
                )
                if not inventory_item:
                    print(
                        f"[WARNING] Inventory item {item_data.inventory_item_id} not found, skipping"
                    )
                    continue

                stmt = service_inventory_item.insert().values(
                    service_id=db_service.id,
                    inventory_item_id=item_data.inventory_item_id,
                    quantity=item_data.quantity,
                    created_at=datetime.utcnow()  # Explicitly set created_at
                )
                result = db.execute(stmt)
                inserted_count += 1
                print(f"[DEBUG create_service] Successfully inserted inventory link: service_id={db_service.id}, item_id={item_data.inventory_item_id}, quantity={item_data.quantity}")

            db.commit()
            print(f"[DEBUG create_service] Successfully committed {inserted_count} inventory item links for service {db_service.id}")
            
            # Verify the data was actually saved
            try:
                verify_stmt = select(
                    service_inventory_item.c.inventory_item_id,
                    service_inventory_item.c.quantity
                ).where(service_inventory_item.c.service_id == db_service.id)
                verify_rows = db.execute(verify_stmt).fetchall()
                print(f"[DEBUG create_service] Verification: Found {len(verify_rows)} inventory item links in database for service {db_service.id}")
                for row in verify_rows:
                    item_id = row[0] if isinstance(row, tuple) else getattr(row, 'inventory_item_id', row[0])
                    qty = row[1] if isinstance(row, tuple) else getattr(row, 'quantity', row[1])
                    print(f"[DEBUG create_service]   - Item ID: {item_id}, Quantity: {qty}")
            except Exception as verify_error:
                print(f"[WARNING] Could not verify saved inventory items: {verify_error}")
        except ProgrammingError as perm_error:
            permission_error = True
            inventory_insert_failed = True
            db.rollback()
            print(
                f"[ERROR] Insufficient privilege linking inventory items for service {db_service.id}: {perm_error}"
            )
            print(traceback.format_exc())
        except SQLAlchemyError as link_error:
            inventory_insert_failed = True
            db.rollback()
            print(
                f"[ERROR] Failed to link inventory items for service {db_service.id}: {link_error}"
            )
            print(traceback.format_exc())

        if inventory_insert_failed:
            msg = (
                "Some inventory items could not be linked because the database user "
                "lacks permission to access service_inventory_items."
                if permission_error
                else "Some inventory items failed to link due to a database error."
            )
            print(f"[WARNING] {msg} Service ID: {db_service.id}")
        else:
            print(f"[SUCCESS] All {inserted_count} inventory items successfully linked to service {db_service.id}")

    # 4. Return the service with related images
    try:
        service = (
            db.query(Service)
            .options(joinedload(Service.images))
            .filter(Service.id == db_service.id)
            .first()
        )
        return service or db_service
    except Exception as load_error:
        print(
            f"[WARNING] Failed to load service relationships for service {db_service.id}: {load_error}"
        )
        print(traceback.format_exc())
        return db_service

def update_service(
    db: Session,
    service_id: int,
    name: str,
    description: str,
    charges: float,
    new_image_urls: Optional[List[str]] = None,
    images_to_remove: Optional[List[int]] = None,
    inventory_items: Optional[List[ServiceInventoryItemBase]] = None,
    is_visible_to_guest: bool = False,
):
    """
    Update an existing service. Supports adding new images, removing selected images,
    and updating inventory assignments (best-effort if DB permissions allow).
    Returns tuple of (service, removed_image_paths).
    """
    import traceback

    service = db.query(Service).options(joinedload(Service.images)).filter(Service.id == service_id).first()
    if not service:
        raise ValueError(f"Service with ID {service_id} not found")

    removed_image_paths: List[str] = []

    try:
        service.name = name
        service.description = description
        service.charges = charges
        service.is_visible_to_guest = is_visible_to_guest
        if average_completion_time is not None:
            service.average_completion_time = average_completion_time

        # Remove selected images
        if images_to_remove:
            images = (
                db.query(ServiceImage)
                .filter(ServiceImage.service_id == service_id, ServiceImage.id.in_(images_to_remove))
                .all()
            )
            for img in images:
                removed_image_paths.append(img.image_url)
                db.delete(img)

        # Add new images
        if new_image_urls:
            for url in new_image_urls:
                if url:
                    db.add(ServiceImage(service_id=service_id, image_url=url))

        db.commit()
        db.refresh(service)
    except Exception as update_error:
        db.rollback()
        error_msg = f"Failed to update service {service_id}: {str(update_error)}"
        print(f"[ERROR update_service CRUD] {error_msg}")
        print(traceback.format_exc())
        raise ValueError(error_msg) from update_error

    # Handle inventory updates (best-effort)
    if inventory_items is not None:
        permission_error = False
        try:
            print(f"[DEBUG update_service] Updating inventory items for service {service_id}")
            # First, check what's currently in the database
            try:
                before_stmt = select(
                    service_inventory_item.c.inventory_item_id,
                    service_inventory_item.c.quantity
                ).where(service_inventory_item.c.service_id == service_id)
                before_rows = db.execute(before_stmt).fetchall()
                print(f"[DEBUG update_service] Current inventory items in DB: {len(before_rows)}")
            except Exception as check_error:
                print(f"[WARNING] Could not check existing inventory items: {check_error}")
            
            delete_stmt = service_inventory_item.delete().where(service_inventory_item.c.service_id == service_id)
            delete_result = db.execute(delete_stmt)
            deleted_count = delete_result.rowcount if hasattr(delete_result, 'rowcount') else 0
            db.commit()
            print(f"[DEBUG update_service] Deleted {deleted_count} existing inventory item links")

            if inventory_items:
                inserted_count = 0
                for item_data in inventory_items:
                    print(f"[DEBUG update_service] Processing inventory item: id={item_data.inventory_item_id}, quantity={item_data.quantity}")
                    inventory_item = (
                        db.query(InventoryItem)
                        .filter(InventoryItem.id == item_data.inventory_item_id)
                        .first()
                    )
                    if not inventory_item:
                        print(f"[WARNING] Inventory item {item_data.inventory_item_id} not found, skipping")
                        continue

                    insert_stmt = service_inventory_item.insert().values(
                        service_id=service_id,
                        inventory_item_id=item_data.inventory_item_id,
                        quantity=item_data.quantity,
                        created_at=datetime.utcnow()  # Explicitly set created_at
                    )
                    db.execute(insert_stmt)
                    inserted_count += 1
                    print(f"[DEBUG update_service] Successfully inserted inventory link: service_id={service_id}, item_id={item_data.inventory_item_id}, quantity={item_data.quantity}")
                db.commit()
                print(f"[DEBUG update_service] Successfully committed {inserted_count} inventory item links for service {service_id}")
                
                # Verify the data was actually saved
                try:
                    verify_stmt = select(
                        service_inventory_item.c.inventory_item_id,
                        service_inventory_item.c.quantity
                    ).where(service_inventory_item.c.service_id == service_id)
                    verify_rows = db.execute(verify_stmt).fetchall()
                    print(f"[DEBUG update_service] Verification: Found {len(verify_rows)} inventory item links in database for service {service_id}")
                    for row in verify_rows:
                        item_id = row[0] if isinstance(row, tuple) else getattr(row, 'inventory_item_id', row[0])
                        qty = row[1] if isinstance(row, tuple) else getattr(row, 'quantity', row[1])
                        print(f"[DEBUG update_service]   - Item ID: {item_id}, Quantity: {qty}")
                except Exception as verify_error:
                    print(f"[WARNING] Could not verify saved inventory items: {verify_error}")
            else:
                print(f"[DEBUG update_service] No inventory items to insert (empty list)")
        except ProgrammingError as perm_error:
            permission_error = True
            db.rollback()
            print(
                f"[WARNING] Insufficient privilege updating inventory items for service {service_id}: {perm_error}"
            )
            print(traceback.format_exc())
        except SQLAlchemyError as link_error:
            db.rollback()
            print(f"[WARNING] Failed to update inventory items for service {service_id}: {link_error}")
            print(traceback.format_exc())

        if permission_error:
            print(
                f"[WARNING] Inventory items might be outdated for service {service_id} due to missing DB permissions"
            )

        try:
            db.refresh(service)
        except Exception:
            pass

    return service, removed_image_paths

def get_services(db: Session, skip: int = 0, limit: int = 100):
    """
    Fetch services without eagerly loading inventory_items so that the query
    does not require direct access to the service_inventory_items table.
    The API layer will perform best-effort inventory enrichment.
    """
    return db.query(Service).options(
        joinedload(Service.images)
    ).offset(skip).limit(limit).all()

def delete_service(db: Session, service_id: int):
    import traceback

    service = (
        db.query(Service)
        .options(
            joinedload(Service.images),
            noload(Service.inventory_items)
        )
        .filter(Service.id == service_id)
        .first()
    )
    if not service:
        raise ValueError(f"Service with ID {service_id} not found")

    image_paths = [img.image_url for img in (service.images or [])]

    try:
        db.delete(service)
        db.commit()
        return image_paths
    except IntegrityError as fk_error:
        db.rollback()
        message = (
            "Cannot delete service because it is still referenced by assigned services "
            "or other records. Please unassign or remove related records first."
        )
        print(f"[WARNING delete_service CRUD] {message} Service ID: {service_id}")
        print(fk_error)
        raise ValueError(message) from fk_error
    except ProgrammingError as perm_error:
        db.rollback()
        message = (
            "Cannot delete service because the database user lacks permission "
            "to modify the service inventory mapping table. Please contact your administrator."
        )
        print(f"[WARNING delete_service CRUD] Permission issue deleting service {service_id}: {perm_error}")
        raise ValueError(message) from perm_error
    except Exception as delete_error:
        db.rollback()
        print(f"[ERROR delete_service CRUD] Failed to delete service {service_id}: {delete_error}")
        print(traceback.format_exc())
        raise RuntimeError(f"Failed to delete service: {delete_error}") from delete_error

def create_assigned_service(db: Session, assigned: AssignedServiceCreate):
    try:
        # Convert Pydantic model to dict (handle both .dict() and .model_dump())
        if hasattr(assigned, 'model_dump'):
            assigned_dict = assigned.model_dump()
        else:
            assigned_dict = assigned.dict()
        
        print(f"[DEBUG] Creating assigned service with data: {assigned_dict}")
        
        # Verify that required IDs exist
        service = db.query(Service).filter(Service.id == assigned_dict['service_id']).first()
        if not service:
            raise ValueError(f"Service with ID {assigned_dict['service_id']} not found")
        
        employee = db.query(Employee).filter(Employee.id == assigned_dict['employee_id']).first()
        if not employee:
            raise ValueError(f"Employee with ID {assigned_dict['employee_id']} not found")
        
        room = db.query(Room).filter(Room.id == assigned_dict['room_id']).first()
        if not room:
            raise ValueError(f"Room with ID {assigned_dict['room_id']} not found")
        
        print(f"[DEBUG] All references valid: Service={service.name}, Employee={employee.name}, Room={room.number}")
        
        # Load service inventory items if service has any
        service_inventory_items = []
        # Query association table for quantities (best-effort)
        associations = []
        try:
            stmt = select(service_inventory_item).where(service_inventory_item.c.service_id == service.id)
            associations = db.execute(stmt).fetchall()
            print(f"[DEBUG] Found {len(associations)} inventory item associations for service {service.id}")
        except Exception as assoc_err:
            db.rollback()
            print(f"[WARNING] Unable to read service inventory items for service {service.id}: {str(assoc_err)}")
            import traceback
            print(traceback.format_exc())
            associations = []
        
        for assoc in associations:
            # Get inventory item directly from database
            inv_item = db.query(InventoryItem).filter(InventoryItem.id == assoc.inventory_item_id).first()
            if inv_item:
                service_inventory_items.append({
                    'item_id': inv_item.id,
                    'item_name': inv_item.name,
                    'quantity': assoc.quantity,
                    'unit': inv_item.unit
                })
                print(f"[DEBUG] Added inventory item: {inv_item.name} (ID: {inv_item.id}), Quantity: {assoc.quantity}")
            else:
                print(f"[WARNING] Inventory item ID {assoc.inventory_item_id} not found in database")
        
        print(f"[DEBUG] Service has {len(service_inventory_items)} inventory items")
        
        # Create AssignedService instance (status will use default from model)
        try:
            db_assigned = AssignedService(
                service_id=assigned_dict['service_id'],
                employee_id=assigned_dict['employee_id'],
                room_id=assigned_dict['room_id']
                # status and billing_status will use defaults from model
            )
            print(f"[DEBUG] AssignedService object created, status={db_assigned.status}, billing_status={db_assigned.billing_status}")
            db.add(db_assigned)
            db.flush()  # Flush to get the ID without committing
            print(f"[DEBUG] AssignedService flushed, ID={db_assigned.id}")
            
            # Deduct inventory items if service requires them
            if service_inventory_items:
                # Find main warehouse/office location
                main_location = db.query(Location).filter(
                    (Location.location_type == "WAREHOUSE") | 
                    (Location.location_type == "CENTRAL_WAREHOUSE") |
                    (Location.is_inventory_point == True)
                ).first()
                
                if not main_location:
                    # Fallback to any warehouse
                    main_location = db.query(Location).filter(
                        Location.location_type.in_(["WAREHOUSE", "CENTRAL_WAREHOUSE", "BRANCH_STORE"])
                    ).first()
                
                if main_location:
                    print(f"[DEBUG] Main location found: {main_location.name} (ID: {main_location.id})")
                    
                    # Try to import EmployeeInventoryAssignment
                    try:
                        from app.models.employee_inventory import EmployeeInventoryAssignment
                        has_emp_inv_model = True
                    except ImportError:
                        print("[WARNING] EmployeeInventoryAssignment model not found, skipping inventory assignment tracking")
                        EmployeeInventoryAssignment = None
                        has_emp_inv_model = False
                    
                    for inv_data in service_inventory_items:
                        item = db.query(InventoryItem).filter(InventoryItem.id == inv_data['item_id']).first()
                        if not item:
                            print(f"[WARNING] Inventory item {inv_data['item_id']} not found, skipping")
                            continue
                        
                        quantity = inv_data['quantity']
                        
                        # Check stock availability
                        if item.current_stock < quantity:
                            print(f"[WARNING] Insufficient stock for {item.name}. Available: {item.current_stock}, Required: {quantity}")
                            # Allow it but log warning
                        
                        # Deduct stock
                        item.current_stock -= quantity
                        print(f"[DEBUG] Deducted {quantity} {inv_data['unit']} of {item.name}. New stock: {item.current_stock}")
                        
                        # Create inventory transaction
                        transaction = InventoryTransaction(
                            item_id=inv_data['item_id'],
                            transaction_type="out",
                            quantity=quantity,
                            unit_price=item.unit_price,
                            total_amount=item.unit_price * quantity if item.unit_price else None,
                            reference_number=f"SVC-ASSIGN-{db_assigned.id}",
                            department=item.category.parent_department if item.category else "Housekeeping",
                            notes=f"Service Assignment: {service.name} - Employee: {employee.name} - Room: {room.number}",
                            created_by=None
                        )
                        db.add(transaction)
                        print(f"[DEBUG] Created inventory transaction for {item.name}")
                        
                        # Create COGS Journal Entry
                        try:
                            db.flush()  # Get transaction ID
                            from app.utils.accounting_helpers import create_consumption_journal_entry
                            cogs_val = quantity * (item.unit_price or 0.0)
                            if cogs_val > 0:
                                create_consumption_journal_entry(
                                    db=db,
                                    consumption_id=transaction.id,
                                    cogs_amount=cogs_val,
                                    inventory_item_name=item.name,
                                    created_by=None
                                )
                                print(f"[DEBUG] Created COGS Journal Entry for {item.name}")
                        except Exception as je_error:
                            print(f"[WARNING] Failed to create COGS journal entry: {je_error}")
                        
                        # Create employee inventory assignment if model exists
                        if has_emp_inv_model and EmployeeInventoryAssignment:
                            emp_inv_assignment = EmployeeInventoryAssignment(
                                employee_id=assigned_dict['employee_id'],
                                assigned_service_id=db_assigned.id,
                                item_id=inv_data['item_id'],
                                quantity_assigned=quantity,
                                quantity_used=0.0,
                                quantity_returned=0.0,
                                status="assigned",
                                notes=f"Assigned for service: {service.name} - Room {room.number}"
                            )
                            db.add(emp_inv_assignment)
                            print(f"[DEBUG] Created employee inventory assignment for {item.name}")
                else:
                    print(f"[WARNING] No main warehouse location found, inventory items not deducted")
            else:
                print(f"[DEBUG] Service has no inventory items, skipping stock deduction")
            
            print(f"[DEBUG] Committing transaction")
            db.commit()
            print(f"[DEBUG] Transaction committed")
            db.refresh(db_assigned)
            print(f"[DEBUG] AssignedService refreshed, ID={db_assigned.id}")
        except Exception as db_error:
            db.rollback()
            print(f"[ERROR] Database error creating AssignedService: {str(db_error)}")
            import traceback
            print(traceback.format_exc())
            raise
        
        print(f"[DEBUG] AssignedService created with ID: {db_assigned.id}")
        
        # Load relationships for response
        try:
            db_assigned = db.query(AssignedService).options(
                joinedload(AssignedService.service),
                joinedload(AssignedService.employee),
                joinedload(AssignedService.room)
            ).filter(AssignedService.id == db_assigned.id).first()
            
            if not db_assigned:
                raise ValueError("Failed to retrieve created assigned service")
            
            # Verify relationships are loaded
            if not db_assigned.service:
                raise ValueError(f"Service relationship not loaded for service_id={assigned_dict['service_id']}")
            if not db_assigned.employee:
                raise ValueError(f"Employee relationship not loaded for employee_id={assigned_dict['employee_id']}")
            if not db_assigned.room:
                raise ValueError(f"Room relationship not loaded for room_id={assigned_dict['room_id']}")
            
            print(f"[DEBUG] Relationships loaded: service={db_assigned.service.name}, employee={db_assigned.employee.name}, room={db_assigned.room.number}")
            return db_assigned
        except Exception as rel_error:
            print(f"[ERROR] Error loading relationships: {str(rel_error)}")
            import traceback
            print(traceback.format_exc())
            # Try to return without relationships as fallback
            db.refresh(db_assigned)
            return db_assigned
    except Exception as e:
        db.rollback()
        import traceback
        error_msg = f"Error creating assigned service: {str(e)}"
        print(f"[ERROR] {error_msg}")
        print(traceback.format_exc())
        raise ValueError(error_msg) from e

def get_assigned_services(db: Session, skip: int = 0, limit: int = 100):
    """
    Get assigned services - ultra-simplified version for maximum performance.
    """
    try:
        # Cap limit to prevent performance issues
        if limit > 200:
            limit = 200
        if limit < 1:
            limit = 20
        
        # Ultra-simple query - minimal eager loading to avoid hangs
        # Only load essential relationships
        assigned_services = db.query(AssignedService).options(
            joinedload(AssignedService.service),
            joinedload(AssignedService.employee),
            joinedload(AssignedService.room)
        ).order_by(AssignedService.id.desc()).offset(skip).limit(limit).all()
        
        return assigned_services
    except Exception as e:
        import traceback
        print(f"[ERROR] Error in get_assigned_services: {str(e)}")
        print(traceback.format_exc())
        # Return empty list on error to prevent 500
        return []

def update_assigned_service_status(db: Session, assigned_id: int, update_data: AssignedServiceUpdate):
    import traceback
    from app.models.inventory import InventoryItem, InventoryTransaction, Location
    from datetime import datetime
    
    assigned = db.query(AssignedService).filter(AssignedService.id == assigned_id).first()
    if not assigned:
        return None
    
    # Handle employee reassignment if provided
    if update_data.employee_id is not None:
        employee = db.query(Employee).filter(Employee.id == update_data.employee_id).first()
        if not employee:
            raise ValueError(f"Employee with ID {update_data.employee_id} not found")
        assigned.employee_id = update_data.employee_id
        print(f"[DEBUG] Reassigned service {assigned_id} to employee {employee.name} (ID: {employee.id})")
    
    # Handle status update if provided
    old_status = assigned.status
    new_status = None
    if update_data.status is not None:
        # Handle both enum and string status values
        new_status = update_data.status.value if hasattr(update_data.status, 'value') else str(update_data.status)
        assigned.status = update_data.status
    else:
        # If no status update, use current status
        new_status = old_status.value if hasattr(old_status, 'value') else str(old_status)
    
    # If status changed to completed, set completed time and handle inventory returns
    if new_status == "completed" and str(old_status) != "completed":
        # Set completed time (last_used_at)
        assigned.last_used_at = datetime.utcnow()
        print(f"[DEBUG] Set completed time (last_used_at) for service {assigned_id}: {assigned.last_used_at}")
        try:
            from app.models.employee_inventory import EmployeeInventoryAssignment
            
            # Mark all inventory assignments for this service as completed (ready for return)
            assignments = db.query(EmployeeInventoryAssignment).filter(
                EmployeeInventoryAssignment.assigned_service_id == assigned_id,
                EmployeeInventoryAssignment.status.in_(["assigned", "in_use", "completed"])
            ).all()
            
            for assignment in assignments:
                assignment.status = "completed"  # Ready for return
                print(f"[DEBUG] Marked inventory assignment {assignment.id} as completed (ready for return)")
            
            # Process inventory returns if provided
            if update_data.inventory_returns and len(update_data.inventory_returns) > 0:
                print(f"[DEBUG] Processing {len(update_data.inventory_returns)} inventory returns")
                
                # Find main warehouse location
                main_location = db.query(Location).filter(
                    (Location.location_type == "WAREHOUSE") | 
                    (Location.location_type == "CENTRAL_WAREHOUSE") |
                    (Location.is_inventory_point == True)
                ).first()
                
                if not main_location:
                    main_location = db.query(Location).filter(
                        Location.location_type.in_(["WAREHOUSE", "CENTRAL_WAREHOUSE", "BRANCH_STORE"])
                    ).first()
                
                for return_item in update_data.inventory_returns:
                    assignment = db.query(EmployeeInventoryAssignment).filter(
                        EmployeeInventoryAssignment.id == return_item.assignment_id,
                        EmployeeInventoryAssignment.assigned_service_id == assigned_id
                    ).first()
                    
                    if not assignment:
                        print(f"[WARNING] Inventory assignment {return_item.assignment_id} not found for service {assigned_id}")
                        continue
                    
                    quantity_returned = float(return_item.quantity_returned)
                    balance = assignment.balance_quantity
                    
                    if quantity_returned <= 0:
                        print(f"[WARNING] Invalid return quantity {quantity_returned} for assignment {assignment.id}")
                        continue
                    
                    if quantity_returned > balance:
                        print(f"[WARNING] Return quantity {quantity_returned} exceeds balance {balance} for assignment {assignment.id}")
                        quantity_returned = balance  # Return maximum available
                    
                    # Update assignment
                    assignment.quantity_returned += quantity_returned
                    if assignment.quantity_returned >= assignment.quantity_assigned:
                        assignment.is_returned = True
                        assignment.status = "returned"
                        assignment.returned_at = datetime.utcnow()
                    else:
                        assignment.status = "partially_returned"
                    
                    # Add stock back to inventory
                    item = db.query(InventoryItem).filter(InventoryItem.id == assignment.item_id).first()
                    if item:
                        item.current_stock += quantity_returned
                        print(f"[DEBUG] Returned {quantity_returned} {item.unit or 'pcs'} of {item.name}. New stock: {item.current_stock}")
                        
                        # Create return transaction
                        transaction = InventoryTransaction(
                            item_id=assignment.item_id,
                            transaction_type="in",
                            quantity=quantity_returned,
                            unit_price=item.unit_price,
                            total_amount=item.unit_price * quantity_returned if item.unit_price else None,
                            reference_number=f"SVC-RETURN-{assigned_id}",
                            department=item.category.parent_department if item.category else "Housekeeping",
                            notes=f"Return from Service Completion: {assigned.service.name if assigned.service else 'Unknown'} - {return_item.notes or 'Service completed'}",
                            created_by=None
                        )
                        db.add(transaction)
                        print(f"[DEBUG] Created return transaction for {item.name}")
                    else:
                        print(f"[WARNING] Inventory item {assignment.item_id} not found")
                
        except ImportError:
            print("[WARNING] EmployeeInventoryAssignment model not found, skipping inventory return processing")
        except Exception as e:
            print(f"[ERROR] Error processing inventory returns: {str(e)}")
            print(traceback.format_exc())
            # Don't fail the status update if return processing fails
    
    db.commit()
    db.refresh(assigned)
    return assigned

def delete_assigned_service(db: Session, assigned_id: int):
    assigned = db.query(AssignedService).filter(AssignedService.id == assigned_id).first()
    if assigned:
        db.delete(assigned)
        db.commit()
        return True
    return False
