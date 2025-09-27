# This script creates a FastAPI server to expose our AI pipeline to the web.
# This is the "engine" that our frontend will talk to.

from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# We import the brain of our application from the ai_core module
from ai_core.main_agent import run_ai_pipeline

# Create the FastAPI app instance
app = FastAPI(
    title="FloatChat AI Core",
    description="API for the RAG-based Text-to-SQL pipeline for ARGO data.",
    version="1.0.0"
)

# --- CORS Middleware ---
# This is a critical security step. It allows your frontend application (running on a different port)
# to make requests to this backend server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

# --- Pydantic Models for a clear API contract ---
class QueryRequest(BaseModel):
    question: str

# --- API Endpoint ---
@app.post("/api/ask")
async def ask_question(request: QueryRequest):
    """
    This is the main endpoint for the application. It receives a question,
    runs it through the AI pipeline, and returns the result.
    """
    print(f"Received question via API: {request.question}")
    response_payload = run_ai_pipeline(request.question)
    return response_payload

# --- Run the server ---
# This block allows you to run the server directly for testing.
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

