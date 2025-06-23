# E2E Test Update Work Division Plan

## Overview
Total failing tests: 41
Target: Update all tests to use Playwright request interception instead of MSW

## Team Structure (Suggested 4-5 developers)

### Developer 1: Core Upload & File Processing
**Files to update:**
- `specs/01-file-upload.spec.ts` (remaining 7 tests)
- `specs/02-data-profiling.spec.ts` (all tests)

**Key tasks:**
- Complete file upload test fixes
- Implement data profiling mocks
- Handle file validation scenarios

**Estimated effort:** 2-3 days

### Developer 2: Sentiment Analysis & Results
**Files to update:**
- `specs/03-column-selection.spec.ts`
- `specs/04-sentiment-analysis.spec.ts`
- `specs/05-results-export.spec.ts`

**Key tasks:**
- Mock sentiment analysis endpoints
- Handle batch processing scenarios
- Export functionality mocking

**Estimated effort:** 3-4 days

### Developer 3: Security & Compliance
**Files to update:**
- `specs/06-security-features.spec.ts`
- `specs/07-pii-detection.spec.ts`
- `specs/enhanced-datacloak-e2e.spec.ts` (security sections)

**Key tasks:**
- Mock DataCloak security endpoints
- PII detection and masking flows
- Compliance framework tests

**Estimated effort:** 3-4 days

### Developer 4: Integration & Advanced Workflows
**Files to update:**
- `specs/integration-workflow-e2e.spec.ts`
- `specs/08-performance.spec.ts`
- `specs/09-cross-browser.spec.ts`

**Key tasks:**
- Complex multi-step workflows
- WebSocket mocking for real-time features
- Performance metric collection

**Estimated effort:** 4-5 days

### Developer 5: Bug Fixes & Utilities
**Files to update:**
- `specs/bug-verification.spec.ts`
- Test fixtures and helpers
- Common mock utilities

**Key tasks:**
- Fix remaining selector issues
- Create shared mock utilities
- Handle edge cases

**Estimated effort:** 2-3 days

## Implementation Guidelines

### 1. Common Mock Pattern
Each developer should follow this pattern:

```typescript
test.beforeEach(async ({ page }) => {
  // Use the setupCommonMocks helper
  await setupCommonMocks(page);
  
  // Add test-specific mocks
  await page.route('**/api/specific-endpoint', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ /* mock data */ })
    });
  });
});
```

### 2. Shared Resources

Create these shared utilities in `fixtures/test-fixtures.ts`:

```typescript
// Common mock responses
export const mockResponses = {
  fileUpload: { /* standard upload response */ },
  dataProfile: { /* standard profile response */ },
  sentimentBatch: { /* standard sentiment response */ },
  securityScan: { /* standard security response */ }
};

// Helper functions
export const setupFileUploadMock = async (page, customResponse = {}) => { };
export const setupSentimentMock = async (page, customResponse = {}) => { };
export const setupSecurityMock = async (page, customResponse = {}) => { };
```

### 3. Communication Strategy

1. **Daily Standup**: 15-min sync on blockers and progress
2. **Shared Slack Channel**: #e2e-test-updates
3. **PR Strategy**: One PR per spec file for easier review
4. **Documentation**: Update test-fixtures.ts with new patterns

### 4. Development Order

To minimize conflicts:

1. **Day 1**: Everyone updates their first spec file
2. **Day 2**: Review and merge shared utilities
3. **Day 3-4**: Complete remaining spec files
4. **Day 5**: Integration testing and fixes

## Success Criteria

Each developer's work is complete when:
- [ ] All tests in assigned files pass
- [ ] No MSW usage remains (only Playwright mocks)
- [ ] Shared mock patterns are used
- [ ] PR is reviewed and merged
- [ ] Documentation is updated

## Quick Start for Each Developer

### Step 1: Pull latest changes
```bash
git pull origin main
cd tests/e2e
npm install
```

### Step 2: Run your assigned tests
```bash
# Example for Developer 1
npx playwright test specs/01-file-upload.spec.ts --project=browser-chrome
```

### Step 3: Update test pattern
1. Remove MSW imports and fixtures
2. Add Playwright route mocking
3. Update selectors if needed
4. Verify tests pass

### Step 4: Create PR
```bash
git checkout -b fix/e2e-tests-[your-section]
git add .
git commit -m "fix(e2e): Update [section] tests to use Playwright mocking"
git push origin fix/e2e-tests-[your-section]
```

## Coordination Points

### Shared Dependencies
- `fixtures/test-fixtures.ts` - Coordinate changes
- `mocks/` directory - Can be deprecated after migration
- Common selectors - Document any changes

### Potential Conflicts
- Multiple devs updating fixtures → Use feature branches
- Mock data inconsistencies → Use shared mockResponses
- Selector changes → Communicate in Slack

## Timeline
- **Week 1**: Complete all test updates
- **Week 2**: Integration testing and bug fixes
- **Total effort**: ~15-20 developer days

## Notes
- Devs can swap sections based on expertise
- Pair programming encouraged for complex tests
- Focus on stability over speed
- Add retry logic for flaky tests