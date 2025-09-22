# This is the final version of the main AI script.
# It implements a full RAG (Retrieval-Augmented Generation) pipeline and
# securely loads secrets from a .env file.

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
# This line finds and loads the variables from your .env file.
load_dotenv()

# Load secrets from environment variables.
DB_PASSWORD = os.getenv("DB_PASSWORD")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Check if the secrets were loaded correctly.
if not DB_PASSWORD or not GOOGLE_API_KEY:
    raise ValueError("ERROR: GOOGLE_API_KEY and DB_PASSWORD must be set in your .env file")

# Set the API key as an environment variable for LangChain to use it.
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

print("--- 🧠 Initializing FloatChat RAG AI Core ---")

try:
    # --- 1. Initialize Connections ---
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-pro", temperature=0)
    print("✅ Step 1: Connected to LLM (Gemini Pro).")

    db_uri = f"postgresql+psycopg2://postgres:{DB_PASSWORD}@localhost:5432/postgres"
    db = SQLDatabase.from_uri(db_uri)
    print("✅ Step 2: Connected to PostgreSQL database.")

    # --- 2. Load the Vector Store (The "Cheat Sheet") ---
    print("Loading AI knowledge base (FAISS vector store)...")
    embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vector_store = FAISS.load_local("ai_core/faiss_index", embedding_model, allow_dangerous_deserialization=True)
    retriever = vector_store.as_retriever()
    print("✅ Step 3: FAISS vector store loaded and retriever is ready.")

    # --- 3. Create the RAG Prompt Template ---
    template = """
    You are a PostgreSQL expert. Given a user question, you must first use the
    retrieved context to understand the database schema and rules.
    Then, create a syntactically correct PostgreSQL query to answer the question.
    Unless the user specifies a specific number of examples, query for at most 10 results.
    Never query for all columns from a table, you must specify the exact columns you need.
    You must use the table name 'argo_profiles'.

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
    print("✅ Step 4: RAG prompt template created.")

    # --- 4. Build the RAG Chain ---
    rag_chain = (
        {"context": retriever, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    print("✅ Step 5: Full RAG chain constructed.")

    # --- 5. Create a function to run the full process ---
    def run_ai_pipeline(question: str):
        print("\n--- Generating SQL Query using RAG ---")
        generated_sql = rag_chain.invoke(question)
        print(f"Generated SQL: {generated_sql}")

        print("\n--- Executing SQL Query on the database ---")
        result = db.run(generated_sql)
        print(f"Query Result: {result}")
        return result

    # --- Main Execution Block ---
    if __name__ == '__main__':
        test_question = "Show me the temperature and salinity for floats near the equator. Just give me 5 results."
        
        print(f"\n--- Asking the AI a test question ---")
        print(f"Question: '{test_question}'")
        
        final_answer = run_ai_pipeline(test_question)

        print("\n--- ✅ Final Answer from Database ---")
        print(final_answer)
        print("\n--- Script Finished ---")

except Exception as e:
    print(f"\n❌ An error occurred: {e}")

