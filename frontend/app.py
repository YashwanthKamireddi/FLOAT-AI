import json
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from streamlit_folium import st_folium
import folium

try:
    import pydeck as pdk
    HAS_PYDECK = True
except Exception:
    HAS_PYDECK = False


# ---------------------------
# App Config
# ---------------------------
st.set_page_config(
    page_title="Ocean Gate – ARGO Chat + Explorer",
    layout="wide",
)

# UI theme: Light blue (daylight) + polished buttons + docked chat input
st.markdown(
    """
    <style>
    :root{
      /* Card-first light palette with ocean accents */
      --ocean-bg1:#f8fbff; --ocean-bg2:#f3f8ff; --ocean-bg3:#edf5ff;
      --ocean-accent:#1f7ae0; --ocean-accent-2:#58abff; --ocean-muted:#6a839e;
      --ocean-text:#0a263f; --ocean-card:#ffffff; --ocean-border:#d9e8f7;
      --ocean-shadow: 0 10px 24px rgba(16, 86, 169, 0.10);
      --ocean-radius: 16px;
      --ocean-transition: all .18s ease;
    }
    /* App background */
    [data-testid="stAppViewContainer"]{
      background: radial-gradient(1400px 900px at 70% -10%, var(--ocean-bg3) 0%, var(--ocean-bg2) 45%, var(--ocean-bg1) 100%) fixed;
      color: var(--ocean-text);
    }
    .stApp header { background: transparent; }
    .block-container { padding-top: 12px; padding-bottom: 240px; }

    /* Headings */
    h1, h2, h3, h4, h5, h6 { color: var(--ocean-text) !important; }
    .stMarkdown, .stCaption, .stText { color: var(--ocean-text); }

    /* Brand title chip */
    .og-brand{ display:inline-block; padding:12px 20px; border-radius: 18px;
      background: var(--ocean-card); border: 1px solid var(--ocean-border);
      box-shadow: var(--ocean-shadow); color: var(--ocean-text); font-weight: 800;
      font-size: 28px; line-height: 1.1; letter-spacing: .3px; outline: none; }
    .og-brand * { outline: none; }
    /* Fade-in for rest of content after brand settles */
    .block-container > *{ opacity: 1; }
    

    /* Cards and widgets */
    /* Card surfaces (exclude generic layout containers to avoid long bars) */
    .stDataFrame, .st-emotion-cache-card, .stAlert, .stTextArea, .stSelectbox, .stDateInput, .stTextInput{
      border-radius: var(--ocean-radius);
      border: 1px solid var(--ocean-border);
      background: rgba(255,255,255,0.85);
      box-shadow: var(--ocean-shadow);
      backdrop-filter: blur(6px);
      transition: var(--ocean-transition);
    }
    /* Ensure alerts (e.g., info boxes) have readable dark text */
    .stAlert, .stAlert *{ color: #334155 !important; }
    /* Ensure summary tables render with dark text on light theme */
    div[data-testid="stTable"],
    div[data-testid="stTable"] *{
      color: #0a263f !important;
    }
    /* Generic card wrapper utility */
    .og-card{ background: rgba(255,255,255,0.9); border: 1px solid var(--ocean-border);
      border-radius: 16px; box-shadow: var(--ocean-shadow); padding: 12px 14px; }
    /* Info grid blocks */
    .og-info-grid{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .og-info-card{ background: rgba(255,255,255,0.95); border: 1px solid var(--ocean-border);
      border-radius: 16px; box-shadow: var(--ocean-shadow); padding: 14px 16px; }
    .og-info-card .lbl{ color: var(--ocean-muted); font-weight: 600; font-size: 12px; letter-spacing: .4px; text-transform: uppercase; }
    .og-info-card .val{ color: var(--ocean-text); font-weight: 800; font-size: 22px; margin-top: 6px; }
    /* Style the chat container block that includes a marker .og-chat-root */
    div[data-testid="stVerticalBlock"]:has(> .og-chat-root){
      background: rgba(255,255,255,0.75);
      border: 1px solid var(--ocean-border);
      border-radius: 20px;
      box-shadow: var(--ocean-shadow);
      padding: 16px 18px 28px;
    }
    .stDataFrame:hover, .element-container:hover, .stTextArea:hover,
    .stSelectbox:hover, .stDateInput:hover, .stTextInput:hover{
      transform: translateY(-1px);
      box-shadow: 0 8px 22px rgba(15, 76, 129, 0.18);
    }
    /* Do not apply hover transform to the chat input wrapper */
    .element-container:has(> div[data-testid="stChatInput"]):hover{
      transform: none !important;
      box-shadow: none !important;
    }
    .element-container:has(> div[data-testid="stChatInput"]) {
      transform: none !important;
    }

    /* Tabs */
    div[role="tablist"]{ gap: 8px; }
    div[role="tablist"] button[role="tab"]{
      color: var(--ocean-muted); background: var(--ocean-card); border-radius: 20px; border: 1px solid var(--ocean-border);
      padding: 8px 14px; box-shadow: var(--ocean-shadow);
    }
    div[role="tablist"] button[role="tab"][aria-selected="true"]{
      color: var(--ocean-text); border-color: var(--ocean-accent); box-shadow: 0 8px 22px rgba(16,86,169,.15);
    }
    /* Override red underline highlight to blue */
    div[role="tablist"] > div[data-baseweb="tab-highlight"],
    .stTabs [data-baseweb="tab-highlight"]{
      background-color: var(--ocean-accent) !important;
      height: 3px !important;
      border-radius: 3px !important;
    }

    /* Buttons */
    .stButton>button { 
      white-space: nowrap; border-radius: 10px; border: 1px solid var(--ocean-accent);
      background: linear-gradient(135deg, var(--ocean-accent), var(--ocean-accent-2));
      color: #ffffff; font-weight: 600; transition: transform .15s, box-shadow .15s;
    }
    .stButton>button:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(15,76,129,.25); }

    /* History/Filters popover panel buttons */
    div[data-testid="stPopover"] .stButton>button { transition: all .15s ease-in-out; }
    div[data-testid="stPopover"] .stButton>button:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 18px rgba(15,76,129,.25);
        background: var(--ocean-accent) !important;
        border-color: var(--ocean-accent) !important;
        color: #ffffff !important;
        letter-spacing: .2px;
    }
    /* Popover trigger buttons (Filters / History) */
    /* Streamlit sometimes assigns different testids; override both */
    div[data-testid="stPopover"] > button,
    button[data-testid="baseButton-secondary"],
    div[data-testid="stPopover"] button[data-testid] {
      background: #eef2f7 !important; /* washed-out grey pill */
      color: var(--ocean-text) !important;
      border: 1px solid #d9e1ea !important;
      border-radius: 14px !important;
      box-shadow: var(--ocean-shadow) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 8px 14px !important;
      cursor: pointer !important;
      pointer-events: auto !important; /* ensure clicks register on whole pill */
    }
    /* Ensure inner text/icon adopt readable dark text */
    div[data-testid="stPopover"] > button *,
    button[data-testid="baseButton-secondary"] *,
    div[data-testid="stPopover"] button[data-testid] * { 
      color: var(--ocean-text) !important; 
      fill: var(--ocean-text) !important; 
      pointer-events: none !important; /* avoid child capturing preventing click */
    }
    div[data-testid="stPopover"] > button svg,
    button[data-testid="baseButton-secondary"] svg,
    div[data-testid="stPopover"] button[data-testid] svg { stroke: var(--ocean-text) !important; }
    /* Fix dropdown caret for both pills: consistent color and no square bg */
    div[data-testid="stPopover"] button svg,
    div[data-testid="stPopover"] button svg *{
      fill: var(--ocean-text) !important; /* arrow color */
      stroke: var(--ocean-text) !important;
    }
    div[data-testid="stPopover"] button svg rect,
    button[data-testid="baseButton-secondary"] svg rect{
      fill: transparent !important; /* remove square background behind arrow */
    }
    div[data-testid="stPopover"] > button [data-baseweb],
    div[data-testid="stPopover"] > button span[aria-hidden="true"]{
      background: transparent !important; /* guard for any icon wrapper background */
    }
    div[data-testid="stPopover"] > button:hover {
      border-color: var(--ocean-accent) !important;
      box-shadow: 0 10px 22px rgba(16,86,169,.18) !important;
    }
    /* Popover content card */
    div[data-testid="stPopoverContent"] { 
      background: var(--ocean-card) !important; color: var(--ocean-text) !important; 
      border: 1px solid var(--ocean-border) !important; border-radius: 20px !important; 
      box-shadow: 0 16px 30px rgba(16,86,169,.18) !important; 
      padding: 16px !important;
    }
    /* Uniform inputs inside Filters popover */
    div[data-testid="stPopoverContent"] .stDateInput,
    div[data-testid="stPopoverContent"] .stTextInput,
    div[data-testid="stPopoverContent"] .stSelectbox,
    div[data-testid="stPopoverContent"] .stTextArea {
      background: #ffffff !important;
      border: 1px solid var(--ocean-border) !important;
      border-radius: 14px !important;
      box-shadow: var(--ocean-shadow);
      margin-bottom: 12px !important;
    }
    div[data-testid="stPopoverContent"] label, 
    div[data-testid="stPopoverContent"] .stMarkdown,
    div[data-testid="stPopoverContent"] .stCaption { color: var(--ocean-text) !important; }
    div[data-testid="stPopoverContent"] .stSlider > div { border-radius: 12px; }

    /* KPI metrics (Profiles tab): ensure dark text for label and value */
    div[data-testid="stMetric"] div[data-testid="stMetricLabel"],
    div[data-testid="stMetric"] div[data-testid="stMetricValue"],
    div[data-testid="stMetric"] *{
      color: var(--ocean-text) !important;
    }
    div[data-testid="stMetric"]{
      background: var(--ocean-card);
      border: 1px solid var(--ocean-border);
      border-radius: 14px; box-shadow: var(--ocean-shadow);
      padding: 8px 12px;
    }

    /* Chat bubbles */
    div[data-testid="stChatMessage"] > div{
      border: 1px solid var(--ocean-border);
      background: var(--ocean-card);
      border-radius: 24px; /* rounder, uniform curves */
      box-shadow: var(--ocean-shadow);
      transition: var(--ocean-transition);
    }

    /* Dock chat input: fixed at bottom; content scrolls underneath */
    [data-testid="stAppViewContainer"] { overflow: visible; }
    div[data-testid="stChatInput"]{
        position: fixed !important; bottom: 18px; left: 24px; z-index: 50;
        width: clamp(320px, 32vw, 560px); /* approximate left column width */
        background: rgba(17, 24, 39, 0.06) !important; /* soft grey shell */
        border: 1px solid rgba(148, 163, 184, 0.45) !important;
        border-radius: 28px !important;
        box-shadow: 0 10px 24px rgba(15,76,129,.16);
        padding: 6px 8px !important;
        margin-top: 0;
        backdrop-filter: blur(4px);
    }
    .block-container div[data-testid="stChatInput"]{ position: fixed !important; bottom: 18px !important; left: 24px !important; }
    div[data-testid="stChatInput"]:hover{ box-shadow: 0 14px 30px rgba(15,76,129,.20); }
    div[data-testid="stChatInput"] > div{ max-width: none; margin: 0; padding: 0; }
    @media (max-width: 900px){
      div[data-testid="stChatInput"]{ left: 12px; right: 12px; width: calc(100% - 24px); }
    }
    /* Make inner input transparent so grey shell defines the shape */
    div[data-testid="stChatInput"] [role="group"]{
        background: transparent !important;
        border: none !important;
        border-radius: 22px !important;
        box-shadow: none !important;
    }
    /* Normalize text styles and spacing in chat input */
    div[data-testid="stChatInput"] textarea{
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji" !important;
      font-size: 15px !important;
      line-height: 1.4 !important;
      padding: 10px 14px !important;
      color: #ffffff !important;
    }
    /* Placeholder style */
    div[data-testid="stChatInput"] textarea::placeholder{
      color: rgba(255, 255, 255, 0.65) !important;
    }
    /* Remove red validation outline if any */
    div[data-testid="stChatInput"] textarea:focus{
      outline: none !important;
      box-shadow: none !important;
    }
    @media (max-width: 900px){ div[data-testid="stChatInput"] > div { padding: 0 12px; } }
    </style>
    """,
    unsafe_allow_html=True,
)


# ---------------------------
# Mock Data & API Layer
# ---------------------------
def mock_fetch_floats(filters: Dict) -> pd.DataFrame:
    """Return a DataFrame of mock floats with trajectories."""
    data = [
        {"id": "6901234", "lat": 8.5, "lon": 72.2, "last": "2023-03-12",
         "trajectory": [(8.1, 71.9), (8.3, 72.0), (8.5, 72.2)]},
        {"id": "5904321", "lat": -2.1, "lon": 68.3, "last": "2023-03-20",
         "trajectory": [(-2.5, 68.0), (-2.3, 68.1), (-2.1, 68.3)]},
        {"id": "7905678", "lat": -8.2, "lon": 85.6, "last": "2023-03-25",
         "trajectory": [(-8.0, 85.3), (-8.1, 85.5), (-8.2, 85.6)]},
    ]
    df = pd.DataFrame([{k: v for k, v in r.items() if k != "trajectory"} for r in data])
    df["trajectory"] = [r["trajectory"] for r in data]

    # Simple bbox filter
    latmin = safe_float(filters.get("latmin"))
    latmax = safe_float(filters.get("latmax"))
    lonmin = safe_float(filters.get("lonmin"))
    lonmax = safe_float(filters.get("lonmax"))
    float_id = (filters.get("id") or "").strip()

    mask = pd.Series([True] * len(df))
    if latmin is not None:
        mask &= df["lat"] >= latmin
    if latmax is not None:
        mask &= df["lat"] <= latmax
    if lonmin is not None:
        mask &= df["lon"] >= lonmin
    if lonmax is not None:
        mask &= df["lon"] <= lonmax
    if float_id:
        mask &= df["id"].str.contains(float_id)

    return df[mask].reset_index(drop=True)


def mock_fetch_profile(float_id: str, variable: str) -> pd.DataFrame:
    depths = np.array([0, 10, 20, 50, 100, 200, 500, 1000])
    if variable == "psal":
        values = 35 - np.arange(len(depths)) * 0.1
    elif variable == "oxygen":
        values = 250 - np.arange(len(depths)) * 5
    else:
        values = 28 - np.arange(len(depths)) * 0.8
    times = [datetime.now(timezone.utc) - timedelta(minutes=i * 3) for i in range(len(depths))]
    return pd.DataFrame({"pres": depths, "value": values, "time": times})


def mock_fetch_observations(filters: Dict) -> pd.DataFrame:
    """Return a flat observations table with required columns.
    Columns: id, float_id, profile_date, latitude, longitude, pressure, temperature, salinity
    """
    base = mock_fetch_floats(filters)
    rows = []
    obs_id = 16000
    for _, r in base.iterrows():
        # create 3 observations per float as placeholders
        for k in range(3):
            rows.append({
                "id": obs_id,
                "float_id": r["id"],
                "profile_date": (datetime.fromisoformat("2023-03-01") + timedelta(days=k*3)).strftime("%Y-%m-%d %H:%M:%S"),
                "latitude": float(r["lat"]) + (k * 0.02),
                "longitude": float(r["lon"]) + (k * 0.03),
                "pressure": 50 + k * 25.2,
                "temperature": 26.5 - k * 1.3,
                "salinity": 35.85 - k * 0.01,
            })
            obs_id += 1
    return pd.DataFrame(rows)

def mock_rag_query(text: str, filters: Dict) -> Dict:
    """Pretend to call RAG pipeline and return actions and reply."""
    # Basic demo: if user mentions bbox/near/compare, return relevant actions
    text_l = text.lower()
    reply = "I parsed your request."
    actions = []
    if "nearest" in text_l:
        actions.append({"type": "highlight", "ids": ["6901234"]})
        reply = "Highlighted the nearest float to the current view."
    elif "compare" in text_l:
        actions.append({"type": "compare", "ids": ["6901234", "5904321"]})
        reply = "Prepared comparison of two floats."
    elif any(w in text_l for w in ["bbox", "box", "bounds", "show", "salinity", "profiles"]):
        actions.append({"type": "highlight", "ids": ["6901234", "5904321"]})
        reply = "Found 2 floats matching your query. Highlighted them on the map."
    else:
        reply = "Here is a generic answer. Try asking to compare or show floats in a region."
    return {"reply": reply, "actions": actions}


def safe_float(v):
    try:
        if v is None or v == "":
            return None
        return float(v)
    except Exception:
        return None


# ---------------------------
# Top bar – Filters popover (top-right)
# ---------------------------
if "status_log" not in st.session_state:
    st.session_state.status_log = ["Ready."]

# Seed defaults in session
st.session_state.setdefault("flt_start", date(2023, 3, 1))
st.session_state.setdefault("flt_end", date(2023, 3, 31))
st.session_state.setdefault("flt_variable", "temp")
st.session_state.setdefault("flt_latmin", "")
st.session_state.setdefault("flt_latmax", "")
st.session_state.setdefault("flt_lonmin", "")
st.session_state.setdefault("flt_lonmax", "")
st.session_state.setdefault("flt_id", "")
st.session_state.setdefault("rag_on", True)

hdr_left, hdr_right = st.columns([8, 2], vertical_alignment="center")
with hdr_left:
    # Place the title at the very top with minimal margin
    st.markdown("<div class='og-brand' style='margin-top:4px;'>Ocean Gate</div>", unsafe_allow_html=True)
with hdr_right:
    r1, r2 = st.columns(2)
    with r1:
        with st.popover("Filters", use_container_width=True):
            st.markdown("**Filters & Actions**")
            col1, col2 = st.columns(2)
            with col1:
                st.session_state.flt_start = st.date_input("Date start", value=st.session_state.flt_start, key="date_start")
            with col2:
                st.session_state.flt_end = st.date_input("Date end", value=st.session_state.flt_end, key="date_end")
            st.session_state.flt_variable = st.selectbox("Variable", ["temp", "psal", "oxygen"], index=["temp","psal","oxygen"].index(st.session_state.flt_variable))
            c1, c2 = st.columns(2)
            with c1:
                st.session_state.flt_latmin = st.text_input("latMin", value=st.session_state.flt_latmin)
                st.session_state.flt_latmax = st.text_input("latMax", value=st.session_state.flt_latmax)
            with c2:
                st.session_state.flt_lonmin = st.text_input("lonMin", value=st.session_state.flt_lonmin)
                st.session_state.flt_lonmax = st.text_input("lonMax", value=st.session_state.flt_lonmax)
            st.session_state.flt_id = st.text_input("Float ID (optional)", value=st.session_state.flt_id)

            st.session_state.rag_on = st.toggle("RAG Enabled", value=st.session_state.rag_on)
            st.caption("Status")
            st.text_area("Status log", value="\n".join(reversed(st.session_state.status_log)), height=100, key="status_area", label_visibility="collapsed")
    with r2:
        with st.popover("History", use_container_width=True):
            st.markdown("**History**")
            if "user_history" in st.session_state and st.session_state.user_history:
                for i, txt in enumerate(reversed(st.session_state.user_history)):
                    c1, c2 = st.columns([4, 1])
                    with c1:
                        st.caption(txt)
                    with c2:
                        st.button(
                            "Send",
                            key=f"hist_send_hdr_{i}",
                            on_click=lambda t=txt: st.session_state.update({"clicked_prompt": t}),
                        )
                if st.button("Clear history", type="secondary", key="clear_hist_btn_hdr"):
                    st.session_state.user_history = []
            else:
                st.caption("No history yet.")


def set_status(msg: str):
    st.session_state.status_log.append(msg)


filters = {
    "start": st.session_state.flt_start.isoformat(),
    "end": st.session_state.flt_end.isoformat(),
    "var": st.session_state.flt_variable,
    "latmin": st.session_state.flt_latmin,
    "lonmin": st.session_state.flt_lonmin,
    "latmax": st.session_state.flt_latmax,
    "lonmax": st.session_state.flt_lonmax,
    "id": st.session_state.flt_id,
}


left_col, right_col = st.columns([1.0, 2.0], gap="large")

with left_col:
    # Marker element to make the surrounding block stylable as a container
    st.markdown("<div class='og-chat-root'></div>", unsafe_allow_html=True)
    st.subheader("Chat")
    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "user_history" not in st.session_state:
        st.session_state.user_history = []
    if "highlight_ids" not in st.session_state:
        st.session_state.highlight_ids = []

    chat_container = st.container()
    for m in st.session_state.messages:
        with chat_container.chat_message(m["role"], avatar="👤" if m["role"] == "user" else "🤖"):
            st.markdown(m["content"])

    clicked = st.session_state.pop("clicked_prompt", None)
    user_typed = st.chat_input("Ask anything...")
    prompt = clicked or user_typed
    if prompt:
        st.session_state.messages.append({"role": "user", "content": prompt})
        st.session_state.user_history.append(prompt)
        with chat_container.chat_message("user", avatar="👤"):
            st.markdown(prompt)

        reply_payload = mock_rag_query(prompt, filters) if st.session_state.rag_on else {"reply": "RAG is off.", "actions": []}
        for a in reply_payload.get("actions", []):
            if a.get("type") == "highlight":
                st.session_state.highlight_ids = a.get("ids", [])
                set_status(f"Highlighted {len(st.session_state.highlight_ids)} floats from chat.")
            if a.get("type") == "compare":
                st.session_state.compare_ids = a.get("ids", [])
                set_status("Prepared comparison selection from chat.")

        with chat_container.chat_message("assistant", avatar="🤖"):
            st.markdown(reply_payload.get("reply", ""))
        st.session_state.messages.append({"role": "assistant", "content": reply_payload.get("reply", "")})


with right_col:
    st.subheader("Explore")
    right_tabs = st.tabs(["Analysis", "Ocean Map", "Profiles"])

    # --- Analysis ---
    with right_tabs[0]:
        obs_df = mock_fetch_observations(filters)
        floats_df = mock_fetch_floats(filters)
        try:
            if not obs_df.empty:
                _min_d = str(obs_df['profile_date'].min())
                _max_d = str(obs_df['profile_date'].max())
                _date_range = f"{_min_d} → {_max_d}"
            else:
                _date_range = "–"
        except Exception:
            _date_range = "–"
        m1, m2 = st.columns(2)
        with m1:
            st.metric("Average Temp", f"{obs_df['temperature'].mean():.2f} °C" if not obs_df.empty else "–")
        with m2:
            st.metric("Average Salinity", f"{obs_df['salinity'].mean():.2f} PSU" if not obs_df.empty else "–")
        st.markdown("### Summary")
        with st.container():
            st.markdown("<div class='og-info-grid'>" \
                f"<div class='og-info-card'><div class='lbl'>Floats</div><div class='val'>{len(floats_df):,}</div></div>" \
                f"<div class='og-info-card'><div class='lbl'>Observations</div><div class='val'>{len(obs_df):,}</div></div>" \
                f"<div class='og-info-card'><div class='lbl'>Dates</div><div class='val'>{_date_range}</div></div>" \
                "</div>", unsafe_allow_html=True)

    # --- Ocean Map ---
    with right_tabs[1]:
        st.caption("Active floats on the world map")
        floats_df = mock_fetch_floats(filters)
        if not floats_df.empty:
            center_lat = float(floats_df.lat.mean())
            center_lon = float(floats_df.lon.mean())
            fmap = folium.Map(location=[center_lat, center_lon], zoom_start=3, tiles="OpenStreetMap", control_scale=True)
            stamen_attr = "Map tiles by Stamen Design (CC BY 3.0) — Data © OpenStreetMap contributors"
            folium.TileLayer("CartoDB positron", attr="Map tiles © CARTO | Data © OpenStreetMap contributors").add_to(fmap)
            folium.TileLayer("Stamen Toner", attr=stamen_attr).add_to(fmap)
            folium.TileLayer("Stamen Terrain", attr=stamen_attr).add_to(fmap)
            for _, row in floats_df.iterrows():
                folium.Marker([row["lat"], row["lon"]], 
                            tooltip=f"Float {row['id']}\nLast: {row['last']}",
                            icon=folium.Icon(color="blue", icon="map-marker", prefix="fa")).add_to(fmap)
            st_folium(fmap, height=520, width=None)
        else:
            st.info("No floats for current filters.")

    # --- Profiles ---
    with right_tabs[2]:
        floats_df = mock_fetch_floats(filters)
        choices = ["(select)"] + floats_df["id"].tolist()
        sel = st.selectbox("Float ID", choices, key="profiles_sel")
        if sel and sel != "(select)":
            # Prepare a mock temp-salinity scatter and a temp-pressure profile
            prof = mock_fetch_profile(sel, "temp")
            # temp vs salinity (mock using two arrays of same size)
            sal_mock = 35 - (prof["pres"] * 0.01)
            scatter = go.Figure()
            scatter.add_trace(go.Scatter(x=sal_mock, y=prof["value"], mode="markers", name="Temp vs Salinity"))
            scatter.update_xaxes(title_text="Salinity (PSU)")
            scatter.update_yaxes(title_text="Temperature (°C)")
            scatter.update_layout(template="plotly_white", height=320)
            st.plotly_chart(scatter, use_container_width=True)

            profile = go.Figure()
            profile.add_trace(go.Scatter(x=prof["value"], y=prof["pres"], mode="lines+markers", name="Temp vs Pressure"))
            profile.update_yaxes(autorange="reversed", title_text="Pressure (dbar)")
            profile.update_xaxes(title_text="Temperature (°C)")
            profile.update_layout(template="plotly_white", height=320)
            st.plotly_chart(profile, use_container_width=True)
        else:
            st.info("Select a float to plot its profile and time series.")

