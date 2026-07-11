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


def extract_text_and_images(file_path, document_id: int) -> str:
    """
    Why it is written:
        To extract text page-by-page, detect any embedded images, upload them to S3,
        and inject image reference URLs directly into the text stream.

    What it does:
        1. Opens the PDF via PyMuPDF (fitz).
        2. Iterates page-by-page extracting text.
        3. Extracts binary data for all images found on each page.
        4. Uploads them to S3 and appends image references [Image reference: URL]
           to the page text before returning the consolidated string.

    Inputs:
        file_path: Union[str, bytes] - Local path, S3 URL, or raw PDF bytes.
        document_id: int - The identifier of the document.

    Outputs:
        str - The text content containing text and embedded S3 image URLs.
    """
    from app.services.s3_service import upload_bytes_to_s3

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

    full_text = ""
    for page_num, page in enumerate(document, start=1):
        page_text = page.get_text()
        images = page.get_images(full=True)
        
        image_urls = []
        for img_idx, img in enumerate(images):
            try:
                xref = img[0]
                base_image = document.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                
                # Naming format: documents/{document_id}/page_{page_num}_img_{img_idx}.{ext}
                s3_key = f"documents/{document_id}/page_{page_num}_img_{img_idx}.{image_ext}"
                content_type = f"image/{image_ext}"
                
                url = upload_bytes_to_s3(image_bytes, s3_key, content_type)
                image_urls.append(url)
            except Exception as img_err:
                print(f"Failed to extract image {img_idx} on page {page_num}: {img_err}")
        
        full_text += page_text
        
        if image_urls:
            # Render a full page screenshot to show the image in context (the original page layout)
            try:
                pix = page.get_pixmap(dpi=150)
                page_bytes = pix.tobytes("png")
                page_s3_key = f"documents/{document_id}/page_{page_num}_screenshot.png"
                page_screenshot_url = upload_bytes_to_s3(page_bytes, page_s3_key, "image/png")
            except Exception as page_err:
                print(f"Failed to render page {page_num} screenshot: {page_err}")
                page_screenshot_url = None

            full_text += "\n\n[Visual References in Notes]:\n"
            for url in image_urls:
                full_text += f"[Image reference: {url}]\n"
            if page_screenshot_url:
                full_text += f"[Page screenshot reference: {page_screenshot_url}]\n"
            full_text += "\n"

    document.close()
    return full_text