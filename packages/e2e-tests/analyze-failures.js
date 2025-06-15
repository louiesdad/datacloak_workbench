const { chromium } = require('playwright');

async function analyzeTestFailures() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Test specific failure scenarios
  const failureReports = [];
  
  // Test 1: File Upload
  try {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
    
    // Check for file upload elements
    const uploadArea = await page.locator('[data-testid="file-upload-area"]').count();
    const browseButton = await page.locator('[data-testid="browse-files-button"]').count();
    const dropzone = await page.locator('[data-testid="file-drop-zone"]').count();
    const fileInput = await page.locator('input[type="file"]').count();
    
    if (uploadArea === 0 && browseButton === 0 && dropzone === 0) {
      failureReports.push({
        category: 'FE',
        test: 'File Upload',
        issue: 'No file upload UI elements found',
        details: `Expected elements missing: file-upload-area (${uploadArea}), browse-files-button (${browseButton}), file-drop-zone (${dropzone})`,
        selector: '[data-testid="file-upload-area"], [data-testid="browse-files-button"], [data-testid="file-drop-zone"]'
      });
    }
  } catch (error) {
    failureReports.push({
      category: 'FE',
      test: 'File Upload',
      issue: 'Page loading error',
      details: error.message
    });
  }
  
  // Test 2: PII Detection
  try {
    const profilerUI = await page.locator('[data-testid="profiler-ui"]').count();
    const fieldList = await page.locator('[data-testid="field-list"]').count();
    const piiBadges = await page.locator('[data-testid*="pii-badge"]').count();
    
    if (profilerUI === 0 && fieldList === 0) {
      failureReports.push({
        category: 'FE',
        test: 'PII Detection',
        issue: 'Profiler UI not rendered',
        details: `Expected elements missing: profiler-ui (${profilerUI}), field-list (${fieldList}), pii-badges (${piiBadges})`,
        selector: '[data-testid="profiler-ui"], [data-testid="field-list"]'
      });
    }
  } catch (error) {
    failureReports.push({
      category: 'FE',
      test: 'PII Detection',
      issue: 'Error checking PII elements',
      details: error.message
    });
  }
  
  // Test 3: Transform Operations
  try {
    const transformDesigner = await page.locator('[data-testid="transform-designer"]').count();
    const operationList = await page.locator('[data-testid="transform-operations"]').count();
    const transformPreview = await page.locator('[data-testid="transform-preview"]').count();
    
    if (transformDesigner === 0 && operationList === 0) {
      failureReports.push({
        category: 'FE',
        test: 'Transform Operations',
        issue: 'Transform Designer UI not rendered',
        details: `Expected elements missing: transform-designer (${transformDesigner}), transform-operations (${operationList}), transform-preview (${transformPreview})`,
        selector: '[data-testid="transform-designer"], [data-testid="transform-operations"]'
      });
    }
  } catch (error) {
    failureReports.push({
      category: 'FE',
      test: 'Transform Operations',
      issue: 'Error checking transform elements',
      details: error.message
    });
  }
  
  // Test 4: Backend API Health
  try {
    const healthResponse = await fetch('http://localhost:3001/health');
    if (!healthResponse.ok) {
      failureReports.push({
        category: 'BE',
        test: 'API Health',
        issue: 'Backend health check failed',
        details: `Status: ${healthResponse.status} ${healthResponse.statusText}`
      });
    }
  } catch (error) {
    failureReports.push({
      category: 'BE',
      test: 'API Health',
      issue: 'Cannot connect to backend',
      details: error.message
    });
  }
  
  // Test 5: Job Queue UI
  try {
    const jobQueueManager = await page.locator('[data-testid="job-queue-manager"]').count();
    const jobsList = await page.locator('[data-testid="jobs-list"]').count();
    
    if (jobQueueManager === 0 && jobsList === 0) {
      failureReports.push({
        category: 'FE',
        test: 'Job Queue',
        issue: 'Job Queue Manager UI not rendered',
        details: `Expected elements missing: job-queue-manager (${jobQueueManager}), jobs-list (${jobsList})`,
        selector: '[data-testid="job-queue-manager"], [data-testid="jobs-list"]'
      });
    }
  } catch (error) {
    failureReports.push({
      category: 'FE',
      test: 'Job Queue',
      issue: 'Error checking job queue elements',
      details: error.message
    });
  }
  
  // Test 6: Memory Monitor
  try {
    const memoryMonitor = await page.locator('[data-testid="memory-monitor"]').count();
    const memoryChart = await page.locator('[data-testid="memory-chart"]').count();
    
    if (memoryMonitor === 0 && memoryChart === 0) {
      failureReports.push({
        category: 'FE',
        test: 'Memory Monitor',
        issue: 'Memory Monitor UI not rendered',
        details: `Expected elements missing: memory-monitor (${memoryMonitor}), memory-chart (${memoryChart})`,
        selector: '[data-testid="memory-monitor"], [data-testid="memory-chart"]'
      });
    }
  } catch (error) {
    failureReports.push({
      category: 'FE',
      test: 'Memory Monitor',
      issue: 'Error checking memory monitor elements',
      details: error.message
    });
  }
  
  // Print detailed report
  console.log('\n📊 E2E Test Failure Analysis\n');
  console.log('='.repeat(80));
  
  const feIssues = failureReports.filter(r => r.category === 'FE');
  const beIssues = failureReports.filter(r => r.category === 'BE');
  
  console.log('\n🔴 Frontend (FE) Issues:', feIssues.length);
  feIssues.forEach((issue, idx) => {
    console.log(`\n${idx + 1}. ${issue.test} - ${issue.issue}`);
    console.log(`   Details: ${issue.details}`);
    if (issue.selector) {
      console.log(`   Selectors: ${issue.selector}`);
    }
  });
  
  console.log('\n\n🟡 Backend (BE) Issues:', beIssues.length);
  beIssues.forEach((issue, idx) => {
    console.log(`\n${idx + 1}. ${issue.test} - ${issue.issue}`);
    console.log(`   Details: ${issue.details}`);
  });
  
  await browser.close();
}

analyzeTestFailures().catch(console.error);