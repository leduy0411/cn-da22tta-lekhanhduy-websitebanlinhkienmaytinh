Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TECHSTORE DOCKER LOCAL START" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Docker CLI not found. Please install Docker Desktop first." -ForegroundColor Red
  exit 1
}

$null = docker info 2>$null
if (-not $?) {
  Write-Host "[ERROR] Docker Engine is not running." -ForegroundColor Red
  Write-Host "        Open Docker Desktop and wait until status is 'Engine running'." -ForegroundColor Yellow
  Write-Host "        Then run: npm run docker:up" -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path ".env")) {
  Write-Host "[WARNING] Root .env not found. Docker compose will use environment defaults." -ForegroundColor Yellow
  Write-Host "         You should provide MONGODB_URI and GEMINI_API_KEY in .env." -ForegroundColor Yellow
}

Write-Host "[STEP] Building and starting backend + frontend containers..." -ForegroundColor Yellow
docker compose -f docker-compose.local.yml up -d --build
if (-not $?) {
  Write-Host "[ERROR] Docker compose failed." -ForegroundColor Red
  exit 1
}

Write-Host "[OK] Containers started." -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "Backend : http://localhost:5000" -ForegroundColor Green
Write-Host ""
Write-Host "Use this command to view logs:" -ForegroundColor Cyan
Write-Host "docker compose -f docker-compose.local.yml logs -f" -ForegroundColor White
Write-Host ""
Write-Host "Use this command to stop:" -ForegroundColor Cyan
Write-Host "docker compose -f docker-compose.local.yml down" -ForegroundColor White
