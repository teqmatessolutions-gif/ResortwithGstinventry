#!/usr/bin/env python3
"""
Database Migration Script for Pomma Holidays
Run this script on the production server to add missing columns.

Usage:
    cd ResortApp
    source venv/bin/activate
    python3 migrate_database.py
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import SQLALCHEMY_DATABASE_URL

def migrate_database():
    """Add missing columns to packages and rooms tables."""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        print("=" * 60)
        print("Pomma Holidays - Database Migration")
        print("=" * 60)
        print()

        # Migrate packages table
        print("Step 1/2: Migrating 'packages' table...")
        print("-" * 60)
        
        try:
            db.execute(text("ALTER TABLE packages ADD COLUMN IF NOT EXISTS booking_type VARCHAR(50)"))
            print("✓ Added 'booking_type' column to packages table")
        except Exception as e:
            print(f"⚠️  booking_type column: {e}")
        
        try:
            db.execute(text("ALTER TABLE packages ADD COLUMN IF NOT EXISTS room_types TEXT"))
            print("✓ Added 'room_types' column to packages table")
        except Exception as e:
            print(f"⚠️  room_types column: {e}")
        
        db.commit()
        print()

        # Migrate rooms table
        print("Step 2/2: Migrating 'rooms' table...")
        print("-" * 60)
        
        room_features = [
            ('air_conditioning', 'Air Conditioning'),
            ('wifi', 'Free Wifi'),
            ('bathroom', 'Private Bathroom'),
            ('living_area', 'Living Room'),
            ('terrace', 'Terrace'),
            ('parking', 'Free Parking'),
            ('kitchen', 'Kitchen'),
            ('family_room', 'Family Room'),
            ('bbq', 'BBQ'),
            ('garden', 'Garden'),
            ('dining', 'Dining Area'),
            ('breakfast', 'Breakfast'),
        ]

        for column_name, display_name in room_features:
            try:
                db.execute(text(f"ALTER TABLE rooms ADD COLUMN IF NOT EXISTS {column_name} BOOLEAN DEFAULT FALSE"))
                print(f"✓ Added '{column_name}' column to rooms table")
            except Exception as e:
                print(f"⚠️  {column_name} column: {e}")
        
        db.commit()
        print()
        print("=" * 60)
        print("✅ Database migration completed successfully!")
        print("=" * 60)
        print()
        print("Next steps:")
        print("1. Restart the backend service: sudo systemctl restart resort.service")
        print("2. Verify the application is working")
        print("3. Check logs: sudo journalctl -u resort.service -n 50")

    except Exception as e:
        db.rollback()
        print()
        print("=" * 60)
        print("❌ Error during database migration:")
        print("=" * 60)
        print(f"Error: {e}")
        print()
        import traceback
        traceback.print_exc()
        print()
        print("Please check the error above and try again.")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    migrate_database()

