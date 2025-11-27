from pydantic import BaseModel

class RoomBase(BaseModel):
    number: str
    type: str
    price: float
    adults: int = 2      # new field
    children: int = 0    # new field
    # Room features/amenities
    air_conditioning: bool = False
    wifi: bool = False
    bathroom: bool = False
    living_area: bool = False
    terrace: bool = False
    parking: bool = False
    kitchen: bool = False
    family_room: bool = False
    bbq: bool = False
    garden: bool = False
    dining: bool = False
    breakfast: bool = False

class RoomCreate(RoomBase):
    pass

class RoomOut(RoomBase):
    id: int
    status: str
    image_url: str | None = None

    model_config = {
        "from_attributes": True  # enables from_orm in Pydantic v2
    }
