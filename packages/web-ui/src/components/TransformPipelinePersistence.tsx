import React, { useState, useCallback } from 'react';
import type { TransformPipeline } from '../types/transforms';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { ProgressIndicator } from './ProgressIndicator';
import { ApiErrorDisplay } from './ApiErrorDisplay';
import './TransformPipelinePersistence.css';

interface SavedPipeline {
  id: string;
  name: string;
  description?: string;
  pipeline: TransformPipeline;
  tags: string[];
  created: Date;
  modified: Date;
  sourceTable: string;
  operationCount: number;
}

interface TransformPipelinePersistenceProps {
  currentPipeline: TransformPipeline;
  onPipelineLoad?: (pipeline: TransformPipeline) => void;
  onPipelineSaved?: (savedPipeline: SavedPipeline) => void;
  className?: string;
}

export const TransformPipelinePersistence: React.FC<TransformPipelinePersistenceProps> = ({
  currentPipeline,
  onPipelineLoad,
  onPipelineSaved,
  className = ''
}) => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savedPipelines, setSavedPipelines] = useState<SavedPipeline[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Save form state
  const [saveForm, setSaveForm] = useState({
    name: currentPipeline.name,
    description: '',
    tags: [] as string[],
    overwrite: false
  });

  const { handleApiError } = useApiErrorHandler();
  const [apiError, setApiError] = useState<any>(null);

  // Mock data for development - would be replaced with actual API calls
  const mockSavedPipelines: SavedPipeline[] = [
    {
      id: 'pipeline-1',
      name: 'Customer Data Cleanup',
      description: 'Remove duplicates and normalize customer data',
      pipeline: {
        ...currentPipeline,
        id: 'pipeline-1',
        name: 'Customer Data Cleanup'
      },
      tags: ['cleanup', 'customers'],
      created: new Date('2024-01-15'),
      modified: new Date('2024-01-20'),
      sourceTable: 'customers',
      operationCount: 4
    },
    {
      id: 'pipeline-2',
      name: 'Sales Data Aggregation',
      description: 'Aggregate sales data by region and time',
      pipeline: {
        ...currentPipeline,
        id: 'pipeline-2',
        name: 'Sales Data Aggregation'
      },
      tags: ['sales', 'aggregation'],
      created: new Date('2024-01-10'),
      modified: new Date('2024-01-18'),
      sourceTable: 'sales',
      operationCount: 6
    }
  ];

  const loadSavedPipelines = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    
    try {
      // Mock API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 500));
      setSavedPipelines(mockSavedPipelines);
    } catch (error) {
      const apiError = handleApiError(error, {
        operation: 'load saved pipelines',
        component: 'TransformPipelinePersistence'
      });
      setApiError(apiError);
    } finally {
      setIsLoading(false);
    }
  }, [handleApiError]);

  const savePipeline = useCallback(async () => {
    if (!saveForm.name.trim()) {
      setApiError({ message: 'Pipeline name is required', type: 'validation' });
      return;
    }

    setIsSaving(true);
    setApiError(null);

    try {
      const savedPipeline: SavedPipeline = {
        id: saveForm.overwrite ? currentPipeline.id : `pipeline_${Date.now()}`,
        name: saveForm.name,
        description: saveForm.description,
        pipeline: {
          ...currentPipeline,
          name: saveForm.name,
          modified: new Date()
        },
        tags: saveForm.tags,
        created: saveForm.overwrite ? currentPipeline.created : new Date(),
        modified: new Date(),
        sourceTable: currentPipeline.sourceTable,
        operationCount: currentPipeline.operations.length
      };

      // Mock API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSavedPipelines(prev => {
        if (saveForm.overwrite) {
          return prev.map(p => p.id === savedPipeline.id ? savedPipeline : p);
        } else {
          return [...prev, savedPipeline];
        }
      });

      onPipelineSaved?.(savedPipeline);
      setShowSaveDialog(false);
      setSaveForm({
        name: currentPipeline.name,
        description: '',
        tags: [],
        overwrite: false
      });
    } catch (error) {
      const apiError = handleApiError(error, {
        operation: 'save pipeline',
        component: 'TransformPipelinePersistence'
      });
      setApiError(apiError);
    } finally {
      setIsSaving(false);
    }
  }, [saveForm, currentPipeline, onPipelineSaved, handleApiError]);

  const loadPipeline = useCallback(async (savedPipeline: SavedPipeline) => {
    try {
      onPipelineLoad?.(savedPipeline.pipeline);
      setShowLoadDialog(false);
    } catch (error) {
      const apiError = handleApiError(error, {
        operation: 'load pipeline',
        component: 'TransformPipelinePersistence'
      });
      setApiError(apiError);
    }
  }, [onPipelineLoad, handleApiError]);

  const deletePipeline = useCallback(async (pipelineId: string) => {
    try {
      // Mock API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 300));
      setSavedPipelines(prev => prev.filter(p => p.id !== pipelineId));
    } catch (error) {
      const apiError = handleApiError(error, {
        operation: 'delete pipeline',
        component: 'TransformPipelinePersistence'
      });
      setApiError(apiError);
    }
  }, [handleApiError]);

  const filteredPipelines = savedPipelines.filter(pipeline => {
    const matchesSearch = !searchTerm || 
      pipeline.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pipeline.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.some(tag => pipeline.tags.includes(tag));
    
    return matchesSearch && matchesTags;
  });

  const allTags = [...new Set(savedPipelines.flatMap(p => p.tags))];

  const addTag = (tag: string) => {
    if (tag && !saveForm.tags.includes(tag)) {
      setSaveForm(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSaveForm(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  return (
    <div className={`transform-pipeline-persistence ${className}`} data-testid="transform-pipeline-persistence">
      <div className="persistence-actions">
        <button
          className="action-button primary"
          onClick={() => setShowSaveDialog(true)}
          disabled={currentPipeline.operations.length === 0}
          data-testid="save-pipeline-button"
        >
          💾 Save Pipeline
        </button>
        <button
          className="action-button secondary"
          onClick={() => {
            setShowLoadDialog(true);
            loadSavedPipelines();
          }}
          data-testid="load-pipeline-button"
        >
          📂 Load Pipeline
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="modal-overlay" data-testid="save-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Save Transform Pipeline</h3>
              <button 
                className="close-button"
                onClick={() => setShowSaveDialog(false)}
                data-testid="close-save-dialog"
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="pipeline-name">Pipeline Name *</label>
                <input
                  id="pipeline-name"
                  type="text"
                  value={saveForm.name}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter pipeline name"
                  data-testid="pipeline-name-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="pipeline-description">Description</label>
                <textarea
                  id="pipeline-description"
                  value={saveForm.description}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                  data-testid="pipeline-description-input"
                />
              </div>

              <div className="form-group">
                <label>Tags</label>
                <div className="tag-input">
                  <input
                    type="text"
                    placeholder="Add tags (press Enter)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(e.currentTarget.value.trim());
                        e.currentTarget.value = '';
                      }
                    }}
                    data-testid="tag-input"
                  />
                </div>
                <div className="selected-tags">
                  {saveForm.tags.map(tag => (
                    <span key={tag} className="tag" data-testid={`tag-${tag}`}>
                      {tag}
                      <button onClick={() => removeTag(tag)}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={saveForm.overwrite}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, overwrite: e.target.checked }))}
                    data-testid="overwrite-checkbox"
                  />
                  Overwrite existing pipeline with same name
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="action-button secondary"
                onClick={() => setShowSaveDialog(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="action-button primary"
                onClick={savePipeline}
                disabled={isSaving || !saveForm.name.trim()}
                data-testid="confirm-save-button"
              >
                {isSaving ? <ProgressIndicator size="small" indeterminate /> : 'Save Pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Dialog */}
      {showLoadDialog && (
        <div className="modal-overlay" data-testid="load-dialog">
          <div className="modal-content large">
            <div className="modal-header">
              <h3>Load Transform Pipeline</h3>
              <button 
                className="close-button"
                onClick={() => setShowLoadDialog(false)}
                data-testid="close-load-dialog"
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="search-filters">
                <div className="search-bar">
                  <input
                    type="text"
                    placeholder="Search pipelines..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="pipeline-search"
                  />
                </div>
                
                <div className="tag-filters">
                  <label>Filter by tags:</label>
                  <div className="tag-list">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        className={`tag-filter ${selectedTags.includes(tag) ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedTags(prev => 
                            prev.includes(tag) 
                              ? prev.filter(t => t !== tag)
                              : [...prev, tag]
                          );
                        }}
                        data-testid={`tag-filter-${tag}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="loading-state">
                  <ProgressIndicator indeterminate />
                  <p>Loading saved pipelines...</p>
                </div>
              ) : (
                <div className="pipeline-list" data-testid="pipeline-list">
                  {filteredPipelines.length === 0 ? (
                    <div className="empty-state">
                      <p>No saved pipelines found</p>
                    </div>
                  ) : (
                    filteredPipelines.map(pipeline => (
                      <div key={pipeline.id} className="pipeline-item" data-testid={`pipeline-item-${pipeline.id}`}>
                        <div className="pipeline-info">
                          <div className="pipeline-header">
                            <h4 className="pipeline-name">{pipeline.name}</h4>
                            <div className="pipeline-meta">
                              <span className="operation-count">{pipeline.operationCount} operations</span>
                              <span className="source-table">Source: {pipeline.sourceTable}</span>
                            </div>
                          </div>
                          
                          {pipeline.description && (
                            <p className="pipeline-description">{pipeline.description}</p>
                          )}
                          
                          <div className="pipeline-footer">
                            <div className="pipeline-tags">
                              {pipeline.tags.map(tag => (
                                <span key={tag} className="tag">{tag}</span>
                              ))}
                            </div>
                            <div className="pipeline-dates">
                              <span>Modified: {pipeline.modified.toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="pipeline-actions">
                          <button
                            className="action-button primary small"
                            onClick={() => loadPipeline(pipeline)}
                            data-testid={`load-pipeline-${pipeline.id}`}
                          >
                            Load
                          </button>
                          <button
                            className="action-button danger small"
                            onClick={() => deletePipeline(pipeline.id)}
                            data-testid={`delete-pipeline-${pipeline.id}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="action-button secondary"
                onClick={() => setShowLoadDialog(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      <ApiErrorDisplay
        error={apiError}
        context="Pipeline Persistence"
        onDismiss={() => setApiError(null)}
      />
    </div>
  );
};

export default TransformPipelinePersistence;