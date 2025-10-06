# This script creates the vector database using FAISS.
# It imports its knowledge from the 'curated_knowledge.py' file.

try:
    from langchain_huggingface import HuggingFaceEmbeddings  # type: ignore
except ImportError:  # pragma: no cover - fallback for legacy environments
    from langchain_community.embeddings import HuggingFaceEmbeddings  # type: ignore
from langchain_community.vectorstores import FAISS

# --- 1. Import the Curated Knowledge ---
# This line assumes you have 'curated_knowledge.py' in the same 'ai_core' folder.
try:
    from curated_knowledge import knowledge
except ImportError:
    print("❌ ERROR: Could not find 'ai_core/curated_knowledge.py'. Please create it first.")
    exit()

print("--- 🧠 Initializing FAISS Vector Store ---")
print(f"✅ Successfully imported {len(knowledge)} knowledge documents.")

try:
    # --- 2. Initialize the Embedding Model using the LangChain Adapter ---
    # This ensures compatibility with the FAISS library.
    print("Loading embedding model (this might take a moment on first run)...")
    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_model = HuggingFaceEmbeddings(model_name=model_name)
    print("✅ Embedding model loaded.")

    # --- 3. Create the FAISS Vector Store in Memory ---
    # This single command takes our knowledge documents, uses the embedding model
    # to convert them to vectors, and builds the FAISS index.
    print("Creating FAISS vector store from knowledge documents...")
    vector_store = FAISS.from_texts(texts=knowledge, embedding=embedding_model)
    print("✅ FAISS vector store created successfully.")

    # --- 4. Save the Vector Store to a Local Folder ---
    # This saves the index to disk so we can load it later without rebuilding it.
    # It will create a folder named 'faiss_index' inside the 'ai_core' directory.
    vector_store.save_local("ai_core/faiss_index")

    print(f"\n✅ SUCCESS: Successfully saved FAISS index to the 'ai_core/faiss_index' folder!")
    print("\n--- AI Knowledge Base Created ---")

except Exception as e:
    print(f"\n❌ An error occurred: {e}")
