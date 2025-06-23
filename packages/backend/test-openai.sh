#!/bin/bash

echo "Testing OpenAI API Connection..."
echo

# 1. Check if backend is accessible
echo "1. Checking if backend is accessible..."
curl -s -o /dev/null -w "   Backend status code: %{http_code}\n" http://localhost:3001/api/health || echo "   Backend not accessible"
echo

# 2. Reset OpenAI circuit breaker
echo "2. Resetting OpenAI circuit breaker..."
curl -X POST http://localhost:3001/api/v1/circuit-breaker/reset/openai-api -w "\n   Status code: %{http_code}\n" 2>/dev/null || echo "   Failed to reset circuit breaker"
echo

# 3. Check circuit breaker status
echo "3. Checking circuit breaker status..."
curl -s http://localhost:3001/api/v1/circuit-breaker/status/openai-api 2>/dev/null | python3 -m json.tool || echo "   Failed to check status"
echo

# 4. Test OpenAI connection
echo "4. Testing OpenAI connection..."
curl -s http://localhost:3001/api/v1/sentiment/openai/test 2>/dev/null | python3 -m json.tool || echo "   OpenAI test failed"
echo

# 5. Test sentiment analysis
echo "5. Testing sentiment analysis..."
curl -X POST http://localhost:3001/api/v1/sentiment/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a wonderful test!",
    "provider": "openai",
    "model": "gpt-3.5-turbo"
  }' \
  -s 2>/dev/null | python3 -m json.tool || echo "   Sentiment analysis failed"
echo

# 6. Check final circuit breaker status
echo "6. Checking final circuit breaker status..."
curl -s http://localhost:3001/api/v1/circuit-breaker/status/openai-api 2>/dev/null | python3 -m json.tool || echo "   Failed to check final status"
echo

echo "Test completed"