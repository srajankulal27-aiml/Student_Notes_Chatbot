from typing import List
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, UploadFile, File, Depends, status, Response, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.document import DocumentResponse
from app.services import document_service

router = APIRouter(
    prefix="/documents",
    tags=["Documents"]
)


@router.post("/upload", response_model=DocumentResponse)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint for users to upload lecture notes PDFs.

    What it does:
        Delegates the PDF parsing, S3 storage, LangChain chunking, FastEmbed vector generation,
        and Qdrant indexing to the document_service.

    Inputs:
        file: UploadFile - The uploaded PDF file.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        DocumentResponse - Metadata of the created document.
    """
    return document_service.process_document_upload(file, db, current_user)


@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint that lists all documents a user owns or collaborates on.

    What it does:
        Delegates database querying for user-accessible documents to the document_service.

    Inputs:
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        List[DocumentResponse] - Accessible documents metadata list.
    """
    return document_service.list_user_documents(db, current_user)


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint to fetch a single document's metadata by ID.

    What it does:
        Delegates retrieval and permission checking of a single document to the document_service.

    Inputs:
        document_id: int - The identifier of the document.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        DocumentResponse - The requested document metadata.
    """
    return document_service.get_document_by_id(document_id, db, current_user)


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint to delete an uploaded document.

    What it does:
        Delegates document deletion (PostgreSQL, S3, Qdrant) to the document_service.

    Inputs:
        document_id: int - The identifier of the document.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        dict - A JSON confirmation response.
    """
    return document_service.delete_user_document(document_id, db, current_user)


@router.get("/{document_id}/search")
def keyword_search(
    document_id: int,
    query: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint to run a traditional substring keyword query in document chunks.

    What it does:
        Delegates substring SQL matching to the document_service.

    Inputs:
        document_id: int - The identifier of the document.
        query: str - The query term.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        List[dict] - The list of matching text chunks.
    """
    return document_service.search_document_keywords(document_id, query, db, current_user)


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Why it is written:
        To provide an API endpoint to download the original PDF file stored inside AWS S3 or the database.

    What it does:
        Fetches the document by ID, validates the user's access permissions.
        If the file is stored in S3 (i.e. filepath is an HTTP/S URL), returns a RedirectResponse
        to download it directly from S3. Otherwise, falls back to serving the binary data from the DB.

    Inputs:
        document_id: int - The identifier of the document.
        db: Session - Database session.
        current_user: User - Authenticated user.

    Outputs:
        Response - A redirect to the S3 URL or the binary PDF file content.
    """
    doc = document_service.get_document_by_id(document_id, db, current_user)
    
    if doc.filepath.startswith("http://") or doc.filepath.startswith("https://"):
        return RedirectResponse(url=doc.filepath)
        
    if not doc.pdf_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF data not found for this document"
        )
        
    return Response(
        content=doc.pdf_data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{doc.filename}"'
        }
    )