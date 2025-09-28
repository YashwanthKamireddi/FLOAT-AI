# FloatChat

Production-ready instructions for running the FloatChat stack locally.

## Prerequisites

- **Python 3.11+** (project tested with Python 3.13)
- **Node.js 18+** (for the Vite + React frontend)
- **PostgreSQL 14+** accessible at `localhost:5432`
- Recommended: [pgAdmin](https://www.pgadmin.org/) for managing the `float` database

## 1. Configure environment variables

1. Duplicate the provided samples and fill in the secrets you were given:
   ```powershell
   Copy-Item .env.example .env
   Copy-Item frontend/.env.example frontend/.env
   ```
2. Set `GOOGLE_API_KEY` to your Gemini API key.
3. Either set `DATABASE_URL` **or** supply the granular `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` values. The defaults match your pgAdmin server named **Float** (`postgres` / `2021`).
4. Optionally restrict `BACKEND_CORS_ORIGINS` to the frontend origin you deploy.

> ⚠️ Never check the populated `.env` files into source control.

## 2. Prepare the database

1. Create a PostgreSQL database called `float` (or adjust `DB_NAME` accordingly).
2. Ensure the `argo_profiles` table exists with the schema expected by the ETL pipeline.
3. (Optional) Run the ETL to load NetCDF data:
   ```powershell
   python data_pipeline/build_database.py
   ```

## 3. Build the FAISS knowledge base

If you change the curated knowledge, regenerate the vector store:
```powershell
python ai_core/create_vector_db.py
```

## 4. Run the backend API

```powershell
pip install -r requirements.txt
python api_server.py
```

The FastAPI service listens on `http://localhost:8000` by default. Adjust `API_HOST`/`API_PORT` in `.env` to deploy to a different interface.

## 5. Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

The Vite dev server defaults to `http://localhost:5173`. The build step `npm run build` produces production assets in `frontend/dist`.

## 6. Smoke test

1. Open `http://localhost:5173` in a browser.
2. Ask a data question in the **Chat Interface** and confirm:
   - The backend generates SQL (visible in the SQL tab).
   - The data grid and map update with results.
3. Try a conversational prompt (e.g., "Who are you?") and ensure the assistant responds without DB access.

## Troubleshooting

- **"Configuration error" responses**: The backend could not read required environment variables. Verify `.env` is in place and restart the API.
- **Database connection failures**: Confirm PostgreSQL is running and the credentials in `.env` are correct.
- **FAISS index errors**: Rebuild via `python ai_core/create_vector_db.py` and ensure `FAISS_INDEX_PATH` points to the generated folder.
- **CORS blocked**: Add your frontend origin to `BACKEND_CORS_ORIGINS` in `.env` (comma-separated list).

## Deployment notes

- Configure HTTPS termination in front of FastAPI (e.g., via Nginx or a cloud load balancer).
- Store secrets in your platform's secret manager—never bake them into container images.
- Set `VITE_API_URL` in the frontend environment to the deployed backend URL (e.g., `https://api.yourdomain.com/api/ask`).
- Adjust `RAG_RETRIEVER_K` to trade off recall vs. performance when scaling.
