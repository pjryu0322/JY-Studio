# Analysis Backend (FastAPI)

Chunk Studio의 페이지 분석 정확도 강화를 위한 Python 기반 분석 서비스입니다.

## Run

```bash
cd projects/chunk-studio/analysis-backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010
```

Windows helper:

- PowerShell: `./run.ps1`
- CMD: `run.bat`

## Test

```bash
pytest -q
```

## API

- `GET /health`
- `POST /analyze/page-understanding`

Next.js API에서 `ANALYSIS_SERVICE_URL`이 설정되어 있으면 해당 서비스로 분류 요청을 전달합니다.
