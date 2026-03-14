param(
  [int]$Port = 8010
)

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Host "Python not found. Install Python 3.10+ first."
  exit 1
}

if (-not (Test-Path ".venv")) {
  python -m venv .venv
}

& ".\.venv\Scripts\Activate.ps1"
pip install -r requirements.txt
uvicorn app.main:app --reload --port $Port
