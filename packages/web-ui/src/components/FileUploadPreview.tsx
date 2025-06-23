import React, { useState, useRef } from 'react';
import './FileUploadPreview.css';

interface FileUploadPreviewProps {
  onUploadComplete?: (fileId: string, fileName: string) => void;
  onStartPreview?: (file: File, options: { mode: string; rows: number }) => void;
}

export const FileUploadPreview: React.FC<FileUploadPreviewProps> = ({
  onUploadComplete,
  onStartPreview
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateTimeEstimates = (fileSize: number) => {
    // Simple calculation based on PRD requirements
    // Assuming ~10MB/s processing speed for OpenAI API
    const bytesPerSecond = 10 * 1024 * 1024; // 10MB/s
    const fullProcessingTime = fileSize / bytesPerSecond;
    
    return {
      quickPreview: '~5 minutes', // Fixed for first 1000 rows
      statisticalSample: '~30 minutes', // Fixed for 10000 rows
      fullAnalysis: `~${Math.round(fullProcessingTime / 3600)} hours` // Calculate based on file size
    };
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleQuickPreview = () => {
    if (selectedFile && onStartPreview) {
      onStartPreview(selectedFile, {
        mode: 'preview',
        rows: 1000
      });
    }
  };

  const handleFullProcess = () => {
    if (selectedFile && onUploadComplete) {
      // This would trigger full file processing
      onUploadComplete('file-id', selectedFile.name);
    }
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
                  <p>✓ Full Analysis: {estimates.fullAnalysis} ({Math.round(selectedFile.size / (1024 * 1024 * 1024) * 0.2)} million rows)</p>
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