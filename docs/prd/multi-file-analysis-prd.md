# Product Requirements Document: Multi-File Relationship Analysis & Sentiment Discovery for DataCloak

## Executive Summary

Building upon DataCloak's existing multi-field sentiment analysis capabilities, this PRD introduces a multi-file staging and relationship discovery system. Users can upload multiple CSV files (e.g., users.csv, klaviyo.csv, orders.csv), and DataCloak will automatically analyze relationships between files, recommend optimal joins, and surface behavioral patterns that impact sentiment analysis outcomes.

## Problem Statement

Current DataCloak implementation analyzes files in isolation, missing critical insights that emerge from relationships between datasets:
- Users must manually identify which files contain related data
- Cross-file patterns (e.g., marketing engagement preceding customer churn) remain hidden
- No automated discovery of foreign key relationships
- Sentiment analysis lacks context from related behavioral data

## Solution Overview

### Core Innovation: Relationship-Aware Sentiment Analysis

1. **Multi-File Staging**: Upload and profile multiple CSV files in a single analysis session
2. **Automatic Relationship Discovery**: Detect foreign keys, shared identifiers, and temporal relationships
3. **Pattern Mining**: Surface cross-file behavioral patterns that correlate with sentiment changes
4. **Optimal Join Recommendations**: Suggest data combinations that enhance sentiment analysis accuracy
5. **Contextual Insights**: Generate insights like "Klaviyo open rates drop 3 days before negative reviews"

### High-Level Architecture

```
[Multiple CSVs] → [Relationship Discoverer] → [Pattern Analyzer] → [Join Optimizer] → [Insight Generator]
        ↓                    ↓                        ↓                    ↓                    ↓
  [File Registry]   [Schema Matcher]         [Correlation Engine]  [Virtual Views]    [Narrative Engine]
```

## Detailed Design

### 1. Multi-File Staging System

**File Registry & Metadata:**
```rust
pub struct FileRegistry {
    session_id: Uuid,
    files: HashMap<String, FileMetadata>,
    discovered_relationships: Vec<FileRelationship>,
}

pub struct FileMetadata {
    file_id: Uuid,
    filename: String,
    columns: Vec<ColumnProfile>, // From existing ML profiler
    row_count: usize,
    timestamp_columns: Vec<String>,
    potential_keys: Vec<PotentialKey>,
    data_fingerprint: DataFingerprint,
}

pub struct PotentialKey {
    column_name: String,
    uniqueness_ratio: f32,
    data_type: DataType,
    sample_values: Vec<String>,
    bloom_filter: BloomFilter, // For efficient matching
}

impl FileRegistry {
    pub async fn stage_file(&mut self, file_path: &Path) -> Result<FileMetadata> {
        // Leverage existing column profiler
        let column_profiles = self.profile_columns(file_path).await?;
        
        // Identify potential keys and timestamps
        let potential_keys = self.identify_keys(&column_profiles);
        let timestamp_columns = self.identify_timestamps(&column_profiles);
        
        // Create data fingerprint for similarity matching
        let fingerprint = self.create_fingerprint(file_path).await?;
        
        let metadata = FileMetadata {
            file_id: Uuid::new_v4(),
            filename: file_path.file_name().unwrap().to_string(),
            columns: column_profiles,
            row_count: self.count_rows(file_path).await?,
            timestamp_columns,
            potential_keys,
            data_fingerprint: fingerprint,
        };
        
        self.files.insert(metadata.filename.clone(), metadata.clone());
        Ok(metadata)
    }
}
```

### 2. Relationship Discovery Engine

**Automatic Relationship Detection:**
```rust
pub struct RelationshipDiscoverer {
    similarity_threshold: f32,
    sample_size: usize,
}

pub enum RelationshipType {
    OneToOne { confidence: f32 },
    OneToMany { confidence: f32 },
    ManyToMany { confidence: f32 },
    Temporal { lag_days: i32, correlation: f32 },
}

pub struct FileRelationship {
    source_file: String,
    source_column: String,
    target_file: String,
    target_column: String,
    relationship_type: RelationshipType,
    match_rate: f32,
    sample_matches: Vec<(String, String)>,
}

impl RelationshipDiscoverer {
    pub async fn discover_relationships(
        &self,
        registry: &FileRegistry,
    ) -> Vec<FileRelationship> {
        let mut relationships = Vec::new();
        
        // Compare all file pairs
        for (file1_name, file1) in &registry.files {
            for (file2_name, file2) in &registry.files {
                if file1_name >= file2_name { continue; }
                
                // Check potential key matches
                for key1 in &file1.potential_keys {
                    for key2 in &file2.potential_keys {
                        if let Some(rel) = self.test_relationship(
                            file1, &key1.column_name,
                            file2, &key2.column_name
                        ).await? {
                            relationships.push(rel);
                        }
                    }
                }
                
                // Check temporal relationships
                if !file1.timestamp_columns.is_empty() && !file2.timestamp_columns.is_empty() {
                    let temporal_rels = self.discover_temporal_relationships(file1, file2).await?;
                    relationships.extend(temporal_rels);
                }
            }
        }
        
        relationships
    }
    
    async fn test_relationship(
        &self,
        file1: &FileMetadata,
        column1: &str,
        file2: &FileMetadata,
        column2: &str,
    ) -> Option<FileRelationship> {
        // Use bloom filters for quick rejection
        let bloom1 = &file1.get_key(column1).bloom_filter;
        let bloom2 = &file2.get_key(column2).bloom_filter;
        
        let overlap_estimate = bloom1.estimate_overlap(bloom2);
        if overlap_estimate < self.similarity_threshold {
            return None;
        }
        
        // Sample actual data for confirmation
        let sample1 = self.sample_column(file1, column1, self.sample_size).await?;
        let sample2 = self.sample_column(file2, column2, self.sample_size).await?;
        
        let matches = self.count_matches(&sample1, &sample2);
        let match_rate = matches as f32 / sample1.len().min(sample2.len()) as f32;
        
        if match_rate > self.similarity_threshold {
            Some(FileRelationship {
                source_file: file1.filename.clone(),
                source_column: column1.to_string(),
                target_file: file2.filename.clone(),
                target_column: column2.to_string(),
                relationship_type: self.determine_relationship_type(&sample1, &sample2),
                match_rate,
                sample_matches: self.get_sample_matches(&sample1, &sample2, 5),
            })
        } else {
            None
        }
    }
}
```

### 3. Cross-File Pattern Analyzer

**Behavioral Pattern Mining:**
```rust
pub struct PatternAnalyzer {
    correlation_threshold: f32,
    min_support: f32,
}

pub struct BehavioralPattern {
    description: String,
    source_metric: MetricReference,
    target_metric: MetricReference,
    correlation: f32,
    lag_period: Option<Duration>,
    impact_magnitude: f32,
    confidence: f32,
    examples: Vec<PatternExample>,
}

pub struct MetricReference {
    file: String,
    column: String,
    aggregation: AggregationType,
    filter: Option<String>,
}

impl PatternAnalyzer {
    pub async fn analyze_patterns(
        &self,
        registry: &FileRegistry,
        relationships: &[FileRelationship],
    ) -> Vec<BehavioralPattern> {
        let mut patterns = Vec::new();
        
        // Build virtual joined datasets based on relationships
        let virtual_joins = self.create_virtual_joins(registry, relationships).await?;
        
        // Analyze patterns in each virtual join
        for join in virtual_joins {
            // Find correlated metrics
            let correlations = self.find_correlations(&join).await?;
            
            // Test for temporal patterns
            let temporal_patterns = self.find_temporal_patterns(&join).await?;
            
            // Mine sequential patterns
            let sequential_patterns = self.mine_sequential_patterns(&join).await?;
            
            patterns.extend(correlations);
            patterns.extend(temporal_patterns);
            patterns.extend(sequential_patterns);
        }
        
        // Generate human-readable descriptions
        self.generate_pattern_descriptions(&mut patterns);
        
        patterns
    }
    
    async fn find_temporal_patterns(&self, join: &VirtualJoin) -> Vec<BehavioralPattern> {
        let mut patterns = Vec::new();
        
        // For each metric combination
        for source_col in &join.numeric_columns() {
            for target_col in &join.numeric_columns() {
                if source_col == target_col { continue; }
                
                // Test various lag periods
                for lag_days in [1, 3, 7, 14, 30] {
                    let correlation = self.calculate_lagged_correlation(
                        &join,
                        source_col,
                        target_col,
                        lag_days
                    ).await?;
                    
                    if correlation.abs() > self.correlation_threshold {
                        patterns.push(BehavioralPattern {
                            description: format!(
                                "{} changes {} days before {} changes",
                                source_col, lag_days, target_col
                            ),
                            source_metric: MetricReference {
                                file: join.get_file_for_column(source_col),
                                column: source_col.clone(),
                                aggregation: AggregationType::Mean,
                                filter: None,
                            },
                            target_metric: MetricReference {
                                file: join.get_file_for_column(target_col),
                                column: target_col.clone(),
                                aggregation: AggregationType::Mean,
                                filter: None,
                            },
                            correlation,
                            lag_period: Some(Duration::days(lag_days)),
                            impact_magnitude: self.calculate_impact(correlation),
                            confidence: self.calculate_confidence(&join, source_col, target_col),
                            examples: self.get_examples(&join, source_col, target_col, 3).await?,
                        });
                    }
                }
            }
        }
        
        patterns
    }
}
```

### 4. Join Optimization Engine

**Intelligent Join Recommendations:**
```rust
pub struct JoinOptimizer {
    sentiment_analyzer: SentimentAnalyzer,
    quality_threshold: f32,
}

pub struct JoinRecommendation {
    files: Vec<String>,
    join_keys: Vec<JoinKey>,
    expected_improvement: f32,
    sentiment_coverage: f32,
    behavioral_insights: Vec<String>,
    sample_query: String,
}

pub struct JoinKey {
    left_file: String,
    left_column: String,
    right_file: String,
    right_column: String,
    join_type: JoinType,
}

impl JoinOptimizer {
    pub async fn recommend_joins(
        &self,
        registry: &FileRegistry,
        relationships: &[FileRelationship],
        patterns: &[BehavioralPattern],
    ) -> Vec<JoinRecommendation> {
        let mut recommendations = Vec::new();
        
        // Generate candidate join paths
        let join_paths = self.generate_join_paths(relationships);
        
        // Evaluate each join path
        for path in join_paths {
            let quality_score = self.evaluate_join_quality(&path, registry).await?;
            
            if quality_score > self.quality_threshold {
                // Test sentiment analysis improvement
                let baseline_sentiment = self.baseline_sentiment_quality(registry).await?;
                let joined_sentiment = self.joined_sentiment_quality(&path, registry).await?;
                let improvement = (joined_sentiment - baseline_sentiment) / baseline_sentiment;
                
                // Find relevant behavioral insights
                let insights = self.extract_insights(&path, patterns);
                
                recommendations.push(JoinRecommendation {
                    files: path.get_files(),
                    join_keys: path.join_keys.clone(),
                    expected_improvement: improvement,
                    sentiment_coverage: self.calculate_coverage(&path, registry),
                    behavioral_insights: insights,
                    sample_query: self.generate_sample_query(&path),
                });
            }
        }
        
        // Sort by expected improvement
        recommendations.sort_by(|a, b| 
            b.expected_improvement.partial_cmp(&a.expected_improvement).unwrap()
        );
        
        recommendations
    }
    
    fn generate_sample_query(&self, path: &JoinPath) -> String {
        let mut query = String::from("WITH joined_data AS (\n  SELECT ");
        
        // Select relevant columns
        let columns: Vec<String> = path.files.iter()
            .flat_map(|f| vec![
                format!("{}.customer_id", f),
                format!("{}.sentiment_field", f),
                format!("{}.timestamp", f),
            ])
            .collect();
        
        query.push_str(&columns.join(",\n    "));
        query.push_str("\n  FROM ");
        
        // Build joins
        for (i, join_key) in path.join_keys.iter().enumerate() {
            if i == 0 {
                query.push_str(&format!("{} AS t1", join_key.left_file));
            }
            query.push_str(&format!("\n  {} JOIN {} AS t{} ON t{}.{} = t{}.{}",
                join_key.join_type,
                join_key.right_file,
                i + 2,
                i + 1,
                join_key.left_column,
                i + 2,
                join_key.right_column
            ));
        }
        
        query.push_str("\n)\nSELECT * FROM joined_data");
        query
    }
}
```

### 5. Insight Generation Engine

**Natural Language Insights:**
```rust
pub struct InsightGenerator {
    template_engine: TemplateEngine,
    significance_threshold: f32,
}

pub struct Insight {
    category: InsightCategory,
    title: String,
    description: String,
    evidence: Vec<Evidence>,
    recommended_actions: Vec<String>,
    confidence: f32,
}

pub enum InsightCategory {
    LeadingIndicator,
    CorrelatedBehavior,
    DataQuality,
    HiddenSegment,
    AnomalousPattern,
}

impl InsightGenerator {
    pub async fn generate_insights(
        &self,
        registry: &FileRegistry,
        relationships: &[FileRelationship],
        patterns: &[BehavioralPattern],
        recommendations: &[JoinRecommendation],
    ) -> Vec<Insight> {
        let mut insights = Vec::new();
        
        // Leading indicator insights
        for pattern in patterns.iter().filter(|p| p.lag_period.is_some()) {
            if pattern.correlation.abs() > self.significance_threshold {
                insights.push(self.create_leading_indicator_insight(pattern));
            }
        }
        
        // Data quality insights
        let quality_insights = self.analyze_data_quality(registry, relationships).await?;
        insights.extend(quality_insights);
        
        // Hidden segment insights
        let segment_insights = self.discover_hidden_segments(registry, patterns).await?;
        insights.extend(segment_insights);
        
        // Sort by confidence and impact
        insights.sort_by(|a, b| {
            let score_a = a.confidence * a.impact_score();
            let score_b = b.confidence * b.impact_score();
            score_b.partial_cmp(&score_a).unwrap()
        });
        
        insights
    }
    
    fn create_leading_indicator_insight(&self, pattern: &BehavioralPattern) -> Insight {
        let lag_days = pattern.lag_period.unwrap().as_days();
        
        Insight {
            category: InsightCategory::LeadingIndicator,
            title: format!(
                "{} predicts {} with {}-day lead time",
                pattern.source_metric.column,
                pattern.target_metric.column,
                lag_days
            ),
            description: format!(
                "Analysis shows that changes in {} (from {}) consistently precede changes in {} (from {}) by approximately {} days. \
                The correlation strength is {:.2}, suggesting {} predictive power. \
                For example, when {} decreases by 20%, we typically see {} impact within {} days.",
                pattern.source_metric.column,
                pattern.source_metric.file,
                pattern.target_metric.column,
                pattern.target_metric.file,
                lag_days,
                pattern.correlation.abs(),
                if pattern.correlation.abs() > 0.7 { "strong" } else { "moderate" },
                pattern.source_metric.column,
                pattern.impact_description(),
                lag_days
            ),
            evidence: pattern.examples.iter()
                .map(|ex| Evidence {
                    description: ex.description.clone(),
                    data_points: ex.data_points.clone(),
                    visualization_type: VisualizationType::TimeSeries,
                })
                .collect(),
            recommended_actions: vec![
                format!("Monitor {} as an early warning system", pattern.source_metric.column),
                format!("Set up alerts when {} drops below threshold", pattern.source_metric.column),
                format!("Include {} in predictive models for {}", 
                    pattern.source_metric.column, pattern.target_metric.column),
            ],
            confidence: pattern.confidence,
        }
    }
}
```

### 6. API Design

**New Service Endpoints:**
```rust
// Create analysis session
#[post("/api/v3/sessions")]
async fn create_session(
    req: web::Json<CreateSessionRequest>,
) -> Result<HttpResponse> {
    let session = AnalysisSession::new(req.name, req.description);
    Ok(HttpResponse::Ok().json(SessionResponse {
        session_id: session.id,
        created_at: session.created_at,
    }))
}

// Stage file to session
#[post("/api/v3/sessions/{session_id}/files")]
async fn stage_file(
    session_id: web::Path<Uuid>,
    file: Multipart,
    registry: web::Data<FileRegistry>,
) -> Result<HttpResponse> {
    let metadata = registry.stage_file(session_id, file).await?;
    Ok(HttpResponse::Ok().json(metadata))
}

// Discover relationships
#[post("/api/v3/sessions/{session_id}/discover")]
async fn discover_relationships(
    session_id: web::Path<Uuid>,
    discoverer: web::Data<RelationshipDiscoverer>,
) -> Result<HttpResponse> {
    let relationships = discoverer.discover_relationships(session_id).await?;
    Ok(HttpResponse::Ok().json(DiscoveryResponse {
        relationships,
        relationship_graph: generate_graph_viz(&relationships),
    }))
}

// Analyze patterns
#[post("/api/v3/sessions/{session_id}/analyze")]
async fn analyze_patterns(
    session_id: web::Path<Uuid>,
    analyzer: web::Data<PatternAnalyzer>,
) -> Result<HttpResponse> {
    let patterns = analyzer.analyze_patterns(session_id).await?;
    Ok(HttpResponse::Ok().json(patterns))
}

// Get join recommendations
#[get("/api/v3/sessions/{session_id}/recommendations")]
async fn get_recommendations(
    session_id: web::Path<Uuid>,
    optimizer: web::Data<JoinOptimizer>,
) -> Result<HttpResponse> {
    let recommendations = optimizer.recommend_joins(session_id).await?;
    Ok(HttpResponse::Ok().json(recommendations))
}

// Generate insights
#[get("/api/v3/sessions/{session_id}/insights")]
async fn generate_insights(
    session_id: web::Path<Uuid>,
    generator: web::Data<InsightGenerator>,
) -> Result<HttpResponse> {
    let insights = generator.generate_insights(session_id).await?;
    Ok(HttpResponse::Ok().json(InsightResponse {
        insights,
        summary: generate_executive_summary(&insights),
    }))
}
```

### 7. Data Model

```sql
-- Analysis sessions
CREATE TABLE analysis_sessions (
    session_id UUID PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    status VARCHAR(50)
);

-- Staged files
CREATE TABLE staged_files (
    file_id UUID PRIMARY KEY,
    session_id UUID REFERENCES analysis_sessions(session_id),
    filename VARCHAR(255),
    file_path TEXT,
    row_count BIGINT,
    column_profiles JSON,
    potential_keys JSON,
    staged_at TIMESTAMP
);

-- Discovered relationships
CREATE TABLE file_relationships (
    relationship_id UUID PRIMARY KEY,
    session_id UUID REFERENCES analysis_sessions(session_id),
    source_file_id UUID REFERENCES staged_files(file_id),
    source_column VARCHAR(255),
    target_file_id UUID REFERENCES staged_files(file_id),
    target_column VARCHAR(255),
    relationship_type VARCHAR(50),
    match_rate DECIMAL(3,2),
    confidence DECIMAL(3,2),
    metadata JSON
);

-- Behavioral patterns
CREATE TABLE behavioral_patterns (
    pattern_id UUID PRIMARY KEY,
    session_id UUID REFERENCES analysis_sessions(session_id),
    pattern_type VARCHAR(50),
    source_metric JSON,
    target_metric JSON,
    correlation DECIMAL(3,2),
    lag_days INTEGER,
    description TEXT,
    evidence JSON
);

-- Join recommendations
CREATE TABLE join_recommendations (
    recommendation_id UUID PRIMARY KEY,
    session_id UUID REFERENCES analysis_sessions(session_id),
    join_spec JSON,
    expected_improvement DECIMAL(3,2),
    sentiment_coverage DECIMAL(3,2),
    insights JSON,
    sample_query TEXT
);
```

## User Experience Flow

### 1. Session Creation & File Staging
```
User creates session → Uploads multiple CSV files → System profiles each file
```

### 2. Relationship Discovery
```
System analyzes all files → Shows relationship graph → User confirms/adjusts relationships
```

### 3. Pattern Analysis
```
System mines patterns → Displays temporal correlations → Shows behavioral insights
```

### 4. Join Recommendations
```
System suggests optimal joins → Shows expected improvements → Provides sample queries
```

### 5. Insight Generation
```
System generates natural language insights → Prioritizes by impact → Suggests actions
```

## Success Metrics

### Performance Targets
- **File Staging**: <30 seconds per 1GB file
- **Relationship Discovery**: <2 minutes for 10 files
- **Pattern Analysis**: <5 minutes for complete analysis
- **Memory Usage**: <2GB for 10-file analysis

### Quality Targets
- **Relationship Accuracy**: >95% precision on known relationships
- **Pattern Significance**: Only surface patterns with p-value < 0.05
- **Join Recommendations**: >80% adoption rate
- **Insight Relevance**: >4.0/5.0 user rating

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- Multi-file staging infrastructure
- Basic relationship discovery (exact matches)
- Session management API

### Phase 2: Intelligence (Weeks 3-4)
- ML-based relationship discovery
- Temporal pattern analysis
- Join optimization engine

### Phase 3: Insights (Weeks 5-6)
- Natural language generation
- Interactive visualizations
- Export capabilities

## Risk Mitigation

### Technical Risks
1. **Memory pressure with large files**: Streaming processing with DuckDB
2. **False positive relationships**: Confidence scoring and user confirmation
3. **Pattern significance**: Statistical validation and multiple testing correction

### Business Risks
1. **User overwhelm**: Progressive disclosure of insights
2. **Incorrect recommendations**: Explainable AI with evidence
3. **Performance degradation**: Async processing with progress indicators

## Future Enhancements

### Next Quarter
- Support for more file formats (JSON, Parquet, Excel)
- Real-time pattern monitoring
- Automated data quality remediation
- Integration with BI tools

### Next Year  
- Graph database backend for complex relationships
- ML model training on discovered patterns
- Automated report generation
- Industry-specific pattern libraries