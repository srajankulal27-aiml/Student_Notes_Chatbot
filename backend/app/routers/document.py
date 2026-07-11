import os
from typing import List
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.models.chat_session import ChatSession, ChatSessionCollaborator
from app.schemas.document import DocumentResponse
from app.services.pdf_service import save_pdf, extract_text
from app.services.embedding_service import generate_embeddings
from app.services.faiss_service import create_faiss_index
from app.services.chunk_service import chunk_text
from app.services.gemini_service import generate_summary

router = APIRouter(
    prefix="/documents",
    tags=["Documents"]
)


# -----------------------------
# Upload Document
# -----------------------------
@router.post("/upload", response_model=DocumentResponse)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check PDF extension
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed"
        )

    # Save PDF to disk
    filepath = save_pdf(file)

    # Create Database entry
    new_doc = Document(
        filename=file.filename,
        filepath=filepath,
        user_id=current_user.id
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    try:
        # Extract text
        text = extract_text(filepath)
        if not text.strip():
            # If text is empty, provide placeholder or warning
            text = "No readable text found in PDF."

        # Split into chunks
        chunks = chunk_text(text)
        if chunks:
            # Generate embeddings
            embeddings = generate_embeddings(chunks)

            # Build and save FAISS index
            create_faiss_index(
                document_id=new_doc.id,
                chunks=chunks,
                embeddings=embeddings
            )

            # Save chunks to PostgreSQL
            db_chunks = [
                DocumentChunk(
                    document_id=new_doc.id,
                    content=chunk,
                    chunk_index=i
                )
                for i, chunk in enumerate(chunks)
            ]
            db.add_all(db_chunks)
            db.commit()

        # Generate summary using Gemini service
        summary = generate_summary(text)
        new_doc.summary = summary
        db.commit()
        db.refresh(new_doc)

    except Exception as e:
        # Cleanup database if any failure occurs during processing
        db.delete(new_doc)
        db.commit()
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process PDF: {str(e)}"
        )

    return new_doc


# -----------------------------
# List Documents
# -----------------------------
@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Owned documents
    owned = db.query(Document).filter(
        Document.user_id == current_user.id
    ).all()
    
    # Collaborative documents (documents the user is a collaborator on via chat sessions)
    shared = db.query(Document).join(ChatSession).join(
        ChatSessionCollaborator, ChatSessionCollaborator.session_id == ChatSession.id
    ).filter(
        ChatSessionCollaborator.user_id == current_user.id
    ).all()
    
    # Merge lists uniquely
    combined = list({doc.id: doc for doc in (owned + shared)}.values())
    combined.sort(key=lambda d: d.uploaded_at, reverse=True)
    return combined


# -----------------------------
# Get Single Document Details
# -----------------------------
@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Check access permission
    is_owner = doc.user_id == current_user.id
    is_collaborator = db.query(ChatSessionCollaborator).join(ChatSession).filter(
        ChatSession.document_id == document_id,
        ChatSessionCollaborator.user_id == current_user.id
    ).first() is not None

    if not is_owner and not is_collaborator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this document"
        )

    return doc


# -----------------------------
# Delete Document
# -----------------------------
@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Delete PDF file from disk
    if os.path.exists(doc.filepath):
        try:
            os.remove(doc.filepath)
        except Exception as e:
            print(f"Error removing PDF file: {e}")

    # Delete FAISS files
    faiss_index_path = f"faiss_indexes/{document_id}.index"
    faiss_meta_path = f"faiss_indexes/{document_id}.pkl"
    if os.path.exists(faiss_index_path):
        try:
            os.remove(faiss_index_path)
        except Exception as e:
            print(f"Error removing FAISS index: {e}")
    if os.path.exists(faiss_meta_path):
        try:
            os.remove(faiss_meta_path)
        except Exception as e:
            print(f"Error removing FAISS metadata: {e}")

    db.delete(doc)
    db.commit()

    return {"message": "Document and all index records deleted successfully."}


# -----------------------------
# Keyword Search in Document Chunks
# -----------------------------
@router.get("/{document_id}/search")
def keyword_search(
    document_id: int,
    query: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Check access permission
    is_owner = doc.user_id == current_user.id
    is_collaborator = db.query(ChatSessionCollaborator).join(ChatSession).filter(
        ChatSession.document_id == document_id,
        ChatSessionCollaborator.user_id == current_user.id
    ).first() is not None

    if not is_owner and not is_collaborator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this document"
        )

    if not query.strip():
        return []

    # Simple ILIKE search in document chunks
    results = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id,
        DocumentChunk.content.ilike(f"%{query}%")
    ).order_by(DocumentChunk.chunk_index.asc()).all()

    return [
        {
            "id": r.id,
            "chunk_index": r.chunk_index,
            "content": r.content
        }
        for r in results
    ]