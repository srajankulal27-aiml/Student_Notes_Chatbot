import os
import sys

# Ensure backend folder is in PYTHONPATH
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, engine
from app.models.user import User
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession, ChatSessionCollaborator

print("Dropping all database tables...")
Base.metadata.drop_all(bind=engine)

print("Creating all database tables...")
Base.metadata.create_all(bind=engine)

print("Database reset completed successfully!")
