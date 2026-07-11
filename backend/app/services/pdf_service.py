import os
import shutil
import fitz
from fastapi import UploadFile

import requests

UPLOAD_DIR = "uploads"

os.makedirs(UPLOAD_DIR, exist_ok=True)


def save_pdf(file: UploadFile):

    file_path = os.path.join(
        UPLOAD_DIR,
        file.filename
    )

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(
            file.file,
            buffer)

    return file_path


def extract_text(file_path) -> str:
    """
    Why it is written:
        To extract raw text from a PDF document stored in-memory, remote S3, or local disk.

    What it does:
        Checks if the input is bytes (in-memory PDF data) and opens it directly using fitz (PyMuPDF).
        If the file_path is a string URL, downloads the content and opens it from the byte stream.
        Otherwise, opens the PDF file from the local disk path. Iterates over pages to extract text.

    Inputs:
        file_path: Union[str, bytes] - Raw PDF bytes, local file path, or S3 HTTP/S URL.

    Outputs:
        str - The extracted text content.
    """
    if isinstance(file_path, bytes):
        document = fitz.open(stream=file_path, filetype="pdf")
    elif isinstance(file_path, str) and (file_path.startswith("http://") or file_path.startswith("https://")):
        try:
            response = requests.get(file_path, timeout=30)
            response.raise_for_status()
            pdf_bytes = response.content
            document = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as e:
            print(f"Failed to fetch PDF from URL {file_path}: {e}")
            raise e
    else:
        document = fitz.open(file_path)

    text = ""
    for page in document:
        text += page.get_text()

    document.close()
    return text