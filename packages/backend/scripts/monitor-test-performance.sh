#!/bin/bash

# Test Performance Monitoring Script
# Runs tests and analyzes performance metrics

echo "🚀 Running test performance analysis..."
echo "========================================="

# Run tests with timing information
echo "Running tests with timing..."
npm test -- --verbose 2>&1 | tee test-performance.log

# Extract slow tests (>1 second)
echo -e "\n⚠️  Slow Tests (>1000ms):"
echo "========================="
grep -E "✓.*\([0-9]{4,} ms\)" test-performance.log | sort -t'(' -k2 -nr | head -20

# Extract very slow tests (>3 seconds)
echo -e "\n🚨 Very Slow Tests (>3000ms):"
echo "=============================="
grep -E "✓.*\([3-9][0-9]{3,} ms\)" test-performance.log | sort -t'(' -k2 -nr

# Count tests by speed category
echo -e "\n📊 Test Speed Distribution:"
echo "==========================="
FAST=$(grep -E "✓.*\([0-9]{1,2} ms\)" test-performance.log | wc -l)
MEDIUM=$(grep -E "✓.*\([0-9]{3} ms\)" test-performance.log | wc -l)
SLOW=$(grep -E "✓.*\([0-9]{4,} ms\)" test-performance.log | wc -l)
TOTAL=$((FAST + MEDIUM + SLOW))

echo "Fast (<100ms):    $FAST tests"
echo "Medium (100-999ms): $MEDIUM tests"
echo "Slow (>1000ms):   $SLOW tests"
echo "Total:            $TOTAL tests"

# Calculate percentage
if [ $TOTAL -gt 0 ]; then
    FAST_PCT=$((FAST * 100 / TOTAL))
    MEDIUM_PCT=$((MEDIUM * 100 / TOTAL))
    SLOW_PCT=$((SLOW * 100 / TOTAL))
    
    echo -e "\nPercentages:"
    echo "Fast:   $FAST_PCT%"
    echo "Medium: $MEDIUM_PCT%"
    echo "Slow:   $SLOW_PCT%"
fi

# Extract total test time
echo -e "\n⏱️  Total Test Time:"
echo "==================="
grep "Time:" test-performance.log | tail -1

# Recommendations
echo -e "\n💡 Recommendations:"
echo "==================="
if [ $SLOW -gt 10 ]; then
    echo "⚠️  You have $SLOW slow tests. Consider:"
    echo "   - Running 'npm run test:optimize' to analyze timeouts"
    echo "   - Using 'npm run test:fast' for parallel execution"
    echo "   - Implementing timeout optimizations from the guide"
else
    echo "✅ Test performance looks good!"
fi

# Cleanup
rm -f test-performance.log