#!/usr/bin/env node

/**
 * Integration test: Data Science package with Backend API
 * Tests that the datascience package can integrate with backend services
 */

const path = require('path');
const { spawn } = require('child_process');

// Mock test data
const testData = [
  { email: 'user@example.com', name: 'John Doe', age: 30 },
  { email: 'jane@test.org', name: 'Jane Smith', age: 25 },
  { email: 'admin@company.com', name: 'Admin User', age: 35 }
];

async function runTest() {
  console.log('🧪 Starting Data Science + Backend Integration Test');
  
  try {
    // Test 1: Verify data science package can be imported
    console.log('📦 Testing data science package import...');
    const { FieldInferenceEngine, DataGenerator } = require('../../packages/datascience/dist/index.js');
    console.log('✅ Data science package imported successfully');

    // Test 2: Test field inference
    console.log('🔍 Testing field inference...');
    const engine = new FieldInferenceEngine();
    const emailValues = testData.map(row => row.email);
    const emailInference = await engine.inferField('email', emailValues);
    
    if (emailInference.inferredType !== 'email') {
      throw new Error(`Expected email type, got ${emailInference.inferredType}`);
    }
    console.log('✅ Field inference working correctly');

    // Test 3: Test data generation
    console.log('📊 Testing synthetic data generation...');
    const dataset = DataGenerator.generate({
      type: 'users',
      recordCount: 10
    });
    
    if (!dataset.fields.email || dataset.fields.email.length !== 10) {
      throw new Error('Data generation failed');
    }
    console.log('✅ Data generation working correctly');

    // Test 4: Backend API availability check (mock)
    console.log('🌐 Testing backend API integration readiness...');
    
    // Check if backend package exists and is buildable
    const backendPath = path.join(__dirname, '../../packages/backend');
    const fs = require('fs');
    
    if (!fs.existsSync(path.join(backendPath, 'package.json'))) {
      throw new Error('Backend package not found');
    }
    
    console.log('✅ Backend package structure verified');

    console.log('\n🎉 All integration tests passed!');
    console.log('📋 Test Summary:');
    console.log('   ✅ Data science package import');
    console.log('   ✅ Field inference functionality');
    console.log('   ✅ Data generation functionality');
    console.log('   ✅ Backend integration readiness');
    
    return true;
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runTest };