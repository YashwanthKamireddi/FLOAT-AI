# This is the final, production-ready ETL script for the Data Squad.
# It has been reverted to connect to the LOCAL PostgreSQL database.

import os
import xarray as xr
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy import text
from dotenv import load_dotenv

# --- Securely Load Configuration ---
load_dotenv()

# We now look for the local DB_PASSWORD from the .env file.
DB_PASSWORD = os.getenv("DB_PASSWORD")
if not DB_PASSWORD:
    raise ValueError("ERROR: DB_PASSWORD must be set in your .env file for local development.")

root_data_folder = 'nc files'

print(f"--- 🌊 Starting Smart Sampling ETL Process for folder: '{root_data_folder}' ---")
print(f"--- Target Database: localhost ---")

# --- Database Connection ---
try:
    # Reverted to the localhost connection string.
    connection_string = f"postgresql+psycopg2://postgres:{DB_PASSWORD}@localhost:5432/postgres"
    engine = create_engine(connection_string)
    print("✅ Local database engine created successfully.")
except Exception as e:
    print(f"❌ Failed to create local database engine. Error: {e}")
    exit()

# --- Clear the table for a fresh start ---
print("Clearing the 'argo_profiles' table for a fresh load...")
try:
    with engine.connect() as connection:
        connection.execute(text("TRUNCATE TABLE argo_profiles RESTART IDENTITY;"))
        connection.commit()
    print("✅ 'argo_profiles' table has been cleared.")
except Exception as e:
    print(f"⚠️ Could not clear table. Error: {e}")


# --- Recursively find all profile files ---
nc_files_to_process = []
for root, dirs, files in os.walk(root_data_folder):
    for file in files:
        if file.endswith('.nc') and (file.startswith('D') or file.startswith('R')):
            nc_files_to_process.append(os.path.join(root, file))

if not nc_files_to_process:
    print(f"⚠️ No profile (.nc) files found in '{root_data_folder}'. Exiting.")
    exit()
print(f"Found {len(nc_files_to_process)} profile files to process.")


# --- Loop through each file and process it ---
total_rows_loaded = 0
for file_path in nc_files_to_process:
    filename = os.path.basename(file_path)
    print(f"\n--- Processing file: {filename} ---", end="")
    
    try:
        dataset = xr.open_dataset(file_path)
        argo_df = dataset.to_dataframe().reset_index()

        # --- Smart Attribute Selection ---
        column_map = {}
        potential_names = {
            'profile_date': ['juld', 'JULD'], 'latitude': ['latitude', 'LATITUDE'],
            'longitude': ['longitude', 'LONGITUDE'], 'pressure': ['pres_adjusted', 'PRES_ADJUSTED'],
            'temperature': ['temp_adjusted', 'TEMP_ADJUSTED'], 'salinity': ['psal_adjusted', 'PSAL_ADJUSTED']
        }
        for clean_name, ugly_names in potential_names.items():
            for ugly_name in ugly_names:
                if ugly_name in argo_df.columns:
                    column_map[ugly_name] = clean_name
                    break
        if len(column_map) != 6:
            raise KeyError("Could not find all required variables.")

        final_df = argo_df[list(column_map.keys())].copy()
        final_df.rename(columns=column_map, inplace=True)
        
        # --- Smart Sampling Step ---
        sampled_df = final_df.iloc[::2]
        
        # Add float_id from filename
        float_id = int(filename.split('_')[0].replace('D', '').replace('R', ''))
        sampled_df.loc[:, 'float_id'] = float_id
        
        # LOAD
        sampled_df.to_sql('argo_profiles', engine, if_exists='append', index=False)
        
        rows_loaded = len(sampled_df)
        total_rows_loaded += rows_loaded
        print(f" ✅ Success: Loaded {rows_loaded} (sampled) rows.")

    except Exception as e:
        print(f" ⚠️ SKIPPING FILE: Could not process {filename}. Error: {e}")

print(f"\n--- Bulk ETL Process Finished ---")
print(f"🎉 Total new (sampled) rows loaded into the database: {total_rows_loaded}")

