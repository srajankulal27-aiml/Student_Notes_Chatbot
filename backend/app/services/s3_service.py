import os
from urllib.parse import urlparse
from dotenv import load_dotenv
import boto3
from fastapi import UploadFile

# Ensure environment variables are loaded
load_dotenv(override=True)

# Retrieve credentials
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "").strip() or None
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip() or None
AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME", "").strip() or None
AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME", "us-east-1").strip()

# Initialize s3 client only if variables are set
s3_client = None
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    s3_client = boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_S3_REGION_NAME
    )

def upload_file_to_s3(file: UploadFile) -> str:
    """
    Why it is written:
        To store uploaded lecture notes PDFs inside an AWS S3 bucket.

    What it does:
        Uploads the raw bytes of the file to the S3 bucket.
        If successful, returns a pre-signed URL valid for 7 days.

    Inputs:
        file: UploadFile - The uploaded PDF file.

    Outputs:
        str - The pre-signed HTTP URL of the file inside S3.
    """
    if not s3_client or not AWS_STORAGE_BUCKET_NAME:
        raise ValueError("AWS S3 credentials not configured. Please check your environment variables.")

    # We prefix keys to keep the bucket clean
    object_name = f"documents/{file.filename}"
    
    # Seek to start
    file.file.seek(0)
    file_data = file.file.read()
    
    try:
        s3_client.put_object(
            Bucket=AWS_STORAGE_BUCKET_NAME,
            Key=object_name,
            Body=file_data,
            ContentType=file.content_type or "application/pdf"
        )
        
        # Generate a pre-signed URL valid for 7 days
        presigned_url = s3_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": AWS_STORAGE_BUCKET_NAME,
                "Key": object_name
            },
            ExpiresIn=604800 # 7 days
        )
        return presigned_url
    except Exception as e:
        print(f"Exception during S3 upload: {e}")
        raise e

def delete_file_from_s3(file_url: str) -> None:
    """
    Why it is written:
        To delete files from AWS S3 when a document is deleted.

    What it does:
        Parses the S3 object key from the pre-signed URL, and deletes it from S3.

    Inputs:
        file_url: str - The pre-signed or public URL of the S3 object.

    Outputs:
        None
    """
    if not s3_client or not AWS_STORAGE_BUCKET_NAME or not file_url:
        return
        
    try:
        parsed_url = urlparse(file_url)
        # S3 keys are paths without leading slash
        object_key = parsed_url.path
        if object_key.startswith("/"):
            object_key = object_key[1:]
            
        # If the path contains the bucket name (common in path-style URLs), strip it
        if object_key.startswith(f"{AWS_STORAGE_BUCKET_NAME}/"):
            object_key = object_key[len(f"{AWS_STORAGE_BUCKET_NAME}/"):]
            
        s3_client.delete_object(
            Bucket=AWS_STORAGE_BUCKET_NAME,
            Key=object_key
        )
        print(f"Successfully deleted {object_key} from S3.")
    except Exception as e:
        print(f"Failed to delete S3 object {file_url}: {e}")
