FROM python:3.12-slim

WORKDIR /app

ENV E5_WORKER_STUB=false \
    E5_MODEL_ID=dragonkue/multilingual-e5-small-ko-v2 \
    E5_EMBEDDING_DIMENSION=384 \
    HF_HOME=/model-cache

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
