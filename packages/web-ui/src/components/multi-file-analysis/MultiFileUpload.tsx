import React, { useState, useRef } from 'react';
import { multiFileAnalysisApi } from '../../services/api';
import type { FileMetadata } from '../../services/api';

interface UploadedFile extends FileMetadata {
  uploadProgress?: number;
  error?: string;
}

interface MultiFileUploadProps {
  sessionId: string;
  maxSizeMB?: number;
  onFileRemoved?: (fileId: string) => void;
  onFilesUploaded?: (files: FileMetadata[]) => void;
}

export const MultiFileUpload: React.FC<MultiFileUploadProps> = ({
  sessionId,
  maxSizeMB = 100,
  onFileRemoved,
  onFilesUploaded
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<Map<string, UploadedFile>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showColumns, setShowColumns] = useState<Map<string, boolean>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return 'Only CSV files are allowed';
    }

    // Check file size
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Add file with initial progress
    setUploadedFiles(prev => new Map(prev).set(file.name, {
      fileId: '',
      filename: file.name,
      rowCount: 0,
      columns: [],
      potentialKeys: [],
      uploadProgress: 0
    }));

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadedFiles(prev => {
          const updated = new Map(prev);
          const current = updated.get(file.name);
          if (current && current.uploadProgress! < 90) {
            current.uploadProgress = current.uploadProgress! + 10;
            updated.set(file.name, current);
          }
          return updated;
        });
      }, 100);

      const metadata = await multiFileAnalysisApi.stageFile(sessionId, file);
      
      clearInterval(progressInterval);

      // Update with complete metadata
      setUploadedFiles(prev => {
        const updated = new Map(prev);
        updated.set(file.name, {
          ...metadata,
          uploadProgress: 100
        });
        return updated;
      });

      // Notify parent
      const allFiles = Array.from(uploadedFiles.values()).filter(f => f.fileId);
      allFiles.push(metadata);
      onFilesUploaded?.(allFiles);

    } catch (error) {
      setUploadedFiles(prev => {
        const updated = new Map(prev);
        updated.set(file.name, {
          fileId: '',
          filename: file.name,
          rowCount: 0,
          columns: [],
          potentialKeys: [],
          error: `Failed to upload ${file.name}`
        });
        return updated;
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setError(null);
    
    for (const file of files) {
      await uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await uploadFile(file);
    }
  };

  const handleRemoveFile = (filename: string) => {
    const file = uploadedFiles.get(filename);
    if (file && file.fileId) {
      onFileRemoved?.(file.fileId);
    }
    
    setUploadedFiles(prev => {
      const updated = new Map(prev);
      updated.delete(filename);
      return updated;
    });

    // Clean up show columns state
    setShowColumns(prev => {
      const updated = new Map(prev);
      updated.delete(filename);
      return updated;
    });
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const toggleColumns = (filename: string) => {
    setShowColumns(prev => {
      const newMap = new Map(prev);
      newMap.set(filename, !newMap.get(filename));
      return newMap;
    });
  };

  const renderFileMetadata = (file: UploadedFile) => {
    const isShowingColumns = showColumns.get(file.filename) || false;

    if (file.error) {
      return (
        <div className="file-error">
          <p>{file.error}</p>
          <button onClick={() => handleRemoveFile(file.filename)}>Retry</button>
        </div>
      );
    }

    if (file.uploadProgress !== undefined && file.uploadProgress < 100) {
      return (
        <div className="file-progress">
          <progress
            data-testid={`progress-${file.filename}`}
            value={file.uploadProgress}
            max="100"
          />
          <span>{file.uploadProgress}%</span>
        </div>
      );
    }

    // Ensure we have the required data before rendering details
    if (!file.fileId || file.rowCount === undefined || !file.columns) {
      return (
        <div className="file-loading">
          Loading file metadata...
        </div>
      );
    }

    return (
      <div className="file-details">
        <div className="file-summary">
          <span>{formatNumber(file.rowCount)} rows</span>
          <span>{file.columns.length} columns</span>
          {file.potentialKeys && file.potentialKeys.length > 0 && (
            <span>Potential keys: {file.potentialKeys.join(', ')}</span>
          )}
        </div>
        
        <button onClick={() => toggleColumns(file.filename)}>
          {isShowingColumns ? 'Hide' : 'Show'} columns
        </button>
        
        {isShowingColumns && file.columns && (
          <div className="column-list">
            {file.columns.map(col => (
              <div key={col.name} className="column-item">
                <span>{col.name} ({col.dataType})</span>
                <span>{Math.round((col.uniqueness || 0) * 100)}% unique</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="multi-file-upload">
      <div
        className={`drop-zone ${isDragging ? 'drag-over' : ''}`}
        data-testid="drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv"
          onChange={handleFileSelect}
          data-testid="file-input"
          style={{ display: 'none' }}
        />
        
        <p>Drag and drop CSV files here or click to browse</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {uploadedFiles.size > 0 && (
        <div className="uploaded-files">
          <progress
            data-testid="upload-progress"
            value={Array.from(uploadedFiles.values()).reduce((sum, f) => sum + (f.uploadProgress || 0), 0)}
            max={uploadedFiles.size * 100}
          />
          
          {Array.from(uploadedFiles.entries()).map(([filename, file]) => (
            <div key={filename} className="file-item">
              <div className="file-header">
                <h4>{filename}</h4>
                <button
                  onClick={() => handleRemoveFile(filename)}
                  aria-label={`Remove ${filename}`}
                >
                  ×
                </button>
              </div>
              {renderFileMetadata(file)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};