from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from dotenv import load_dotenv
import os

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    # Remove non-standard query parameters like "supa" that cause psycopg2 exceptions
    try:
        parsed = urlparse(DATABASE_URL)
        query_params = parse_qs(parsed.query)
        query_params.pop("supa", None)
        new_query = urlencode(query_params, doseq=True)
        DATABASE_URL = urlunparse(parsed._replace(query=new_query))
    except Exception as parse_err:
        print(f"Error parsing database URL: {parse_err}")

engine = create_engine(
    DATABASE_URL,
    echo=False
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()