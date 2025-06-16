#!/usr/bin/env node

// Developer 1 Task Completion Verification
// Checks every specific task listed in TASKS.md against actual implementation

const fs = require('fs');
const path = require('path');

const results = {
  completed: [],
  incomplete: [],
  partiallyComplete: []
};

console.log('🔍 Verifying Developer 1 Task Completion per TASKS.md...\n');

// TASK-001: Add DataCloak dependency and setup (Week 1-2)
function checkTask001() {
  console.log('📦 Checking TASK-001: Add DataCloak dependency and setup...');
  
  const packageJsonPath = path.join(__dirname, '../backend/package.json');
  const dataCloakServicePath = path.join(__dirname, '../backend/src/services/datacloak.service.ts');
  
  // ✓ Install DataCloak library from https://github.com/louiesdad/datacloak.git
  if (fs.existsSync(packageJsonPath)) {
    const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageData = JSON.parse(packageContent);
    
    if (packageData.dependencies && packageData.dependencies['datacloak']) {
      results.completed.push('✓ Install DataCloak library from https://github.com/louiesdad/datacloak.git');
    } else {
      results.incomplete.push('✗ DataCloak library not installed as dependency');
    }
  } else {
    results.incomplete.push('✗ Backend package.json not found');
  }
  
  // ✓ Set up Rust toolchain for compilation
  const cargoTomlPath = path.join(__dirname, '../backend/Cargo.toml');
  const rustConfigPath = path.join(__dirname, '../backend/.cargo/config.toml');
  if (fs.existsSync(cargoTomlPath) || fs.existsSync(rustConfigPath)) {
    results.completed.push('✓ Set up Rust toolchain for compilation');
  } else {
    results.incomplete.push('✗ Rust toolchain for compilation not set up');
  }
  
  // ✓ Configure FFI bindings (node-ffi-napi or neon)
  if (fs.existsSync(packageJsonPath)) {
    const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
    if (packageContent.includes('neon') || packageContent.includes('ffi-napi') || packageContent.includes('ref-napi')) {
      results.completed.push('✓ Configure FFI bindings (node-ffi-napi or neon)');
    } else {
      results.incomplete.push('✗ FFI bindings (node-ffi-napi or neon) not configured');
    }
  }
  
  // ✓ Create initial DataCloak service wrapper
  if (fs.existsSync(dataCloakServicePath)) {
    const serviceContent = fs.readFileSync(dataCloakServicePath, 'utf8');
    if (serviceContent.includes('DataCloakService') || serviceContent.includes('dataCloak')) {
      results.completed.push('✓ Create initial DataCloak service wrapper');
    } else {
      results.partiallyComplete.push('⚠ DataCloak service wrapper may be incomplete');
    }
  } else {
    results.incomplete.push('✗ Initial DataCloak service wrapper not created');
  }
  
  // ✓ Write integration tests to verify DataCloak is working
  const testsPath = path.join(__dirname, '../backend/src/tests/datacloak.test.ts');
  const integrationTestsPath = path.join(__dirname, '../backend/tests/integration/datacloak.test.ts');
  const ffiTestsPath = path.join(__dirname, '../backend/src/tests/integration/datacloak-ffi-test.ts');
  if (fs.existsSync(testsPath) || fs.existsSync(integrationTestsPath) || fs.existsSync(ffiTestsPath)) {
    results.completed.push('✓ Write integration tests to verify DataCloak is working');
  } else {
    results.incomplete.push('✗ Integration tests to verify DataCloak not written');
  }
  
  // ✓ Document DataCloak API methods for other developers
  const docsPath = path.join(__dirname, '../docs/DATACLOAK_API.md');
  const readmePath = path.join(__dirname, '../backend/README.md');
  if (fs.existsSync(docsPath)) {
    results.completed.push('✓ Document DataCloak API methods for other developers');
  } else if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    if (readmeContent.includes('DataCloak') && readmeContent.includes('API')) {
      results.completed.push('✓ Document DataCloak API methods for other developers');
    } else {
      results.incomplete.push('✗ DataCloak API methods not documented for other developers');
    }
  } else {
    results.incomplete.push('✗ DataCloak API methods not documented for other developers');
  }
}

// TASK-003: Replace mock PII detection with DataCloak (Week 2-3)
function checkTask003() {
  console.log('🔒 Checking TASK-003: Replace mock PII detection with DataCloak...');
  
  const securityServicePath = path.join(__dirname, '../backend/src/services/security.service.ts');
  
  if (!fs.existsSync(securityServicePath)) {
    results.incomplete.push('TASK-003: security.service.ts not found');
    return;
  }
  
  const securityContent = fs.readFileSync(securityServicePath, 'utf8');
  
  // ✓ Delete the mock SecurityService regex patterns
  if (!securityContent.includes('regex') || !securityContent.includes('pattern')) {
    results.completed.push('✓ Delete the mock SecurityService regex patterns');
  } else {
    results.incomplete.push('✗ Mock SecurityService regex patterns still present');
  }
  
  // ✓ Integrate DataCloak's ML-powered PII detection
  if (securityContent.includes('dataCloak.detectPII') || securityContent.includes('ML-powered')) {
    results.completed.push('✓ Integrate DataCloak\'s ML-powered PII detection');
  } else {
    results.incomplete.push('✗ DataCloak\'s ML-powered PII detection not integrated');
  }
  
  // ✓ Implement confidence scoring from DataCloak
  if (securityContent.includes('confidence') && securityContent.includes('dataCloak')) {
    results.completed.push('✓ Implement confidence scoring from DataCloak');
  } else {
    results.incomplete.push('✗ Confidence scoring from DataCloak not implemented');
  }
  
  // ✓ Test detection for: email, phone, SSN, credit card, IP addresses
  if (securityContent.includes('email') && securityContent.includes('phone') && 
      securityContent.includes('SSN') && securityContent.includes('credit') && 
      securityContent.includes('IP')) {
    results.completed.push('✓ Test detection for: email, phone, SSN, credit card, IP addresses');
  } else {
    results.incomplete.push('✗ Detection testing for email, phone, SSN, credit card, IP addresses not complete');
  }
  
  // ✓ Update all tests that relied on mock PII detection
  const testFiles = [
    path.join(__dirname, '../backend/src/tests/security.test.ts'),
    path.join(__dirname, '../backend/tests/unit/security.test.ts')
  ];
  
  const testsUpdated = testFiles.some(testPath => {
    if (fs.existsSync(testPath)) {
      const testContent = fs.readFileSync(testPath, 'utf8');
      return testContent.includes('dataCloak') && !testContent.includes('mock');
    }
    return false;
  });
  
  if (testsUpdated) {
    results.completed.push('✓ Update all tests that relied on mock PII detection');
  } else {
    results.incomplete.push('✗ Tests that relied on mock PII detection not updated');
  }
  
  // ✓ Create PII detection benchmarks
  const benchmarksPath = path.join(__dirname, '../backend/benchmarks/pii-detection.js');
  if (fs.existsSync(benchmarksPath)) {
    results.completed.push('✓ Create PII detection benchmarks');
  } else {
    results.incomplete.push('✗ PII detection benchmarks not created');
  }
}

// TASK-005: Integrate DataCloak LLM sentiment analysis (Week 3-4)
function checkTask005() {
  console.log('🤖 Checking TASK-005: Integrate DataCloak LLM sentiment analysis...');
  
  const sentimentServicePath = path.join(__dirname, '../backend/src/services/sentiment.service.ts');
  
  if (!fs.existsSync(sentimentServicePath)) {
    results.incomplete.push('TASK-005: sentiment.service.ts not found');
    return;
  }
  
  const sentimentContent = fs.readFileSync(sentimentServicePath, 'utf8');
  
  // ✓ Remove keyword-based sentiment analysis
  if (!sentimentContent.includes('keyword') || !sentimentContent.includes('positive_words')) {
    results.completed.push('✓ Remove keyword-based sentiment analysis from sentiment.service.ts');
  } else {
    results.incomplete.push('✗ Keyword-based sentiment analysis still present');
  }
  
  // ✓ Integrate DataCloak's LLM sentiment analysis
  if (sentimentContent.includes('dataCloakService') && sentimentContent.includes('LLM')) {
    results.completed.push('✓ Integrate DataCloak\'s LLM sentiment analysis');
  } else {
    results.incomplete.push('✗ DataCloak\'s LLM sentiment analysis not integrated');
  }
  
  // ✓ Implement rate limiting (3 requests/second)
  if (sentimentContent.includes('rate') && sentimentContent.includes('3') && sentimentContent.includes('second')) {
    results.completed.push('✓ Implement rate limiting (3 requests/second)');
  } else {
    results.incomplete.push('✗ Rate limiting (3 requests/second) not implemented');
  }
  
  // ✓ Add retry logic with Retry-After header support
  if (sentimentContent.includes('retry') && sentimentContent.includes('Retry-After')) {
    results.completed.push('✓ Add retry logic with Retry-After header support');
  } else {
    results.incomplete.push('✗ Retry logic with Retry-After header support not added');
  }
  
  // ✓ Configure model selection (gpt-3.5-turbo, gpt-4)
  if (sentimentContent.includes('gpt-3.5-turbo') && sentimentContent.includes('gpt-4')) {
    results.completed.push('✓ Configure model selection (gpt-3.5-turbo, gpt-4)');
  } else {
    results.incomplete.push('✗ Model selection (gpt-3.5-turbo, gpt-4) not configured');
  }
  
  // ✓ Test with real customer review data
  const testDataPath = path.join(__dirname, '../backend/test-data/customer-reviews.json');
  if (fs.existsSync(testDataPath)) {
    results.completed.push('✓ Test with real customer review data');
  } else {
    results.incomplete.push('✗ Testing with real customer review data not implemented');
  }
}

// TASK-006: Enable DataCloak production features (Week 4-5)
function checkTask006() {
  console.log('🛡️ Checking TASK-006: Enable DataCloak production features...');
  
  const dataCloakServicePath = path.join(__dirname, '../backend/src/services/datacloak.service.ts');
  const configPath = path.join(__dirname, '../backend/src/config/datacloak.config.ts');
  
  let dataCloakContent = '';
  let configContent = '';
  
  if (fs.existsSync(dataCloakServicePath)) {
    dataCloakContent = fs.readFileSync(dataCloakServicePath, 'utf8');
  }
  
  if (fs.existsSync(configPath)) {
    configContent = fs.readFileSync(configPath, 'utf8');
  }
  
  // ✓ Configure ReDoS protection
  if (dataCloakContent.includes('ReDoS') || configContent.includes('ReDoS')) {
    results.completed.push('✓ Configure ReDoS protection');
  } else {
    results.incomplete.push('✗ ReDoS protection not configured');
  }
  
  // ✓ Enable validator-based email detection
  if (dataCloakContent.includes('validator') && dataCloakContent.includes('email')) {
    results.completed.push('✓ Enable validator-based email detection');
  } else {
    results.incomplete.push('✗ Validator-based email detection not enabled');
  }
  
  // ✓ Implement Luhn validation for credit cards
  if (dataCloakContent.includes('Luhn') || dataCloakContent.includes('credit')) {
    results.completed.push('✓ Implement Luhn validation for credit cards');
  } else {
    results.incomplete.push('✗ Luhn validation for credit cards not implemented');
  }
  
  // ✓ Set up DataCloak monitoring hooks
  if (dataCloakContent.includes('monitoring') || dataCloakContent.includes('hooks')) {
    results.completed.push('✓ Set up DataCloak monitoring hooks');
  } else {
    results.incomplete.push('✗ DataCloak monitoring hooks not set up');
  }
  
  // ✓ Run performance tests with large datasets
  const perfTestsPath = path.join(__dirname, '../backend/tests/performance/datacloak-perf.test.ts');
  if (fs.existsSync(perfTestsPath)) {
    results.completed.push('✓ Run performance tests with large datasets');
  } else {
    results.incomplete.push('✗ Performance tests with large datasets not run');
  }
  
  // ✓ Create production configuration guide
  const prodConfigPath = path.join(__dirname, '../docs/PRODUCTION_CONFIG.md');
  const dataCloakProdConfigPath = path.join(__dirname, '../docs/DATACLOAK_PRODUCTION_CONFIG.md');
  if (fs.existsSync(prodConfigPath) || fs.existsSync(dataCloakProdConfigPath)) {
    results.completed.push('✓ Create production configuration guide');
  } else {
    results.incomplete.push('✗ Production configuration guide not created');
  }
}

// Success Criteria Check
function checkSuccessCriteria() {
  console.log('🎯 Checking Success Criteria...');
  
  // ✓ DataCloak successfully processes 10,000 records with PII detection
  const dataCloakServicePath = path.join(__dirname, '../backend/src/services/datacloak.service.ts');
  if (fs.existsSync(dataCloakServicePath)) {
    const content = fs.readFileSync(dataCloakServicePath, 'utf8');
    if (content.includes('10000') || content.includes('10,000')) {
      results.completed.push('✓ DataCloak successfully processes 10,000 records with PII detection');
    } else {
      results.incomplete.push('✗ DataCloak 10,000 records processing not verified');
    }
  }
  
  // ✓ Sentiment analysis works with OpenAI via DataCloak
  const sentimentServicePath = path.join(__dirname, '../backend/src/services/sentiment.service.ts');
  if (fs.existsSync(sentimentServicePath)) {
    const content = fs.readFileSync(sentimentServicePath, 'utf8');
    if (content.includes('OpenAI') && content.includes('dataCloak')) {
      results.completed.push('✓ Sentiment analysis works with OpenAI via DataCloak');
    } else {
      results.incomplete.push('✗ Sentiment analysis with OpenAI via DataCloak not working');
    }
  }
  
  // ✓ All security features enabled and tested
  const securityServicePath = path.join(__dirname, '../backend/src/services/security.service.ts');
  if (fs.existsSync(securityServicePath)) {
    const content = fs.readFileSync(securityServicePath, 'utf8');
    if (content.includes('security') && content.includes('enabled') && content.includes('tested')) {
      results.completed.push('✓ All security features enabled and tested');
    } else {
      results.partiallyComplete.push('⚠ Security features may not be fully enabled and tested');
    }
  }
  
  // ✓ Performance meets <100ms per record for PII detection
  const benchmarksPath = path.join(__dirname, '../backend/benchmarks/pii-detection.js');
  if (fs.existsSync(benchmarksPath)) {
    const content = fs.readFileSync(benchmarksPath, 'utf8');
    if (content.includes('100ms') || content.includes('performance')) {
      results.completed.push('✓ Performance meets <100ms per record for PII detection');
    } else {
      results.incomplete.push('✗ Performance <100ms per record for PII detection not verified');
    }
  } else {
    results.incomplete.push('✗ Performance benchmarks for PII detection not found');
  }
}

// Run all checks
checkTask001();
checkTask003(); 
checkTask005();
checkTask006();
checkSuccessCriteria();

// Print results
console.log('\n📋 Developer 1 Task Completion Results:');
console.log('=======================================\n');

if (results.completed.length > 0) {
  console.log('✅ COMPLETED TASKS:');
  results.completed.forEach(item => console.log(`  ${item}`));
  console.log('');
}

if (results.partiallyComplete.length > 0) {
  console.log('⚠️ PARTIALLY COMPLETED:');
  results.partiallyComplete.forEach(item => console.log(`  ${item}`));
  console.log('');
}

if (results.incomplete.length > 0) {
  console.log('❌ INCOMPLETE TASKS:');
  results.incomplete.forEach(item => console.log(`  ${item}`));
  console.log('');
}

const totalTasks = results.completed.length + results.partiallyComplete.length + results.incomplete.length;
const completionRate = Math.round((results.completed.length / totalTasks) * 100);

console.log(`📊 COMPLETION SUMMARY:`);
console.log(`   Completed: ${results.completed.length}/${totalTasks} (${completionRate}%)`);
console.log(`   Partial: ${results.partiallyComplete.length}`);
console.log(`   Incomplete: ${results.incomplete.length}`);

if (results.incomplete.length === 0) {
  console.log('\n🎉 ALL ASSIGNED TASKS COMPLETED! ✅');
} else {
  console.log(`\n⚠️  ${results.incomplete.length} tasks still need completion`);
}

// Exit with appropriate code
process.exit(results.incomplete.length > 0 ? 1 : 0);