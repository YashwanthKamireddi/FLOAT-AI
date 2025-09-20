# Minimal backend image for FastAPI (FloatAI)

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

ENV API_HOST=0.0.0.0 \
    API_PORT=8000

EXPOSE 8000

CMD ["python", "api_server.py"]
