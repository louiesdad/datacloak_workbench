#!/bin/bash

# Script to test a single service quickly
# Usage: ./test-single-service.sh cache

SERVICE=$1

if [ -z "$SERVICE" ]; then
  echo "Usage: $0 <service-name>"
  echo "Example: $0 cache"
  exit 1
fi

echo "🧪 Testing $SERVICE service..."

# Run the test with minimal overhead
npx jest "src/services/__tests__/$SERVICE.service.test.ts" \
  --no-coverage \
  --testTimeout=10000 \
  --maxWorkers=1 \
  --forceExit \
  --silent=false

if [ $? -eq 0 ]; then
  echo "✅ $SERVICE service tests passed!"
else
  echo "❌ $SERVICE service tests failed!"
  exit 1
fi