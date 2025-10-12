#!/bin/bash

echo ""
echo "================================"
echo "   Starting AibaPM"
echo "================================"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

echo "[1/2] Starting backend server..."
cd backend && npm run dev &
BACKEND_PID=$!

echo "[2/2] Starting frontend..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "================================"
echo "   AibaPM is running!"
echo "================================"
echo ""
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait
