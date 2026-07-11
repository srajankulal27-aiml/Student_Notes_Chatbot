from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.models.user import User
from app.routers import auth
from app.routers import document
from app.routers import chat


from app.models.document import Document

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Student Notes Chatbot API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(document.router)
app.include_router(chat.router)

@app.get("/")
def root():
    return {
        "message": "Welcome to AI Student Notes Chatbot API"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }