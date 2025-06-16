import React, { useState } from 'react';
import type { EnhancedExportOptions } from '../../../backend/src/services/enhanced-export.service';

interface EnhancedExportDialogProps {
  isOpen: boolean;
  tableName: string;
  onClose: () => void;
  onExport: (options: EnhancedExportOptions) => Promise<void>;
}

export const EnhancedExportDialog: React.FC<EnhancedExportDialogProps> = ({
  isOpen,
  tableName,
  onClose,
  onExport
}) => {
  const [exportOptions, setExportOptions] = useState<Partial<EnhancedExportOptions>>({
    format: 'csv',
    compression: { enabled: false, type: 'gzip' },
    encryption: { enabled: false },
    cloudStorage: undefined,
    resumable: false
  });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    
    try {
      await onExport(exportOptions as EnhancedExportOptions);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-dialog-overlay">
      <div className="export-dialog">
        <h2>Enhanced Export Options</h2>
        <p>Export data from: <strong>{tableName}</strong></p>

        {/* Format Selection */}
        <div className="export-section">
          <label>Export Format:</label>
          <select
            value={exportOptions.format}
            onChange={(e) => setExportOptions({
              ...exportOptions,
              format: e.target.value as any
            })}
            disabled={isExporting}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="excel">Excel (XLSX)</option>
            <option value="parquet">Parquet (for big data)</option>
          </select>
        </div>

        {/* Compression Options */}
        <div className="export-section">
          <label>
            <input
              type="checkbox"
              checked={exportOptions.compression?.enabled || false}
              onChange={(e) => setExportOptions({
                ...exportOptions,
                compression: {
                  ...exportOptions.compression,
                  enabled: e.target.checked
                }
              })}
              disabled={isExporting}
            />
            Enable Compression
          </label>
          {exportOptions.compression?.enabled && (
            <select
              value={exportOptions.compression.type}
              onChange={(e) => setExportOptions({
                ...exportOptions,
                compression: {
                  ...exportOptions.compression!,
                  type: e.target.value as 'gzip' | 'zip'
                }
              })}
              disabled={isExporting}
            >
              <option value="gzip">GZIP</option>
              <option value="zip" disabled>ZIP (coming soon)</option>
            </select>
          )}
        </div>

        {/* Encryption Options */}
        <div className="export-section">
          <label>
            <input
              type="checkbox"
              checked={exportOptions.encryption?.enabled || false}
              onChange={(e) => setExportOptions({
                ...exportOptions,
                encryption: {
                  ...exportOptions.encryption,
                  enabled: e.target.checked
                }
              })}
              disabled={isExporting}
            />
            Enable Encryption (AES-256)
          </label>
          {exportOptions.encryption?.enabled && (
            <input
              type="password"
              placeholder="Encryption password"
              onChange={(e) => setExportOptions({
                ...exportOptions,
                encryption: {
                  ...exportOptions.encryption!,
                  password: e.target.value
                }
              })}
              disabled={isExporting}
            />
          )}
        </div>

        {/* Cloud Storage Options */}
        <div className="export-section">
          <label>Cloud Storage:</label>
          <select
            value={exportOptions.cloudStorage?.provider || 'none'}
            onChange={(e) => {
              if (e.target.value === 'none') {
                setExportOptions({
                  ...exportOptions,
                  cloudStorage: undefined
                });
              } else {
                setExportOptions({
                  ...exportOptions,
                  cloudStorage: {
                    provider: e.target.value as 's3' | 'azure',
                    bucket: ''
                  }
                });
              }
            }}
            disabled={isExporting}
          >
            <option value="none">Local Download</option>
            <option value="s3">Amazon S3</option>
            <option value="azure">Azure Blob Storage</option>
          </select>
          
          {exportOptions.cloudStorage && (
            <input
              type="text"
              placeholder={`${exportOptions.cloudStorage.provider === 's3' ? 'Bucket' : 'Container'} name`}
              value={exportOptions.cloudStorage.bucket || ''}
              onChange={(e) => setExportOptions({
                ...exportOptions,
                cloudStorage: {
                  ...exportOptions.cloudStorage!,
                  bucket: e.target.value
                }
              })}
              disabled={isExporting}
            />
          )}
        </div>

        {/* Additional Options */}
        <div className="export-section">
          <label>
            <input
              type="checkbox"
              checked={exportOptions.resumable || false}
              onChange={(e) => setExportOptions({
                ...exportOptions,
                resumable: e.target.checked
              })}
              disabled={isExporting}
            />
            Make export resumable (for large datasets)
          </label>
        </div>

        {/* Notification Webhook */}
        <div className="export-section">
          <label>Notification Webhook (optional):</label>
          <input
            type="url"
            placeholder="https://your-webhook.com/notify"
            value={exportOptions.notificationWebhook || ''}
            onChange={(e) => setExportOptions({
              ...exportOptions,
              notificationWebhook: e.target.value
            })}
            disabled={isExporting}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="export-error">
            Error: {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="export-actions">
          <button onClick={onClose} disabled={isExporting}>
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="primary"
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
};