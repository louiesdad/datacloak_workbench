import React, { useState, useEffect, useRef } from 'react';
import './ProgressDashboard.css';

interface ProgressDashboardProps {
  jobId: string;
  onComplete?: (results: any) => void;
  onError?: (error: string) => void;
}

interface ProgressState {
  progress: number;
  stage: string;
  details?: string;
  timeEstimate?: {
    elapsed: number;
    remaining: number;
    total: number;
  };
}

interface PartialResults {
  rowsProcessed?: number;
  avgSentiment?: number;
  topKeywords?: string[];
  downloadUrl?: string;
}

interface ProcessingStage {
  name: string;
  progress: number;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  jobId,
  onComplete,
  onError
}) => {
  // Component state
  const [progress, setProgress] = useState<ProgressState>({
    progress: 0,
    stage: 'Initializing...'
  });
  const [partialResults, setPartialResults] = useState<PartialResults | null>(null);
  const [stages, setStages] = useState<ProcessingStage[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection and message handling
  useEffect(() => {
    const ws = establishWebSocketConnection(jobId);
    wsRef.current = ws;

    const handleOpen = () => setConnectionStatus('connected');
    const handleMessage = (event: MessageEvent) => handleWebSocketMessage(event, {
      setProgress,
      setPartialResults,
      setStages,
      setIsCompleted,
      setError,
      setConnectionStatus,
      onComplete,
      onError
    });
    const handleError = () => setConnectionStatus('error');
    const handleClose = () => {
      if (connectionStatus === 'connected' && !isCompleted && !error) {
        setConnectionStatus('error');
      }
    };

    ws.addEventListener('open', handleOpen);
    ws.addEventListener('message', handleMessage);
    ws.addEventListener('error', handleError);
    ws.addEventListener('close', handleClose);

    return () => {
      ws.removeEventListener('open', handleOpen);
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('error', handleError);
      ws.removeEventListener('close', handleClose);
      ws.close();
    };
  }, [jobId, onComplete, onError, connectionStatus, isCompleted, error]);

  // Job control handlers
  const handlePause = () => handleJobAction(jobId, 'pause', () => setIsPaused(true));
  const handleResume = () => handleJobAction(jobId, 'resume', () => setIsPaused(false));
  const handleCancel = () => handleJobAction(jobId, 'cancel', () => setShowCancelDialog(false));

  const handleDownloadPartial = () => {
    if (partialResults?.downloadUrl) {
      window.open(partialResults.downloadUrl);
    }
  };

  if (error) {
    return (
      <div className="progress-dashboard error-state">
        <h2>Error occurred</h2>
        <p className="error-message">{error}</p>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="progress-dashboard">
      <div className="header">
        <h2>Analysis Progress</h2>
        {connectionStatus === 'error' && (
          <div className="connection-status error">
            Connection lost. Retrying...
          </div>
        )}
      </div>

      <div className="progress-section">
        <div className="progress-bar-container">
          <div 
            className="progress-bar" 
            role="progressbar" 
            aria-valuenow={progress.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div 
              className="progress-fill" 
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <div className="progress-text">
            <span className="percentage">{progress.progress}%</span>
            <span className="stage">{progress.stage}</span>
          </div>
        </div>
        
        {progress.details && (
          <p className="progress-details">{progress.details}</p>
        )}

        {progress.timeEstimate && (
          <div className="time-estimates">
            <span>Elapsed: {formatTime(progress.timeEstimate.elapsed)}</span>
            <span>ETA: {formatTime(progress.timeEstimate.remaining)}</span>
          </div>
        )}
      </div>

      {stages.length > 0 && (
        <div className="stages-section">
          <h3>Processing Stages</h3>
          <div className="stages-list">
            {stages.map((stage, index) => (
              <div key={index} className={`stage-item ${stage.status}`}>
                <span className="stage-icon">{getStatusIcon(stage.status)}</span>
                <span className="stage-name">{stage.name}</span>
                {stage.status === 'in_progress' && (
                  <span className="stage-progress">{stage.progress}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {partialResults && (
        <div className="partial-results">
          <h3>Partial Results Available</h3>
          <div className="results-summary">
            {partialResults.rowsProcessed && (
              <p>{partialResults.rowsProcessed.toLocaleString()} rows processed</p>
            )}
            {partialResults.avgSentiment && (
              <p>Average Sentiment: {partialResults.avgSentiment}</p>
            )}
            {partialResults.topKeywords && (
              <p>Top Keywords: {partialResults.topKeywords.join(', ')}</p>
            )}
          </div>
          <button onClick={handleDownloadPartial} className="download-button">
            Download Partial Results
          </button>
        </div>
      )}

      {isCompleted && (
        <div className="completion-section">
          <h3>Analysis Complete!</h3>
          <button className="download-button primary">
            Download Results
          </button>
        </div>
      )}

      <div className="controls">
        {!isCompleted && !isPaused && (
          <button onClick={handlePause} className="control-button">
            Pause
          </button>
        )}
        {!isCompleted && isPaused && (
          <button onClick={handleResume} className="control-button primary">
            Resume
          </button>
        )}
        {!isCompleted && (
          <button 
            onClick={() => setShowCancelDialog(true)} 
            className="control-button danger"
          >
            Cancel
          </button>
        )}
      </div>

      {showCancelDialog && (
        <div className="modal-overlay">
          <div className="cancel-dialog">
            <h3>Cancel Analysis</h3>
            <p>Are you sure you want to cancel this analysis?</p>
            <div className="dialog-actions">
              <button 
                onClick={() => setShowCancelDialog(false)}
                className="control-button"
              >
                No, Continue
              </button>
              <button 
                onClick={handleCancel}
                className="control-button danger"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions
function establishWebSocketConnection(jobId: string): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/progress/${jobId}`;
  return new WebSocket(wsUrl);
}

interface MessageHandlers {
  setProgress: React.Dispatch<React.SetStateAction<ProgressState>>;
  setPartialResults: React.Dispatch<React.SetStateAction<PartialResults | null>>;
  setStages: React.Dispatch<React.SetStateAction<ProcessingStage[]>>;
  setIsCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setConnectionStatus: React.Dispatch<React.SetStateAction<'connecting' | 'connected' | 'error'>>;
  onComplete?: (results: any) => void;
  onError?: (error: string) => void;
}

function handleWebSocketMessage(event: MessageEvent, handlers: MessageHandlers): void {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'progress':
      handlers.setProgress({
        progress: data.progress,
        stage: data.stage,
        details: data.details,
        timeEstimate: data.timeEstimate
      });
      break;
      
    case 'partial_results':
      handlers.setPartialResults({
        rowsProcessed: data.results?.rowsProcessed,
        avgSentiment: data.results?.avgSentiment,
        topKeywords: data.results?.topKeywords,
        downloadUrl: data.downloadUrl
      });
      break;
      
    case 'stage_update':
      handlers.setStages(data.stages);
      break;
      
    case 'complete':
      handlers.setIsCompleted(true);
      handlers.setProgress(prev => ({ ...prev, progress: 100 }));
      if (handlers.onComplete) {
        handlers.onComplete(data.results);
      }
      break;
      
    case 'error':
      handlers.setError(data.error);
      handlers.setConnectionStatus('error');
      if (handlers.onError) {
        handlers.onError(data.error);
      }
      break;
  }
}

async function handleJobAction(
  jobId: string,
  action: 'pause' | 'resume' | 'cancel',
  onSuccess: () => void
): Promise<void> {
  try {
    const response = await fetch(`/api/jobs/${jobId}/${action}`, {
      method: 'POST'
    });
    
    if (response.ok) {
      onSuccess();
    } else {
      console.error(`Failed to ${action} job:`, response.statusText);
    }
  } catch (err) {
    console.error(`Failed to ${action} job:`, err);
  }
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function getStatusIcon(status: ProcessingStage['status']): string {
  switch (status) {
    case 'completed':
      return '✓';
    case 'error':
      return '✗';
    case 'in_progress':
      return '⟳';
    default:
      return '○';
  }
}