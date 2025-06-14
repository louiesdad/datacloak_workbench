import React, { useState, useCallback, useRef } from 'react';
import type { FileInfo } from '../platform-bridge';
import './DataSourcePicker.css';

interface DataSourcePickerProps {
  onFilesSelected: (files: FileInfo[]) => void;
  maxSizeGB?: number;
  acceptedFormats?: string[];
}

interface FileValidationResult {
  valid: boolean;
  error?: string;
  file?: FileInfo;
}

export const DataSourcePicker: React.FC<DataSourcePickerProps> = ({
  onFilesSelected,
  maxSizeGB = 50,
  acceptedFormats = ['.csv', '.xlsx', '.xls', '.tsv']
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<FileValidationResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const validateFiles = async (filePaths: string[]): Promise<FileValidationResult[]> => {
    const results: FileValidationResult[] = [];
    
    for (const path of filePaths) {
      try {
        const fileInfo = await window.platformBridge.fileSystem?.getFileInfo(path);
        if (!fileInfo) {
          results.push({ valid: false, error: 'Could not read file information' });
          continue;
        }

        // Check file size
        const sizeInGB = fileInfo.size / (1024 * 1024 * 1024);
        if (sizeInGB > maxSizeGB) {
          results.push({
            valid: false,
            error: `File too large: ${formatFileSize(fileInfo.size)} (max: ${maxSizeGB}GB)`,
            file: fileInfo
          });
          continue;
        }

        // Check file format
        const extension = fileInfo.name.toLowerCase().substring(fileInfo.name.lastIndexOf('.'));
        if (!acceptedFormats.includes(extension)) {
          results.push({
            valid: false,
            error: `Unsupported format: ${extension}. Supported: ${acceptedFormats.join(', ')}`,
            file: fileInfo
          });
          continue;
        }

        // Additional validation through platform bridge
        const validation = await window.platformBridge.fileSystem?.validateFile(path, maxSizeGB);
        if (!validation?.valid) {
          results.push({
            valid: false,
            error: validation?.error || 'File validation failed',
            file: fileInfo
          });
          continue;
        }

        results.push({ valid: true, file: fileInfo });
      } catch (error) {
        results.push({
          valid: false,
          error: `Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    return results;
  };

  const handleFilesSelected = useCallback(async (filePaths: string[]) => {
    if (filePaths.length === 0) return;
    
    setIsValidating(true);
    setValidationResults([]);
    
    try {
      const results = await validateFiles(filePaths);
      setValidationResults(results);
      
      const validFiles = results
        .filter(result => result.valid && result.file)
        .map(result => result.file!);
      
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    } catch (error) {
      console.error('Error validating files:', error);
      setValidationResults([{
        valid: false,
        error: 'Failed to validate files'
      }]);
    } finally {
      setIsValidating(false);
    }
  }, [onFilesSelected, maxSizeGB, acceptedFormats]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    // In Electron, we need to handle file drops through the main process
    if (window.platformBridge.capabilities.platform === 'electron') {
      // Electron will handle the drop event and send us the file paths
      const files = Array.from(e.dataTransfer.files);
      const filePaths = files.map(file => (file as any).path).filter(Boolean);
      if (filePaths.length > 0) {
        await handleFilesSelected(filePaths);
      }
    } else {
      // Browser fallback (limited functionality)
      console.warn('File drop not fully supported in browser mode');
    }
  }, [handleFilesSelected]);

  const handleFileSelect = useCallback(async () => {
    if (!window.platformBridge.fileSystem) {
      console.warn('File system access not available');
      return;
    }

    try {
      const filters = [{
        name: 'Data Files',
        extensions: acceptedFormats.map(ext => ext.replace('.', ''))
      }];

      const filePaths = await window.platformBridge.fileSystem.selectFiles(filters);
      if (filePaths.length > 0) {
        await handleFilesSelected(filePaths);
      }
    } catch (error) {
      console.error('Error selecting files:', error);
    }
  }, [handleFilesSelected, acceptedFormats]);

  return (
    <div className="data-source-picker">
      <div
        className={`drop-zone ${isDragOver ? 'drag-over' : ''} ${isValidating ? 'validating' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="drop-zone-content">
          <div className="drop-zone-icon">📁</div>
          <h3>Select Data Files</h3>
          <p>
            Drag and drop files here or{' '}
            <button
              type="button"
              className="link-button"
              onClick={handleFileSelect}
              disabled={isValidating}
            >
              browse files
            </button>
          </p>
          <div className="file-requirements">
            <div className="requirement">
              <strong>Supported formats:</strong> {acceptedFormats.join(', ')}
            </div>
            <div className="requirement">
              <strong>Maximum size:</strong> {maxSizeGB}GB per file
            </div>
          </div>
        </div>
        
        {isValidating && (
          <div className="validation-overlay">
            <div className="spinner"></div>
            <p>Validating files...</p>
          </div>
        )}
      </div>

      {validationResults.length > 0 && (
        <div className="validation-results">
          <h4>File Validation Results</h4>
          {validationResults.map((result, index) => (
            <div
              key={index}
              className={`validation-result ${result.valid ? 'valid' : 'invalid'}`}
            >
              {result.file && (
                <div className="file-info">
                  <strong>{result.file.name}</strong>
                  <span className="file-size">{formatFileSize(result.file.size)}</span>
                </div>
              )}
              {result.error && (
                <div className="error-message">{result.error}</div>
              )}
              {result.valid && (
                <div className="success-message">✓ Ready for processing</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input for browser fallback */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedFormats.join(',')}
        style={{ display: 'none' }}
        onChange={() => {
          // Browser files don't have paths, so this is limited
          console.warn('Browser file selection has limited functionality');
        }}
      />
    </div>
  );
};