# DevOps & QA Infrastructure

## Overview

The DataCloak Sentiment Workbench uses a comprehensive DevOps infrastructure with automated testing, coverage monitoring, cross-platform builds, and deployment pipelines.

## GitHub Actions Workflows

### Primary CI/CD Pipeline (`.github/workflows/ci.yml`)
- **Triggers**: Push/PR to main/develop branches
- **Matrix Builds**: Ubuntu, Windows, macOS with Node.js 18/20
- **Features**:
  - Automated testing across all packages
  - Coverage reporting to Codecov
  - Security auditing
  - Lint and type checking
  - Build artifact generation
  - Mutation testing (nightly)

### Electron Build Pipeline (`.github/workflows/build-electron.yml`)
- **Triggers**: Git tags (releases) and manual dispatch
- **Cross-Platform**: DMG (macOS), NSIS/Portable (Windows), AppImage/DEB/RPM (Linux)
- **Features**:
  - Code signing and notarization
  - Auto-updater support
  - Smoke testing
  - Release artifact upload

### Coverage Monitoring (`.github/workflows/coverage.yml`)
- **Real-time coverage tracking**
- **Patch coverage analysis**
- **PR comments with coverage reports**
- **Codecov integration**

### Dependency Management (`.github/workflows/dependency-update.yml`)
- **Weekly automated updates**
- **Security vulnerability fixes**
- **Automated PR creation**

## Scripts & Tools

### Test Orchestration (`scripts/test-orchestrator.js`)
```bash
# Run all tests
npm run test

# Run tests for specific packages
node scripts/test-orchestrator.js --packages web-ui,backend

# Run with detailed output
node scripts/test-orchestrator.js --verbose --bail
```

**Features**:
- Parallel/sequential test execution
- Timeout management
- Coverage threshold enforcement
- Detailed reporting

### Coverage Management (`scripts/coverage-merge.js`)
```bash
# Merge coverage from all packages
npm run coverage:merge

# Check coverage thresholds
npm run coverage:check
```

**Thresholds** (from PRD):
- Frontend: 70% lines, 60% branches
- Backend: 85% lines, 70% branches  
- DataScience: 90% lines, 80% branches
- Security: 100% lines, 95% branches

### Mutation Testing (`scripts/mutation-test.js`)
```bash
# Run mutation tests on security-critical packages
npm run test:mutation

# Test specific packages
node scripts/mutation-test.js --packages security --verbose
```

**Requirements**:
- Security package: ≥85% mutation score
- DataScience package: ≥85% mutation score

### Patch Coverage (`scripts/patch-coverage.js`)
```bash
# Check patch coverage on PRs
npm run coverage:patch-check
```

**Features**:
- Compares base vs patch coverage
- Enforces 80% minimum patch coverage
- Integrated with CI/CD pipeline

### Task Status Monitoring (`scripts/task-status.js`)
```bash
# Show all terminal progress
node scripts/task-status.js --all

# Show specific terminal
node scripts/task-status.js --terminal T1

# Generate markdown report
node scripts/task-status.js --format markdown
```

## Electron Builder Configuration

### Cross-Platform Support (`electron-builder.config.js`)
- **macOS**: DMG with code signing and notarization
- **Windows**: NSIS installer with code signing
- **Linux**: AppImage, DEB, and RPM packages

### Security Features
- Hardened runtime (macOS)
- Code signing verification
- Entitlements configuration
- Gatekeeper compliance

### Auto-Updater
- GitHub releases integration
- Delta updates support
- Background download
- User-controlled installation

## Coverage Configuration

### Codecov Integration (`.codecov.yml`)
- **Project coverage**: 80% minimum
- **Patch coverage**: 80% minimum  
- **Package-specific flags**
- **Ignore patterns** for test files and build artifacts

### Merged Coverage Reports
- **HTML reports**: `reports/coverage/html/`
- **JSON summaries**: `coverage/merged/`
- **LCOV format**: For CI integration
- **Cobertura XML**: For PR comments

## Build & Release Process

### Development Workflow
```bash
# Install dependencies
npm ci

# Run development servers
npm run dev

# Run tests
npm run test

# Build all packages
npm run build

# Run linting
npm run lint
```

### Release Workflow
```bash
# Prepare release
npm run release:prepare

# Build Electron app
npm run build:electron

# Build for specific platforms
npm run build:electron:mac
npm run build:electron:win  
npm run build:electron:linux
```

### Resource Preparation (`scripts/prepare-resources.js`)
- Icon generation (SVG → PNG/ICO/ICNS)
- Binary preparation (DataCloak)
- Asset optimization
- Metadata creation

## Quality Gates

### Pre-commit Hooks (Husky + lint-staged)
- ESLint and Prettier formatting
- Type checking
- Basic test validation

### PR Requirements
- All tests passing
- Coverage thresholds met
- Security audit clean
- No ESLint errors
- Successful build

### Release Requirements
- Full test suite passing
- Mutation tests ≥85% (Security/DS)
- Cross-platform builds successful
- Smoke tests passing
- Security scan clean

## Monitoring & Reporting

### Test Results
- **Location**: `test-results/`
- **Formats**: JSON, HTML, JUnit XML
- **Retention**: 30 days in CI

### Coverage Reports  
- **Location**: `reports/coverage/`
- **Real-time**: Codecov dashboard
- **Historical**: Git-tracked summaries

### Performance Metrics
- Build times per platform
- Test execution duration
- Bundle size analysis
- Memory usage profiling

## Environment Variables

### CI/CD Secrets
```
# Code Signing
APPLE_CERTIFICATE_P12=<base64-encoded-cert>
APPLE_CERTIFICATE_PASSWORD=<cert-password>
APPLE_ID=<apple-id-email>
APPLE_ID_PASSWORD=<app-specific-password>
APPLE_TEAM_ID=<team-id>

WIN_CERTIFICATE=<base64-encoded-cert>
WIN_CERTIFICATE_PASSWORD=<cert-password>

# GitHub
GITHUB_TOKEN=<auto-provided>

# Coverage
CODECOV_TOKEN=<codecov-token>
```

### Local Development
```bash
# Optional: DataCloak binary path
DATACLOAK_BINARY_PATH=/path/to/datacloak

# Test configuration
NODE_ENV=test
JEST_TIMEOUT=30000
```

## Troubleshooting

### Common Issues

**Build Failures**
- Check Node.js version (18+ required)
- Clear node_modules and reinstall
- Verify all packages built successfully

**Test Timeouts**
- Increase timeout in test configuration
- Check for memory leaks
- Verify database connections

**Coverage Issues**
- Ensure all packages generate coverage
- Check .nyc_output directories
- Verify LCOV file generation

**Code Signing**
- Verify certificates are valid
- Check keychain access (macOS)
- Ensure environment variables set

### Performance Optimization

**Build Speed**
- Use npm ci instead of npm install
- Enable build caching
- Parallel test execution
- Incremental builds

**Test Performance**
- Mock external dependencies
- Use test fixtures
- Parallel test runners
- Memory profiling

## Maintenance

### Weekly Tasks
- Review dependency updates
- Check security advisories  
- Monitor coverage trends
- Update documentation

### Monthly Tasks
- Certificate renewal check
- Performance baseline updates
- Tool version upgrades
- Archive old reports

### Quarterly Tasks
- Security audit
- Tool evaluation
- Process optimization
- Training updates

---

*This infrastructure supports the 30-day development timeline with automated quality gates and cross-platform delivery.*