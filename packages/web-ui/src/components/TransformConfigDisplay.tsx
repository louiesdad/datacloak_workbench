import React, { useState, useMemo } from 'react';
import type { TransformPipeline, TransformOperation } from '../types/transforms';
import { ApiErrorDisplay } from './ApiErrorDisplay';
import { useApiErrorHandler, type ApiError } from '../hooks/useApiErrorHandler';
import './TransformConfigDisplay.css';

interface TransformConfigDisplayProps {
  pipeline: TransformPipeline;
  onRemoveOperation?: (operationId: string) => void;
  onEditOperation?: (operationId: string) => void;
  onSavePipeline?: (pipeline: TransformPipeline) => Promise<void>;
  onLoadPipeline?: (pipelineId: string) => Promise<TransformPipeline>;
  savedPipelines?: Array<{ id: string; name: string; operations: TransformOperation[]; modified: Date }>;
  className?: string;
}

export const TransformConfigDisplay: React.FC<TransformConfigDisplayProps> = ({
  pipeline,
  onRemoveOperation,
  onEditOperation,
  onSavePipeline,
  onLoadPipeline,
  savedPipelines = [],
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const { handleApiError } = useApiErrorHandler();

  // Calculate pipeline statistics
  const pipelineStats = useMemo(() => {
    const enabledOps = pipeline.operations.filter(op => op.enabled);
    const disabledOps = pipeline.operations.filter(op => !op.enabled);
    
    const operationTypes = enabledOps.reduce((acc, op) => {
      acc[op.type] = (acc[op.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOperations: pipeline.operations.length,
      enabledOperations: enabledOps.length,
      disabledOperations: disabledOps.length,
      operationTypes,
      lastModified: pipeline.modified,
      isUnsaved: !pipeline.id || pipeline.modified > (pipeline.created || new Date())
    };
  }, [pipeline]);

  const handleSavePipeline = async () => {
    if (!onSavePipeline) return;
    
    setIsSaving(true);
    setApiError(null);
    try {
      await onSavePipeline(pipeline);
    } catch (error) {
      const apiError = handleApiError(error, {
        operation: 'save transform pipeline',
        component: 'TransformConfigDisplay',
        userMessage: 'Failed to save transform configuration'
      });
      setApiError(apiError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadPipeline = async (pipelineId: string) => {
    if (!onLoadPipeline || !pipelineId) return;

    setApiError(null);
    try {
      await onLoadPipeline(pipelineId);
      setSelectedPipelineId('');
    } catch (error) {
      const apiError = handleApiError(error, {
        operation: 'load transform pipeline',
        component: 'TransformConfigDisplay',
        userMessage: 'Failed to load transform configuration'
      });
      setApiError(apiError);
    }
  };

  const getOperationIcon = (type: TransformOperation['type']): string => {
    const icons: Record<string, string> = {
      filter: '🔍',
      sort: '🔢',
      select: '✅',
      rename: '🔤',
      compute: '🧮',
      aggregate: '📊',
      join: '🔗',
      deduplicate: '🗂️'
    };
    return icons[type] || '⚙️';
  };

  const getOperationSummary = (operation: TransformOperation): string => {
    switch (operation.type) {
      case 'filter':
        const filterConfig = operation.config as any;
        return `${filterConfig.field} ${filterConfig.operator} "${filterConfig.value}"`;
      
      case 'sort':
        const sortConfig = operation.config as any;
        const fields = sortConfig.fields || [];
        return fields.map((f: any) => `${f.field} (${f.direction})`).join(', ');
      
      case 'select':
        const selectConfig = operation.config as any;
        const selectedFields = selectConfig.fields || [];
        return selectedFields.length > 0 ? `${selectedFields.length} fields` : 'No fields selected';
      
      case 'rename':
        const renameConfig = operation.config as any;
        const mappings = renameConfig.mappings || [];
        return mappings.map((m: any) => `${m.oldName} → ${m.newName}`).join(', ');
      
      case 'compute':
        const computeConfig = operation.config as any;
        return `${computeConfig.newField} = ${computeConfig.expression}`;
      
      case 'aggregate':
        const aggConfig = operation.config as any;
        const groupBy = aggConfig.groupBy || [];
        const aggregations = aggConfig.aggregations || [];
        return `Group by: ${groupBy.join(', ')}, Aggs: ${aggregations.length}`;
      
      case 'join':
        const joinConfig = operation.config as any;
        return `${joinConfig.type} join with ${joinConfig.rightTable}`;
      
      case 'deduplicate':
        const dedupConfig = operation.config as any;
        return dedupConfig.keepFirst ? 'Keep first occurrence' : 'Keep last occurrence';
      
      default:
        return 'No configuration';
    }
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className={`transform-config-display ${className}`}>
      <div className="config-header">
        <div className="header-left">
          <button
            className="expand-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <h3 className="config-title">
            Transform Configuration
            {pipelineStats.isUnsaved && <span className="unsaved-indicator">*</span>}
          </h3>
        </div>
        
        <div className="header-stats">
          <span className="stat">
            {pipelineStats.enabledOperations} active
          </span>
          {pipelineStats.disabledOperations > 0 && (
            <span className="stat disabled">
              {pipelineStats.disabledOperations} disabled
            </span>
          )}
          <span className="last-modified">
            Modified: {formatDate(pipelineStats.lastModified)}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="config-content">
          {/* Pipeline Actions */}
          <div className="pipeline-actions">
            <div className="action-group">
              {onSavePipeline && (
                <button
                  className="action-button primary"
                  onClick={handleSavePipeline}
                  disabled={isSaving || !pipelineStats.isUnsaved}
                  title="Save current pipeline configuration"
                >
                  {isSaving ? '💾 Saving...' : '💾 Save Pipeline'}
                </button>
              )}
              
              {savedPipelines.length > 0 && onLoadPipeline && (
                <div className="load-pipeline">
                  <select
                    value={selectedPipelineId}
                    onChange={(e) => setSelectedPipelineId(e.target.value)}
                    className="pipeline-selector"
                  >
                    <option value="">Load saved pipeline...</option>
                    {savedPipelines.map(saved => (
                      <option key={saved.id} value={saved.id}>
                        {saved.name} ({saved.operations.length} ops) - {formatDate(saved.modified)}
                      </option>
                    ))}
                  </select>
                  <button
                    className="action-button secondary"
                    onClick={() => handleLoadPipeline(selectedPipelineId)}
                    disabled={!selectedPipelineId}
                    title="Load selected pipeline"
                  >
                    📂 Load
                  </button>
                </div>
              )}
            </div>
            
            <div className="pipeline-info">
              <span className="pipeline-name">📋 {pipeline.name}</span>
              <span className="operation-count">
                {pipelineStats.totalOperations} operation{pipelineStats.totalOperations !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Operations Summary */}
          {pipeline.operations.length > 0 ? (
            <div className="operations-summary">
              <h4>Applied Operations:</h4>
              <div className="operations-list">
                {pipeline.operations.map((operation, index) => (
                  <div
                    key={operation.id}
                    className={`operation-summary ${!operation.enabled ? 'disabled' : ''}`}
                  >
                    <div className="operation-info">
                      <div className="operation-header">
                        <span className="operation-icon">{getOperationIcon(operation.type)}</span>
                        <span className="operation-index">#{index + 1}</span>
                        <span className="operation-name">{operation.name}</span>
                        {!operation.enabled && <span className="disabled-badge">Disabled</span>}
                      </div>
                      <div className="operation-details">
                        <span className="operation-type">{operation.type}</span>
                        <span className="operation-config">{getOperationSummary(operation)}</span>
                      </div>
                    </div>
                    
                    {(onEditOperation || onRemoveOperation) && (
                      <div className="operation-actions">
                        {onEditOperation && (
                          <button
                            className="action-btn edit"
                            onClick={() => onEditOperation(operation.id)}
                            title="Edit operation"
                          >
                            ✏️
                          </button>
                        )}
                        {onRemoveOperation && (
                          <button
                            className="action-btn remove"
                            onClick={() => onRemoveOperation(operation.id)}
                            title="Remove operation"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="no-operations">
              <div className="no-ops-icon">🔧</div>
              <p>No operations configured</p>
              <p className="no-ops-hint">Add operations to transform your data</p>
            </div>
          )}

          {/* Operation Type Summary */}
          {Object.keys(pipelineStats.operationTypes).length > 0 && (
            <div className="operation-types-summary">
              <h4>Operation Types:</h4>
              <div className="type-chips">
                {Object.entries(pipelineStats.operationTypes).map(([type, count]) => (
                  <span key={type} className="type-chip">
                    {getOperationIcon(type as TransformOperation['type'])} {type} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* API Error Display */}
      <ApiErrorDisplay
        error={apiError}
        context="Transform Configuration"
        onRetry={() => {
          if (apiError?.code === 'SAVE_ERROR' && onSavePipeline) {
            handleSavePipeline();
          } else if (apiError?.code === 'LOAD_ERROR' && onLoadPipeline && selectedPipelineId) {
            handleLoadPipeline(selectedPipelineId);
          }
        }}
        onDismiss={() => setApiError(null)}
        showDetails={true}
      />
    </div>
  );
};