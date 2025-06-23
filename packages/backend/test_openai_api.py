#!/usr/bin/env python3
import urllib.request
import urllib.parse
import json
import sys

print("=== OpenAI API Test ===\n")

base_url = "http://localhost:3001"

try:
    # Test 1: Reset Circuit Breaker
    print("1. Resetting circuit breaker...")
    reset_req = urllib.request.Request(
        f"{base_url}/api/v1/circuit-breaker/reset/openai-api",
        method='POST'
    )
    try:
        with urllib.request.urlopen(reset_req) as response:
            data = json.loads(response.read().decode())
            print(f"   ✓ Status: {response.status}")
            print(f"   ✓ Response: {data}")
    except Exception as e:
        print(f"   ✗ Failed: {e}")
    
    print("\n2. Checking circuit breaker status...")
    try:
        with urllib.request.urlopen(f"{base_url}/api/v1/circuit-breaker/status/openai-api") as response:
            data = json.loads(response.read().decode())
            metrics = data.get('metrics', {})
            print(f"   ✓ State: {metrics.get('state', 'Unknown')}")
            print(f"   ✓ Success Count: {metrics.get('successCount', 0)}")
            print(f"   ✓ Failure Count: {metrics.get('failureCount', 0)}")
    except Exception as e:
        print(f"   ✗ Failed: {e}")
    
    print("\n3. Testing OpenAI connection...")
    try:
        with urllib.request.urlopen(f"{base_url}/api/v1/sentiment/openai/test") as response:
            data = json.loads(response.read().decode())
            print(f"   ✓ Status: {response.status}")
            print(f"   ✓ Response: {data}")
    except Exception as e:
        print(f"   ✗ Failed: {e}")
    
    print("\n4. Testing sentiment analysis...")
    analysis_data = json.dumps({
        "text": "This product is absolutely amazing!",
        "provider": "openai",
        "model": "gpt-3.5-turbo"
    }).encode('utf-8')
    
    analysis_req = urllib.request.Request(
        f"{base_url}/api/v1/sentiment/analyze",
        data=analysis_data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(analysis_req) as response:
            result = json.loads(response.read().decode())
            if 'sentiment' in result:
                print(f"   ✅ SUCCESS! Analysis completed")
                print(f"   ✓ Sentiment: {result['sentiment']}")
                print(f"   ✓ Score: {result.get('score', 'N/A')}")
                print(f"   ✓ Confidence: {result.get('confidence', 'N/A')}")
            else:
                print(f"   ❌ FAILED: {result}")
    except urllib.error.HTTPError as e:
        error_data = e.read().decode()
        print(f"   ❌ HTTP Error {e.code}: {error_data}")
    except Exception as e:
        print(f"   ❌ Failed: {e}")
    
    print("\n5. Final circuit breaker check...")
    try:
        with urllib.request.urlopen(f"{base_url}/api/v1/circuit-breaker/status/openai-api") as response:
            data = json.loads(response.read().decode())
            metrics = data.get('metrics', {})
            state = metrics.get('state', 'Unknown')
            print(f"   ✓ Final State: {state}")
            
            if state == 'CLOSED':
                print("\n✅ SUCCESS: OpenAI API is working correctly!")
            else:
                print(f"\n⚠️  WARNING: Circuit breaker is {state}")
    except Exception as e:
        print(f"   ✗ Failed: {e}")
        
except Exception as e:
    print(f"\n❌ Backend is not accessible: {e}")
    print("Please ensure the backend is running on port 3001")
    sys.exit(1)

print("\n=== Test Complete ===")