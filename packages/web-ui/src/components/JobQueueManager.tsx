import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ProgressIndicator } from './ProgressIndicator';
import { VirtualTable, PerformantList } from './VirtualScrollList';
import { ApiErrorDisplay } from './ApiErrorDisplay';
import { useNotifications } from './NotificationToast';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import './JobQueueManager.css';

interface JobQueueManagerProps {
  onJobAction?: (action: string, jobId: string) => void;
  refreshInterval?: number;
  className?: string;
}

interface Job {
  id: string;
  type: 'sentiment_analysis' | 'data_export' | 'file_upload' | 'transform_operation' | 'security_scan';
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  priority: 'low' | 'normal' | 'high' | 'critical';
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  error?: string;
  result?: any;
  dependencies?: string[];
  tags?: string[];
  metadata?: {
    userId?: string;
    dataSize?: number;
    recordCount?: number;
    model?: string;
  };
}

interface QueueStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  paused: number;
  avgWaitTime: number;
  avgProcessingTime: number;
}

interface JobQueueState {
  jobs: Job[];
  stats: QueueStats;
  selectedJobs: string[];
  sortBy: keyof Job;
  sortDirection: 'asc' | 'desc';
  filterStatus: string;
  filterType: string;
  filterPriority: string;
  searchTerm: string;
  isLoading: boolean;
  error: any;
}

const INITIAL_STATE: JobQueueState = {
  jobs: [],
  stats: {
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    paused: 0,
    avgWaitTime: 0,
    avgProcessingTime: 0
  },
  selectedJobs: [],
  sortBy: 'createdAt',
  sortDirection: 'desc',
  filterStatus: 'all',
  filterType: 'all',
  filterPriority: 'all',
  searchTerm: '',
  isLoading: false,
  error: null
};

// Mock data for demonstration
const MOCK_JOBS: Job[] = [
  {
    id: 'job-001',
    type: 'sentiment_analysis',
    title: 'Customer Feedback Analysis',
    description: 'Analyzing 10,000 customer reviews for sentiment patterns',
    status: 'running',
    priority: 'high',
    progress: 65,
    createdAt: '2024-01-15T10:30:00Z',
    startedAt: '2024-01-15T10:32:00Z',
    estimatedDuration: 300000,
    tags: ['customer-feedback', 'reviews'],
    metadata: {
      userId: 'user-123',
      recordCount: 10000,
      model: 'advanced'
    }
  },
  {
    id: 'job-002',
    type: 'data_export',
    title: 'Large Dataset Export',
    description: 'Exporting filtered results to CSV format',
    status: 'pending',
    priority: 'normal',
    progress: 0,
    createdAt: '2024-01-15T10:45:00Z',
    estimatedDuration: 180000,
    tags: ['export', 'csv'],
    metadata: {
      userId: 'user-456',
      recordCount: 50000,
      dataSize: 1024 * 1024 * 25 // 25MB
    }
  },
  {
    id: 'job-003',
    type: 'security_scan',
    title: 'PII Detection Scan',
    description: 'Scanning uploaded files for personally identifiable information',
    status: 'completed',
    priority: 'critical',
    progress: 100,
    createdAt: '2024-01-15T09:15:00Z',
    startedAt: '2024-01-15T09:16:00Z',
    completedAt: '2024-01-15T09:25:00Z',
    actualDuration: 540000,
    tags: ['security', 'pii'],
    metadata: {
      userId: 'user-789',
      recordCount: 5000
    }
  },
  {
    id: 'job-004',
    type: 'file_upload',
    title: 'Large File Processing',
    description: 'Processing uploaded 2GB CSV file',
    status: 'failed',
    priority: 'high',
    progress: 25,
    createdAt: '2024-01-15T08:30:00Z',
    startedAt: '2024-01-15T08:32:00Z',
    error: 'Memory limit exceeded during processing',
    tags: ['upload', 'large-file'],
    metadata: {
      userId: 'user-123',
      dataSize: 1024 * 1024 * 1024 * 2 // 2GB
    }
  }
];

export const JobQueueManager: React.FC<JobQueueManagerProps> = ({
  onJobAction,
  refreshInterval = 5000,
  className = ''
}) => {
  const [state, setState] = useState<JobQueueState>(INITIAL_STATE);
  const { addNotification } = useNotifications();
  const { handleApiError } = useApiErrorHandler();

  const updateState = useCallback((updates: Partial<JobQueueState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Mock API calls - in real implementation, these would call actual endpoints
  const fetchJobs = useCallback(async () => {
    updateState({ isLoading: true, error: null });
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Calculate stats
      const stats: QueueStats = {
        total: MOCK_JOBS.length,
        pending: MOCK_JOBS.filter(j => j.status === 'pending').length,
        running: MOCK_JOBS.filter(j => j.status === 'running').length,
        completed: MOCK_JOBS.filter(j => j.status === 'completed').length,
        failed: MOCK_JOBS.filter(j => j.status === 'failed').length,
        cancelled: MOCK_JOBS.filter(j => j.status === 'cancelled').length,
        paused: MOCK_JOBS.filter(j => j.status === 'paused').length,
        avgWaitTime: 120000, // 2 minutes
        avgProcessingTime: 300000 // 5 minutes
      };
      
      updateState({ 
        jobs: MOCK_JOBS,
        stats,
        isLoading: false 
      });
      
    } catch (error) {
      const apiError = handleApiError(error, {
        operation: 'fetch jobs',
        component: 'JobQueueManager',
        userMessage: 'Failed to fetch job queue'
      });
      updateState({ error: apiError, isLoading: false });
    }
  }, [updateState, handleApiError]);

  const performJobAction = useCallback(async (action: string, jobId: string) => {
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (onJobAction) {
        onJobAction(action, jobId);
      }
      
      addNotification({
        type: 'success',
        message: `Job ${action} successful`,
        duration: 3000
      });
      
      // Refresh jobs after action
      fetchJobs();
      
    } catch (error) {
      const apiError = handleApiError(error, {
        operation: `${action} job`,
        component: 'JobQueueManager',
        userMessage: `Failed to ${action} job`
      });
      addNotification({
        type: 'error',
        message: apiError.message,
        duration: 5000
      });
    }
  }, [onJobAction, addNotification, handleApiError, fetchJobs]);

  // Auto-refresh
  useEffect(() => {
    fetchJobs();
    
    const interval = setInterval(fetchJobs, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchJobs, refreshInterval]);

  // Filtered and sorted jobs
  const filteredJobs = useMemo(() => {
    let filtered = state.jobs.filter(job => {
      if (state.filterStatus !== 'all' && job.status !== state.filterStatus) return false;
      if (state.filterType !== 'all' && job.type !== state.filterType) return false;
      if (state.filterPriority !== 'all' && job.priority !== state.filterPriority) return false;
      if (state.searchTerm && !job.title.toLowerCase().includes(state.searchTerm.toLowerCase()) &&
          !job.description.toLowerCase().includes(state.searchTerm.toLowerCase()) &&
          !job.id.toLowerCase().includes(state.searchTerm.toLowerCase())) return false;
      return true;
    });

    // Sort jobs
    filtered.sort((a, b) => {
      const aVal = a[state.sortBy];
      const bVal = b[state.sortBy];
      
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;
      
      return state.sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [state.jobs, state.filterStatus, state.filterType, state.filterPriority, state.searchTerm, state.sortBy, state.sortDirection]);

  const handleJobSelection = useCallback((jobId: string, selected: boolean) => {
    updateState({
      selectedJobs: selected 
        ? [...state.selectedJobs, jobId]
        : state.selectedJobs.filter(id => id !== jobId)
    });
  }, [state.selectedJobs, updateState]);

  const handleSelectAll = useCallback(() => {
    const allSelected = state.selectedJobs.length === filteredJobs.length;
    updateState({
      selectedJobs: allSelected ? [] : filteredJobs.map(job => job.id)
    });
  }, [state.selectedJobs, filteredJobs, updateState]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'N/A';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'running': return '#3b82f6';
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      case 'cancelled': return '#6b7280';
      case 'paused': return '#f59e0b';
      default: return '#64748b';
    }
  };

  const getPriorityIcon = (priority: Job['priority']) => {
    switch (priority) {
      case 'critical': return '🚨';
      case 'high': return '🔴';
      case 'normal': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getTypeIcon = (type: Job['type']) => {
    switch (type) {
      case 'sentiment_analysis': return '😊';
      case 'data_export': return '📤';
      case 'file_upload': return '📁';
      case 'transform_operation': return '🔄';
      case 'security_scan': return '🔒';
      default: return '⚙️';
    }
  };

  return (
    <div className={`job-queue-manager ${className}`} data-testid="job-queue-manager">
      <div className="queue-header">
        <div className="header-left">
          <h3>Job Queue Manager</h3>
          <div className="queue-stats" data-testid="queue-stats">
            <div className="stat-item">
              <span className="stat-label">Total:</span>
              <span className="stat-value">{state.stats.total}</span>
            </div>
            <div className="stat-item running">
              <span className="stat-label">Running:</span>
              <span className="stat-value">{state.stats.running}</span>
            </div>
            <div className="stat-item pending">
              <span className="stat-label">Pending:</span>
              <span className="stat-value">{state.stats.pending}</span>
            </div>
            <div className="stat-item completed">
              <span className="stat-label">Completed:</span>
              <span className="stat-value">{state.stats.completed}</span>
            </div>
            <div className="stat-item failed">
              <span className="stat-label">Failed:</span>
              <span className="stat-value">{state.stats.failed}</span>
            </div>
          </div>
        </div>
        
        <div className="header-actions">
          <button
            className="refresh-button"
            onClick={fetchJobs}
            disabled={state.isLoading}
            data-testid="refresh-jobs"
          >
            {state.isLoading ? '⟳' : '🔄'} Refresh
          </button>
          
          {state.selectedJobs.length > 0 && (
            <div className="bulk-actions" data-testid="bulk-actions">
              <button
                className="bulk-action-button cancel"
                onClick={() => {
                  state.selectedJobs.forEach(jobId => 
                    performJobAction('cancel', jobId)
                  );
                }}
                data-testid="bulk-cancel"
              >
                Cancel Selected ({state.selectedJobs.length})
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="queue-filters" data-testid="queue-filters">
        <div className="filter-group">
          <label>Status:</label>
          <select
            value={state.filterStatus}
            onChange={(e) => updateState({ filterStatus: e.target.value })}
            data-testid="filter-status"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Type:</label>
          <select
            value={state.filterType}
            onChange={(e) => updateState({ filterType: e.target.value })}
            data-testid="filter-type"
          >
            <option value="all">All</option>
            <option value="sentiment_analysis">Sentiment Analysis</option>
            <option value="data_export">Data Export</option>
            <option value="file_upload">File Upload</option>
            <option value="transform_operation">Transform</option>
            <option value="security_scan">Security Scan</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Priority:</label>
          <select
            value={state.filterPriority}
            onChange={(e) => updateState({ filterPriority: e.target.value })}
            data-testid="filter-priority"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="filter-group search-group">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Search jobs..."
            value={state.searchTerm}
            onChange={(e) => updateState({ searchTerm: e.target.value })}
            data-testid="search-jobs"
          />
        </div>
      </div>

      <div className="jobs-list" data-testid="jobs-list">
        <div className="list-header">
          <div className="selection-controls">
            <label>
              <input
                type="checkbox"
                checked={state.selectedJobs.length === filteredJobs.length && filteredJobs.length > 0}
                onChange={handleSelectAll}
                data-testid="select-all-jobs"
              />
              Select All ({filteredJobs.length})
            </label>
          </div>
          
          <div className="sort-controls">
            <label>Sort by:</label>
            <select
              value={`${state.sortBy}-${state.sortDirection}`}
              onChange={(e) => {
                const [sortBy, sortDirection] = e.target.value.split('-');
                updateState({ 
                  sortBy: sortBy as keyof Job,
                  sortDirection: sortDirection as 'asc' | 'desc'
                });
              }}
              data-testid="sort-jobs"
            >
              <option value="createdAt-desc">Created (Newest)</option>
              <option value="createdAt-asc">Created (Oldest)</option>
              <option value="priority-desc">Priority (High to Low)</option>
              <option value="priority-asc">Priority (Low to High)</option>
              <option value="status-asc">Status (A-Z)</option>
              <option value="progress-desc">Progress (High to Low)</option>
            </select>
          </div>
        </div>

        <PerformantList
          items={filteredJobs}
          height={600}
          estimatedItemHeight={120}
          threshold={20}
          className="jobs-virtual-list"
          testId="jobs-virtual-list"
          renderItem={(job) => (
            <div className={`job-item ${job.status}`} data-testid={`job-item-${job.id}`}>
              <div className="job-header">
                <div className="job-selection">
                  <input
                    type="checkbox"
                    checked={state.selectedJobs.includes(job.id)}
                    onChange={(e) => handleJobSelection(job.id, e.target.checked)}
                    data-testid={`select-job-${job.id}`}
                  />
                </div>
                
                <div className="job-info">
                  <div className="job-title">
                    <span className="type-icon">{getTypeIcon(job.type)}</span>
                    <span className="title-text">{job.title}</span>
                    <span className="priority-icon" title={`Priority: ${job.priority}`}>
                      {getPriorityIcon(job.priority)}
                    </span>
                  </div>
                  
                  <div className="job-description">{job.description}</div>
                  
                  <div className="job-meta">
                    <span className="job-id">ID: {job.id}</span>
                    <span className="job-created">
                      Created: {new Date(job.createdAt).toLocaleString()}
                    </span>
                    {job.metadata?.recordCount && (
                      <span className="record-count">
                        Records: {job.metadata.recordCount.toLocaleString()}
                      </span>
                    )}
                    {job.metadata?.dataSize && (
                      <span className="data-size">
                        Size: {formatFileSize(job.metadata.dataSize)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="job-status">
                  <div className="status-badge" style={{ backgroundColor: getStatusColor(job.status) }}>
                    {job.status.toUpperCase()}
                  </div>
                  
                  {job.status === 'running' && (
                    <div className="progress-section">
                      <ProgressIndicator
                        value={job.progress}
                        size="small"
                        showPercentage
                        className="job-progress"
                        testId={`job-progress-${job.id}`}
                      />
                    </div>
                  )}
                  
                  {job.error && (
                    <div className="error-indicator" title={job.error}>
                      ⚠️ Error
                    </div>
                  )}
                </div>
                
                <div className="job-actions">
                  {job.status === 'running' && (
                    <>
                      <button
                        className="action-button pause"
                        onClick={() => performJobAction('pause', job.id)}
                        data-testid={`pause-job-${job.id}`}
                      >
                        ⏸️
                      </button>
                      <button
                        className="action-button cancel"
                        onClick={() => performJobAction('cancel', job.id)}
                        data-testid={`cancel-job-${job.id}`}
                      >
                        ✕
                      </button>
                    </>
                  )}
                  
                  {job.status === 'paused' && (
                    <button
                      className="action-button resume"
                      onClick={() => performJobAction('resume', job.id)}
                      data-testid={`resume-job-${job.id}`}
                    >
                      ▶️
                    </button>
                  )}
                  
                  {(job.status === 'failed' || job.status === 'cancelled') && (
                    <button
                      className="action-button retry"
                      onClick={() => performJobAction('retry', job.id)}
                      data-testid={`retry-job-${job.id}`}
                    >
                      🔄
                    </button>
                  )}
                  
                  {job.status === 'completed' && (
                    <button
                      className="action-button details"
                      onClick={() => performJobAction('details', job.id)}
                      data-testid={`details-job-${job.id}`}
                    >
                      📋
                    </button>
                  )}
                </div>
              </div>

              {job.tags && job.tags.length > 0 && (
                <div className="job-tags">
                  {job.tags.map(tag => (
                    <span key={tag} className="job-tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        />
      </div>

      {state.error && (
        <ApiErrorDisplay
          error={state.error}
          context="Job Queue"
          onRetry={fetchJobs}
          onDismiss={() => updateState({ error: null })}
        />
      )}
    </div>
  );
};

export default JobQueueManager;