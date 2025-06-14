#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const COVERAGE_DIR = path.join(__dirname, '..', 'coverage');
const MERGED_DIR = path.join(COVERAGE_DIR, 'merged');

// Coverage thresholds per package (from PRD)
const COVERAGE_THRESHOLDS = {
  'web-ui': { lines: 70, branches: 60, functions: 70, statements: 70 },
  'backend': { lines: 85, branches: 70, functions: 85, statements: 85 },
  'datascience': { lines: 90, branches: 80, functions: 90, statements: 90 },
  'security': { lines: 100, branches: 95, functions: 100, statements: 100 }
};

const GLOBAL_THRESHOLD = 80;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function findCoverageFiles() {
  const coverageFiles = [];
  const packages = fs.readdirSync(PACKAGES_DIR);
  
  for (const pkg of packages) {
    const packagePath = path.join(PACKAGES_DIR, pkg);
    const coverageFile = path.join(packagePath, 'coverage', 'lcov.info');
    
    if (fs.existsSync(coverageFile)) {
      coverageFiles.push({
        package: pkg,
        file: coverageFile
      });
      console.log(`Found coverage for ${pkg}: ${coverageFile}`);
    } else {
      console.warn(`No coverage found for ${pkg}`);
    }
  }
  
  return coverageFiles;
}

function mergeCoverageFiles(coverageFiles) {
  ensureDir(MERGED_DIR);
  
  const mergedLcov = path.join(MERGED_DIR, 'lcov.info');
  const tempFiles = [];
  
  // Copy and adjust paths for each package
  for (const { package: pkg, file } of coverageFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const adjustedContent = content.replace(
      /^SF:(.+)$/gm,
      `SF:packages/${pkg}/$1`
    );
    
    const tempFile = path.join(MERGED_DIR, `${pkg}.lcov`);
    fs.writeFileSync(tempFile, adjustedContent);
    tempFiles.push(tempFile);
  }
  
  // Merge all LCOV files
  const lcovResultMerger = require('lcov-result-merger');
  const mergedResult = lcovResultMerger.merge(tempFiles);
  fs.writeFileSync(mergedLcov, mergedResult);
  
  // Clean up temp files
  tempFiles.forEach(file => fs.unlinkSync(file));
  
  console.log(`Merged coverage written to: ${mergedLcov}`);
  return mergedLcov;
}

function generateReports(mergedLcov) {
  const reportsDir = path.join(__dirname, '..', 'reports', 'coverage');
  ensureDir(reportsDir);
  
  try {
    // Generate HTML report
    execSync(`npx nyc report --reporter=html --report-dir=${reportsDir}/html --temp-dir=${MERGED_DIR}`, {
      stdio: 'inherit'
    });
    
    // Generate Cobertura XML for CI
    execSync(`npx nyc report --reporter=cobertura --report-dir=${MERGED_DIR} --temp-dir=${MERGED_DIR}`, {
      stdio: 'inherit'
    });
    
    // Generate JSON summary
    execSync(`npx nyc report --reporter=json-summary --report-dir=${MERGED_DIR} --temp-dir=${MERGED_DIR}`, {
      stdio: 'inherit'
    });
    
    console.log(`Coverage reports generated in: ${reportsDir}`);
  } catch (error) {
    console.error('Error generating coverage reports:', error.message);
  }
}

function checkCoverageThresholds() {
  const summaryFile = path.join(MERGED_DIR, 'coverage-summary.json');
  
  if (!fs.existsSync(summaryFile)) {
    console.error('Coverage summary not found');
    process.exit(1);
  }
  
  const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  const total = summary.total;
  
  console.log('\n=== Coverage Summary ===');
  console.log(`Lines: ${total.lines.pct}%`);
  console.log(`Branches: ${total.branches.pct}%`);
  console.log(`Functions: ${total.functions.pct}%`);
  console.log(`Statements: ${total.statements.pct}%`);
  
  // Check global threshold
  const globalPassed = total.lines.pct >= GLOBAL_THRESHOLD;
  
  if (!globalPassed) {
    console.error(`\n❌ Global coverage threshold not met: ${total.lines.pct}% < ${GLOBAL_THRESHOLD}%`);
    process.exit(1);
  }
  
  console.log(`\n✅ Global coverage threshold met: ${total.lines.pct}% >= ${GLOBAL_THRESHOLD}%`);
  
  // Check per-package thresholds
  let allPackagesPassed = true;
  
  for (const [packageName, thresholds] of Object.entries(COVERAGE_THRESHOLDS)) {
    const packageCoverage = summary[`packages/${packageName}`];
    
    if (!packageCoverage) {
      console.warn(`⚠️  No coverage data found for package: ${packageName}`);
      continue;
    }
    
    const packagePassed = packageCoverage.lines.pct >= thresholds.lines;
    
    if (packagePassed) {
      console.log(`✅ ${packageName}: ${packageCoverage.lines.pct}% >= ${thresholds.lines}%`);
    } else {
      console.error(`❌ ${packageName}: ${packageCoverage.lines.pct}% < ${thresholds.lines}%`);
      allPackagesPassed = false;
    }
  }
  
  if (!allPackagesPassed) {
    console.error('\n❌ Some packages failed coverage thresholds');
    process.exit(1);
  }
  
  console.log('\n✅ All coverage thresholds met!');
}

function main() {
  console.log('Starting coverage merge process...');
  
  const coverageFiles = findCoverageFiles();
  
  if (coverageFiles.length === 0) {
    console.error('No coverage files found');
    process.exit(1);
  }
  
  const mergedLcov = mergeCoverageFiles(coverageFiles);
  generateReports(mergedLcov);
  checkCoverageThresholds();
  
  console.log('\nCoverage merge completed successfully!');
}

if (require.main === module) {
  main();
}

module.exports = {
  findCoverageFiles,
  mergeCoverageFiles,
  generateReports,
  checkCoverageThresholds
};