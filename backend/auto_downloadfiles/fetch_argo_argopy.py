# fetch_argo_argopy.py
# Purpose: robust argopy fetch for lon 68..76, lat 8..20, date 2023-03-01..2023-03-05
# Usage: python fetch_argo_argopy.py
import os, sys, time
import pandas as pd

try:
    import argopy
    from argopy import DataFetcher
except Exception as e:
    print("Missing argopy/xarray. Install with: pip install argopy xarray netCDF4 pandas pyarrow certifi")
    raise

# --- PARAMETERS you can change if you want ---
LON_MIN, LON_MAX = 68.0, 76.0
LAT_MIN, LAT_MAX = 8.0, 20.0
START_DATE, END_DATE = "2023-03-01", "2023-03-05"
OUT_NETCDF = "argo_indian_subset.nc"
OUT_PARQUET = "argo_indian_subset.parquet"
SAMPLE_NETCDF = "argo_sample.nc"
# -------------------------------------------

def run_argopy_fetch(src="erddap", ftp_root="https://data-argo.ifremer.fr"):
    """
    Try argopy DataFetcher with chosen src. Returns ArgoSet (object) on success.
    """
    print(f"[INFO] argopy options src={src} ftp={ftp_root}")
    argopy.set_options(src=src, ftp=ftp_root)
    box = [LON_MIN, LON_MAX, LAT_MIN, LAT_MAX, 0.0, 2000.0, START_DATE, END_DATE]
    print("[INFO] Request box:", box)
    try:
        fetcher = DataFetcher().region(box)
        # .load() will fetch index and netcdf files as needed
        argo_set = fetcher.load(progress=True)
        return argo_set
    except Exception as e:
        print(f"[WARN] fetch failed for src={src}: {e}")
        return None

def save_outputs(argo_set):
    # Convert to xarray and to pandas (flattened) safely
    print("[INFO] Converting to xarray Dataset...")
    ds = argo_set.to_xarray()
    print(ds)
    print("[INFO] Saving netCDF:", OUT_NETCDF)
    try:
        ds.to_netcdf(OUT_NETCDF)
    except Exception as e:
        print("[WARN] netcdf save failed:", e)
    # Save flattened table (observations) as parquet
    print("[INFO] Converting to DataFrame and saving parquet:", OUT_PARQUET)
    df = argo_set.to_dataframe()
    df.to_parquet(OUT_PARQUET, index=False)
    print("[DONE] Wrote:", OUT_NETCDF, OUT_PARQUET)

def quick_test_single_day(src="erddap", ftp_root="https://data-argo.ifremer.fr"):
    """
    Run one-day test to verify connectivity and that argopy can fetch a small chunk.
    """
    test_start = START_DATE  # single day test
    test_end = START_DATE
    argopy.set_options(src=src, ftp=ftp_root)
    box = [LON_MIN, LON_MAX, LAT_MIN, LAT_MAX, 0.0, 2000.0, test_start, test_end]
    print(f"[TEST] single-day test box: {box}")
    try:
        ar = DataFetcher().region(box).load(progress=False)
        # save a tiny NetCDF sample
        print("[TEST] sample rows/summary:")
        try:
            df = ar.to_dataframe()
            print(df.head())
            # Save first profile/netcdf if possible
            print("[TEST] saving sample netcdf:", SAMPLE_NETCDF)
            ds = ar.to_xarray()
            ds.to_netcdf(SAMPLE_NETCDF)
            print("[TEST] sample saved")
            return True, ar
        except Exception as ex:
            print("[TEST] conversion to dataframe/xarray failed:", ex)
            return False, None
    except Exception as e:
        print("[TEST] fetch failed:", e)
        return False, None

def main():
    print("=== argopy Argo fetch: Indian box March 2023 ===")
    # 1) quick test: try ERDDAP first (fast)
    ok, arset = quick_test_single_day(src="erddap", ftp_root="https://erddap.ifremer.fr")
    if not ok:
        # 2) fallback: try GDAC index via Ifremer HTTPS root (more reliable for downloads)
        print("[INFO] Falling back to GDAC/Ifremer https root")
        ok2, arset = quick_test_single_day(src="gdac", ftp_root="https://data-argo.ifremer.fr")
        if not ok2:
            # 3) last attempt: GDAC with ftp root (sometimes helpful)
            print("[INFO] Falling back to GDAC with ftp root (ftp://ftp.ifremer.fr/ifremer/argo/)")
            ok3, arset = quick_test_single_day(src="gdac", ftp_root="ftp://ftp.ifremer.fr/ifremer/argo/")
            if not ok3:
                print("[ERROR] All quick tests failed. See SSL/503 advice. You can still use the index file to download specific NetCDFs.")
                sys.exit(2)
    # If we reached here we have an arset (from test). Proceed to full fetch (same src that worked)
    print("[INFO] Full fetch: this may take time; small box/date range should be OK")
    # Use the same src/ftp root currently set in argopy options
    full = run_argopy_fetch(src=argopy.get_options().get("src","gdac"), ftp_root=argopy.get_options().get("ftp", "https://data-argo.ifremer.fr"))
    if full is None:
        print("[ERROR] Full fetch failed even after test success. Try reducing date range or chunking manually.")
        sys.exit(3)
    # Save outputs
    save_outputs(full)
    print("[SUCCESS] Completed fetch and saved outputs.")

if __name__ == "__main__":
    main()
