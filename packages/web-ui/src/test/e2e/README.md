# E2E Tests for Multi-File Analysis Functionality

This directory contains comprehensive end-to-end tests for the multi-file analysis feature, covering the complete user workflow from session creation through insight generation.

## Test Coverage

### 1. Complete User Workflow (`multi-file-analysis.e2e.test.tsx`)

Tests the full multi-file analysis pipeline:

- **Session Creation**: Create analysis sessions with validation
- **File Upload**: Multi-file upload with progress tracking and drag-and-drop
- **File Metadata**: Column profiling and potential key identification
- **Relationship Discovery**: Automatic relationship detection between files
- **Graph Visualization**: Interactive relationship graph with node/edge interactions
- **Pattern Analysis**: Behavioral pattern mining across files
- **Join Recommendations**: Optimal data combination suggestions with SQL queries
- **Insight Generation**: Natural language insights with evidence and recommendations
- **Export Functionality**: PDF/CSV export and session persistence

### 2. API Integration (`api-integration.e2e.test.tsx`)

Tests backend API integration:

- **RESTful API Workflow**: Complete API workflow from session creation to insights
- **Error Handling**: Validation errors, 404s, and malformed requests
- **Performance Testing**: Response times and concurrent request handling
- **Data Integrity**: Consistency of data through the entire pipeline

### 3. Error Scenarios & Edge Cases

- **File Validation**: Invalid file types, size limits, duplicate names
- **Network Failures**: Upload failures and retry mechanisms
- **Real-time Updates**: WebSocket communication and progress tracking
- **Session Persistence**: Save/restore session state across navigation

### 4. Performance & Responsiveness

- **Performance Benchmarks**: Verify PRD requirements (30s file staging, 2min discovery)
- **Responsive Design**: Mobile and tablet viewport testing
- **Memory Usage**: Monitor resource consumption during analysis

## Test Data

Located in `src/test/fixtures/`:

- `users.csv` - Customer data with IDs, emails, names
- `orders.csv` - Order data linked via customer_id
- `klaviyo.csv` - Marketing engagement data linked via email
- `reviews.csv` - Sentiment data linked via customer_id
- `document.pdf` - Invalid file type for validation testing

## Configuration

### Playwright Config (`playwright.config.ts`)

- **Multiple Browsers**: Chrome, Firefox, Safari, Edge
- **Mobile Testing**: Pixel 5, iPhone 12
- **Timeouts**: 10 minutes for complex analysis workflows
- **Reporting**: HTML, JSON, JUnit reports
- **Screenshots/Video**: On failure for debugging

### Package Scripts

```bash
# Run all E2E tests
npm run test:e2e

# Run with browser UI visible
npm run test:e2e:headed

# Interactive debugging
npm run test:e2e:debug

# Playwright UI for test management
npm run test:e2e:ui
```

## Performance Requirements (from PRD)

- **File Staging**: <30 seconds per 1GB file
- **Relationship Discovery**: <2 minutes for 10 files  
- **Pattern Analysis**: <5 minutes for complete analysis
- **Memory Usage**: <2GB for 10-file analysis

## Success Metrics (from PRD)

- **Relationship Accuracy**: >95% precision on known relationships
- **Pattern Significance**: Only patterns with p-value < 0.05
- **Join Recommendations**: >80% adoption rate
- **Insight Relevance**: >4.0/5.0 user rating

## Running the Tests

### Prerequisites

1. **Backend Running**: Ensure the backend API is running on `http://localhost:8000`
2. **Frontend Running**: Ensure the frontend is running on `http://localhost:3000`
3. **Dependencies**: Install Playwright: `npx playwright install`

### Test Execution

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test multi-file-analysis.e2e.test.tsx

# Run with specific browser
npx playwright test --project=chromium

# Debug specific test
npx playwright test --debug multi-file-analysis.e2e.test.tsx
```

### CI/CD Integration

Tests are configured for CI environments with:
- Automatic retries (2x on CI)
- Parallel execution control
- Comprehensive reporting
- Artifact collection (screenshots, videos, traces)

## Test Structure

Each test follows the pattern:

1. **Setup**: Clean state, navigate to application
2. **User Actions**: Simulate real user interactions
3. **Assertions**: Verify expected outcomes and data
4. **Cleanup**: Reset state for next test

Tests use realistic data and timing to accurately reflect production usage patterns and performance characteristics.

## Debugging

When tests fail:

1. **Screenshots**: Automatically captured on failure
2. **Videos**: Recorded for failed test scenarios  
3. **Trace Files**: Detailed execution traces available
4. **Browser DevTools**: Use `--debug` flag for step-through debugging

The E2E tests provide comprehensive coverage of the multi-file analysis feature, ensuring reliability and performance meet the specified requirements.