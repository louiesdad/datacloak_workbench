# Multi-Field Differential Analysis & Causal Insights - TDD Tasks

**Developer 6: Causal Analysis & Insights**  
**Focus**: Multi-field differential analysis with causal event detection and statistical impact assessment

## Overview

Building upon the existing multi-field analysis infrastructure, Developer 6 will implement advanced causal analysis features that detect and quantify the impact of business events on customer sentiment across multiple fields.

## Database Foundation

✅ **Migration 007 completed**: Tables `business_events` and `event_impacts` are ready for use.

## Task 6.1: Business Event Management Service

### 6.1.1: Event CRUD Operations (TDD)
- **RED**: Write failing tests for business event creation, retrieval, updates, and soft deletion
- **GREEN**: Implement `BusinessEventService` with basic CRUD operations
- **REFACTOR**: Add validation, error handling, and audit logging

### 6.1.2: Event Type Classification (TDD)
- **RED**: Write failing tests for automatic event type classification
- **GREEN**: Implement event categorization (price_change, outage, feature_launch, policy_change, etc.)
- **REFACTOR**: Add confidence scoring and manual override capabilities

### 6.1.3: Affected Customer Resolution (TDD)
- **RED**: Write failing tests for customer impact scope determination
- **GREEN**: Implement logic to resolve "affected_customers" JSON (specific IDs vs "all")
- **REFACTOR**: Add performance optimization for large customer sets

## Task 6.2: Causal Impact Analysis Engine

### 6.2.1: Before/After Sentiment Comparison (TDD)
- **RED**: Write failing tests for statistical significance testing
- **GREEN**: Implement t-test and Mann-Whitney U test for sentiment changes
- **REFACTOR**: Add multiple comparison correction (Bonferroni, FDR)

### 6.2.2: Multi-Field Impact Assessment (TDD)
- **RED**: Write failing tests for cross-field impact correlation
- **GREEN**: Implement analysis across multiple text fields (reviews, comments, feedback)
- **REFACTOR**: Add field-specific impact weighting and aggregation

### 6.2.3: Temporal Impact Windows (TDD)
- **RED**: Write failing tests for time-window impact analysis
- **GREEN**: Implement configurable pre/post event analysis windows
- **REFACTOR**: Add sliding window analysis and decay functions

## Task 6.3: Statistical Significance Engine

### 6.3.1: Effect Size Calculation (TDD)
- **RED**: Write failing tests for Cohen's d and other effect size measures
- **GREEN**: Implement effect size calculations with confidence intervals
- **REFACTOR**: Add interpretation guidelines and practical significance thresholds

### 6.3.2: Power Analysis (TDD)
- **RED**: Write failing tests for statistical power assessment
- **GREEN**: Implement sample size adequacy checks
- **REFACTOR**: Add recommendations for insufficient sample sizes

### 6.3.3: Confidence Interval Estimation (TDD)
- **RED**: Write failing tests for bootstrap confidence intervals
- **GREEN**: Implement bootstrap resampling for robust CI estimation
- **REFACTOR**: Add parametric alternatives and assumption checking

## Task 6.4: Differential Analysis API

### 6.4.1: Event Registration Endpoint (TDD)
- **RED**: Write failing tests for POST /api/events
- **GREEN**: Implement event creation with validation
- **REFACTOR**: Add batch import and CSV upload capabilities

### 6.4.2: Impact Analysis Endpoint (TDD)
- **RED**: Write failing tests for POST /api/events/{id}/analyze-impact
- **GREEN**: Implement causal impact analysis triggering
- **REFACTOR**: Add async processing with progress updates

### 6.4.3: Results Retrieval Endpoint (TDD)
- **RED**: Write failing tests for GET /api/events/{id}/impact-results
- **GREEN**: Implement results formatting with statistical summaries
- **REFACTOR**: Add visualization data and export formats

## Task 6.5: Multi-Field Correlation Analysis

### 6.5.1: Cross-Field Impact Detection (TDD)
- **RED**: Write failing tests for field-to-field impact correlation
- **GREEN**: Implement correlation analysis between different text fields
- **REFACTOR**: Add lag analysis and directional causality testing

### 6.5.2: Field Sensitivity Ranking (TDD)
- **RED**: Write failing tests for field sensitivity scoring
- **GREEN**: Implement ranking of fields by their sensitivity to events
- **REFACTOR**: Add temporal stability analysis of sensitivity rankings

### 6.5.3: Composite Impact Scoring (TDD)
- **RED**: Write failing tests for weighted multi-field impact scores
- **GREEN**: Implement composite scoring across all analyzed fields
- **REFACTOR**: Add customizable weighting schemes and validation

## Task 6.6: Integration with Existing Services

### 6.6.1: Sentiment Analysis Integration (TDD)
- **RED**: Write failing tests for sentiment service integration
- **GREEN**: Integrate with existing SentimentService for event period analysis
- **REFACTOR**: Add caching and performance optimization

### 6.6.2: Data Validation Integration (TDD)
- **RED**: Write failing tests for data quality checks during causal analysis
- **GREEN**: Integrate with DataValidationService for event data verification
- **REFACTOR**: Add specific validation rules for causal analysis requirements

### 6.6.3: Job Queue Integration (TDD)
- **RED**: Write failing tests for async causal analysis jobs
- **GREEN**: Integrate with JobQueueService for long-running impact analyses
- **REFACTOR**: Add progress tracking and result caching

## Expected Deliverables

1. **BusinessEventService**: Complete CRUD operations with validation
2. **CausalAnalysisService**: Statistical impact assessment engine
3. **DifferentialAnalysisService**: Multi-field correlation and ranking
4. **Event Management API**: RESTful endpoints for event and impact management
5. **Statistical Engine**: Robust significance testing with multiple methods
6. **Integration Layer**: Seamless integration with existing sentiment analysis pipeline

## Success Criteria

- **100% test coverage** for all new causal analysis functionality
- **Statistical accuracy** validated against known test scenarios
- **Performance benchmarks** meeting <5s response time for impact analysis
- **API documentation** with comprehensive examples
- **Integration tests** demonstrating end-to-end causal analysis workflow

## Test Data Available

- `test-datasets/causal_events_30k.csv`: 30k event impact records
- `test-datasets/comprehensive_ecommerce_10k.csv`: Multi-field sentiment data
- `test-datasets/trajectory_patterns_50k.csv`: Historical sentiment patterns

## Dependencies

- ✅ Migration 007: Causal analysis tables
- ✅ SentimentService: For sentiment score retrieval
- ✅ DataValidationService: For input validation
- ✅ JobQueueService: For async processing
- ✅ MetricsService: For performance monitoring

---

**Start with Task 6.1.1** - Follow strict TDD methodology with RED-GREEN-REFACTOR cycles.