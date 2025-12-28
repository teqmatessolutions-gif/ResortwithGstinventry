import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Add the parent directory to sys.path to ensure modules can be imported if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load env vars
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL not set in .env")
    sys.exit(1)

def seed_data():
    print("============================================================")
    print("Seeding Accounting Data (Chart of Accounts)")
    print("============================================================")

    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # 1. Clear existing data to avoid duplicates (Optional, safer for fresh setup)
        # db.execute(text("TRUNCATE TABLE account_ledgers, account_groups RESTART IDENTITY CASCADE"))
        # print("Cleared existing accounting tables.")

        # 2. Seed Account Groups
        # Structure: Name, Type, Description
        groups = [
            # Assets
            ("Current Assets", "Asset", "Short-term assets like cash and inventory"),
            ("Fixed Assets", "Asset", "Long-term assets like buildings and equipment"),
            ("Bank Accounts", "Asset", "All bank accounts"),
            ("Cash-in-Hand", "Asset", "Physical cash counters"),
            
            # Liabilities
            ("Current Liabilities", "Liability", "Short-term debts"),
            ("Duties & Taxes", "Liability", "GST, VAT and other taxes collected"),
            
            # Income (Revenue)
            ("Direct Income", "Income", "Core revenue from operations"),
            ("Indirect Income", "Income", "Other income"),
            
            # Expenses
            ("Direct Expenses", "Expense", "Direct costs of services"),
            ("Indirect Expenses", "Expense", "Operating overheads"),
            ("Purchase Accounts", "Expense", "Cost of goods sold/inventory purchase")
        ]

        print("\nSeeding Groups...")
        group_map = {} # To store name -> id mapping
        
        for name, acc_type, desc in groups:
            # Check if exists
            existing = db.execute(text("SELECT id FROM account_groups WHERE name = :name"), {"name": name}).fetchone()
            if existing:
                group_id = existing[0]
                print(f"  - Group '{name}' already exists.")
            else:
                result = db.execute(text("""
                    INSERT INTO account_groups (name, account_type, description, is_active)
                    VALUES (:name, :type, :desc, TRUE)
                    RETURNING id
                """), {"name": name, "type": acc_type, "desc": desc})
                group_id = result.fetchone()[0]
                print(f"  + Created Group '{name}'")
            
            group_map[name] = group_id
        
        db.commit()

        # 3. Seed Account Ledgers
        # Structure: Name, Group Name, Module, Code
        ledgers = [
            # Revenue Ledgers
            ("Room Revenue", "Direct Income", "booking", "REV001"),
            ("Food & Beverage Revenue", "Direct Income", "restaurant", "REV002"),
            ("Service Revenue", "Direct Income", "services", "REV003"),
            
            # Tax Ledgers
            ("Output CGST", "Duties & Taxes", "tax", "TAX001"),
            ("Output SGST", "Duties & Taxes", "tax", "TAX002"),
            ("Output IGST", "Duties & Taxes", "tax", "TAX003"),
            ("Input CGST", "Duties & Taxes", "tax", "TAX004"),
            ("Input SGST", "Duties & Taxes", "tax", "TAX005"),
            
            # Asset Ledgers
            ("Main Cash Counter", "Cash-in-Hand", "cash", "CASH001"),
            ("Default Bank Account", "Bank Accounts", "banking", "BANK001"),
            ("Inventory Assets", "Current Assets", "inventory", "AST001"),
            
            # Expense Ledgers
            ("Inventory Purchase", "Purchase Accounts", "inventory", "EXP001"),
            ("General Expenses", "Indirect Expenses", "general", "EXP002")
        ]

        print("\nSeeding Ledgers...")
        for name, group_name, module, code in ledgers:
            group_id = group_map.get(group_name)
            if not group_id:
                print(f"  ! Warning: Group '{group_name}' not found for ledger '{name}'. Skipping.")
                continue

            # Check if exists
            existing = db.execute(text("SELECT id FROM account_ledgers WHERE name = :name"), {"name": name}).fetchone()
            if existing:
                print(f"  - Ledger '{name}' already exists.")
            else:
                db.execute(text("""
                    INSERT INTO account_ledgers (name, group_id, module, code, is_active, balance_type)
                    VALUES (:name, :gid, :mod, :code, TRUE, 'debit')
                """), {"name": name, "gid": group_id, "mod": module, "code": code})
                print(f"  + Created Ledger '{name}'")

        db.commit()
        print("\n✅ Chart of Accounts Seeded Successfully!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
