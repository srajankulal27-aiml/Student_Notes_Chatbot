# pyrefly: ignore [missing-import]
from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_text(
    text: str,
    chunk_size: int = 1000,
    overlap: int = 200
) -> list[str]:
    """
    Why it is written:
        To segment a large document text into smaller, overlapping chunks, making it suitable
        for vector generation and enabling highly context-aware RAG search.

    What it does:
        Instantiates LangChain's RecursiveCharacterTextSplitter with the specified chunk size
        and overlap, splits the input text along natural paragraph and sentence boundaries,
        and returns the resulting list of text chunks.

    Inputs:
        text: str - The complete raw text of the document to be split.
        chunk_size: int - The maximum character count for each chunk (default is 1000).
        overlap: int - The number of overlapping characters between adjacent chunks (default is 200).

    Outputs:
        list[str] - A list of text chunk strings.
    """
    # Create the splitter object configuring sizes and overlap
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        length_function=len
    )
    # Split the document text
    chunks = splitter.split_text(text)
    return chunks