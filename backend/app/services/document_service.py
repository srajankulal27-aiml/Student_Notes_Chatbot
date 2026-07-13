import os
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from fastapi import UploadFile, HTTPException, status

from app.models.user import User
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.models.chat_session import ChatSession, ChatSessionCollaborator
from app.services.pdf_service import extract_text
from app.services.chunk_service import chunk_text
from app.services.embedding_service import generate_embeddings
from app.services.qdrant_service import upload_to_qdrant, delete_from_qdrant
from app.services.s3_service import upload_file_to_s3, delete_file_from_s3
from app.services.groq_service import generate_summary


def process_document_upload(file: UploadFile, db: Session, current_user: User) -> Document:
    """
    Why it is written:
        To encapsulate the complete business logic pipeline for a PDF document upload, including
        AWS S3 binary storage, text extraction, LangChain-based chunking, FastEmbed vector generation,
        Qdrant database upsert, and RAG AI summary creation.

    What it does:
        1. Verifies that the file has a .pdf extension.
        2. Uploads the raw PDF file to AWS S3.
        3. Saves an initial Document record in the PostgreSQL database containing the S3 URL.
        4. Extracts text from the document URL.
        5. Splits the text into chunks using LangChain text splitters.
        6. If chunks are found:
           - Generates vector embeddings for each chunk via FastEmbed.
           - Uploads vectors and payloads to Qdrant Cloud.
           - Saves the text chunks as DocumentChunk records in PostgreSQL.
        7. Calls RAG AI to generate a structured study summary of the document and saves it.
        8. Commits all database transactions and returns the Document record.

    Inputs:
        file: UploadFile - The uploaded file object sent from the API endpoint.
        db: Session - The SQLAlchemy database session.
        current_user: User - The current authenticated user.

    Outputs:
        Document - The fully processed Document model object populated with S3 URL and summary.
    """
    # 1. Verify extension
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed"
        )

    # Read the file bytes
    file.file.seek(0)
    file_bytes = file.file.read()
    file.file.seek(0)

    # 2. Upload file to AWS S3, fallback to DB storage
    filepath = None
    pdf_data_to_store = None
    try:
        filepath = upload_file_to_s3(file)
    except ValueError:
        # Fallback if S3 is not configured
        filepath = f"db://{file.filename}"
        pdf_data_to_store = file_bytes

    # 3. Create database document metadata record
    new_doc = Document(
        filename=file.filename,
        filepath=filepath,
        pdf_data=pdf_data_to_store,
        user_id=current_user.id
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    try:
        # 4. Extract text from the S3 URL or raw bytes
        text = extract_text(file_bytes if pdf_data_to_store else filepath)
        if not text.strip():
            text = "No readable text found in PDF."

        # 5. Chunk the text using LangChain splitter
        chunks = chunk_text(text)
        
        if chunks:
            # 6a. Generate embeddings using FastEmbed
            embeddings = generate_embeddings(chunks)

            # 6b. Upload vector representations to Qdrant Cloud
            upload_to_qdrant(
                document_id=new_doc.id,
                chunks=chunks,
                embeddings=embeddings
            )

            # 6c. Save chunks into relational DB (PostgreSQL) for direct textual lookup
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

        # 7. Generate a comprehensive summary using RAG AI (Groq)
        summary = generate_summary(text)
        new_doc.summary = summary
        db.commit()
        db.refresh(new_doc)

    except Exception as e:
        # Transaction rollback & S3 file cleanup if any stage fails
        db.delete(new_doc)
        db.commit()
        try:
            delete_file_from_s3(filepath)
        except Exception as s3_err:
            print(f"Failed to delete S3 file during transaction rollback: {s3_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process PDF: {str(e)}"
        )

    return new_doc


def list_user_documents(db: Session, current_user: User) -> list[Document]:
    """
    Why it is written:
        To fetch all documents the current user has access to, including both documents they
        personally uploaded and documents shared with them by other collaborators.

    What it does:
        Queries PostgreSQL to retrieve documents where the owner is the current user. Also performs
        a join query to retrieve documents where the user is listed as a collaborator on any related
        chat sessions. Uniquifies the union, sorts it by creation date descending, and returns the list.

    Inputs:
        db: Session - The database session.
        current_user: User - The active user requesting the document list.

    Outputs:
        list[Document] - A sorted list of unique Document objects.
    """
    # Query owned documents
    owned = db.query(Document).filter(
        Document.user_id == current_user.id
    ).all()
    
    # Query collaborative documents via chat session collaborations
    shared = db.query(Document).join(ChatSession).join(
        ChatSessionCollaborator, ChatSessionCollaborator.session_id == ChatSession.id
    ).filter(
        ChatSessionCollaborator.user_id == current_user.id
    ).all()
    
    # Uniquify and sort
    combined = list({doc.id: doc for doc in (owned + shared)}.values())
    combined.sort(key=lambda d: d.uploaded_at, reverse=True)
    return combined


def get_document_by_id(document_id: int, db: Session, current_user: User) -> Document:
    """
    Why it is written:
        To safely load a specific document's metadata after performing security and access control checks.

    What it does:
        Queries the database for the given document_id. If not found, raises a 404 error. Checks
        whether the current user is the owner or a collaborative participant. If not, raises a 403 error.
        If authorized, returns the document record.

    Inputs:
        document_id: int - The database ID of the requested document.
        db: Session - The database session.
        current_user: User - The active user making the request.

    Outputs:
        Document - The verified Document object.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

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


def delete_user_document(document_id: int, db: Session, current_user: User) -> dict:
    """
    Why it is written:
        To delete a document completely, cleaning up resources in relational storage
        and Qdrant Cloud vector indexes.

    What it does:
        Checks that the document exists and belongs to the current user (only owners can delete).
        Removes vector structures from Qdrant.
        Deletes the database row (cascading constraints delete PostgreSQL chunk records).

    Inputs:
        document_id: int - The identifier of the document to delete.
        db: Session - The database session.
        current_user: User - The active user attempting the deletion.

    Outputs:
        dict - A confirmation message.
    """
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied"
        )

    # 1. Clean up S3 storage file
    delete_file_from_s3(doc.filepath)

    # 2. Clean up Qdrant vector database indexes
    delete_from_qdrant(document_id)

    # 3. Delete Document record in PostgreSQL (cascading deletes automatic chunk/message relations)
    db.delete(doc)
    db.commit()

    return {"message": "Document and all vector indexes deleted successfully."}


def search_document_keywords(document_id: int, query: str, db: Session, current_user: User) -> list[dict]:
    """
    Why it is written:
        To perform traditional database keyword substring matching (ILIKE) on document chunks.

    What it does:
        Validates document access. Queries the PostgreSQL Database to find all chunks matching
        the search term in the target document. Formats and returns them.

    Inputs:
        document_id: int - The document ID to search within.
        query: str - The keyword to search for.
        db: Session - The database session.
        current_user: User - The active user making the request.

    Outputs:
        list[dict] - List of matching chunk details.
    """
    # Validate document access first
    get_document_by_id(document_id, db, current_user)

    if not query.strip():
        return []

    # Perform SQL case-insensitive search
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
