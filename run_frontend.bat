@echo off
echo ========================================
echo Starting React Frontend
echo ========================================
echo.

REM Check if node_modules exists
if not exist "dasboard\node_modules" (
    echo Installing Node.js dependencies...
    cd dasboard
    call npm install
    cd ..
)

echo.
echo Starting React development server...
echo Frontend will be available at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.

cd dasboard
call npm start

pause

