#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files in src directory
const files = glob.sync('src/**/*.ts', {
  cwd: path.join(__dirname, '..'),
  absolute: true
});

let updatedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let updated = false;

  // Update imports from '../database/sqlite' to '../database/sqlite-refactored'
  if (content.includes("from '../database/sqlite'")) {
    content = content.replace(
      /from '\.\.\/database\/sqlite'/g,
      "from '../database/sqlite-refactored'"
    );
    updated = true;
  }

  // Update imports from '../../database/sqlite' to '../../database/sqlite-refactored'  
  if (content.includes("from '../../database/sqlite'")) {
    content = content.replace(
      /from '\.\.\/\.\.\/database\/sqlite'/g,
      "from '../../database/sqlite-refactored'"
    );
    updated = true;
  }

  // Update imports from '../../../database/sqlite' to '../../../database/sqlite-refactored'
  if (content.includes("from '../../../database/sqlite'")) {
    content = content.replace(
      /from '\.\.\/\.\.\/\.\.\/database\/sqlite'/g,
      "from '../../../database/sqlite-refactored'"
    );
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(file, content);
    updatedCount++;
    console.log(`Updated: ${path.relative(process.cwd(), file)}`);
  }
});

console.log(`\nTotal files updated: ${updatedCount}`);