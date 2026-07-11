#!/bin/bash

# Ensure script halts on any errors
set -e

echo "=================================================="
echo "Student Notes Chatbot - Killercoda Setup Script"
echo "=================================================="

# Check if running in Killercoda
if [ -f /etc/killercoda/host ]; then
  echo "[+] Detected Killercoda environment."
  # Retrieve host template and replace PORT placeholder with 8000 (backend port)
  HOST_TEMPLATE=$(cat /etc/killercoda/host)
  export VITE_API_BASE=$(sed 's/PORT/8000/g' /etc/killercoda/host)
  echo "[+] Configured Backend API URL (VITE_API_BASE): ${VITE_API_BASE}"
  
  # Also print the frontend URL for convenience
  FRONTEND_URL=$(sed 's/PORT/5173/g' /etc/killercoda/host)
  echo "[+] Frontend will be accessible at: ${FRONTEND_URL}"
else
  echo "[!] Not running in Killercoda environment, or /etc/killercoda/host is missing."
  echo "[!] Defaulting VITE_API_BASE to http://localhost:8000"
  export VITE_API_BASE="http://localhost:8000"
fi

# Build and start services
echo "[+] Launching services via Docker Compose..."
docker-compose up --build
