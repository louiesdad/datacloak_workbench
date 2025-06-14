# DataCloak Data Science Package

A comprehensive TypeScript package for field inference, cost estimation, and benchmarking in data science workflows.

## Features

### 🔍 Field Inference
- **Type Detection**: Automatically detect field types (string, number, email, URL, phone, date, JSON, etc.)
- **Pattern Analysis**: Identify common patterns like UUIDs, IP addresses, credit cards
- **Statistical Analysis**: Calculate comprehensive statistics for each field
- **Confidence Scoring**: Get confidence levels for all inferences

### 💰 Cost Estimation
- **Token Counting**: Estimate tokens for various content types
- **Model Pricing**: Support for multiple LLM providers (OpenAI, Anthropic, etc.)
- **Batch Processing**: Calculate costs for large-scale operations
- **Cost Comparison**: Compare costs across different models

### 📊 Data Generation
- **Synthetic Datasets**: Generate realistic test data for various domains
- **Custom Schemas**: Define your own field types and constraints
- **Quality Variations**: Create datasets with different quality levels
- **Multiple Formats**: Support for users, sales, logs, and mixed-type datasets

### 🏆 Benchmarking
- **Accuracy Evaluation**: Measure inference accuracy with precision, recall, F1-score
- **Performance Profiling**: Track execution time, memory usage, throughput
- **Memory Leak Detection**: Identify potential memory issues
- **Comprehensive Reporting**: Generate detailed benchmark reports

## Installation

```bash
npm install @datacloak/datascience
```

## Quick Start

```typescript
import {
  FieldInferenceEngine,
  CostEstimator,
  DataGenerator,
  BenchmarkRunner
} from '@datacloak/datascience';

// Field Inference
const engine = new FieldInferenceEngine();
const values = ['user@example.com', 'admin@test.org', 'john.doe@company.com'];
const result = await engine.inferField('email_field', values);
console.log(result.inferredType); // 'email'
console.log(result.confidence); // 0.95

// Cost Estimation
const estimate = CostEstimator.estimateFieldInference('test_field', values, {
  modelName: 'gpt-4',
  expectedResponseLength: 200
});
console.log(`Estimated cost: $${estimate.estimatedCost.toFixed(4)}`);

// Data Generation
const dataset = DataGenerator.generate({
  type: 'users',
  recordCount: 1000
});
console.log(`Generated ${dataset.fields.email.length} user records`);

// Benchmarking
const runner = new BenchmarkRunner();
const report = await runner.runQuickBenchmark();
console.log(`Benchmark completed with ${report.summary.passedTests}/${report.summary.totalTests} tests passed`);
```

## API Reference

### Field Inference

#### FieldInferenceEngine

```typescript
const engine = new FieldInferenceEngine();

// Infer a single field
const result = await engine.inferField('fieldName', values);

// Infer entire dataset
const results = await engine.inferDataset(dataset);

// Infer from sample data
const results = await engine.inferFromSample(sampleData);
```

#### TypeDetector

```typescript
// Detect single value type
const type = TypeDetector.detectType('user@example.com'); // 'email'

// Detect field type with confidence
const { type, confidence } = TypeDetector.detectFieldType(values);
```

### Cost Estimation

#### CostEstimator

```typescript
// Estimate dataset processing cost
const estimate = CostEstimator.estimateDatasetProcessing(dataset, {
  modelName: 'claude-3-sonnet',
  expectedResponseLength: 500,
  batchSize: 10
});

// Estimate field inference cost
const estimate = CostEstimator.estimateFieldInference(fieldName, values, {
  modelName: 'gpt-3.5-turbo'
});

// Estimate batch processing cost
const estimate = CostEstimator.estimateBatchProcessing(items, processor, {
  modelName: 'gpt-4',
  batchSize: 5
});
```

#### TokenCounter

```typescript
// Estimate tokens for text
const tokens = TokenCounter.estimateTokens('Hello world');

// Estimate tokens for JSON
const tokens = TokenCounter.estimateTokensForJson(object);

// Estimate prompt tokens
const tokens = TokenCounter.estimatePromptTokens(systemPrompt, userPrompt, context);
```

### Data Generation

#### DataGenerator

```typescript
// Generate predefined dataset types
const usersDataset = DataGenerator.generate({
  type: 'users',
  recordCount: 500
});

const salesDataset = DataGenerator.generate({
  type: 'sales', 
  recordCount: 300
});

// Generate custom dataset
const customDataset = DataGenerator.generate({
  type: 'custom',
  recordCount: 100,
  schema: {
    id: { type: 'number', options: { minValue: 1, maxValue: 1000 } },
    name: { type: 'string', options: { minLength: 3, maxLength: 20 } },
    email: { type: 'email', options: { nullRate: 0.1 } }
  }
});
```

#### SyntheticDataset

```typescript
// Generate with custom schema
const dataset = SyntheticDataset.generate({
  recordCount: 1000,
  schema: {
    userId: { type: 'number' },
    email: { type: 'email' },
    profile: { type: 'json' }
  },
  name: 'my-dataset'
});

// Generate predefined datasets
const users = SyntheticDataset.generateUserDataset(500);
const sales = SyntheticDataset.generateSalesDataset(300);
const logs = SyntheticDataset.generateLogDataset(1000);
```

### Benchmarking

#### BenchmarkRunner

```typescript
const runner = new BenchmarkRunner();

// Quick benchmark
const report = await runner.runQuickBenchmark();

// Comprehensive benchmark
const report = await runner.runComprehensiveBenchmark();

// Custom benchmark
const report = await runner.runBenchmark({
  name: 'My Benchmark',
  testCases: [...],
  performanceTests: [...],
  accuracyThreshold: 0.85,
  iterations: 5,
  enableMemoryProfiling: true
});
```

#### AccuracyEvaluator

```typescript
// Evaluate accuracy
const metrics = AccuracyEvaluator.evaluate(predictions, groundTruth);
console.log(`Accuracy: ${metrics.accuracy}`);
console.log(`F1 Score: ${metrics.f1Score}`);

// Compare confidence levels
const confidenceAnalysis = AccuracyEvaluator.compareConfidence(predictions, groundTruth);
```

#### PerformanceProfiler

```typescript
// Profile operation
const result = await PerformanceProfiler.profile(operation, operationCount);

// Run benchmark
const profile = await PerformanceProfiler.benchmark('test-name', operation, {
  iterations: 10,
  warmupIterations: 3
});

// Profile memory usage
const memoryProfile = await PerformanceProfiler.profileMemoryLeak(operation, 100);
```

## Scripts

```bash
# Build the package
npm run build

# Run tests
npm run test
npm run test:watch
npm run test:coverage

# Run benchmarks
npm run benchmark          # Quick benchmark
npm run benchmark comprehensive  # Full benchmark suite

# Linting and type checking
npm run lint
npm run typecheck
```

## Supported Field Types

- `string` - Generic text
- `number` - Numeric values (integer or decimal)
- `boolean` - True/false values
- `date` - Date and datetime values
- `email` - Email addresses
- `url` - Web URLs
- `phone` - Phone numbers
- `json` - JSON strings
- `array` - Array values
- `object` - Object values
- `null` - Null values
- `undefined` - Undefined values
- `mixed` - Mixed types

## Supported Models

Cost estimation supports the following models:

**OpenAI:**
- gpt-4
- gpt-4-turbo
- gpt-3.5-turbo

**Anthropic:**
- claude-3-opus
- claude-3-sonnet
- claude-3-haiku

## Examples

### Complex Field Inference

```typescript
const engine = new FieldInferenceEngine();

const complexData = [
  { user_id: 1, email: 'john@example.com', last_login: '2024-01-15T10:30:00Z' },
  { user_id: 2, email: 'jane@test.org', last_login: '2024-01-14T15:45:00Z' },
  { user_id: 3, email: null, last_login: null }
];

const results = await engine.inferFromSample(complexData);

results.forEach(result => {
  console.log(`${result.fieldName}: ${result.inferredType} (${(result.confidence * 100).toFixed(1)}%)`);
  console.log(`  Null rate: ${(result.statistics.nullCount / result.statistics.totalCount * 100).toFixed(1)}%`);
  console.log(`  Unique values: ${result.statistics.uniqueCount}`);
});
```

### Cost Comparison Across Models

```typescript
const dataset = DataGenerator.generate({ type: 'users', recordCount: 1000 });
const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet'];

const estimates = models.map(model => ({
  model,
  estimate: CostEstimator.estimateDatasetProcessing(dataset, { modelName: model })
}));

estimates.sort((a, b) => a.estimate.estimatedCost - b.estimate.estimatedCost);

console.log('Cost comparison (cheapest to most expensive):');
estimates.forEach(({ model, estimate }) => {
  console.log(`${model}: $${estimate.estimatedCost.toFixed(4)} (${estimate.estimatedTokens} tokens)`);
});
```

### Custom Benchmark

```typescript
const runner = new BenchmarkRunner();

const customBenchmark = await runner.runBenchmark({
  name: 'E-commerce Data Benchmark',
  testCases: [
    {
      name: 'Product Catalog',
      datasetType: 'custom',
      recordCount: 200,
      expectedTypes: {
        product_id: 'string',
        name: 'string',
        price: 'number',
        category: 'string',
        in_stock: 'boolean'
      }
    }
  ],
  performanceTests: [
    {
      name: 'Product Inference Speed',
      operation: 'dataset-inference',
      dataSize: 200,
      iterations: 5
    }
  ],
  accuracyThreshold: 0.9,
  iterations: 3,
  enableMemoryProfiling: true,
  outputPath: './benchmark-results.json'
});

console.log(`Benchmark completed: ${(benchmark.summary.averageAccuracy * 100).toFixed(1)}% accuracy`);
```

## Contributing

1. Clone the repository
2. Install dependencies: `npm install`
3. Make your changes
4. Run tests: `npm test`
5. Run linting: `npm run lint`
6. Build: `npm run build`

## License

ISC