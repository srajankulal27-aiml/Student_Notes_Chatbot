# pyrefly: ignore [missing-import]
from fastembed import TextEmbedding

# Initialize FastEmbed text embedding model.
# By default, it loads BAAI/bge-small-en-v1.5 which creates 384-dimensional vectors.
# We initialize it globally once to reuse across multiple document/query embedding tasks.
model = TextEmbedding()


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

