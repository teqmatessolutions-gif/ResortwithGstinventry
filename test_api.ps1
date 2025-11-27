Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Resort Management API" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8011/health" -Method Get -TimeoutSec 5
    Write-Host "   ✓ Health Check: PASSED" -ForegroundColor Green
    Write-Host "   Response: $($health | ConvertTo-Json -Compress)"
} catch {
    Write-Host "   ✗ Health Check: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Services API
Write-Host "2. Testing Services API..." -ForegroundColor Yellow
try {
    $services = Invoke-RestMethod -Uri "http://localhost:8011/api/services?limit=5" -Method Get -TimeoutSec 5
    Write-Host "   ✓ Services API: PASSED" -ForegroundColor Green
    Write-Host "   Found $($services.Count) services"
    if ($services.Count -gt 0) {
        Write-Host "   First service: $($services[0].name) - Charges: $($services[0].charges)"
        Write-Host "   Has images: $($services[0].images.Count)"
        Write-Host "   Has inventory items: $($services[0].inventory_items.Count)"
    } else {
        Write-Host "   (No services in database)"
    }
} catch {
    Write-Host "   ✗ Services API: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Status: $($_.Exception.Response.StatusCode.value__)"
}
Write-Host ""

# Test 3: Assigned Services API
Write-Host "3. Testing Assigned Services API..." -ForegroundColor Yellow
try {
    $assigned = Invoke-RestMethod -Uri "http://localhost:8011/api/services/assigned?skip=0&limit=5" -Method Get -TimeoutSec 5
    Write-Host "   ✓ Assigned Services API: PASSED" -ForegroundColor Green
    Write-Host "   Found $($assigned.Count) assigned services"
} catch {
    Write-Host "   ✗ Assigned Services API: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Port Status
Write-Host "4. Checking Server Ports..." -ForegroundColor Yellow
$backend = Get-NetTCPConnection -LocalPort 8011 -State Listen -ErrorAction SilentlyContinue
$frontend = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

if ($backend) {
    Write-Host "   ✓ Backend (port 8011): LISTENING" -ForegroundColor Green
} else {
    Write-Host "   ✗ Backend (port 8011): NOT LISTENING" -ForegroundColor Red
    Write-Host "   → Start backend with: cd ResortApp && python main.py" -ForegroundColor Yellow
}

if ($frontend) {
    Write-Host "   ✓ Frontend (port 3000): LISTENING" -ForegroundColor Green
} else {
    Write-Host "   ✗ Frontend (port 3000): NOT LISTENING" -ForegroundColor Red
    Write-Host "   → Start frontend with: cd dasboard && npm start" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan


