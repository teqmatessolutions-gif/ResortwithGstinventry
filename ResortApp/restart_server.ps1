# Script to clean up all server processes and restart with updated code
Write-Host "=== Cleaning up old server processes ===" -ForegroundColor Yellow

# Stop all Python processes related to the project
Get-Process | Where-Object {
    ($_.ProcessName -eq "python" -or $_.ProcessName -eq "uvicorn") -and
    ($_.Path -like "*orchid*" -or $_.Path -like "*ResortApp*")
} | ForEach-Object {
    Write-Host "Stopping process: $($_.Id) - $($_.ProcessName)" -ForegroundColor Red
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# Wait for processes to fully stop
Start-Sleep -Seconds 3

# Verify port is free
$listening = netstat -ano | findstr ":8011" | findstr "LISTENING"
if ($listening) {
    Write-Host "`n⚠️ WARNING: Port 8011 is still in use!" -ForegroundColor Red
    Write-Host "Please manually stop these processes:" -ForegroundColor Yellow
    $listening | ForEach-Object {
        $processId = ($_ -split '\s+')[-1]
        $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "  PID $processId - $($proc.ProcessName) - $($proc.Path)" -ForegroundColor Yellow
        }
    }
    Write-Host "`nRun: Get-Process python,uvicorn | Stop-Process -Force" -ForegroundColor Cyan
    exit 1
}

Write-Host "`n✅ Port 8011 is free!" -ForegroundColor Green

# Start the server
Write-Host "`n=== Starting server with updated code ===" -ForegroundColor Yellow
Set-Location "C:\releasing\orchid\ResortApp"
$serverProcess = Start-Process -FilePath "venv\Scripts\python.exe" `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--port", "8011", "--host", "0.0.0.0" `
    -PassThru `
    -NoNewWindow

Write-Host "Server started with PID: $($serverProcess.Id)" -ForegroundColor Green
Write-Host "Waiting for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Test the endpoint
Write-Host "`n=== Testing inventory endpoints ===" -ForegroundColor Yellow
$token = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3NjkyNjgzMzV9.MwGGTxTmwXUFSlsn4Nkg-gpY4W_QvcqSgq36eGS3W98"

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8011/api/inventory/vendors?limit=10" `
        -Method GET `
        -Headers @{"Authorization"=$token} `
        -ErrorAction Stop
    
    Write-Host "✅ SUCCESS! GET /api/inventory/vendors is working!" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response length: $($response.Content.Length) bytes" -ForegroundColor Green
} catch {
    Write-Host "❌ FAILED: GET /api/inventory/vendors returned $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nThe server may need more time to start, or there's still an old process running." -ForegroundColor Yellow
}

Write-Host "`n=== Server is running ===" -ForegroundColor Green
Write-Host "You can now test the endpoints from your frontend." -ForegroundColor Green
Write-Host "To stop the server, press Ctrl+C in the server window or run:" -ForegroundColor Cyan
Write-Host "   Stop-Process -Id $($serverProcess.Id) -Force" -ForegroundColor Cyan

