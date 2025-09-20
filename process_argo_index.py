import os
import requests

# Define the download directory
download_dir = 'argo_nc_files'
os.makedirs(download_dir, exist_ok=True)

# Filter the DataFrame for profiles of interest
# For example, selecting the first 10 profiles
profiles_to_download = df.head(10)

# Base URL for Argo data
base_url = 'https://data-argo.ifremer.fr/ifremer/argo/dac/'

# Loop through the profiles and download the corresponding .nc files
for _, row in profiles_to_download.iterrows():
    file_path = row['file']
    url = base_url + file_path
    local_path = os.path.join(download_dir, os.path.basename(file_path))

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        with open(local_path, 'wb') as f:
            f.write(response.content)
        print(f"Downloaded {file_path}")
    except requests.RequestException as e:
        print(f"Failed to download {file_path}: {e}")
