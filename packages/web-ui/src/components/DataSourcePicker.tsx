import React, { useState, useCallback, useRef } from 'react';
import type { FileInfo } from '../platform-bridge';
import { useFileProcessor, usePerformanceMonitor } from '../hooks/useWebWorker';
import { LargeFileUploader } from './LargeFileUploader';
import { ProgressIndicator } from './ProgressIndicator';
import { ApiErrorDisplay } from './ApiErrorDisplay';
import { useApiErrorHandler, type ApiError } from '../hooks/useApiErrorHandler';
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
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { handleApiError } = useApiErrorHandler();
  
  // Web Worker for large file processing
  const fileProcessor = useFileProcessor();
  const performanceMetrics = usePerformanceMonitor();
  
  // Use Web Worker for files larger than 10MB
  const shouldUseWebWorker = useCallback((file: File) => {
    return file.size > 10 * 1024 * 1024; // 10MB threshold
  }, []);

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
        // Check if platform bridge is available (Electron environment)
        if (window.platformBridge?.fileSystem) {
          const fileInfo = await window.platformBridge.fileSystem.getFileInfo(path);
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

          // Additional validation through platform bridge if available
          if (window.platformBridge?.fileSystem?.validateFile) {
            const validation = await window.platformBridge.fileSystem.validateFile(path, maxSizeGB);
            if (!validation?.valid) {
              results.push({
                valid: false,
                error: validation?.error || 'File validation failed',
                file: fileInfo
              });
              continue;
            }
          }

          results.push({ valid: true, file: fileInfo });
        } else {
          // Browser fallback - create mock FileInfo from path
          const fileName = path.split('/').pop() || path;
          const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
          
          // Check file format
          if (!acceptedFormats.includes(extension)) {
            results.push({
              valid: false,
              error: `Unsupported format: ${extension}. Supported: ${acceptedFormats.join(', ')}`
            });
            continue;
          }
          
          // Create a mock FileInfo object for browser
          results.push({
            valid: true,
            file: {
              name: fileName,
              path: path,
              size: 1024 * 1024, // Mock 1MB size
              type: 'text/csv'
            }
          });
        }
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
      const apiError = handleApiError(error, {
        operation: 'file validation',
        component: 'DataSourcePicker',
        userMessage: 'File validation failed'
      });
      setApiError(apiError);
      
      setValidationResults([{
        valid: false,
        error: apiError.message
      }]);
    } finally {
      setIsValidating(false);
    }
  }, [onFilesSelected, maxSizeGB, acceptedFormats]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
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
    
    // Check if platform bridge is available (Electron environment)
    if (window.platformBridge?.capabilities?.platform === 'electron') {
      // Electron will handle the drop event and send us the file paths
      const files = Array.from(e.dataTransfer.files);
      const filePaths = files.map(file => (file as any).path).filter(Boolean);
      if (filePaths.length > 0) {
        await handleFilesSelected(filePaths);
      }
    } else {
      // Browser fallback - handle dropped files directly
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      // Create mock FileInfo objects for browser environment
      const mockResults: FileValidationResult[] = files.map(file => {
        // Check file size
        const sizeInGB = file.size / (1024 * 1024 * 1024);
        if (sizeInGB > maxSizeGB) {
          return {
            valid: false,
            error: `File too large: ${formatFileSize(file.size)} (max: ${maxSizeGB}GB)`,
            file: {
              name: file.name,
              path: file.name,
              size: file.size,
              type: file.type
            }
          };
        }

        // Check file format
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        if (!acceptedFormats.includes(extension)) {
          return {
            valid: false,
            error: `Unsupported format: ${extension}. Supported: ${acceptedFormats.join(', ')}`,
            file: {
              name: file.name,
              path: file.name,
              size: file.size,
              type: file.type
            }
          };
        }

        return {
          valid: true,
          file: {
            name: file.name,
            path: file.name,
            size: file.size,
            type: file.type
          }
        };
      });

      setValidationResults(mockResults);
      
      const validFiles = mockResults
        .filter(result => result.valid && result.file)
        .map(result => result.file!);

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  }, [handleFilesSelected, maxSizeGB, acceptedFormats]);

  const handleFileSelect = useCallback(async () => {
    // Check if platform bridge is available (Electron environment)
    if (window.platformBridge?.fileSystem?.selectFiles) {
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
        // Fallback to browser file input on error
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      }
    } else {
      // Browser fallback - use hidden file input
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  }, [handleFilesSelected, acceptedFormats]);

  const handleUploadComplete = useCallback((fileId: string, fileName: string) => {
    // Convert uploaded file to FileInfo format for the existing flow
    const fileInfo: FileInfo = {
      name: fileName,
      path: fileName,
      size: 0, // Size would be available from upload result
      type: fileName.includes('.csv') ? 'text/csv' : 'application/octet-stream'
    };
    
    onFilesSelected([fileInfo]);
    setApiError(null);
  }, [onFilesSelected]);

  const handleUploadError = useCallback((error: any) => {
    setApiError(error);
  }, []);

  return (
    <div className="data-source-picker" data-testid="data-source-picker">
      <div className="upload-section">
        <h3>Select Data Files</h3>
        <p>Upload your data files for sentiment analysis processing</p>
        
        <LargeFileUploader
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
          acceptedTypes={acceptedFormats}
          maxFileSize={maxSizeGB * 1024 * 1024 * 1024} // Convert GB to bytes
          chunkSize={10 * 1024 * 1024} // 10MB chunks
          multiple={false}
          className="data-source-uploader"
        >
          <div className="upload-area-content">
            <div className="upload-icon">📁</div>
            <div className="upload-text">
              <div className="primary-text">Choose data files to upload</div>
              <div className="secondary-text">
                Drag and drop files here, or click to browse
              </div>
              <div className="file-requirements" id="file-requirements">
                <div>Supported formats: {acceptedFormats.join(', ')}</div>
                <div>Maximum file size: {maxSizeGB}GB per file</div>
                <div>Large files will be uploaded in chunks for reliability</div>
              </div>
            </div>
          </div>
        </LargeFileUploader>
        
        {/* Performance warning for large files */}
        {!performanceMetrics.isResponsive && (
          <div className="performance-warning">
            ⚠️ Processing large file - UI may be temporarily less responsive
          </div>
        )}
      </div>

      {validationResults.length > 0 && (
        <div className="validation-results" data-testid="validation-results">
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
                <div className="error-message" data-testid={`validation-error-${index}`}>{result.error}</div>
              )}
              {result.valid && (
                <div className="success-message" data-testid={`validation-success-${index}`}>✓ Ready for processing</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* API Error Display */}
      <ApiErrorDisplay
        error={apiError}
        context="File Upload"
        onRetry={() => {
          setApiError(null);
          // Could retry the last operation here
        }}
        onDismiss={() => setApiError(null)}
        showDetails={true}
      />

      {/* Hidden file input for browser fallback */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedFormats.join(',')}
        style={{ display: 'none' }}
        data-testid="hidden-file-input"
        aria-label="Select data files for upload"
        aria-describedby="file-requirements"
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          if (files.length === 0) return;

          // Browser environment - create mock FileInfo objects
          const mockResults: FileValidationResult[] = files.map(file => {
            // Check file size
            const sizeInGB = file.size / (1024 * 1024 * 1024);
            if (sizeInGB > maxSizeGB) {
              return {
                valid: false,
                error: `File too large: ${formatFileSize(file.size)} (max: ${maxSizeGB}GB)`,
                file: {
                  name: file.name,
                  path: file.name, // Browser doesn't have full paths
                  size: file.size,
                  type: file.type
                }
              };
            }

            // Check file format
            const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
            if (!acceptedFormats.includes(extension)) {
              return {
                valid: false,
                error: `Unsupported format: ${extension}. Supported: ${acceptedFormats.join(', ')}`,
                file: {
                  name: file.name,
                  path: file.name,
                  size: file.size,
                  type: file.type
                }
              };
            }

            return {
              valid: true,
              file: {
                name: file.name,
                path: file.name,
                size: file.size,
                type: file.type
              }
            };
          });

          setValidationResults(mockResults);
          
          const validFiles = mockResults
            .filter(result => result.valid && result.file)
            .map(result => result.file!);

          if (validFiles.length > 0) {
            onFilesSelected(validFiles);
          }

          // Reset the input
          e.target.value = '';
        }}
      />
    </div>
  );
};