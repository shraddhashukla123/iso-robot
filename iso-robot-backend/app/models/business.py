from sqlalchemy import Column, String, Text, JSON
from app.db.base_model import BaseModel


class Business(BaseModel):
    __tablename__ = "businesses"

    name = Column(String(200), nullable=False)
    industry = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    settings = Column(JSON, nullable=True, default={})
    contact_email = Column(String(255), nullable=True)
    logo_url = Column(String(500), nullable=True)
