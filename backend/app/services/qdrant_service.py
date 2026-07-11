# pyrefly: ignore [missing-import]
import uuid
import os
# pyrefly: ignore [missing-import]
from qdrant_client import QdrantClient
# pyrefly: ignore [missing-import]
from qdrant_client.http import models
# pyrefly: ignore [missing-import]
from qdrant_client.http.models import PointStruct

# -----------------------------
# Configuration & Client Initialization
# -----------------------------
# Retrieve Qdrant Cloud connection details from environment variables.
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

# If URL is HTTPS and does not specify a port, use standard HTTPS port 443
port = None
if QDRANT_URL and QDRANT_URL.startswith("https://") and not ":" in QDRANT_URL.replace("https://", ""):
    port = 443

client = QdrantClient(
    url=QDRANT_URL,
    port=port,
    api_key=QDRANT_API_KEY,
)

COLLECTION_NAME = "student_notes"


def ensure_collection_exists() -> None:
    """
    Why it is written:
        To guarantee that the target Qdrant collection is created and properly configured with
        vector settings before any upload or search operations take place.

    What it does:
        Checks if the collection 'student_notes' already exists. If not, creates the collection
        with a vector size of 384 (matching the dimensions of the FastEmbed 'bge-small-en-v1.5' model)
        and COSINE distance metric.

    Inputs:
        None

    Outputs:
        None
    """
    try:
        # Check if the collection exists
        client.get_collection(COLLECTION_NAME)
        print(f"Qdrant collection '{COLLECTION_NAME}' already exists.")
    except Exception as e:
        try:
            # If it doesn't exist, create it with 384 dimensions for FastEmbed vectors
            print(f"Creating Qdrant collection '{COLLECTION_NAME}'...")
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=384,
                    distance=models.Distance.COSINE
                )
            )
            print(f"Collection '{COLLECTION_NAME}' created successfully.")
            try:
                print(f"Creating document_id index on collection '{COLLECTION_NAME}'...")
                client.create_payload_index(
                    collection_name=COLLECTION_NAME,
                    field_name="document_id",
                    field_schema=models.PayloadSchemaType.INTEGER
                )
                print("document_id index created successfully.")
            except Exception as index_err:
                print(f"Failed to create document_id index: {index_err}")
        except Exception as create_err:
            print(f"Failed to check/create Qdrant collection '{COLLECTION_NAME}': {create_err}")



def upload_to_qdrant(document_id: int, chunks: list[str], embeddings) -> None:
    """
    Why it is written:
        To store generated text chunk vectors and metadata inside Qdrant Cloud for RAG operations.

    What it does:
        Formats document chunks and vector embeddings into Qdrant PointStructs. Generates deterministic
        UUIDs based on the document_id and chunk index to avoid inserting duplicate points.
        Then, upserts these points into the Qdrant database.

    Inputs:
        document_id: int - The identifier of the document.
        chunks: list[str] - The list of text chunks.
        embeddings - A numpy matrix or list of vectors representing the embeddings of the chunks.

    Outputs:
        None
    """
    ensure_collection_exists()
    
    points = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        # Generate a deterministic UUID for each chunk using UUIDv5
        point_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"doc_{document_id}_chunk_{i}"))
        
        # Convert numpy array to list if needed
        vector_data = embedding.tolist() if hasattr(embedding, "tolist") else list(embedding)
        
        points.append(
            PointStruct(
                id=point_uuid,
                vector=vector_data,
                payload={
                    "document_id": document_id,
                    "chunk_index": i,
                    "content": chunk
                }
            )
        )
        
    try:
        # Upsert the vectors into Qdrant Cloud
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=points
        )
        print(f"Successfully uploaded {len(points)} vector points to Qdrant for document {document_id}.")
    except Exception as e:
        print(f"Error uploading vector points to Qdrant: {e}")


def search_qdrant(document_id: int, query_vector: list[float], top_k: int = 3) -> list[dict]:
    """
    Why it is written:
        To perform semantic vector search on Qdrant Cloud, limited to a specific document.

    What it does:
        Executes a vector search query against the Qdrant collection using the query vector.
        Filters the results so that only chunks belonging to the specified document_id are returned.
        Returns the top_k matching chunks with their payloads.

    Inputs:
        document_id: int - The identifier of the document to restrict the search to.
        query_vector: list[float] - The vector representation of the search query.
        top_k: int - The maximum number of results to return (default is 3).

    Outputs:
        list[dict] - A list of dictionaries representing matching points, including payload and score.
    """
    try:
        # Run search query with metadata filtering using query_points
        search_result = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchValue(value=document_id)
                    )
                ]
            ),
            limit=top_k
        )
        
        # Map output results
        hits = []
        for hit in search_result.points:
            hits.append({
                "id": hit.id,
                "score": hit.score,
                "content": hit.payload.get("content", ""),
                "chunk_index": hit.payload.get("chunk_index", 0)
            })
        return hits
    except Exception as e:
        print(f"Error searching Qdrant collection: {e}")
        return []


def delete_from_qdrant(document_id: int) -> None:
    """
    Why it is written:
        To delete all vector points associated with a specific document from Qdrant Cloud when
        the document is removed.

    What it does:
        Performs a conditional delete operation in Qdrant, deleting all points where the
        payload key 'document_id' matches the specified document_id.

    Inputs:
        document_id: int - The identifier of the document to clean up.

    Outputs:
        None
    """
    try:
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="document_id",
                            match=models.MatchValue(value=document_id)
                        )
                    ]
                )
            )
        )
        print(f"Successfully deleted Qdrant vectors for document {document_id}.")
    except Exception as e:
        print(f"Error deleting Qdrant vectors for document {document_id}: {e}")
