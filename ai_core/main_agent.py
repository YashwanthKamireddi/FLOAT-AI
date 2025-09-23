# This is the final, production-ready version of the AI agent.
# It is now refactored to be easily callable from the Streamlit frontend.

import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.utilities import SQLDatabase
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings

# --- Securely Load Configuration ---
load_dotenv()

DB_PASSWORD = os.getenv("DB_PASSWORD")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# --- Global Initialization (to avoid reloading models on every call) ---
llm = None
db = None
rag_chain = None

def initialize_ai_core():
    """
    Initializes all the core AI components (LLM, DB, Vector Store).
    This function is called once to prevent expensive reloads.
    """
    global llm, db, rag_chain

    if llm is not None:
        return # Already initialized

    print("--- 🧠 Initializing FloatChat RAG AI Core (first run)... ---")

    os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY
    
    llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash-latest", temperature=0)
    
    db_uri = f"postgresql+psycopg2://postgres:{DB_PASSWORD}@localhost:5432/postgres"
    db = SQLDatabase.from_uri(db_uri)

    embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vector_store = FAISS.load_local("ai_core/faiss_index", embedding_model, allow_dangerous_deserialization=True)
    retriever = vector_store.as_retriever()

    # --- CRITICAL FIX IS HERE ---
    template = """
    You are a PostgreSQL expert. Given a user question, first use the
    retrieved context to understand the database schema and rules.
    Then, create a syntactically correct PostgreSQL query to answer the question.
    
    **CRITICAL RULE: You are only allowed to use the following columns: 'float_id', 'profile_date', 'latitude', 'longitude', 'pressure', 'temperature', 'salinity'. Do NOT use any other columns, especially any columns ending with '_qc'.**

    Unless the user specifies a number of examples, query for at most 50 results.
    Never query for all columns from a table; you must specify the exact columns you need.
    The table name is 'argo_profiles'. The 'profile_date' column is a TIMESTAMP.

    Use the following format:

    Question: "The user's question"
    SQLQuery: "Your generated SQL query"

    Only return the SQL query.

    Here is some context to help you:
    {context}

    Question: {question}
    SQLQuery:
    """
    prompt = PromptTemplate.from_template(template)

    rag_chain = (
        {"context": retriever, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    print("--- ✅ AI Core Initialized Successfully ---")


def run_ai_pipeline(question: str):
    """
    This is the main entry point that the frontend will call.
    It takes a user's question, generates and executes a SQL query,
    and returns a structured dictionary with the results.
    """
    try:
        initialize_ai_core()

        print("\n--- Generating SQL Query using RAG ---")
        generated_sql = rag_chain.invoke(question)
        print(f"Generated SQL: {generated_sql}")

        print("\n--- Executing SQL Query on the database ---")
        result_data = db.run(generated_sql)
        print(f"Query Result: {result_data}")
        
        # This is the "API Contract": always return a dictionary.
        return {
            "question": question,
            "sql_query": generated_sql,
            "result_data": result_data,
            "error": None
        }

    except Exception as e:
        print(f"\n❌ An error occurred in the AI pipeline: {e}")
        return {
            "question": question,
            "sql_query": "Error generating query.",
            "result_data": None,
            "error": str(e)
        }

# --- Main Execution Block (for direct testing of this script) ---
if __name__ == '__main__':
    test_question = "Show me the location of 5 floats with the highest salinity."
    
    print(f"\n--- Asking the AI a test question ---")
    print(f"Question: '{test_question}'")
    
    response = run_ai_pipeline(test_question)

    print("\n--- ✅ Final Response Payload ---")
    print(response)
    print("\n--- Script Finished ---")
