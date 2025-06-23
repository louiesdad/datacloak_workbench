# E2E Test Migration Guide: MSW to Playwright

## Quick Reference

### ❌ OLD Pattern (MSW)
```typescript
test.beforeEach(async ({ page, mockBackend }) => {
  // MSW server setup
  mockBackend.use(
    http.post('http://localhost:3001/api/endpoint', () => {
      return HttpResponse.json({ data: 'mock' });
    })
  );
  await page.goto('/');
});
```

### ✅ NEW Pattern (Playwright)
```typescript
test.beforeEach(async ({ page }) => {
  // Playwright route interception
  await page.route('**/api/endpoint', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: 'mock' })
    });
  });
  await page.goto('/');
});
```

## Common Endpoints to Mock

### 1. File Upload
```typescript
await page.route('**/api/v1/data/upload', async (route) => {
  if (route.request().method() === 'POST') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          dataset: {
            datasetId: `ds_${Date.now()}`,
            originalFilename: 'test.csv',
            recordCount: 100,
            size: 1024,
            status: 'ready'
          },
          fieldInfo: [/* fields */],
          securityScan: { /* scan results */ }
        }
      })
    });
  }
});
```

### 2. Sentiment Analysis
```typescript
await page.route('**/api/v1/sentiment/batch', async (route) => {
  const body = route.request().postDataJSON();
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: body.texts.map(text => ({
        text,
        sentiment: 'positive',
        confidence: 0.95,
        pii_detected: false
      }))
    })
  });
});
```

### 3. Error Scenarios
```typescript
// Simulate server error
await page.route('**/api/endpoint', async (route) => {
  await route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({
      error: { 
        message: 'Server error',
        code: 'INTERNAL_ERROR'
      }
    })
  });
});

// Simulate network timeout
await page.route('**/api/endpoint', async (route) => {
  await new Promise(resolve => setTimeout(resolve, 35000));
  await route.abort('timedout');
});
```

## Selector Updates

### File Input
```typescript
// OLD: page.locator('input[type="file"][data-testid="hidden-file-input"]')
// NEW: 
page.locator('#file-input')  // App uses ID
```

### Workflow Steps
```typescript
// Check current step
const dataProfileHeader = page.locator('h2:has-text("Data Profile")');
await expect(dataProfileHeader).toBeVisible();
```

### Success States
```typescript
// Instead of generic success messages, check for navigation
await expect(page.locator('h2')).toContainText('Data Profile'); // After upload
await expect(page.locator('.field-info')).toBeVisible(); // Fields detected
```

## Common Pitfalls & Solutions

### 1. MSW Already Patched Error
**Problem**: "Failed to patch the 'fetch' module: already patched"
**Solution**: Remove all MSW fixtures from test

### 2. Request Not Intercepted
**Problem**: Real requests going to backend
**Solution**: Use wildcard patterns: `**/api/...` not `http://localhost:3001/api/...`

### 3. Timeout Waiting for Elements
**Problem**: Element not found after action
**Solution**: Add explicit waits after actions that trigger navigation
```typescript
await uploadButton.click();
await page.waitForTimeout(2000); // Give time for navigation
```

### 4. File Upload Not Working
**Problem**: File input not accepting files
**Solution**: Use the file input ID directly
```typescript
await page.locator('#file-input').setInputFiles(filePath);
```

## Testing Checklist

Before marking a test as complete:
- [ ] All MSW imports removed
- [ ] All `mockBackend` fixture usage removed
- [ ] Playwright routes set up for all API calls
- [ ] Test passes consistently (run 3 times)
- [ ] No hardcoded waits over 5 seconds
- [ ] Proper error scenarios handled
- [ ] Screenshots taken at key points

## Debug Helpers

```typescript
// Log all network requests
page.on('request', request => {
  console.log('→', request.method(), request.url());
});

// Log mock intercepts
await page.route('**/*', async (route, request) => {
  console.log('Intercepted:', request.url());
  await route.continue();
});

// Take screenshot on failure
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'passed') {
    await page.screenshot({ 
      path: `debug-${testInfo.title}.png`,
      fullPage: true 
    });
  }
});
```

## Questions?
- Check existing working tests: `01-file-upload.spec.ts` (first 3 tests)
- Ask in #e2e-test-updates Slack channel
- Refer to Playwright docs: https://playwright.dev/docs/network