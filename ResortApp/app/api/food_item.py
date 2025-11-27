from fastapi import APIRouter, UploadFile, File, Form, Depends
from sqlalchemy.orm import Session

from app.curd import food_item
from app.schemas.food_item import FoodItemCreate, FoodItemUpdate
from app.models.user import User
import os, shutil, uuid
from app.utils.auth import get_db, get_current_user

router = APIRouter(prefix="/food-items", tags=["FoodItem"])
UPLOAD_DIR = "uploads/food_items"
os.makedirs(UPLOAD_DIR, exist_ok=True)



def _create_item_impl(
    name: str,
    description: str,
    price: float,
    available: bool,
    category_id: int,
    images: list[UploadFile],
    db: Session,
    current_user: User
):
    """Helper function for create_item"""
    image_paths = []
    for image in images:
        # Generate unique filename
        filename = f"food_{uuid.uuid4().hex}_{image.filename}"
        path = os.path.join(UPLOAD_DIR, filename)
        with open(path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        # Store with leading slash for proper URL construction
        web_path = f"/{UPLOAD_DIR}/{filename}".replace("\\", "/")
        image_paths.append(web_path)

    item_data = FoodItemCreate(
        name=name, description=description, price=price,
        available=available, category_id=category_id
    )
    return food_item.create_food_item(db, item_data, image_paths)

@router.post("")
async def create_item(
    name: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    available: bool = Form(...),
    category_id: int = Form(...),
    images: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return _create_item_impl(name, description, price, available, category_id, images, db, current_user)

@router.post("/")  # Handle trailing slash
async def create_item_slash(
    name: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    available: bool = Form(...),
    category_id: int = Form(...),
    images: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return _create_item_impl(name, description, price, available, category_id, images, db, current_user)

def _list_items_impl(db: Session, skip: int = 0, limit: int = 20):
    """Helper function for list_items"""
    try:
        return food_item.get_all_food_items(db, skip=skip, limit=limit)
    except Exception as e:
        import traceback
        error_detail = f"Failed to fetch food items: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR: {error_detail}")
        import sys
        sys.stderr.write(f"ERROR in food-items: {error_detail}\n")
        # Return empty list to prevent frontend breakage
        return []

@router.get("")
def list_items(db: Session = Depends(get_db), skip: int = 0, limit: int = 20):
    return _list_items_impl(db, skip, limit)

@router.get("/")  # Handle trailing slash
def list_items_slash(db: Session = Depends(get_db), skip: int = 0, limit: int = 20):
    return _list_items_impl(db, skip, limit)

@router.delete("/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return food_item.delete_food_item(db, item_id)

@router.patch("/{item_id}/toggle-availability")
def toggle_availability(item_id: int, available: bool, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return food_item.update_food_item_availability(db, item_id, available)

def _update_item_impl(
    item_id: int,
    name: str,
    description: str,
    price: float,
    available: bool,
    category_id: int,
    images: list[UploadFile],
    db: Session,
    current_user: User
):
    """Helper function for update_item"""
    image_paths = None
    # Check if images were provided and not empty
    if images is not None and len(images) > 0:
        # Filter out empty files (browsers sometimes send empty file inputs)
        valid_images = [img for img in images if img.filename and img.filename.strip()]
        if valid_images:
            image_paths = []
            for image in valid_images:
                # Generate unique filename
                filename = f"food_{uuid.uuid4().hex}_{image.filename}"
                path = os.path.join(UPLOAD_DIR, filename)
                with open(path, "wb") as buffer:
                    shutil.copyfileobj(image.file, buffer)
                # Store with leading slash for proper URL construction
                web_path = f"/{UPLOAD_DIR}/{filename}".replace("\\", "/")
                image_paths.append(web_path)
    
    item_update = FoodItemUpdate(
        name=name, description=description, price=price,
        available=available, category_id=category_id
    )
    return food_item.update_food_item(db, item_id, item_update, image_paths)

@router.put("/{item_id}")
async def update_item(
    item_id: int,
    name: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    available: bool = Form(...),
    category_id: int = Form(...),
    images: list[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    images_list = images if images else []
    return _update_item_impl(item_id, name, description, price, available, category_id, images_list, db, current_user)

@router.put("/{item_id}/")  # Handle trailing slash
async def update_item_slash(
    item_id: int,
    name: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    available: bool = Form(...),
    category_id: int = Form(...),
    images: list[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    images_list = images if images else []
    return _update_item_impl(item_id, name, description, price, available, category_id, images_list, db, current_user)
