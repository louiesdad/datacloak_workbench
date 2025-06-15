import React, { useState } from 'react';
import type { FileProfile } from './ProfilerUI';
import './DataPreview.css';

interface DataPreviewProps {
  fileProfile: FileProfile;
  previewData?: Record<string, any>[];
  maxRows?: number;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ 
  fileProfile, 
  previewData,
  maxRows = 10 
}) => {
  const [showAll, setShowAll] = useState(false);
  
  // Generate mock preview data if not provided
  const generateMockData = (): Record<string, any>[] => {
    const data: Record<string, any>[] = [];
    const numRows = Math.min(maxRows, fileProfile.rowCount);
    
    for (let i = 0; i < numRows; i++) {
      const row: Record<string, any> = {};
      fileProfile.fields.forEach(field => {
        if (field.samples && field.samples.length > 0) {
          // Use samples cyclically
          row[field.name] = field.samples[i % field.samples.length];
        } else {
          // Generate placeholder data based on type
          switch (field.type) {
            case 'number':
              row[field.name] = Math.floor(Math.random() * 1000);
              break;
            case 'boolean':
              row[field.name] = Math.random() > 0.5 ? 'true' : 'false';
              break;
            case 'date':
              row[field.name] = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              break;
            default:
              row[field.name] = `Sample ${i + 1}`;
          }
        }
      });
      data.push(row);
    }
    
    return data;
  };
  
  const data = previewData || generateMockData();
  const displayData = showAll ? data : data.slice(0, 5);
  const hasMoreData = data.length > 5;
  
  return (
    <div className="data-preview" data-testid="data-preview">
      <div className="preview-header">
        <h4>Data Preview</h4>
        <span className="preview-info">
          Showing {displayData.length} of {data.length} rows 
          (Total: {fileProfile.rowCount.toLocaleString()} rows)
        </span>
      </div>
      
      <div className="preview-table-container">
        <table className="preview-table">
          <thead>
            <tr>
              {fileProfile.fields.map(field => (
                <th key={field.name} className={`field-${field.type}`}>
                  <div className="header-content">
                    <span className="field-name">{field.name}</span>
                    <span className="field-type">{field.type}</span>
                    {field.piiDetection.isPII && (
                      <span className="pii-indicator" title="Contains PII">🔒</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {fileProfile.fields.map(field => (
                  <td key={field.name} className={`field-${field.type}`}>
                    {field.piiDetection.isPII && field.piiDetection.confidence > 0.8 ? (
                      <span className="masked-value">••••••••</span>
                    ) : (
                      <span className="cell-value">{row[field.name] || <em>null</em>}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {hasMoreData && (
        <div className="preview-actions">
          <button 
            className="toggle-preview-button"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Less' : `Show All ${data.length} Rows`}
          </button>
        </div>
      )}
    </div>
  );
};