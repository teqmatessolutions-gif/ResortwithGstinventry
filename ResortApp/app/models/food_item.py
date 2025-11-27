from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(String)
    price = Column(Integer)
    available = Column(String)
    category_id = Column(Integer, ForeignKey("food_categories.id"))

    images = relationship("FoodItemImage", back_populates="food_item", cascade="all, delete-orphan")
    category = relationship("FoodCategory", lazy="joined")


class FoodItemImage(Base):
    __tablename__ = "food_item_images"

    id = Column(Integer, primary_key=True, index=True)
    image_url = Column(String)
    item_id = Column(Integer, ForeignKey("food_items.id"))

    food_item = relationship("FoodItem", back_populates="images")