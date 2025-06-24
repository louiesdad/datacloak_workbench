#!/bin/bash

# Run new E2E tests for recent functionality

echo "Running E2E tests for new functionality..."
echo "========================================="

# Set test environment
export NODE_ENV=test
export MOCK_OPENAI=true
export LOG_LEVEL=error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run a test suite
run_test() {
    local test_name=$1
    local test_file=$2
    
    echo -e "\n${YELLOW}Running: $test_name${NC}"
    echo "----------------------------------------"
    
    if npm test -- "$test_file" --silent; then
        echo -e "${GREEN}✓ $test_name passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $test_name failed${NC}"
        return 1
    fi
}

# Track results
total_tests=0
passed_tests=0

# Run each test suite
test_suites=(
    "Parallel Processing E2E:tests/e2e/parallel-processing.test.ts"
    "Predictive Analytics E2E:tests/e2e/predictive-analytics.test.ts"
    "OpenAI Configuration E2E:tests/e2e/openai-configuration.test.ts"
    "Circuit Breaker Recovery E2E:tests/e2e/circuit-breaker-recovery.test.ts"
)

for suite in "${test_suites[@]}"; do
    IFS=':' read -r name file <<< "$suite"
    ((total_tests++))
    
    if run_test "$name" "$file"; then
        ((passed_tests++))
    fi
done

# Summary
echo -e "\n========================================="
echo -e "Test Summary:"
echo -e "Total: $total_tests"
echo -e "${GREEN}Passed: $passed_tests${NC}"
echo -e "${RED}Failed: $((total_tests - passed_tests))${NC}"

if [ $passed_tests -eq $total_tests ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
fi