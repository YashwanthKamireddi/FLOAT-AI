import streamlit as st
import pandas as pd
import plotly.express as px
import re
import ast
from typing import Dict, Any, Optional
from ai_core.main_agent import run_ai_pipeline

# Page configuration
st.set_page_config(
    page_title="FloatChat – ARGO Explorer",
    page_icon="🌊",
    layout="wide"
)

def parse_sql_result_to_df(sql_query: str, result_string: str) -> Optional[pd.DataFrame]:
    """
    Parse SQL query result string into a pandas DataFrame.
    Extracts column names from SELECT clause and parses result tuples.
    """
    try:
        # Extract column names from SELECT clause
        select_pattern = r'SELECT\s+(.+?)\s+FROM'
        match = re.search(select_pattern, sql_query, re.IGNORECASE | re.DOTALL)
        
        if not match:
            return None
            
        columns_str = match.group(1).strip()
        
        # Split columns and clean them
        columns = []
        for col in columns_str.split(','):
            col = col.strip()
            # Remove alias (AS keyword)
            if ' AS ' in col.upper():
                col = col.upper().split(' AS ')[1].strip()
            # Remove table prefixes (table.column -> column)
            if '.' in col and not col.startswith('('):
                col = col.split('.')[-1]
            # Remove quotes
            col = col.strip('"\'`')
            columns.append(col)
        
        # Parse the result string safely
        if result_string.strip() == '[]' or not result_string.strip():
            return pd.DataFrame(columns=columns)
        
        # Safely evaluate the string as a list of tuples
        result_data = ast.literal_eval(result_string)
        
        if not result_data:
            return pd.DataFrame(columns=columns)
        
        # Create DataFrame
        df = pd.DataFrame(result_data, columns=columns)
        return df
        
    except Exception as e:
        st.error(f"Error parsing SQL result: {str(e)}")
        return None

def display_ocean_map(df: pd.DataFrame):
    """Display an interactive ocean map if latitude and longitude columns exist."""
    lat_cols = [col for col in df.columns if 'lat' in col.lower()]
    lon_cols = [col for col in df.columns if 'lon' in col.lower()]
    
    if not lat_cols or not lon_cols:
        st.info("No latitude/longitude columns found for mapping.")
        return
    
    lat_col = lat_cols[0]
    lon_col = lon_cols[0]
    
    # Check if we have valid coordinates
    valid_coords = df.dropna(subset=[lat_col, lon_col])
    if valid_coords.empty:
        st.info("No valid coordinates found for mapping.")
        return
    
    # Create map
    fig = px.scatter_mapbox(
        valid_coords, 
        lat=lat_col, 
        lon=lon_col,
        hover_data=df.columns.tolist(),
        zoom=2,
        height=500,
        title="ARGO Float Locations"
    )
    
    fig.update_layout(mapbox_style="open-street-map")
    fig.update_layout(margin={"r":0,"t":50,"l":0,"b":0})
    
    st.plotly_chart(fig, use_container_width=True)

def display_profiles(df: pd.DataFrame):
    """Display temperature and salinity profiles if pressure data exists."""
    pressure_cols = [col for col in df.columns if 'pressure' in col.lower()]
    temp_cols = [col for col in df.columns if 'temp' in col.lower()]
    sal_cols = [col for col in df.columns if 'sal' in col.lower()]
    
    if not pressure_cols:
        st.info("No pressure column found for profile plots.")
        return
    
    pressure_col = pressure_cols[0]
    
    col1, col2 = st.columns(2)
    
    with col1:
        if temp_cols:
            temp_col = temp_cols[0]
            valid_temp = df.dropna(subset=[pressure_col, temp_col])
            
            if not valid_temp.empty:
                fig_temp = px.line(
                    valid_temp, 
                    x=temp_col, 
                    y=pressure_col,
                    title="Temperature vs Depth Profile",
                    labels={temp_col: "Temperature (°C)", pressure_col: "Pressure (dbar)"}
                )
                fig_temp.update_yaxis(autorange="reversed")  # Invert pressure axis
                st.plotly_chart(fig_temp, use_container_width=True)
            else:
                st.info("No valid temperature/pressure data for profile.")
        else:
            st.info("No temperature column found.")
    
    with col2:
        if sal_cols:
            sal_col = sal_cols[0]
            valid_sal = df.dropna(subset=[pressure_col, sal_col])
            
            if not valid_sal.empty:
                fig_sal = px.line(
                    valid_sal, 
                    x=sal_col, 
                    y=pressure_col,
                    title="Salinity vs Depth Profile",
                    labels={sal_col: "Salinity (PSU)", pressure_col: "Pressure (dbar)"}
                )
                fig_sal.update_yaxis(autorange="reversed")  # Invert pressure axis
                st.plotly_chart(fig_sal, use_container_width=True)
            else:
                st.info("No valid salinity/pressure data for profile.")
        else:
            st.info("No salinity column found.")

def main():
    # Initialize session state
    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "latest_df" not in st.session_state:
        st.session_state.latest_df = None
    if "latest_sql" not in st.session_state:
        st.session_state.latest_sql = ""
    
    # Main title
    st.title("🌊 FloatChat – ARGO Explorer")
    st.markdown("Explore ARGO ocean data through natural language queries")
    
    # Two-column layout
    chat_col, viz_col = st.columns([1, 2])
    
    # Left Column - Chat Interface
    with chat_col:
        st.subheader("💬 Chat")
        
        # Display chat messages
        for message in st.session_state.messages:
            with st.chat_message(message["role"]):
                if message["type"] == "text":
                    st.markdown(message["content"])
                elif message["type"] == "dataframe":
                    st.dataframe(message["content"], use_container_width=True)
        
        # Chat input
        if prompt := st.chat_input("Ask about ARGO ocean data..."):
            # Add user message to chat history
            st.session_state.messages.append({
                "role": "user", 
                "type": "text",
                "content": prompt
            })
            
            # Display user message
            with st.chat_message("user"):
                st.markdown(prompt)
            
            # Display AI response
            with st.chat_message("assistant"):
                with st.spinner("Thinking..."):
                    try:
                        # Call the AI pipeline
                        response = run_ai_pipeline(prompt)
                        
                        if response.get("error"):
                            error_msg = f"❌ Error: {response['error']}"
                            st.error(error_msg)
                            st.session_state.messages.append({
                                "role": "assistant",
                                "type": "text", 
                                "content": error_msg
                            })
                        else:
                            # Parse the result into a DataFrame
                            sql_query = response.get("sql_query", "")
                            result_data = response.get("result_data", "")
                            
                            if sql_query and result_data:
                                df = parse_sql_result_to_df(sql_query, result_data)
                                
                                if df is not None and not df.empty:
                                    # Store the latest DataFrame and SQL
                                    st.session_state.latest_df = df
                                    st.session_state.latest_sql = sql_query
                                    
                                    success_msg = f"✅ Found {len(df)} records. Data updated in the exploration panel."
                                    st.success(success_msg)
                                    st.dataframe(df.head(), use_container_width=True)
                                    
                                    # Add to chat history
                                    st.session_state.messages.append({
                                        "role": "assistant",
                                        "type": "text",
                                        "content": success_msg
                                    })
                                    st.session_state.messages.append({
                                        "role": "assistant",
                                        "type": "dataframe",
                                        "content": df.head()
                                    })
                                else:
                                    no_data_msg = "No data found for your query."
                                    st.info(no_data_msg)
                                    st.session_state.messages.append({
                                        "role": "assistant",
                                        "type": "text",
                                        "content": no_data_msg
                                    })
                            else:
                                response_msg = "Query executed but no results returned."
                                st.info(response_msg)
                                st.session_state.messages.append({
                                    "role": "assistant",
                                    "type": "text",
                                    "content": response_msg
                                })
                        
                    except Exception as e:
                        error_msg = f"❌ An error occurred: {str(e)}"
                        st.error(error_msg)
                        st.session_state.messages.append({
                            "role": "assistant",
                            "type": "text",
                            "content": error_msg
                        })
    
    # Right Column - Data Exploration
    with viz_col:
        st.subheader("📊 Explore")
        
        if st.session_state.latest_df is not None and not st.session_state.latest_df.empty:
            df = st.session_state.latest_df
            
            # Create tabs for different visualizations
            analysis_tab, map_tab, profiles_tab, sql_tab = st.tabs([
                "📈 Analysis", "🗺️ Ocean Map", "📊 Profiles", "🔍 SQL Query"
            ])
            
            with analysis_tab:
                # Key metrics
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    st.metric("Records Found", len(df))
                
                with col2:
                    temp_cols = [col for col in df.columns if 'temp' in col.lower()]
                    if temp_cols:
                        avg_temp = df[temp_cols[0]].mean()
                        if pd.notna(avg_temp):
                            st.metric("Avg. Temperature", f"{avg_temp:.2f}°C")
                        else:
                            st.metric("Avg. Temperature", "N/A")
                    else:
                        st.metric("Temperature", "No data")
                
                with col3:
                    sal_cols = [col for col in df.columns if 'sal' in col.lower()]
                    if sal_cols:
                        avg_sal = df[sal_cols[0]].mean()
                        if pd.notna(avg_sal):
                            st.metric("Avg. Salinity", f"{avg_sal:.2f} PSU")
                        else:
                            st.metric("Avg. Salinity", "N/A")
                    else:
                        st.metric("Salinity", "No data")
                
                st.subheader("Raw Data")
                st.dataframe(df, use_container_width=True, height=400)
            
            with map_tab:
                display_ocean_map(df)
            
            with profiles_tab:
                display_profiles(df)
            
            with sql_tab:
                st.subheader("Generated SQL Query")
                st.code(st.session_state.latest_sql, language="sql")
        
        else:
            st.info("🎯 Ask a question about ARGO data to see visualizations here!")
            st.markdown("""
            **Example queries:**
            - "Show me temperature data from the North Atlantic"
            - "Find salinity measurements deeper than 1000 meters"
            - "What's the temperature profile for float 1901393?"
            """)

if __name__ == "__main__":
    main()