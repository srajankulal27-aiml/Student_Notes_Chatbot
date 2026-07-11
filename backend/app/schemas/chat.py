from pydantic import BaseModel, ConfigDict
from datetime import datetime


class ChatRequest(BaseModel):
    question: str
    document_id: int


class ChatResponse(BaseModel):
    answer: str


class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)