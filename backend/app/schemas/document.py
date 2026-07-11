from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class DocumentResponse(BaseModel):

    id: int
    filename: str
    filepath: str
    summary: Optional[str] = None
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)