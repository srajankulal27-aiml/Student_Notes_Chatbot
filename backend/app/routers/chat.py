from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.chat_message import ChatMessage
from app.schemas.chat import ChatRequest, ChatResponse, ChatMessageResponse
from app.services.rag_service import search_documents
from app.services.gemini_service import generate_answer

router = APIRouter(
    prefix="/chat",
    tags=["Chatbot"]
)


# -----------------------------
# Ask Chatbot (RAG)
# -----------------------------
@router.post("/ask", response_model=ChatResponse)
def ask_question(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify document ownership and existence
    doc = db.query(Document).filter(
        Document.id == request.document_id,
        Document.user_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied"
        )

    # 1. Retrieve relevant chunks using FAISS
    context = search_documents(
        document_id=request.document_id,
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
        document_id=request.document_id,
        role="user",
        content=request.question
    )
    assistant_msg = ChatMessage(
        user_id=current_user.id,
        document_id=request.document_id,
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
@router.get("/history/{document_id}", response_model=List[ChatMessageResponse])
def get_chat_history(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify document ownership
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied"
        )

    # Fetch ordered chat history
    messages = db.query(ChatMessage).filter(
        ChatMessage.document_id == document_id,
        ChatMessage.user_id == current_user.id
    ).order_by(ChatMessage.timestamp.asc()).all()

    return messages


# -----------------------------
# Clear Chat History
# -----------------------------
@router.delete("/history/{document_id}")
def clear_chat_history(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify document ownership
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied"
        )

    # Delete history
    db.query(ChatMessage).filter(
        ChatMessage.document_id == document_id,
        ChatMessage.user_id == current_user.id
    ).delete(synchronize_session=False)

    db.commit()

    return {
        "message": "Chat history cleared successfully."
    }