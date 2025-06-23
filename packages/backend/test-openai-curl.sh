#!/bin/bash

echo "=== OpenAI Circuit Breaker Test Script ==="
echo ""

# Base URL
BASE_URL="http://localhost:3001/api/v1"

# 1. Reset circuit breaker
echo "1. Resetting OpenAI circuit breaker..."
curl -X POST "${BASE_URL}/circuit-breaker/reset/openai-api" \
  -H "Content-Type: application/json" \
  -s | jq .
echo ""

# 2. Check circuit breaker status
echo "2. Checking circuit breaker status..."
curl -X GET "${BASE_URL}/circuit-breaker/status/openai-api" \
  -H "Content-Type: application/json" \
  -s | jq .
echo ""

# 3. Test OpenAI connection
echo "3. Testing OpenAI connection..."
curl -X GET "${BASE_URL}/sentiment/openai/test" \
  -H "Content-Type: application/json" \
  -s | jq .
echo ""

# 4. Test sentiment analysis
echo "4. Testing sentiment analysis..."
curl -X POST "${BASE_URL}/sentiment/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a wonderful test to verify the OpenAI API!",
    "provider": "openai",
    "model": "gpt-3.5-turbo"
  }' \
  -s | jq .
echo ""

# 5. Final status check
echo "5. Final circuit breaker status..."
curl -X GET "${BASE_URL}/circuit-breaker/status/openai-api" \
  -H "Content-Type: application/json" \
  -s | jq '.metrics | {state: .state, successCount: .successCount, failureCount: .failureCount}'
echo ""