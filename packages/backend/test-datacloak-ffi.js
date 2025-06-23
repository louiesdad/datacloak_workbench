const koffi = require('koffi');
const path = require('path');

// Path to the Rust library
const libraryPath = path.join(__dirname, '..', 'security', 'datacloak-core', 'target', 'release', 'libdatacloak_core.dylib');

console.log('Loading library from:', libraryPath);

try {
  // Load the library
  const lib = koffi.load(libraryPath);
  
  // Define function signatures
  const datacloak_create = lib.func('datacloak_create', 'void*', []);
  const datacloak_version = lib.func('datacloak_version', 'char*', []);
  const datacloak_detect_pii = lib.func('datacloak_detect_pii', 'char*', ['void*', 'str']);
  const datacloak_mask_text = lib.func('datacloak_mask_text', 'char*', ['void*', 'str']);
  const datacloak_free_string = lib.func('datacloak_free_string', 'void', ['char*']);
  const datacloak_destroy = lib.func('datacloak_destroy', 'void', ['void*']);
  
  // Get version
  const versionPtr = datacloak_version();
  console.log('DataCloak version:', versionPtr);
  datacloak_free_string(versionPtr);
  
  // Create engine
  const engine = datacloak_create();
  console.log('Engine created:', engine);
  
  // Test PII detection
  const testText = 'Contact me at john.doe@example.com or call 555-123-4567';
  console.log('\nTest text:', testText);
  
  const resultPtr = datacloak_detect_pii(engine, testText);
  const results = JSON.parse(resultPtr);
  datacloak_free_string(resultPtr);
  
  console.log('\nDetected PII:');
  results.forEach(r => {
    console.log(`- ${r.pii_type}: "${r.sample}" (confidence: ${r.confidence})`);
  });
  
  // Test text masking
  const maskResultPtr = datacloak_mask_text(engine, testText);
  const maskResult = JSON.parse(maskResultPtr);
  datacloak_free_string(maskResultPtr);
  
  console.log('\nMasked text:', maskResult.masked_text);
  console.log('Processing time:', maskResult.metadata.processing_time, 'ms');
  
  // Clean up
  datacloak_destroy(engine);
  console.log('\nEngine destroyed successfully');
  
} catch (error) {
  console.error('Error:', error);
}