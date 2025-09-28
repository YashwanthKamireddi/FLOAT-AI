# This is the final, production-ready version of the AI agent.
# It now returns clean, JSON-serializable data for the frontend.

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, cast

import certifi

from dotenv import load_dotenv
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.utilities import SQLDatabase
from langchain_community.vectorstores import FAISS
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_google_genai import ChatGoogleGenerativeAI
from sqlalchemy import text


class ConfigError(RuntimeError):
    """Raised when required configuration is missing or invalid."""


load_dotenv()

# Ensure outbound HTTPS requests (Google Generative AI, HuggingFace) have a valid CA bundle.
DEFAULT_CERT_PATH = Path(certifi.where()).resolve()
if not DEFAULT_CERT_PATH.is_file():
    raise RuntimeError(
        "certifi CA bundle not found. Ensure certifi is installed and accessible."
    )
os.environ["SSL_CERT_FILE"] = str(DEFAULT_CERT_PATH)
os.environ["REQUESTS_CA_BUNDLE"] = str(DEFAULT_CERT_PATH)


# --- Global initialization caches ---
llm = None
db = None
rag_chain = None
conversation_chain = None


def _get_google_api_key() -> str:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ConfigError(
            "GOOGLE_API_KEY is not configured. Add it to your .env file before starting the API server."
        )
    return api_key


def _get_database_uri() -> str:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    password = os.getenv("DB_PASSWORD")
    if not password:
        raise ConfigError(
            "Database credentials are missing. Provide DATABASE_URL or DB_PASSWORD in your .env file."
        )

    user = os.getenv("DB_USER", "postgres")
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "float")

    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db_name}"


def _get_faiss_index_path() -> str:
    custom_path = os.getenv("FAISS_INDEX_PATH")
    default_path = Path(__file__).resolve().parent / "faiss_index"
    resolved_path = Path(custom_path) if custom_path else default_path

    if not resolved_path.exists():
        raise ConfigError(
            f"FAISS index not found at '{resolved_path}'. Run ai_core/create_vector_db.py to generate it."
        )

    return str(resolved_path)


def _initialise_components() -> Dict[str, Any]:
    print("--- 🧠 Initializing FloatChat RAG AI Core (first run)... ---")

    os.environ["GOOGLE_API_KEY"] = _get_google_api_key()

    llm_instance = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.1)

    database_uri = _get_database_uri()
    try:
        db_instance = SQLDatabase.from_uri(database_uri)
    except Exception as exc:  # pragma: no cover - defensive guard
        raise ConfigError(
            "Unable to connect to PostgreSQL. Double-check your DATABASE_URL/DB_* environment variables."
        ) from exc

    embeddings_model_name = os.getenv("EMBEDDINGS_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    embedding_model = HuggingFaceEmbeddings(model_name=embeddings_model_name)

    vector_store_path = _get_faiss_index_path()
    try:
        vector_store = FAISS.load_local(
            vector_store_path,
            embedding_model,
            allow_dangerous_deserialization=True,
        )
    except Exception as exc:  # pragma: no cover - defensive guard
        raise ConfigError(
            f"Failed to load FAISS index from '{vector_store_path}'. Re-run ai_core/create_vector_db.py."
        ) from exc

    retriever = vector_store.as_retriever(
        search_kwargs={"k": int(os.getenv("RAG_RETRIEVER_K", "6"))}
    )

    rag_prompt_template = """
    You are a PostgreSQL expert. Based on the user's question and the provided context about the database schema, create a syntactically correct PostgreSQL query.
    **CRITICAL RULE: Only use the following columns: 'float_id', 'profile_date', 'latitude', 'longitude', 'pressure', 'temperature', 'salinity'. Do NOT use any other columns.**
    Unless specified, limit results to 50. Only return the SQL query.
    Context: {context}
    Question: {question}
    SQLQuery:
    """
    rag_prompt = PromptTemplate.from_template(rag_prompt_template)
    rag_chain_instance = (
        {"context": retriever, "question": RunnablePassthrough()}
        | rag_prompt
        | llm_instance
        | StrOutputParser()
    )

    convo_prompt_template = (
        "You are a friendly and helpful oceanographic research assistant named FloatChat. "
        "Answer the user's question concisely. If you don't know the answer, say so. Question: {question}"
    )
    convo_prompt = PromptTemplate.from_template(convo_prompt_template)
    conversation_chain_instance = convo_prompt | llm_instance | StrOutputParser()

    print("--- ✅ AI Core Initialized Successfully ---")

    return {
        "llm": llm_instance,
        "db": db_instance,
        "rag_chain": rag_chain_instance,
        "conversation_chain": conversation_chain_instance,
    }


def initialize_ai_core() -> None:
    global llm, db, rag_chain, conversation_chain

    if all(component is not None for component in (llm, db, rag_chain, conversation_chain)):
        return

    components = _initialise_components()
    llm = components["llm"]
    db = components["db"]
    rag_chain = components["rag_chain"]
    conversation_chain = components["conversation_chain"]


def run_ai_pipeline(question: str) -> Dict[str, Any]:
    try:
        initialize_ai_core()

        if not all((llm, db, rag_chain, conversation_chain)):
            raise RuntimeError("AI core components failed to initialize.")

        local_llm = cast(ChatGoogleGenerativeAI, llm)
        local_rag_chain = cast(Any, rag_chain)
        local_db = cast(SQLDatabase, db)
        local_conversation_chain = cast(Any, conversation_chain)

        router_prompt = (
            "Classify the user's intent as 'data_query' or 'conversational'. "
            f"Question: \"{question}\"\nIntent:"
        )
        intent_response = local_llm.invoke(router_prompt)
        intent = getattr(intent_response, "content", str(intent_response)).strip().lower()
        print(f"Detected intent: {intent}")

        if "data_query" in intent:
            generated_sql = local_rag_chain.invoke(question)
            generated_sql = (
                generated_sql.replace("```sql", "").replace("```", "").strip()
            )
            if not generated_sql:
                raise RuntimeError("The RAG chain returned an empty SQL query.")

            print(f"Generated SQL: {generated_sql}")

            with local_db._engine.connect() as connection:  # pylint: disable=protected-access
                query_result = connection.execute(text(generated_sql))
                result_data = [dict(row._mapping) for row in query_result]

            print(f"Query Result: {len(result_data)} rows found.")
            return {"sql_query": generated_sql, "result_data": result_data, "error": None}

        response = local_conversation_chain.invoke({"question": question})
        return {"sql_query": None, "result_data": response, "error": None}

    except ConfigError as config_error:
        return {
            "sql_query": "Configuration error.",
            "result_data": None,
            "error": str(config_error),
        }
    except Exception as exc:  # pragma: no cover - defensive guard
        return {
            "sql_query": "Error generating query.",
            "result_data": None,
            "error": str(exc),
        }
