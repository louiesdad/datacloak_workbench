# DataCloak Sentiment Workbench

A comprehensive offline-capable desktop application for processing large CSV/Excel files (up to 50GB) with automated PII masking, field inference, and sentiment analysis capabilities. Built with modern TypeScript, React, and advanced data science techniques.

## Project Structure

```
datacloak-sentiment-workbench/
├── docs/                   # Documentation
│   ├── prd/               # Product Requirements
│   ├── tasks/             # Task tracking
│   ├── api-contracts/     # API specifications
│   └── daily/             # Daily standups/updates
├── packages/              # Main code packages
│   ├── web-ui/           # React frontend (Vite + TypeScript)
│   ├── electron-shell/   # Electron desktop wrapper
│   ├── backend/          # Express API server (SQLite + DuckDB)
│   ├── datascience/      # 🧠 ML & Data Science Engine
│   └── security/         # DataCloak PII masking & security
├── shared/               # Shared resources
│   ├── contracts/        # Shared TypeScript interfaces/types
│   └── test-fixtures/    # Test data and fixtures
└── .github/workflows/    # GitHub Actions workflows
```

## 🔥 Key Features

### 🧠 Advanced Data Science Engine (`packages/datascience`)
- **Field Inference**: Automatically detects 13+ data types (email, URL, phone, date, JSON, etc.)
- **GPT-Powered Enhancement**: Low-confidence predictions enhanced with AI assistance
- **Pattern Recognition**: Advanced regex patterns for UUIDs, IP addresses, credit cards
- **Cost Estimation**: Accurate token counting and pricing for OpenAI/Anthropic models
- **Synthetic Data Generation**: Create realistic test datasets for users, sales, logs
- **Comprehensive Benchmarking**: Performance profiling, accuracy evaluation, memory leak detection
- **88%+ Test Coverage**: Production-ready with extensive test suites

### 🔒 Enterprise Security & Privacy (`packages/security`)
- **DataCloak Integration**: Native FFI bridge + high-fidelity mock for PII detection/masking
- **Offline Processing**: Complete privacy - no data ever leaves your machine
- **OS Keychain Integration**: macOS Security framework + Windows Credential Manager
- **AES-256-CBC Encryption**: Industry-standard encryption with secure key rotation
- **Real-Time Monitoring**: 110k+ adversarial test corpus with compliance scoring
- **Security Auditing**: Comprehensive audit trails with configurable alert rules
- **Mutation Testing**: ≥85% mutation score for security-critical code paths
- **Cross-Platform Security**: Unified security API across Windows, macOS, Linux

### 🚀 High-Performance Processing
- **Large File Support**: Handle CSV/Excel files up to 50GB
- **Dual Database**: SQLite for transactions + DuckDB for analytics
- **Streaming Processing**: Memory-efficient chunked file processing
- **Cross-Platform**: Windows, macOS, Linux builds with code signing

## Getting Started

### Prerequisites

- **Node.js** (v18+)
- **npm** (v8+)
- **10GB+ RAM** (recommended for large file processing)

### Quick Start

1. **Clone and Install**:
   ```bash
   git clone <repository-url>
   cd datacloak-sentiment-workbench
   npm install  # Installs all workspace dependencies
   ```

2. **Build All Packages**:
   ```bash
   npm run build  # Builds all packages in dependency order
   ```

3. **Development Mode**:
   ```bash
   # Terminal 1: Start backend API
   npm run dev:backend
   
   # Terminal 2: Start web UI
   npm run dev:web-ui
   
   # Terminal 3: Start Electron (optional)
   npm run dev:electron
   ```

4. **Production Build**:
   ```bash
   npm run build:electron  # Creates distributable desktop app
   ```

## 🧠 Data Science Package Deep Dive

The `packages/datascience` directory contains our advanced ML and data processing engine:

### Architecture Overview

```
packages/datascience/
├── src/
│   ├── field-inference/     # 🔍 Type detection & pattern analysis
│   │   ├── engine.ts        # Main inference orchestrator
│   │   ├── type-detector.ts # Core type detection logic
│   │   ├── pattern-analyzer.ts # Regex pattern matching
│   │   ├── gpt-assist.ts    # AI-powered enhancement
│   │   └── statistics-calculator.ts # Field statistics
│   ├── cost-estimator/      # 💰 LLM cost prediction
│   │   ├── estimator.ts     # Cost calculation engine
│   │   ├── token-counter.ts # Token estimation algorithms
│   │   └── pricing-service.ts # Model pricing database
│   ├── generators/          # 🎲 Synthetic data creation
│   │   ├── data-generator.ts # High-level dataset generator
│   │   ├── field-generator.ts # Field-specific generators
│   │   └── synthetic-dataset.ts # Schema-based generation
│   ├── benchmarks/          # 📊 Performance & accuracy testing
│   │   ├── accuracy-evaluator.ts # ML metrics calculation
│   │   ├── performance-profiler.ts # Speed & memory profiling
│   │   ├── reporter.ts      # Comprehensive reporting
│   │   └── runner.ts        # Benchmark orchestration
│   └── types/               # 📝 TypeScript definitions
└── __tests__/               # 🧪 132 tests with 88%+ coverage
```

### Field Inference Engine

**Supported Data Types** (13+ types detected):
- `string` - Generic text data
- `number` - Integers and decimals  
- `boolean` - True/false values
- `date` - Date/datetime in multiple formats
- `email` - Email addresses with validation
- `url` - Web URLs and endpoints
- `phone` - Phone numbers (international formats)
- `json` - JSON strings and objects
- `array` - Array values
- `object` - Object structures
- `null`/`undefined` - Missing values
- `mixed` - Mixed type fields

**Advanced Features**:
```typescript
import { FieldInferenceEngine } from '@datacloak/datascience';

const engine = new FieldInferenceEngine();

// Infer single field
const result = await engine.inferField('email_column', [
  'user@example.com', 'admin@test.org', 'invalid-email'
]);

// Result includes:
// - inferredType: 'email'
// - confidence: 0.67 (67% are valid emails)
// - statistics: { nullCount, uniqueCount, patterns, etc. }

// Infer entire dataset
const dataset = { 
  fields: { 
    emails: ['user@test.com'], 
    ages: [25, 30, 35] 
  } 
};
const results = await engine.inferDataset(dataset);
```

### Cost Estimation Engine

Accurate cost prediction for LLM operations:

```typescript
import { CostEstimator } from '@datacloak/datascience';

// Estimate dataset processing cost
const estimate = CostEstimator.estimateDatasetProcessing(dataset, {
  modelName: 'gpt-4',
  expectedResponseLength: 500,
  batchSize: 10
});

// Returns:
// - estimatedCost: $0.0245
// - estimatedTokens: 1250
// - confidence: 0.85
// - breakdown: { inputTokens, outputTokens, etc. }
```

**Supported Models**:
- **OpenAI**: GPT-4, GPT-4-Turbo, GPT-3.5-Turbo
- **Anthropic**: Claude-3-Opus, Claude-3-Sonnet, Claude-3-Haiku

### Synthetic Data Generation

Create realistic test datasets for development and testing:

```typescript
import { DataGenerator } from '@datacloak/datascience';

// Generate predefined datasets
const users = DataGenerator.generate({
  type: 'users',
  recordCount: 1000
});

const sales = DataGenerator.generate({
  type: 'sales', 
  recordCount: 500
});

// Custom schema generation
const custom = DataGenerator.generate({
  type: 'custom',
  recordCount: 100,
  schema: {
    id: { type: 'number', options: { minValue: 1, maxValue: 1000 } },
    name: { type: 'string', options: { minLength: 3, maxLength: 20 } },
    email: { type: 'email', options: { nullRate: 0.1 } }
  }
});
```

### Benchmarking & Performance

Comprehensive testing and profiling tools:

```typescript
import { BenchmarkRunner } from '@datacloak/datascience';

const runner = new BenchmarkRunner();

// Quick benchmark
const report = await runner.runQuickBenchmark();

// Comprehensive benchmark with accuracy and performance
const fullReport = await runner.runComprehensiveBenchmark();

// Custom benchmarks
const customReport = await runner.runBenchmark({
  name: 'Custom Test',
  testCases: [...],
  performanceTests: [...],
  accuracyThreshold: 0.9
});
```

## 📊 Testing & Quality

### Test Coverage Summary
- **Overall Coverage**: **88.01%** statement coverage
- **Field Inference**: **90.84%** coverage
- **Cost Estimator**: **96.33%** coverage  
- **Generators**: **98.8%** coverage
- **Benchmarks**: **83.53%** coverage

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test -- --coverage

# Run data science tests specifically
npm run test --workspace=packages/datascience

# Run benchmarks
npm run benchmark
npm run benchmark comprehensive
```

## 🚀 Development Workflow

### Package Scripts

```bash
# Development
npm run dev              # Start backend + frontend
npm run dev:web-ui       # Frontend only  
npm run dev:backend      # Backend only
npm run dev:electron     # Electron shell

# Building
npm run build           # Build all packages
npm run build:web-ui    # Frontend build
npm run build:backend   # Backend build  
npm run build:datascience # Data science build
npm run build:electron  # Electron distributables

# Testing
npm run test           # All tests
npm run test:unit      # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e       # End-to-end tests
npm run test:mutation  # Mutation testing

# Quality & Deployment
npm run lint           # ESLint all packages
npm run typecheck      # TypeScript validation
npm run coverage:merge # Merge coverage reports
npm run security:check # Security audit
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
