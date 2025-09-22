# This is a powerful utility for the Data Squad. It acts as a "Data Quality Checker".
# It scans all .nc files, performs the standard transformation, and then checks
# if the resulting data is valid (i.e., not empty or full of null values).
# This script should be run AFTER the attribute_inspector.py and BEFORE the final ETL load.

import os
import xarray as xr
import pandas as pd

# --- Configuration ---
root_data_folder = 'nc files'

print(f"--- 🌊 Starting Data Quality Checker for folder: '{root_data_folder}' ---\n")

# --- Recursively find all profile files ---
nc_files_to_check = []
for root, dirs, files in os.walk(root_data_folder):
    for file in files:
        if file.endswith('.nc') and (file.startswith('D') or file.startswith('R')):
            nc_files_to_check.append(os.path.join(root, file))

if not nc_files_to_check:
    print(f"⚠️ No profile (.nc) files found in '{root_data_folder}'. Exiting.")
    exit()

print(f"Found {len(nc_files_to_check)} profile files to check for valid data.\n")
print("="*50)

# --- Loop through each file and check its data content ---
flagged_files = [] # We'll store any bad files here

for file_path in nc_files_to_check:
    filename = os.path.basename(file_path)
    
    try:
        dataset = xr.open_dataset(file_path)
        argo_df = dataset.to_dataframe().reset_index()

        # Perform the same smart attribute selection as the ETL script
        column_map = {}
        potential_names = {
            'temperature': ['temp_adjusted', 'TEMP_ADJUSTED'],
            'salinity': ['psal_adjusted', 'PSAL_ADJUSTED'],
            'pressure': ['pres_adjusted', 'PRES_ADJUSTED']
        }
        
        # We only need to find the core measurement columns for this check
        for clean_name, ugly_names in potential_names.items():
            for ugly_name in ugly_names:
                if ugly_name in argo_df.columns:
                    column_map[ugly_name] = clean_name
                    break
        
        if len(column_map) != 3:
            raise ValueError("File is missing one or more core measurement variables (temp, psal, pres).")

        final_df = argo_df[list(column_map.keys())].copy()
        final_df.rename(columns=column_map, inplace=True)

        # --- Data Quality Checks ---
        if final_df.empty:
            flagged_files.append((filename, "File is empty; contains no data rows."))
            continue # Move to the next file

        # Check if all core measurement values are null (NaN)
        if final_df['temperature'].isnull().all() and final_df['salinity'].isnull().all():
            flagged_files.append((filename, "All temperature and salinity values are null (NaN)."))
            continue

        # Check if all values in a column are the same (e.g., all zeroes)
        if final_df['temperature'].std() == 0 and final_df['pressure'].std() == 0:
            flagged_files.append((filename, "All measurement values are identical (e.g., all zeroes)."))
            continue

    except Exception as e:
        flagged_files.append((filename, f"Failed to process or read. Error: {e}"))

# --- Final Report ---
print("\n--- Data Quality Report ---")
if not flagged_files:
    print("\n✅ SUCCESS: All scanned files appear to contain valid, non-empty data.")
else:
    print(f"\n⚠️ WARNING: Found {len(flagged_files)} potentially problematic files.")
    for filename, reason in flagged_files:
        print(f"\n📄 File: {filename}")
        print(f"   └── 🔴 Issue: {reason}")
print("\n" + "="*50)
print("\n--- Checker Finished ---")


### What to Do Now

#1.  **Save this code** as a new file named `data_quality_checker.py` in your `FLOATCHAT` folder.
#2.  **Run it from your terminal:**
#    ```bash
#    python data_quality_checker.py
    
