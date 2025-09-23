# This is the final, integrated application script.
# It lives in the root directory to solve all import issues.

import streamlit as st
import pandas as pd
import re
import ast

# --- AI Core & Utils Integration ---
# Now that this script is in the root, these imports work perfectly.
from ai_core.main_agent import run_ai_pipeline
from utils.visuals import create_map, create_profile_plot, create_salinity_plot

# --- Page Configuration & Styling ---
st.set_page_config(
    page_title="FloatChat – ARGO Explorer",
    layout="wide",
)
# Your friend's excellent custom CSS
st.markdown(
    """
    <style>
    :root{
      --ocean-bg1:#f8fbff; --ocean-bg2:#f3f8ff; --ocean-bg3:#edf5ff;
      --ocean-accent:#1f7ae0; --ocean-accent-2:#58abff; --ocean-muted:#6a839e;
      --ocean-text:#0a263f; --ocean-card:#ffffff; --ocean-border:#d9e8f7;
      --ocean-shadow: 0 10px 24px rgba(16, 86, 169, 0.10);
      --ocean-radius: 16px;
    }
    .stApp header { background: transparent; }
    .block-container { padding-top: 2rem; padding-bottom: 2rem; }
    h1, h2, h3 { color: var(--ocean-text) !important; }
    .stDataFrame, .stAlert, div[data-testid="stMetric"] {
      border-radius: var(--ocean-radius);
      border: 1px solid var(--ocean-border);
      background: rgba(255,255,255,0.85);
      box-shadow: var(--ocean-shadow);
    }
    div[data-testid="stMetric"] { padding: 8px 12px; }
    div[data-testid="stChatMessage"] > div{
      border-radius: 20px; box-shadow: var(--ocean-shadow);
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# --- Helper Function ---
def parse_sql_result_to_df(sql_query: str, result_string: str) -> pd.DataFrame:
    if not result_string or result_string.strip() == "[]":
        return pd.DataFrame()
    try:
        match = re.search(r"SELECT\s+(.*?)\s+FROM", sql_query, re.IGNORECASE | re.DOTALL)
        if not match: return pd.DataFrame()
        columns = [c.strip().replace('"', '') for c in match.group(1).split(',')]
        data = ast.literal_eval(result_string)
        df = pd.DataFrame(data, columns=columns)
        for col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='ignore')
        return df
    except Exception as e:
        print(f"Error parsing DataFrame: {e}")
        st.warning(f"Could not parse data. Raw result: ```{result_string}```")
        return pd.DataFrame()

# --- App State & UI ---
st.title("FloatChat 🌊")
st.caption("AI-powered conversational interface for ARGO ocean data.")

if "messages" not in st.session_state:
    st.session_state.messages = [{"role": "assistant", "content": "How can I help you explore the ARGO data?"}]

left_col, right_col = st.columns([1.0, 1.5], gap="large")

with left_col:
    st.subheader("Chat")
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            if isinstance(msg.get("content"), pd.DataFrame):
                st.dataframe(msg["content"])
            else:
                st.markdown(msg["content"])

    if user_question := st.chat_input("Ask 'Show 5 floats near India'"):
        st.session_state.messages.append({"role": "user", "content": user_question})
        with st.chat_message("user"):
            st.markdown(user_question)

        with st.chat_message("assistant"):
            with st.spinner("🧠 Thinking..."):
                response = run_ai_pipeline(user_question)
                error = response.get("error")
                if error:
                    response_content = f"Sorry, an error occurred: {error}"
                else:
                    df = parse_sql_result_to_df(response.get("sql_query"), response.get("result_data"))
                    if not df.empty:
                        response_content = df
                    else:
                        response_content = response.get("result_data", "I couldn't find any data for that query.")

            if isinstance(response_content, pd.DataFrame):
                st.dataframe(response_content)
            else:
                st.markdown(response_content)
            
            st.session_state.messages.append({"role": "assistant", "content": response_content})
            st.rerun()

with right_col:
    st.subheader("Explore the Results")
    # Find the latest DataFrame in the chat history to display
    latest_df = pd.DataFrame()
    for msg in reversed(st.session_state.messages):
        if isinstance(msg.get("content"), pd.DataFrame):
            latest_df = msg["content"]
            break

    if latest_df.empty:
        st.info("Ask a question to see results and visualizations here.")
    else:
        analysis_tab, map_tab, profiles_tab = st.tabs(["📊 Analysis", "🗺️ Ocean Map", "📈 Profiles"])
        with analysis_tab:
            st.markdown("#### Key Metrics")
            m1, m2, m3 = st.columns(3)
            m1.metric("Floats Found", latest_df['float_id'].nunique())
            m2.metric("Avg. Temperature", f"{latest_df['temperature'].mean():.2f} °C" if 'temperature' in latest_df else "N/A")
            m3.metric("Avg. Salinity", f"{latest_df['salinity'].mean():.2f} PSU" if 'salinity' in latest_df else "N/A")
            st.markdown("#### Raw Data")
            st.dataframe(latest_df)

        with map_tab:
            st.plotly_chart(create_map(latest_df), use_container_width=True)
        with profiles_tab:
            st.plotly_chart(create_profile_plot(latest_df), use_container_width=True)
            st.plotly_chart(create_salinity_plot(latest_df), use_container_width=True)

