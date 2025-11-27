# models/food_category.py
from sqlalchemy import Column, Integer, String
from app.database import Base

class FoodCategory(Base):
    __tablename__ = "food_categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    image = Column(String, nullable=True)  # Path to category image
