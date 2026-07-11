import os
import requests
import shutil
from fastapi import UploadFile, HTTPException, status

# -----------------------------
# Configuration & Client Options
# -----------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET_NAME = os.getenv("SUPABASE_BUCKET_NAME", "student-notes")

# If SUPABASE_URL is not set but DATABASE_URL is, try to extract it from the host
if not SUPABASE_URL:
    db_url = os.getenv("DATABASE_URL")
    if db_url and "supabase" in db_url:
        try:
            # E.g., postgres://postgres.lehdrgvwncjpradvbhsj:...
            # Project ref is between "postgres." and "@"
            user_part = db_url.split("@")[0].split("://")[1]
            if "." in user_part:
                project_ref = user_part.split(".")[1].split(":")[0]
                SUPABASE_URL = f"https://{project_ref}.supabase.co"
        except Exception as e:
            print(f"Could not automatically extract SUPABASE_URL: {e}")


def upload_file_to_supabase(file: UploadFile) -> str:
    """
    Why it is written:
        To store uploaded lecture notes PDFs inside a Supabase Storage bucket.

    What it does:
        Uploads the raw bytes of the file to the Supabase Storage object API.
        If successful, returns the public URL. Otherwise, falls back to local disk storage
        if credentials are not configured, or raises an error.

    Inputs:
        file: UploadFile - The uploaded PDF file.

    Outputs:
        str - The public HTTP URL of the file inside Supabase, or local file path.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Supabase storage credentials not configured. Falling back to local storage.")
        # Local storage fallback
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, file.filename)
        # Reset read head
        file.file.seek(0)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return file_path

    # Prepare Supabase API URL and Headers
    file_path = f"documents/{file.filename}"
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET_NAME}/{file_path}"
    
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": file.content_type or "application/pdf"
    }

    try:
        # Read raw bytes
        file.file.seek(0)
        file_data = file.file.read()
        
        response = requests.post(upload_url, headers=headers, data=file_data, timeout=30)
        
        # If it returns 400 because file already exists, overwrite using PUT
        if response.status_code == 400 and "already exists" in response.text:
            response = requests.put(upload_url, headers=headers, data=file_data, timeout=30)

        if response.status_code in [200, 201]:
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET_NAME}/{file_path}"
            print(f"File '{file.filename}' uploaded to Supabase Storage: {public_url}")
            return public_url
        else:
            print(f"Supabase storage upload error: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Supabase upload failed: {response.text}"
            )
    except Exception as e:
        print(f"Exception during Supabase storage upload: {e}")
        # Local fallback if upload fails
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        fallback_path = os.path.join(upload_dir, file.filename)
        file.file.seek(0)
        with open(fallback_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return fallback_path


def delete_file_from_supabase(file_url: str) -> None:
    """
    Why it is written:
        To delete files from Supabase Storage or local disk when a document is deleted.

    What it does:
        Checks if the file_url is a Supabase public URL. If so, makes a DELETE request
        to the Supabase API to remove it. Otherwise, deletes it from the local disk.

    Inputs:
        file_url: str - The URL or local path of the document to delete.

    Outputs:
        None
    """
    if not file_url:
        return

    if file_url.startswith("http://") or file_url.startswith("https://"):
        if not SUPABASE_URL or not SUPABASE_KEY:
            return
        
        # Extract filepath from the URL
        prefix = f"/storage/v1/object/public/{SUPABASE_BUCKET_NAME}/"
        if prefix in file_url:
            file_path = file_url.split(prefix)[1]
        else:
            file_path = f"documents/{os.path.basename(file_url)}"

        delete_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET_NAME}/{file_path}"
        headers = {
            "Authorization": f"Bearer {SUPABASE_KEY}"
        }
        try:
            res = requests.delete(delete_url, headers=headers, timeout=20)
            if res.status_code == 200:
                print(f"Successfully deleted from Supabase storage: {file_path}")
            else:
                print(f"Failed to delete from Supabase storage: {res.status_code} - {res.text}")
        except Exception as e:
            print(f"Error deleting from Supabase storage: {e}")
    else:
        # Local deletion
        if os.path.exists(file_url):
            try:
                os.remove(file_url)
                print(f"Successfully deleted local file: {file_url}")
            except Exception as e:
                print(f"Error deleting local file: {e}")
