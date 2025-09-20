# check_and_download_from_index.py
# Usage: python check_and_download_from_index.py
import pandas as pd
import os
import requests
from urllib.parse import urljoin

INDEX_URL = "https://data-argo.ifremer.fr/ar_index_global_prof.txt"
HTTP_ROOT = "https://data-argo.ifremer.fr/"

# YOUR BOX / DATES - tweak these if needed
LON_MIN, LON_MAX = 68.0, 76.0
LAT_MIN, LAT_MAX = 8.0, 20.0
START = "2023-03-01"   # inclusive
END   = "2023-03-05"   # inclusive

# how many netcdf files to download as a test
N_DOWNLOAD = 3

def load_index():
    print("Downloading index (this may take a few seconds)...")
    df = pd.read_csv(INDEX_URL, comment='#', header=0)
    # index has columns: file,date,latitude,longitude,ocean,profiler_type,institution,date_update (common)
    # convert date if it's numeric like YYYYMMDDHHMISS or text
    try:
        df['date'] = pd.to_datetime(df['date'], format='%Y%m%d%H%M%S')
    except Exception:
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
    return df

def filter_index(df):
    mask = (
        df['longitude'].between(LON_MIN, LON_MAX) &
        df['latitude'].between(LAT_MIN, LAT_MAX) &
        df['date'].between(START, END)
    )
    sel = df[mask].copy()
    return sel

def show_and_download(sel):
    print(f"Matches found: {len(sel)}")
    if len(sel) == 0:
        print("No profiles in index for that range. Try expanding the box or date range.")
        return
    # show first 10
    display_cols = ['file','date','latitude','longitude','ocean','institution']
    print("\nFirst 10 matches:")
    print(sel[display_cols].head(10).to_string(index=False))
    # build URLs and show
    sel['url'] = sel['file'].apply(lambda f: urljoin(HTTP_ROOT, f))
    print("\nFirst 10 download URLs:")
    for u in sel['url'].head(10).tolist():
        print(u)
    # create profiles dir and download first N
    os.makedirs('profiles_test', exist_ok=True)
    to_download = sel['url'].head(N_DOWNLOAD).tolist()
    for url in to_download:
        fn = os.path.join('profiles_test', os.path.basename(url))
        if os.path.exists(fn):
            print("Already exists:", fn)
            continue
        print("Downloading:", url)
        try:
            r = requests.get(url, stream=True, timeout=60)
            r.raise_for_status()
            with open(fn, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            print("Saved:", fn)
        except Exception as e:
            print("Download failed:", e)
            print("You can try the FTP root or check network/SSL.")
            break

def main():
    df = load_index()
    sel = filter_index(df)
    show_and_download(sel)

if __name__ == "__main__":
    main()
