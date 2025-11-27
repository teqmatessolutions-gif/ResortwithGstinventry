from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.schemas.user import RoleCreate, RoleOut
from app.curd import role as crud_role
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter(prefix="/roles", tags=["Roles"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("", response_model=RoleOut)
def create_new_role(role: RoleCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not user.role or user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create roles")
    return crud_role.create_role(db, role)

@router.post("/", response_model=RoleOut)  # Handle trailing slash
def create_new_role_slash(role: RoleCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not user.role or user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create roles")
    return crud_role.create_role(db, role)

@router.get("", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db), skip: int = 0, limit: int = 20):
    roles = crud_role.get_roles(db, skip=skip, limit=limit)
    return roles

@router.put("/{role_id}", response_model=RoleOut)
def update_existing_role(role_id: int, role: RoleCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not user.role or user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Only admin can update roles")
    updated_role = crud_role.update_role(db, role_id, role)
    if not updated_role:
        raise HTTPException(status_code=404, detail="Role not found")
    return updated_role

@router.delete("/{role_id}")
def delete_existing_role(role_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not user.role or user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete roles")
    success = crud_role.delete_role(db, role_id)
    if not success:
        raise HTTPException(status_code=404, detail="Role not found")
    return {"message": "Role deleted successfully"}
