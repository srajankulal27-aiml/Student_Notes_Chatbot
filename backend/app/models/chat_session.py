# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship
# pyrefly: ignore [missing-import]
from sqlalchemy.sql import func

from app.database import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    share_code = Column(String(100), unique=True, index=True, nullable=True)

    document = relationship("Document", back_populates="sessions")
    user = relationship("User")
    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan"
    )
    collaborators = relationship(
        "ChatSessionCollaborator",
        back_populates="session",
        cascade="all, delete-orphan"
    )


class ChatSessionCollaborator(Base):
    __tablename__ = "chat_session_collaborators"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer,
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    joined_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    session = relationship("ChatSession", back_populates="collaborators")
    user = relationship("User")
