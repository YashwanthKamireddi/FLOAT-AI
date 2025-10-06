# This is the final, production-ready ETL script for the hackathon.
# It connects to the LOCAL PostgreSQL database, as specified in the problem statement.

import os
import xarray as xr
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy import text
from dotenv import load_dotenv

def main():
    """The main function to run the entire ETL process."""
    # --- Securely Load Configuration ---
    load_dotenv()

    database_url = os.getenv("DATABASE_URL")
    db_password = os.getenv("DB_PASSWORD")
    db_user = os.getenv("DB_USER", "postgres")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "float")

    if not database_url and not db_password:
        raise ValueError(
            "ERROR: Provide DATABASE_URL or DB_PASSWORD/DB_USER/DB_HOST/DB_PORT/DB_NAME in your .env file."
        )

    root_data_folder = 'nc files'

    print(f"--- Starting Bulk ETL Process for folder: '{root_data_folder}' ---")
    print(f"--- Target Database: Local PostgreSQL ---")

    # --- Database Connection ---
    try:
        connection_string = database_url or (
            f"postgresql+psycopg2://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
        )
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
        print(f"⚠️ Could not clear table (it might not exist yet, which is okay). Error: {e}")


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
            if len(column_map) != 6: raise KeyError("Could not find all required variables.")

            final_df = argo_df[list(column_map.keys())].copy()
            final_df.rename(columns=column_map, inplace=True)

            float_id = int(filename.split('_')[0].replace('D', '').replace('R', ''))
            final_df['float_id'] = float_id

            # LOAD
            final_df.to_sql('argo_profiles', engine, if_exists='append', index=False)

            rows_loaded = len(final_df)
            total_rows_loaded += rows_loaded
            print(f" ✅ Success: Loaded {rows_loaded} rows.")

        except Exception as e:
            print(f" ⚠️ SKIPPING FILE: Could not process {filename}. Error: {e}")

    print(f"\n--- Bulk ETL Process Finished ---")
    print(f"🎉 Total rows loaded into the local PostgreSQL database: {total_rows_loaded}")

# --- This is the "Ignition Switch" that starts the engine ---
# This is the standard way to make a Python script runnable.
if __name__ == "__main__":
    main()
