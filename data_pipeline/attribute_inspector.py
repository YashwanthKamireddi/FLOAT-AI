# This is an upgraded, intelligent utility for the Data Squad.
# It scans all .nc files, determines a "common" set of attributes based on the first file,
# and then reports only the files that have different attributes, specifying what's missing or extra.

import os
import xarray as xr

# --- Configuration ---
root_data_folder = 'nc files'

print(f"--- 🌊 Starting Smart ARGO Attribute Inspector for folder: '{root_data_folder}' ---\n")

# --- Phase 1: Scan all files and collect their attributes ---
all_files_attributes = {}
nc_files_to_inspect = []

for root, dirs, files in os.walk(root_data_folder):
    for file in files:
        if file.endswith('.nc') and (file.startswith('D') or file.startswith('R')):
            nc_files_to_inspect.append(os.path.join(root, file))

if not nc_files_to_inspect:
    print(f"⚠️ No profile (.nc) files found in '{root_data_folder}'. Exiting.")
    exit()

print(f"Found {len(nc_files_to_inspect)} profile files to scan...")

for file_path in nc_files_to_inspect:
    filename = os.path.basename(file_path)
    try:
        with xr.open_dataset(file_path) as dataset:
            # Store the attributes as a set for easy comparison
            all_files_attributes[filename] = set(dataset.data_vars.keys())
    except Exception as e:
        print(f"⚠️ Could not read {filename}. Skipping. Error: {e}")

if not all_files_attributes:
    print("Could not successfully read any files. Exiting.")
    exit()

print(f"Successfully scanned {len(all_files_attributes)} files.\n")

# --- Phase 2: Analyze the attributes for consistency ---

# Use the first successfully scanned file as the "gold standard"
first_file_name = list(all_files_attributes.keys())[0]
base_attributes = all_files_attributes[first_file_name]

print("="*50)
print(f"Common Attribute Set (based on '{first_file_name}'):")
for var in sorted(list(base_attributes)):
    print(f"  - {var}")
print("="*50)

# Find any files that have a different set of attributes
inconsistent_files = []
for filename, attributes in all_files_attributes.items():
    if attributes != base_attributes:
        inconsistent_files.append(filename)

# --- Phase 3: Report the findings ---
if not inconsistent_files:
    print("\n✅ SUCCESS: All scanned files have a consistent set of data variables.")
else:
    print(f"\n⚠️ WARNING: Found {len(inconsistent_files)} files with inconsistent attributes.")
    for filename in inconsistent_files:
        print(f"\n📄 Details for: {filename}")
        file_attributes = all_files_attributes[filename]
        
        missing_vars = base_attributes - file_attributes
        if missing_vars:
            print("   └── 🔴 Missing Attributes:")
            for var in sorted(list(missing_vars)):
                print(f"       - {var}")

        extra_vars = file_attributes - base_attributes
        if extra_vars:
            print("   └── 🟡 Extra Attributes:")
            for var in sorted(list(extra_vars)):
                print(f"       - {var}")

print("\n--- Inspector Finished ---")

