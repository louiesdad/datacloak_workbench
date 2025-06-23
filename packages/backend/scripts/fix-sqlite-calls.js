#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Fixing getSQLiteConnection calls to be async...');

// Find all TypeScript files with getSQLiteConnection calls
const output = execSync('find src -name "*.ts" -exec grep -l "getSQLiteConnection()" {} \\;', { encoding: 'utf8' });
const files = output.trim().split('\n').filter(f => f);

console.log(`Found ${files.length} files to fix:`);
files.forEach(file => console.log(`  - ${file}`));

for (const file of files) {
  const fullPath = path.resolve(file);
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Skip files that already have await
  if (content.includes('await getSQLiteConnection()')) {
    console.log(`✅ ${file} - already has correct async calls`);
    continue;
  }
  
  // Add import if not present
  if (!content.includes('getSQLiteConnection')) {
    // Find existing sqlite import line
    const importMatch = content.match(/import.*from ['"]\.\.\/database\/sqlite.*['"];/);
    if (importMatch) {
      // Add getSQLiteConnection to existing import
      const importLine = importMatch[0];
      if (!importLine.includes('getSQLiteConnection')) {
        const newImportLine = importLine.replace(
          /import\s*{([^}]*)}/,
          (match, imports) => {
            const cleanImports = imports.trim();
            const newImports = cleanImports ? `${cleanImports}, getSQLiteConnection` : 'getSQLiteConnection';
            return `import { ${newImports} }`;
          }
        );
        content = content.replace(importLine, newImportLine);
      }
    }
  }
  
  // Replace synchronous calls with async calls
  content = content.replace(
    /const db = getSQLiteConnection\(\);/g,
    'const db = await getSQLiteConnection();'
  );
  
  // Also handle cases where it's not assigned to const db
  content = content.replace(
    /(\s+)getSQLiteConnection\(\)(?!\.)/g,
    '$1await getSQLiteConnection()'
  );
  
  fs.writeFileSync(fullPath, content);
  console.log(`🔄 ${file} - fixed getSQLiteConnection calls`);
}

console.log('✅ All files updated successfully!');