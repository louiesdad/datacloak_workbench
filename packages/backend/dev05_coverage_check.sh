#\!/bin/bash

echo "=== Dev05 Test Coverage Analysis ==="
echo "Checking coverage for API routes, WebSocket, SSE, and HTTP client services"
echo

# Check which test files exist for Dev05's areas
echo "=== Test files found for Dev05's responsibilities ==="
echo

echo "WebSocket Service Tests:"
find src -name "*websocket*.test.ts" | grep -E "(service|routes)" | sort

echo -e "\nSSE Service Tests:"
find src -name "*sse*.test.ts" | grep -E "(service|routes)" | sort

echo -e "\nAPI Client Tests:"
find src -name "*api-client*.test.ts" | sort

echo -e "\nRoute Tests:"
find src/routes/__tests__ -name "*.test.ts" | sort

echo -e "\n=== Running coverage for individual components ==="

# Run tests with coverage for each component
echo -e "\n1. WebSocket Service Coverage:"
npm test -- --coverage --testPathPattern="websocket.service.test" --silent 2>/dev/null | grep -A 20 "websocket.service" | head -25 || echo "Failed to get coverage"

echo -e "\n2. SSE Service Coverage:"
npm test -- --coverage --testPathPattern="sse.service.test" --silent 2>/dev/null | grep -A 20 "sse.service" | head -25 || echo "Failed to get coverage"

echo -e "\n3. API Client Coverage:"
npm test -- --coverage --testPathPattern="api-client.test" --silent 2>/dev/null | grep -A 20 "api-client" | head -25 || echo "Failed to get coverage"

echo -e "\n4. Routes Coverage:"
npm test -- --coverage --testPathPattern="routes.*test" --silent 2>/dev/null | grep -E "(auth|data|dashboard|health).routes" | head -10 || echo "Failed to get coverage"

