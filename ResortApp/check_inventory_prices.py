"""
Quick script to check inventory transactions and their prices
"""
from app.database import SessionLocal
from app.models.inventory import InventoryTransaction, InventoryItem
from sqlalchemy import func

db = SessionLocal()

# Check total inventory transactions
total_transactions = db.query(func.count(InventoryTransaction.id)).scalar()
print(f"Total inventory transactions: {total_transactions}")

# Check transactions with prices
transactions_with_price = db.query(func.count(InventoryTransaction.id)).filter(
    InventoryTransaction.total_amount > 0
).scalar()
print(f"Transactions with price > 0: {transactions_with_price}")

# Check transactions by department
dept_stats = db.query(
    InventoryTransaction.department,
    func.count(InventoryTransaction.id).label('count'),
    func.sum(InventoryTransaction.total_amount).label('total')
).filter(
    InventoryTransaction.transaction_type == 'out'
).group_by(InventoryTransaction.department).all()

print("\nTransactions by department:")
for dept, count, total in dept_stats:
    print(f"  {dept or 'NULL'}: {count} transactions, Total: ₹{total or 0:.2f}")

# Check inventory items with prices
items_with_price = db.query(func.count(InventoryItem.id)).filter(
    InventoryItem.unit_price > 0
).scalar()
total_items = db.query(func.count(InventoryItem.id)).scalar()
print(f"\nInventory items with unit_price > 0: {items_with_price}/{total_items}")

# Sample some items
print("\nSample inventory items:")
items = db.query(InventoryItem).limit(10).all()
for item in items:
    print(f"  {item.name}: ₹{item.unit_price} per {item.unit}")

db.close()
