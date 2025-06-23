import React, { useState, useCallback, useRef } from 'react';
import { ApiErrorDisplay } from './ApiErrorDisplay';
import { ProgressIndicator } from './ProgressIndicator';
import { useApiErrorHandler, type ApiError } from '../hooks/useApiErrorHandler';
import { useNotifications } from './NotificationToast';
import './ExportErrorHandler.css';

interface ExportErrorHandlerProps {
  children: (exportHandler: ExportHandler) => React.ReactNode;
  fallbackFormats?: ('csv' | 'json' | 'txt' | 'pdf')[];
  maxRetries?: number;
  chunkSize?: number;
  onError?: (error: ExportError) => void;
  onSuccess?: (format: string, blob: Blob) => void;
}

interface ExportHandler {
  exportData: (
    data: any[], 
    format: 'csv' | 'excel' | 'json' | 'txt' | 'pdf',
    filename?: string,
    options?: ExportOptions
  ) => Promise<void>;
  isExporting: boolean;
  progress: number;
  currentOperation: string;
  retryCount: number;
  error: ExportError | null;
  clearError: () => void;
}

interface ExportOptions {
  selectedColumns?: string[];
  includeHeaders?: boolean;
  dateFormat?: string;
  encoding?: 'utf-8' | 'utf-16' | 'ascii';
  delimiter?: string;
  chunkSize?: number;
}

interface ExportError {
  type: 'memory' | 'format' | 'network' | 'storage' | 'size' | 'unknown';
  message: string;
  details?: string;
  suggestedActions: string[];
  fallbackFormats?: string[];
  recoverable: boolean;
  originalError?: any;
}

const MAX_MEMORY_THRESHOLD = 100 * 1024 * 1024; // 100MB
const MAX_ROWS_PER_CHUNK = 10000;
const FALLBACK_FORMATS = ['csv', 'json', 'txt'];

export const ExportErrorHandler: React.FC<ExportErrorHandlerProps> = ({
  children,
  fallbackFormats = FALLBACK_FORMATS,
  maxRetries = 3,
  chunkSize = MAX_ROWS_PER_CHUNK,
  onError,
  onSuccess
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentOperation, setCurrentOperation] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [exportError, setExportError] = useState<ExportError | null>(null);
  const { handleApiError } = useApiErrorHandler();
  const { addNotification } = useNotifications();
  const abortControllerRef = useRef<AbortController | null>(null);

  const estimateMemoryUsage = (data: any[]): number => {
    if (data.length === 0) return 0;
    
    // Estimate size of one item and multiply
    const sampleItem = JSON.stringify(data[0]);
    const itemSize = new Blob([sampleItem]).size;
    return itemSize * data.length * 1.5; // Add 50% overhead
  };

  const createExportError = (
    type: ExportError['type'],
    message: string,
    originalError?: any,
    details?: string
  ): ExportError => {
    const baseError: ExportError = {
      type,
      message,
      details,
      suggestedActions: [],
      recoverable: true,
      originalError
    };

    switch (type) {
      case 'memory':
        return {
          ...baseError,
          suggestedActions: [
            'Try exporting in smaller chunks',
            'Use a simpler format like CSV',
            'Filter data to reduce size',
            'Close other browser tabs'
          ],
          fallbackFormats: ['csv', 'txt']
        };

      case 'size':
        return {
          ...baseError,
          suggestedActions: [
            'Export data in multiple files',
            'Apply filters to reduce dataset',
            'Use chunked export option',
            'Consider server-side export'
          ],
          fallbackFormats: ['csv', 'json']
        };

      case 'format':
        return {
          ...baseError,
          suggestedActions: [
            'Try a different export format',
            'Check data format compatibility',
            'Verify column selections'
          ],
          fallbackFormats: fallbackFormats.filter(f => f !== 'excel')
        };

      case 'storage':
        return {
          ...baseError,
          suggestedActions: [
            'Free up disk space',
            'Try downloading to a different location',
            'Use cloud storage',
            'Export smaller chunks'
          ],
          recoverable: true
        };

      case 'network':
        return {
          ...baseError,
          suggestedActions: [
            'Check internet connection',
            'Retry the export',
            'Use offline export if available'
          ],
          recoverable: true
        };

      default:
        return {
          ...baseError,
          suggestedActions: [
            'Try again in a moment',
            'Refresh the page',
            'Contact support if issue persists'
          ],
          recoverable: true
        };
    }
  };

  const generateExportBlob = async (
    data: any[], 
    format: string, 
    options: ExportOptions = {}
  ): Promise<Blob> => {
    const {
      selectedColumns,
      includeHeaders = true,
      delimiter = ',',
      encoding = 'utf-8'
    } = options;

    setCurrentOperation(`Preparing ${format.toUpperCase()} export...`);

    // Filter columns if specified
    let processedData = data;
    if (selectedColumns && selectedColumns.length > 0) {
      processedData = data.map(item => {
        const filtered: any = {};
        selectedColumns.forEach(col => {
          if (item.hasOwnProperty(col)) {
            filtered[col] = item[col];
          }
        });
        return filtered;
      });
    }

    switch (format.toLowerCase()) {
      case 'csv':
        return await generateCSV(processedData, { includeHeaders, delimiter });
      
      case 'json':
        return await generateJSON(processedData);
      
      case 'txt':
        return await generateTXT(processedData);
      
      case 'excel':
        return await generateExcel(processedData, { includeHeaders });
      
      case 'pdf':
        return await generatePDF(processedData, options);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  };

  const generateCSV = async (data: any[], options: { includeHeaders: boolean; delimiter: string }): Promise<Blob> => {
    const { includeHeaders, delimiter } = options;
    
    if (data.length === 0) {
      return new Blob([''], { type: 'text/csv;charset=utf-8' });
    }

    const keys = Object.keys(data[0]);
    const csvContent = [];

    if (includeHeaders) {
      csvContent.push(keys.join(delimiter));
    }

    let processed = 0;
    for (const item of data) {
      const row = keys.map(key => {
        let value = item[key];
        
        if (Array.isArray(value)) {
          value = value.join('; ');
        } else if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        } else if (value === null || value === undefined) {
          value = '';
        }
        
        // Escape quotes and wrap in quotes if contains delimiter
        const stringValue = String(value);
        if (stringValue.includes(delimiter) || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      
      csvContent.push(row.join(delimiter));
      
      processed++;
      if (processed % 1000 === 0) {
        setProgress((processed / data.length) * 80);
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI update
      }
    }

    return new Blob(['\uFEFF' + csvContent.join('\n')], { type: 'text/csv;charset=utf-8' });
  };

  const generateJSON = async (data: any[]): Promise<Blob> => {
    setCurrentOperation('Converting to JSON...');
    
    // For large datasets, stringify in chunks to avoid blocking
    if (data.length > 5000) {
      const jsonString = JSON.stringify(data, null, 2);
      return new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    } else {
      // Process incrementally for very large datasets
      let jsonContent = '[\n';
      
      for (let i = 0; i < data.length; i++) {
        if (i > 0) jsonContent += ',\n';
        jsonContent += '  ' + JSON.stringify(data[i], null, 2).replace(/\n/g, '\n  ');
        
        if (i % 1000 === 0) {
          setProgress((i / data.length) * 80);
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      jsonContent += '\n]';
      return new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    }
  };

  const generateTXT = async (data: any[]): Promise<Blob> => {
    setCurrentOperation('Converting to text...');
    
    const textContent = data.map((item, index) => {
      const itemText = Object.entries(item)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      
      if (index % 1000 === 0) {
        setProgress((index / data.length) * 80);
      }
      
      return `--- Record ${index + 1} ---\n${itemText}\n`;
    }).join('\n');

    return new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  };

  const generateExcel = async (data: any[], options: { includeHeaders: boolean }): Promise<Blob> => {
    setCurrentOperation('Converting to Excel format...');
    
    if (data.length === 0) {
      return new Blob([''], { type: 'application/vnd.ms-excel' });
    }

    const { includeHeaders } = options;
    const keys = Object.keys(data[0]);
    const excelContent = [];

    if (includeHeaders) {
      excelContent.push(keys.join('\t'));
    }

    let processed = 0;
    for (const item of data) {
      const row = keys.map(key => {
        let value = item[key];
        
        if (Array.isArray(value)) {
          value = value.join('; ');
        } else if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        } else if (value === null || value === undefined) {
          value = '';
        }
        
        return String(value).replace(/\t/g, ' ');
      });
      
      excelContent.push(row.join('\t'));
      
      processed++;
      if (processed % 1000 === 0) {
        setProgress((processed / data.length) * 80);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Add BOM for proper Excel UTF-8 handling
    return new Blob(['\uFEFF' + excelContent.join('\n')], { 
      type: 'application/vnd.ms-excel;charset=utf-8' 
    });
  };

  const generatePDF = async (data: any[], options: ExportOptions): Promise<Blob> => {
    setCurrentOperation('Generating PDF report...');
    
    // Import jsPDF dynamically to reduce bundle size
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Add title
    doc.setFontSize(20);
    doc.text('Sentiment Analysis Report', 20, 20);
    
    // Add metadata
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
    doc.text(`Total Records: ${data.length}`, 20, 35);
    
    // Calculate statistics
    const stats = calculateStatistics(data);
    
    // Add summary section
    doc.setFontSize(14);
    doc.text('Summary', 20, 50);
    doc.setFontSize(10);
    doc.text(`Average Sentiment Score: ${stats.averageScore.toFixed(3)}`, 20, 58);
    doc.text(`Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`, 20, 63);
    doc.text(`Positive: ${stats.positive} (${stats.positivePercent.toFixed(1)}%)`, 20, 68);
    doc.text(`Negative: ${stats.negative} (${stats.negativePercent.toFixed(1)}%)`, 20, 73);
    doc.text(`Neutral: ${stats.neutral} (${stats.neutralPercent.toFixed(1)}%)`, 20, 78);
    
    // Add sentiment distribution chart (simple text representation)
    doc.setFontSize(14);
    doc.text('Sentiment Distribution', 20, 95);
    const chartY = 103;
    const barWidth = 50;
    const maxBarHeight = 20;
    
    // Draw simple bars
    doc.setFillColor(76, 175, 80); // Green for positive
    doc.rect(20, chartY, barWidth * (stats.positivePercent / 100), 10, 'F');
    doc.text('Positive', 20, chartY + 15);
    
    doc.setFillColor(244, 67, 54); // Red for negative
    doc.rect(20, chartY + 20, barWidth * (stats.negativePercent / 100), 10, 'F');
    doc.text('Negative', 20, chartY + 35);
    
    doc.setFillColor(158, 158, 158); // Gray for neutral
    doc.rect(20, chartY + 40, barWidth * (stats.neutralPercent / 100), 10, 'F');
    doc.text('Neutral', 20, chartY + 55);
    
    // Add detailed results table
    doc.addPage();
    doc.setFontSize(16);
    doc.text('Detailed Results', 20, 20);
    
    // Prepare table data
    const tableData = data.map((item, index) => {
      const row = [index + 1];
      
      if (options.selectedColumns?.includes('text')) {
        // Truncate long text for PDF
        const text = item.text || '';
        row.push(text.length > 50 ? text.substring(0, 47) + '...' : text);
      }
      
      if (options.selectedColumns?.includes('sentiment')) {
        row.push(item.sentiment || '');
      }
      
      if (options.selectedColumns?.includes('score')) {
        row.push(item.score?.toFixed(3) || '0.000');
      }
      
      if (options.selectedColumns?.includes('confidence')) {
        row.push(`${((item.confidence || 0) * 100).toFixed(1)}%`);
      }
      
      if (options.selectedColumns?.includes('createdAt')) {
        row.push(new Date(item.createdAt).toLocaleDateString());
      }
      
      return row;
    });
    
    // Generate table headers based on selected columns
    const headers = ['#'];
    if (options.selectedColumns?.includes('text')) headers.push('Text');
    if (options.selectedColumns?.includes('sentiment')) headers.push('Sentiment');
    if (options.selectedColumns?.includes('score')) headers.push('Score');
    if (options.selectedColumns?.includes('confidence')) headers.push('Confidence');
    if (options.selectedColumns?.includes('createdAt')) headers.push('Date');
    
    // Add table with pagination
    (doc as any).autoTable({
      head: [headers],
      body: tableData,
      startY: 30,
      margin: { left: 20, right: 20 },
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      didDrawPage: (data: any) => {
        // Add page numbers
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(10);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          doc.internal.pageSize.width - 40,
          doc.internal.pageSize.height - 10
        );
      }
    });
    
    // Add footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        'Generated by Sentiment Analysis Workbench',
        20,
        doc.internal.pageSize.height - 10
      );
    }
    
    // Convert to blob
    const pdfBlob = doc.output('blob');
    setProgress(90);
    
    return pdfBlob;
  };

  const calculateStatistics = (data: any[]) => {
    const total = data.length;
    if (total === 0) {
      return {
        averageScore: 0,
        averageConfidence: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        positivePercent: 0,
        negativePercent: 0,
        neutralPercent: 0
      };
    }
    
    let totalScore = 0;
    let totalConfidence = 0;
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    
    data.forEach(item => {
      totalScore += item.score || 0;
      totalConfidence += item.confidence || 0;
      
      switch (item.sentiment) {
        case 'positive':
          positive++;
          break;
        case 'negative':
          negative++;
          break;
        case 'neutral':
          neutral++;
          break;
      }
    });
    
    return {
      averageScore: totalScore / total,
      averageConfidence: totalConfidence / total,
      positive,
      negative,
      neutral,
      positivePercent: (positive / total) * 100,
      negativePercent: (negative / total) * 100,
      neutralPercent: (neutral / total) * 100
    };
  };

  const downloadBlob = (blob: Blob, filename: string): void => {
    setCurrentOperation('Preparing download...');
    setProgress(90);

    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up the URL object
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      setProgress(100);
      setCurrentOperation('Download complete');
      
    } catch (error) {
      throw createExportError('storage', 'Failed to download file', error);
    }
  };

  const exportWithFallback = async (
    data: any[],
    preferredFormat: string,
    filename: string,
    options: ExportOptions
  ): Promise<void> => {
    const formatsToTry = [preferredFormat, ...fallbackFormats].filter((format, index, arr) => 
      arr.indexOf(format) === index
    );

    for (const format of formatsToTry) {
      try {
        setCurrentOperation(`Trying ${format.toUpperCase()} export...`);
        
        const blob = await generateExportBlob(data, format, options);
        const extension = format === 'excel' ? 'xls' : format === 'pdf' ? 'pdf' : format;
        const finalFilename = filename.replace(/\.[^/.]+$/, '') + `.${extension}`;
        
        downloadBlob(blob, finalFilename);
        
        if (format !== preferredFormat) {
          addNotification({
            type: 'warning',
            message: `Export completed using ${format.toUpperCase()} format instead of ${preferredFormat.toUpperCase()}`,
            duration: 5000
          });
        }
        
        return;
        
      } catch (error) {
        if (format === formatsToTry[formatsToTry.length - 1]) {
          // Last format failed, throw error
          throw error;
        }
        // Try next format
        continue;
      }
    }
  };

  const exportData = useCallback(async (
    data: any[],
    format: 'csv' | 'excel' | 'json' | 'txt' | 'pdf',
    filename = 'export',
    options: ExportOptions = {}
  ): Promise<void> => {
    if (isExporting) {
      throw new Error('Export already in progress');
    }

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    setIsExporting(true);
    setProgress(0);
    setCurrentOperation('Initializing export...');
    setExportError(null);

    try {
      // Memory estimation
      const estimatedSize = estimateMemoryUsage(data);
      setProgress(5);

      if (estimatedSize > MAX_MEMORY_THRESHOLD) {
        throw createExportError(
          'memory',
          `Dataset too large for browser export (${Math.round(estimatedSize / 1024 / 1024)}MB)`,
          null,
          'Consider using server-side export for large datasets'
        );
      }

      // Size validation
      if (data.length > 100000 && format === 'excel') {
        throw createExportError(
          'size',
          'Excel format not recommended for datasets larger than 100,000 rows',
          null,
          'Excel may have performance issues with large datasets'
        );
      }

      setProgress(10);

      // Check if we should chunk the export
      const shouldChunk = data.length > (options.chunkSize || chunkSize);
      
      if (shouldChunk) {
        await exportInChunks(data, format, filename, options);
      } else {
        await exportWithFallback(data, format, filename, options);
      }

      setProgress(100);
      setCurrentOperation('Export completed successfully');
      
      if (onSuccess) {
        const blob = await generateExportBlob(data, format, options);
        onSuccess(format, blob);
      }

      addNotification({
        type: 'success',
        message: `Export completed successfully (${data.length.toLocaleString()} records)`,
        duration: 4000
      });

    } catch (error: any) {
      let exportError: ExportError;

      if (error.name === 'AbortError') {
        exportError = createExportError('unknown', 'Export was cancelled by user');
      } else if (error instanceof Error && error.message.includes('memory')) {
        exportError = createExportError('memory', error.message, error);
      } else if (error instanceof Error && error.message.includes('quota')) {
        exportError = createExportError('storage', 'Not enough storage space', error);
      } else if (error.type) {
        exportError = error as ExportError;
      } else {
        exportError = createExportError('unknown', error?.message || 'Unknown export error', error);
      }

      setExportError(exportError);
      
      if (onError) {
        onError(exportError);
      }

      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  }, [isExporting, chunkSize, fallbackFormats, onError, onSuccess]);

  const exportInChunks = async (
    data: any[],
    format: string,
    filename: string,
    options: ExportOptions
  ): Promise<void> => {
    const chunkSizeToUse = options.chunkSize || chunkSize;
    const totalChunks = Math.ceil(data.length / chunkSizeToUse);
    
    addNotification({
      type: 'info',
      message: `Large dataset detected. Splitting into ${totalChunks} files...`,
      duration: 3000
    });

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSizeToUse;
      const end = Math.min(start + chunkSizeToUse, data.length);
      const chunk = data.slice(start, end);
      
      const chunkFilename = `${filename}_part${i + 1}of${totalChunks}`;
      setCurrentOperation(`Exporting chunk ${i + 1} of ${totalChunks}...`);
      setProgress(20 + (i / totalChunks) * 70);
      
      await exportWithFallback(chunk, format, chunkFilename, options);
      
      // Small delay between chunks to prevent browser freezing
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const retryExport = useCallback(async () => {
    if (retryCount >= maxRetries) {
      addNotification({
        type: 'error',
        message: 'Maximum retry attempts reached. Please try a different approach.',
        duration: 5000
      });
      return;
    }

    setRetryCount(prev => prev + 1);
    setExportError(null);
    
    // If there's a suggested fallback format, try that
    if (exportError?.fallbackFormats && exportError.fallbackFormats.length > 0) {
      addNotification({
        type: 'info',
        message: `Retrying with ${exportError.fallbackFormats[0].toUpperCase()} format...`,
        duration: 3000
      });
    }
  }, [exportError, retryCount, maxRetries]);

  const clearError = useCallback(() => {
    setExportError(null);
    setRetryCount(0);
  }, []);

  const exportHandler: ExportHandler = {
    exportData,
    isExporting,
    progress,
    currentOperation,
    retryCount,
    error: exportError,
    clearError
  };

  return (
    <div className="export-error-handler">
      {children(exportHandler)}
      
      {isExporting && (
        <div className="export-progress-overlay">
          <div className="export-progress-modal">
            <h3>Exporting Data</h3>
            <ProgressIndicator
              value={progress}
              size="large"
              showPercentage
              label={currentOperation}
              className="export-progress-bar"
            />
            <button
              className="cancel-export-button"
              onClick={() => {
                if (abortControllerRef.current) {
                  abortControllerRef.current.abort();
                }
              }}
            >
              Cancel Export
            </button>
          </div>
        </div>
      )}

      {exportError && (
        <ApiErrorDisplay
          error={{
            message: exportError.message,
            details: exportError.details,
            type: 'export_error',
            code: exportError.type,
            suggestions: exportError.suggestedActions,
            recoverable: exportError.recoverable
          }}
          context="Data Export"
          onRetry={exportError.recoverable ? retryExport : undefined}
          onDismiss={clearError}
          showDetails
          className="export-error-display"
        />
      )}
    </div>
  );
};

export default ExportErrorHandler;