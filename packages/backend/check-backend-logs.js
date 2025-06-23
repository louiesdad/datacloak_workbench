const fs = require('fs');
const path = require('path');

console.log('=== Checking Backend Logs for OpenAI Errors ===\n');

// Check different log locations
const logFiles = [
  './backend.log',
  './logs/backend.log',
  './logs/error.log',
  './logs/app.log',
  './backend-debug.log'
];

logFiles.forEach(logFile => {
  if (fs.existsSync(logFile)) {
    console.log(`\nFound log file: ${logFile}`);
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    
    // Look for recent OpenAI related errors
    const recentLines = lines.slice(-100); // Last 100 lines
    const openaiLines = recentLines.filter(line => 
      line.toLowerCase().includes('openai') || 
      line.includes('401') ||
      line.includes('authentication') ||
      line.includes('circuit breaker')
    );
    
    if (openaiLines.length > 0) {
      console.log('Recent OpenAI-related log entries:');
      openaiLines.slice(-10).forEach(line => {
        if (line.trim()) {
          console.log('  ', line.substring(0, 200));
        }
      });
    }
  }
});

// Check for SQLite database files
console.log('\n\nChecking for memory database files:');
const files = fs.readdirSync('.');
const memoryFiles = files.filter(f => f.includes(':memory:') || f.includes('file::memory:'));
console.log(`Found ${memoryFiles.length} memory database files`);
if (memoryFiles.length > 10) {
  console.log('Sample files:', memoryFiles.slice(0, 10).join(', '), '...');
}