@echo off
cd /d "%~dp0"
set "TRIP_PYTHON=C:\Users\Kez\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%TRIP_PYTHON%" set "TRIP_PYTHON=python"
"%TRIP_PYTHON%" -c "from pathlib import Path; import secrets; p=Path('data'); p.mkdir(exist_ok=True); k=p/'access-key.txt'; k.write_text(secrets.token_urlsafe(32)) if not k.exists() else None"
for /f "usebackq delims=" %%K in ("data\access-key.txt") do start "" "http://localhost:8765/#key=%%K"
"%TRIP_PYTHON%" server.py
pause
