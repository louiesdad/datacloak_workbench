# Enhanced Logging PRD - DataCloak Sentiment Workbench

## 1. Dual-Purpose Logging Strategy

### Technical Logging (IT/Dev)
- System health, errors, performance
- Debug traces, stack traces
- Infrastructure metrics

### Analysis Audit Trail (Business Users)
- **Why** a field was classified as PII
- **What** transformations were applied
- **How** sentiment scores were calculated
- **Which** records were sampled for analysis
- **When** each decision point occurred

## 2. Analysis Transparency Features

### Decision Log Schema
```json
{
  "trace_id": "uuid",
  "record_id": "customer-123",
  "decisions": [
    {
      "step": "field_detection",
      "field": "customer_comment",
      "decision": "classified_as_sentiment_text",
      "confidence": 0.92,
      "reasoning": {
        "heuristic_score": 0.85,
        "gpt_enhancement": true,
        "gpt_reasoning": "Contains subjective language patterns: 'amazing', 'terrible', 'disappointed'",
        "sample_tokens": ["amazing", "terrible", "would not recommend"]
      }
    },
    {
      "step": "pii_masking", 
      "field": "email_field",
      "decision": "masked",
      "patterns_found": ["email"],
      "example": "j***@***.com",
      "mask_count": 1
    },
    {
      "step": "sentiment_analysis",
      "model": "gpt-3.5-turbo",
      "prompt_template": "standard_3_class_v2",
      "input_tokens": 245,
      "output": {
        "sentiment": "negative",
        "confidence": 0.87,
        "explanation": "Customer expresses frustration with product quality and support experience"
      },
      "cost": 0.0023
    }
  ]
}
```

### User-Friendly Analysis Report
```typescript
interface AnalysisAuditReport {
  jobId: string;
  summary: {
    totalRecords: number;
    successfullyAnalyzed: number;
    failedRecords: number;
    piiFieldsDetected: string[];
    averageConfidence: number;
    totalCost: number;
  };
  
  fieldDecisions: {
    fieldName: string;
    classification: string;
    confidence: number;
    reasoning: string;
    sampleValues: string[]; // Masked if PII
  }[];
  
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  
  outliers: {
    recordId: string;
    reason: string;
    details: any;
  }[];
  
  methodologyNotes: string[];
}
```

## 3. Admin Dashboard Requirements

### Real-Time Monitoring View
```
┌─────────────────────────────────────────────────────────────┐
│                   DataCloak Admin Dashboard                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Active Jobs                          System Health         │
│  ┌─────────────────────────┐        ┌───────────────────┐  │
│  │ Job-123  ████████░░ 78% │        │ CPU:    23%       │  │
│  │ Job-456  ██████████ Done│        │ Memory: 1.2GB/4GB │  │
│  │ Job-789  ░░░░░░░░░ Queue│        │ Queue:  3 jobs    │  │
│  └─────────────────────────┘        └───────────────────┘  │
│                                                             │
│  OpenAI Usage                        Cost Tracking          │
│  ┌─────────────────────────┐        ┌───────────────────┐  │
│  │ Requests:    1,247      │        │ Today:    $12.45  │  │
│  │ Tokens:      2.3M       │        │ This Week: $67.89 │  │
│  │ Rate:        3/5 req/s  │        │ This Month: $234  │  │
│  │ Model:       GPT-3.5    │        │ Budget:     $500  │  │
│  └─────────────────────────┘        └───────────────────┘  │
│                                                             │
│  Recent Analysis Decisions                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 10:23 AM | Field 'comment' → Sentiment (92% conf)   │   │
│  │ 10:23 AM | Masked 'email' field (PII detected)      │   │
│  │ 10:24 AM | Sentiment: Negative (87% conf)           │   │
│  │           "Customer frustrated with quality..."      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [View Detailed Logs] [Export Report] [Audit Trail]         │
└─────────────────────────────────────────────────────────────┘
```

### Analysis Audit View
```
┌─────────────────────────────────────────────────────────────┐
│                  Analysis Audit - Job #123                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Why These Results?                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Step 1: Field Detection                              │   │
│  │ • 'customer_feedback' → Text (95% confidence)        │   │
│  │   Reason: Average 127 words, subjective language     │   │
│  │ • 'email' → PII Email (100% confidence)              │   │
│  │   Reason: Matches email pattern, contains @          │   │
│  │                                                       │   │
│  │ Step 2: PII Masking                                  │   │
│  │ • Masked 1,234 email addresses                       │   │
│  │ • Pattern: [EMAIL-XXX] tokens                        │   │
│  │                                                       │   │
│  │ Step 3: Sentiment Analysis                           │   │
│  │ • Model: GPT-3.5-turbo (cost optimization)           │   │
│  │ • Prompt: Standard 3-class v2                        │   │
│  │ • Batch size: 200 records                            │   │
│  │                                                       │   │
│  │ Results Distribution:                                 │   │
│  │ • Positive: 23% (high confidence)                    │   │
│  │ • Neutral: 45% (medium confidence)                   │   │
│  │ • Negative: 32% (high confidence)                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Sample Decisions (click to expand)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Record #45: Negative (91% conf)                      │   │
│  │ Input: "Terrible experience with [EMAIL-1]..."       │   │
│  │ Why: Keywords: "terrible", "disappointed", "never"   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Download Full Audit] [Question Results] [Re-run]          │
└─────────────────────────────────────────────────────────────┘
```

## 4. Implementation Updates

### Logger Configuration
```typescript
// src/lib/logger.ts
export const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Technical logs
    new winston.transports.File({ 
      filename: 'logs/technical.log',
      level: 'debug'
    }),
    
    // Analysis audit trail
    new winston.transports.File({ 
      filename: 'logs/analysis-audit.log',
      level: 'info',
      format: AnalysisAuditFormat
    }),
    
    // Admin dashboard feed
    new winston.transports.Stream({
      stream: adminDashboardStream,
      level: 'info'
    })
  ]
});

// Analysis decision logger
export function logAnalysisDecision(
  traceId: string,
  step: string,
  decision: any,
  reasoning: any
) {
  logger.info('analysis_decision', {
    trace_id: traceId,
    step,
    decision,
    reasoning,
    timestamp: new Date().toISOString(),
    // Include for dashboard
    dashboard_visible: true
  });
}
```

### Admin Dashboard Components

```typescript
// packages/web-ui/src/components/AdminDashboard/

// 1. Real-time job monitor
export const JobMonitor: React.FC = () => {
  const jobs = useJobStatus(); // WebSocket subscription
  return <JobProgressList jobs={jobs} />;
};

// 2. OpenAI usage tracker
export const OpenAIUsageTracker: React.FC = () => {
  const usage = useOpenAIMetrics();
  return (
    <UsageCard
      requests={usage.requests}
      tokens={usage.tokens}
      cost={usage.cost}
      rateLimit={usage.rateLimit}
    />
  );
};

// 3. Analysis audit browser
export const AnalysisAuditBrowser: React.FC = () => {
  const [selectedJob, setSelectedJob] = useState<string>();
  const audit = useAuditTrail(selectedJob);
  
  return (
    <AuditView
      decisions={audit.decisions}
      onQuestionResult={(decision) => {
        // Allow user to question/override
      }}
    />
  );
};
```

## 5. Work Breakdown (Updated)

1. **Enhanced Logger Core (1.5d)**
   - Dual-purpose logger setup
   - Analysis decision tracking
   - Audit trail formatting

2. **Admin Dashboard UI (3d)**
   - Real-time monitoring components
   - OpenAI usage visualization
   - Cost tracking with projections
   - Analysis audit browser

3. **Analysis Transparency (2d)**
   - Decision explanation capture
   - Reasoning storage
   - Sample value preservation
   - Confidence tracking

4. **WebSocket Integration (1d)**
   - Real-time log streaming
   - Dashboard updates
   - Progress notifications

5. **Audit Export/Report (1d)**
   - PDF audit reports
   - CSV decision exports
   - Methodology documentation

6. **Testing (2d)**
   - Audit completeness tests
   - Dashboard performance tests
   - Decision explanation validation

## 6. User Stories

### As a Business Analyst
- I want to understand WHY certain records were classified as negative
- I want to see WHAT patterns triggered PII detection
- I want to verify the analysis methodology was consistent

### As an Admin
- I want real-time visibility into system usage
- I want to track OpenAI costs against budget
- I want to monitor job success rates

### As a Compliance Officer
- I want proof that PII was masked before external API calls
- I want audit trails for all analysis decisions
- I want to export reports for regulatory review

## 7. Acceptance Criteria

1. **Every analysis decision is logged with reasoning**
2. **Admin dashboard updates within 1 second of events**
3. **Audit trails can reconstruct entire analysis flow**
4. **Users can question and explore any result**
5. **Cost tracking accurate to ±$0.01**
6. **No PII visible in any logs or audit trails**

## 8. Security & Privacy

- Analysis logs stored separately from technical logs
- PII masking verification before logging
- Role-based access to audit trails
- Encrypted storage for sensitive decisions
- Audit log retention: 90 days
- Technical log retention: 30 days