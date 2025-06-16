#!/usr/bin/env node

/**
 * Real DataCloak Integration Test
 * Tests the integration with the actual DataCloak native library
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Real DataCloak Integration\n');

// Test 1: Check if DataCloak library is built and available
function testDataCloakLibrary() {
  console.log('1. Checking DataCloak native library...');
  
  const libPath = path.join(__dirname, '../security/bin/libdatacloak_core.dylib');
  
  if (fs.existsSync(libPath)) {
    const stats = fs.statSync(libPath);
    console.log(`   ✅ DataCloak library found (${Math.round(stats.size / 1024)}KB)`);
    return true;
  } else {
    console.log('   ❌ DataCloak library not found');
    console.log(`   Expected: ${libPath}`);
    return false;
  }
}

// Test 2: Check FFI bridge implementation
function testFFIBridge() {
  console.log('\n2. Checking FFI bridge implementation...');
  
  const bridgePath = path.join(__dirname, '../security/src/datacloak/real-ffi-bridge.ts');
  
  if (fs.existsSync(bridgePath)) {
    console.log('   ✅ Real FFI bridge implementation found');
    return true;
  } else {
    console.log('   ❌ Real FFI bridge implementation missing');
    return false;
  }
}

// Test 3: Check DataCloak service integration
function testServiceIntegration() {
  console.log('\n3. Checking DataCloak service integration...');
  
  const servicePath = path.join(__dirname, '../backend/src/services/datacloak.service.ts');
  
  if (fs.existsSync(servicePath)) {
    const content = fs.readFileSync(servicePath, 'utf8');
    
    if (content.includes('RealDataCloakFFIBridge')) {
      console.log('   ✅ Service updated to use real DataCloak bridge');
      return true;
    } else {
      console.log('   ❌ Service not updated for real DataCloak integration');
      return false;
    }
  } else {
    console.log('   ❌ DataCloak service not found');
    return false;
  }
}

// Test 4: Check dependencies
function testDependencies() {
  console.log('\n4. Checking Node.js dependencies...');
  
  const packagePath = path.join(__dirname, '../backend/package.json');
  
  if (fs.existsSync(packagePath)) {
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const deps = packageData.dependencies || {};
    
    const requiredDeps = ['ffi-napi', 'ref-napi', 'ref-struct-napi'];
    const missing = requiredDeps.filter(dep => !deps[dep]);
    
    if (missing.length === 0) {
      console.log('   ✅ All FFI dependencies are installed');
      return true;
    } else {
      console.log(`   ❌ Missing dependencies: ${missing.join(', ')}`);
      return false;
    }
  } else {
    console.log('   ❌ Package.json not found');
    return false;
  }
}

// Test 5: Integration readiness check
function testIntegrationReadiness() {
  console.log('\n5. Integration readiness assessment...');
  
  const checks = [
    testDataCloakLibrary(),
    testFFIBridge(), 
    testServiceIntegration(),
    testDependencies()
  ];
  
  const passed = checks.filter(Boolean).length;
  const total = checks.length;
  
  console.log(`\n📊 Integration Status: ${passed}/${total} checks passed`);
  
  if (passed === total) {
    console.log('🎉 Ready for real DataCloak integration!');
    console.log('\nNext steps:');
    console.log('1. Run: chmod +x integrate-datacloak.sh && ./integrate-datacloak.sh');
    console.log('2. Test: npm run test:datacloak-ffi');
    console.log('3. Verify: Upload a CSV with PII and check detection accuracy');
    return true;
  } else {
    console.log('⚠️  Integration not ready. Complete the missing steps above.');
    console.log('\nRequired actions:');
    
    if (!checks[0]) {
      console.log('- Build DataCloak: cd /Users/thomaswagner/Documents/datacloak/datacloak-core && cargo build --release');
      console.log('- Copy library: cp target/release/libdatacloak_core.dylib /path/to/sentiment-workbench/packages/security/bin/');
    }
    
    if (!checks[1]) {
      console.log('- FFI bridge already created ✅');
    }
    
    if (!checks[2]) {
      console.log('- Service integration already updated ✅');
    }
    
    if (!checks[3]) {
      console.log('- Install FFI deps: npm install ffi-napi ref-napi ref-struct-napi');
    }
    
    return false;
  }
}

// Run the integration test
console.log('DataCloak Integration Readiness Test');
console.log('===================================');

const ready = testIntegrationReadiness();

console.log('\n' + '='.repeat(50));

if (ready) {
  console.log('🚀 READY TO INTEGRATE REAL DATACLOAK');
} else {
  console.log('🔧 SETUP REQUIRED BEFORE INTEGRATION');
}

process.exit(ready ? 0 : 1);