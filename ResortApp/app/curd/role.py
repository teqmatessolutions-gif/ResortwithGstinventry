from sqlalchemy.orm import Session
from app.models.user import Role
from app.schemas.user import RoleCreate
import json

def create_role(db: Session, role: RoleCreate):
    # Store permissions as JSON string
    permissions_str = role.permissions if role.permissions else json.dumps([])
    db_role = Role(name=role.name, permissions=permissions_str)
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

def update_role(db: Session, role_id: int, role_data: RoleCreate):
    db_role = db.query(Role).filter(Role.id == role_id).first()
    if not db_role:
        return None
    
    db_role.name = role_data.name
    # Store permissions as JSON string
    if role_data.permissions:
        db_role.permissions = role_data.permissions
    else:
        db_role.permissions = json.dumps([])
        
    db.commit()
    db.refresh(db_role)
    return db_role

def get_roles(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Role).offset(skip).limit(limit).all()

def delete_role(db: Session, role_id: int):
    db_role = db.query(Role).filter(Role.id == role_id).first()
    if db_role:
        db.delete(db_role)
        db.commit()
        return True
    return False