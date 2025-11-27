@echo off
echo ========================================
echo Starting Resort Management System
echo ========================================
echo.

REM Check if virtual environment exists
if not exist "ResortApp\venv\Scripts\activate.bat" (
    echo Creating virtual environment...
    cd ResortApp
    python -m venv venv
    cd ..
)

echo Activating virtual environment...
call ResortApp\venv\Scripts\activate.bat

echo.
echo Installing/updating Python dependencies...
cd ResortApp
pip install -q -r requirements.txt
cd ..

echo.
echo ========================================
echo Starting FastAPI Backend Server
echo ========================================
echo Backend will be available at: http://localhost:8000
echo API Documentation: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.

cd ResortApp
python main.py
cd ..

pause

