# This is a utility script for the AI Squad.
# It reads the detailed research file from the Data Squad (knowledge.jsonl)
# and curates it, selecting only the essential facts needed for our RAG "cheat sheet".
# This automates the process of creating our final, high-quality knowledge base.

import json

# --- Configuration ---
input_knowledge_file = 'knowledge.jsonl'
output_knowledge_file = 'curated_knowledge.txt'

# This is our "whitelist". We've decided these are the only topics
# that are relevant for teaching the AI how to query the final database.
# We ignore topics about the raw data sources or the ETL process itself.
REQUIRED_TOPICS = [
    "Core attributes",
    "Relational DB",
    "temperature",
    "salinity",
    "pressure",
    "float_id",
    "Example query"
]

print(f"--- 🧠 Curating AI Knowledge from '{input_knowledge_file}' ---")

curated_knowledge_list = []
try:
    with open(input_knowledge_file, 'r') as f:
        for line in f:
            try:
                data = json.loads(line)
                # Check if the topic of this line is in our whitelist
                if data.get('topic') in REQUIRED_TOPICS:
                    curated_knowledge_list.append(data['content'])
            except json.JSONDecodeError:
                print(f"⚠️ Warning: Could not decode a line in the JSONL file. Skipping.")

    print(f"✅ Successfully extracted {len(curated_knowledge_list)} relevant knowledge statements.")

    # --- Post-processing and Standardization ---
    # We will do a final cleanup to ensure consistency with our database schema.
    final_knowledge = []
    for sentence in curated_knowledge_list:
        # Standardize column names to match our final DB (e.g., 'lat' -> 'latitude')
        processed_sentence = sentence.replace("(PRES)", "").replace("(TEMP)", "").replace("(PSAL)", "")
        processed_sentence = processed_sentence.replace("profiles(", "argo_profiles(")
        processed_sentence = processed_sentence.replace(" lat ", " latitude ").replace(" lon ", " longitude ")
        final_knowledge.append(processed_sentence.strip())

    # Add one final, crucial negative constraint.
    final_knowledge.append("The database does not contain Quality Control (QC) flags or Bio-Geo-Chemical (BGC) parameters like oxygen.")
    
    # Save the final, clean list to a new file
    with open(output_knowledge_file, 'w') as f:
        f.write("This is the curated knowledge base for the FloatChat AI. Copy the list below into 'create_vector_db.py'.\n\n")
        f.write("knowledge = [\n")
        for i, sentence in enumerate(final_knowledge):
            f.write(f'    "{sentence}",\n')
        f.write("]\n")

    print(f"✅ Final, curated knowledge has been saved to '{output_knowledge_file}'.")
    print("\n--- Curation Finished ---")

except FileNotFoundError:
    print(f"❌ ERROR: The input file '{input_knowledge_file}' was not found.")
except Exception as e:
    print(f"❌ An error occurred: {e}")
