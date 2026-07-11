from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class ChatSessionCreate(BaseModel):
    document_id: int
    title: Optional[str] = None


class ChatSessionResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    document_id: int
    user_id: int
    share_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ChatRequest(BaseModel):
    question: str
    session_id: int


class ChatResponse(BaseModel):
    answer: str


class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)