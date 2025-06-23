#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Services that need to be fixed
const servicesToFix = [
  'src/services/analytics.service.ts',
  'src/services/insights.service.ts',
  'src/services/security.service.ts',
  'src/services/export.service.ts',
  'src/services/sentiment.service.ts',
  'src/services/compliance.service.ts',
  'src/services/enhanced-database.service.ts',
  'src/services/transform-persistence.service.ts'
];

function fixService(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace import statement
  content = content.replace(
    /import\s*{\s*getSQLiteConnection\s*}\s*from\s*['"]\.\.\/database\/sqlite-refactored['"]/g,
    "import { withSQLiteConnection } from '../database/sqlite-refactored'"
  );
  
  // Find all method definitions that use getSQLiteConnection
  const methodPattern = /async\s+(\w+)\s*\([^)]*\)\s*:\s*Promise<[^>]+>\s*{[\s\S]*?^  }/gm;
  const methods = content.match(methodPattern) || [];
  
  methods.forEach(method => {
    if (method.includes('getSQLiteConnection')) {
      // Extract method body
      const methodStart = method.indexOf('{');
      const methodBody = method.substring(methodStart + 1, method.length - 1);
      
      // Check if it's already using withSQLiteConnection
      if (!method.includes('withSQLiteConnection')) {
        // Find the line with getSQLiteConnection
        const lines = methodBody.split('\n');
        let dbVarName = 'db';
        let connectionLineIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const match = line.match(/const\s+(\w+)\s*=\s*await\s+getSQLiteConnection\(\)/);
          if (match) {
            dbVarName = match[1];
            connectionLineIndex = i;
            break;
          }
        }
        
        if (connectionLineIndex !== -1) {
          // Remove the connection line and the check
          const newLines = lines.filter((line, i) => {
            // Remove the getSQLiteConnection line
            if (i === connectionLineIndex) return false;
            // Remove the null check if it exists
            if (line.includes(`if (!${dbVarName})`) || line.includes(`if (!${dbVarName} )`)) return false;
            // Remove the return statement after null check
            if (i === connectionLineIndex + 1 && line.trim().startsWith('return')) return false;
            return true;
          });
          
          // Wrap the remaining code in withSQLiteConnection
          const indentedCode = newLines.map(line => '  ' + line).join('\n');
          const wrappedBody = `
    return withSQLiteConnection(async (${dbVarName}) => {${indentedCode}
    });`;
          
          // Replace the method body
          const newMethod = method.substring(0, methodStart + 1) + wrappedBody + '\n  }';
          content = content.replace(method, newMethod);
        }
      }
    }
  });
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${filePath}`);
}

// Fix all services
servicesToFix.forEach(service => {
  const fullPath = path.join(__dirname, service);
  if (fs.existsSync(fullPath)) {
    try {
      fixService(fullPath);
    } catch (error) {
      console.error(`Error fixing ${service}:`, error.message);
    }
  } else {
    console.warn(`File not found: ${fullPath}`);
  }
});

console.log('Done!');