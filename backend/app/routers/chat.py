import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession, ChatSessionCollaborator
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionResponse
)
from app.services.rag_service import search_documents
from app.services.gemini_service import generate_answer

router = APIRouter(
    prefix="/chat",
    tags=["Chatbot"]
)


# -----------------------------
# Create Chat Session
# -----------------------------
@router.post("/session", response_model=ChatSessionResponse)
def create_session(
    request: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify document existence and access permissions
    doc = db.query(Document).filter(Document.id == request.document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    is_owner = doc.user_id == current_user.id
    is_collaborator = db.query(ChatSessionCollaborator).join(ChatSession).filter(
        ChatSession.document_id == request.document_id,
        ChatSessionCollaborator.user_id == current_user.id
    ).first() is not None

    if not is_owner and not is_collaborator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this document"
        )

    title = request.title or f"Chat on {doc.filename}"

    session = ChatSession(
        title=title,
        document_id=request.document_id,
        user_id=current_user.id
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# -----------------------------
# Rename Chat Session
# -----------------------------
from pydantic import BaseModel

class RenameSessionRequest(BaseModel):
    title: str

@router.put("/session/{session_id}", response_model=ChatSessionResponse)
def rename_session(
    session_id: int,
    request: RenameSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found"
        )

    is_owner = session.user_id == current_user.id
    is_collaborator = db.query(ChatSessionCollaborator).filter(
        ChatSessionCollaborator.session_id == session.id,
        ChatSessionCollaborator.user_id == current_user.id
    ).first() is not None

    if not is_owner and not is_collaborator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this chat session"
        )

    if not request.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title cannot be empty"
        )

    session.title = request.title.strip()
    db.commit()
    db.refresh(session)
    return session


# -----------------------------
# List Chat Sessions
# -----------------------------
@router.get("/sessions/{document_id}", response_model=List[ChatSessionResponse])
def get_sessions(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Retrieve sessions created by the user or collaborative sessions they've joined
    sessions = db.query(ChatSession).outerjoin(
        ChatSessionCollaborator, ChatSessionCollaborator.session_id == ChatSession.id
    ).filter(
        ChatSession.document_id == document_id,
        or_(
            ChatSession.user_id == current_user.id,
            ChatSessionCollaborator.user_id == current_user.id
        )
    ).distinct().order_by(ChatSession.created_at.desc()).all()

    return sessions


# -----------------------------
# Delete Chat Session
# -----------------------------
@router.delete("/session/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found or access denied"
        )

    db.delete(session)
    db.commit()
    return {"message": "Chat session deleted successfully."}


# -----------------------------
# Generate Share Code
# -----------------------------
@router.post("/session/{session_id}/share", response_model=ChatSessionResponse)
def share_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found"
        )

    # Check access permission
    is_owner = session.user_id == current_user.id
    is_collaborator = db.query(ChatSessionCollaborator).filter(
        ChatSessionCollaborator.session_id == session.id,
        ChatSessionCollaborator.user_id == current_user.id
    ).first() is not None

    if not is_owner and not is_collaborator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this chat session"
        )

    if not session.share_code:
        session.share_code = str(uuid.uuid4())
        db.commit()
        db.refresh(session)

    return session


# -----------------------------
# Get Shared Session Details
# -----------------------------
@router.get("/session/share/{share_code}", response_model=ChatSessionResponse)
def get_shared_session_details(
    share_code: str,
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(
        ChatSession.share_code == share_code
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared chat session not found"
        )

    return session


# -----------------------------
# Join Collaborative Session
# -----------------------------
@router.post("/session/join/{share_code}")
def join_shared_session(
    share_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(
        ChatSession.share_code == share_code
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared chat session not found"
        )

    # Owner doesn't need to join as collaborator
    if session.user_id == current_user.id:
        return {"message": "Already joined as owner", "session_id": session.id}

    # Check if already a collaborator
    existing = db.query(ChatSessionCollaborator).filter(
        ChatSessionCollaborator.session_id == session.id,
        ChatSessionCollaborator.user_id == current_user.id
    ).first()

    if not existing:
        collab = ChatSessionCollaborator(
            session_id=session.id,
            user_id=current_user.id
        )
        db.add(collab)
        db.commit()

    return {"message": "Successfully joined collaborative session", "session_id": session.id}


# -----------------------------
# Ask Chatbot (RAG)
# -----------------------------
@router.post("/ask", response_model=ChatResponse)
def ask_question(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify session access: either owner or collaborator
    session = db.query(ChatSession).filter(ChatSession.id == request.session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found"
        )

    is_owner = session.user_id == current_user.id
    is_collaborator = db.query(ChatSessionCollaborator).filter(
        ChatSessionCollaborator.session_id == session.id,
        ChatSessionCollaborator.user_id == current_user.id
    ).first() is not None

    if not is_owner and not is_collaborator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this chat session is denied"
        )

    # 1. Retrieve relevant chunks using FAISS
    context = search_documents(
        document_id=session.document_id,
        question=request.question
    )

    # 2. Query Gemini model using Retrieval-Augmented Generation context
    answer = generate_answer(
        context=context,
        question=request.question
    )

    # 3. Store conversation in database chat history
    user_msg = ChatMessage(
        user_id=current_user.id,
        document_id=session.document_id,
        session_id=session.id,
        role="user",
        content=request.question
    )
    assistant_msg = ChatMessage(
        user_id=current_user.id,
        document_id=session.document_id,
        session_id=session.id,
        role="assistant",
        content=answer
    )

    db.add(user_msg)
    db.add(assistant_msg)
    db.commit()

    return {
        "answer": answer
    }


# -----------------------------
# Get Chat History
# -----------------------------
@router.get("/history/{session_id}", response_model=List[ChatMessageResponse])
def get_chat_history(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found"
        )

    is_owner = session.user_id == current_user.id
    is_collaborator = db.query(ChatSessionCollaborator).filter(
        ChatSessionCollaborator.session_id == session.id,
        ChatSessionCollaborator.user_id == current_user.id
    ).first() is not None
    is_shared = session.share_code is not None

    if not is_owner and not is_collaborator and not is_shared:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this chat session is denied"
        )

    # Fetch ordered chat history
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.timestamp.asc()).all()

    return messages


# -----------------------------
# Clear Chat History
# -----------------------------
@router.delete("/history/{session_id}")
def clear_chat_history(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found"
        )

    if session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the chat owner can clear history"
        )

    # Delete history
    db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).delete(synchronize_session=False)

    db.commit()

    return {
        "message": "Chat history cleared successfully."
    }