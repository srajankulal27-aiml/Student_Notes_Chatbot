from typing import List
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionResponse,
    RenameSessionRequest
)
from app.services import chat_service

router = APIRouter(
    prefix="/chat",
    tags=["Chatbot"]
)


@router.post("/session", response_model=ChatSessionResponse)
def create_session(
    request: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint for creating a new chat session linked to a document.

    What it does:
        Delegates validation of document access and creation of the chat session to the chat_service.

    Inputs:
        request: ChatSessionCreate - Schema containing the document_id and optional custom title.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        ChatSessionResponse - Details of the newly created chat session.
    """
    return chat_service.create_chat_session(request, db, current_user)


@router.put("/session/{session_id}", response_model=ChatSessionResponse)
def rename_session(
    session_id: int,
    request: RenameSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint to change the display title of a chat session.

    What it does:
        Delegates permission checks and updating of the session title to the chat_service.

    Inputs:
        session_id: int - The identifier of the chat session to rename.
        request: RenameSessionRequest - Schema containing the new title.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        ChatSessionResponse - The updated chat session details.
    """
    return chat_service.rename_chat_session(session_id, request, db, current_user)


@router.get("/sessions/{document_id}", response_model=List[ChatSessionResponse])
def get_sessions(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint listing all chat sessions a user has access to for a document.

    What it does:
        Delegates retrieval of owned/collaborative sessions to the chat_service.

    Inputs:
        document_id: int - The document identifier.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        List[ChatSessionResponse] - The list of chat sessions.
    """
    return chat_service.list_chat_sessions(document_id, db, current_user)


@router.delete("/session/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint to delete an existing chat session.

    What it does:
        Delegates chat session deletion ownership checks and db removals to the chat_service.

    Inputs:
        session_id: int - The identifier of the session.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        dict - A JSON confirmation message.
    """
    return chat_service.delete_chat_session(session_id, db, current_user)


@router.post("/session/{session_id}/share", response_model=ChatSessionResponse)
def share_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint that generates a unique sharing key for a chat session.

    What it does:
        Delegates the sharing code initialization to the chat_service.

    Inputs:
        session_id: int - The identifier of the session.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        ChatSessionResponse - Chat session details, including the generated share code.
    """
    return chat_service.generate_share_code(session_id, db, current_user)


@router.get("/session/share/{share_code}", response_model=ChatSessionResponse)
def get_shared_session_details(
    share_code: str,
    db: Session = Depends(get_db)
):
    """
    Why it is written:
        To provide an API endpoint to fetch session details from a public share link.

    What it does:
        Delegates public share link lookups to the chat_service.

    Inputs:
        share_code: str - The shared identifier UUID.
        db: Session - Database session.

    Outputs:
        ChatSessionResponse - Details of the shared session.
    """
    return chat_service.get_shared_session_details(share_code, db)


@router.post("/session/join/{share_code}")
def join_shared_session(
    share_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint enabling users to join shared collaborative chat sessions.

    What it does:
        Delegates registration of a new collaborator in the session to the chat_service.

    Inputs:
        share_code: str - The shared identifier UUID.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        dict - Success message and the session_id.
    """
    return chat_service.join_shared_session(share_code, db, current_user)


@router.post("/ask", response_model=ChatResponse)
def ask_question(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint for running a RAG query and getting chatbot answers.

    What it does:
        Delegates vector search, RAG AI generation, and database log saving to the chat_service.

    Inputs:
        request: ChatRequest - Schema containing session_id and user question text.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        ChatResponse - The generated text answer.
    """
    return chat_service.ask_chatbot_question(request, db, current_user)


@router.get("/history/{session_id}", response_model=List[ChatMessageResponse])
def get_chat_history(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint to retrieve all chat history messages in a session.

    What it does:
        Delegates verification and sorting of past messages to the chat_service.

    Inputs:
        session_id: int - The session identifier.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        List[ChatMessageResponse] - A list of past chat messages in the session.
    """
    return chat_service.get_chat_history(session_id, db, current_user)


@router.delete("/history/{session_id}")
def clear_chat_history(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint to clear the message log inside a session.

    What it does:
        Delegates history deletion permissions and row cleanups to the chat_service.

    Inputs:
        session_id: int - The session identifier.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        dict - A JSON confirmation message.
    """
    return chat_service.clear_chat_history(session_id, db, current_user)