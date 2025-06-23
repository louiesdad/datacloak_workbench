#!/bin/bash

# Find files with console.log that might be logging undefined
echo "Searching for console.log statements that might print undefined..."

# Look for console.log with a single word (variable name)
grep -r "console\.log([a-zA-Z_][a-zA-Z0-9_]*)" src/ 2>/dev/null | grep -v "console\.log(error" | grep -v "console\.log(result" | grep -v "console\.log(data" | grep -v "console\.log(response" | head -20

# Look for any console.log not followed by a quote
echo -e "\nSearching for console.log not followed by quotes..."
grep -r "console\.log(" src/ | grep -v "console\.log('" | grep -v 'console\.log("' | grep -v "console\.log(\`" | grep -v "console\.log({" | grep -v "console\.log(\[" | head -20

# Look specifically in datacloak files
echo -e "\nSearching in datacloak files..."
find src -name "*datacloak*" -type f -exec grep -H "console\.log" {} \; | grep -v "console\.log('" | grep -v 'console\.log("' | grep -v "console\.log(\`"