from sqlalchemy.orm import Session
from app.models.food_category import FoodCategory
from app.schemas.food_category import FoodCategoryCreate

def create_category(db: Session, category: FoodCategoryCreate):
    new_cat = FoodCategory(name=category.name)
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat

def get_categories(db: Session, skip: int = 0, limit: int = 100):
    return db.query(FoodCategory).offset(skip).limit(limit).all()

def delete_category(db: Session, cat_id: int):
    cat = db.query(FoodCategory).get(cat_id)
    if cat:
        db.delete(cat)
        db.commit()
    return cat

def update_category(db: Session, cat_id: int, name: str):
    cat = db.query(FoodCategory).get(cat_id)
    if cat:
        cat.name = name
        db.commit()
        db.refresh(cat)
    return cat
