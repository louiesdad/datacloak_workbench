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
    // Calculate time estimates based on PRD requirements:
    // - Quick Preview: First 1,000 rows in ~5 minutes
    // - Statistical Sample: 10,000 rows in ~30 minutes  
    // - Full Analysis: Based on file size and OpenAI API speed constraints
    
    // Estimate rows based on file size 
    // PRD states 25GB = 5M rows, so ~5000 bytes per row average
    const estimatedRows = Math.round(fileSize / 5000);
    const millionRows = estimatedRows / 1000000;
    
    // OpenAI API processing rate from PRD:
    // 25GB file = 5M rows = ~14 hours
    // This gives us ~6K rows/minute or 357K rows/hour
    const hoursForFullAnalysis = Math.round(millionRows * 2.8); // 2.8 hours per million rows
    
    return {
      quickPreview: '~5 minutes', // Fixed for first 1000 rows
      statisticalSample: '~30 minutes', // Fixed for 10000 rows
      fullAnalysis: `~${hoursForFullAnalysis} hours`,
      estimatedRows: estimatedRows
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