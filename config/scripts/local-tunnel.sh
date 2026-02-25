#!/bin/bash

# Local tunnel setup script
# Uses ngrok to expose local Azure Functions to the internet for webhook testing

echo "=== Local Tunnel Setup ==="
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "ngrok is not installed."
    echo ""
    echo "Install options:"
    echo "  macOS:   brew install ngrok/ngrok/ngrok"
    echo "  Linux:   snap install ngrok"
    echo "  Windows: choco install ngrok"
    echo "  Manual:  https://ngrok.com/download"
    echo ""
    exit 1
fi

# Check if ngrok is authenticated
if ! ngrok config check &> /dev/null; then
    echo "ngrok is not authenticated."
    echo ""
    echo "1. Sign up at https://ngrok.com"
    echo "2. Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "3. Run: ngrok config add-authtoken YOUR_TOKEN"
    echo ""
    exit 1
fi

echo "Starting ngrok tunnel to localhost:7071..."
echo ""
echo "IMPORTANT: After starting, update your .env file with the ngrok URL:"
echo "  WEBHOOK_URL=https://YOUR-SUBDOMAIN.ngrok-free.app/api/webhook/graph"
echo ""
echo "Then run the subscription setup script:"
echo "  pnpm setup:subscription"
echo ""

# Start ngrok
# If you have a paid plan with a custom domain, use:
# ngrok http 7071 --domain your-domain.ngrok-free.app

ngrok http 7071
