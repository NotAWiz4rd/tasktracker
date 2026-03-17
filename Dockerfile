FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml ./
RUN pip install -e ".[dev]" --no-cache-dir

COPY backend/ ./backend/
COPY data/ ./data/

EXPOSE 8000 8001

CMD ["sh", "-c", "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 & python backend/mcp_server.py --transport http --host 0.0.0.0 --port 8001 && wait"]
