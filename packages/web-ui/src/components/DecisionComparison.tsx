import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { clsx } from 'clsx';

interface Decision {
  id: string;
  component: string;
  fieldName?: string;
  confidence: number;
  reasoning: string;
  timestamp: string;
  details?: any;
}

interface DecisionComparisonProps {
  decisions: Decision[];
  onSelectDecision?: (decision: Decision) => void;
}

export const DecisionComparison: React.FC<DecisionComparisonProps> = ({
  decisions,
  onSelectDecision
}) => {
  const [selectedDecisions, setSelectedDecisions] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [comparisonMode, setComparisonMode] = useState<'side-by-side' | 'overlay'>('side-by-side');

  // Toggle decision selection
  const toggleDecision = (decisionId: string) => {
    setSelectedDecisions(prev => {
      if (prev.includes(decisionId)) {
        return prev.filter(id => id !== decisionId);
      }
      if (prev.length >= 3) {
        // Limit to 3 comparisons
        return [...prev.slice(1), decisionId];
      }
      return [...prev, decisionId];
    });
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Get selected decision objects
  const compareDecisions = selectedDecisions
    .map(id => decisions.find(d => d.id === id))
    .filter(Boolean) as Decision[];

  // Group decisions by field for easier comparison
  const groupedDecisions = decisions.reduce((acc, decision) => {
    const key = decision.fieldName || decision.component;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(decision);
    return acc;
  }, {} as Record<string, Decision[]>);

  // Calculate difference between two confidence values
  const getConfidenceDiff = (conf1: number, conf2: number) => {
    const diff = conf1 - conf2;
    const percentage = Math.abs(diff * 100);
    return {
      value: diff,
      percentage,
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same'
    };
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Decision Comparison</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {selectedDecisions.length}/3 selected
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDecisions([])}
                disabled={selectedDecisions.length === 0}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setComparisonMode(
                  comparisonMode === 'side-by-side' ? 'overlay' : 'side-by-side'
                )}
              >
                {comparisonMode === 'side-by-side' ? 'Overlay' : 'Side by Side'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select up to 3 decisions to compare. Click on decisions below to add them to the comparison.
          </p>

          {/* Decision Selection Grid */}
          <div className="space-y-4">
            {Object.entries(groupedDecisions).map(([group, groupDecisions]) => (
              <div key={group} className="border rounded-lg p-4">
                <button
                  onClick={() => toggleSection(group)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <h4 className="font-medium capitalize">{group.replace('_', ' ')}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {groupDecisions.length} decisions
                    </Badge>
                    {expandedSections[group] ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {expandedSections[group] && (
                  <div className="mt-3 grid gap-2">
                    {groupDecisions.map(decision => (
                      <button
                        key={decision.id}
                        onClick={() => toggleDecision(decision.id)}
                        className={clsx(
                          'p-3 rounded-lg border text-left transition-all',
                          selectedDecisions.includes(decision.id)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{decision.reasoning}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(decision.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <div className="ml-4 text-right">
                            <p className={clsx(
                              'text-lg font-bold',
                              decision.confidence >= 0.9 ? 'text-green-600' :
                              decision.confidence >= 0.7 ? 'text-yellow-600' : 'text-red-600'
                            )}>
                              {(decision.confidence * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison View */}
      {compareDecisions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparison Results</CardTitle>
          </CardHeader>
          <CardContent>
            {comparisonMode === 'side-by-side' ? (
              <div className="grid md:grid-cols-3 gap-4">
                {compareDecisions.map((decision, index) => (
                  <div key={decision.id} className="space-y-4">
                    {/* Decision Card */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className="capitalize">
                          {decision.component.replace('_', ' ')}
                        </Badge>
                        <button
                          onClick={() => onSelectDecision?.(decision)}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          View Details
                        </button>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {decision.reasoning}
                      </p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Confidence</span>
                          <span className={clsx(
                            'text-lg font-bold',
                            decision.confidence >= 0.9 ? 'text-green-600' :
                            decision.confidence >= 0.7 ? 'text-yellow-600' : 'text-red-600'
                          )}>
                            {(decision.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={decision.confidence * 100} />
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-3">
                        {new Date(decision.timestamp).toLocaleString()}
                      </p>
                    </div>

                    {/* Comparison with previous */}
                    {index > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                        <p className="text-xs font-medium mb-2">vs Previous</p>
                        {(() => {
                          const diff = getConfidenceDiff(
                            decision.confidence,
                            compareDecisions[index - 1].confidence
                          );
                          return (
                            <div className="flex items-center gap-2">
                              {diff.direction === 'up' ? (
                                <ArrowRight className="w-4 h-4 text-green-500 rotate-[-45deg]" />
                              ) : diff.direction === 'down' ? (
                                <ArrowRight className="w-4 h-4 text-red-500 rotate-[45deg]" />
                              ) : (
                                <ArrowRight className="w-4 h-4 text-gray-500" />
                              )}
                              <span className={clsx(
                                'text-sm font-medium',
                                diff.direction === 'up' ? 'text-green-600' :
                                diff.direction === 'down' ? 'text-red-600' : 'text-gray-600'
                              )}>
                                {diff.direction === 'up' ? '+' : diff.direction === 'down' ? '-' : ''}
                                {diff.percentage.toFixed(1)}%
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Overlay Mode */
              <div className="space-y-4">
                {/* Confidence Comparison Chart */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h4 className="font-medium mb-3">Confidence Levels</h4>
                  <div className="space-y-3">
                    {compareDecisions.map((decision, index) => (
                      <div key={decision.id} className="flex items-center gap-3">
                        <div className="w-24 text-sm">
                          Decision {index + 1}
                        </div>
                        <div className="flex-1">
                          <Progress 
                            value={decision.confidence * 100} 
                            className="h-6"
                          />
                        </div>
                        <span className="text-sm font-medium w-16 text-right">
                          {(decision.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Differences */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Key Differences</h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 text-blue-500" />
                      <div className="text-sm">
                        <p className="font-medium">Confidence Range</p>
                        <p className="text-gray-600 dark:text-gray-400">
                          {Math.min(...compareDecisions.map(d => d.confidence * 100)).toFixed(1)}% - 
                          {Math.max(...compareDecisions.map(d => d.confidence * 100)).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 text-yellow-500" />
                      <div className="text-sm">
                        <p className="font-medium">Time Span</p>
                        <p className="text-gray-600 dark:text-gray-400">
                          {(() => {
                            const times = compareDecisions.map(d => new Date(d.timestamp).getTime());
                            const span = Math.max(...times) - Math.min(...times);
                            const hours = Math.floor(span / (1000 * 60 * 60));
                            const minutes = Math.floor((span % (1000 * 60 * 60)) / (1000 * 60));
                            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decision Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Aspect</th>
                        {compareDecisions.map((_, index) => (
                          <th key={index} className="text-left py-2 px-4">
                            Decision {index + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 font-medium">Component</td>
                        {compareDecisions.map(d => (
                          <td key={d.id} className="py-2 px-4 capitalize">
                            {d.component.replace('_', ' ')}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 font-medium">Confidence</td>
                        {compareDecisions.map(d => (
                          <td key={d.id} className="py-2 px-4">
                            <span className={clsx(
                              'font-bold',
                              d.confidence >= 0.9 ? 'text-green-600' :
                              d.confidence >= 0.7 ? 'text-yellow-600' : 'text-red-600'
                            )}>
                              {(d.confidence * 100).toFixed(1)}%
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 font-medium">Time</td>
                        {compareDecisions.map(d => (
                          <td key={d.id} className="py-2 px-4 text-xs">
                            {new Date(d.timestamp).toLocaleTimeString()}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};