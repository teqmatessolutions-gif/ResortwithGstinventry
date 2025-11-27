from sqlalchemy import Column, Integer, String, Boolean, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

# Header & Banner
class HeaderBanner(Base):
    __tablename__ = "header_banner"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    subtitle = Column(Text)  # Changed from String(255) to Text to allow longer descriptions
    image_url = Column(String(255))
    is_active = Column(Boolean, default=True)


# Check Availability Form
class CheckAvailability(Base):
    __tablename__ = "check_availability"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(100))
    phone = Column(String(20))
    check_in = Column(Date)
    check_out = Column(Date)
    guests = Column(Integer)
    is_active = Column(Boolean, default=True)


# Gallery
class Gallery(Base):
    __tablename__ = "gallery"
    id = Column(Integer, primary_key=True, index=True)
    image_url = Column(String(255))
    caption = Column(String(255))
    is_active = Column(Boolean, default=True)


# Reviews
class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    comment = Column(Text)
    rating = Column(Integer)
    is_active = Column(Boolean, default=True)


# Resort Info & Social Media
class ResortInfo(Base):
    __tablename__ = "resort_info"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))
    address = Column(Text)
    facebook = Column(String(255))
    instagram = Column(String(255))
    twitter = Column(String(255))
    linkedin = Column(String(255))
    is_active = Column(Boolean, default=True)


# Signature Experiences
class SignatureExperience(Base):
    __tablename__ = "signature_experiences"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    description = Column(Text)
    image_url = Column(String(255))
    is_active = Column(Boolean, default=True)


# Plan Your Wedding
class PlanWedding(Base):
    __tablename__ = "plan_weddings"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    description = Column(Text)
    image_url = Column(String(255))
    is_active = Column(Boolean, default=True)


# Nearby Attractions
class NearbyAttraction(Base):
    __tablename__ = "nearby_attractions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    description = Column(Text)
    image_url = Column(String(255))
    is_active = Column(Boolean, default=True)
    map_link = Column(String(512), nullable=True)


# Nearby Attraction Banners
class NearbyAttractionBanner(Base):
    __tablename__ = "nearby_attraction_banners"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    subtitle = Column(Text)
    image_url = Column(String(255))
    is_active = Column(Boolean, default=True)
    map_link = Column(String(512), nullable=True)