import uuid
from sqlalchemy.orm import Session
from sqlalchemy import or_
# pyrefly: ignore [missing-import]
from fastapi import HTTPException, status

from app.models.user import User
from app.models.document import Document
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession, ChatSessionCollaborator
from app.services.rag_service import search_documents
from app.services.groq_service import generate_answer
from app.schemas.chat import ChatSessionCreate, RenameSessionRequest, ChatRequest


def create_chat_session(request: ChatSessionCreate, db: Session, current_user: User) -> ChatSession:
    """
    Why it is written:
        To encapsulate the creation of a new ChatSession database record after performing
        necessary document existence and access authorization checks.

    What it does:
        1. Queries PostgreSQL for the target document.
        2. Raises 404 if the document does not exist.
        3. Raises 403 if the user is neither the owner nor a registered collaborator.
        4. Saves the ChatSession record with a custom title or auto-generated title.
        5. Returns the session object.

    Inputs:
        request: ChatSessionCreate - The request schema details containing document_id and title.
        db: Session - The active SQLAlchemy database session.
        current_user: User - The active user making the request.

    Outputs:
        ChatSession - The created session database object.
    """
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


def rename_chat_session(session_id: int, request: RenameSessionRequest, db: Session, current_user: User) -> ChatSession:
    """
    Why it is written:
        To modify a chat session's title after verifying that the requesting user is authorized.

    What it does:
        Fetches the session record by ID, checks access authorization (owner or collaborator),
        validates that the new title is not blank, updates the title, commits, and returns the record.

    Inputs:
        session_id: int - The identifier of the chat session to rename.
        request: RenameSessionRequest - The schema containing the new title.
        db: Session - The active SQLAlchemy database session.
        current_user: User - The active user making the request.

    Outputs:
        ChatSession - The updated chat session database object.
    """
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

    new_title = request.title.strip()
    if not new_title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title cannot be empty"
        )

    session.title = new_title
    db.commit()
    db.refresh(session)
    return session


def list_chat_sessions(document_id: int, db: Session, current_user: User) -> list[ChatSession]:
    """
    Why it is written:
        To fetch all chat sessions associated with a specific document that are accessible
        to the user.

    What it does:
        Queries for sessions of a specific document_id where the creator is the current user OR
        the user has joined as a collaborator. Returns them sorted by creation date descending.

    Inputs:
        document_id: int - The document ID to filter chat sessions for.
        db: Session - The active database session.
        current_user: User - The active user.

    Outputs:
        list[ChatSession] - List of filtered chat sessions.
    """
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


def delete_chat_session(session_id: int, db: Session, current_user: User) -> dict:
    """
    Why it is written:
        To securely remove a chat session record and its related database history.

    What it does:
        Validates that the session belongs to the current user (only the creator can delete sessions).
        Deletes the session record and returns a success dictionary message.

    Inputs:
        session_id: int - The ID of the session to delete.
        db: Session - The database session.
        current_user: User - The active user.

    Outputs:
        dict - A confirmation message.
    """
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


def generate_share_code(session_id: int, db: Session, current_user: User) -> ChatSession:
    """
    Why it is written:
        To create a unique UUID-based share link key so other collaborative users can join the session.

    What it does:
        Validates access permissions, generates a random UUID, saves it in the `share_code` field,
        and returns the session.

    Inputs:
        session_id: int - The ID of the session to share.
        db: Session - The database session.
        current_user: User - The active user.

    Outputs:
        ChatSession - The updated session record.
    """
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

    if not session.share_code:
        session.share_code = str(uuid.uuid4())
        db.commit()
        db.refresh(session)

    return session


def get_shared_session_details(share_code: str, db: Session) -> ChatSession:
    """
    Why it is written:
        To load details of a chat session when a user clicks a shared link.

    What it does:
        Queries the database for a session matching the given share code. Returns it,
        or raises 404 if invalid.

    Inputs:
        share_code: str - The shared session identifier string.
        db: Session - The database session.

    Outputs:
        ChatSession - The matching session record.
    """
    session = db.query(ChatSession).filter(
        ChatSession.share_code == share_code
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared chat session not found"
        )

    return session


def join_shared_session(share_code: str, db: Session, current_user: User) -> dict:
    """
    Why it is written:
        To register the current user as a collaborator in a shared session.

    What it does:
        Checks if the session exists. If the user is the owner, returns immediately.
        Otherwise, inserts a ChatSessionCollaborator record to link the user to the session,
        allowing them to view history and chat.

    Inputs:
        share_code: str - The share key.
        db: Session - The database session.
        current_user: User - The active user.

    Outputs:
        dict - A confirmation message and the session ID.
    """
    session = db.query(ChatSession).filter(
        ChatSession.share_code == share_code
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared chat session not found"
        )

    if session.user_id == current_user.id:
        return {"message": "Already joined as owner", "session_id": session.id}

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


def ask_chatbot_question(request: ChatRequest, db: Session, current_user: User) -> dict:
    """
    Why it is written:
        To execute the core RAG question-answering workflow, combining vector lookup and LLM generation.

    What it does:
        1. Validates session access.
        2. Calls search_documents to fetch the top matching text chunks from Qdrant Cloud.
        3. Queries the RAG AI service (via Groq) with the gathered context and question.
        4. Stores the user's question and assistant's response in PostgreSQL chat history.
        5. Returns the generated response string.

    Inputs:
        request: ChatRequest - The question and session_id.
        db: Session - The database session.
        current_user: User - The active user.

    Outputs:
        dict - Contains the chatbot's generated answer string.
    """
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

    # 1. Retrieve matching chunks from Qdrant Cloud
    context = search_documents(
        document_id=session.document_id,
        question=request.question
    )

    # 2. Retrieve last 10 chat messages in this session for conversational memory
    history_records = db.query(ChatMessage).filter(
        ChatMessage.session_id == session.id
    ).order_by(ChatMessage.timestamp.asc()).all()

    history = [
        {"role": msg.role, "content": msg.content}
        for msg in history_records
    ]

    # 3. Query LLM (Groq) with retrieved context and history
    filename = session.document.filename if session.document else "Notes"
    answer = generate_answer(
        context=context,
        question=request.question,
        history=history,
        filename=filename
    )

    # 4. Store conversation in database logs
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

    return {"answer": answer}


def get_chat_history(session_id: int, db: Session, current_user: User) -> list[ChatMessage]:
    """
    Why it is written:
        To fetch all past conversation messages inside a specific session for rendering in the UI.

    What it does:
        Verifies session access permissions. Fetches all messages belonging to the session_id
        from PostgreSQL sorted by timestamp ascending, and returns them.

    Inputs:
        session_id: int - The identifier of the chat session.
        db: Session - The database session.
        current_user: User - The active user requesting the history.

    Outputs:
        list[ChatMessage] - Sorted list of conversation message records.
    """
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

    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.timestamp.asc()).all()

    return messages


def clear_chat_history(session_id: int, db: Session, current_user: User) -> dict:
    """
    Why it is written:
        To wipe conversation logs inside a session, starting a fresh conversation.

    What it does:
        Validates that the user is the chat session creator. Deletes all ChatMessage records
        linked to the session.

    Inputs:
        session_id: int - The ID of the session.
        db: Session - The database session.
        current_user: User - The active user.

    Outputs:
        dict - A confirmation message.
    """
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

    db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).delete(synchronize_session=False)

    db.commit()
    return {"message": "Chat history cleared successfully."}
