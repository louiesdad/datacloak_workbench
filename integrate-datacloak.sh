#!/bin/bash

# DataCloak Integration Script
set -e

echo "🔧 DataCloak Integration Script"
echo "=============================="

# Step 1: Build DataCloak Core
echo "Building DataCloak core library..."
cd /Users/thomaswagner/Documents/datacloak/datacloak-core
cargo build --release

# Step 2: Copy built library to security package
echo "Copying built library..."
mkdir -p /Users/thomaswagner/Documents/datacloak-sentiment-workbench/packages/security/bin
cp target/release/libdatacloak_core.dylib /Users/thomaswagner/Documents/datacloak-sentiment-workbench/packages/security/bin/

# Step 3: Copy source files for Node.js integration
echo "Setting up Node.js integration..."
mkdir -p /Users/thomaswagner/Documents/datacloak-sentiment-workbench/packages/security/src/datacloak
cp -r /Users/thomaswagner/Documents/datacloak/datacloak-core/src/* /Users/thomaswagner/Documents/datacloak-sentiment-workbench/packages/security/src/datacloak/

# Step 4: Update package dependencies
cd /Users/thomaswagner/Documents/datacloak-sentiment-workbench/packages/backend
npm install

echo "✅ DataCloak integration setup complete!"
echo ""
echo "Next steps:"
echo "1. Update datacloak.service.ts to use the real library"
echo "2. Run tests: npm run test:datacloak-ffi"
echo "3. Verify integration: npm run test:datacloak-integration"