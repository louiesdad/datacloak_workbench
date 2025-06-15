import React, { useState, useRef, useCallback } from 'react';
import { useLargeFileUpload, type UploadProgress, type UploadOptions } from '../hooks/useLargeFileUpload';
import { ProgressIndicator } from './ProgressIndicator';
import { ApiErrorDisplay } from './ApiErrorDisplay';
import { useNotifications } from './NotificationToast';
import './LargeFileUploader.css';

interface LargeFileUploaderProps {
  onUploadComplete?: (fileId: string, fileName: string) => void;
  onUploadError?: (error: any) => void;
  acceptedTypes?: string[];
  maxFileSize?: number;
  chunkSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface FileUploadState {
  file: File;
  progress: UploadProgress | null;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';
  result?: any;
  error?: any;
  uploadId?: string;
}

export const LargeFileUploader: React.FC<LargeFileUploaderProps> = ({
  onUploadComplete,
  onUploadError,
  acceptedTypes = ['.csv', '.json', '.txt', '.xlsx'],
  maxFileSize = 500 * 1024 * 1024, // 500MB
  chunkSize = 5 * 1024 * 1024, // 5MB
  multiple = false,
  disabled = false,
  className = '',
  children
}) => {
  const [fileStates, setFileStates] = useState<Map<string, FileUploadState>>(new Map());
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addNotification } = useNotifications();
  
  const { uploadFile, cancelUpload, resumeUpload, isUploading } = useLargeFileUpload();

  const updateFileState = (fileKey: string, updates: Partial<FileUploadState>) => {
    setFileStates(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(fileKey);
      if (existing) {
        newMap.set(fileKey, { ...existing, ...updates });
      }
      return newMap;
    });
  };

  const generateFileKey = (file: File): string => {
    return `${file.name}-${file.size}-${file.lastModified}`;
  };

  const validateFileType = (file: File): boolean => {
    if (acceptedTypes.length === 0) return true;
    
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    
    return acceptedTypes.some(type => {
      if (type.startsWith('.')) {
        return fileName.endsWith(type.toLowerCase());
      }
      return fileType.includes(type.toLowerCase());
    });
  };

  const handleFileUpload = useCallback(async (files: FileList) => {
    const filesToUpload = Array.from(files);
    
    // Validate files
    for (const file of filesToUpload) {
      const fileKey = generateFileKey(file);
      
      if (!validateFileType(file)) {
        addNotification({
          type: 'error',
          message: `${file.name}: Unsupported file type. Accepted types: ${acceptedTypes.join(', ')}`,
          duration: 5000
        });
        continue;
      }

      if (file.size > maxFileSize) {
        addNotification({
          type: 'error',
          message: `${file.name}: File too large. Maximum size: ${formatFileSize(maxFileSize)}`,
          duration: 5000
        });
        continue;
      }

      // Initialize file state
      setFileStates(prev => new Map(prev).set(fileKey, {
        file,
        progress: null,
        status: 'pending'
      }));

      // Start upload
      updateFileState(fileKey, { status: 'uploading' });

      try {
        const uploadOptions: UploadOptions = {
          chunkSize,
          maxFileSize,
          allowedTypes: acceptedTypes,
          validateContent: true,
          onProgress: (progress) => {
            updateFileState(fileKey, { progress });
          },
          onChunkComplete: (chunkIndex, totalChunks) => {
            // Could show detailed chunk progress here
          }
        };

        const result = await uploadFile(file, uploadOptions);

        if (result.success) {
          updateFileState(fileKey, { 
            status: 'completed', 
            result,
            progress: {
              loaded: file.size,
              total: file.size,
              percentage: 100,
              speed: 0,
              remainingTime: 0,
              stage: 'complete'
            }
          });

          if (onUploadComplete && result.fileId) {
            onUploadComplete(result.fileId, result.fileName);
          }

          addNotification({
            type: 'success',
            message: `${file.name} uploaded successfully`,
            duration: 4000
          });

        } else {
          updateFileState(fileKey, { 
            status: 'error', 
            error: result.error,
            progress: {
              loaded: 0,
              total: file.size,
              percentage: 0,
              speed: 0,
              remainingTime: 0,
              stage: 'error'
            }
          });

          if (onUploadError) {
            onUploadError(result.error);
          }
        }

      } catch (error) {
        updateFileState(fileKey, { 
          status: 'error', 
          error,
          progress: {
            loaded: 0,
            total: file.size,
            percentage: 0,
            speed: 0,
            remainingTime: 0,
            stage: 'error'
          }
        });

        if (onUploadError) {
          onUploadError(error);
        }
      }
    }
  }, [uploadFile, acceptedTypes, maxFileSize, chunkSize, onUploadComplete, onUploadError, addNotification]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      if (!multiple && files.length > 1) {
        addNotification({
          type: 'warning',
          message: 'Only one file can be uploaded at a time',
          duration: 3000
        });
        return;
      }
      handleFileUpload(files);
    }
  };

  const handleCancelUpload = (fileKey: string) => {
    updateFileState(fileKey, { status: 'cancelled' });
    cancelUpload();
  };

  const handleRetryUpload = (fileKey: string) => {
    const fileState = fileStates.get(fileKey);
    if (fileState) {
      handleFileUpload(new FileList([fileState.file] as any));
    }
  };

  const handleRemoveFile = (fileKey: string) => {
    setFileStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileKey);
      return newMap;
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatFileSize(bytesPerSecond)}/s`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const renderFileProgress = (fileKey: string, fileState: FileUploadState) => {
    const { file, progress, status, error } = fileState;

    return (
      <div key={fileKey} className={`file-upload-item ${status}`}>
        <div className="file-info">
          <div className="file-name" title={file.name}>
            {file.name}
          </div>
          <div className="file-size">
            {formatFileSize(file.size)}
          </div>
        </div>

        {progress && (
          <div className="upload-progress">
            <ProgressIndicator
              value={progress.percentage}
              size="medium"
              showPercentage
              label={
                progress.stage === 'uploading' && progress.speed > 0
                  ? `${formatSpeed(progress.speed)} • ${formatTime(progress.remainingTime)} remaining`
                  : progress.stage
              }
              className="file-progress-bar"
            />
          </div>
        )}

        <div className="upload-actions">
          {status === 'uploading' && (
            <button
              className="cancel-button"
              onClick={() => handleCancelUpload(fileKey)}
              title="Cancel upload"
            >
              ✕
            </button>
          )}
          
          {status === 'error' && (
            <>
              <button
                className="retry-button"
                onClick={() => handleRetryUpload(fileKey)}
                title="Retry upload"
              >
                ↻
              </button>
              <button
                className="remove-button"
                onClick={() => handleRemoveFile(fileKey)}
                title="Remove file"
              >
                ✕
              </button>
            </>
          )}
          
          {(status === 'completed' || status === 'cancelled') && (
            <button
              className="remove-button"
              onClick={() => handleRemoveFile(fileKey)}
              title="Remove file"
            >
              ✕
            </button>
          )}
        </div>

        {status === 'error' && error && (
          <div className="upload-error">
            <ApiErrorDisplay
              error={error}
              context="File Upload"
              onRetry={() => handleRetryUpload(fileKey)}
              onDismiss={() => handleRemoveFile(fileKey)}
              showDetails={false}
              className="compact-error"
            />
          </div>
        )}

        {status === 'completed' && (
          <div className="upload-success">
            <span className="success-icon">✓</span>
            <span className="success-message">Upload completed</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`large-file-uploader ${className}`}>
      <div
        className={`upload-area ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          multiple={multiple}
          onChange={handleFileSelect}
          disabled={disabled}
          style={{ display: 'none' }}
        />

        {children || (
          <div className="upload-content">
            <div className="upload-icon">📁</div>
            <div className="upload-text">
              <div className="primary-text">
                {isDragOver ? 'Drop files here' : 'Choose files to upload'}
              </div>
              <div className="secondary-text">
                Drag and drop files here, or click to browse
              </div>
              <div className="file-restrictions">
                <div>Supported formats: {acceptedTypes.join(', ')}</div>
                <div>Maximum file size: {formatFileSize(maxFileSize)}</div>
                {multiple && <div>Multiple files allowed</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {fileStates.size > 0 && (
        <div className="upload-queue">
          <div className="queue-header">
            <h4>Upload Queue ({fileStates.size} files)</h4>
            <div className="queue-stats">
              {Array.from(fileStates.values()).filter(s => s.status === 'completed').length} completed,{' '}
              {Array.from(fileStates.values()).filter(s => s.status === 'uploading').length} uploading,{' '}
              {Array.from(fileStates.values()).filter(s => s.status === 'error').length} failed
            </div>
          </div>
          
          <div className="file-list">
            {Array.from(fileStates.entries()).map(([fileKey, fileState]) =>
              renderFileProgress(fileKey, fileState)
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LargeFileUploader;