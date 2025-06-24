# Test Datasets for DataCloak Sentiment Workbench

This directory contains pre-generated test datasets for comprehensive testing of the DataCloak Sentiment Workbench multi-field analysis features.

## Overview

- **Total Datasets**: 6
- **Total Records**: 117,000
- **Generation Seed**: 42 (for reproducibility)
- **Generated**: 2025-06-23T19:33:41.695Z

## Datasets


### comprehensive_ecommerce_10k.csv

**Description**: Comprehensive e-commerce dataset with 10,000 records
- **Records**: 10,000
- **File Size**: 1383 KB
- **Fields**: 9
- **Generation Time**: 50ms

**Headers**: `customer_id`, `email`, `phone`, `order_date`, `product_review`, `customer_comment`, ...


### trigger_scenarios_20k.csv

**Description**: Trigger scenario dataset with 20,000 records
- **Records**: 20,000
- **File Size**: 1310 KB
- **Fields**: 8
- **Generation Time**: 60ms

**Headers**: `customer_id`, `week_number`, `sentiment_score`, `order_value`, `order_frequency`, `support_tickets`, ...


### trajectory_patterns_50k.csv

**Description**: Historical sentiment trajectory patterns with 50,000 records
- **Records**: 50,000
- **File Size**: 3764 KB
- **Fields**: 8
- **Generation Time**: 136ms

**Headers**: `customer_id`, `week_number`, `sentiment_score`, `confidence`, `data_points`, `major_events`, ...


### causal_events_30k.csv

**Description**: Causal event impact dataset with 30,000 records
- **Records**: 30,000
- **File Size**: 3401 KB
- **Fields**: 9
- **Generation Time**: 124ms

**Headers**: `event_id`, `customer_id`, `event_type`, `event_date`, `affected`, `pre_sentiment`, ...


### healthcare_hipaa_5k.csv

**Description**: HIPAA-compliant healthcare dataset with 5,000 records
- **Records**: 5,000
- **File Size**: 1186 KB
- **Fields**: 13
- **Generation Time**: 36ms

**Headers**: `patient_id`, `medical_record_number`, `diagnosis_code`, `department`, `visit_type`, `patient_feedback`, ...


### field_chaos_2k.csv

**Description**: Chaotic field structure dataset with 2,000 records
- **Records**: 2,000
- **File Size**: 12860 KB
- **Fields**: 65
- **Generation Time**: 127ms

**Headers**: `feedback`, `home_address`, `CSV_Export`, `API_Response`, `Phone Number`, `customerId`, ...


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
