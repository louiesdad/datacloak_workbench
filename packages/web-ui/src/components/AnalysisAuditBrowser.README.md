# AnalysisAuditBrowser Component

## Overview

The AnalysisAuditBrowser is a comprehensive React component that provides users with transparency into the analysis decision-making process. It displays a hierarchical view of all decisions made during data analysis, including field detection, PII masking, sentiment analysis, and confidence tracking.

## Features

### 1. **Decision Tree Visualization**
- Expandable/collapsible decision nodes
- Color-coded confidence levels (green for high, yellow for medium, red for low)
- Component-specific icons for easy identification
- Timestamp display for each decision

### 2. **Filtering and Search**
- Filter by component type (Field Detection, PII Masking, Sentiment Analysis, Confidence Tracking)
- Real-time search across decision reasoning, input, and output
- Quick filter buttons for rapid navigation

### 3. **Session Summary**
- Total decisions count
- Average confidence score
- Low/high confidence counts
- Component-wise decision breakdown

### 4. **Detailed Decision Views**
Each decision type has a specialized detail view:

#### Field Detection Details
- Heuristic scores visualization (pattern match, sample analysis, statistical features)
- GPT enhancement information if used
- Decision factors explaining why a type was detected
- Anonymized sample tokens

#### PII Masking Details
- Detected patterns with match counts
- Masking strategy and reasoning
- Risk assessment with sensitivity levels
- Compliance framework badges

#### Sentiment Analysis Details
- Model selection reasoning
- Token usage and cost breakdown
- Confidence factors visualization
- Performance metrics

#### Confidence Tracking Details
- Component-wise confidence scores
- Aggregation method used
- Reliability score
- Configured thresholds

### 5. **Question This Result Feature**
- Click the help icon on any decision to ask questions
- AI-powered explanations for specific decisions
- Context-aware responses based on decision details

## Usage

```tsx
import { AnalysisAuditBrowser } from './components/AnalysisAuditBrowser';

function MyComponent() {
  const handleQuestionDecision = async (decisionId: string, question: string) => {
    // Handle the question - typically send to backend API
    const response = await api.questionDecision(decisionId, question);
    console.log(response.explanation);
  };

  return (
    <AnalysisAuditBrowser
      sessionId="current-session-id"
      onQuestionDecision={handleQuestionDecision}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | No | The analysis session ID to display. If not provided, shows the current session |
| `onQuestionDecision` | `(decisionId: string, question: string) => void` | No | Callback when user questions a decision |

## API Integration

The component expects the following API endpoints:

- `GET /api/v1/audit/decisions` - Get all decision logs
- `GET /api/v1/audit/session-summary` - Get session summary statistics
- `GET /api/v1/audit/field-detections` - Get field detection details
- `GET /api/v1/audit/pii-masking` - Get PII masking details
- `GET /api/v1/audit/sentiment-analysis` - Get sentiment analysis details
- `GET /api/v1/audit/confidence-tracking` - Get confidence tracking details
- `POST /api/v1/audit/question/:decisionId` - Question a specific decision

## Styling

The component uses:
- Tailwind CSS for styling
- Dark mode support with `dark:` prefixes
- Custom UI components (Card, Button, Badge, Progress)
- Responsive design with mobile-first approach

## Performance Considerations

- Decisions are loaded on-demand when expanded
- Details are cached after first load
- Search and filter operations are performed client-side
- Supports large decision histories with virtualization-ready structure

## Accessibility

- Keyboard navigation support
- ARIA labels for interactive elements
- Clear focus indicators
- Screen reader friendly structure

## Example Integration

See `AnalysisTransparencyPage.tsx` for a complete example of integrating the AnalysisAuditBrowser into a full page view with navigation and question handling.

## Testing

The component includes comprehensive tests in `__tests__/AnalysisAuditBrowser.test.tsx` covering:
- Loading states
- Filtering and search functionality
- Decision expansion and detail loading
- Question functionality
- Error handling
- Empty states

## Future Enhancements

1. **Export Functionality**: Export decision history as PDF/CSV
2. **Comparison View**: Compare decisions across different sessions
3. **Trend Analysis**: Visualize confidence trends over time
4. **Batch Operations**: Question multiple decisions at once
5. **Real-time Updates**: WebSocket integration for live decision streaming