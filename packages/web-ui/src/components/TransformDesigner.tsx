import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { 
  TransformPipeline, 
  TransformOperation, 
  TransformPreview, 
  TransformValidation,
  TransformState,
  UndoRedoManager,
  TableSchema
} from '../types/transforms';
import { TransformOperationEditor } from './TransformOperationEditor';
import { TransformPreviewPanel } from './TransformPreviewPanel';
import { TransformPipelinePersistence } from './TransformPipelinePersistence';
import { ApiErrorDisplay } from './ApiErrorDisplay';
import { useApiErrorHandler, type ApiError } from '../hooks/useApiErrorHandler';
import { useDataTransformer } from '../hooks/useWebWorker';
import './TransformDesigner.css';

interface TransformDesignerProps {
  sourceSchema: TableSchema;
  initialPipeline?: TransformPipeline;
  onPipelineChange?: (pipeline: TransformPipeline) => void;
  onPreviewRequested?: (pipeline: TransformPipeline) => Promise<TransformPreview>;
  onValidationRequested?: (pipeline: TransformPipeline) => Promise<TransformValidation>;
}

const createEmptyPipeline = (sourceTable: string): TransformPipeline => ({
  id: `pipeline_${Date.now()}`,
  name: 'New Transform Pipeline',
  operations: [],
  sourceTable,
  created: new Date(),
  modified: new Date()
});

const createUndoRedoManager = (initialState: TransformState): UndoRedoManager => ({
  history: [initialState],
  currentIndex: 0,
  maxHistorySize: 50
});

export const TransformDesigner: React.FC<TransformDesignerProps> = ({
  sourceSchema,
  initialPipeline,
  onPipelineChange,
  onPreviewRequested,
  onValidationRequested
}) => {
  const [pipeline, setPipeline] = useState<TransformPipeline>(() => 
    initialPipeline || createEmptyPipeline(sourceSchema.name)
  );
  const [preview, setPreview] = useState<TransformPreview | null>(null);
  const [validation, setValidation] = useState<TransformValidation | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const { handleApiError } = useApiErrorHandler();
  
  // Web Worker for data transformations
  const dataTransformer = useDataTransformer();
  
  // Undo/Redo state
  const undoRedoRef = useRef<UndoRedoManager>(createUndoRedoManager({
    pipeline,
    preview: preview || undefined,
    validation: validation || undefined
  }));

  const saveToHistory = useCallback((newPipeline: TransformPipeline) => {
    const manager = undoRedoRef.current;
    const newState: TransformState = {
      pipeline: newPipeline,
      preview: preview || undefined,
      validation: validation || undefined
    };

    // Remove any history after current index (for new changes after undo)
    manager.history = manager.history.slice(0, manager.currentIndex + 1);
    
    // Add new state
    manager.history.push(newState);
    
    // Limit history size
    if (manager.history.length > manager.maxHistorySize) {
      manager.history = manager.history.slice(-manager.maxHistorySize);
      manager.currentIndex = manager.history.length - 1;
    } else {
      manager.currentIndex = manager.history.length - 1;
    }
  }, [preview, validation]);

  const undo = useCallback(() => {
    const manager = undoRedoRef.current;
    if (manager.currentIndex > 0) {
      manager.currentIndex--;
      const state = manager.history[manager.currentIndex];
      setPipeline(state.pipeline);
      setPreview(state.preview || null);
      setValidation(state.validation || null);
    }
  }, []);

  const redo = useCallback(() => {
    const manager = undoRedoRef.current;
    if (manager.currentIndex < manager.history.length - 1) {
      manager.currentIndex++;
      const state = manager.history[manager.currentIndex];
      setPipeline(state.pipeline);
      setPreview(state.preview || null);
      setValidation(state.validation || null);
    }
  }, []);

  const canUndo = undoRedoRef.current.currentIndex > 0;
  const canRedo = undoRedoRef.current.currentIndex < undoRedoRef.current.history.length - 1;

  const updatePipeline = useCallback((updater: (prev: TransformPipeline) => TransformPipeline) => {
    setPipeline(prev => {
      const updated = updater(prev);
      const modifiedPipeline = { ...updated, modified: new Date() };
      
      saveToHistory(modifiedPipeline);
      onPipelineChange?.(modifiedPipeline);
      
      return modifiedPipeline;
    });
  }, [saveToHistory, onPipelineChange]);

  const addOperation = useCallback((type: TransformOperation['type']) => {
    const newOperation: TransformOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Operation`,
      enabled: true,
      config: getDefaultConfig(type)
    };

    updatePipeline(prev => ({
      ...prev,
      operations: [...prev.operations, newOperation]
    }));
    
    setSelectedOperationId(newOperation.id);
  }, [updatePipeline]);

  const updateOperation = useCallback((operationId: string, updates: Partial<TransformOperation>) => {
    updatePipeline(prev => ({
      ...prev,
      operations: prev.operations.map(op => 
        op.id === operationId ? { ...op, ...updates } : op
      )
    }));
  }, [updatePipeline]);

  const deleteOperation = useCallback((operationId: string) => {
    updatePipeline(prev => ({
      ...prev,
      operations: prev.operations.filter(op => op.id !== operationId)
    }));
    
    if (selectedOperationId === operationId) {
      setSelectedOperationId(null);
    }
  }, [updatePipeline, selectedOperationId]);

  const moveOperation = useCallback((operationId: string, direction: 'up' | 'down') => {
    updatePipeline(prev => {
      const operations = [...prev.operations];
      const index = operations.findIndex(op => op.id === operationId);
      
      if (index === -1) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= operations.length) return prev;
      
      [operations[index], operations[newIndex]] = [operations[newIndex], operations[index]];
      
      return { ...prev, operations };
    });
  }, [updatePipeline]);

  const requestPreview = useCallback(async () => {
    setIsPreviewLoading(true);
    setApiError(null); // Clear previous errors
    
    try {
      // Use Web Worker if we have sample data, otherwise use the provided callback
      if (onPreviewRequested) {
        // For now, still use the provided callback but in future could be enhanced
        // to fetch data and process in worker
        const previewResult = await onPreviewRequested(pipeline);
        setPreview(previewResult);
      } else {
        // Direct Web Worker usage (when data is available locally)
        // This would require sample data to be passed to the component
        console.warn('Web Worker preview not yet implemented without data source');
      }
    } catch (error) {
      const apiError = handleApiError(error, {
        operation: 'transform preview',
        component: 'TransformDesigner',
        userMessage: 'Failed to generate transform preview'
      });
      setApiError(apiError);
      setPreview(null);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [onPreviewRequested, pipeline, handleApiError]);

  const requestValidation = useCallback(async () => {
    try {
      // Use Web Worker for validation
      const validationResult = await dataTransformer.execute({
        type: 'VALIDATE_TRANSFORM',
        payload: {
          operations: pipeline.operations,
          schema: sourceSchema
        }
      });
      
      setValidation(validationResult);
      
      // Clear validation errors on successful validation
      setApiError(prev => prev?.code === 'VALIDATION_ERROR' ? null : prev);
      
      // Also call the provided callback if available
      if (onValidationRequested) {
        try {
          const serverValidation = await onValidationRequested(pipeline);
          // Merge results if needed
          setValidation(serverValidation);
        } catch (error) {
          // Server validation failed, but we already have local validation
          console.warn('Server validation failed, using local validation', error);
        }
      }
    } catch (error) {
      const validationError = handleApiError(error, {
        operation: 'transform validation',
        component: 'TransformDesigner',
        userMessage: 'Failed to validate transform pipeline'
      });
      setApiError(validationError);
      setValidation(null);
    }
  }, [pipeline, sourceSchema, dataTransformer, handleApiError, onValidationRequested]);

  // Auto-validate when pipeline changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      requestValidation();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [pipeline.operations, sourceSchema]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [undo, redo]);

  const selectedOperation = pipeline.operations.find(op => op.id === selectedOperationId);

  return (
    <div className="transform-designer" data-testid="transform-designer">
      <div className="transform-designer-header">
        <div className="pipeline-info">
          <h2>Transform Pipeline</h2>
          <div className="pipeline-details">
            <span className="source-table">Source: {sourceSchema.name}</span>
            <span className="operation-count">{pipeline.operations.length} operations</span>
          </div>
        </div>
        
        <div className="designer-actions">
          <button 
            className="action-button secondary"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            data-testid="undo-button"
          >
            ↶ Undo
          </button>
          <button 
            className="action-button secondary"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            data-testid="redo-button"
          >
            ↷ Redo
          </button>
          <button 
            className="action-button primary"
            onClick={requestPreview}
            disabled={isPreviewLoading || pipeline.operations.length === 0}
            data-testid="preview-button"
          >
            {isPreviewLoading ? '⟳ Loading...' : '👁 Preview'}
          </button>
        </div>
      </div>

      {/* Pipeline Persistence */}
      <TransformPipelinePersistence
        currentPipeline={pipeline}
        onPipelineLoad={(loadedPipeline) => {
          setPipeline(loadedPipeline);
          saveToHistory(loadedPipeline);
          onPipelineChange?.(loadedPipeline);
        }}
        onPipelineSaved={(savedPipeline) => {
          // Pipeline has been saved, could show notification
          console.log('Pipeline saved:', savedPipeline.name);
        }}
      />

      <div className="transform-designer-body">
        <div className="operations-panel">
          <div className="operations-header">
            <h3>Transform Operations</h3>
            <div className="add-operation-dropdown">
              <select 
                onChange={(e) => {
                  if (e.target.value) {
                    addOperation(e.target.value as TransformOperation['type']);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                data-testid="add-operation-select"
              >
                <option value="">+ Add Operation</option>
                <option value="filter">Filter Rows</option>
                <option value="sort">Sort Data</option>
                <option value="select">Select Columns</option>
                <option value="rename">Rename Columns</option>
                <option value="compute">Compute Column</option>
                <option value="aggregate">Aggregate Data</option>
                <option value="join">Join Tables</option>
                <option value="deduplicate">Remove Duplicates</option>
              </select>
            </div>
          </div>

          <div className="operations-list" data-testid="transform-operations">
            {pipeline.operations.length === 0 ? (
              <div className="empty-operations">
                <div className="empty-icon">🔧</div>
                <p>No operations added yet</p>
                <p className="empty-hint">Add an operation to start transforming your data</p>
              </div>
            ) : (
              pipeline.operations.map((operation, index) => (
                <div 
                  key={operation.id}
                  className={`operation-item ${selectedOperationId === operation.id ? 'selected' : ''} ${!operation.enabled ? 'disabled' : ''}`}
                  onClick={() => setSelectedOperationId(operation.id)}
                  data-testid={`operation-item-${operation.id}`}
                  data-operation-type={operation.type}
                >
                  <div className="operation-header">
                    <div className="operation-info">
                      <span className="operation-type">{operation.type}</span>
                      <span className="operation-name">{operation.name}</span>
                    </div>
                    <div className="operation-controls">
                      <button
                        className="control-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveOperation(operation.id, 'up');
                        }}
                        disabled={index === 0}
                        title="Move up"
                        data-testid={`move-up-${operation.id}`}
                      >
                        ↑
                      </button>
                      <button
                        className="control-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveOperation(operation.id, 'down');
                        }}
                        disabled={index === pipeline.operations.length - 1}
                        title="Move down"
                        data-testid={`move-down-${operation.id}`}
                      >
                        ↓
                      </button>
                      <button
                        className="control-button toggle"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateOperation(operation.id, { enabled: !operation.enabled });
                        }}
                        title={operation.enabled ? 'Disable' : 'Enable'}
                        data-testid={`toggle-${operation.id}`}
                      >
                        {operation.enabled ? '●' : '○'}
                      </button>
                      <button
                        className="control-button danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteOperation(operation.id);
                        }}
                        title="Delete"
                        data-testid={`delete-${operation.id}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  
                  {validation?.errors.some(error => error.operationId === operation.id) && (
                    <div className="operation-errors">
                      {validation.errors
                        .filter(error => error.operationId === operation.id)
                        .map((error, idx) => (
                          <div key={idx} className={`error-message ${error.severity}`}>
                            {error.message}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="editor-panel">
          {selectedOperation ? (
            <TransformOperationEditor
              operation={selectedOperation}
              sourceSchema={sourceSchema}
              onOperationChange={(updates) => updateOperation(selectedOperation.id, updates)}
            />
          ) : (
            <div className="no-operation-selected">
              <div className="placeholder-icon">⚙️</div>
              <h3>No Operation Selected</h3>
              <p>Select an operation from the left panel to configure it, or add a new operation to get started.</p>
            </div>
          )}
        </div>

        <div className="preview-panel" data-testid="transform-preview">
          <TransformPreviewPanel
            preview={preview}
            isLoading={isPreviewLoading}
            validation={validation}
            onRefreshPreview={requestPreview}
          />
        </div>
      </div>

      {/* API Error Display */}
      <ApiErrorDisplay
        error={apiError}
        context="Transform Operations"
        onRetry={() => {
          if (apiError?.code === 'VALIDATION_ERROR') {
            requestValidation();
          } else if (apiError?.code === 'PREVIEW_ERROR') {
            requestPreview();
          } else {
            // Generic retry - try both validation and preview
            requestValidation();
            requestPreview();
          }
        }}
        onDismiss={() => setApiError(null)}
        showDetails={true}
      />
    </div>
  );
};

// Helper function to create default configs
function getDefaultConfig(type: TransformOperation['type']): any {
  switch (type) {
    case 'filter':
      return { field: '', operator: 'equals', value: '' };
    case 'sort':
      return { fields: [{ field: '', direction: 'asc' }] };
    case 'select':
      return { fields: [] };
    case 'rename':
      return { mappings: [{ oldName: '', newName: '' }] };
    case 'compute':
      return { newField: '', expression: '', dataType: 'string' };
    case 'aggregate':
      return { groupBy: [], aggregations: [{ field: '', function: 'count' }] };
    case 'join':
      return { rightTable: '', type: 'inner', conditions: [{ leftField: '', rightField: '' }] };
    case 'deduplicate':
      return { keepFirst: true };
    default:
      return {};
  }
}