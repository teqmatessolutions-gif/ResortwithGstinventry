from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

from app.utils.auth import get_db
from app.models.settings import SystemSetting

router = APIRouter(prefix="/settings", tags=["Settings"])

class SettingBase(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

class SettingOut(SettingBase):
    id: int
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

@router.get("/", response_model=List[SettingOut])
def get_settings(db: Session = Depends(get_db)):
    return db.query(SystemSetting).all()

@router.post("/", response_model=SettingOut)
def create_or_update_setting(setting: SettingBase, db: Session = Depends(get_db)):
    db_setting = db.query(SystemSetting).filter(SystemSetting.key == setting.key).first()
    if db_setting:
        db_setting.value = setting.value
        if setting.description:
            db_setting.description = setting.description
    else:
        db_setting = SystemSetting(key=setting.key, value=setting.value, description=setting.description)
        db.add(db_setting)
    
    db.commit()
    db.refresh(db_setting)
    return db_setting

@router.get("/{key}", response_model=SettingOut)
def get_setting(key: str, db: Session = Depends(get_db)):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting
