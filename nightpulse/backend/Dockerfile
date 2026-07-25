FROM python:3.11-slim

WORKDIR /app

# System dependencies for asyncpg and bcrypt
RUN apt-get update && apt-get install -y \
    libpq-dev gcc curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create static directory for frontend
RUN mkdir -p /app/static/frontend

# Development mode default command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--workers", "1"]
