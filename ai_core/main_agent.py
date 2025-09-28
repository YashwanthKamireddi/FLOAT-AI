# This is the final, production-ready version of the AI agent.
# It now returns clean, JSON-serializable data for the frontend.

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
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.1)
    db_uri = f"postgresql+psycopg2://postgres:{DB_PASSWORD}@localhost:5432/postgres"
    db = SQLDatabase.from_uri(db_uri)

    embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vector_store = FAISS.load_local("ai_core/faiss_index", embedding_model, allow_dangerous_deserialization=True)
    retriever = vector_store.as_retriever()

    # --- Chains Initialization ---
    rag_prompt_template = "You are a PostgreSQL expert. Based on the context, create a correct PostgreSQL query for the user's question. **CRITICAL RULE: Only use these columns: 'float_id', 'profile_date', 'latitude', 'longitude', 'pressure', 'temperature', 'salinity'.** Limit results to 50 unless specified. Only return the SQL query. Context: {context}\nQuestion: {question}\nSQLQuery:"
    rag_prompt = PromptTemplate.from_template(rag_prompt_template)
    rag_chain = ({"context": retriever, "question": RunnablePassthrough()} | rag_prompt | llm | StrOutputParser())

    convo_prompt_template = "You are a friendly oceanographic research assistant named FloatChat. Answer concisely. Question: {question}"
    convo_prompt = PromptTemplate.from_template(convo_prompt_template)
    conversation_chain = convo_prompt | llm | StrOutputParser()
    print("--- ✅ AI Core Initialized Successfully ---")

def run_ai_pipeline(question: str):
    try:
        initialize_ai_core()
        router_prompt = f"Classify the user's intent as 'data_query' or 'conversational'. Question: \"{question}\"\nIntent:"
        intent = llm.invoke(router_prompt).content.strip().lower()
        print(f"Detected intent: {intent}")

        if 'data_query' in intent:
            generated_sql = rag_chain.invoke(question).replace("```sql", "").replace("```", "").strip()
            print(f"Generated SQL: {generated_sql}")
            with db._engine.connect() as connection:
                # This block now returns clean, JSON-native data
                result_proxy = connection.execute(text(generated_sql))
                result_data = [dict(row._mapping) for row in result_proxy]
            print(f"Query Result: {len(result_data)} rows found.")
            return {"sql_query": generated_sql, "result_data": result_data, "error": None}
        else:
            response = conversation_chain.invoke({"question": question})
            return {"sql_query": None, "result_data": response, "error": None}
    except Exception as e:
        return {"sql_query": "Error generating query.", "result_data": None, "error": str(e)}

