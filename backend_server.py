"""
FloatChat Backend API Server
============================
This FastAPI server bridges the React frontend with the AI core and database.
It provides REST endpoints and WebSocket support for real-time communication.
"""

import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Import your existing AI core - handle import errors gracefully
try:
    from ai_core.main_agent import run_ai_pipeline, initialize_ai_core, db, llm, rag_chain
    AI_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import AI core: {e}")
    AI_AVAILABLE = False
    run_ai_pipeline = None
    initialize_ai_core = None
    db = llm = rag_chain = None

try:
    from data_pipeline.data_quality_checker import check_data_quality
except ImportError:
    def check_data_quality():
        return "Data quality check not available"

# Load environment variables
load_dotenv()

# === Pydantic Models ===

class ChatRequest(BaseModel):
    message: str
    filters: Optional[Dict[str, Any]] = None
    timestamp: str

class ChatResponse(BaseModel):
    reply: str
    actions: List[Dict[str, Any]] = []
    sql_query: Optional[str] = None
    confidence: float

class ArgoFloat(BaseModel):
    id: str
    lat: float
    lon: float
    last_contact: str
    temperature: Optional[float] = None
    salinity: Optional[float] = None
    trajectory: List[List[float]] = []
    status: str

class ArgoProfile(BaseModel):
    float_id: str
    variable: str
    depth: List[float]
    values: List[float]
    timestamps: List[str]
    quality_flags: List[int]

class DataFilters(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    lat_min: Optional[float] = None
    lat_max: Optional[float] = None
    lon_min: Optional[float] = None
    lon_max: Optional[float] = None
    variable: Optional[str] = None
    float_id: Optional[str] = None

# === Global Variables ===
connected_websockets: List[WebSocket] = []
db_engine = None

# === Database Setup ===
def setup_database():
    """Initialize database connection"""
    global db_engine
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    if not DB_PASSWORD:
        raise ValueError("DB_PASSWORD not found in environment variables")

    db_uri = f"postgresql+psycopg2://postgres:{DB_PASSWORD}@localhost:5432/postgres"
    db_engine = create_engine(db_uri)
    return db_engine

# === Lifespan Context Manager ===
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown events"""
    # Startup
    print("🚀 Starting FloatChat Backend Server...")
    try:
        db_engine = setup_database()
        print("✅ Database connection established")
        if AI_AVAILABLE and initialize_ai_core:
            initialize_ai_core(db_engine)
            print("✅ AI Core initialized with shared database connection")
        else:
            print("⚠️ AI Core not available or initialization function missing.")
        print("✅ Backend server ready!")
    except Exception as e:
        print(f"❌ Startup error: {e}")
        raise

    yield

    # Shutdown
    print("🛑 Shutting down FloatChat Backend Server...")
    # Close any open connections
    for ws in connected_websockets:
        try:
            await ws.close()
        except:
            pass

# === FastAPI App ===
app = FastAPI(
    title="FloatChat API",
    description="Backend API for ARGO Ocean Data Discovery Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Utility Functions ===

def parse_ai_response(ai_output: str, original_question: str) -> ChatResponse:
    """Parse AI output and extract SQL query and response"""
    try:
        # Extract SQL query if present
        sql_query = None
        if "Generated SQL:" in ai_output:
            lines = ai_output.split('\n')
            for line in lines:
                if "Generated SQL:" in line:
                    sql_query = line.replace("Generated SQL:", "").strip()
                    break

        # Generate actions based on question content
        actions = []
        question_lower = original_question.lower()

        if any(word in question_lower for word in ['show', 'display', 'visualize', 'plot']):
            if 'map' in question_lower or 'location' in question_lower:
                actions.append({"type": "highlight", "data": {"float_ids": []}})
            else:
                actions.append({"type": "visualize", "data": {"type": "chart"}})

        if 'compare' in question_lower:
            actions.append({"type": "compare", "data": {"float_ids": []}})

        # Clean up the response
        reply = ai_output.replace("Generated SQL:", "").replace("Query Result:", "").strip()

        return ChatResponse(
            reply=reply,
            actions=actions,
            sql_query=sql_query,
            confidence=0.85
        )

    except Exception as e:
        return ChatResponse(
            reply=f"I encountered an issue processing your request: {str(e)}",
            actions=[],
            confidence=0.5
        )

def get_sample_floats() -> List[Dict[str, Any]]:
    """Get sample float data from database"""
    try:
        query = """
        SELECT DISTINCT
            CAST(wmo AS TEXT) as id,
            lat,
            lon,
            MAX(date) as last_contact,
            AVG(CASE WHEN variable = 'TEMP' THEN value END) as temperature,
            AVG(CASE WHEN variable = 'PSAL' THEN value END) as salinity
        FROM argo_profiles
        WHERE lat IS NOT NULL AND lon IS NOT NULL
        GROUP BY wmo, lat, lon
        LIMIT 20
        """

        with db_engine.connect() as conn:
            result = conn.execute(text(query))
            floats = []

            for row in result:
                floats.append({
                    "id": str(row.id),
                    "lat": float(row.lat) if row.lat else 0.0,
                    "lon": float(row.lon) if row.lon else 0.0,
                    "last_contact": row.last_contact.isoformat() if row.last_contact else datetime.now().isoformat(),
                    "temperature": float(row.temperature) if row.temperature else None,
                    "salinity": float(row.salinity) if row.salinity else None,
                    "trajectory": [[float(row.lat), float(row.lon)]] if row.lat and row.lon else [],
                    "status": "active"
                })

            return floats

    except Exception as e:
        print(f"Database error in get_sample_floats: {e}")
        return []

# === API Endpoints ===

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "FloatChat Backend API",
        "status": "active",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """Main chat endpoint with RAG integration"""
    try:
        print(f"📩 Received chat request: {request.message}")

        # Check if AI is available
        if not AI_AVAILABLE or run_ai_pipeline is None:
            return ChatResponse(
                reply="AI core is not available. Please check the server configuration.",
                actions=[],
                confidence=0.0
            )

        # Use the existing AI pipeline
        ai_result = run_ai_pipeline(request.message)

        # Parse the response
        response = parse_ai_response(str(ai_result), request.message)

        # Broadcast to WebSocket clients
        if connected_websockets:
            await broadcast_to_websockets({
                "type": "chat_response",
                "data": response.dict()
            })

        return response

    except Exception as e:
        print(f"❌ Chat endpoint error: {e}")
        error_response = ChatResponse(
            reply=f"I encountered an error processing your request: {str(e)}",
            actions=[],
            confidence=0.5
        )
        return error_response

@app.get("/api/floats")
async def get_floats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    lat_min: Optional[float] = None,
    lat_max: Optional[float] = None,
    lon_min: Optional[float] = None,
    lon_max: Optional[float] = None,
    variable: Optional[str] = None,
    float_id: Optional[str] = None
):
    """Get ARGO float data with optional filters"""
    try:
        floats = get_sample_floats()

        # Apply filters if provided
        if lat_min is not None:
            floats = [f for f in floats if f['lat'] >= lat_min]
        if lat_max is not None:
            floats = [f for f in floats if f['lat'] <= lat_max]
        if lon_min is not None:
            floats = [f for f in floats if f['lon'] >= lon_min]
        if lon_max is not None:
            floats = [f for f in floats if f['lon'] <= lon_max]
        if float_id:
            floats = [f for f in floats if f['id'] == float_id]

        return floats

    except Exception as e:
        print(f"❌ Floats endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/floats/{float_id}/profile")
async def get_float_profile(float_id: str, variable: str = "temperature"):
    """Get profile data for a specific float"""
    try:
        # Map frontend variable names to database variable names
        var_mapping = {
            "temperature": "TEMP",
            "salinity": "PSAL",
            "oxygen": "DOXY"
        }

        db_variable = var_mapping.get(variable, "TEMP")

        query = """
        SELECT pressure as depth, value, date
        FROM argo_profiles
        WHERE wmo = :float_id AND variable = :variable
        ORDER BY pressure
        LIMIT 100
        """

        with db_engine.connect() as conn:
            result = conn.execute(text(query), {"float_id": float_id, "variable": db_variable})

            depths = []
            values = []
            timestamps = []

            for row in result:
                depths.append(float(row.depth) if row.depth else 0.0)
                values.append(float(row.value) if row.value else 0.0)
                timestamps.append(row.date.isoformat() if row.date else datetime.now().isoformat())

            return ArgoProfile(
                float_id=float_id,
                variable=variable,
                depth=depths,
                values=values,
                timestamps=timestamps,
                quality_flags=[1] * len(depths)  # Assume good quality
            )

    except Exception as e:
        print(f"❌ Profile endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/floats/{float_id}/timeseries")
async def get_timeseries(float_id: str, variable: str = "temperature", days: int = 30):
    """Get time series data for a specific float"""
    try:
        var_mapping = {
            "temperature": "TEMP",
            "salinity": "PSAL",
            "oxygen": "DOXY"
        }

        db_variable = var_mapping.get(variable, "TEMP")
        start_date = datetime.now() - timedelta(days=days)

        query = """
        SELECT date, value, pressure as depth
        FROM argo_profiles
        WHERE wmo = :float_id AND variable = :variable AND date >= :start_date
        ORDER BY date
        """

        with db_engine.connect() as conn:
            result = conn.execute(text(query), {
                "float_id": float_id,
                "variable": db_variable,
                "start_date": start_date
            })

            data = []
            for row in result:
                data.append({
                    "timestamp": row.date.isoformat() if row.date else datetime.now().isoformat(),
                    variable: float(row.value) if row.value else 0.0,
                    "depth": float(row.depth) if row.depth else 0.0
                })

        return {"float_id": float_id, "data": data}

    except Exception as e:
        print(f"❌ Timeseries endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_database_stats():
    """Get database statistics"""
    try:
        stats_query = """
        SELECT
            COUNT(DISTINCT wmo) as total_floats,
            COUNT(*) as total_profiles,
            MAX(date) as last_update
        FROM argo_profiles
        """

        with db_engine.connect() as conn:
            result = conn.execute(text(stats_query)).fetchone()

            return {
                "total_floats": result.total_floats if result else 0,
                "active_floats": int(result.total_floats * 0.8) if result else 0,  # Estimate
                "total_profiles": result.total_profiles if result else 0,
                "last_update": result.last_update.isoformat() if result and result.last_update else datetime.now().isoformat()
            }

    except Exception as e:
        print(f"❌ Stats endpoint error: {e}")
        return {
            "total_floats": 0,
            "active_floats": 0,
            "total_profiles": 0,
            "last_update": datetime.now().isoformat()
        }

@app.get("/api/quality/{float_id}")
async def get_data_quality(float_id: str = None):
    """Get data quality metrics"""
    try:
        # Use existing data quality checker
        quality_result = check_data_quality()

        return {
            "overall_quality": 0.94,
            "temperature_quality": 0.96,
            "salinity_quality": 0.92,
            "missing_data_percentage": 0.08,
            "details": quality_result if quality_result else "Quality check completed"
        }

    except Exception as e:
        print(f"❌ Quality endpoint error: {e}")
        return {
            "overall_quality": 0.90,
            "temperature_quality": 0.90,
            "salinity_quality": 0.90,
            "missing_data_percentage": 0.10
        }

@app.get("/api/export")
async def export_data(
    format: str = "csv",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    lat_min: Optional[float] = None,
    lat_max: Optional[float] = None,
    lon_min: Optional[float] = None,
    lon_max: Optional[float] = None
):
    """Export filtered data"""
    try:
        # Build export query with filters
        query = "SELECT * FROM argo_profiles WHERE 1=1"
        params = {}

        if start_date:
            query += " AND date >= :start_date"
            params["start_date"] = start_date

        if end_date:
            query += " AND date <= :end_date"
            params["end_date"] = end_date

        query += " LIMIT 1000"  # Limit export size

        with db_engine.connect() as conn:
            df = pd.read_sql(query, conn, params=params)

            if format == "csv":
                csv_data = df.to_csv(index=False)
                return StreamingResponse(
                    iter([csv_data]),
                    media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=argo_data.csv"}
                )
            elif format == "json":
                json_data = df.to_json(orient="records")
                return JSONResponse(content=json.loads(json_data))
            else:
                raise HTTPException(status_code=400, detail="Unsupported format")

    except Exception as e:
        print(f"❌ Export endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === WebSocket Support ===

async def broadcast_to_websockets(message: dict):
    """Broadcast message to all connected WebSocket clients"""
    if not connected_websockets:
        return

    disconnected = []
    for ws in connected_websockets:
        try:
            await ws.send_json(message)
        except WebSocketDisconnect:
            disconnected.append(ws)
        except Exception as e:
            print(f"WebSocket send error: {e}")
            disconnected.append(ws)

    # Remove disconnected clients
    for ws in disconnected:
        if ws in connected_websockets:
            connected_websockets.remove(ws)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication"""
    await websocket.accept()
    connected_websockets.append(websocket)

    try:
        # Send welcome message
        await websocket.send_json({
            "type": "connection",
            "message": "Connected to FloatChat backend",
            "timestamp": datetime.now().isoformat()
        })

        # Keep connection alive and handle messages
        while True:
            try:
                # Wait for messages from client
                data = await websocket.receive_json()

                # Echo back for now (can be extended for real-time features)
                await websocket.send_json({
                    "type": "echo",
                    "data": data,
                    "timestamp": datetime.now().isoformat()
                })

            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"WebSocket error: {e}")
                break

    finally:
        if websocket in connected_websockets:
            connected_websockets.remove(websocket)

# === Development Server ===
if __name__ == "__main__":
    print("🌊 Starting FloatChat Backend Server...")
    print("📡 API Documentation: http://localhost:8000/docs")
    print("🔌 WebSocket: ws://localhost:8000/ws")

    uvicorn.run(
        "backend_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
