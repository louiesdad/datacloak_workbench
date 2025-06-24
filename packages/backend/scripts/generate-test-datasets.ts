#!/usr/bin/env npx ts-node

import * as fs from 'fs';
import * as path from 'path';
import { ComprehensiveDataGenerator } from '../src/utils/comprehensive-data-generator';
import { TriggerScenarioGenerator } from '../src/utils/trigger-scenario-generator';
import { TrajectoryPatternGenerator } from '../src/utils/trajectory-pattern-generator';
import { CausalEventGenerator } from '../src/utils/causal-event-generator';
import { HealthcareDataGenerator } from '../src/utils/healthcare-data-generator';
import { FieldChaosGenerator } from '../src/utils/field-chaos-generator';

interface DatasetConfig {
  generator: any;
  method: string;
  filename: string;
  description: string;
}

async function generateTestDatasets() {
  console.log('🚀 Starting test dataset generation...\n');
  
  // Create output directory
  const outputDir = path.join(__dirname, '../test-datasets');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Fixed seed for reproducible datasets
  const FIXED_SEED = 42;

  const datasets: DatasetConfig[] = [
    {
      generator: new ComprehensiveDataGenerator(FIXED_SEED),
      method: 'generateEcommerceStandardDataset',
      filename: 'comprehensive_ecommerce_10k.csv',
      description: 'Comprehensive e-commerce dataset with 10,000 records'
    },
    {
      generator: new TriggerScenarioGenerator(FIXED_SEED),
      method: 'generateTriggerScenarios',
      filename: 'trigger_scenarios_20k.csv',
      description: 'Trigger scenario dataset with 20,000 records'
    },
    {
      generator: new TrajectoryPatternGenerator(FIXED_SEED),
      method: 'generateHistoricalSentimentSeries',
      filename: 'trajectory_patterns_50k.csv',
      description: 'Historical sentiment trajectory patterns with 50,000 records'
    },
    {
      generator: new CausalEventGenerator(FIXED_SEED),
      method: 'generateEventImpactData',
      filename: 'causal_events_30k.csv',
      description: 'Causal event impact dataset with 30,000 records'
    },
    {
      generator: new HealthcareDataGenerator(FIXED_SEED),
      method: 'generateHealthcareDataset',
      filename: 'healthcare_hipaa_5k.csv',
      description: 'HIPAA-compliant healthcare dataset with 5,000 records'
    },
    {
      generator: new FieldChaosGenerator(FIXED_SEED),
      method: 'generateFieldChaosDataset',
      filename: 'field_chaos_2k.csv',
      description: 'Chaotic field structure dataset with 2,000 records'
    }
  ];

  let totalRecords = 0;
  const manifest: any[] = [];

  for (const config of datasets) {
    try {
      console.log(`📊 Generating ${config.filename}...`);
      const startTime = Date.now();
      
      // Generate dataset
      const dataset = config.generator[config.method]();
      
      // Convert to CSV
      const csvContent = convertDatasetToCSV(dataset);
      
      // Write to file
      const filePath = path.join(outputDir, config.filename);
      fs.writeFileSync(filePath, csvContent, 'utf8');
      
      const endTime = Date.now();
      const fileSizeKB = Math.round(fs.statSync(filePath).size / 1024);
      
      console.log(`   ✅ Generated ${dataset.metadata.recordCount} records in ${endTime - startTime}ms`);
      console.log(`   📁 File size: ${fileSizeKB} KB`);
      
      totalRecords += dataset.metadata.recordCount;
      
      // Add to manifest
      manifest.push({
        filename: config.filename,
        description: config.description,
        recordCount: dataset.metadata.recordCount,
        headers: dataset.headers,
        fileSizeKB,
        generationTimeMs: endTime - startTime,
        seed: FIXED_SEED,
        generatedAt: new Date().toISOString()
      });
      
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error generating ${config.filename}:`, error);
    }
  }

  // Generate manifest file
  const manifestPath = path.join(outputDir, 'dataset-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    totalDatasets: datasets.length,
    totalRecords,
    generatedAt: new Date().toISOString(),
    seed: FIXED_SEED,
    datasets: manifest
  }, null, 2));

  // Generate README
  const readmePath = path.join(outputDir, 'README.md');
  generateReadme(readmePath, manifest, totalRecords);

  console.log(`🎉 Successfully generated ${datasets.length} test datasets!`);
  console.log(`📊 Total records: ${totalRecords.toLocaleString()}`);
  console.log(`📁 Output directory: ${outputDir}`);
  console.log(`📋 Manifest: ${manifestPath}`);
}

function convertDatasetToCSV(dataset: any): string {
  const { headers, records } = dataset;
  
  // CSV header
  const csvLines = [headers.map(escapeCSVField).join(',')];
  
  // CSV rows
  for (const record of records) {
    const row = headers.map(header => {
      const value = record[header];
      return escapeCSVField(value);
    });
    csvLines.push(row.join(','));
  }
  
  return csvLines.join('\n');
}

function escapeCSVField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // If the value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

function generateReadme(filePath: string, manifest: any[], totalRecords: number): void {
  const content = `# Test Datasets for DataCloak Sentiment Workbench

This directory contains pre-generated test datasets for comprehensive testing of the DataCloak Sentiment Workbench multi-field analysis features.

## Overview

- **Total Datasets**: ${manifest.length}
- **Total Records**: ${totalRecords.toLocaleString()}
- **Generation Seed**: 42 (for reproducibility)
- **Generated**: ${new Date().toISOString()}

## Datasets

${manifest.map(dataset => `
### ${dataset.filename}

**Description**: ${dataset.description}
- **Records**: ${dataset.recordCount.toLocaleString()}
- **File Size**: ${dataset.fileSizeKB} KB
- **Fields**: ${dataset.headers.length}
- **Generation Time**: ${dataset.generationTimeMs}ms

**Headers**: \`${dataset.headers.slice(0, 6).join('`, `')}\`${dataset.headers.length > 6 ? ', ...' : ''}
`).join('\n')}

## Usage

These datasets are designed for:

1. **Unit Testing** - Validate individual components with known data patterns
2. **Integration Testing** - Test multi-field analysis workflows end-to-end
3. **Performance Testing** - Benchmark processing capabilities with realistic data volumes
4. **Edge Case Testing** - Ensure robust handling of problematic field structures and content

## Dataset Types

### 1. Comprehensive E-commerce (comprehensive_ecommerce_10k.csv)
Standard e-commerce data with customer feedback, product reviews, and temporal consistency.

### 2. Trigger Scenarios (trigger_scenarios_20k.csv)
Specialized dataset for testing sentiment decline detection and high-value customer at-risk triggers.

### 3. Trajectory Patterns (trajectory_patterns_50k.csv)
Historical sentiment series with various pattern types (linear decline, seasonal, volatile stable, recovery, cliff drop).

### 4. Causal Events (causal_events_30k.csv)
Event impact data for testing causal analysis features (price changes, outages, feature launches).

### 5. Healthcare HIPAA (healthcare_hipaa_5k.csv)
Healthcare-specific dataset with medical terminology and HIPAA compliance considerations.

### 6. Field Chaos (field_chaos_2k.csv)
Extreme edge case dataset with problematic field names, inconsistent structures, and challenging content types.

## Reproducibility

All datasets are generated with a fixed seed (42) to ensure reproducible results across test runs and environments.

## File Format

All datasets are provided in CSV format with proper escaping for:
- Commas in field values
- Quotes in field values  
- Newlines in field values
- Special characters and unicode content

## Integration

These datasets integrate seamlessly with the existing DataCloak test infrastructure and can be used directly with the multi-field analysis API endpoints.
`;

  fs.writeFileSync(filePath, content);
}

// Run the script
if (require.main === module) {
  generateTestDatasets().catch(console.error);
}

export { generateTestDatasets };