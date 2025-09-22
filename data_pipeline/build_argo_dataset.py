# build_argo_dataset.py - minimal working argopy fetch (fixed region format)
import argopy
from argopy import DataFetcher

# point to Ifremer GDAC server (optional but reliable)
argopy.set_options(src="gdac", server="https://data-argo.ifremer.fr")

# REGION = [lon_min, lon_max, lat_min, lat_max, pres_min, pres_max, time_min, time_max]
REGION = [68.0, 76.0, 8.0, 20.0, 0.0, 2000.0, "2023-03-05", "2023-03-06"]

print("Requesting region:", REGION)
fetcher = DataFetcher().region([68, 76, 8, 20, 0.0, 2000.0, "2023-03-05", "2023-03-06"])


# Convert to xarray, print summary
ds = fetcher.to_xarray()
print(ds)

# Flatten to dataframe and save CSV
df = fetcher.to_dataframe()
df.to_csv("argo_sample.csv", index=False)
print("Saved argo_sample.csv with", len(df), "rows")
