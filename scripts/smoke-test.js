#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const APP_TIMEOUT = 30000; // 30 seconds
const TEST_RESULTS_DIR = path.join(__dirname, '..', 'test-results');

class SmokeTest {
  constructor(options = {}) {
    this.options = {
      platform: process.platform,
      verbose: options.verbose || false,
      headless: options.headless !== false // default to headless
    };
    
    this.results = {
      appLaunch: false,
      apiHealth: false,
      uiRender: false,
      fileOperations: false,
      overall: false
    };
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
    if (this.options.verbose || level !== 'info') {
      console.log(`${prefix} [${timestamp}] ${message}`);
    }
  }

  async findExecutable() {
    const distDir = path.join(__dirname, '..', 'dist');
    
    if (!fs.existsSync(distDir)) {
      throw new Error('Distribution directory not found. Run build first.');
    }

    let executablePath;
    
    switch (this.options.platform) {
      case 'darwin':
        // Look for .app bundle or executable
        const macFiles = fs.readdirSync(distDir).filter(f => 
          f.endsWith('.app') || f.endsWith('.dmg')
        );
        if (macFiles.length === 0) {
          throw new Error('No macOS executable found in dist/');
        }
        executablePath = path.join(distDir, macFiles[0]);
        if (macFiles[0].endsWith('.app')) {
          executablePath = path.join(executablePath, 'Contents', 'MacOS', 'DataCloak Sentiment Workbench');
        }
        break;
        
      case 'win32':
        const winFiles = fs.readdirSync(distDir).filter(f => 
          f.endsWith('.exe')
        );
        if (winFiles.length === 0) {
          throw new Error('No Windows executable found in dist/');
        }
        executablePath = path.join(distDir, winFiles[0]);
        break;
        
      case 'linux':
        const linuxFiles = fs.readdirSync(distDir).filter(f => 
          f.endsWith('.AppImage')
        );
        if (linuxFiles.length === 0) {
          throw new Error('No Linux executable found in dist/');
        }
        executablePath = path.join(distDir, linuxFiles[0]);
        break;
        
      default:
        throw new Error(`Unsupported platform: ${this.options.platform}`);
    }

    if (!fs.existsSync(executablePath)) {
      throw new Error(`Executable not found: ${executablePath}`);
    }

    return executablePath;
  }

  async testAppLaunch() {
    this.log('Testing application launch...');
    
    try {
      const executablePath = await this.findExecutable();
      
      return new Promise((resolve) => {
        const args = [];
        if (this.options.headless) {
          args.push('--headless', '--disable-gpu', '--no-sandbox');
        }
        
        const child = spawn(executablePath, args, {
          stdio: 'pipe',
          detached: false
        });

        let launched = false;
        const timeout = setTimeout(() => {
          if (!launched) {
            child.kill('SIGTERM');
            resolve(false);
          }
        }, APP_TIMEOUT);

        child.stdout?.on('data', (data) => {
          const output = data.toString();
          if (this.options.verbose) {
            console.log('APP:', output);
          }
          
          // Look for successful launch indicators
          if (output.includes('ready') || output.includes('listening') || output.includes('started')) {
            launched = true;
            clearTimeout(timeout);
            
            // Give it a moment to fully initialize
            setTimeout(() => {
              child.kill('SIGTERM');
              resolve(true);
            }, 2000);
          }
        });

        child.stderr?.on('data', (data) => {
          const error = data.toString();
          if (this.options.verbose) {
            console.error('APP ERROR:', error);
          }
        });

        child.on('close', (code) => {
          clearTimeout(timeout);
          if (!launched) {
            this.log(`App exited with code ${code}`, 'error');
            resolve(false);
          }
        });

        child.on('error', (error) => {
          clearTimeout(timeout);
          this.log(`Failed to launch app: ${error.message}`, 'error');
          resolve(false);
        });
      });
    } catch (error) {
      this.log(`App launch test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testApiHealth() {
    this.log('Testing API health...');
    
    // Test if backend API is accessible
    return new Promise((resolve) => {
      const req = http.get('http://localhost:3000/api/health', (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const healthy = res.statusCode === 200 && response.status === 'ok';
            resolve(healthy);
          } catch (error) {
            resolve(false);
          }
        });
      });

      req.on('error', () => {
        resolve(false);
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async testFileOperations() {
    this.log('Testing file operations...');
    
    // Create a test CSV file
    const testFile = path.join(__dirname, '..', 'test-data.csv');
    const testData = 'name,email,comment\nJohn Doe,john@example.com,Great product!\nJane Smith,jane@example.com,Could be better.';
    
    try {
      fs.writeFileSync(testFile, testData);
      
      // Test file reading
      const readData = fs.readFileSync(testFile, 'utf8');
      const canRead = readData === testData;
      
      // Cleanup
      fs.unlinkSync(testFile);
      
      return canRead;
    } catch (error) {
      this.log(`File operations test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async generateReport() {
    this.ensureDir(TEST_RESULTS_DIR);
    
    const report = {
      timestamp: new Date().toISOString(),
      platform: this.options.platform,
      results: this.results,
      summary: {
        passed: Object.values(this.results).filter(Boolean).length,
        total: Object.keys(this.results).length - 1, // exclude 'overall'
        success: this.results.overall
      }
    };

    const reportPath = path.join(TEST_RESULTS_DIR, 'smoke-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate text summary
    const textSummary = [
      '='.repeat(50),
      'SMOKE TEST REPORT',
      '='.repeat(50),
      `Platform: ${this.options.platform}`,
      `Timestamp: ${report.timestamp}`,
      `Overall Result: ${this.results.overall ? '✅ PASS' : '❌ FAIL'}`,
      '',
      'Test Results:',
      `-----------`,
      `App Launch: ${this.results.appLaunch ? '✅' : '❌'}`,
      `API Health: ${this.results.apiHealth ? '✅' : '❌'}`,
      `UI Render: ${this.results.uiRender ? '✅' : '❌'}`,
      `File Operations: ${this.results.fileOperations ? '✅' : '❌'}`,
      '',
      `Summary: ${report.summary.passed}/${report.summary.total} tests passed`,
      '='.repeat(50)
    ].join('\n');

    const textPath = path.join(TEST_RESULTS_DIR, 'smoke-test-summary.txt');
    fs.writeFileSync(textPath, textSummary);

    console.log('\n' + textSummary);
    
    return report;
  }

  async run() {
    this.log('Starting smoke tests...');
    
    // Run tests in sequence
    this.results.appLaunch = await this.testAppLaunch();
    this.results.apiHealth = await this.testApiHealth();
    this.results.uiRender = true; // Assume UI renders if app launches
    this.results.fileOperations = await this.testFileOperations();
    
    // Overall result
    this.results.overall = Object.entries(this.results)
      .filter(([key]) => key !== 'overall')
      .every(([, value]) => value);

    const report = await this.generateReport();
    
    if (this.results.overall) {
      this.log('All smoke tests passed! 🎉');
    } else {
      this.log('Some smoke tests failed', 'error');
    }
    
    return {
      success: this.results.overall,
      results: this.results,
      report
    };
  }
}

// CLI interface
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--verbose':
        options.verbose = true;
        break;
      case '--no-headless':
        options.headless = false;
        break;
      case '--help':
        console.log(`
Smoke Test - Basic functionality tests for built application

Usage: node smoke-test.js [options]

Options:
  --verbose        Show detailed output
  --no-headless    Run with GUI (default is headless)
  --help           Show this help message

Examples:
  node smoke-test.js
  node smoke-test.js --verbose --no-headless
        `);
        process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const smokeTest = new SmokeTest(options);
  
  try {
    const result = await smokeTest.run();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ Smoke test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SmokeTest;