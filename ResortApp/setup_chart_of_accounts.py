"""
Setup Basic Chart of Accounts for Resort
Creates all required account groups and ledgers for automatic journal entries
"""
from app.database import SessionLocal
from app.curd.account import create_account_group, create_account_ledger
from app.schemas.account import AccountGroupCreate, AccountLedgerCreate

db = SessionLocal()

print("=" * 70)
print("🏗️  SETTING UP CHART OF ACCOUNTS")
print("=" * 70)

# Define account groups
groups = [
    {"name": "Assets", "account_type": "Asset", "parent_id": None},
    {"name": "Liabilities", "account_type": "Liability", "parent_id": None},
    {"name": "Revenue", "account_type": "Revenue", "parent_id": None},
    {"name": "Expenses", "account_type": "Expense", "parent_id": None},
]

created_groups = {}

print("\n📁 Creating Account Groups...")
for group_data in groups:
    try:
        # Check if group already exists
        from app.models.account import AccountGroup
        existing = db.query(AccountGroup).filter(AccountGroup.name == group_data["name"]).first()
        if existing:
            created_groups[existing.name] = existing
            print(f"  ⏭️  {existing.name} ({existing.account_type}): Already exists")
            continue
            
        group_in = AccountGroupCreate(**group_data)
        group = create_account_group(db, group_in)
        created_groups[group.name] = group
        print(f"  ✅ {group.name} ({group.account_type})")
    except Exception as e:
        print(f"  ⚠️  {group_data['name']}: {str(e)[:50]}")

# Define ledgers
ledgers = [
    # Assets
    {"name": "Cash in Hand", "code": "CASH001", "module": "Asset", "opening_balance": 0, "balance_type": "debit"},
    {"name": "Bank Account (HDFC)", "code": "BANK001", "module": "Asset", "opening_balance": 0, "balance_type": "debit"},
    {"name": "Bank Account (SBI)", "code": "BANK002", "module": "Asset", "opening_balance": 0, "balance_type": "debit"},
    {"name": "Inventory Asset (Stock)", "code": "INV001", "module": "Inventory", "opening_balance": 0, "balance_type": "debit"},
    {"name": "Accounts Receivable (Guest)", "code": "AR001", "module": "Booking", "opening_balance": 0, "balance_type": "debit"},
    
    # Liabilities
    {"name": "Accounts Payable (Vendor)", "code": "AP001", "module": "Purchase", "opening_balance": 0, "balance_type": "credit"},
    {"name": "Advance from Customers", "code": "ADV001", "module": "Booking", "opening_balance": 0, "balance_type": "credit"},
    
    # Tax Ledgers (Assets for Input Tax, Liabilities for Output Tax)
    {"name": "Input CGST", "code": "TAX001", "module": "Tax", "opening_balance": 0, "balance_type": "debit"},
    {"name": "Input SGST", "code": "TAX002", "module": "Tax", "opening_balance": 0, "balance_type": "debit"},
    {"name": "Input IGST", "code": "TAX003", "module": "Tax", "opening_balance": 0, "balance_type": "debit"},
    {"name": "Output CGST", "code": "TAX004", "module": "Tax", "opening_balance": 0, "balance_type": "credit"},
    {"name": "Output SGST", "code": "TAX005", "module": "Tax", "opening_balance": 0, "balance_type": "credit"},
    {"name": "Output IGST", "code": "TAX006", "module": "Tax", "opening_balance": 0, "balance_type": "credit"},
    
    # Revenue
    {"name": "Room Revenue (Taxable)", "code": "REV001", "module": "Booking", "opening_balance": 0, "balance_type": "credit"},
    {"name": "Food Revenue (Taxable)", "code": "REV002", "module": "Food", "opening_balance": 0, "balance_type": "credit"},
    {"name": "Service Revenue (Taxable)", "code": "REV003", "module": "Service", "opening_balance": 0, "balance_type": "credit"},
    {"name": "Package Revenue (Taxable)", "code": "REV004", "module": "Booking", "opening_balance": 0, "balance_type": "credit"},
    
    # Expenses
    {"name": "Cost of Goods Sold (COGS)", "code": "EXP001", "module": "Purchase", "opening_balance": 0, "balance_type": "debit"},
    {"name": "Consumables Expense", "code": "EXP002", "module": "Purchase", "opening_balance": 0, "balance_type": "debit"},
    {"name": "General Expense", "code": "EXP003", "module": "Expense", "opening_balance": 0, "balance_type": "debit"},
    {"name": "Discount Allowed", "code": "EXP004", "module": "Expense", "opening_balance": 0, "balance_type": "debit"},
]

print("\n📒 Creating Account Ledgers...")
created_count = 0
skipped_count = 0

for ledger_data in ledgers:
    try:
        # Assign group_id based on balance_type/module logic or just default to first matching group
        # For simplicity, we'll map based on account_type
        account_type = "Asset"
        if ledger_data["balance_type"] == "credit":
            if "Revenue" in ledger_data["name"] or "Output" in ledger_data["name"]:
                account_type = "Revenue"
            else:
                account_type = "Liability"
        else:
            if "Expense" in ledger_data["name"] or "Cost" in ledger_data["name"] or "Discount" in ledger_data["name"]:
                account_type = "Expense"
            else:
                account_type = "Asset"
                
        # Find group
        from app.models.account import AccountGroup
        group = db.query(AccountGroup).filter(AccountGroup.account_type == account_type).first()
        
        if group:
            ledger_data["group_id"] = group.id
        
        ledger_in = AccountLedgerCreate(**ledger_data)
        ledger = create_account_ledger(db, ledger_in)
        created_count += 1
        print(f"  ✅ {ledger.name} ({ledger.code}) - Module: {ledger.module}")
    except Exception as e:
        skipped_count += 1
        error_msg = str(e)
        if "already exists" in error_msg.lower() or "unique" in error_msg.lower():
            print(f"  ⏭️  {ledger_data['name']}: Already exists")
        else:
            print(f"  ❌ {ledger_data['name']}: {error_msg[:50]}")

print("\n" + "=" * 70)
print("📊 SUMMARY")
print("=" * 70)
print(f"  Account Groups: {len(created_groups)}")
print(f"  Ledgers Created: {created_count}")
print(f"  Ledgers Skipped: {skipped_count}")

print("\n✅ Chart of Accounts setup complete!")
print("\n💡 Now purchases will automatically create journal entries:")
print("   - Debit: Inventory Asset (Stock)")
print("   - Debit: Input CGST/SGST/IGST")
print("   - Credit: Accounts Payable (Vendor)")

db.close()
