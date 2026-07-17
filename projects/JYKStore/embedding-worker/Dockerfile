# JYKStore E5 CPU Embedding Worker — production image.
# INTERNAL SERVICE ONLY: never expose this container on a public route/port.
FROM python:3.12-slim

# H. non-root runtime user.
RUN useradd --create-home --uid 10001 appuser

WORKDIR /app

ENV E5_WORKER_ENV=production \
    E5_WORKER_STUB=false \
    E5_MODEL_ID=dragonkue/multilingual-e5-small-ko-v2 \
    E5_EMBEDDING_DIMENSION=384 \
    E5_MAX_SEQUENCE_TOKENS=512 \
    HF_HOME=/model-cache \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Build from the lock file for reproducibility.
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock

COPY app ./app

# Model cache volume: model downloaded once, reused across restarts, offline-capable.
RUN mkdir -p /model-cache && chown -R appuser:appuser /model-cache /app
VOLUME ["/model-cache"]

USER appuser

EXPOSE 8000
# E5_MODEL_REVISION and E5_WORKER_TOKEN must be provided at runtime in production.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
