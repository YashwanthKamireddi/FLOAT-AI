import json
from datetime import date, datetime, timedelta
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

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

# UI polish for buttons (especially History popover Send buttons)
st.markdown(
    """
    <style>
    /* Prevent button text wrapping and add hover effects */
    .stButton>button { white-space: nowrap; }
    div[data-testid="stPopover"] .stButton>button {
        transition: all .15s ease-in-out;
        border-radius: 10px;
    }
    div[data-testid="stPopover"] .stButton>button:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 14px rgba(0,0,0,.25);
        background: #3b82f6 !important;
        border-color: #3b82f6 !important;
        color: #fff !important;
        letter-spacing: .2px;
    }
    /* Dock the chat input to the bottom like ChatGPT */
    .block-container { padding-bottom: 120px; }
    div[data-testid="stChatInput"] { 
        position: fixed; 
        left: 3rem; 
        right: 3rem; 
        bottom: 16px; 
        z-index: 1000; 
        background: rgba(20,20,25,0.6);
        border-radius: 16px;
        backdrop-filter: blur(6px);
    }
    @media (max-width: 900px) {
      div[data-testid="stChatInput"] { left: 1rem; right: 1rem; }
    }
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
    times = [datetime.utcnow() - timedelta(minutes=i * 3) for i in range(len(depths))]
    return pd.DataFrame({"pres": depths, "value": values, "time": times})


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

hdr_left, hdr_right = st.columns([8, 2])
with hdr_left:
    st.markdown("### Ocean Gate")
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
            st.text_area("", value="\n".join(reversed(st.session_state.status_log)), height=100, key="status_area")
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


# ---------------------------
# Tabs – Chat, Map, Profiles, Comparison, Table
# ---------------------------
tabs = st.tabs(["Chat", "Map", "Profiles", "Comparison", "Table"])


# ---------------------------
# Tab: Chat (conversational UI)
# ---------------------------
with tabs[0]:
    st.subheader("Chat")
    if "messages" not in st.session_state:
        st.session_state.messages = []  # list of dicts: {role, content}
    if "user_history" not in st.session_state:
        st.session_state.user_history = []  # list of strings (user prompts)
    if "highlight_ids" not in st.session_state:
        st.session_state.highlight_ids = []

    # Chat log display
    for m in st.session_state.messages:
        with st.chat_message(m["role"], avatar="🧑" if m["role"] == "user" else "🤖"):
            st.markdown(m["content"])

    # Ensure chat input stays at bottom of the tab
    clicked = st.session_state.pop("clicked_prompt", None)
    # Always render chat_input so it doesn't disappear when using History Send
    user_typed = st.chat_input("Ask about floats, e.g., 'show floats in bbox'…")
    prompt = clicked or user_typed
    if prompt:
        # Record user message and history
        st.session_state.messages.append({"role": "user", "content": prompt})
        st.session_state.user_history.append(prompt)
        with st.chat_message("user", avatar="🧑"):
            st.markdown(prompt)

        # RAG call (mocked)
        reply_payload = mock_rag_query(prompt, filters) if st.session_state.rag_on else {"reply": "RAG is off.", "actions": []}

        # Apply actions
        for a in reply_payload.get("actions", []):
            if a.get("type") == "highlight":
                st.session_state.highlight_ids = a.get("ids", [])
                set_status(f"Highlighted {len(st.session_state.highlight_ids)} floats from chat.")
            if a.get("type") == "compare":
                st.session_state.compare_ids = a.get("ids", [])
                set_status("Prepared comparison selection from chat.")

        # Show assistant response
        with st.chat_message("assistant", avatar="🤖"):
            st.markdown(reply_payload.get("reply", ""))
        st.session_state.messages.append({"role": "assistant", "content": reply_payload.get("reply", "")})


# ---------------------------
# Tab: Map (float locations & trajectories)
# ---------------------------
with tabs[1]:
    st.subheader("Map")
    floats_df = mock_fetch_floats(filters)
    st.caption(f"Loaded {len(floats_df)} floats")

    if HAS_PYDECK and not floats_df.empty:
        layer_points = pdk.Layer(
            "ScatterplotLayer",
            data=floats_df,
            get_position="[lon, lat]",
            get_radius=40000,
            get_fill_color=[68, 170, 255, 200],
            pickable=True,
        )
        # Trajectories
        traj_rows = []
        for _, r in floats_df.iterrows():
            coords = [[lon, lat] for (lat, lon) in r["trajectory"]]
            if len(coords) > 1:
                traj_rows.append({"path": coords, "id": r["id"]})
        layer_paths = pdk.Layer(
            "PathLayer",
            data=pd.DataFrame(traj_rows),
            get_path="path",
            get_width=3,
            width_min_pixels=2,
            get_color=[212, 163, 115],
        )

        view_state = pdk.ViewState(latitude=float(floats_df.lat.mean()), longitude=float(floats_df.lon.mean()), zoom=3)
        r = pdk.Deck(layers=[layer_points, layer_paths], initial_view_state=view_state, map_style="mapbox://styles/mapbox/light-v9")
        st.pydeck_chart(r)
    else:
        st.info("pydeck not available or no data. Showing table below.")
        st.dataframe(floats_df)

    # Highlight info
    if st.session_state.get("highlight_ids"):
        st.markdown("**Highlighted by chat:** " + ", ".join(st.session_state.highlight_ids))


# ---------------------------
# Tab: Profiles (single float profile and time series)
# ---------------------------
with tabs[2]:
    st.subheader("Profiles & Time Series")
    floats_df = mock_fetch_floats(filters)
    choices = ["(select)"] + floats_df["id"].tolist()
    sel = st.selectbox("Float ID", choices)
    if sel and sel != "(select)":
        current_var = st.session_state.flt_variable
        prof = mock_fetch_profile(sel, current_var)
        var_label = {"temp": "Temperature (°C)", "psal": "Salinity (PSU)", "oxygen": "Oxygen (µmol/kg)"}.get(current_var, current_var)

        # Profile plot (value vs pressure)
        fig_p = go.Figure()
        fig_p.add_trace(go.Scatter(x=prof["value"], y=prof["pres"], mode="lines+markers", name="Profile", line=dict(color="#c38452")))
        fig_p.update_yaxes(autorange="reversed", title_text="Pressure (dbar)")
        fig_p.update_xaxes(title_text=var_label)
        fig_p.update_layout(template="plotly_dark", height=400, margin=dict(l=50, r=10, t=10, b=40))
        st.plotly_chart(fig_p, use_container_width=True)

        # Time series (mocked from profile)
        fig_t = go.Figure()
        fig_t.add_trace(go.Scatter(x=prof["time"], y=prof["value"], mode="lines+markers", name="Time series", line=dict(color="#d4a373")))
        fig_t.update_xaxes(title_text="Time")
        fig_t.update_yaxes(title_text=var_label)
        fig_t.update_layout(template="plotly_dark", height=400, margin=dict(l=50, r=10, t=10, b=40))
        st.plotly_chart(fig_t, use_container_width=True)
    else:
        st.info("Select a float to plot its profile and time series.")


# ---------------------------
# Tab: Comparison view
# ---------------------------
with tabs[3]:
    st.subheader("Comparison")
    floats_df = mock_fetch_floats(filters)
    ids = floats_df["id"].tolist()
    c1, c2 = st.columns(2)
    with c1:
        a_id = st.selectbox("Float ID A", ids, index=0 if ids else None, key="cmpA")
    with c2:
        b_id = st.selectbox("Float ID B", ids, index=1 if len(ids) > 1 else 0 if ids else None, key="cmpB")

    if a_id and b_id and a_id != b_id:
        current_var = st.session_state.flt_variable
        prof_a = mock_fetch_profile(a_id, current_var)
        prof_b = mock_fetch_profile(b_id, current_var)

        fig_c1 = go.Figure()
        fig_c1.add_trace(go.Scatter(x=prof_a["value"], y=prof_a["pres"], mode="lines+markers", name=a_id))
        fig_c1.add_trace(go.Scatter(x=prof_b["value"], y=prof_b["pres"], mode="lines+markers", name=b_id))
        fig_c1.update_yaxes(autorange="reversed", title_text="Pressure (dbar)")
        fig_c1.update_xaxes(title_text={"temp": "Temperature (°C)", "psal": "Salinity (PSU)", "oxygen": "Oxygen (µmol/kg)"}.get(current_var, current_var))
        fig_c1.update_layout(template="plotly_dark", height=420)
        st.plotly_chart(fig_c1, use_container_width=True)
    else:
        st.info("Pick two different floats to compare.")


# ---------------------------
# Tab: Data table explorer
# ---------------------------
with tabs[4]:
    st.subheader("Data Table")
    floats_df = mock_fetch_floats(filters)
    st.dataframe(floats_df.drop(columns=["trajectory"]), use_container_width=True)
    csv = floats_df.drop(columns=["trajectory"]).to_csv(index=False).encode("utf-8")
    st.download_button("Download CSV", data=csv, file_name="argo_floats.csv", mime="text/csv")


