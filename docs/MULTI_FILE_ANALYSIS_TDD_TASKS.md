# Multi-File Analysis Developer Task Assignments - TDD Approach

## Prerequisites for All Developers

### Required Reading
1. **TDD Reference Guide**: `/docs/CLAUDE_tdd_reference_guide.md` - Read this FIRST
2. **Product Requirements**: `/docs/prd/multi-file-analysis-prd.md` - Understand the features
3. **Existing Codebase**: Review current sentiment analysis and file processing code

### TDD Workflow Reminder
```
1. RED: Write a failing test for the next small piece of functionality
2. GREEN: Write minimal code to make the test pass
3. REFACTOR: Clean up code while keeping tests green
4. REPEAT: Move to the next test
```

### Key Architecture Components
- **File Registry**: Manages multiple staged files in a session
- **Relationship Discoverer**: Automatically finds connections between files
- **Pattern Analyzer**: Mines behavioral patterns across files
- **Join Optimizer**: Recommends optimal data combinations
- **Insight Generator**: Creates natural language insights

---

## Developer 1: File Registry & Session Management

### Your Mission
Build the foundation for multi-file staging and session management that allows users to upload and profile multiple CSV files.

### Required Background
- Review existing file upload in `/packages/backend/services/data.service.ts`
- Study column profiling in `/packages/backend/services/ml-column-profiler.service.ts`
- Understand current database schema for datasets

### TDD Task List

#### Task 1.1: Analysis Session Management
```typescript
// Start with these tests:
describe('Analysis Session Management', () => {
  test('should create new analysis session with unique ID', () => {
    // RED: Write this test first - it should FAIL
    const session = AnalysisSession.create('Multi-file analysis', 'Customer churn analysis');
    expect(session.id).toBeDefined();
    expect(session.name).toBe('Multi-file analysis');
    expect(session.status).toBe('active');
  });
  
  test('should persist session to database', async () => {
    // Test database persistence
    const session = AnalysisSession.create('Test session');
    await sessionRepository.save(session);
    const loaded = await sessionRepository.findById(session.id);
    expect(loaded).toEqual(session);
  });
  
  test('should track session lifecycle states', async () => {
    // Test state transitions
    const session = AnalysisSession.create('Test');
    expect(session.status).toBe('active');
    await session.complete();
    expect(session.status).toBe('completed');
  });
});
```

**Implementation Order:**
1. Write failing test for session creation
2. Create minimal AnalysisSession class
3. Add database persistence tests
4. Implement repository pattern
5. Add lifecycle management
6. Refactor for clean architecture

#### Task 1.2: File Registry Core
```typescript
describe('File Registry', () => {
  test('should stage single file with metadata', async () => {
    // RED: Test file staging
    const registry = new FileRegistry(sessionId);
    const metadata = await registry.stageFile('users.csv');
    
    expect(metadata.filename).toBe('users.csv');
    expect(metadata.rowCount).toBeGreaterThan(0);
    expect(metadata.columns).toBeDefined();
  });
  
  test('should prevent duplicate file names in session', async () => {
    // Test uniqueness constraint
    const registry = new FileRegistry(sessionId);
    await registry.stageFile('users.csv');
    
    await expect(registry.stageFile('users.csv'))
      .rejects.toThrow('File users.csv already staged');
  });
  
  test('should profile columns automatically', async () => {
    // Test ML profiler integration
    const metadata = await registry.stageFile('test.csv');
    
    expect(metadata.columns).toContainEqual(
      expect.objectContaining({
        name: 'email',
        dataType: 'email',
        uniqueness: expect.any(Number),
        isPotentialKey: true
      })
    );
  });
});
```

#### Task 1.3: Potential Key Detection
```typescript
describe('Potential Key Detection', () => {
  test('should identify high cardinality columns as potential keys', async () => {
    // Test key detection algorithm
    const detector = new KeyDetector();
    const columns = [
      { name: 'id', uniqueness: 0.99 },
      { name: 'name', uniqueness: 0.45 },
      { name: 'status', uniqueness: 0.02 }
    ];
    
    const keys = detector.identifyKeys(columns);
    expect(keys).toContain('id');
    expect(keys).not.toContain('status');
  });
  
  test('should create bloom filters for efficient matching', async () => {
    // Test bloom filter creation
    const key = await registry.createPotentialKey('user_id', values);
    
    expect(key.bloomFilter).toBeDefined();
    expect(key.bloomFilter.contains('user123')).toBe(true);
  });
});
```

### Deliverables Checklist
- [ ] Session management with full lifecycle
- [ ] File staging with automatic profiling
- [ ] Potential key detection algorithm
- [ ] Bloom filter implementation for keys
- [ ] 100% test coverage
- [ ] API documentation

---

## Developer 2: Relationship Discovery Engine

### Your Mission
Build the intelligent relationship discovery system that automatically finds connections between staged files.

### Required Background
- Study data profiling concepts
- Understand foreign key detection algorithms
- Review bloom filter data structures

### TDD Task List

#### Task 2.1: Basic Relationship Detection
```typescript
describe('Relationship Discovery', () => {
  test('should detect exact column name matches', async () => {
    // RED: Simple matching test
    const discoverer = new RelationshipDiscoverer();
    const file1 = { columns: [{ name: 'user_id', type: 'string' }] };
    const file2 = { columns: [{ name: 'user_id', type: 'string' }] };
    
    const relationships = await discoverer.discover([file1, file2]);
    
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      sourceColumn: 'user_id',
      targetColumn: 'user_id',
      confidence: expect.any(Number)
    });
  });
  
  test('should detect relationships with different column names', async () => {
    // Test semantic matching
    const relationships = await discoverer.discover([
      { columns: [{ name: 'customer_id' }] },
      { columns: [{ name: 'cust_id' }] }
    ]);
    
    expect(relationships).toHaveLength(1);
  });
});
```

#### Task 2.2: Relationship Type Classification
```typescript
describe('Relationship Type Detection', () => {
  test('should identify one-to-one relationships', async () => {
    // Test cardinality detection
    const classifier = new RelationshipClassifier();
    const samples = {
      left: ['1', '2', '3'],
      right: ['1', '2', '3']
    };
    
    const type = classifier.classify(samples);
    expect(type).toBe('ONE_TO_ONE');
  });
  
  test('should identify one-to-many relationships', async () => {
    const samples = {
      left: ['1', '1', '2', '2'],
      right: ['A', 'B', 'C', 'D']
    };
    
    const type = classifier.classify(samples);
    expect(type).toBe('ONE_TO_MANY');
  });
});
```

#### Task 2.3: Temporal Relationship Discovery
```typescript
describe('Temporal Relationships', () => {
  test('should detect time-lagged correlations', async () => {
    // Test temporal pattern detection
    const analyzer = new TemporalAnalyzer();
    const timeSeries1 = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 110 }
    ];
    const timeSeries2 = [
      { date: '2024-01-04', value: 95 },
      { date: '2024-01-05', value: 105 }
    ];
    
    const correlation = await analyzer.findLaggedCorrelation(
      timeSeries1, 
      timeSeries2, 
      { maxLagDays: 7 }
    );
    
    expect(correlation.lagDays).toBe(3);
    expect(correlation.coefficient).toBeGreaterThan(0.7);
  });
});
```

### Integration Points
- Use bloom filters from Developer 1
- Provide relationships to Developer 3
- Feed discoveries to Developer 4

---

## Developer 3: Pattern Analysis Engine

### Your Mission
Build the cross-file pattern mining system that discovers behavioral patterns impacting sentiment.

### Required Background
- Study correlation analysis algorithms
- Understand time series analysis
- Review pattern mining techniques

### TDD Task List

#### Task 3.1: Virtual Join Creation
```typescript
describe('Virtual Join Creation', () => {
  test('should create virtual join from relationships', async () => {
    // RED: Test join creation
    const joiner = new VirtualJoiner();
    const relationship = {
      sourceFile: 'users.csv',
      sourceColumn: 'id',
      targetFile: 'orders.csv',
      targetColumn: 'user_id'
    };
    
    const virtualJoin = await joiner.createJoin(relationship);
    
    expect(virtualJoin.getColumns()).toContain('users.id');
    expect(virtualJoin.getColumns()).toContain('orders.user_id');
  });
  
  test('should handle multiple join paths', async () => {
    // Test complex joins
    const joins = await joiner.createMultiJoin([
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' }
    ]);
    
    expect(joins.getFiles()).toEqual(['A', 'B', 'C']);
  });
});
```

#### Task 3.2: Correlation Analysis
```typescript
describe('Pattern Correlation Analysis', () => {
  test('should find correlated metrics across files', async () => {
    // Test correlation discovery
    const analyzer = new PatternAnalyzer();
    const virtualJoin = createTestJoin();
    
    const correlations = await analyzer.findCorrelations(virtualJoin);
    
    expect(correlations).toContainEqual(
      expect.objectContaining({
        metric1: 'klaviyo.open_rate',
        metric2: 'reviews.sentiment_score',
        correlation: expect.any(Number),
        pValue: expect.any(Number)
      })
    );
  });
  
  test('should identify leading indicators', async () => {
    // Test temporal patterns
    const patterns = await analyzer.findTemporalPatterns(virtualJoin);
    
    expect(patterns).toContainEqual(
      expect.objectContaining({
        leadingMetric: 'email_engagement',
        lagDays: 3,
        targetMetric: 'customer_sentiment',
        confidence: expect.any(Number)
      })
    );
  });
});
```

#### Task 3.3: Sequential Pattern Mining
```typescript
describe('Sequential Pattern Mining', () => {
  test('should discover action sequences', async () => {
    // Test sequence mining
    const miner = new SequentialPatternMiner();
    const sequences = [
      ['login', 'browse', 'purchase'],
      ['login', 'browse', 'support', 'churn']
    ];
    
    const patterns = miner.mine(sequences, { minSupport: 0.3 });
    
    expect(patterns).toContainEqual({
      sequence: ['login', 'browse'],
      support: 1.0,
      outcomes: expect.any(Object)
    });
  });
});
```

### Deliverables
- Virtual join implementation
- Correlation analysis with p-values
- Temporal pattern detection
- Sequential pattern mining
- Statistical validation

---

## Developer 4: Join Optimization Engine

### Your Mission
Build the intelligent join recommendation system that suggests optimal data combinations for enhanced sentiment analysis.

### Required Background
- Understand database query optimization
- Study join algorithms and costs
- Review sentiment analysis requirements

### TDD Task List

#### Task 4.1: Join Path Generation
```typescript
describe('Join Path Generation', () => {
  test('should generate all valid join paths', () => {
    // RED: Test path generation
    const optimizer = new JoinOptimizer();
    const relationships = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'A', to: 'C' }
    ];
    
    const paths = optimizer.generatePaths(relationships);
    
    expect(paths).toContainEqual(['A', 'B', 'C']);
    expect(paths).toContainEqual(['A', 'C']);
  });
  
  test('should avoid circular paths', () => {
    // Test cycle detection
    const relationships = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'A' }
    ];
    
    const paths = optimizer.generatePaths(relationships);
    expect(paths).not.toContainEqual(['A', 'B', 'C', 'A']);
  });
});
```

#### Task 4.2: Join Quality Evaluation
```typescript
describe('Join Quality Evaluation', () => {
  test('should calculate join selectivity', async () => {
    // Test quality metrics
    const evaluator = new JoinEvaluator();
    const join = {
      leftFile: 'users',
      rightFile: 'orders',
      joinKey: 'user_id'
    };
    
    const quality = await evaluator.evaluate(join);
    
    expect(quality).toMatchObject({
      selectivity: expect.any(Number),
      dataCompleteness: expect.any(Number),
      sentimentCoverage: expect.any(Number)
    });
  });
  
  test('should predict sentiment improvement', async () => {
    // Test improvement calculation
    const baseline = await evaluator.baselineSentimentQuality();
    const joined = await evaluator.joinedSentimentQuality(join);
    
    const improvement = (joined - baseline) / baseline;
    expect(improvement).toBeGreaterThan(0);
  });
});
```

#### Task 4.3: SQL Query Generation
```typescript
describe('SQL Query Generation', () => {
  test('should generate valid join queries', () => {
    // Test query generation
    const generator = new QueryGenerator();
    const recommendation = {
      files: ['users', 'orders'],
      joinKeys: [{ left: 'id', right: 'user_id' }]
    };
    
    const sql = generator.generate(recommendation);
    
    expect(sql).toContain('JOIN');
    expect(sql).toContain('users.id = orders.user_id');
  });
  
  test('should include relevant columns only', () => {
    // Test column selection
    const sql = generator.generate(recommendation, {
      includeColumns: ['sentiment_relevant']
    });
    
    expect(sql).not.toContain('SELECT *');
  });
});
```

### Integration Requirements
- Use patterns from Developer 3
- Generate queries for Developer 7
- Provide metrics to Developer 5

---

## Developer 5: Insight Generation Engine

### Your Mission
Build the natural language insight generation system that creates actionable recommendations from discovered patterns.

### Required Background
- Study natural language generation
- Understand statistical significance
- Review business intelligence concepts

### TDD Task List

#### Task 5.1: Insight Categorization
```typescript
describe('Insight Categorization', () => {
  test('should categorize leading indicator insights', () => {
    // RED: Test categorization
    const categorizer = new InsightCategorizer();
    const pattern = {
      type: 'temporal',
      lagDays: 3,
      correlation: 0.85
    };
    
    const category = categorizer.categorize(pattern);
    expect(category).toBe('LEADING_INDICATOR');
  });
  
  test('should identify data quality insights', () => {
    // Test quality detection
    const pattern = {
      type: 'missing_data',
      impact: 'high',
      affectedRows: 1000
    };
    
    const category = categorizer.categorize(pattern);
    expect(category).toBe('DATA_QUALITY');
  });
});
```

#### Task 5.2: Natural Language Generation
```typescript
describe('Natural Language Generation', () => {
  test('should generate readable insight descriptions', () => {
    // Test NLG
    const generator = new InsightGenerator();
    const pattern = {
      source: 'email_open_rate',
      target: 'customer_churn',
      correlation: -0.72,
      lagDays: 7
    };
    
    const insight = generator.generate(pattern);
    
    expect(insight.title).toContain('Email engagement predicts churn');
    expect(insight.description).toContain('7 days');
    expect(insight.description).toContain('72%');
  });
  
  test('should provide actionable recommendations', () => {
    // Test recommendation generation
    const insight = generator.generate(pattern);
    
    expect(insight.recommendations).toContain(
      expect.stringMatching(/monitor.*email.*engagement/i)
    );
  });
});
```

#### Task 5.3: Evidence Compilation
```typescript
describe('Evidence Compilation', () => {
  test('should include supporting data points', () => {
    // Test evidence gathering
    const compiler = new EvidenceCompiler();
    const pattern = {
      examples: [
        { customer: 'A', metric1: 0.2, metric2: -0.5 },
        { customer: 'B', metric1: 0.3, metric2: -0.4 }
      ]
    };
    
    const evidence = compiler.compile(pattern);
    
    expect(evidence).toHaveLength(2);
    expect(evidence[0]).toMatchObject({
      description: expect.any(String),
      dataPoints: expect.any(Array),
      visualizationType: 'TIME_SERIES'
    });
  });
});
```

### Output Requirements
- Human-readable insights
- Statistical evidence
- Actionable recommendations
- Confidence scores
- Business impact estimates

---

## Developer 6: API & Service Layer

### Your Mission
Create RESTful API endpoints for the multi-file analysis workflow with proper session management.

### Required Background
- Review existing API patterns in `/packages/backend/routes/`
- Understand session-based workflows
- Study file upload handling

### TDD Task List

#### Task 6.1: Session API Endpoints
```typescript
describe('Session API Endpoints', () => {
  test('POST /api/v3/sessions should create new session', async () => {
    // RED: Test session creation
    const response = await request(app)
      .post('/api/v3/sessions')
      .send({ name: 'Test Analysis', description: 'Testing' });
    
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      sessionId: expect.any(String),
      createdAt: expect.any(String)
    });
  });
  
  test('should validate session request data', async () => {
    // Test validation
    const response = await request(app)
      .post('/api/v3/sessions')
      .send({}); // Missing required fields
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('name is required');
  });
});
```

#### Task 6.2: File Staging Endpoints
```typescript
describe('File Staging API', () => {
  test('POST /api/v3/sessions/:id/files should stage file', async () => {
    // Test file upload
    const response = await request(app)
      .post(`/api/v3/sessions/${sessionId}/files`)
      .attach('file', 'test-data/users.csv');
    
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      fileId: expect.any(String),
      filename: 'users.csv',
      rowCount: expect.any(Number),
      columns: expect.any(Array)
    });
  });
  
  test('should handle multiple file uploads', async () => {
    // Test batch upload
    const files = ['users.csv', 'orders.csv', 'klaviyo.csv'];
    
    for (const file of files) {
      await request(app)
        .post(`/api/v3/sessions/${sessionId}/files`)
        .attach('file', `test-data/${file}`)
        .expect(200);
    }
    
    const session = await getSession(sessionId);
    expect(session.files).toHaveLength(3);
  });
});
```

#### Task 6.3: Discovery & Analysis Endpoints
```typescript
describe('Discovery API Endpoints', () => {
  test('POST /api/v3/sessions/:id/discover should find relationships', async () => {
    // Test relationship discovery
    const response = await request(app)
      .post(`/api/v3/sessions/${sessionId}/discover`)
      .send({ threshold: 0.7 });
    
    expect(response.status).toBe(200);
    expect(response.body.relationships).toBeInstanceOf(Array);
    expect(response.body.relationshipGraph).toBeDefined();
  });
  
  test('should run discovery asynchronously for large datasets', async () => {
    // Test async processing
    const response = await request(app)
      .post(`/api/v3/sessions/${sessionId}/discover`)
      .send({ async: true });
    
    expect(response.status).toBe(202);
    expect(response.body.jobId).toBeDefined();
  });
});
```

### API Design Requirements
- RESTful conventions
- Proper status codes
- Comprehensive error handling
- Request validation
- Async job support

---

## Developer 7: Database Schema & Query Engine

### Your Mission
Design and implement the database schema for multi-file analysis and build efficient query execution.

### Required Background
- Review current database schema
- Understand DuckDB analytics capabilities
- Study query optimization techniques

### TDD Task List

#### Task 7.1: Schema Migration
```typescript
describe('Database Schema Migration', () => {
  test('should create analysis_sessions table', async () => {
    // RED: Test migration
    const migration = new CreateAnalysisSessionsMigration();
    await migration.up();
    
    const tableExists = await db.schema.hasTable('analysis_sessions');
    expect(tableExists).toBe(true);
    
    const columns = await db.schema.getColumns('analysis_sessions');
    expect(columns).toContain('session_id');
    expect(columns).toContain('status');
  });
  
  test('should create proper indexes', async () => {
    // Test index creation
    const indexes = await db.schema.getIndexes('file_relationships');
    
    expect(indexes).toContainEqual(
      expect.objectContaining({
        name: 'idx_relationships_session',
        columns: ['session_id']
      })
    );
  });
});
```

#### Task 7.2: Query Builder
```typescript
describe('Dynamic Query Builder', () => {
  test('should build join query from recommendation', async () => {
    // Test query building
    const builder = new DynamicQueryBuilder();
    const recommendation = {
      files: ['users', 'orders'],
      joinKeys: [{ left: 'id', right: 'user_id' }]
    };
    
    const query = builder.buildJoinQuery(recommendation);
    
    expect(query.toString()).toContain('JOIN');
    expect(query.toString()).toContain('users.id = orders.user_id');
  });
  
  test('should optimize for DuckDB analytics', async () => {
    // Test DuckDB optimization
    const query = builder.buildAnalyticsQuery(recommendation);
    
    expect(query.toString()).toContain('SAMPLE');
    expect(query.toString()).toContain('TABLESAMPLE');
  });
});
```

#### Task 7.3: Query Execution Engine
```typescript
describe('Query Execution Engine', () => {
  test('should execute queries with progress tracking', async () => {
    // Test execution with progress
    const engine = new QueryExecutionEngine();
    const progress = [];
    
    engine.on('progress', (p) => progress.push(p));
    
    const result = await engine.execute(query);
    
    expect(result.rows).toBeGreaterThan(0);
    expect(progress.length).toBeGreaterThan(0);
  });
  
  test('should handle large result sets efficiently', async () => {
    // Test streaming results
    const stream = await engine.executeStream(largeQuery);
    let rowCount = 0;
    
    stream.on('data', () => rowCount++);
    await streamComplete(stream);
    
    expect(rowCount).toBeGreaterThan(10000);
  });
});
```

### Database Requirements
- Efficient schema design
- Proper indexing strategy
- Query optimization
- Progress tracking
- Stream processing support

---

## Developer 8: Frontend Integration

### Your Mission
Build the user interface components for multi-file analysis workflow with real-time updates.

### Required Background
- Review existing frontend in `/packages/web-ui/`
- Understand React/TypeScript patterns
- Study WebSocket integration

### TDD Task List

#### Task 8.1: Session Management UI
```typescript
describe('Session Management UI', () => {
  test('should display session creation form', () => {
    // RED: Test component rendering
    const { getByLabelText, getByText } = render(<CreateSessionForm />);
    
    expect(getByLabelText('Session Name')).toBeInTheDocument();
    expect(getByLabelText('Description')).toBeInTheDocument();
    expect(getByText('Create Session')).toBeInTheDocument();
  });
  
  test('should validate form inputs', async () => {
    // Test validation
    const { getByText } = render(<CreateSessionForm />);
    const submitButton = getByText('Create Session');
    
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(getByText('Session name is required')).toBeInTheDocument();
    });
  });
});
```

#### Task 8.2: File Upload & Preview
```typescript
describe('Multi-File Upload Component', () => {
  test('should accept multiple CSV files', async () => {
    // Test file upload
    const { getByTestId } = render(<MultiFileUpload />);
    const input = getByTestId('file-input');
    
    const files = [
      new File([''], 'users.csv'),
      new File([''], 'orders.csv')
    ];
    
    fireEvent.change(input, { target: { files } });
    
    await waitFor(() => {
      expect(getByText('users.csv')).toBeInTheDocument();
      expect(getByText('orders.csv')).toBeInTheDocument();
    });
  });
  
  test('should show upload progress', async () => {
    // Test progress display
    const { getByTestId } = render(<MultiFileUpload />);
    
    // Trigger upload
    await uploadFile(file);
    
    const progressBar = getByTestId('upload-progress');
    expect(progressBar).toHaveAttribute('value', expect.any(String));
  });
});
```

#### Task 8.3: Relationship Visualization
```typescript
describe('Relationship Graph Visualization', () => {
  test('should render relationship graph', () => {
    // Test graph rendering
    const relationships = [
      { source: 'users', target: 'orders', key: 'user_id' }
    ];
    
    const { container } = render(
      <RelationshipGraph relationships={relationships} />
    );
    
    const nodes = container.querySelectorAll('.node');
    const edges = container.querySelectorAll('.edge');
    
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);
  });
  
  test('should highlight relationships on hover', () => {
    // Test interactivity
    const { getByTestId } = render(<RelationshipGraph {...props} />);
    const edge = getByTestId('edge-users-orders');
    
    fireEvent.mouseEnter(edge);
    
    expect(edge).toHaveClass('highlighted');
  });
});
```

### Frontend Requirements
- Session management workflow
- Multi-file upload with progress
- Relationship visualization
- Real-time progress updates
- Responsive design

---

## Integration Testing Requirements

### Cross-Developer Integration Points

#### Session Workflow (Dev 1 + 6 + 8)
```typescript
describe('End-to-End Session Workflow', () => {
  test('should complete full session lifecycle', async () => {
    // Create session via API
    const session = await createSession('Test');
    
    // Upload files
    await uploadFile(session.id, 'users.csv');
    await uploadFile(session.id, 'orders.csv');
    
    // Discover relationships
    const relationships = await discoverRelationships(session.id);
    
    // Generate insights
    const insights = await generateInsights(session.id);
    
    expect(insights).toHaveLength(greaterThan(0));
  });
});
```

#### Pattern Discovery Pipeline (Dev 2 + 3 + 4)
```typescript
describe('Pattern Discovery Pipeline', () => {
  test('should flow from relationships to recommendations', async () => {
    // Discover relationships
    const relationships = await discoverer.discover(files);
    
    // Analyze patterns
    const patterns = await analyzer.analyze(relationships);
    
    // Generate recommendations
    const recommendations = await optimizer.recommend(patterns);
    
    expect(recommendations[0].expectedImprovement).toBeGreaterThan(0);
  });
});
```

---

## Performance Requirements

### Load Testing Targets
- File staging: <30 seconds per 1GB file
- Relationship discovery: <2 minutes for 10 files
- Pattern analysis: <5 minutes for complete analysis
- Memory usage: <2GB for 10-file analysis

### Performance Tests
```typescript
describe('Performance Benchmarks', () => {
  test('should handle 10 files within memory limits', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Process 10 files
    for (let i = 0; i < 10; i++) {
      await registry.stageFile(`file${i}.csv`);
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
    
    expect(memoryIncrease).toBeLessThan(2048); // Less than 2GB
  });
});
```

---

## Testing Strategy

### Unit Test Coverage Requirements
- Minimum 90% code coverage per developer
- All happy paths tested
- All error conditions tested
- All edge cases tested

### Integration Test Requirements
- Cross-service integration tests
- API endpoint tests
- Database transaction tests
- WebSocket communication tests

### E2E Test Requirements
- Complete user workflows
- Multi-browser testing
- Performance benchmarks
- Error recovery scenarios

---

## Timeline & Milestones

### Week 1-2: Foundation
- Dev 1: Session management & file registry
- Dev 6: Basic API endpoints
- Dev 7: Database schema
- Dev 8: Session UI

### Week 3-4: Intelligence
- Dev 2: Relationship discovery
- Dev 3: Pattern analysis
- Dev 4: Join optimization
- Dev 5: Basic insights

### Week 5-6: Polish
- All: Integration testing
- All: Performance optimization
- All: Documentation
- All: Code review

---

## Code Review Checklist

### For Every Pull Request
- [ ] All tests written BEFORE implementation
- [ ] Tests pass locally
- [ ] Code coverage > 90%
- [ ] No commented-out code
- [ ] Clear commit messages showing TDD process
- [ ] Integration tests with other components
- [ ] Performance tests where applicable
- [ ] Documentation updated

### TDD Evidence Required
- Commit history showing red-green-refactor
- Test files created before implementation files
- Incremental test additions
- Refactoring commits with green tests

---

## Success Criteria

### Technical Success
- All tests passing
- 90%+ code coverage
- Performance targets met
- Zero critical bugs

### Product Success
- Relationship discovery accuracy > 95%
- Pattern significance p-value < 0.05
- Join recommendations adopted > 80%
- User satisfaction > 4.0/5.0

### TDD Success
- Every feature has tests written first
- Clear red-green-refactor history
- Minimal debugging time
- High confidence in code changes