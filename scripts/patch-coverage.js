#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MINIMUM_PATCH_COVERAGE = process.env.MINIMUM_PATCH_COVERAGE || 80;
const BASE_COVERAGE = process.env.BASE_COVERAGE || 'coverage/base-lcov.info';
const PATCH_COVERAGE = process.env.PATCH_COVERAGE || 'coverage/merged/lcov.info';

function parseLcovFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`LCOV file not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const files = {};
  
  let currentFile = null;
  const lines = content.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('SF:')) {
      currentFile = line.substring(3);
      files[currentFile] = {
        lines: { hit: 0, found: 0 },
        branches: { hit: 0, found: 0 },
        functions: { hit: 0, found: 0 }
      };
    } else if (line.startsWith('LH:')) {
      files[currentFile].lines.hit = parseInt(line.substring(3));
    } else if (line.startsWith('LF:')) {
      files[currentFile].lines.found = parseInt(line.substring(3));
    } else if (line.startsWith('BRH:')) {
      files[currentFile].branches.hit = parseInt(line.substring(4));
    } else if (line.startsWith('BRF:')) {
      files[currentFile].branches.found = parseInt(line.substring(4));
    } else if (line.startsWith('FNH:')) {
      files[currentFile].functions.hit = parseInt(line.substring(4));
    } else if (line.startsWith('FNF:')) {
      files[currentFile].functions.found = parseInt(line.substring(4));
    }
  }
  
  return files;
}

function getChangedFiles() {
  try {
    const output = execSync('git diff --name-only HEAD^ HEAD', { encoding: 'utf8' });
    return output.trim().split('\n').filter(file => 
      file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.jsx')
    );
  } catch (error) {
    console.error('Error getting changed files:', error.message);
    return [];
  }
}

function calculatePatchCoverage(baseCoverage, patchCoverage, changedFiles) {
  const results = [];
  let totalLinesAdded = 0;
  let totalLinesCovered = 0;
  
  for (const file of changedFiles) {
    const baseFile = baseCoverage[file];
    const patchFile = patchCoverage[file];
    
    if (!patchFile) {
      console.log(`⚠️  File not found in patch coverage: ${file}`);
      continue;
    }
    
    // Calculate new lines added
    const baseLinesFound = baseFile ? baseFile.lines.found : 0;
    const patchLinesFound = patchFile.lines.found;
    const linesAdded = Math.max(0, patchLinesFound - baseLinesFound);
    
    // Calculate new lines covered
    const baseLinesHit = baseFile ? baseFile.lines.hit : 0;
    const patchLinesHit = patchFile.lines.hit;
    const newLinesCovered = Math.max(0, patchLinesHit - baseLinesHit);
    
    const coverage = linesAdded > 0 ? Math.round((newLinesCovered / linesAdded) * 100) : 100;
    
    results.push({
      file,
      linesAdded,
      newLinesCovered,
      coverage
    });
    
    totalLinesAdded += linesAdded;
    totalLinesCovered += newLinesCovered;
  }
  
  const totalPatchCoverage = totalLinesAdded > 0 ? 
    Math.round((totalLinesCovered / totalLinesAdded) * 100) : 100;
  
  return {
    files: results,
    total: {
      linesAdded: totalLinesAdded,
      linesCovered: totalLinesCovered,
      coverage: totalPatchCoverage
    }
  };
}

function generatePatchReport(patchResults) {
  console.log('\n=== Patch Coverage Report ===');
  console.log(`Total lines added: ${patchResults.total.linesAdded}`);
  console.log(`Total lines covered: ${patchResults.total.linesCovered}`);
  console.log(`Patch coverage: ${patchResults.total.coverage}%`);
  console.log(`Minimum required: ${MINIMUM_PATCH_COVERAGE}%`);
  
  console.log('\n=== File Details ===');
  for (const file of patchResults.files) {
    const status = file.coverage >= MINIMUM_PATCH_COVERAGE ? '✅' : '❌';
    console.log(`${status} ${file.file}: ${file.coverage}% (${file.newLinesCovered}/${file.linesAdded})`);
  }
  
  return patchResults.total.coverage >= MINIMUM_PATCH_COVERAGE;
}

function main() {
  console.log('Checking patch coverage...');
  
  try {
    const baseCoverage = parseLcovFile(BASE_COVERAGE);
    const patchCoverage = parseLcovFile(PATCH_COVERAGE);
    const changedFiles = getChangedFiles();
    
    if (changedFiles.length === 0) {
      console.log('No changed files found');
      return;
    }
    
    console.log(`Found ${changedFiles.length} changed files:`);
    changedFiles.forEach(file => console.log(`  - ${file}`));
    
    const patchResults = calculatePatchCoverage(baseCoverage, patchCoverage, changedFiles);
    const passed = generatePatchReport(patchResults);
    
    if (!passed) {
      console.error(`\n❌ Patch coverage below minimum: ${patchResults.total.coverage}% < ${MINIMUM_PATCH_COVERAGE}%`);
      process.exit(1);
    }
    
    console.log(`\n✅ Patch coverage meets minimum requirement: ${patchResults.total.coverage}% >= ${MINIMUM_PATCH_COVERAGE}%`);
    
  } catch (error) {
    console.error('Error checking patch coverage:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseLcovFile,
  getChangedFiles,
  calculatePatchCoverage,
  generatePatchReport
};