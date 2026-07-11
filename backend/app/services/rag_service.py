# pyrefly: ignore [missing-import]
from app.services.embedding_service import generate_embeddings
from app.services.qdrant_service import search_qdrant


def search_documents(document_id: int, question: str, top_k: int = 3) -> str:
    """
    Why it is written:
        To extract the most semantically relevant text chunks from Qdrant Cloud matching
        the user's question, which serves as context for the RAG prompt.

    What it does:
        1. Embeds the user's question into a vector using FastEmbed.
        2. Searches Qdrant Cloud for matching vectors restricted to the document_id filter.
        3. Extracts the matching chunk texts and joins them.

    Inputs:
        document_id: int - The identifier of the active document.
        question: str - The user's query/question text.
        top_k: int - Number of semantic matches to fetch (default is 3).

    Outputs:
        str - Concatented text of matching chunks to be used as prompt context.
    """
    # 1. Generate query embedding vector using FastEmbed
    question_vectors = generate_embeddings([question])
    if not question_vectors:
        return ""
    
    # FastEmbed returns a list of embeddings. Get the first one since we passed a single question list.
    question_embedding = question_vectors[0]
    
    # 2. Query Qdrant Cloud using similarity search
    # Convert query embedding vector to standard list format if required
    vector_list = question_embedding.tolist() if hasattr(question_embedding, "tolist") else list(question_embedding)
    
    hits = search_qdrant(
        document_id=document_id,
        query_vector=vector_list,
        top_k=top_k
    )
    
    # 3. Concatenate and return matched text chunks
    results = [hit["content"] for hit in hits]
    return "\n\n".join(results)