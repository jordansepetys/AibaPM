@echo off
echo.
echo ================================
echo    Starting AibaPM
echo ================================
echo.

REM Start backend in new window
echo [1/2] Starting backend server...
start "AibaPM Backend" cmd /k "cd backend && npm run dev"

REM Wait a moment for backend to start
timeout /t 3 /nobreak > nul

REM Start frontend in new window
echo [2/2] Starting frontend...
start "AibaPM Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ================================
echo    AibaPM is starting!
echo ================================
echo.
echo Backend will run on: http://localhost:3001
echo Frontend will run on: http://localhost:5173
echo.
echo Both servers will open in new windows.
echo Close those windows to stop the servers.
echo.
pause
