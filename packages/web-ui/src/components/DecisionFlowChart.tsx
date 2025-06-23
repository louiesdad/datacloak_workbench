import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  ArrowRight, 
  FileText, 
  Shield, 
  Brain, 
  BarChart3,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { clsx } from 'clsx';

interface DecisionNode {
  id: string;
  type: 'field_detection' | 'pii_masking' | 'sentiment_analysis' | 'confidence_tracking';
  label: string;
  confidence: number;
  status: 'success' | 'warning' | 'error';
  details?: any;
  children?: DecisionNode[];
}

interface DecisionFlowChartProps {
  decisions: any[];
  onNodeClick?: (nodeId: string) => void;
}

export const DecisionFlowChart: React.FC<DecisionFlowChartProps> = ({
  decisions,
  onNodeClick
}) => {
  // Transform decisions into a flow chart structure
  const flowData = useMemo(() => {
    const nodes: DecisionNode[] = [];
    const nodeMap = new Map<string, DecisionNode>();

    // Group decisions by component and create hierarchy
    const grouped = decisions.reduce((acc, decision) => {
      if (!acc[decision.component]) {
        acc[decision.component] = [];
      }
      acc[decision.component].push(decision);
      return acc;
    }, {} as Record<string, any[]>);

    // Create nodes for each component
    Object.entries(grouped).forEach(([component, componentDecisions]) => {
      const parentNode: DecisionNode = {
        id: `${component}-parent`,
        type: component as any,
        label: component.replace('_', ' ').split(' ').map((w: string) => 
          w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' '),
        confidence: componentDecisions.reduce((sum, d) => sum + d.confidence, 0) / componentDecisions.length,
        status: componentDecisions.some(d => d.confidence < 0.7) ? 'warning' : 'success',
        children: componentDecisions.map(decision => ({
          id: decision.id,
          type: component as any,
          label: decision.reasoning.substring(0, 50) + '...',
          confidence: decision.confidence,
          status: decision.confidence >= 0.9 ? 'success' : 
                  decision.confidence >= 0.7 ? 'warning' : 'error',
          details: decision
        }))
      };
      
      nodes.push(parentNode);
      nodeMap.set(parentNode.id, parentNode);
    });

    return nodes;
  }, [decisions]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'field_detection':
        return <FileText className="w-5 h-5" />;
      case 'pii_masking':
        return <Shield className="w-5 h-5" />;
      case 'sentiment_analysis':
        return <Brain className="w-5 h-5" />;
      case 'confidence_tracking':
        return <BarChart3 className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getNodeColor = (node: DecisionNode) => {
    const colors = {
      field_detection: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
      pii_masking: 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20',
      sentiment_analysis: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
      confidence_tracking: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20'
    };
    return colors[node.type] || 'border-gray-200 bg-gray-50';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision Flow Visualization</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {flowData.map((node, index) => (
            <div key={node.id} className="relative">
              {/* Parent Node */}
              <div 
                className={clsx(
                  'border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg',
                  getNodeColor(node)
                )}
                onClick={() => onNodeClick?.(node.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getIcon(node.type)}
                    <div>
                      <h4 className="font-medium text-lg">{node.label}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {node.children?.length || 0} decisions
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Avg Confidence</p>
                      <p className={clsx(
                        'text-lg font-bold',
                        node.confidence >= 0.9 ? 'text-green-600' :
                        node.confidence >= 0.7 ? 'text-yellow-600' : 'text-red-600'
                      )}>
                        {(node.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                    {getStatusIcon(node.status)}
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-3">
                  <Progress value={node.confidence * 100} className="h-2" />
                </div>
              </div>

              {/* Child Nodes */}
              {node.children && node.children.length > 0 && (
                <div className="ml-8 mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-gray-500">
                    <ArrowRight className="w-4 h-4" />
                    <span className="text-sm">Individual Decisions</span>
                  </div>
                  <div className="grid gap-2">
                    {node.children.slice(0, 3).map(child => (
                      <div
                        key={child.id}
                        className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => onNodeClick?.(child.id)}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm">{child.label}</p>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={child.status === 'success' ? 'default' : 
                                      child.status === 'warning' ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {(child.confidence * 100).toFixed(0)}%
                            </Badge>
                            {getStatusIcon(child.status)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {node.children.length > 3 && (
                      <p className="text-sm text-gray-500 text-center py-2">
                        +{node.children.length - 3} more decisions
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Connector to next component */}
              {index < flowData.length - 1 && (
                <div className="flex justify-center my-4">
                  <ArrowRight className="w-6 h-6 text-gray-400 rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};