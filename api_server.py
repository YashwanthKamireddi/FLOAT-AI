# This script creates a FastAPI server to expose our AI pipeline to the web.
# This is the "engine" that our frontend will talk to.

import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# We import the brain of our application from the ai_core module
from ai_core.main_agent import run_ai_pipeline

# Load backend environment variables once at startup.
load_dotenv()

# Create the FastAPI app instance
app = FastAPI(
    title="FloatAI Core",
    description="API for the FloatAI RAG-based Text-to-SQL pipeline for ARGO data.",
    version="1.0.0"
)

# --- CORS Middleware ---
# This is a critical security step. It allows your frontend application (running on a different port)
# to make requests to this backend server.
cors_origins_env = os.getenv("BACKEND_CORS_ORIGINS", "*")
parsed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
allow_all_origins = "*" in parsed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all_origins else parsed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models for a clear API contract ---
class QueryRequest(BaseModel):
    question: str


class AssistantMessage(BaseModel):
    role: str
    content: str
    type: Optional[str] = None
    title: Optional[str] = None


class QueryResponse(BaseModel):
    sql_query: Optional[str]
    result_data: Any
    messages: List[AssistantMessage]
    metadata: Dict[str, Any]
    error: Optional[str]

# --- API Endpoint ---
@app.post("/api/ask", response_model=QueryResponse)
async def ask_question(request: QueryRequest) -> QueryResponse:
    """
    This is the main endpoint for the application. It receives a question,
    runs it through the AI pipeline, and returns the result.
    """
    print(f"Received question via API: {request.question}")
    response_payload = run_ai_pipeline(request.question)
    return QueryResponse.model_validate(response_payload)

# --- Run the server ---
# This block allows you to run the server directly for testing.
if __name__ == "__main__":
    api_host = os.getenv("API_HOST", "0.0.0.0")
    api_port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run(app, host=api_host, port=api_port)
