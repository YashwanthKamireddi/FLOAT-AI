# This is the final, production-ready version of the AI agent.
# It now uses the 'Flash' model for better rate limits during the hackathon.

import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.utilities import SQLDatabase
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from sqlalchemy import text

# --- Securely Load Configuration ---
load_dotenv()
DB_PASSWORD = os.getenv("DB_PASSWORD")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# --- Global Initialization ---
llm, db, rag_chain, conversation_chain = None, None, None, None

def initialize_ai_core():
    global llm, db, rag_chain, conversation_chain
    if rag_chain is not None: return

    print("--- 🧠 Initializing FloatChat RAG AI Core (first run)... ---")
    os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY
    
    # --- STRATEGIC CHANGE: Switched to the 'flash' model for better rate limits ---
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.1)
    
    db_uri = f"postgresql+psycopg2://postgres:{DB_PASSWORD}@localhost:5432/postgres"
    db = SQLDatabase.from_uri(db_uri)

    embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vector_store = FAISS.load_local("ai_core/faiss_index", embedding_model, allow_dangerous_deserialization=True)
    retriever = vector_store.as_retriever()

    # --- Chain 1: The RAG SQL Generator ---
    rag_prompt_template = """
    You are a PostgreSQL expert. Based on the user's question and the provided context about the database schema, create a syntactically correct PostgreSQL query.
    **CRITICAL RULE: Only use the following columns: 'float_id', 'profile_date', 'latitude', 'longitude', 'pressure', 'temperature', 'salinity'. Do NOT use any other columns.**
    Unless specified, limit results to 50. Only return the SQL query.
    Context: {context}
    Question: {question}
    SQLQuery:
    """
    rag_prompt = PromptTemplate.from_template(rag_prompt_template)
    rag_chain = (
        {"context": retriever, "question": RunnablePassthrough()}
        | rag_prompt
        | llm
        | StrOutputParser()
    )

    # --- Chain 2: The Conversational Chain ---
    convo_prompt_template = "You are a friendly and helpful oceanographic research assistant named FloatChat. Answer the user's question concisely. If you don't know the answer, say so. Question: {question}"
    convo_prompt = PromptTemplate.from_template(convo_prompt_template)
    conversation_chain = convo_prompt | llm | StrOutputParser()
    
    print("--- ✅ AI Core Initialized Successfully ---")

def run_ai_pipeline(question: str):
    try:
        initialize_ai_core()
        # --- Intent Detection Router ---
        router_prompt = f"Classify the user's intent as 'data_query' or 'conversational'. Question: \"{question}\"\nIntent:"
        intent = llm.invoke(router_prompt).content.strip().lower()
        print(f"Detected intent: {intent}")

        if 'data_query' in intent:
            generated_sql = rag_chain.invoke(question).replace("```sql", "").replace("```", "").strip()
            print(f"Generated SQL: {generated_sql}")
            with db._engine.connect() as connection:
                result_data = [dict(row._mapping) for row in connection.execute(text(generated_sql))]
            print(f"Query Result: {len(result_data)} rows found.")
            return {"sql_query": generated_sql, "result_data": result_data, "error": None}
        else:
            response = conversation_chain.invoke({"question": question})
            return {"sql_query": None, "result_data": response, "error": None}
    except Exception as e:
        return {"sql_query": "Error generating query.", "result_data": None, "error": str(e)}

