import React, { useState, useRef, useCallback } from 'react';
import { ExportErrorHandler } from './ExportErrorHandler';
import { ProgressIndicator } from './ProgressIndicator';
import { useNotifications } from './NotificationToast';
import { useApiErrorHandler, type ApiError } from '../hooks/useApiErrorHandler';
import './LargeDatasetExporter.css';

interface LargeDatasetExporterProps {
  data: any[];
  filename?: string;
  onExportComplete?: (result: ExportResult) => void;
  onExportProgress?: (progress: ExportProgress) => void;
  className?: string;
}

interface ExportResult {
  success: boolean;
  files: ExportedFile[];
  totalTime: number;
  totalSize: number;
  error?: ApiError;
}

interface ExportedFile {
  filename: string;
  size: number;
  format: string;
  downloadUrl: string;
}

interface ExportProgress {
  stage: 'analyzing' | 'preparing' | 'chunking' | 'generating' | 'compressing' | 'complete';
  currentChunk: number;
  totalChunks: number;
  percentage: number;
  estimatedTimeRemaining: number;
  processedRows: number;
  totalRows: number;
}

interface ExportSettings {
  format: 'csv' | 'json' | 'excel' | 'parquet';
  compression: 'none' | 'gzip' | 'zip';
  chunkStrategy: 'size' | 'rows' | 'smart';
  maxChunkSize: number; // in MB
  maxRowsPerChunk: number;
  includeMetadata: boolean;
  selectedColumns: string[];
  dateFormat: string;
  encoding: 'utf-8' | 'utf-16' | 'ascii';
}

const DEFAULT_SETTINGS: ExportSettings = {
  format: 'csv',
  compression: 'gzip',
  chunkStrategy: 'smart',
  maxChunkSize: 100, // 100MB
  maxRowsPerChunk: 100000,
  includeMetadata: true,
  selectedColumns: [],
  dateFormat: 'ISO',
  encoding: 'utf-8'
};

const LARGE_DATASET_THRESHOLD = 50000; // rows
const MEMORY_THRESHOLD = 500 * 1024 * 1024; // 500MB

export const LargeDatasetExporter: React.FC<LargeDatasetExporterProps> = ({
  data,
  filename = 'export',
  onExportComplete,
  onExportProgress,
  className = ''
}) => {
  const [settings, setSettings] = useState<ExportSettings>(DEFAULT_SETTINGS);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DataAnalysis | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { addNotification } = useNotifications();
  const { handleApiError } = useApiErrorHandler();
  const startTimeRef = useRef<number>(0);

  interface DataAnalysis {
    totalRows: number;
    totalColumns: number;
    estimatedSize: number;
    memoryRequired: number;
    recommendedChunks: number;
    largeDataset: boolean;
    columns: ColumnInfo[];
    complexityScore: number;
  }

  interface ColumnInfo {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'object';
    avgSize: number;
    nullCount: number;
    uniqueCount: number;
  }

  const analyzeDataset = useCallback(async (): Promise<DataAnalysis> => {
    setIsAnalyzing(true);
    
    try {
      // Sample first 1000 rows for analysis to avoid blocking UI
      const sampleSize = Math.min(1000, data.length);
      const sample = data.slice(0, sampleSize);
      
      if (sample.length === 0) {
        throw new Error('No data to analyze');
      }

      const columns = Object.keys(sample[0]);
      const columnAnalysis: ColumnInfo[] = [];
      
      for (const col of columns) {
        const values = sample.map(row => row[col]).filter(v => v != null);
        const types = values.map(v => typeof v);
        const uniqueTypes = [...new Set(types)];
        
        let columnType: ColumnInfo['type'] = 'string';
        if (uniqueTypes.length === 1) {
          if (uniqueTypes[0] === 'number') columnType = 'number';
          else if (uniqueTypes[0] === 'boolean') columnType = 'boolean';
          else if (uniqueTypes[0] === 'object') columnType = 'object';
        }
        
        // Check if string values look like dates
        if (columnType === 'string' && values.length > 0) {
          const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}/;
          if (values.slice(0, 10).every(v => datePattern.test(String(v)))) {
            columnType = 'date';
          }
        }

        const avgSize = values.reduce((sum, v) => sum + JSON.stringify(v).length, 0) / values.length;
        const uniqueCount = new Set(values).size;
        const nullCount = sample.length - values.length;

        columnAnalysis.push({
          name: col,
          type: columnType,
          avgSize,
          nullCount,
          uniqueCount
        });
      }

      // Estimate total size
      const avgRowSize = columnAnalysis.reduce((sum, col) => sum + col.avgSize, 0);
      const estimatedSize = avgRowSize * data.length;
      const memoryRequired = estimatedSize * 2; // Rough estimate including processing overhead

      // Calculate complexity score (affects export performance)
      const complexityScore = columnAnalysis.reduce((score, col) => {
        let colComplexity = 1;
        if (col.type === 'object') colComplexity += 2;
        if (col.type === 'string' && col.avgSize > 1000) colComplexity += 1;
        if (col.uniqueCount / sample.length > 0.8) colComplexity += 1; // High cardinality
        return score + colComplexity;
      }, 0);

      // Recommend chunking strategy
      const largeDataset = data.length > LARGE_DATASET_THRESHOLD || estimatedSize > MEMORY_THRESHOLD;
      const recommendedChunks = largeDataset 
        ? Math.ceil(estimatedSize / (settings.maxChunkSize * 1024 * 1024))
        : 1;

      return {
        totalRows: data.length,
        totalColumns: columns.length,
        estimatedSize,
        memoryRequired,
        recommendedChunks,
        largeDataset,
        columns: columnAnalysis,
        complexityScore
      };

    } finally {
      setIsAnalyzing(false);
    }
  }, [data, settings.maxChunkSize]);

  const updateProgress = (stage: ExportProgress['stage'], current: number, total: number) => {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const rate = current / elapsed;
    const remaining = rate > 0 ? (total - current) / rate : 0;

    const progress: ExportProgress = {
      stage,
      currentChunk: Math.floor(current / (settings.maxRowsPerChunk || 1)) + 1,
      totalChunks: Math.ceil(total / (settings.maxRowsPerChunk || 1)),
      percentage,
      estimatedTimeRemaining: remaining,
      processedRows: current,
      totalRows: total
    };

    setExportProgress(progress);
    if (onExportProgress) {
      onExportProgress(progress);
    }
  };

  const exportWithStreaming = useCallback(async (): Promise<ExportResult> => {
    if (!analysisResult) {
      throw new Error('Dataset analysis required before export');
    }

    setIsExporting(true);
    startTimeRef.current = Date.now();
    const exportedFiles: ExportedFile[] = [];

    try {
      updateProgress('preparing', 0, data.length);

      // Determine chunking strategy
      let chunkSize: number;
      switch (settings.chunkStrategy) {
        case 'size':
          chunkSize = Math.floor((settings.maxChunkSize * 1024 * 1024) / analysisResult.estimatedSize * data.length);
          break;
        case 'rows':
          chunkSize = settings.maxRowsPerChunk;
          break;
        case 'smart':
        default:
          // Smart chunking based on memory and complexity
          const baseChunkSize = settings.maxRowsPerChunk;
          const complexityFactor = Math.max(0.1, 1 - (analysisResult.complexityScore / 20));
          chunkSize = Math.floor(baseChunkSize * complexityFactor);
          break;
      }

      const totalChunks = Math.ceil(data.length / chunkSize);
      addNotification({
        type: 'info',
        message: `Exporting large dataset in ${totalChunks} chunks...`,
        duration: 3000
      });

      updateProgress('chunking', 0, data.length);

      // Process data in chunks
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, data.length);
        const chunk = data.slice(start, end);

        updateProgress('generating', start, data.length);

        // Filter columns if specified
        let processedChunk = chunk;
        if (settings.selectedColumns.length > 0) {
          processedChunk = chunk.map(row => {
            const filtered: any = {};
            settings.selectedColumns.forEach(col => {
              if (row.hasOwnProperty(col)) {
                filtered[col] = row[col];
              }
            });
            return filtered;
          });
        }

        // Generate chunk file
        const chunkFilename = totalChunks > 1 
          ? `${filename}_part${chunkIndex + 1}of${totalChunks}.${settings.format}`
          : `${filename}.${settings.format}`;

        // For demo purposes, we'll create a blob and download URL
        // In a real implementation, this would involve server-side processing
        const blob = await generateChunkBlob(processedChunk, settings);
        const downloadUrl = URL.createObjectURL(blob);

        exportedFiles.push({
          filename: chunkFilename,
          size: blob.size,
          format: settings.format,
          downloadUrl
        });

        // Trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = chunkFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Small delay to prevent browser from blocking downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Generate metadata file if requested
      if (settings.includeMetadata) {
        const metadata = {
          exportDate: new Date().toISOString(),
          totalRows: data.length,
          totalChunks,
          settings,
          dataAnalysis: analysisResult,
          files: exportedFiles.map(f => ({ filename: f.filename, size: f.size }))
        };

        const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
        const metadataUrl = URL.createObjectURL(metadataBlob);
        
        const metadataLink = document.createElement('a');
        metadataLink.href = metadataUrl;
        metadataLink.download = `${filename}_metadata.json`;
        document.body.appendChild(metadataLink);
        metadataLink.click();
        document.body.removeChild(metadataLink);

        exportedFiles.push({
          filename: `${filename}_metadata.json`,
          size: metadataBlob.size,
          format: 'json',
          downloadUrl: metadataUrl
        });
      }

      updateProgress('complete', data.length, data.length);

      const totalTime = (Date.now() - startTimeRef.current) / 1000;
      const totalSize = exportedFiles.reduce((sum, f) => sum + f.size, 0);

      const result: ExportResult = {
        success: true,
        files: exportedFiles,
        totalTime,
        totalSize
      };

      if (onExportComplete) {
        onExportComplete(result);
      }

      addNotification({
        type: 'success',
        message: `Export completed: ${exportedFiles.length} files, ${formatFileSize(totalSize)}`,
        duration: 5000
      });

      return result;

    } catch (error: any) {
      const apiError = handleApiError(error, {
        operation: 'large dataset export',
        component: 'LargeDatasetExporter',
        userMessage: 'Failed to export large dataset'
      });

      const result: ExportResult = {
        success: false,
        files: exportedFiles,
        totalTime: (Date.now() - startTimeRef.current) / 1000,
        totalSize: exportedFiles.reduce((sum, f) => sum + f.size, 0),
        error: apiError
      };

      if (onExportComplete) {
        onExportComplete(result);
      }

      return result;

    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [data, filename, settings, analysisResult, onExportComplete, onExportProgress, addNotification, handleApiError]);

  const generateChunkBlob = async (chunk: any[], settings: ExportSettings): Promise<Blob> => {
    switch (settings.format) {
      case 'csv':
        return generateCSVBlob(chunk, settings);
      case 'json':
        return generateJSONBlob(chunk, settings);
      case 'excel':
        return generateExcelBlob(chunk, settings);
      default:
        throw new Error(`Unsupported format: ${settings.format}`);
    }
  };

  const generateCSVBlob = (chunk: any[], settings: ExportSettings): Blob => {
    if (chunk.length === 0) return new Blob([''], { type: 'text/csv' });

    const keys = Object.keys(chunk[0]);
    const rows = [
      keys.join(','), // Header
      ...chunk.map(row => 
        keys.map(key => {
          let value = row[key];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') value = JSON.stringify(value);
          const stringValue = String(value);
          return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        }).join(',')
      )
    ];

    const csvContent = rows.join('\n');
    const bom = settings.encoding === 'utf-8' ? '\uFEFF' : '';
    return new Blob([bom + csvContent], { type: 'text/csv;charset=' + settings.encoding });
  };

  const generateJSONBlob = (chunk: any[], settings: ExportSettings): Blob => {
    const jsonContent = JSON.stringify(chunk, null, 2);
    return new Blob([jsonContent], { type: 'application/json;charset=' + settings.encoding });
  };

  const generateExcelBlob = (chunk: any[], settings: ExportSettings): Blob => {
    // Simplified Excel format (tab-separated)
    if (chunk.length === 0) return new Blob([''], { type: 'application/vnd.ms-excel' });

    const keys = Object.keys(chunk[0]);
    const rows = [
      keys.join('\t'), // Header
      ...chunk.map(row => 
        keys.map(key => {
          let value = row[key];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') value = JSON.stringify(value);
          return String(value).replace(/\t/g, ' ');
        }).join('\t')
      )
    ];

    const content = '\uFEFF' + rows.join('\n');
    return new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-16' });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleAnalyze = async () => {
    try {
      const result = await analyzeDataset();
      setAnalysisResult(result);
      
      // Auto-adjust settings based on analysis
      if (result.largeDataset) {
        setSettings(prev => ({
          ...prev,
          compression: 'gzip',
          chunkStrategy: 'smart',
          maxRowsPerChunk: Math.min(prev.maxRowsPerChunk, 50000)
        }));
      }
      
      setShowSettings(true);
    } catch (error) {
      handleApiError(error, {
        operation: 'dataset analysis',
        component: 'LargeDatasetExporter',
        userMessage: 'Failed to analyze dataset'
      });
    }
  };

  const availableColumns = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className={`large-dataset-exporter ${className}`} data-testid="large-dataset-exporter">
      <div className="exporter-header">
        <h3>Large Dataset Export</h3>
        <p>Export large datasets with optimized chunking and compression</p>
      </div>

      <div className="dataset-summary" data-testid="dataset-summary">
        <div className="summary-item">
          <span className="label">Total Rows:</span>
          <span className="value" data-testid="total-rows">{data.length.toLocaleString()}</span>
        </div>
        <div className="summary-item">
          <span className="label">Columns:</span>
          <span className="value" data-testid="total-columns">{availableColumns.length}</span>
        </div>
        {analysisResult && (
          <>
            <div className="summary-item">
              <span className="label">Estimated Size:</span>
              <span className="value" data-testid="estimated-size">{formatFileSize(analysisResult.estimatedSize)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Recommended Chunks:</span>
              <span className="value" data-testid="recommended-chunks">{analysisResult.recommendedChunks}</span>
            </div>
          </>
        )}
      </div>

      <div className="exporter-actions">
        <button
          className="analyze-button"
          onClick={handleAnalyze}
          disabled={isAnalyzing || isExporting}
          data-testid="analyze-dataset-button"
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Dataset'}
        </button>

        {analysisResult && (
          <button
            className="settings-button"
            onClick={() => setShowSettings(!showSettings)}
            disabled={isExporting}
            data-testid="export-settings-button"
          >
            {showSettings ? 'Hide Settings' : 'Export Settings'}
          </button>
        )}
      </div>

      {isAnalyzing && (
        <div className="analysis-progress">
          <ProgressIndicator
            indeterminate
            label="Analyzing dataset structure..."
            size="medium"
          />
        </div>
      )}

      {analysisResult && showSettings && (
        <div className="export-settings">
          <h4>Export Configuration</h4>
          
          <div className="settings-grid">
            <div className="setting-group">
              <label>Format:</label>
              <select
                value={settings.format}
                onChange={(e) => setSettings(prev => ({ ...prev, format: e.target.value as any }))}
                disabled={isExporting}
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="excel">Excel</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Compression:</label>
              <select
                value={settings.compression}
                onChange={(e) => setSettings(prev => ({ ...prev, compression: e.target.value as any }))}
                disabled={isExporting}
              >
                <option value="none">None</option>
                <option value="gzip">GZIP</option>
                <option value="zip">ZIP</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Chunk Strategy:</label>
              <select
                value={settings.chunkStrategy}
                onChange={(e) => setSettings(prev => ({ ...prev, chunkStrategy: e.target.value as any }))}
                disabled={isExporting}
              >
                <option value="smart">Smart (Recommended)</option>
                <option value="rows">By Row Count</option>
                <option value="size">By File Size</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Max Rows per Chunk:</label>
              <input
                type="number"
                value={settings.maxRowsPerChunk}
                onChange={(e) => setSettings(prev => ({ ...prev, maxRowsPerChunk: parseInt(e.target.value) }))}
                min="1000"
                max="1000000"
                step="1000"
                disabled={isExporting}
              />
            </div>

            <div className="setting-group full-width">
              <label>
                <input
                  type="checkbox"
                  checked={settings.includeMetadata}
                  onChange={(e) => setSettings(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                  disabled={isExporting}
                />
                Include metadata file
              </label>
            </div>
          </div>

          <div className="column-selection">
            <h5>Select Columns to Export:</h5>
            <div className="column-checkboxes">
              <label className="select-all">
                <input
                  type="checkbox"
                  checked={settings.selectedColumns.length === availableColumns.length}
                  onChange={(e) => {
                    setSettings(prev => ({
                      ...prev,
                      selectedColumns: e.target.checked ? [...availableColumns] : []
                    }));
                  }}
                  disabled={isExporting}
                />
                Select All
              </label>
              {availableColumns.map(col => (
                <label key={col}>
                  <input
                    type="checkbox"
                    checked={settings.selectedColumns.includes(col)}
                    onChange={(e) => {
                      setSettings(prev => ({
                        ...prev,
                        selectedColumns: e.target.checked
                          ? [...prev.selectedColumns, col]
                          : prev.selectedColumns.filter(c => c !== col)
                      }));
                    }}
                    disabled={isExporting}
                  />
                  {col}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {exportProgress && (
        <div className="export-progress" data-testid="export-progress">
          <h4>Export Progress</h4>
          <ProgressIndicator
            value={exportProgress.percentage}
            label={`${exportProgress.stage} (${exportProgress.processedRows}/${exportProgress.totalRows} rows)`}
            showPercentage
            size="large"
            testId="large-export-progress"
          />
          <div className="progress-details" data-testid="export-progress-details">
            <span>Chunk {exportProgress.currentChunk} of {exportProgress.totalChunks}</span>
            {exportProgress.estimatedTimeRemaining > 0 && (
              <span>ETA: {Math.round(exportProgress.estimatedTimeRemaining)}s</span>
            )}
          </div>
        </div>
      )}

      <ExportErrorHandler>
        {(exportHandler) => (
          <div className="export-action">
            <button
              className="export-button"
              onClick={exportWithStreaming}
              disabled={!analysisResult || isExporting || isAnalyzing}
              data-testid="start-large-export-button"
            >
              {isExporting ? 'Exporting...' : 'Start Export'}
            </button>
          </div>
        )}
      </ExportErrorHandler>
    </div>
  );
};

export default LargeDatasetExporter;