import os
import requests

# Base URL for the data
base_url = "https://data-argo.ifremer.fr/dac/incois/"

# List of float IDs
float_ids = [
    "2902273", "7901128", "7901125", "6990610", "5907084", "4903838",
    "2903953", "2902223", "1902677", "1902672", "4903875", "2902201",
    "2900533", "2900464", "2902272", "2902222", "5907192", "5907180",
    "5907083", "4903775"
]

def download_profiles(float_id):
    """Download all .nc files from the profiles subfolder for a given float ID"""
    profiles_url = f"{base_url}{float_id}/profiles/"
    
    # Get the list of files in the profiles directory
    try:
        response = requests.get(profiles_url)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"Failed to access {profiles_url}: {e}")
        return
        
    # Parse the HTML to find all .nc files (this is a simple approach)
    # A more robust solution would use BeautifulSoup or similar
    files = []
    for line in response.text.split('\n'):
        if '.nc"' in line:
            file_start = line.find('href="') + len('href="')
            file_end = line.find('"', file_start)
            file_name = line[file_start:file_end]
            if file_name.endswith('.nc'):
                files.append(file_name)
    
    if not files:
        print(f"No .nc files found in {profiles_url}")
        return
    
    # Create local profiles directory if it doesn't exist
    local_profiles_dir = os.path.join(float_id, "profiles")
    os.makedirs(local_profiles_dir, exist_ok=True)
    
    # Download each file
    for file_name in files:
        file_url = f"{profiles_url}{file_name}"
        local_path = os.path.join(local_profiles_dir, file_name)
        
        # Skip if file already exists
        if os.path.exists(local_path):
            print(f"Skipping {file_url} (already exists)")
            continue
            
        try:
            print(f"Downloading {file_url}...")
            response = requests.get(file_url, stream=True)
            response.raise_for_status()
            
            with open(local_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Saved to {local_path}")
        except requests.exceptions.RequestException as e:
            print(f"Failed to download {file_url}: {e}")

# Download profiles for all float IDs
for float_id in float_ids:
    print(f"\nProcessing float ID: {float_id}")
    download_profiles(float_id)

print("\nDownload complete!")