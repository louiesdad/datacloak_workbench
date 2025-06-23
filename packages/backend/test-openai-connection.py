#!/usr/bin/env python3
import requests
import json
import time

def test_openai_connection():
    base_url = "http://localhost:3001"
    results = {}
    
    # 1. Check if backend is accessible
    print("1. Checking if backend is accessible...")
    try:
        response = requests.get(f"{base_url}/api/health", timeout=5)
        results['backend_accessible'] = True
        results['health_status'] = response.status_code
        print(f"   ✓ Backend is accessible (status: {response.status_code})")
    except Exception as e:
        results['backend_accessible'] = False
        results['backend_error'] = str(e)
        print(f"   ✗ Backend not accessible: {e}")
        return results
    
    # 2. Reset OpenAI circuit breaker
    print("\n2. Resetting OpenAI circuit breaker...")
    try:
        response = requests.post(f"{base_url}/api/v1/circuit-breaker/reset/openai-api", timeout=5)
        results['circuit_breaker_reset'] = response.status_code == 200
        results['reset_response'] = response.text
        print(f"   Circuit breaker reset: {response.status_code}")
        if response.text:
            print(f"   Response: {response.text}")
    except Exception as e:
        results['circuit_breaker_reset'] = False
        results['reset_error'] = str(e)
        print(f"   ✗ Failed to reset circuit breaker: {e}")
    
    # 3. Check circuit breaker status
    print("\n3. Checking circuit breaker status...")
    try:
        response = requests.get(f"{base_url}/api/v1/circuit-breaker/status/openai-api", timeout=5)
        results['circuit_breaker_status_code'] = response.status_code
        if response.status_code == 200:
            status_data = response.json()
            results['circuit_breaker_state'] = status_data.get('state', 'UNKNOWN')
            print(f"   Circuit breaker state: {status_data.get('state', 'UNKNOWN')}")
            print(f"   Full status: {json.dumps(status_data, indent=2)}")
        else:
            results['circuit_breaker_state'] = 'ERROR'
            print(f"   ✗ Failed to get status: {response.status_code}")
    except Exception as e:
        results['circuit_breaker_state'] = 'ERROR'
        results['status_error'] = str(e)
        print(f"   ✗ Failed to check status: {e}")
    
    # 4. Test OpenAI connection
    print("\n4. Testing OpenAI connection...")
    try:
        response = requests.get(f"{base_url}/api/v1/sentiment/openai/test", timeout=10)
        results['openai_test_status'] = response.status_code
        results['openai_test_success'] = response.status_code == 200
        print(f"   OpenAI test status: {response.status_code}")
        if response.status_code == 200:
            test_data = response.json()
            print(f"   Response: {json.dumps(test_data, indent=2)}")
            results['openai_test_response'] = test_data
        else:
            print(f"   Response: {response.text}")
            results['openai_test_error'] = response.text
    except Exception as e:
        results['openai_test_success'] = False
        results['openai_test_error'] = str(e)
        print(f"   ✗ OpenAI test failed: {e}")
    
    # 5. Test sentiment analysis
    print("\n5. Testing sentiment analysis...")
    try:
        payload = {
            "text": "This is a wonderful test!",
            "provider": "openai",
            "model": "gpt-3.5-turbo"
        }
        headers = {'Content-Type': 'application/json'}
        response = requests.post(
            f"{base_url}/api/v1/sentiment/analyze", 
            json=payload, 
            headers=headers,
            timeout=15
        )
        results['sentiment_analysis_status'] = response.status_code
        results['sentiment_analysis_success'] = response.status_code == 200
        print(f"   Sentiment analysis status: {response.status_code}")
        if response.status_code == 200:
            analysis_data = response.json()
            print(f"   Response: {json.dumps(analysis_data, indent=2)}")
            results['sentiment_analysis_response'] = analysis_data
        else:
            print(f"   Response: {response.text}")
            results['sentiment_analysis_error'] = response.text
    except Exception as e:
        results['sentiment_analysis_success'] = False
        results['sentiment_analysis_error'] = str(e)
        print(f"   ✗ Sentiment analysis failed: {e}")
    
    # 6. Check final circuit breaker status
    print("\n6. Checking final circuit breaker status...")
    try:
        response = requests.get(f"{base_url}/api/v1/circuit-breaker/status/openai-api", timeout=5)
        if response.status_code == 200:
            status_data = response.json()
            results['final_circuit_breaker_state'] = status_data.get('state', 'UNKNOWN')
            print(f"   Final circuit breaker state: {status_data.get('state', 'UNKNOWN')}")
            print(f"   Full status: {json.dumps(status_data, indent=2)}")
        else:
            results['final_circuit_breaker_state'] = 'ERROR'
            print(f"   ✗ Failed to get final status: {response.status_code}")
    except Exception as e:
        results['final_circuit_breaker_state'] = 'ERROR'
        results['final_status_error'] = str(e)
        print(f"   ✗ Failed to check final status: {e}")
    
    # Summary
    print("\n" + "="*50)
    print("SUMMARY:")
    print("="*50)
    print(f"Backend accessible: {results.get('backend_accessible', False)}")
    print(f"Circuit breaker state: {results.get('circuit_breaker_state', 'UNKNOWN')} → {results.get('final_circuit_breaker_state', 'UNKNOWN')}")
    print(f"OpenAI test successful: {results.get('openai_test_success', False)}")
    print(f"Sentiment analysis successful: {results.get('sentiment_analysis_success', False)}")
    
    if not results.get('openai_test_success', False):
        print(f"\nOpenAI test error: {results.get('openai_test_error', 'Unknown error')}")
    
    if not results.get('sentiment_analysis_success', False):
        print(f"\nSentiment analysis error: {results.get('sentiment_analysis_error', 'Unknown error')}")
    
    return results

if __name__ == "__main__":
    test_openai_connection()