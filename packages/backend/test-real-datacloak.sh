#!/bin/bash

API_URL="http://localhost:3001"

echo "Testing DataCloak Sentiment Workbench with Real DataCloak Library"
echo "================================================================"

# Test 1: Health Check
echo -e "\n1. Testing Health Check..."
curl -s ${API_URL}/health | jq '.' || echo "Failed"

# Test 2: API Status
echo -e "\n2. Testing API Status..."
curl -s ${API_URL}/api/v1/health/status | jq '.' || echo "Failed"

# Test 3: Security Stats
echo -e "\n3. Testing DataCloak Stats..."
curl -s ${API_URL}/api/v1/security/stats | jq '.' || echo "Stats endpoint not available"

# Test 4: PII Detection
echo -e "\n4. Testing PII Detection..."
curl -s -X POST ${API_URL}/api/v1/security/detect \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Contact john.doe@example.com or call 555-123-4567. SSN: 123-45-6789"
  }' | jq '.' || echo "PII detection failed"

# Test 5: Text Masking
echo -e "\n5. Testing Text Masking..."
curl -s -X POST ${API_URL}/api/v1/security/mask \
  -H "Content-Type: application/json" \
  -d '{
    "text": "My email is john@example.com and phone is 555-123-4567"
  }' | jq '.' || echo "Text masking failed"

# Test 6: Sentiment Analysis with PII
echo -e "\n6. Testing Sentiment Analysis with PII..."
curl -s -X POST ${API_URL}/api/v1/sentiment/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I love this product! Contact me at john@example.com",
    "config": {
      "enablePIIDetection": true
    }
  }' | jq '.' || echo "Sentiment analysis failed"

# Test 7: Batch Processing
echo -e "\n7. Testing Batch Processing..."
curl -s -X POST ${API_URL}/api/v1/sentiment/batch \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "Great service! Email: user1@test.com",
      "Terrible experience, call 555-987-6543",
      "Average product, SSN: 123-45-6789"
    ],
    "config": {
      "enablePIIDetection": true
    }
  }' | jq '.' || echo "Batch processing failed"

echo -e "\n================================================================"
echo "Test execution complete. Check for any failures above."