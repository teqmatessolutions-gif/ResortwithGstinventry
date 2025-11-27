from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func
from decimal import Decimal
from datetime import datetime
from typing import Optional
from app.models.inventory import (
    InventoryCategory, InventoryItem, Vendor, PurchaseMaster, PurchaseDetail, InventoryTransaction,
    StockRequisition, StockRequisitionDetail, StockIssue, StockIssueDetail, WasteLog, Location, AssetMapping
)
from app.schemas.inventory import (
    InventoryCategoryCreate, InventoryItemCreate, VendorCreate, PurchaseMasterCreate
)


# Category CRUD
def create_category(db: Session, data: InventoryCategoryCreate):
    category = InventoryCategory(**data.dict())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def get_all_categories(db: Session, skip: int = 0, limit: int = 100):
    return db.query(InventoryCategory).offset(skip).limit(limit).all()


def get_category_by_id(db: Session, category_id: int):
    return db.query(InventoryCategory).filter(InventoryCategory.id == category_id).first()


# Item CRUD
def create_item(db: Session, data: InventoryItemCreate):
    item = InventoryItem(**data.dict())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_all_items(db: Session, skip: int = 0, limit: int = 100, category_id: Optional[int] = None):
    """Optimized with eager loading to prevent N+1 queries"""
    query = db.query(InventoryItem).options(
        joinedload(InventoryItem.category),
        joinedload(InventoryItem.preferred_vendor)
    )
    if category_id:
        query = query.filter(InventoryItem.category_id == category_id)
    return query.offset(skip).limit(limit).all()


def get_item_by_id(db: Session, item_id: int):
    return db.query(InventoryItem).filter(InventoryItem.id == item_id).first()


def update_item_stock(db: Session, item_id: int, quantity_change: float, transaction_type: str):
    """Update item stock and create transaction record"""
    item = get_item_by_id(db, item_id)
    if not item:
        return None
    
    if transaction_type == "in":
        item.current_stock += quantity_change
    elif transaction_type == "out":
        item.current_stock -= quantity_change
    elif transaction_type == "adjustment":
        item.current_stock = quantity_change
    
    db.commit()
    db.refresh(item)
    return item


# Vendor CRUD
def create_vendor(db: Session, data: VendorCreate):
    vendor = Vendor(**data.model_dump())
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


def get_all_vendors(db: Session, skip: int = 0, limit: int = 100, active_only: bool = False):
    query = db.query(Vendor)
    if active_only:
        query = query.filter(Vendor.is_active == True)
    return query.offset(skip).limit(limit).all()


def get_vendor_by_id(db: Session, vendor_id: int):
    return db.query(Vendor).filter(Vendor.id == vendor_id).first()


# Purchase Master CRUD
def generate_purchase_number(db: Session):
    """Generate unique purchase number"""
    count = db.query(PurchaseMaster).count()
    return f"PO-{datetime.now().strftime('%Y%m%d')}-{count + 1:04d}"


def calculate_gst(amount: Decimal, gst_rate: Decimal, is_interstate: bool = False):
    """Calculate CGST, SGST, or IGST based on interstate status"""
    gst_amount = (amount * gst_rate) / Decimal("100")
    if is_interstate:
        return Decimal("0.00"), Decimal("0.00"), gst_amount
    else:
        # Split GST equally between CGST and SGST
        half_gst = gst_amount / Decimal("2")
        return half_gst, half_gst, Decimal("0.00")


def create_purchase_master(db: Session, data: PurchaseMasterCreate, created_by: int = None):
    """Create purchase master with details and calculate totals"""
    # Generate purchase number if not provided
    if not data.purchase_number:
        data.purchase_number = generate_purchase_number(db)
    
    # Get vendor to check if interstate (different state)
    vendor = get_vendor_by_id(db, data.vendor_id)
    is_interstate = False  # Default, can be enhanced with user state
    
    # Calculate totals from details
    sub_total = Decimal("0.00")
    total_cgst = Decimal("0.00")
    total_sgst = Decimal("0.00")
    total_igst = Decimal("0.00")
    total_discount = Decimal("0.00")
    
    # Create purchase master
    master_data = data.dict(exclude={"details"})
    purchase_master = PurchaseMaster(**master_data, created_by=created_by)
    db.add(purchase_master)
    db.flush()  # Get the ID
    
    # Create purchase details and calculate totals
    for detail_data in data.details:
        item = get_item_by_id(db, detail_data.item_id)
        if not item:
            continue
        
        # Use item's HSN if not provided in detail
        hsn_code = detail_data.hsn_code or item.hsn_code
        
        # Calculate line total before GST
        line_total = (Decimal(str(detail_data.quantity)) * Decimal(str(detail_data.unit_price))) - Decimal(str(detail_data.discount))
        
        # Calculate GST
        cgst, sgst, igst = calculate_gst(line_total, Decimal(str(detail_data.gst_rate)), is_interstate)
        line_total_with_gst = line_total + cgst + sgst + igst
        
        # Create purchase detail
        purchase_detail = PurchaseDetail(
            purchase_master_id=purchase_master.id,
            item_id=detail_data.item_id,
            hsn_code=hsn_code,
            quantity=detail_data.quantity,
            unit=detail_data.unit,
            unit_price=Decimal(str(detail_data.unit_price)),
            gst_rate=Decimal(str(detail_data.gst_rate)),
            cgst_amount=cgst,
            sgst_amount=sgst,
            igst_amount=igst,
            discount=Decimal(str(detail_data.discount)),
            total_amount=line_total_with_gst,
            notes=detail_data.notes
        )
        db.add(purchase_detail)
        
        # Accumulate totals
        sub_total += line_total
        total_cgst += cgst
        total_sgst += sgst
        total_igst += igst
        total_discount += Decimal(str(detail_data.discount))
    
    # Update master totals
    purchase_master.sub_total = sub_total
    purchase_master.cgst = total_cgst
    purchase_master.sgst = total_sgst
    purchase_master.igst = total_igst
    purchase_master.discount = total_discount
    purchase_master.total_amount = sub_total + total_cgst + total_sgst + total_igst - total_discount
    
    # If status is confirmed/received, update inventory
    if data.status in ["confirmed", "received"]:
        for detail_data in data.details:
            update_item_stock(db, detail_data.item_id, detail_data.quantity, "in")
            # Create transaction record
            item = get_item_by_id(db, detail_data.item_id)
            transaction = InventoryTransaction(
                item_id=detail_data.item_id,
                transaction_type="in",
                quantity=detail_data.quantity,
                unit_price=float(detail_data.unit_price),
                total_amount=float(detail_data.unit_price * Decimal(str(detail_data.quantity))),
                reference_number=data.purchase_number,
                purchase_master_id=purchase_master.id,
                notes=f"Purchase: {data.purchase_number}",
                created_by=created_by
            )
            db.add(transaction)
    
    db.commit()
    db.refresh(purchase_master)
    return purchase_master


def get_all_purchases(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None):
    """Optimized with eager loading"""
    query = db.query(PurchaseMaster).options(
        joinedload(PurchaseMaster.vendor),
        selectinload(PurchaseMaster.details).joinedload(PurchaseDetail.item)
    )
    if status:
        query = query.filter(PurchaseMaster.status == status)
    return query.order_by(PurchaseMaster.created_at.desc()).offset(skip).limit(limit).all()


def get_purchase_by_id(db: Session, purchase_id: int):
    return db.query(PurchaseMaster).filter(PurchaseMaster.id == purchase_id).first()


def update_purchase_status(db: Session, purchase_id: int, status: str):
    """Update purchase status and handle inventory if received"""
    purchase = get_purchase_by_id(db, purchase_id)
    if not purchase:
        return None
    
    old_status = purchase.status
    purchase.status = status
    
    # If changing to received, update inventory
    if old_status != "received" and status == "received":
        for detail in purchase.details:
            update_item_stock(db, detail.item_id, detail.quantity, "in")
            # Create transaction if not exists
            existing_transaction = db.query(InventoryTransaction).filter(
                InventoryTransaction.purchase_master_id == purchase_id,
                InventoryTransaction.item_id == detail.item_id
            ).first()
            if not existing_transaction:
                transaction = InventoryTransaction(
                    item_id=detail.item_id,
                    transaction_type="in",
                    quantity=detail.quantity,
                    unit_price=float(detail.unit_price),
                    total_amount=float(detail.total_amount),
                    reference_number=purchase.purchase_number,
                    purchase_master_id=purchase.id,
                    notes=f"Purchase: {purchase.purchase_number}",
                    created_by=purchase.created_by
                )
                db.add(transaction)
    
    db.commit()
    db.refresh(purchase)
    return purchase


# Stock Requisition CRUD
def generate_requisition_number(db: Session):
    from datetime import datetime
    today = datetime.utcnow()
    date_str = today.strftime("%Y%m%d")
    count = db.query(StockRequisition).filter(
        StockRequisition.requisition_number.like(f"REQ-{date_str}-%")
    ).count() + 1
    return f"REQ-{date_str}-{str(count).zfill(3)}"  # e.g., REQ-101


def create_stock_requisition(db: Session, data: dict, created_by: int):
    from app.models.inventory import StockRequisition, StockRequisitionDetail
    from datetime import datetime
    
    requisition_number = generate_requisition_number(db)
    requisition = StockRequisition(
        requisition_number=requisition_number,
        requested_by=created_by,
        destination_department=data["destination_department"],
        date_needed=data.get("date_needed"),
        priority=data.get("priority", "normal"),
        status="pending",
        notes=data.get("notes"),
    )
    db.add(requisition)
    db.flush()
    
    for detail_data in data["details"]:
        detail = StockRequisitionDetail(
            requisition_id=requisition.id,
            item_id=detail_data["item_id"],
            requested_quantity=detail_data["requested_quantity"],
            approved_quantity=detail_data.get("approved_quantity"),
            unit=detail_data["unit"],
            notes=detail_data.get("notes"),
        )
        db.add(detail)
    
    db.commit()
    db.refresh(requisition)
    return requisition


def get_all_requisitions(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None):
    """Optimized with eager loading"""
    from app.models.inventory import StockRequisition
    query = db.query(StockRequisition).options(
        selectinload(StockRequisition.details).joinedload(StockRequisitionDetail.item)
    )
    if status:
        query = query.filter(StockRequisition.status == status)
    return query.order_by(StockRequisition.created_at.desc()).offset(skip).limit(limit).all()


def get_requisition_by_id(db: Session, requisition_id: int):
    from app.models.inventory import StockRequisition
    return db.query(StockRequisition).filter(StockRequisition.id == requisition_id).first()


def update_requisition_status(db: Session, requisition_id: int, status: str, approved_by: Optional[int] = None):
    from app.models.inventory import StockRequisition
    from datetime import datetime
    
    requisition = get_requisition_by_id(db, requisition_id)
    if not requisition:
        return None
    
    requisition.status = status
    if status == "approved" and approved_by:
        requisition.approved_by = approved_by
        requisition.approved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(requisition)
    return requisition


# Stock Issue CRUD
def generate_issue_number(db: Session):
    from datetime import datetime
    today = datetime.utcnow()
    date_str = today.strftime("%Y%m%d")
    count = db.query(StockIssue).filter(
        StockIssue.issue_number.like(f"ISS-{date_str}-%")
    ).count() + 1
    return f"ISS-{date_str}-{str(count).zfill(3)}"  # e.g., ISS-505


def create_stock_issue(db: Session, data: dict, issued_by: int):
    from app.models.inventory import StockIssue, StockIssueDetail, InventoryTransaction, InventoryItem
    from datetime import datetime
    
    issue_number = generate_issue_number(db)
    
    # Parse issue_date if provided as string
    issue_date = data.get("issue_date")
    if issue_date and isinstance(issue_date, str):
        try:
            issue_date = datetime.fromisoformat(issue_date.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            issue_date = datetime.utcnow()
    elif not issue_date:
        issue_date = datetime.utcnow()
    
    issue = StockIssue(
        issue_number=issue_number,
        requisition_id=data.get("requisition_id"),
        issued_by=issued_by,
        source_location_id=data.get("source_location_id"),
        destination_location_id=data.get("destination_location_id"),
        issue_date=issue_date,
        notes=data.get("notes"),
    )
    db.add(issue)
    db.flush()
    
    for detail_data in data["details"]:
        item = get_item_by_id(db, detail_data["item_id"])
        if not item:
            continue
        
        # Check stock availability
        issued_qty = detail_data.get("issued_quantity", detail_data.get("quantity", 0))
        if issued_qty <= 0:
            continue  # Skip zero or negative quantities
        
        # Allow issuing even if stock is 0 (for initial allocations or adjustments)
        # Only warn if stock would go negative
        if item.current_stock < issued_qty:
            # For auto-allocations from check-in, allow it but log a warning
            import logging
            logging.warning(f"Stock issue: {item.name} - Available: {item.current_stock}, Requested: {issued_qty}. Allowing negative stock for allocation.")
        
        # Calculate cost
        cost = item.unit_price * issued_qty if item.unit_price else None
        
        # Create issue detail
        detail = StockIssueDetail(
            issue_id=issue.id,
            item_id=detail_data["item_id"],
            issued_quantity=issued_qty,
            batch_lot_number=detail_data.get("batch_lot_number"),
            unit=detail_data["unit"],
            unit_price=item.unit_price,
            cost=cost,
            notes=detail_data.get("notes"),
        )
        db.add(detail)
        
        # Deduct stock
        item.current_stock -= issued_qty
        
        # Get destination location name for transaction notes
        dest_location = None
        if data.get("destination_location_id"):
            dest_location = get_location_by_id(db, data.get("destination_location_id"))
        
        dest_location_name = ""
        if dest_location:
            dest_location_name = f"{dest_location.building} - {dest_location.room_area}" if dest_location.building or dest_location.room_area else dest_location.name or f"Location {dest_location.id}"
        
        # Create transaction record with destination location info
        transaction_notes = f"Stock Issue: {issue_number}"
        if dest_location_name:
            transaction_notes += f" → {dest_location_name}"
        if data.get('notes'):
            transaction_notes += f" - {data.get('notes', '')}"
        
        transaction = InventoryTransaction(
            item_id=detail_data["item_id"],
            transaction_type="out",
            quantity=issued_qty,
            unit_price=item.unit_price,
            total_amount=cost,
            reference_number=issue_number,
            notes=transaction_notes,
            created_by=issued_by
        )
        db.add(transaction)
        
        # Update requisition status if linked
        if data.get("requisition_id"):
            update_requisition_status(db, data["requisition_id"], "issued")
    
    db.commit()
    db.refresh(issue)
    return issue


def get_all_issues(db: Session, skip: int = 0, limit: int = 100):
    """Optimized with eager loading"""
    from app.models.inventory import StockIssue
    return db.query(StockIssue).options(
        joinedload(StockIssue.source_location),
        joinedload(StockIssue.destination_location),
        selectinload(StockIssue.details).joinedload(StockIssueDetail.item)
    ).order_by(StockIssue.created_at.desc()).offset(skip).limit(limit).all()


def get_issue_by_id(db: Session, issue_id: int):
    from app.models.inventory import StockIssue
    return db.query(StockIssue).filter(StockIssue.id == issue_id).first()


# Waste Log CRUD
def generate_waste_log_number(db: Session):
    from datetime import datetime
    today = datetime.utcnow()
    date_str = today.strftime("%Y%m%d")
    count = db.query(WasteLog).filter(
        WasteLog.log_number.like(f"WASTE-{date_str}-%")
    ).count() + 1
    return f"WASTE-{date_str}-{str(count).zfill(3)}"


def create_waste_log(db: Session, data: dict, reported_by: int):
    from app.models.inventory import WasteLog, InventoryTransaction, InventoryItem
    from datetime import datetime
    
    item = get_item_by_id(db, data["item_id"])
    if not item:
        raise ValueError("Item not found")
    
    # Check stock availability
    if item.current_stock < data["quantity"]:
        raise ValueError(f"Insufficient stock for {item.name}. Available: {item.current_stock}, Reported: {data['quantity']}")
    
    log_number = generate_waste_log_number(db)
    waste_log = WasteLog(
        log_number=log_number,
        item_id=data["item_id"],
        location_id=data.get("location_id"),
        batch_number=data.get("batch_number"),
        expiry_date=data.get("expiry_date"),
        quantity=data["quantity"],
        unit=data["unit"],
        reason_code=data["reason_code"],
        action_taken=data.get("action_taken"),
        photo_path=data.get("photo_path"),
        notes=data.get("notes"),
        reported_by=reported_by,
        waste_date=data.get("waste_date", datetime.utcnow()),
    )
    db.add(waste_log)
    
    # Deduct stock
    item.current_stock -= data["quantity"]
    
    # Create transaction record
    transaction = InventoryTransaction(
        item_id=data["item_id"],
        transaction_type="out",
        quantity=data["quantity"],
        unit_price=item.unit_price,
        total_amount=item.unit_price * data["quantity"] if item.unit_price else None,
        reference_number=log_number,
        notes=f"Waste/Spoilage: {data['reason_code']} - {data.get('notes', '')}",
        created_by=reported_by
    )
    db.add(transaction)
    
    db.commit()
    db.refresh(waste_log)
    return waste_log


def get_all_waste_logs(db: Session, skip: int = 0, limit: int = 100):
    from app.models.inventory import WasteLog
    return db.query(WasteLog).order_by(WasteLog.created_at.desc()).offset(skip).limit(limit).all()


def get_waste_log_by_id(db: Session, waste_log_id: int):
    from app.models.inventory import WasteLog
    return db.query(WasteLog).filter(WasteLog.id == waste_log_id).first()


# Location CRUD
def generate_location_code(db: Session, location_type: str, room_area: str):
    """Generate location code like LOC-RM-101"""
    prefix_map = {
        "GUEST_ROOM": "RM",
        "Guest Room": "RM",  # Backward compatibility
        "WAREHOUSE": "WH",
        "CENTRAL_WAREHOUSE": "WH",
        "BRANCH_STORE": "BS",
        "SUB_STORE": "SS",
        "DEPARTMENT": "DEPT",
        "PUBLIC_AREA": "PA",
        "Public Area": "PA"  # Backward compatibility
    }
    prefix = prefix_map.get(location_type, "LOC")
    # Extract numbers from room_area if available
    import re
    numbers = re.findall(r'\d+', room_area)
    suffix = numbers[0] if numbers else str(db.query(Location).count() + 1)
    return f"LOC-{prefix}-{suffix}"


def create_location(db: Session, data: dict):
    from app.models.inventory import Location
    location_code = generate_location_code(db, data.get("location_type", ""), data.get("room_area", ""))
    location = Location(
        location_code=location_code,
        **data
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


def get_all_locations(db: Session, skip: int = 0, limit: int = 10000):  # Increased limit to show all rooms
    from app.models.inventory import Location
    # Skip auto-sync here - it's handled in the API endpoint to avoid transaction conflicts
    # Just return locations directly
    return db.query(Location).filter(Location.is_active == True).offset(skip).limit(limit).all()


def get_location_by_id(db: Session, location_id: int):
    from app.models.inventory import Location
    return db.query(Location).filter(Location.id == location_id).first()


def update_location(db: Session, location_id: int, data: dict):
    from app.models.inventory import Location
    location = get_location_by_id(db, location_id)
    if not location:
        return None
    for key, value in data.items():
        setattr(location, key, value)
    db.commit()
    db.refresh(location)
    return location


# Asset Mapping CRUD
def create_asset_mapping(db: Session, data: dict, assigned_by: Optional[int] = None):
    from app.models.inventory import AssetMapping
    mapping = AssetMapping(
        item_id=data["item_id"],
        location_id=data["location_id"],
        serial_number=data.get("serial_number"),
        notes=data.get("notes"),
        assigned_by=assigned_by,
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping


def get_all_asset_mappings(db: Session, skip: int = 0, limit: int = 100, location_id: Optional[int] = None):
    from app.models.inventory import AssetMapping
    query = db.query(AssetMapping).filter(AssetMapping.is_active == True)
    if location_id:
        query = query.filter(AssetMapping.location_id == location_id)
    return query.order_by(AssetMapping.assigned_date.desc()).offset(skip).limit(limit).all()


def get_asset_mapping_by_id(db: Session, mapping_id: int):
    from app.models.inventory import AssetMapping
    return db.query(AssetMapping).filter(AssetMapping.id == mapping_id).first()


def unassign_asset(db: Session, mapping_id: int):
    from app.models.inventory import AssetMapping
    from datetime import datetime
    mapping = get_asset_mapping_by_id(db, mapping_id)
    if not mapping:
        return None
    mapping.is_active = False
    mapping.unassigned_date = datetime.utcnow()
    db.commit()
    db.refresh(mapping)
    return mapping


# Asset Registry CRUD
def generate_asset_tag_id(db: Session, item_id: int):
    """Generate asset tag ID like AST-TV-014"""
    from app.models.inventory import AssetRegistry, InventoryItem
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    item_prefix = item.name[:2].upper() if item else "AST"
    count = db.query(AssetRegistry).filter(AssetRegistry.item_id == item_id).count() + 1
    return f"AST-{item_prefix}-{str(count).zfill(3)}"


def create_asset_registry(db: Session, data: dict):
    from app.models.inventory import AssetRegistry
    asset_tag_id = generate_asset_tag_id(db, data["item_id"])
    asset = AssetRegistry(
        asset_tag_id=asset_tag_id,
        item_id=data["item_id"],
        serial_number=data.get("serial_number"),
        current_location_id=data["current_location_id"],
        status=data.get("status", "active"),
        purchase_date=data.get("purchase_date"),
        warranty_expiry_date=data.get("warranty_expiry_date"),
        last_maintenance_date=data.get("last_maintenance_date"),
        next_maintenance_due_date=data.get("next_maintenance_due_date"),
        purchase_master_id=data.get("purchase_master_id"),
        notes=data.get("notes")
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def get_all_asset_registry(db: Session, skip: int = 0, limit: int = 100, location_id: Optional[int] = None, status: Optional[str] = None):
    from app.models.inventory import AssetRegistry
    query = db.query(AssetRegistry)
    if location_id:
        query = query.filter(AssetRegistry.current_location_id == location_id)
    if status:
        query = query.filter(AssetRegistry.status == status)
    return query.order_by(AssetRegistry.created_at.desc()).offset(skip).limit(limit).all()


def get_asset_registry_by_id(db: Session, asset_id: int):
    from app.models.inventory import AssetRegistry
    return db.query(AssetRegistry).filter(AssetRegistry.id == asset_id).first()


def update_asset_registry(db: Session, asset_id: int, data: dict):
    from app.models.inventory import AssetRegistry
    asset = get_asset_registry_by_id(db, asset_id)
    if not asset:
        return None
    for key, value in data.items():
        setattr(asset, key, value)
    db.commit()
    db.refresh(asset)
    return asset


def delete_asset_registry(db: Session, asset_id: int):
    from app.models.inventory import AssetRegistry
    asset = get_asset_registry_by_id(db, asset_id)
    if not asset:
        return None
    db.delete(asset)
    db.commit()
    return asset

