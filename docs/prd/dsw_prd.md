# DataCloak Sentiment Workbench - Terminal Setup & Work Plan

## Project Overview
Build an offline-capable Electron desktop app that processes 20-50GB CSV/Excel files, automatically masks PII using DataCloak, and extracts sentiment insights via OpenAI.

## Terminal Organization

| Terminal | Role | Primary Owner | Key Deliverables |
|----------|------|---------------|------------------|
| **T0** | Project Setup & Coordination | [P] | Git repo, PRD, contracts, daily sync |
| **T1** | Frontend Development | [FE][UX] | React UI, Electron shell, component tests (70% coverage) |
| **T2** | Backend API | [BE] | Express API, DuckDB, job execution, API tests (85% coverage) |
| **T3** | Data Science & ML | [DS] | Field inference, cost estimation, accuracy tests (≥90%) |
| **T4** | Security & Privacy | [SEC] | DataCloak bridge, PII masking, security tests (100% coverage) |
| **T5** | DevOps & QA | [OPS][QA] | CI/CD, packaging, integration tests, coverage monitoring |

---

## Terminal 0: Project Setup & Coordination [P]

### Initial Setup Tasks
1. Create GitHub repository with branch strategy (main, develop)
2. Set up project structure:
   ```
   datacloak-sentiment-workbench/
   ├── docs/
   │   ├── prd/
   │   ├── tasks/
   │   ├── api-contracts/
   │   └── daily/
   ├── packages/
   │   ├── frontend/
   │   ├── backend/
   │   ├── datascience/
   │   └── security/
   ├── shared/
   │   ├── contracts/
   │   └── test-fixtures/
   └── .github/workflows/
   ```

3. Create and save PRD as `docs/prd/dsw_prd.md`
4. Create role-specific task files in `docs/tasks/` with checkbox format:
   ```markdown
   # Frontend Tasks [FE]
   
   ## Epic E-01: Foundation (Day 1-3)
   - [ ] FE-01: React + Electron scaffold
   - [ ] FE-01.1: IPC communication tests
   - [ ] FE-01.2: Component mounting tests
   ```
5. Define shared API contracts in `shared/contracts/api.ts`
6. Set up daily status board in `docs/STATUS.md`

### Early Spikes & Risk Mitigation (Days 1-6)
- **Day 2**: 50GB streaming test (T2) - Validates chunking strategy
- **Day 2**: Large file drag-drop (T1) - Use Electron main process, not renderer
- **Day 5**: DataCloak FFI Windows/macOS (T4) - Binary compatibility check
- **Day 6**: DuckDB 8GB RAM test (T2) - May need chunked DB files

### Daily Coordination
- Morning: Update `docs/STATUS.md` with blockers (use @T# mentions)
- Evening: Commit progress to `docs/daily/T#/YYYY-MM-DD.md` (terminal subfolders)
- Manage integration points between terminals
- Track epic completion against 30-day timeline (consider 34-40 days if spikes fail)

---

## Terminal 1: Frontend Development [FE][UX]

### Setup
- Clone repo → Create feature branch `feature/T1-frontend-foundation`
- **Critical**: Create TWO separate packages to avoid Electron confusion:
  ```
  packages/
  ├── web-ui/          # Pure React app (no Electron code)
  └── electron-shell/  # Electron wrapper only
  ```
- Web UI: Standard Vite + React (works in browser)
- Electron Shell: Minimal wrapper that loads web UI
- Set up Vitest with 70% coverage requirement
- **Test Strategy**: Test React in browser first, Electron integration last

### Architecture Principles
1. **Web-First Development**: Build everything to work in a browser
2. **Clear Separation**: No Electron imports in React components
3. **Bridge Pattern**: All Electron features through a single API object
4. **Progressive Enhancement**: App works without Electron features

### Electron Integration Points
```
web-ui/src/lib/platform-bridge.ts
- Abstract interface for platform features
- Browser implementation (stubs)
- Electron implementation (via preload)
```

### Epic Breakdown with Testing
**E-01: Foundation (Days 1-3)**
- FE-01: React + Electron scaffold
- Tests: IPC communication, component mounting

**E-03: Data UX (Days 7-9)**
- FE-02: DataSourcePicker (drag-drop, ≤50GB files)
- FE-03: Profiler UI (field list, PII badges)
- Tests: File validation, size limits, field selection

**E-04: Transform Engine (Days 10-14)**
- FE-04: TransformDesigner with preview
- Tests: Transform operations, undo/redo

**E-05: Sentiment Execution (Days 15-18)**
- FE-05: RunWizard with cost estimator
- Tests: Progress updates via SSE, cost calculations

**E-06: Results UX (Days 19-21)**
- FE-06: ResultExplorer with charts
- Tests: Sorting, filtering, export functions

### Large File Testing Strategy
- **Test Fixtures**: 
  - Synthetic CSV generators in code (`generateLargeCsv.ts`)
  - 1GB medium fixture via Git LFS (if allowed)
  - No 50GB files in repo
- **Performance Requirements**:
  - Memory ceiling: 2GB RAM (`--max-old-space-size=2048`)
  - Backend instrumentation with `hyperfine`
  - CI fails if performance degrades vs baseline
- **Drag-Drop Architecture**:
  - Use Electron main process IPC for file streaming
  - Disable `<input type=file>` to avoid Chromium temp duplication

---

## Terminal 2: Backend API [BE]

### Setup
- Clone repo → Create feature branch `feature/backend-api`
- Initialize Express + TypeScript in `packages/backend/`
- Set up Jest with 85% coverage requirement
- Configure DuckDB and SQLite

### Epic Breakdown with Testing
**E-01: Foundation (Days 1-3)**
- BE-01: Express API scaffold with routes
- Tests: Route responses, error middleware

**E-02: Profiling MVP (Days 4-6)**
- BE-02: Profile API with chunked reading (256MB)
- Tests: Large file handling, sampling accuracy

**E-04: Transform Engine (Days 10-14)**
- BE-03: DuckDB integration for joins
- Tests: SQL injection prevention, performance

**E-05: Sentiment Execution (Days 15-18)**
- BE-04: Job queue with rate limiting (3 req/s)
- SRV-01: `/api/run` endpoint with SSE
- Tests: Queue reliability, rate limit enforcement

**E-06: Results (Days 19-21)**
- BE-05: Results persistence in DuckDB
- Tests: Data integrity, export formats

### Testing Requirements
- API endpoint tests with Supertest
- Service layer unit tests
- Performance tests for 50GB files
- Coverage: ≥85% lines, 100% for data paths

---

## Terminal 3: Data Science & ML [DS]

### Setup
- Clone repo → Create feature branch `feature/field-inference`
- Initialize TypeScript package in `packages/datascience/`
- Set up test datasets and accuracy benchmarks

### Epic Breakdown with Testing
**E-02: Profiling MVP (Days 4-6)**
- INF-01: Heuristic field inference
- INF-02: GPT-assist for confidence <0.7
- Tests: Field detection accuracy ≥90% on test set

**E-05: Sentiment Execution (Days 15-18)**
- DS-01: Cost estimator for OpenAI calls
- Tests: Estimates within ±15% accuracy

### Testing Requirements
- Accuracy tests on diverse datasets
- Unit tests for all inference logic
- GPT fallback trigger tests
- Coverage: ≥90% lines

---

## Terminal 4: Security & Privacy [SEC]

### Setup
- Clone repo → Create feature branch `feature/security-datacloak`
- Initialize security package in `packages/security/`
- Set up DataCloak binary path
- Configure test PII datasets

### Epic Breakdown with Testing
**E-07: Security Hardening (Days 22-23)**
- SEC-01: DataCloak FFI integration
- SEC-02: OS keychain + AES-256 fallback
- SEC-03: Security audit implementation
- Tests: 100% PII removal verification

### Testing Requirements
- PII masking: 100% verified removal
- Adversarial corpus: 1M synthetic PII combinations
- Branch coverage ≥95%, mutation score ≥85%
- Performance tests with large text inputs
- Encryption/decryption validation
- Coverage: 100% lines (critical component)

---

## Terminal 5: DevOps & QA [OPS][QA]

### Setup
- Clone repo → Create feature branch `feature/devops-qa`
- Set up GitHub Actions workflows
- Configure electron-builder
- Create test orchestration scripts

### Continuous Tasks (Days 1-30)
- QA-00: Test infrastructure setup
- Monitor coverage across all packages
- Set up coverage reporting (Codecov)
- Create integration test suite

### Epic Breakdown
**E-08: Packaging (Days 24-26)**
- OPS-01: Build pipeline (DMG, NSIS, AppImage)
- OPS-02: CI/CD matrix builds with signing
  - macOS: electron-notarize
  - Windows: signtool
  - Store certs in GitHub encrypted secrets
- OPS-03: Auto-updater setup (electron-updater)
- Tests: Smoke tests on all platforms

**E-10: Final QA (Days 27-30)**
- QA-01: Full regression suite
- QA-02: Performance testing (50GB files)
- QA-03: Security scanning

### Testing Requirements
- Cross-platform E2E with Playwright (not Cypress - can't test Electron menus)
- Integration tests across packages
- Performance benchmarks with baseline tracking
- Code signing & notarization tests
- Auto-updater integration (electron-updater)
- Coverage monitoring & reporting

---

## Integration Points & Milestones

### Week 1 (Days 1-7)
- **Day 3**: API contracts finalized (T0)
- **Day 3**: Backend API scaffold ready (T2) → Frontend can start integration (T1)
- **Day 6**: Profile API complete (T2) → Field inference integration (T3)

### Week 2 (Days 8-14)
- **Day 9**: Field detection working E2E
- **Day 14**: Transform engine operational

### Week 3 (Days 15-21)
- **Day 18**: Sentiment execution pipeline complete
- **Day 21**: Results UI integrated

### Week 4 (Days 22-30)
- **Day 23**: Security hardening complete
- **Day 26**: First packaged builds
- **Day 30**: Release candidate

---

## Daily Workflow

### Morning Sync (All Terminals)
```bash
git checkout develop
git pull origin develop
cat docs/STATUS.md
grep "\[$(ROLE)\]" docs/tasks/$(ROLE)_TASKS.md
```

### During Development
- Write tests first (TDD approach)
- **Update task completion**: Mark tasks done in your task file:
  ```bash
  # In docs/tasks/FRONTEND_TASKS.md
  - [x] FE-01: React + Electron scaffold ✓ 2024-06-15
  ```
- Commit with format: `[ROLE] Epic-Ticket: Description`
- Run coverage checks before pushing
- Update overall progress percentage in STATUS.md

### End of Day
```bash
# Update your task file
sed -i 's/- \[ \] FE-01:/- \[x\] FE-01:/' docs/tasks/FRONTEND_TASKS.md

# Run tests and coverage
npm test
npm run test:coverage

# Update daily log
echo "- [T#] Completed: FE-01, In Progress: FE-02 (40%)" >> docs/daily/T#/$(date +%Y-%m-%d).md

# Commit task updates
git add docs/tasks/FRONTEND_TASKS.md
git commit -m "[FE] Complete FE-01: React scaffold with tests"

# Push changes
git push origin feature/T1-foundation
```

---

## Coverage Monitoring

### Package-Level Requirements
| Package | Line Coverage | Branch Coverage | Critical Files | Special Requirements |
|---------|--------------|-----------------|----------------|---------------------|
| Frontend | 70% | 60% | Components, hooks | Accessibility tests |
| Backend | 85% | 70% | Routes, services | Performance tests |
| DataScience | 90% | 80% | Inference logic | Mutation score ≥85% |
| Security | 100% | 95% | DataCloak bridge | Mutation score ≥85% |

### Global Metrics
- Overall project: ≥80% line coverage
- Patch coverage: ≥80% on every PR (Codecov)
- CI blocks PRs below any threshold
- Nightly mutation testing for Security & DS packages (Stryker)
- Coverage merge script for mono-repo: `npm run coverage:merge`

---

## Communication & Coordination

---

## Test & Coverage Governance

| Metric | Threshold | Enforcement |
|--------|-----------|-------------|
| Line coverage (per package) | FE 70% / BE 85% / DS 90% / SEC 100% | CI check-coverage |
| Branch coverage (per package) | FE 60% / BE 70% / DS 80% / SEC 95% | CI --branches flag |
| Mutation score | SEC & DS ≥85% | Stryker nightly job |
| Patch coverage | ≥80% lines on every PR | Codecov YAML rule |
| Global line coverage | ≥80% | scripts/coverage-check.js |

---

## Compliance & Legal Notes

1. **DataCloak Binary**: Confirm vendor license allows Electron bundling
2. **Dependencies**: Document MIT/Unlicense in NOTICE file (DuckDB, SQLite)
3. **OpenAI Access**: If air-gapped, plan for on-prem LLM alternative
4. **Code Signing**: Required certificates for distribution

---

## Electron Architecture Guidelines

### 1. Separation of Concerns
```
packages/
├── web-ui/              # Pure web app (no Electron)
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── lib/
│   │   │   └── platform-bridge.ts  # Abstract interface
│   │   └── app.tsx
│   └── package.json     # NO electron dependencies
│
├── electron-shell/      # Electron wrapper
│   ├── src/
│   │   ├── main.ts      # Main process
│   │   ├── preload.ts   # Preload script
│   │   └── ipc-handlers.ts
│   └── package.json     # Electron dependencies here
│
└── backend/             # API server (runs separately)
```

### 2. Development Workflow
1. **Start with browser**: Develop in web-ui with `npm run dev`
2. **Use mock APIs**: Mock all platform features
3. **Test in browser**: Ensure everything works without Electron
4. **Add Electron last**: Only after web UI is stable

### 3. Platform Bridge Pattern
```typescript
// web-ui/src/lib/platform-bridge.ts
interface PlatformBridge {
  selectFiles(): Promise<File[]>;
  readLargeFile(path: string): AsyncIterator<Uint8Array>;
  showSaveDialog(): Promise<string | null>;
}

// Browser implementation (mocks)
// Electron implementation (via window.electronAPI)
```

### 4. Common Electron Pitfalls to Avoid
- ❌ Don't import Electron in React components
- ❌ Don't use Node APIs in renderer
- ❌ Don't handle files in renderer process
- ❌ Don't put business logic in main process
- ✅ Do use IPC for all platform features
- ✅ Do stream large files through main process
- ✅ Do keep main process thin
- ✅ Do test without Electron first

### 5. Testing Strategy
1. **Unit tests**: Run in Node (no Electron)
2. **Component tests**: Run in jsdom (no Electron)
3. **Integration tests**: Run in real browser
4. **E2E tests**: Only then test with Electron

### 6. Build & Package Strategy
- Development: Run web UI and backend separately
- Production: Electron starts backend as child process
- Use electron-builder's two-package.json structure
- Keep node_modules separate to avoid conflicts

### PR Strategy
- Feature branches with terminal prefix: `feature/T1-<feature>`, `feature/T2-<feature>`
- Require passing tests + coverage (including patch coverage ≥80%)
- Protected `main` branch (reviews required)
- Auto-delete merged branches on `develop`
- Integration branches for cross-terminal features

### Task Tracking Script (Optional)
Create `scripts/task-status.js` to generate reports:
```bash
# Show all tasks across terminals
node scripts/task-status.js --all

# Show specific terminal progress
node scripts/task-status.js --terminal T1

# Output:
# T1 Frontend: 14/28 tasks (50%)
# T2 Backend: 10/25 tasks (40%)
# ...
```

### Blockers & Dependencies
- Use `docs/STATUS.md` for visibility
- Tag dependent terminals in PR descriptions: "Blocked by T2-profile-api"
- Mark blocked tasks: `- [ ] FE-03: Profiler UI ⚠️ BLOCKED: waiting for T2 API`
- Mock services for independent progress