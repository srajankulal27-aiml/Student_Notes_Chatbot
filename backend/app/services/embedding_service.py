# pyrefly: ignore [missing-import]
from fastembed import TextEmbedding

# Initialize FastEmbed text embedding model.
# Using 'all-MiniLM-L6-v2' (384 dimensions) because it is extremely lightweight,
# helping to prevent Out of Memory (OOM) crashes on Render's 512MB free tier.
model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2", threads=1)


def generate_embeddings(chunks: list[str]) -> list:
    """
    Why it is written:
        To transform raw text chunks into numerical vector representations (embeddings)
        suitable for similarity search in the vector database.

    What it does:
        Invokes FastEmbed's embedding generator on the list of text chunks, converts the
        generator of numpy arrays into a standard list of vectors, and returns it.

    Inputs:
        chunks: list[str] - A list of text chunks to be embedded.

    Outputs:
        list - A list of vector embeddings (lists of floats/numpy arrays) representing the text chunks.
    """
    # model.embed returns a generator of numpy arrays
    embeddings_generator = model.embed(chunks)
    embeddings = list(embeddings_generator)
    return embeddings

