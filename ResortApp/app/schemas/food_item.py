from pydantic import BaseModel
from typing import List, Optional

from .food_category import FoodCategoryOut

class FoodItemImageOut(BaseModel):
    id: int
    image_url: str

    class Config:
        from_attributes = True

class FoodItemCreate(BaseModel):
    name: str
    description: str
    price: float
    available: bool
    category_id: int

class FoodItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    available: Optional[bool] = None
    category_id: Optional[int] = None

class FoodItemOut(BaseModel):
    id: int
    name: str
    description: str
    price: float
    available: bool
    category_id: int
    images: List[FoodItemImageOut] = []
    category: Optional[FoodCategoryOut] = None

    class Config:
        from_attributes = True
