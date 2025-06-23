#!/bin/bash

# Start the backend with required environment variables
export ADMIN_PASSWORD=admin123
export JWT_SECRET=test-jwt-secret-that-is-32-chars-long
export ENCRYPTION_KEY=test-32-char-encryption-key-here
export REDIS_HOST=localhost
export REDIS_PORT=6379

echo "Starting DataCloak Sentiment Workbench Backend..."
echo "Server will be available at http://localhost:3001"
echo ""

npm run dev