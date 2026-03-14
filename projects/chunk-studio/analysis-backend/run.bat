@echo off
set PORT=8010
if not "%1"=="" set PORT=%1

where python >nul 2>nul
if errorlevel 1 (
  echo Python not found. Install Python 3.10+ first.
  exit /b 1
)

if not exist .venv (
  python -m venv .venv
)

call .venv\Scripts\activate.bat
pip install -r requirements.txt
uvicorn app.main:app --reload --port %PORT%
