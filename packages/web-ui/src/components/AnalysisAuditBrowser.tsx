import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Search, Filter, HelpCircle, AlertCircle, CheckCircle, Info, BarChart3, FileText, Shield, Brain, GitBranch, Clock, Layers } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Progress } from './ui/Progress';
import type { 
  DecisionLog,
  FieldDetectionDecision,
  PIIMaskingDecision,
  SentimentAnalysisDecision,
  ConfidenceTracking,
  SessionSummary
} from '../services/analysisAuditService';
import { analysisAuditService } from '../services/analysisAuditService';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { clsx } from 'clsx';
import { QuestionDecisionModal } from './QuestionDecisionModal';
import { DecisionFlowChart } from './DecisionFlowChart';
import { ConfidenceTimeline } from './ConfidenceTimeline';
import { DecisionComparison } from './DecisionComparison';

interface AnalysisAuditBrowserProps {
  sessionId?: string;
  onQuestionDecision?: (decisionId: string, question: string) => void;
}

type FilterComponent = 'all' | 'field_detection' | 'pii_masking' | 'sentiment_analysis' | 'confidence_tracking';
type ExpandedState = Record<string, boolean>;

export const AnalysisAuditBrowser: React.FC<AnalysisAuditBrowserProps> = ({
  sessionId,
  onQuestionDecision
}) => {
  const [decisions, setDecisions] = useState<DecisionLog[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterComponent>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDecisions, setExpandedDecisions] = useState<ExpandedState>({});
  const [selectedDecision, setSelectedDecision] = useState<DecisionLog | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<'tree' | 'flow' | 'timeline' | 'compare'>('tree');
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  
  const { handleApiError } = useApiErrorHandler();

  // Load decision history
  const loadDecisions = useCallback(async () => {
    try {
      setLoading(true);
      const [decisionHistory, summary] = await Promise.all([
        analysisAuditService.getDecisionHistory(sessionId),
        analysisAuditService.getSessionSummary(sessionId)
      ]);
      
      setDecisions(decisionHistory);
      setSessionSummary(summary);
    } catch (error) {
      handleApiError(error, {
        operation: 'loading decision history',
        component: 'AnalysisAuditBrowser'
      });
    } finally {
      setLoading(false);
    }
  }, [sessionId, handleApiError]);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  // Load detailed decision data
  const loadDecisionDetails = useCallback(async (decision: DecisionLog) => {
    if (detailsCache[decision.id]) {
      return detailsCache[decision.id];
    }

    try {
      let details;
      switch (decision.component) {
        case 'field_detection':
          const fieldDetections = await analysisAuditService.getFieldDetectionDecisions(sessionId);
          details = fieldDetections.find(d => d.fieldName === decision.input?.fieldName);
          break;
        case 'pii_masking':
          const piiDecisions = await analysisAuditService.getPIIMaskingDecisions(sessionId);
          details = piiDecisions.find(d => d.fieldName === decision.input?.fieldName);
          break;
        case 'sentiment_analysis':
          const sentimentDecisions = await analysisAuditService.getSentimentAnalysisDecisions(sessionId);
          details = sentimentDecisions.find(d => d.textSample === decision.input?.textSample);
          break;
        case 'confidence_tracking':
          const confidenceData = await analysisAuditService.getConfidenceTracking(sessionId);
          details = confidenceData[0]; // Most recent
          break;
      }
      
      if (details) {
        setDetailsCache(prev => ({ ...prev, [decision.id]: details }));
      }
      return details;
    } catch (error) {
      handleApiError(error, {
        operation: 'loading decision details',
        component: 'AnalysisAuditBrowser'
      });
      return null;
    }
  }, [sessionId, detailsCache, handleApiError]);

  // Toggle decision expansion
  const toggleDecision = useCallback(async (decisionId: string) => {
    const decision = decisions.find(d => d.id === decisionId);
    if (decision && !detailsCache[decisionId]) {
      await loadDecisionDetails(decision);
    }
    
    setExpandedDecisions(prev => ({
      ...prev,
      [decisionId]: !prev[decisionId]
    }));
  }, [decisions, detailsCache, loadDecisionDetails]);

  // Filter decisions
  const filteredDecisions = decisions.filter(decision => {
    const matchesFilter = filter === 'all' || decision.component === filter;
    const matchesSearch = !searchTerm || 
      decision.reasoning.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(decision.input).toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(decision.output).toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  // Get component icon
  const getComponentIcon = (component: string) => {
    switch (component) {
      case 'field_detection':
        return <FileText className="w-4 h-4" />;
      case 'pii_masking':
        return <Shield className="w-4 h-4" />;
      case 'sentiment_analysis':
        return <Brain className="w-4 h-4" />;
      case 'confidence_tracking':
        return <BarChart3 className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Handle question action
  const handleQuestionDecision = (decision: DecisionLog) => {
    setSelectedDecision(decision);
    setShowQuestionModal(true);
  };

  // Handle question submission
  const handleSubmitQuestion = async (decisionId: string, question: string) => {
    if (onQuestionDecision) {
      return onQuestionDecision(decisionId, question);
    }
    
    // Default implementation if no handler provided
    try {
      const response = await analysisAuditService.questionDecision(decisionId, question);
      return {
        explanation: response.explanation,
        additionalContext: response.additionalContext
      };
    } catch (error) {
      handleApiError(error, {
        operation: 'questioning decision',
        component: 'AnalysisAuditBrowser'
      });
      throw error;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      {sessionSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Session Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Decisions</p>
                <p className="text-2xl font-bold">{sessionSummary.totalDecisions}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Confidence</p>
                <p className={clsx('text-2xl font-bold', getConfidenceColor(sessionSummary.averageConfidence))}>
                  {(sessionSummary.averageConfidence * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Low Confidence</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {sessionSummary.lowConfidenceCount}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">High Confidence</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {sessionSummary.highConfidenceCount}
                </p>
              </div>
            </div>
            
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Field Detection</span>
                <span className="text-sm font-medium">{sessionSummary.components.field_detection}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">PII Masking</span>
                <span className="text-sm font-medium">{sessionSummary.components.pii_masking}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Sentiment Analysis</span>
                <span className="text-sm font-medium">{sessionSummary.components.sentiment_analysis}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Confidence Tracking</span>
                <span className="text-sm font-medium">{sessionSummary.components.confidence_tracking}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Mode Selector and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* View Mode Buttons */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={viewMode === 'tree' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('tree')}
              >
                <Layers className="w-4 h-4 mr-1" />
                Decision Tree
              </Button>
              <Button
                variant={viewMode === 'flow' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('flow')}
              >
                <GitBranch className="w-4 h-4 mr-1" />
                Flow Chart
              </Button>
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('timeline')}
              >
                <Clock className="w-4 h-4 mr-1" />
                Timeline
              </Button>
              <Button
                variant={viewMode === 'compare' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('compare')}
              >
                <BarChart3 className="w-4 h-4 mr-1" />
                Compare
              </Button>
            </div>

            {/* Search and Filter */}
            {viewMode === 'tree' && (
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search decisions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800"
                    />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                  >
                    All
                  </Button>
                  <Button
                    variant={filter === 'field_detection' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('field_detection')}
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Fields
                  </Button>
                  <Button
                    variant={filter === 'pii_masking' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('pii_masking')}
                  >
                    <Shield className="w-4 h-4 mr-1" />
                    PII
                  </Button>
                  <Button
                    variant={filter === 'sentiment_analysis' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('sentiment_analysis')}
                  >
                    <Brain className="w-4 h-4 mr-1" />
                    Sentiment
                  </Button>
                  <Button
                    variant={filter === 'confidence_tracking' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('confidence_tracking')}
                  >
                    <BarChart3 className="w-4 h-4 mr-1" />
                    Confidence
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content based on view mode */}
      {viewMode === 'tree' && (
        <Card>
          <CardHeader>
            <CardTitle>Decision History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredDecisions.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No decisions found matching your criteria
                </p>
              ) : (
                filteredDecisions.map((decision) => (
                  <DecisionNode
                    key={decision.id}
                    decision={decision}
                    details={detailsCache[decision.id]}
                    expanded={expandedDecisions[decision.id] || false}
                    onToggle={() => toggleDecision(decision.id)}
                    onQuestion={() => handleQuestionDecision(decision)}
                    getComponentIcon={getComponentIcon}
                    getConfidenceColor={getConfidenceColor}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'flow' && (
        <DecisionFlowChart 
          decisions={decisions}
          onNodeClick={(nodeId) => {
            const decision = decisions.find(d => d.id === nodeId);
            if (decision) {
              handleQuestionDecision(decision);
            }
          }}
        />
      )}

      {viewMode === 'timeline' && (
        <ConfidenceTimeline 
          decisions={decisions}
          onPointClick={(data) => {
            // Find decision closest to clicked time
            const clickedTime = new Date(data.activePayload?.[0]?.payload.timestamp);
            const closestDecision = decisions.reduce((closest, decision) => {
              const decisionTime = new Date(decision.timestamp);
              const currentDiff = Math.abs(clickedTime.getTime() - decisionTime.getTime());
              const closestDiff = closest ? Math.abs(clickedTime.getTime() - new Date(closest.timestamp).getTime()) : Infinity;
              return currentDiff < closestDiff ? decision : closest;
            }, null as DecisionLog | null);
            
            if (closestDecision) {
              handleQuestionDecision(closestDecision);
            }
          }}
        />
      )}

      {viewMode === 'compare' && (
        <DecisionComparison 
          decisions={decisions}
          onSelectDecision={(decision) => {
            handleQuestionDecision(decision as DecisionLog);
          }}
        />
      )}

      {/* Question Decision Modal */}
      <QuestionDecisionModal
        isOpen={showQuestionModal}
        onClose={() => {
          setShowQuestionModal(false);
          setSelectedDecision(null);
        }}
        decision={selectedDecision}
        onSubmitQuestion={handleSubmitQuestion}
      />
    </div>
  );
};

// Decision Node Component
interface DecisionNodeProps {
  decision: DecisionLog;
  details?: any;
  expanded: boolean;
  onToggle: () => void;
  onQuestion: () => void;
  getComponentIcon: (component: string) => React.ReactNode;
  getConfidenceColor: (confidence: number) => string;
}

const DecisionNode: React.FC<DecisionNodeProps> = ({
  decision,
  details,
  expanded,
  onToggle,
  onQuestion,
  getComponentIcon,
  getConfidenceColor
}) => {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
      <div
        className="flex items-center p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={onToggle}
      >
        <div className="mr-2">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
        <div className="mr-3">{getComponentIcon(decision.component)}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium capitalize">
              {decision.component.replace('_', ' ')}
            </span>
            <Badge variant="outline" className="text-xs">
              {decision.stage}
            </Badge>
            <span className={clsx('text-sm', getConfidenceColor(decision.confidence))}>
              {(decision.confidence * 100).toFixed(1)}%
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {decision.reasoning}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {new Date(decision.timestamp).toLocaleTimeString()}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onQuestion();
            }}
            title="Question this decision"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
          <DecisionDetails decision={decision} details={details} />
        </div>
      )}
    </div>
  );
};

// Decision Details Component
interface DecisionDetailsProps {
  decision: DecisionLog;
  details?: any;
}

const DecisionDetails: React.FC<DecisionDetailsProps> = ({ decision, details }) => {
  if (!details) {
    return <div className="text-sm text-gray-500">Loading details...</div>;
  }

  switch (decision.component) {
    case 'field_detection':
      return <FieldDetectionDetails details={details as FieldDetectionDecision} />;
    case 'pii_masking':
      return <PIIMaskingDetails details={details as PIIMaskingDecision} />;
    case 'sentiment_analysis':
      return <SentimentAnalysisDetails details={details as SentimentAnalysisDecision} />;
    case 'confidence_tracking':
      return <ConfidenceTrackingDetails details={details as ConfidenceTracking} />;
    default:
      return <pre className="text-xs">{JSON.stringify(details, null, 2)}</pre>;
  }
};

// Field Detection Details
const FieldDetectionDetails: React.FC<{ details: FieldDetectionDecision }> = ({ details }) => (
  <div className="space-y-4">
    <div>
      <h4 className="font-medium mb-2">Heuristic Scores</h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Pattern Match: <Progress value={details.heuristicScores.pattern_match * 100} className="mt-1" /></div>
        <div>Sample Analysis: <Progress value={details.heuristicScores.sample_analysis * 100} className="mt-1" /></div>
        <div>Statistical Features: <Progress value={details.heuristicScores.statistical_features * 100} className="mt-1" /></div>
        <div>GPT Enhancement: <Progress value={details.heuristicScores.gpt_enhancement * 100} className="mt-1" /></div>
      </div>
    </div>
    
    {details.gptEnhancement.used && (
      <div>
        <h4 className="font-medium mb-2">GPT Enhancement</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">{details.gptEnhancement.reasoning}</p>
        <p className="text-xs text-gray-500 mt-1">Tokens used: {details.gptEnhancement.tokens_used}</p>
      </div>
    )}
    
    <div>
      <h4 className="font-medium mb-2">Decision Factors</h4>
      <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
        {details.decision_factors.map((factor, i) => (
          <li key={i}>{factor}</li>
        ))}
      </ul>
    </div>
    
    <div>
      <h4 className="font-medium mb-2">Sample Tokens</h4>
      <div className="flex flex-wrap gap-2">
        {details.sampleTokens.safe_samples.slice(0, 5).map((sample, i) => (
          <Badge key={i} variant="outline" className="text-xs">{sample}</Badge>
        ))}
      </div>
    </div>
  </div>
);

// PII Masking Details
const PIIMaskingDetails: React.FC<{ details: PIIMaskingDecision }> = ({ details }) => (
  <div className="space-y-4">
    <div>
      <h4 className="font-medium mb-2">Detected Patterns</h4>
      <div className="space-y-2">
        {details.patterns.map((pattern, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span>{pattern.pattern_id}</span>
            <div className="flex items-center gap-2">
              <span>{pattern.matches_found} matches</span>
              <Badge variant="outline" className="text-xs">
                {(pattern.confidence * 100).toFixed(0)}%
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
    
    <div>
      <h4 className="font-medium mb-2">Masking Strategy</h4>
      <p className="text-sm"><strong>Type:</strong> {details.maskingStrategy.type}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">{details.maskingStrategy.reasoning}</p>
    </div>
    
    <div>
      <h4 className="font-medium mb-2">Risk Assessment</h4>
      <div className="flex items-center gap-2">
        <Badge 
          variant={details.riskAssessment.sensitivity_level === 'critical' ? 'destructive' : 'outline'}
          className="capitalize"
        >
          {details.riskAssessment.sensitivity_level}
        </Badge>
        {details.riskAssessment.compliance_frameworks.map((framework, i) => (
          <Badge key={i} variant="secondary" className="text-xs">{framework}</Badge>
        ))}
      </div>
    </div>
  </div>
);

// Sentiment Analysis Details
const SentimentAnalysisDetails: React.FC<{ details: SentimentAnalysisDecision }> = ({ details }) => (
  <div className="space-y-4">
    <div>
      <h4 className="font-medium mb-2">Model Selection</h4>
      <p className="text-sm"><strong>Selected:</strong> {details.modelSelection.selected_model}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">{details.modelSelection.selection_reasoning}</p>
    </div>
    
    <div>
      <h4 className="font-medium mb-2">Token Usage</h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Prompt Tokens: {details.tokenUsage.prompt_tokens}</div>
        <div>Completion Tokens: {details.tokenUsage.completion_tokens}</div>
        <div>Total Tokens: {details.tokenUsage.total_tokens}</div>
        <div>Estimated Cost: ${details.tokenUsage.estimated_cost.toFixed(4)}</div>
      </div>
    </div>
    
    <div>
      <h4 className="font-medium mb-2">Confidence Factors</h4>
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>Text Clarity</span>
          <Progress value={details.confidenceFactors.text_clarity * 100} className="w-32" />
        </div>
        <div className="flex justify-between text-sm">
          <span>Context Adequacy</span>
          <Progress value={details.confidenceFactors.context_adequacy * 100} className="w-32" />
        </div>
        <div className="flex justify-between text-sm">
          <span>Model Certainty</span>
          <Progress value={details.confidenceFactors.model_certainty * 100} className="w-32" />
        </div>
      </div>
    </div>
  </div>
);

// Confidence Tracking Details
const ConfidenceTrackingDetails: React.FC<{ details: ConfidenceTracking }> = ({ details }) => (
  <div className="space-y-4">
    <div>
      <h4 className="font-medium mb-2">Component Confidences</h4>
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>Field Detection</span>
          <Progress value={details.component_confidences.field_detection * 100} className="w-32" />
        </div>
        <div className="flex justify-between text-sm">
          <span>PII Detection</span>
          <Progress value={details.component_confidences.pii_detection * 100} className="w-32" />
        </div>
        <div className="flex justify-between text-sm">
          <span>Sentiment Analysis</span>
          <Progress value={details.component_confidences.sentiment_analysis * 100} className="w-32" />
        </div>
        <div className="flex justify-between text-sm">
          <span>Data Quality</span>
          <Progress value={details.component_confidences.data_quality * 100} className="w-32" />
        </div>
      </div>
    </div>
    
    <div>
      <h4 className="font-medium mb-2">Aggregation</h4>
      <p className="text-sm">Method: {details.aggregation_method}</p>
      <p className="text-sm">Reliability Score: {(details.reliability_score * 100).toFixed(1)}%</p>
    </div>
    
    <div>
      <h4 className="font-medium mb-2">Thresholds</h4>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Minimum</span>
          <p>{(details.thresholds.minimum_confidence * 100).toFixed(0)}%</p>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Warning</span>
          <p>{(details.thresholds.warning_threshold * 100).toFixed(0)}%</p>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Review</span>
          <p>{(details.thresholds.review_threshold * 100).toFixed(0)}%</p>
        </div>
      </div>
    </div>
  </div>
);

export default AnalysisAuditBrowser;