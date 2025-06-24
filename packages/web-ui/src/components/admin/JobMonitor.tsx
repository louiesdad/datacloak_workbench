import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { Button } from '../ui/Button';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Filter,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import './JobMonitor.fixedapp.css';

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  data: any;
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: any;
}

export type JobType = 'sentiment_analysis_batch' | 'file_processing' | 'security_scan' | 'data_export' | 'large_dataset_risk_assessment' | 'batch_pattern_validation' | 'compliance_framework_analysis';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobPriority = 'low' | 'medium' | 'high' | 'critical';

interface JobStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

interface JobMonitorProps {
  websocket?: WebSocket;
  className?: string;
}

export const JobMonitor: React.FC<JobMonitorProps> = ({ websocket, className }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<JobStats>({
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0
  });
  const [selectedStatus, setSelectedStatus] = useState<JobStatus | 'all'>('all');
  const [selectedType, setSelectedType] = useState<JobType | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch jobs from API
  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      console.log('JobMonitor: Fetching jobs...');
      const response = await fetch('http://localhost:3001/api/v1/jobs');
      if (response.ok) {
        const data = await response.json();
        console.log('JobMonitor: Received data:', data);
        
        // Ensure we always get an array
        let jobsList: Job[] = [];
        if (Array.isArray(data)) {
          jobsList = data;
        } else if (data && typeof data === 'object') {
          if (Array.isArray(data.data?.jobs)) {
            jobsList = data.data.jobs;
          } else if (Array.isArray(data.data)) {
            jobsList = data.data;
          } else if (Array.isArray(data.jobs)) {
            jobsList = data.jobs;
          }
        }
        
        console.log('JobMonitor: Parsed jobs list:', jobsList);
        setJobs(jobsList);
        
        // Calculate stats from jobs
        const calculatedStats: JobStats = {
          total: jobsList.length,
          pending: jobsList.filter((j: Job) => j.status === 'pending').length,
          running: jobsList.filter((j: Job) => j.status === 'running').length,
          completed: jobsList.filter((j: Job) => j.status === 'completed').length,
          failed: jobsList.filter((j: Job) => j.status === 'failed').length,
          cancelled: jobsList.filter((j: Job) => j.status === 'cancelled').length
        };
        setStats(calculatedStats);
        console.log('JobMonitor: Updated jobs count:', jobsList.length, 'Stats:', calculatedStats);
      } else {
        console.error('JobMonitor: Failed to fetch jobs:', response.status, response.statusText);
        // Reset to empty array on error
        setJobs([]);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      // Reset to empty array on error
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchJobs();
    
    if (autoRefresh) {
      const interval = setInterval(fetchJobs, 2000); // Refresh every 2 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // WebSocket integration for real-time updates
  useEffect(() => {
    if (!websocket) {
      console.log('JobMonitor: No WebSocket connection available');
      return;
    }

    console.log('JobMonitor: Setting up WebSocket event listeners');

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        console.log('JobMonitor: Received WebSocket message:', message);
        
        switch (message.type) {
          case 'job:created':
          case 'job:progress':
          case 'job:completed':
          case 'job:failed':
          case 'job:cancelled':
            console.log('JobMonitor: Job event received, refreshing jobs list');
            // Fetch latest jobs when job events occur
            fetchJobs();
            break;
          default:
            // Also check for generic 'progress' or other job-related events
            if (message.jobId || message.type?.includes('job') || message.type?.includes('progress')) {
              console.log('JobMonitor: Generic job-related event, refreshing jobs list');
              fetchJobs();
            }
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error, event.data);
      }
    };

    websocket.addEventListener('message', handleMessage);
    
    return () => {
      websocket.removeEventListener('message', handleMessage);
    };
  }, [websocket]);

  // Job control actions
  const cancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/jobs/${jobId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchJobs();
      }
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  };

  const retryJob = async (jobId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/jobs/${jobId}/retry`, {
        method: 'POST'
      });
      if (response.ok) {
        fetchJobs();
      }
    } catch (error) {
      console.error('Failed to retry job:', error);
    }
  };

  const clearCompleted = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/jobs/clear-completed', {
        method: 'POST'
      });
      if (response.ok) {
        fetchJobs();
      }
    } catch (error) {
      console.error('Failed to clear completed jobs:', error);
    }
  };

  // Filter jobs based on selected criteria
  const filteredJobs = Array.isArray(jobs) ? jobs.filter(job => {
    if (selectedStatus !== 'all' && job.status !== selectedStatus) return false;
    if (selectedType !== 'all' && job.type !== selectedType) return false;
    return true;
  }) : [];

  // Get status badge variant
  const getStatusBadgeVariant = (status: JobStatus): string => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'running': return 'default';
      case 'completed': return 'success';
      case 'failed': return 'destructive';
      case 'cancelled': return 'outline';
      default: return 'secondary';
    }
  };

  // Get priority badge variant
  const getPriorityBadgeVariant = (priority: JobPriority): string => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  // Get status icon
  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'running': return <Play className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      case 'cancelled': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Format job type for display
  const formatJobType = (type: JobType): string => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className={`job-monitor ${className || ''}`}>
      {/* Header with controls */}
      <div className="job-monitor-header">
        <div className="header-left">
          <h2 className="text-2xl font-bold">Job Monitor</h2>
          <div className="stats-summary">
            <span className="stat-item">
              <span className="stat-label">Total:</span>
              <span className="stat-value">{stats.total}</span>
            </span>
            <span className="stat-item">
              <span className="stat-label">Running:</span>
              <span className="stat-value text-blue-600">{stats.running}</span>
            </span>
            <span className="stat-item">
              <span className="stat-label">Pending:</span>
              <span className="stat-value text-yellow-600">{stats.pending}</span>
            </span>
            <span className="stat-item">
              <span className="stat-label">Failed:</span>
              <span className="stat-value text-red-600">{stats.failed}</span>
            </span>
          </div>
        </div>
        
        <div className="header-controls">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'text-green-600' : ''}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchJobs}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={clearCompleted}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Completed
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="job-filters">
        <div className="filter-group">
          <label className="filter-label">Status:</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as JobStatus | 'all')}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label className="filter-label">Type:</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as JobType | 'all')}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="sentiment_analysis_batch">Sentiment Analysis</option>
            <option value="file_processing">File Processing</option>
            <option value="security_scan">Security Scan</option>
            <option value="data_export">Data Export</option>
            <option value="large_dataset_risk_assessment">Risk Assessment</option>
            <option value="batch_pattern_validation">Pattern Validation</option>
            <option value="compliance_framework_analysis">Compliance Analysis</option>
          </select>
        </div>
      </div>

      {/* Job queue status visualization */}
      <div className="queue-status">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Queue Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="queue-metrics">
              <div className="metric-item">
                <div className="metric-label">Queue Depth</div>
                <div className="metric-value">{stats.pending + stats.running}</div>
              </div>
              
              <div className="metric-item">
                <div className="metric-label">Active Jobs</div>
                <div className="metric-value">{stats.running}</div>
              </div>
              
              <div className="metric-item">
                <div className="metric-label">Success Rate</div>
                <div className="metric-value">
                  {stats.total > 0 ? Math.round((stats.completed / (stats.completed + stats.failed)) * 100) : 100}%
                </div>
              </div>
            </div>
            
            {/* Visual queue representation */}
            <div className="queue-visualization">
              <div className="queue-bar">
                <div 
                  className="queue-segment pending" 
                  style={{ width: `${(stats.pending / Math.max(stats.total, 1)) * 100}%` }}
                  title={`${stats.pending} pending jobs`}
                />
                <div 
                  className="queue-segment running" 
                  style={{ width: `${(stats.running / Math.max(stats.total, 1)) * 100}%` }}
                  title={`${stats.running} running jobs`}
                />
                <div 
                  className="queue-segment completed" 
                  style={{ width: `${(stats.completed / Math.max(stats.total, 1)) * 100}%` }}
                  title={`${stats.completed} completed jobs`}
                />
                <div 
                  className="queue-segment failed" 
                  style={{ width: `${(stats.failed / Math.max(stats.total, 1)) * 100}%` }}
                  title={`${stats.failed} failed jobs`}
                />
              </div>
              <div className="queue-legend">
                <span className="legend-item pending">Pending</span>
                <span className="legend-item running">Running</span>
                <span className="legend-item completed">Completed</span>
                <span className="legend-item failed">Failed</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Job history table */}
      <div className="job-table">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Job History ({filteredJobs.length} jobs)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredJobs.length === 0 ? (
              <div className="empty-state">
                <p>No jobs found matching the current filters.</p>
                {jobs.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    💡 Jobs will appear here when you start an analysis
                  </p>
                )}
              </div>
            ) : (
              <div className="table-container">
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Type</th>
                      <th>Priority</th>
                      <th>Progress</th>
                      <th>Created</th>
                      <th>Duration</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map(job => (
                      <tr key={job.id} className={`job-row status-${job.status}`}>
                        <td>
                          <div className="status-cell">
                            {getStatusIcon(job.status)}
                            <Badge variant={getStatusBadgeVariant(job.status)}>
                              {job.status}
                            </Badge>
                          </div>
                        </td>
                        
                        <td>
                          <div className="type-cell">
                            <span className="job-type">{formatJobType(job.type)}</span>
                            <span className="job-id">ID: {job.id.slice(0, 8)}</span>
                          </div>
                        </td>
                        
                        <td>
                          <Badge variant={getPriorityBadgeVariant(job.priority)}>
                            {job.priority}
                          </Badge>
                        </td>
                        
                        <td>
                          <div className="progress-cell">
                            <Progress value={job.progress} className="progress-bar" />
                            <span className="progress-text">{job.progress}%</span>
                          </div>
                        </td>
                        
                        <td>
                          <span className="timestamp">
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </span>
                        </td>
                        
                        <td>
                          <span className="duration">
                            {job.completedAt && job.startedAt
                              ? `${Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s`
                              : job.startedAt
                              ? `${Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000)}s`
                              : '-'
                            }
                          </span>
                        </td>
                        
                        <td>
                          <div className="job-actions">
                            {job.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => cancelJob(job.id)}
                                title="Cancel job"
                              >
                                <XCircle className="h-3 w-3" />
                              </Button>
                            )}
                            
                            {job.status === 'failed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => retryJob(job.id)}
                                title="Retry job"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            )}
                            
                            {job.error && (
                              <Button
                                variant="outline"
                                size="sm"
                                title={job.error}
                                className="error-button"
                              >
                                <AlertCircle className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};