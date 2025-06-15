# DataCloak Sentiment Workbench - E2E Test Suite

A comprehensive Playwright-based end-to-end test suite that covers all PRD functionality across browser and Electron environments.

## 🚀 Features

- **Complete PRD Coverage**: Tests all functionality from file upload to results export
- **Multi-Environment**: Works in both browser and Electron modes
- **Mock Servers**: Integrated MSW mocks for backend API and OpenAI
- **Cross-Browser**: Chrome, Firefox, Safari, and mobile testing
- **Visual Testing**: Screenshots at every major step
- **Performance Aware**: Tests with small to large datasets (10-10k rows)

## 📁 Test Structure

```
tests/e2e/
├── specs/                      # Test specifications
│   ├── 01-file-upload.spec.ts         # File upload (small to large)
│   ├── 02-field-detection.spec.ts     # Field detection & PII identification
│   ├── 03-transform-operations.spec.ts # Data transformation operations
│   ├── 04-sentiment-analysis.spec.ts   # Sentiment analysis with OpenAI mocks
│   └── 05-results-export.spec.ts       # Results export (CSV/Excel/JSON)
├── fixtures/                   # Test fixtures and utilities
│   ├── test-fixtures.ts               # Shared fixtures and assertions
│   ├── global-setup.ts                # Global test setup
│   └── global-teardown.ts             # Global test cleanup
├── mocks/                      # Mock servers
│   ├── backend-mock.ts                # Backend API mocks
│   └── openai-mock.ts                 # OpenAI API mocks
├── utils/                      # Test utilities
│   └── test-data.ts                   # Test data generation
└── playwright.config.ts       # Playwright configuration
```

## 🧪 Test Coverage

### 1. File Upload Tests (`01-file-upload.spec.ts`)
- ✅ Small CSV files (10 rows)
- ✅ Medium CSV files (1000 rows) 
- ✅ Large CSV files (10k rows)
- ✅ PII-containing files
- ✅ Invalid file formats
- ✅ Malformed CSV handling
- ✅ Drag and drop upload
- ✅ Server error handling
- ✅ Network timeout handling

### 2. Field Detection Tests (`02-field-detection.spec.ts`)
- ✅ Common field type detection (email, phone, date, currency, etc.)
- ✅ PII field identification and security warnings
- ✅ Data quality metrics and statistics
- ✅ Confidence scores and GPT assistance
- ✅ Manual field type corrections
- ✅ Summary statistics (row/column counts)
- ✅ Error handling for invalid data

### 3. Transform Operations Tests (`03-transform-operations.spec.ts`)
- ✅ Transform options display
- ✅ Data filtering operations
- ✅ Sorting and ordering
- ✅ Field renaming and formatting
- ✅ Transform preview functionality
- ✅ Skip optional transformations
- ✅ Transform validation and errors
- ✅ Large dataset handling

### 4. Sentiment Analysis Tests (`04-sentiment-analysis.spec.ts`)
- ✅ Configuration options (text field, model selection)
- ✅ Cost estimation display
- ✅ Job creation and status tracking
- ✅ Progress monitoring with real-time updates
- ✅ Results display (positive/negative/neutral)
- ✅ OpenAI API error handling (rate limits, auth errors)
- ✅ Different sentiment datasets testing
- ✅ Analysis insights and metrics

### 5. Results Export Tests (`05-results-export.spec.ts`)
- ✅ Results overview display
- ✅ Multiple export formats (CSV, Excel, JSON)
- ✅ Export filtering and column selection
- ✅ Large dataset export handling
- ✅ Export error handling
- ✅ Download progress and completion feedback

## 🛠️ Setup & Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run setup

# Set up test environment
npm run test:install
```

## 🚀 Running Tests

### Basic Test Execution
```bash
# Run all tests in Chrome
npm run test:browser

# Run tests in all browsers
npm run test:browsers

# Run specific test suite
npm run test:file-upload
npm run test:sentiment
npm run test:export

# Run with UI mode for debugging
npm run test:ui

# Run in headed mode
npm run test:headed
```

### Environment-Specific Testing
```bash
# Browser mode only
npm run test:browser

# All browser testing
npm run test:all

# Mobile testing
npm run test:mobile

# Electron testing (requires Electron build)
ELECTRON_PATH=/path/to/electron npm run test:electron
```

### CI/CD Testing
```bash
# CI-optimized run
npm run test:ci

# Generate reports
npm run report
```

## 🌐 Browser vs Electron Mode

The test suite automatically detects and adapts to different environments:

### Browser Mode Features
- ✅ Hidden file input fallback for uploads
- ✅ Mock platform bridge for Electron APIs
- ✅ Browser-specific drag & drop simulation
- ✅ Limited file system access simulation

### Electron Mode Features  
- ✅ Real platform bridge integration
- ✅ Native file dialogs
- ✅ Full file system access
- ✅ Desktop-specific features

## 🎭 Mock Servers

### Backend API Mock (`backend-mock.ts`)
- File upload endpoints
- Field profiling and inference
- Data transformation
- Sentiment analysis jobs
- Results export
- Security/DataCloak integration
- Error simulation endpoints

### OpenAI API Mock (`openai-mock.ts`)
- Chat completions with sentiment analysis
- Token usage tracking
- Model selection
- Rate limiting simulation
- Authentication error simulation

## 📊 Test Data Generation

The suite generates realistic test data:

```typescript
// Small dataset (10 rows)
await createTestCSV({ 
  rows: 10, 
  includePII: false, 
  includeNulls: false 
});

// Large dataset with PII (10k rows)
await createTestCSV({ 
  rows: 10000, 
  includePII: true, 
  includeNulls: true,
  sentiment: 'mixed' 
});
```

## 🔧 Configuration

### Environment Variables
```bash
# Electron testing
ELECTRON_PATH=/path/to/electron

# CI mode
CI=true

# Backend URL override
BACKEND_URL=http://localhost:3001

# Frontend URL override  
FRONTEND_URL=http://localhost:5173
```

### Playwright Config
The configuration supports:
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile device simulation
- Electron application testing
- Parallel execution
- Automatic screenshots and videos
- Global setup/teardown

## 📈 Test Results & Reporting

### Generated Artifacts
- **HTML Report**: `test-results/html/index.html`
- **Screenshots**: `test-results/*.png`
- **Videos**: `test-results/*.webm` (on failure)
- **Test Summary**: `test-results/test-summary.json`
- **JUnit XML**: `test-results/junit.xml`

### Viewing Results
```bash
# Open HTML report
npm run report

# View specific screenshots
open test-results/01-initial-load.png
```

## 🐛 Debugging Tests

### Interactive Debugging
```bash
# UI mode with visual test runner
npm run test:ui

# Debug mode with browser dev tools
npm run test:debug

# Headed mode to see browser
npm run test:headed
```

### Common Issues & Solutions

1. **File Upload Not Working**
   - Check if `platformBridge` mock is properly injected
   - Verify file input element exists and is accessible
   - Ensure test files are generated correctly

2. **Sentiment Analysis Timeout**
   - Check OpenAI mock server is running
   - Verify job completion logic waits properly
   - Increase timeout for large datasets

3. **Export Tests Failing**
   - Check backend mock export endpoints
   - Verify download handling in browser vs Electron
   - Ensure export format buttons are properly identified

## 🚀 CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:ci
      - uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: tests/e2e/test-results/
```

## 📝 Writing New Tests

### Test Structure Template
```typescript
import { test, expect, uploadFile, waitForFileProcessing } from '../fixtures/test-fixtures';

test.describe('New Feature Tests', () => {
  test.beforeEach(async ({ page, mockBackend, platformBridge }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should test new feature', async ({ page, testFiles, browserMode }) => {
    await test.step('Setup', async () => {
      await uploadFile(page, testFiles.small, browserMode);
      await waitForFileProcessing(page);
    });

    await test.step('Test Feature', async () => {
      // Test implementation
      await page.screenshot({ path: 'test-results/new-feature.png' });
    });
  });
});
```

### Best Practices
- Use `test.step()` for logical test sections
- Always take screenshots at key points
- Use custom fixtures for common operations
- Test both success and error scenarios
- Handle both browser and Electron modes
- Use proper waiting strategies

## 🎯 Performance Considerations

- Tests use realistic data sizes (10 to 10k rows)
- Mock servers provide fast, predictable responses
- Parallel execution for faster CI runs
- Memory-conscious test data generation
- Cleanup of temporary files

This E2E test suite provides comprehensive coverage of the DataCloak Sentiment Workbench PRD functionality with robust cross-platform support and realistic testing scenarios.