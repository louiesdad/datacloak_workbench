import React, { useState, useMemo } from 'react';
import type { TransformPreview, TransformValidation } from '../types/transforms';
import './TransformPreviewPanel.css';

interface TransformPreviewPanelProps {
  preview: TransformPreview | null;
  isLoading: boolean;
  validation: TransformValidation | null;
  onRefreshPreview: () => void;
}

export const TransformPreviewPanel: React.FC<TransformPreviewPanelProps> = ({
  preview,
  isLoading,
  validation,
  onRefreshPreview
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'original' | 'validation'>('preview');
  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 10;

  const paginatedData = useMemo(() => {
    if (!preview) return { data: [], totalPages: 0 };
    
    const data = activeTab === 'original' ? preview.originalData : preview.transformedData;
    const totalPages = Math.ceil(data.length / rowsPerPage);
    const startIndex = currentPage * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    
    return {
      data: data.slice(startIndex, endIndex),
      totalPages,
      totalRows: data.length
    };
  }, [preview, activeTab, currentPage, rowsPerPage]);

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const renderDataTable = (data: Record<string, any>[]) => {
    if (data.length === 0) {
      return (
        <div className="empty-data">
          <div className="empty-icon">📊</div>
          <p>No data to display</p>
        </div>
      );
    }

    const columns = Object.keys(data[0]);

    return (
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                {columns.map(column => (
                  <td key={column} title={formatValue(row[column])}>
                    {formatValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPagination = () => {
    if (paginatedData.totalPages <= 1) return null;

    return (
      <div className="pagination">
        <button
          onClick={() => setCurrentPage(0)}
          disabled={currentPage === 0}
          className="pagination-button"
        >
          ⟨⟨
        </button>
        <button
          onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
          className="pagination-button"
        >
          ⟨
        </button>
        <span className="pagination-info">
          Page {currentPage + 1} of {paginatedData.totalPages} 
          ({paginatedData.totalRows} rows)
        </span>
        <button
          onClick={() => setCurrentPage(Math.min(paginatedData.totalPages - 1, currentPage + 1))}
          disabled={currentPage >= paginatedData.totalPages - 1}
          className="pagination-button"
        >
          ⟩
        </button>
        <button
          onClick={() => setCurrentPage(paginatedData.totalPages - 1)}
          disabled={currentPage >= paginatedData.totalPages - 1}
          className="pagination-button"
        >
          ⟩⟩
        </button>
      </div>
    );
  };

  const renderValidationTab = () => {
    if (!validation) {
      return (
        <div className="validation-empty">
          <div className="empty-icon">✓</div>
          <p>No validation results</p>
        </div>
      );
    }

    const { valid, errors } = validation;
    const errorsByOperation = errors.reduce((acc, error) => {
      if (!acc[error.operationId]) {
        acc[error.operationId] = [];
      }
      acc[error.operationId].push(error);
      return acc;
    }, {} as Record<string, typeof errors>);

    return (
      <div className="validation-results">
        <div className={`validation-status ${valid ? 'valid' : 'invalid'}`}>
          <div className="status-icon">{valid ? '✓' : '⚠'}</div>
          <div className="status-text">
            {valid ? 'Pipeline is valid' : `${errors.length} validation issue${errors.length > 1 ? 's' : ''} found`}
          </div>
        </div>

        {!valid && (
          <div className="validation-errors">
            {Object.entries(errorsByOperation).map(([operationId, operationErrors]) => (
              <div key={operationId} className="operation-errors">
                <h4 className="operation-title">Operation: {operationId}</h4>
                {operationErrors.map((error, index) => (
                  <div key={index} className={`error-item ${error.severity}`}>
                    <div className="error-severity">{error.severity}</div>
                    <div className="error-message">{error.message}</div>
                    {error.field && <div className="error-field">Field: {error.field}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const getTabCount = (tab: 'preview' | 'original' | 'validation') => {
    switch (tab) {
      case 'preview':
        return preview?.transformedData.length || 0;
      case 'original':
        return preview?.originalData.length || 0;
      case 'validation':
        return validation?.errors.length || 0;
      default:
        return 0;
    }
  };

  return (
    <div className="transform-preview-panel">
      <div className="preview-header">
        <div className="preview-tabs">
          <button
            className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('preview');
              setCurrentPage(0);
            }}
          >
            Preview ({getTabCount('preview')})
          </button>
          <button
            className={`tab ${activeTab === 'original' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('original');
              setCurrentPage(0);
            }}
          >
            Original ({getTabCount('original')})
          </button>
          <button
            className={`tab ${activeTab === 'validation' ? 'active' : ''} ${validation && !validation.valid ? 'has-errors' : ''}`}
            onClick={() => setActiveTab('validation')}
          >
            Validation {validation && !validation.valid && `(${getTabCount('validation')})`}
          </button>
        </div>

        <div className="preview-actions">
          {preview && (
            <div className="preview-stats">
              <span className="stat">
                Affected: {preview.affectedRows.toLocaleString()}
              </span>
              <span className="stat">
                Total: {preview.totalRows.toLocaleString()}
              </span>
              <span className="stat">
                Time: {preview.executionTime.toFixed(2)}ms
              </span>
            </div>
          )}
          <button
            className="refresh-button"
            onClick={onRefreshPreview}
            disabled={isLoading}
            title="Refresh preview"
          >
            {isLoading ? '⟳' : '🔄'}
          </button>
        </div>
      </div>

      <div className="preview-content">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading preview...</p>
          </div>
        ) : !preview && activeTab !== 'validation' ? (
          <div className="no-preview">
            <div className="empty-icon">👁</div>
            <h3>No Preview Available</h3>
            <p>Click the "Preview" button to see the results of your transform operations.</p>
          </div>
        ) : (
          <>
            {activeTab === 'validation' ? (
              renderValidationTab()
            ) : (
              <>
                {renderDataTable(paginatedData.data)}
                {renderPagination()}
              </>
            )}
          </>
        )}

        {preview?.errors && preview.errors.length > 0 && (
          <div className="preview-errors">
            <h4>Execution Errors:</h4>
            {preview.errors.map((error, index) => (
              <div key={index} className="error-message">
                {error}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};