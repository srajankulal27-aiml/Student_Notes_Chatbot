import os
import pickle
import faiss

from app.services.embedding_service import model

FAISS_FOLDER = "faiss_indexes"


def search_documents(document_id: int, question: str, top_k: int = 3):

    index_path = os.path.join(
        FAISS_FOLDER,
        f"{document_id}.index"
    )

    metadata_path = os.path.join(
        FAISS_FOLDER,
        f"{document_id}.pkl"
    )

    if not os.path.exists(index_path) or not os.path.exists(metadata_path):
        return ""

    index = faiss.read_index(index_path)

    with open(metadata_path, "rb") as f:
        chunks = pickle.load(f)

    question_embedding = model.encode(
        [question],
        convert_to_numpy=True
    )

    distances, indices = index.search(
        question_embedding,
        top_k
    )

    results = []

    for idx in indices[0]:
        if idx < len(chunks):
            results.append(chunks[idx])

    return "\n\n".join(results)