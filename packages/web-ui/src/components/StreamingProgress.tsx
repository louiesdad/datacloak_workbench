import React, { useEffect, useState } from 'react';
import './StreamingProgress.css';

export interface StreamingProgressProps {
  filename: string;
  datasetId: string;
  onComplete?: (stats: StreamingStats) => void;
  onError?: (error: string) => void;
}

export interface StreamingStats {
  totalRows: number;
  totalBytes: number;
  chunksProcessed: number;
  processingTime: number;
  piiSummary?: {
    totalPIIItems: number;
    piiTypes: Record<string, number>;
    fieldsWithPII: string[];
  };
}

interface ProgressState {
  bytesProcessed: number;
  totalBytes: number;
  rowsProcessed: number;
  chunksProcessed: number;
  totalChunks: number;
  percentComplete: number;
  estimatedTimeRemaining?: number;
  averageRowsPerSecond?: number;
  piiDetected: number;
  memoryUsageMB?: number;
}

export const StreamingProgress: React.FC<StreamingProgressProps> = ({
  filename,
  datasetId,
  onComplete,
  onError
}) => {
  const [progress, setProgress] = useState<ProgressState>({
    bytesProcessed: 0,
    totalBytes: 0,
    rowsProcessed: 0,
    chunksProcessed: 0,
    totalChunks: 0,
    percentComplete: 0,
    piiDetected: 0
  });
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Connect to streaming endpoint using Server-Sent Events
    const eventSource = new EventSource(
      `/api/v1/stream/process/${filename}`,
      {
        withCredentials: true
      }
    );

    eventSource.addEventListener('connected', (event) => {
      console.log('Streaming connected:', event.data);
    });

    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setProgress(prev => ({
        ...prev,
        ...data
      }));
    });

    eventSource.addEventListener('chunk', (event) => {
      const data = JSON.parse(event.data);
      setProgress(prev => ({
        ...prev,
        chunksProcessed: data.chunksProcessed || prev.chunksProcessed,
        rowsProcessed: data.totalRowsProcessed || prev.rowsProcessed,
        piiDetected: prev.piiDetected + (data.piiDetected || 0)
      }));
    });

    eventSource.addEventListener('pii-detected', (event) => {
      const data = JSON.parse(event.data);
      setProgress(prev => ({
        ...prev,
        piiDetected: data.totalPIIDetected || prev.piiDetected
      }));
    });

    eventSource.addEventListener('complete', (event) => {
      const stats: StreamingStats = JSON.parse(event.data);
      setIsComplete(true);
      if (onComplete) {
        onComplete(stats);
      }
      eventSource.close();
    });

    eventSource.addEventListener('error', (event) => {
      console.error('Streaming error:', event);
      if (event.data) {
        const errorData = JSON.parse(event.data);
        setError(errorData.error || 'Unknown streaming error');
        if (onError) {
          onError(errorData.error);
        }
      }
      eventSource.close();
    });

    // Monitor memory usage periodically
    const memoryInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/v1/stream/memory');
        const data = await response.json();
        if (data.data?.process?.heapUsed) {
          setProgress(prev => ({
            ...prev,
            memoryUsageMB: data.data.process.heapUsed
          }));
        }
      } catch (err) {
        console.warn('Failed to fetch memory stats:', err);
      }
    }, 5000);

    return () => {
      eventSource.close();
      clearInterval(memoryInterval);
    };
  }, [filename, datasetId, onComplete, onError]);

  const formatTime = (ms?: number): string => {
    if (!ms) return '--:--';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  if (error) {
    return (
      <div className="streaming-progress error">
        <div className="error-icon">⚠️</div>
        <h3>Streaming Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="streaming-progress complete">
        <div className="complete-icon">✅</div>
        <h3>Processing Complete</h3>
        <div className="stats">
          <div className="stat">
            <span className="label">Rows Processed:</span>
            <span className="value">{progress.rowsProcessed.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="label">PII Items Found:</span>
            <span className="value">{progress.piiDetected}</span>
          </div>
          <div className="stat">
            <span className="label">Processing Speed:</span>
            <span className="value">
              {progress.averageRowsPerSecond?.toLocaleString() || 0} rows/sec
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="streaming-progress">
      <h3>Processing File: {filename}</h3>
      
      <div className="progress-bar-container">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${progress.percentComplete}%` }}
          />
        </div>
        <div className="progress-text">{progress.percentComplete.toFixed(1)}%</div>
      </div>

      <div className="progress-stats">
        <div className="stat-row">
          <div className="stat">
            <span className="label">Rows:</span>
            <span className="value">{progress.rowsProcessed.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="label">Chunks:</span>
            <span className="value">
              {progress.chunksProcessed} / {progress.totalChunks}
            </span>
          </div>
          <div className="stat">
            <span className="label">Speed:</span>
            <span className="value">
              {progress.averageRowsPerSecond?.toLocaleString() || 0} rows/sec
            </span>
          </div>
        </div>

        <div className="stat-row">
          <div className="stat">
            <span className="label">Data Processed:</span>
            <span className="value">
              {formatBytes(progress.bytesProcessed)} / {formatBytes(progress.totalBytes)}
            </span>
          </div>
          <div className="stat">
            <span className="label">Time Remaining:</span>
            <span className="value">{formatTime(progress.estimatedTimeRemaining)}</span>
          </div>
          <div className="stat">
            <span className="label">PII Detected:</span>
            <span className="value highlight-warning">{progress.piiDetected}</span>
          </div>
        </div>

        {progress.memoryUsageMB && (
          <div className="stat-row">
            <div className="stat full-width">
              <span className="label">Memory Usage:</span>
              <span className={`value ${progress.memoryUsageMB > 400 ? 'highlight-warning' : ''}`}>
                {progress.memoryUsageMB.toFixed(0)} MB
              </span>
              {progress.memoryUsageMB > 400 && (
                <span className="warning-text"> (High usage detected)</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};