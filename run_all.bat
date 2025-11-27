@echo off
echo ========================================
echo Starting Resort Management System
echo (Backend + Frontend)
echo ========================================
echo.

REM Start backend in a new window
start "Resort Backend" cmd /k "run_local.bat"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in a new window
start "Resort Frontend" cmd /k "run_frontend.bat"

echo.
echo ========================================
echo Both servers are starting...
echo ========================================
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Close the windows to stop the servers
echo.

pause

