import plotly.express as px
import pandas as pd

def create_map(df: pd.DataFrame):
    if not all(col in df.columns for col in ["latitude", "longitude"]): return None
    return px.scatter_mapbox(df, lat="latitude", lon="longitude", zoom=2, height=400,
                           hover_name="float_id", color_discrete_sequence=["#1f7ae0"],
                           mapbox_style="carto-positron", title="Float Locations") \
           .update_layout(margin={"r":0,"t":30,"l":0,"b":0})

def create_profile_plot(df: pd.DataFrame):
    if not all(col in df.columns for col in ["temperature", "pressure"]): return None
    fig = px.line(df, x="temperature", y="pressure", title="Temperature vs. Depth Profile",
                  labels={'temperature': 'Temperature (°C)', 'pressure': 'Pressure (dbar)'})
    fig.update_yaxes(autorange="reversed")
    return fig

def create_salinity_plot(df: pd.DataFrame):
    if not all(col in df.columns for col in ["salinity", "pressure"]): return None
    fig = px.line(df, x="salinity", y="pressure", title="Salinity vs. Depth Profile",
                  labels={'salinity': 'Salinity (PSU)', 'pressure': 'Pressure (dbar)'})
    fig.update_yaxes(autorange="reversed")
    return fig
