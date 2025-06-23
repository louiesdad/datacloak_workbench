# Differential PRD: Multi-Field Analysis, Behavioral Sentiment & ROI-Driven Automation

## Executive Summary

This PRD outlines critical updates to the DataCloak Sentiment Workbench for a small user base (5-20 analysts) processing 5MB-50GB files. Since OpenAI API speed is our unchangeable bottleneck, the system design prioritizes immediate feedback through progressive results and smart sampling while maintaining architectural simplicity.

## Design Principles

- **Immediate feedback**: Show results within minutes, not hours
- **Clear expectations**: Transparent processing times and progress
- **Simple architecture**: Single server for <20 users
- **Smart processing**: Sampling and progressive results
- **User-centric**: Clear steps and constant communication
- **Build on existing**: Extend working code, replace only when necessary

## Implementation Priority Structure

### Priority 0: DataCloak Multi-Field Foundation with Progressive Results
Essential updates to support multi-field analysis with immediate user feedback

### Priority 1: Sentiment-Driven Automation Triggers
Automated actions based on sentiment thresholds (10-20x ROI)

### Priority 2: Predictive Sentiment Trajectories  
30-60 day sentiment forecasting (5-10x ROI)

### Priority 3: Causal Analysis Engine
Root cause identification for sentiment changes (3-5x ROI)

---

## Priority 0: DataCloak Multi-Field Foundation with Progressive Results

### Overview
Update DataCloak library integration to support multiple field analysis while providing immediate feedback through smart sampling and progressive processing.

### Implementation Guidance
**EXTEND existing DataCloak integration - do not replace**
- Current: `datacloak.maskText(single_field)`
- Extend to: `datacloak.maskFields(field_array)`
- Wrap existing masking logic in efficient batch processor
- Preserve all security validation and error handling

### Core Requirements

#### Progressive Processing System
Provide immediate value while processing large files.

**Processing Strategy:**
1. **Quick Preview** (5-10 minutes)
   - Process first 1,000 rows
   - Show initial sentiment distribution
   - Identify detected fields
   - Provide "Continue Full Analysis" option

2. **Statistical Sample** (30 minutes)
   - Stratified sample of 10,000 rows
   - Statistically valid preview
   - Confidence intervals included
   - 95% accurate for files >100K rows

3. **Full Processing** (Background)
   - Complete file processing
   - Progressive updates every 1,000 rows
   - Email notifications at milestones
   - Partial results always available

**Implementation Pattern:**
```javascript
// GOOD: Wrap existing processor
class ProgressiveProcessor {
  constructor(existingSentimentProcessor) {
    this.core = existingSentimentProcessor; // Reuse!
    this.sampler = new StatisticalSampler();
  }
}
```

**User Interface Flow:**
```
File Upload Screen:
┌─────────────────────────────────────────────────────────┐
│ Upload Your Data File                                   │
│                                                         │
│ [Drop file here or click to browse]                    │
│                                                         │
│ File: customer_data_2024.csv (25GB)                    │
│                                                         │
│ ⚡ Quick Preview: ~5 minutes (first 1,000 rows)        │
│ 📊 Statistical Sample: ~30 minutes (10,000 rows)       │
│ ✓ Full Analysis: ~14 hours (5 million rows)           │
│                                                         │
│ [Start Quick Preview] [Process Full File]               │
│                                                         │
│ ℹ️ You'll see initial results in 5 minutes and can     │
│    decide whether to continue with full processing      │
└─────────────────────────────────────────────────────────┘
```

#### Field Discovery with User Guidance
Simple field discovery with clear user communication.

**Implementation Guidance:**
- Check for existing `FieldDetector` or similar class
- If exists: Extend with pattern library
- If not: Build new `FieldDiscoveryEngine`
- Preserve any existing field validation logic

**Discovery Flow:**
```
Field Analysis Results:
┌─────────────────────────────────────────────────────────┐
│ We found 12 fields in your file                        │
│ 4 appear to contain sentiment-rich text                │
│                                                         │
│ ✓ Recommended for Analysis:                            │
│ ☑ customer_feedback (98% confidence)                   │
│   "The product quality is excellent but..."            │
│ ☑ support_notes (87% confidence)                       │
│   "User complained about slow response..."             │
│ ☑ review_text (92% confidence)                         │
│   "Would not recommend because..."                     │
│                                                         │
│ ⚠️ Fields with PII (will be masked):                   │
│ ☐ email_address                                        │
│ ☐ phone_number                                         │
│                                                         │
│ ℹ️ Other fields:                                        │
│ ☐ order_id (identifier)                                │
│ ☐ purchase_date (date)                                 │
│ ☐ amount (numeric)                                     │
│                                                         │
│ [Analyze Selected Fields] [Why these recommendations?]  │
└─────────────────────────────────────────────────────────┘
```

#### Real-Time Progress Dashboard
Keep users informed throughout processing.

**Implementation Guidance:**
- EXTEND existing results display
- Add WebSocket or SSE for live updates
- Reuse existing UI framework and styling

**Progress Interface:**
```
Analysis in Progress:
┌─────────────────────────────────────────────────────────┐
│ Processing: customer_data_2024.csv                      │
│                                                         │
│ ▓▓▓▓▓▓▓░░░░░░░░░░░░ 35% (1,750,000 / 5,000,000)       │
│                                                         │
│ ⏱️ Elapsed: 4 hours 12 minutes                          │
│ ⏳ Remaining: ~8 hours (at current rate)                │
│                                                         │
│ Current Findings:                                       │
│ • Sentiment: 😊 32% 😐 45% 😞 23%                       │
│ • Interesting trend: Negative sentiment increasing      │
│   in recent records                                     │
│ • 2,341 high-risk customers identified                  │
│                                                         │
│ [View Partial Results] [Download Current CSV]           │
│ [Pause] [Cancel] [Email me when done]                   │
│                                                         │
│ 💡 Tip: You can work with partial results while we      │
│    continue processing the rest                         │
└─────────────────────────────────────────────────────────┘
```

### API Updates
**EXTEND existing endpoints - maintain backwards compatibility:**
```javascript
// Keep existing endpoint working
router.post('/api/analyze', existingHandler);

// Add new progressive endpoints
router.post('/api/analyze/preview', previewHandler);
router.post('/api/analyze/sample', sampleHandler);
router.post('/api/analyze/progress/:jobId', progressHandler);
```

### Success Criteria
- Users see initial results within 5 minutes
- Statistical preview 95% accurate within 30 minutes
- Clear processing time expectations set upfront
- Partial results available throughout processing
- Existing single-field analysis still works

---

## Priority 1: Sentiment-Driven Automation Triggers

### Overview
Simple rule-based system with immediate feedback on trigger configuration and testing.

### Implementation Guidance
**NEW component - no existing automation code**
- Build `RuleEngine` from scratch
- Create new database tables for rules and actions
- Integrate with existing notification systems if present

### User-Friendly Trigger Setup

#### Trigger Builder Interface
```
Create New Automation Rule:
┌─────────────────────────────────────────────────────────┐
│ When this happens...                                   │
│                                                         │
│ IF [Customer Lifetime Value ▼] [greater than ▼] [$1000]│
│ AND [Sentiment Score ▼] [drops below ▼] [40%]          │
│ AND [Last Order ▼] [was more than ▼] [30 days ago]     │
│                                                         │
│ Do this...                                              │
│                                                         │
│ ☑ Send email alert to: [account_manager@company.com]   │
│ ☑ Create task in CRM: ["High-value customer at risk"]  │
│ ☐ Send Slack message to: [#customer-success]           │
│ ☐ Add to campaign: [Win-back campaign ▼]               │
│                                                         │
│ Test this rule:                                         │
│ [Test with recent data] → "This would have triggered   │
│                           for 23 customers last month"  │
│                                                         │
│ [Save and Activate] [Save as Draft]                     │
└─────────────────────────────────────────────────────────┘
```

#### Trigger Testing & Preview
Before activating, show users exactly what will happen:

```
Test Results for Your Rule:
┌─────────────────────────────────────────────────────────┐
│ If activated, this rule would have:                    │
│                                                         │
│ 📧 Sent 23 email alerts last month                     │
│ 📋 Created 23 CRM tasks                                │
│                                                         │
│ Example matches:                                        │
│ • Customer #1234: $5,430 LTV, 35% sentiment, 45 days  │
│ • Customer #5678: $2,100 LTV, 28% sentiment, 67 days  │
│                                                         │
│ ⚠️ Preventing alert fatigue:                           │
│ Maximum 1 alert per customer per week                   │
│                                                         │
│ [Modify Rule] [Activate] [See All Matches]             │
└─────────────────────────────────────────────────────────┘
```

### Database Schema
```sql
-- New tables for triggers
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  conditions JSON,
  actions JSON,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trigger_executions (
  id UUID PRIMARY KEY,
  rule_id UUID REFERENCES automation_rules(id),
  triggered_at TIMESTAMP,
  customer_id VARCHAR(255),
  actions_taken JSON,
  success BOOLEAN
);
```

### Implementation
- Store rules in simple JSON format
- Test rules against last 30 days of data
- Show preview before activation
- Simple on/off toggle per rule
- Email summary of daily trigger activity
- Integrate with existing email/notification system

---

## Priority 2: Predictive Sentiment Trajectories

### Overview
Simple trend analysis with clear visual communication of predictions.

### Implementation Guidance
**NEW component with data from existing tables**
- Query existing sentiment history
- Build new `TrendCalculator` class
- Add prediction tables to existing schema
- Reuse existing charting library if present

### User-Friendly Predictions

#### Trajectory Dashboard
```
Sentiment Predictions:
┌─────────────────────────────────────────────────────────┐
│ Customer Sentiment Trends & Predictions                 │
│                                                         │
│ 100% ┤                                                  │
│      │     Historical        Predicted                  │
│  75% ┤········●······●·····│·····○·····○               │
│      │        ●      ●     │     ○     ○   High Risk   │
│  50% ┤        ●      ●     │     ○     ○   ← Alert     │
│      │               ●     │     ○                      │
│  25% ┤               ●     │     ○                      │
│      │                     │                            │
│   0% └─────────────────────┴──────────────────          │
│      -90d   -60d   -30d   Today  +30d  +60d            │
│                                                         │
│ ⚠️ 147 customers trending toward high risk              │
│    (Likely to drop below 40% in next 30 days)          │
│                                                         │
│ 📊 Confidence: 75% (based on 6 months of data)         │
│                                                         │
│ [View High Risk List] [Export Predictions]              │
│ [What drives these predictions?]                        │
└─────────────────────────────────────────────────────────┘
```

#### Clear Risk Communication
```
High Risk Customer Alert:
┌─────────────────────────────────────────────────────────┐
│ 🚨 Customer #1234 - ACME Corp                          │
│                                                         │
│ Current sentiment: 52%                                  │
│ Predicted in 30 days: 31% ⬇️                           │
│                                                         │
│ Why we think this:                                      │
│ • Sentiment declining 3% per week for 8 weeks          │
│ • Support tickets increased 300%                        │
│ • No purchases in 45 days (usually monthly)            │
│                                                         │
│ Recommended actions:                                    │
│ • Executive outreach within 5 days                      │
│ • Review recent support interactions                    │
│ • Consider service credit or gesture                    │
│                                                         │
│ [Take Action] [View Details] [Dismiss]                  │
└─────────────────────────────────────────────────────────┘
```

### Implementation Pattern
```javascript
// Use existing sentiment data
class TrendPredictor {
  constructor(existingDatabase) {
    this.db = existingDatabase;
  }
  
  async predictTrajectory(customerId) {
    // Query existing sentiment history
    const history = await this.db.query(
      'SELECT sentiment, date FROM results WHERE customer_id = ?',
      [customerId]
    );
    
    // Simple linear regression
    return this.calculateTrend(history);
  }
}
```

### Implementation
- Calculate simple linear trends
- Show confidence based on data density
- Focus on actionable timeframes (30-60 days)
- Clear visual indicators for risk levels
- Weekly email digest of predictions
- Batch process during off-hours

---

## Priority 3: Causal Analysis Engine

### Overview
Simple before/after analysis with clear visual communication of impacts.

### Implementation Guidance
**NEW component using existing data**
- Create event registry table
- Query existing sentiment data for analysis
- Build simple statistical comparison
- Reuse existing reporting infrastructure

### User-Friendly Causal Insights

#### Event Impact Dashboard
```
What Impacted Customer Sentiment?
┌─────────────────────────────────────────────────────────┐
│ We analyzed 5 major events from the last 6 months:     │
│                                                         │
│ 📈 Positive Impacts:                                    │
│                                                         │
│ ✓ Free Shipping Promotion (March 15)                   │
│   +12% sentiment improvement                            │
│   Affected: 2,340 customers                             │
│                                                         │
│ ✓ 24/7 Support Launch (April 1)                        │
│   +8% sentiment improvement                             │
│   Affected: All customers                               │
│                                                         │
│ 📉 Negative Impacts:                                    │
│                                                         │
│ ✗ Website Outage (May 3, 4 hours)                      │
│   -15% sentiment drop                                  │
│   Affected: 892 customers                               │
│   Recovery time: 3 weeks                                │
│                                                         │
│ ✗ Price Increase (June 1)                              │
│   -7% sentiment drop                                   │
│   Affected: All customers                               │
│   Still recovering                                      │
│                                                         │
│ [View Detailed Analysis] [Export Report]                │
└─────────────────────────────────────────────────────────┘
```

#### Simple Event Marking
```
Mark a Business Event:
┌─────────────────────────────────────────────────────────┐
│ Tell us about events that might impact sentiment:      │
│                                                         │
│ Event Type: [Product Launch ▼]                         │
│ Date: [June 15, 2024 📅]                               │
│ Affected Customers: [All ▼]                            │
│ Description: [New feature rollout - AI assistant]      │
│                                                         │
│ [Save Event]                                            │
│                                                         │
│ Recent Events:                                          │
│ • June 1: Price increase (analyzing...)                │
│ • May 3: Website outage ✓ (-15% impact)                │
│ • April 1: 24/7 support ✓ (+8% impact)                 │
└─────────────────────────────────────────────────────────┘
```

### Database Extension
```sql
-- Add to existing schema
CREATE TABLE business_events (
  id UUID PRIMARY KEY,
  event_type VARCHAR(50),
  event_date DATE,
  description TEXT,
  affected_customers JSON,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE event_impacts (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES business_events(id),
  impact_percentage FLOAT,
  customers_affected INT,
  calculated_at TIMESTAMP DEFAULT NOW()
);
```

### Implementation
- Simple before/after comparison (30 days each side)
- Clear visualization of impacts
- Focus on major events only
- Automatic significance testing
- Monthly impact report email
- Reuse existing statistical functions if available

---

## System Architecture & User Flow

### Complete User Journey
```
1. Upload & Expectations
   "Your 25GB file will take ~14 hours to fully process"
   [Get 5-min Preview] [Process Everything]
   
2. Quick Preview (5 minutes)
   "Here's what we found in the first 1,000 rows..."
   [Continue to Full Analysis] [Stop Here]
   
3. Progressive Updates
   Email every 2 hours: "Processing 35% complete..."
   Dashboard shows live progress and partial results
   
4. Completion & Actions
   "Analysis complete! 2,341 customers need attention"
   [View Results] [Set Up Automations] [Download Report]
```

### Clear Communication Templates

#### Upload Confirmation Email
```
Subject: Your analysis has started - first results in 5 minutes

Hi Sarah,

We've received your file "customer_data_2024.csv" (25GB) and started processing.

What happens next:
⚡ In 5 minutes: Quick preview of first 1,000 rows
📊 In 30 minutes: Statistical sample results (95% accurate)
✓ In 14 hours: Complete analysis of all 5 million rows

You can view live progress at: [dashboard link]

We'll email you at major milestones, or you can check the dashboard anytime for partial results.

Questions? Reply to this email or check our FAQ.
```

#### Progress Update Email
```
Subject: Analysis 35% complete - interesting findings emerging

Hi Sarah,

Quick update on your analysis:
- Processed: 1,750,000 of 5,000,000 rows (35%)
- Time remaining: ~8 hours
- Current sentiment: 😊 32% 😐 45% 😞 23%

Interesting finding: Negative sentiment is increasing in recent records. You might want to investigate Q4 2023 changes.

[View Partial Results] [Download Current Data]

We'll send the next update in 2 hours or when we hit 50%.
```

---

## Implementation Guidelines for Claude Code

### Core Principle
Build upon working code where possible. Only replace components when the existing architecture fundamentally conflicts with new requirements.

### What to Preserve and Extend

**1. DataCloak Integration** ✓ PRESERVE
- Wrap existing masking in a loop for multiple fields
- Reuse all security/validation logic
- Keep existing error handling

**2. File Upload & Storage** ✓ EXTEND
- Add progress event emitters
- Implement streaming for large files  
- Keep existing validation and storage paths

**3. Database Connections & Models** ✓ EXTEND
- Add new tables for triggers, predictions, events
- Add columns to existing tables where sensible
- Preserve existing relationships

**4. API Structure** ✓ EXTEND
- Keep existing endpoints for backwards compatibility
- Add new progressive endpoints alongside
- Reuse authentication and middleware

### What to Replace (Warranted)

**1. Processing Pipeline** ✗ REPLACE
- Current: Load entire file → Process → Show results
- Problem: No feedback for hours on large files
- Replace with: Progressive pipeline with sampling

**2. Field Selection UI** ✗ REPLACE
- Current: Radio button for single field
- Problem: Fundamentally single-field design
- Replace with: Multi-select with discovery

**3. Results Display** ✗ REPLACE  
- Current: Static results page after completion
- Problem: Users wait hours for any feedback
- Replace with: Live progress dashboard

### Code Review Checklist

Before replacing any component, verify:
- [ ] Does existing code fundamentally conflict with new requirements?
- [ ] Can the existing code be wrapped or extended instead?
- [ ] Are there security/validation features to preserve?
- [ ] Will replacement break backward compatibility?
- [ ] Is there a migration path for existing data?

### Migration Safety

#### Database Migrations
```sql
-- GOOD: Extend existing tables when possible
ALTER TABLE analysis_jobs 
ADD COLUMN fields_analyzed JSON,
ADD COLUMN preview_completed_at TIMESTAMP;

-- Only create new tables for truly new concepts
CREATE TABLE automation_triggers (...);
```

#### API Versioning
```javascript
// Support both old and new patterns
if (req.body.field) {
  // Legacy single-field support
  req.body.fields = [req.body.field];
}
// Process as multi-field
```

---

## Operational Simplicity

### For Users
- Upload → See preview in 5 min → Decide to continue
- Clear time estimates before committing
- Always have access to partial results
- Simple trigger setup with testing
- Visual predictions and impact analysis

### For Admins
- Single server architecture for <20 users
- Simple monitoring of queue depth
- Clear scaling triggers (wait times >1 hour)
- Easy addition of API keys when needed

### Resource Requirements
- 1 server (16 cores, 64GB RAM, 1TB storage)
- PostgreSQL for results
- Redis for queue management
- Basic monitoring with queue depth alerts

---

## Scaling Triggers

### When to Evolve Architecture
- **10-20 users**: Add smart sampling, Redis queuing
- **20+ users**: Multiple API keys, request routing
- **50+ users**: Full architectural redesign

### Current Limits
- 5-10 concurrent users: Smooth operation
- 10-20 users: Some queueing during peak
- 20+ users: Significant delays

---

## Success Metrics

### User Experience
- Initial insights within 5 minutes (100% achievement)
- Clear processing time expectations (90% accuracy)
- Partial results always available
- 90% user satisfaction with progressive approach

### Business Impact
- 50% reduction in "when will it be done?" support tickets
- 80% of users make decisions from statistical sample
- 10x ROI through automation triggers
- 30% faster time-to-insight overall

### Technical Performance
- Process 1,000 rows in 5 minutes
- Statistical sample (10K rows) in 30 minutes
- Full 1GB file in ~30 minutes (API limited)
- 99% uptime for handful of users

---

## Test Data Generation Requirements

### Overview
To properly validate each new feature, Claude Code must generate comprehensive synthetic test data that mimics real-world scenarios. This section provides specifications for creating test datasets that exercise all aspects of the system.

### General Test Data Principles

**Data Generation Requirements:**
- Reproducible: Use seeds for consistent generation
- Realistic: Follow actual business patterns
- Complete: Include edge cases and anomalies  
- Safe: No real PII, but realistic-looking data
- Documented: Clear metadata about each dataset

### Test Data Specifications by Feature

## 1. Multi-Field Discovery Test Data

### Dataset 1: E-commerce Standard
**Purpose**: Validate basic multi-field discovery and classification

**Generation Instructions**:
```
Filename: test_ecommerce_standard_10k.csv
Records: 10,000
Time Range: Last 18 months
Seed: 42
```

**Required Fields**:
- `customer_id`: Format CUST-XXXXX (sequential)
- `email`: test.userXXXXX@example.com 
- `phone`: (555) XXX-XXXX format
- `order_date`: Realistic distribution with weekly seasonality
- `product_review`: 70% populated, 10-500 words, varied sentiment
- `customer_comment`: 40% populated, complaint/praise mix
- `support_ticket`: 20% populated, technical issues
- `loyalty_status`: Silver/Gold/Platinum distribution
- `last_purchase_amount`: Log-normal $10-$1000

**Data Characteristics**:
- Natural missing data patterns (not random)
- Realistic text with sentiment indicators
- Temporal consistency (reviews after purchases)
- Some customers with multiple records

### Dataset 2: Field Naming Chaos
**Purpose**: Test discovery with inconsistent naming conventions

**Generation Instructions**:
```
Filename: test_field_chaos_5k.csv
Records: 5,000 (from 20 different "sources")
Sources: Each 250 records with different naming
```

**Field Variations to Generate**:
- Customer feedback: `feedback`, `cust_comments`, `userFeedback`, `customer_notes`, `comments_text`
- Product reviews: `review`, `prod_review`, `item_feedback`, `product_eval`, `merchandise_opinion`
- Email fields: `email`, `e_mail`, `email_address`, `customer_email`, `contact_email`
- Same underlying data, different column names per "source"

### Dataset 3: Healthcare Multi-Field
**Purpose**: Test domain-specific field discovery

**Generation Instructions**:
```
Filename: test_healthcare_8k.csv
Records: 8,000 patients
Time Range: 24 months
Include: Appointment history, clinical notes
```

**Required Fields**:
- `patient_id`: MRN-XXXXXXX format
- `visit_date`: Realistic appointment patterns
- `clinical_notes`: 60% populated, medical terminology
- `patient_feedback`: 30% populated, care experience
- `doctor_notes`: Brief assessments
- `appointment_type`: Routine/Follow-up/Emergency
- `no_show`: Boolean with 15% true rate

## 2. Automation Triggers Test Data

### Dataset 4: Trigger Scenario Generator
**Purpose**: Create scenarios that should fire triggers

**Generation Instructions**:
```
Filename: test_trigger_scenarios_20k.csv
Records: 20,000 (1,000 unique customers × 20 time periods)
Time Range: Last 6 months, weekly snapshots
```

**Required Scenarios**:
1. **Sentiment Decline** (200 customers)
   - Start at 80%+ sentiment
   - Gradual decline to <30% over 8 weeks
   - Include triggering events in comments

2. **Sudden Drop** (100 customers)
   - Stable 70% sentiment
   - Sudden drop to 20% in one week
   - Recovery attempts in subsequent weeks

3. **High-Value at Risk** (50 customers)
   - Order values >$1000
   - Sentiment declining + order frequency dropping
   - Support ticket increase

4. **False Positive Tests** (150 customers)
   - Temporary sentiment dips that recover
   - Seasonal patterns that look like decline
   - Single bad experience, otherwise happy

5. **Positive Triggers** (200 customers)
   - Sentiment jumps to 90%+
   - Recent large purchase
   - Referral behavior indicators

### Dataset 5: Action Outcome Data
**Purpose**: Test trigger effectiveness measurement

**Generation Instructions**:
```
Filename: test_trigger_outcomes_5k.csv
Records: 5,000 trigger executions
Include: Action taken, customer response, outcome
```

**Required Fields**:
- `trigger_id`: TRIG-XXXXXX
- `customer_id`: Links to scenario data
- `trigger_type`: Churn risk/Upsell opportunity/Support escalation
- `action_taken`: Email/Call/Offer/Escalation
- `customer_response`: Engaged/Ignored/Complained
- `outcome_30d`: Retained/Churned/Upgraded
- `revenue_impact`: -$X to +$X

## 3. Predictive Trajectories Test Data

### Dataset 6: Historical Sentiment Series
**Purpose**: Train and validate prediction models

**Generation Instructions**:
```
Filename: test_sentiment_history_50k.csv
Records: 50,000 (1,000 customers × 50 weeks)
Time Range: Last 12 months weekly
Pattern Types: Include various trajectories
```

**Required Patterns**:
1. **Linear Decline** (200 customers)
   - Steady decrease of 1-2% per week
   - Ends in churn at week 40-50

2. **Seasonal Patterns** (300 customers)
   - Holiday shopping peaks
   - Summer slowdowns
   - Back-to-school bumps

3. **Volatile but Stable** (200 customers)
   - High week-to-week variance
   - But stable long-term average

4. **Recovery Patterns** (150 customers)
   - Decline, intervention, then improvement
   - Various recovery speeds

5. **Cliff Drops** (150 customers)
   - Stable then sudden catastrophic drop
   - Different drop timings

**Additional Fields**:
- `week_number`: 1-50
- `sentiment_score`: 0-100
- `confidence`: 0.5-1.0
- `data_points`: Number of interactions that week
- `major_events`: Product launch/Outage/Holiday flags

### Dataset 7: Future Validation Set
**Purpose**: Test prediction accuracy

**Generation Instructions**:
```
Filename: test_future_outcomes_10k.csv
Records: 10,000 (200 customers × 50 weeks)
Split: Weeks 1-35 for training, 36-50 for validation
```

## 4. Causal Analysis Test Data

### Dataset 8: Event Impact Data
**Purpose**: Test causal relationship detection

**Generation Instructions**:
```
Filename: test_causal_events_30k.csv
Records: 30,000 events across 2,000 customers
Time Range: 12 months
Event Types: Natural experiments included
```

**Required Event Scenarios**:
1. **Price Change Impact**
   - 500 customers see 10% price increase at month 6
   - 500 control customers with no change
   - Sentiment and behavior tracked before/after

2. **Service Outage**
   - Regional outage affecting 300 customers
   - 4-hour downtime at month 4
   - Compare to unaffected regions

3. **Feature Launch**
   - New feature rolled out to 50% users
   - Adoption rates vary
   - Sentiment correlation with adoption

4. **Support Quality Change**
   - New support team for 200 customers
   - Different resolution times
   - Sentiment impact measurement

**Event Structure**:
- `event_id`: EVENT-XXXXXX
- `customer_id`: Links to customer
- `event_type`: Price/Outage/Feature/Support
- `event_date`: Timestamp
- `affected`: Boolean
- `pre_sentiment`: 30-day average before
- `post_sentiment`: 30-day average after
- `confounding_factors`: JSON of other variables

### Dataset 9: Complex Causal Chains
**Purpose**: Test multi-factor causal analysis

**Generation Instructions**:
```
Filename: test_causal_complex_15k.csv
Records: 15,000 (500 customers × 30 time periods)
Interactions: Multiple overlapping events
```

**Scenarios**:
- Customers experiencing 2-3 different events
- Interaction effects between events
- Time-delayed impacts
- Indirect causation chains

## 5. Integration Test Data

### Dataset 10: Full Pipeline Test
**Purpose**: End-to-end system validation

**Generation Instructions**:
```
Filename: test_integration_full_25k.csv
Records: 25,000 
Combines: All features in realistic scenario
```

**Characteristics**:
- Multiple text fields with varying quality
- Complete temporal history
- Triggerable scenarios embedded
- Known causal relationships
- Predictable future outcomes

**Validation Metrics**:
- Field discovery should find 8/10 text fields
- Triggers should fire for 150 customers
- Predictions should be 70%+ accurate
- Causal analysis should identify 3 major factors

### Test Data Generation Utilities

Claude Code should create a test data generation module with these capabilities:

**Core Generator Class**:
- `generateDataset(scenario, recordCount, seed)`
- `addTemporalProgression(baseData, weeks)`
- `injectAnomalies(data, percentage)`
- `createControlGroup(treatmentGroup)`

**Validation Tools**:
- `validateDataIntegrity(dataset)`
- `checkTemporalConsistency(dataset)`
- `measureRealism(dataset)`
- `generateDataReport(dataset)`

**Example Usage**:
```
# Generate all test datasets
./generate_test_data.sh --all --seed 42

# Generate specific scenario
./generate_test_data.sh --scenario trigger_scenarios --records 20000

# Validate generated data
./validate_test_data.sh --file test_trigger_scenarios_20k.csv
```

This comprehensive test data specification ensures each feature can be thoroughly validated with realistic scenarios that mirror production challenges.