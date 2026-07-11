import faiss
import numpy as np
import os
import pickle

FAISS_FOLDER = "faiss_indexes"

os.makedirs(FAISS_FOLDER, exist_ok=True)


def create_faiss_index(document_id: int, chunks: list[str], embeddings):

    dimension = embeddings.shape[1]

    index = faiss.IndexFlatL2(dimension)

    index.add(np.array(embeddings))

    index_path = os.path.join(
        FAISS_FOLDER,
        f"{document_id}.index"
    )

    metadata_path = os.path.join(
        FAISS_FOLDER,
        f"{document_id}.pkl"
    )

    faiss.write_index(index, index_path)

    with open(metadata_path, "wb") as f:
        pickle.dump(chunks, f)

    return index_path
