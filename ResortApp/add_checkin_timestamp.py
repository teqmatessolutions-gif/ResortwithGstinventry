"""
Migration script to add checked_in_at timestamp to bookings and package_bookings tables.
This allows strict bill scoping by actual check-in time, not just date.
"""
from sqlalchemy import create_engine, Column, DateTime, text
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in environment variables")
    exit(1)

print(f"Connecting to database...")
engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        # Add checked_in_at column to bookings table
        print("Adding checked_in_at column to bookings table...")
        conn.execute(text("""
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP
        """))
        conn.commit()
        print("✓ Added checked_in_at to bookings")
        
        # Add checked_in_at column to package_bookings table
        print("Adding checked_in_at column to package_bookings table...")
        conn.execute(text("""
            ALTER TABLE package_bookings 
            ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP
        """))
        conn.commit()
        print("✓ Added checked_in_at to package_bookings")
        
        print("\n✅ Migration completed successfully!")
        print("Note: Existing bookings will have NULL checked_in_at.")
        print("For these, the system will fall back to using check_in date at 00:00:00")
        
except Exception as e:
    print(f"❌ Migration failed: {e}")
    import traceback
    traceback.print_exc()
