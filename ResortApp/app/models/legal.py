from sqlalchemy import Column, Integer, String, DateTime, func
from app.database import Base

class LegalDocument(Base):
    __tablename__ = "legal_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    document_type = Column(String, nullable=True)  # e.g., "GST", "License", "Permit"
    file_path = Column(String, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(String, nullable=True)
