import React, { useState, useRef } from 'react';
import './FileUploadPreview.css';

interface FileUploadPreviewProps {
  onUploadComplete?: (fileId: string, fileName: string) => void;
  onStartPreview?: (file: File, options: { mode: string; rows: number }) => void;
  acceptedFileTypes?: string[];
  maxFileSizeGB?: number;
}

interface TimeEstimates {
  quickPreview: string;
  statisticalSample: string;
  fullAnalysis: string;
  estimatedRows: number;
}

// Constants based on PRD requirements
const BYTES_PER_ROW_AVERAGE = 5000; // 25GB = 5M rows
const HOURS_PER_MILLION_ROWS = 2.8; // ~357K rows/hour
const PREVIEW_ROWS = 1000;
const SAMPLE_ROWS = 10000;

export const FileUploadPreview: React.FC<FileUploadPreviewProps> = ({
  onUploadComplete,
  onStartPreview,
  acceptedFileTypes = ['.csv', '.xlsx', '.tsv', '.txt'],
  maxFileSizeGB = 50
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateTimeEstimates = (fileSize: number): TimeEstimates => {
    const estimatedRows = Math.round(fileSize / BYTES_PER_ROW_AVERAGE);
    const millionRows = estimatedRows / 1000000;
    const hoursForFullAnalysis = Math.round(millionRows * HOURS_PER_MILLION_ROWS);
    
    return {
      quickPreview: '~5 minutes',
      statisticalSample: '~30 minutes',
      fullAnalysis: `~${hoursForFullAnalysis} hours`,
      estimatedRows
    };
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type and size
      if (!isValidFileType(file)) {
        alert(`Invalid file type. Accepted types: ${acceptedFileTypes.join(', ')}`);
        return;
      }
      
      if (!isValidFileSize(file)) {
        alert(`File too large. Maximum size: ${maxFileSizeGB}GB`);
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleQuickPreview = () => {
    if (selectedFile && onStartPreview) {
      onStartPreview(selectedFile, {
        mode: 'preview',
        rows: PREVIEW_ROWS
      });
    }
  };

  const handleFullProcess = () => {
    if (selectedFile && onUploadComplete) {
      // This would trigger full file processing
      onUploadComplete('file-id', selectedFile.name);
    }
  };
  
  const isValidFileType = (file: File): boolean => {
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    return acceptedFileTypes.some(type => type.toLowerCase() === fileExtension);
  };
  
  const isValidFileSize = (file: File): boolean => {
    const fileSizeGB = file.size / (1024 * 1024 * 1024);
    return fileSizeGB <= maxFileSizeGB;
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="file-upload-preview">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        data-testid="file-input"
      />

      {selectedFile && (
        <div className="file-info">
          <h3>File: {selectedFile.name} ({formatFileSize(selectedFile.size)})</h3>
          
          <div className="time-estimates">
            {(() => {
              const estimates = calculateTimeEstimates(selectedFile.size);
              return (
                <>
                  <p>⚡ Quick Preview: {estimates.quickPreview} (first 1,000 rows)</p>
                  <p>📊 Statistical Sample: {estimates.statisticalSample} (10,000 rows)</p>
                  <p>✓ Full Analysis: {estimates.fullAnalysis} ({Math.round(estimates.estimatedRows / 1000000)} million rows)</p>
                </>
              );
            })()}
          </div>

          <div className="action-buttons">
            <button onClick={handleQuickPreview}>Start Quick Preview</button>
            <button onClick={handleFullProcess}>Process Full File</button>
          </div>

          <div className="info-message">
            ℹ️ You'll see initial results in 5 minutes and can decide whether to continue with full processing
          </div>
        </div>
      )}
    </div>
  );
};