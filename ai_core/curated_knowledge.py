# This file contains the curated "cheat sheet" for the AI.
# It's a simple list of facts that describe our PostgreSQL database.
# By keeping it in its own file, we can easily update the AI's knowledge
# without touching the main vector database script.

knowledge = [
    "For FloatAI prototype, the required attributes are: float_id, profile_date, latitude, longitude, pressure , temperature , salinity . Optionally include QC flags (PRES_QC, TEMP_QC, PSAL_QC).",
    "float_id can be derived from the folder name under /dac/incois/ or directly from the index file paths (e.g. dac/incois/2902273/ -> float_id=2902273).",
    "Pressure is stored inside *_prof.nc files under variable PRES. It is a 1D or 2D array per profile, representing depth levels.",
    "Temperature is stored inside *_prof.nc files under variable TEMP. Often given as potential temperature at measured depths. Each value has a QC flag TEMP_QC.",
    "Salinity is stored inside *_prof.nc files under variable PSAL. Each value has a QC flag PSAL_QC. Delayed-mode files may contain adjusted versions PSAL_ADJUSTED.",
    "Convert NetCDF to relational schema in PostgreSQL. Example schema: argo_profiles(float_id INT, profile_date TIMESTAMP, latitude FLOAT, longitude FLOAT, pres FLOAT, temp FLOAT, psal FLOAT). One row per depth-level reading.",
    "User: 'Show me salinity near equator in March 2023' -> LLM maps to: SELECT * FROM argo_profiles WHERE ABS(latitude)<5 AND profile_date BETWEEN '2023-03-01' AND '2023-03-31';",
    "The database does not contain Quality Control (QC) flags or Bio-Geo-Chemical (BGC) parameters like oxygen.",
    "The primary data is stored in a PostgreSQL table named argo_profiles.",
    "The argo_profiles table has the following columns: float_id, profile_date, latitude, longitude, pressure, temperature, and salinity.",
    "The 'temperature' column is sea water temperature in Celsius.",
    "The 'salinity' column is the practical salinity of the water.",
    "The 'pressure' column is a proxy for depth in decibars.",

    # --- NEW STRATEGIC HINTS ---
    "IMPORTANT CONTEXT: The available data is primarily from floats deployed by India (INCOIS) and is concentrated in the Arabian Sea and the Bay of Bengal, roughly between latitude 0 to 25 North and longitude 60 to 100 East.",
    "IMPORTANT CONTEXT: The dataset contains profiles primarily from recent years (2020-2025). When a user asks for recent data, this is the time frame to consider.",

    # --- Original Rules ---
    "To answer a question like 'Show me salinity near the equator', you should write a query like: SELECT * FROM argo_profiles WHERE latitude BETWEEN -5 AND 5;",
    "The database does not contain Quality Control (QC) flags or Bio-Geo-Chemical (BGC) parameters."
]
