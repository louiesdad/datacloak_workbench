async function globalTeardown() {
  console.log('🧹 Starting E2E Test Suite Global Teardown...');
  
  try {
    // Clean up any global test artifacts
    const fs = require('fs').promises;
    const path = require('path');
    
    // Clean up temporary test data directories
    const tempDirs = [
      '/tmp/e2e-test-data-*'
    ];
    
    for (const pattern of tempDirs) {
      try {
        // Use glob to find matching directories
        const glob = require('glob');
        const matchingDirs = glob.sync(pattern);
        
        for (const dir of matchingDirs) {
          await fs.rmdir(dir, { recursive: true });
          console.log(`🗑️  Cleaned up temp directory: ${dir}`);
        }
      } catch (error) {
        console.log(`⚠️  Could not clean up ${pattern}: ${error.message}`);
      }
    }
    
    // Generate test summary
    const testResultsDir = './test-results';
    const summaryFile = path.join(testResultsDir, 'test-summary.json');
    
    try {
      const resultsFile = path.join(testResultsDir, 'results.json');
      const results = JSON.parse(await fs.readFile(resultsFile, 'utf8'));
      
      const summary = {
        timestamp: new Date().toISOString(),
        totalTests: results.stats?.total || 0,
        passed: results.stats?.passed || 0,
        failed: results.stats?.failed || 0,
        skipped: results.stats?.skipped || 0,
        duration: results.stats?.duration || 0,
        browserProjects: results.suites?.filter((s: any) => s.title.includes('browser')) || [],
        electronProject: results.suites?.find((s: any) => s.title.includes('electron')) || null
      };
      
      await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
      console.log('📊 Test summary generated');
      
      // Log summary to console
      console.log(`
📈 Test Execution Summary:
   Total Tests: ${summary.totalTests}
   ✅ Passed: ${summary.passed}
   ❌ Failed: ${summary.failed}
   ⏭️  Skipped: ${summary.skipped}
   ⏱️  Duration: ${(summary.duration / 1000).toFixed(2)}s
   🌐 Browser Projects: ${summary.browserProjects.length}
   ⚡ Electron Project: ${summary.electronProject ? 'Yes' : 'No'}
      `);
      
    } catch (error) {
      console.log('⚠️  Could not generate test summary:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Global teardown error:', error);
  }
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;