# This is the final, production-ready ETL script for the Data Squad.
# It has been reverted to connect to the LOCAL PostgreSQL database.

import os
import xarray as xr
import pandas as pd
import numpy as np
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


def process_profile_file(file_path, engine):
    """Processes a single NetCDF profile file and inserts its data into the database."""
    try:
        with xr.open_dataset(file_path, decode_times=False) as ds:
            # --- Smart Attribute Selection ---
            column_map = {}
            potential_names = {
                'profile_date': ['juld', 'JULD'], 'latitude': ['latitude', 'LATITUDE'],
                'longitude': ['longitude', 'LONGITUDE'], 'pressure': ['pres_adjusted', 'PRES_ADJUSTED'],
                'temperature': ['temp_adjusted', 'TEMP_ADJUSTED'], 'salinity': ['psal_adjusted', 'PSAL_ADJUSTED']
            }
            for clean_name, ugly_names in potential_names.items():
                for ugly_name in ugly_names:
                    if ugly_name in ds.variables:
                        column_map[ugly_name] = clean_name
                        break
            if len(column_map) != 6:
                raise KeyError("Could not find all required variables.")

            # Extract data, handling potential missing values
            try:
                data_to_insert = []  # Initialize the list to collect rows

                # Extract platform_number from dataset if available
                platform_number = None
                if 'PLATFORM_NUMBER' in ds.variables:
                    platform_number = str(ds['PLATFORM_NUMBER'].values)
                elif 'platform_number' in ds.variables:
                    platform_number = str(ds['platform_number'].values)
                else:
                    # Try to extract from filename as fallback
                    platform_number = os.path.basename(file_path).split('_')[0].replace('D', '').replace('R', '')

                # Check for NaN values before processing
                if np.isnan(ds['TEMP_ADJUSTED'].values).all() or np.isnan(ds['PSAL_ADJUSTED'].values).all():
                    print(f"🟡 WARNING: Skipping file {os.path.basename(file_path)} due to all NaN values in TEMP or PSAL.")
                    return 0

                for i in range(len(ds['PRES_ADJUSTED'])):
                    temp = ds['TEMP_ADJUSTED'].values[i]
                    psal = ds['PSAL_ADJUSTED'].values[i]

                    # Skip inserting rows where primary data is NaN
                    if np.isnan(temp) or np.isnan(psal):
                        continue

                    data_to_insert.append({
                        'platform_number': platform_number,
                        'profile_date': ds['JULD'].values[i] if 'JULD' in ds.variables else None,
                        'latitude': ds['LATITUDE'].values[i] if 'LATITUDE' in ds.variables else None,
                        'longitude': ds['LONGITUDE'].values[i] if 'LONGITUDE' in ds.variables else None,
                        'pressure': ds['PRES_ADJUSTED'].values[i] if 'PRES_ADJUSTED' in ds.variables else None,
                        'temperature': temp,
                        'salinity': psal
                    })
            except Exception as e:
                print(f"🔴 ERROR processing data arrays in {os.path.basename(file_path)}: {e}")
                return 0

            if not data_to_insert:
                print(f"🟡 INFO: No valid data points found to insert for {os.path.basename(file_path)}.")
                return 0
            
            # Add float_id from filename
            float_id = int(os.path.basename(file_path).split('_')[0].replace('D', '').replace('R', ''))
            for row in data_to_insert:
                row['float_id'] = float_id
            
            # LOAD
            df_to_load = pd.DataFrame(data_to_insert)
            df_to_load.to_sql('argo_profiles', engine, if_exists='append', index=False)
            
            return len(df_to_load)
    except FileNotFoundError:
        print(f"🔴 ERROR: File not found: {file_path}")
        return 0
    except Exception as e:
        print(f"🔴 ERROR: Failed to process file {file_path}. Reason: {e}")
        return 0

def main():
    # --- Loop through each file and process it ---
    total_rows_loaded = 0
    for file_path in nc_files_to_process:
        filename = os.path.basename(file_path)
        print(f"\n--- Processing file: {filename} ---", end="")
        
        rows_loaded = process_profile_file(file_path, engine)
        total_rows_loaded += rows_loaded
        if rows_loaded > 0:
            print(f" ✅ Success: Loaded {rows_loaded} (sampled) rows.")

    print(f"\n--- Bulk ETL Process Finished ---")
    print(f"🎉 Total new (sampled) rows loaded into the database: {total_rows_loaded}")

