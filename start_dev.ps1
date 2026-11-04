# AgencyOS — Windows Dev Quickstart
# Run this after `docker-compose up -d`

Write-Host "=== AgencyOS Dev Startup ===" -ForegroundColor Cyan

# Start Backend
Write-Host "`nStarting Backend (FastAPI)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd D:\agencyos\backend; venv\Scripts\activate; uvicorn app.main:app --reload --port 8000"

# Wait a moment
Start-Sleep -Seconds 2

# Start Frontend
Write-Host "Starting Frontend (Next.js)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd D:\agencyos\frontend; npm run dev"

Write-Host "`n=== Services Starting ===" -ForegroundColor Green
Write-Host "Backend API:   http://localhost:8000" -ForegroundColor White
Write-Host "API Docs:      http://localhost:8000/docs" -ForegroundColor White
Write-Host "Frontend:      http://localhost:3000" -ForegroundColor White
Write-Host "pgAdmin:       http://localhost:5050" -ForegroundColor White
Write-Host "MinIO Console: http://localhost:9001" -ForegroundColor White
