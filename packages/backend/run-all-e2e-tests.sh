#!/bin/bash

# Run all E2E tests and generate report

echo "Running All E2E Tests - $(date)"
echo "================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test directories
E2E_DIRS=(
  "tests/e2e"
  "src/tests/e2e"
)

# Results tracking
total_tests=0
passed_tests=0
failed_tests=0
results_file="e2e-test-results.txt"

# Clear previous results
> "$results_file"

# Function to run a single test file
run_test_file() {
  local test_file=$1
  local test_name=$(basename "$test_file" .test.ts)
  
  echo -e "\n${YELLOW}Running: $test_name${NC}"
  echo "----------------------------------------"
  
  # Run test and capture output
  if npm test -- "$test_file" --testTimeout=15000 --silent 2>&1 | tee -a "$results_file" | grep -E "(PASS|FAIL|✓|✗)"; then
    echo -e "${GREEN}✓ $test_name passed${NC}"
    ((passed_tests++))
    return 0
  else
    echo -e "${RED}✗ $test_name failed${NC}"
    ((failed_tests++))
    return 1
  fi
}

# Run tests from each directory
for dir in "${E2E_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo -e "\n${YELLOW}Testing files in $dir${NC}"
    echo "========================================"
    
    # Find all test files
    while IFS= read -r test_file; do
      ((total_tests++))
      run_test_file "$test_file"
    done < <(find "$dir" -name "*.test.ts" -type f)
  fi
done

# Summary
echo -e "\n========================================="
echo -e "E2E Test Summary:"
echo -e "Total test files: $total_tests"
echo -e "${GREEN}Passed: $passed_tests${NC}"
echo -e "${RED}Failed: $failed_tests${NC}"
echo -e "Success rate: $(( passed_tests * 100 / total_tests ))%"

# List of specific test suites
echo -e "\n${YELLOW}Test Suite Details:${NC}"
echo "----------------------------------------"

# Check new test suites
new_tests=(
  "parallel-processing"
  "predictive-analytics"
  "openai-configuration"
  "circuit-breaker-recovery"
  "security-vulnerabilities"
  "database-resilience"
  "file-processing-edge-cases"
)

echo -e "\n${YELLOW}New E2E Test Suites:${NC}"
for test in "${new_tests[@]}"; do
  if grep -q "PASS.*$test" "$results_file" 2>/dev/null; then
    echo -e "${GREEN}✓ $test${NC}"
  elif grep -q "FAIL.*$test" "$results_file" 2>/dev/null; then
    echo -e "${RED}✗ $test${NC}"
  else
    echo -e "${YELLOW}? $test (not found)${NC}"
  fi
done

# Existing test suites
existing_tests=(
  "trigger-integration"
  "data-generator-integration"
  "prediction-accuracy"
  "multi-field-progressive-workflow"
  "realtime-workflow"
  "complete-workflow"
  "user-workflows"
  "simple-api-workflow"
  "compliance-workflows"
  "data-pipeline"
  "api-workflows"
)

echo -e "\n${YELLOW}Existing E2E Test Suites:${NC}"
for test in "${existing_tests[@]}"; do
  if grep -q "PASS.*$test" "$results_file" 2>/dev/null; then
    echo -e "${GREEN}✓ $test${NC}"
  elif grep -q "FAIL.*$test" "$results_file" 2>/dev/null; then
    echo -e "${RED}✗ $test${NC}"
  else
    echo -e "${YELLOW}? $test (not found)${NC}"
  fi
done

# Exit with appropriate code
if [ $failed_tests -eq 0 ]; then
  echo -e "\n${GREEN}All E2E tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}Some E2E tests failed!${NC}"
  exit 1
fi