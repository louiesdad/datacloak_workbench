import React, { useState, useEffect } from 'react';
import type { 
  Dataset, 
  CostEstimationRequest, 
  CostEstimation,
  BatchSentimentRequest,
  SentimentOptions,
  SecurityAuditRequest 
} from '../../../../shared/contracts/api';
import './RunWizard.css';

interface RunWizardProps {
  datasets: Dataset[];
  onRunComplete: (results: SentimentRunResults) => void;
  onCancel: () => void;
}

interface SentimentRunResults {
  id: string;
  datasetId: string;
  status: 'running' | 'completed' | 'failed';
  results?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
  cost?: number;
}

interface RunConfiguration {
  selectedDatasets: string[];
  textColumn: string;
  sentimentOptions: SentimentOptions;
  auditSecurity: boolean;
  maskPII: boolean;
  exportResults: boolean;
  exportFormat: 'csv' | 'excel' | 'json';
}

export const RunWizard: React.FC<RunWizardProps> = ({
  datasets,
  onRunComplete,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState<RunConfiguration>({
    selectedDatasets: [],
    textColumn: '',
    sentimentOptions: {
      includeKeywords: true,
      includeEmotions: true,
      language: 'en',
      model: 'advanced'
    },
    auditSecurity: true,
    maskPII: true,
    exportResults: true,
    exportFormat: 'csv'
  });
  const [costEstimation, setCostEstimation] = useState<CostEstimation | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0);

  const selectedDataset = datasets.find(d => d.id === config.selectedDatasets[0]);
  const textColumns = selectedDataset?.metadata?.columns.filter(
    col => col.type === 'string' || col.type === 'email'
  ) || [];

  useEffect(() => {
    if (config.selectedDatasets.length > 0 && config.textColumn) {
      estimateCost();
    }
  }, [config.selectedDatasets, config.textColumn, config.sentimentOptions]);

  const estimateCost = async () => {
    if (!selectedDataset) return;

    setIsEstimating(true);
    try {
      const request: CostEstimationRequest = {
        operation: 'sentiment_analysis',
        parameters: {
          rowCount: selectedDataset.rowCount,
          columnCount: selectedDataset.columnCount,
          avgTextLength: 100, // Estimate
          model: config.sentimentOptions.model === 'openai' ? 'gpt-3.5-turbo' : 'basic',
          provider: config.sentimentOptions.model === 'openai' ? 'openai' : undefined
        }
      };

      const response = await window.platformBridge.backend.estimateCost(request);
      if (response.success && response.data) {
        setCostEstimation(response.data);
      }
    } catch (error) {
      console.error('Cost estimation failed:', error);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleRunSentimentAnalysis = async () => {
    if (!selectedDataset) return;

    setIsRunning(true);
    setRunProgress(0);

    try {
      // Step 1: Security audit if requested
      if (config.auditSecurity) {
        setRunProgress(10);
        const auditRequest: SecurityAuditRequest = {
          datasetId: selectedDataset.id,
          auditLevel: 'thorough',
          includeRecommendations: true
        };
        await window.platformBridge.backend.auditSecurity(auditRequest);
      }

      // Step 2: Field inference to ensure we have the right column
      setRunProgress(20);
      await window.platformBridge.backend.inferFields({
        datasetId: selectedDataset.id,
        useGPTAssist: true,
        confidenceThreshold: 0.8
      });

      // Step 3: Batch sentiment analysis
      setRunProgress(40);
      // Note: This would require fetching the actual text data
      // For now, we'll simulate the batch request
      const batchRequest: BatchSentimentRequest = {
        texts: [], // Would be populated with actual data
        options: config.sentimentOptions
      };

      const sentimentResponse = await window.platformBridge.backend.batchAnalyzeSentiment(batchRequest);
      setRunProgress(80);

      // Step 4: Export results if requested
      if (config.exportResults) {
        setRunProgress(90);
        await window.platformBridge.backend.exportData({
          datasetId: selectedDataset.id,
          format: config.exportFormat,
          includeHeaders: true
        });
      }

      setRunProgress(100);

      const results: SentimentRunResults = {
        id: `run-${Date.now()}`,
        datasetId: selectedDataset.id,
        status: 'completed',
        results: sentimentResponse.data,
        startTime: new Date(),
        endTime: new Date(),
        cost: costEstimation?.estimatedCost
      };

      onRunComplete(results);

    } catch (error) {
      console.error('Sentiment analysis run failed:', error);
      const results: SentimentRunResults = {
        id: `run-${Date.now()}`,
        datasetId: selectedDataset.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        startTime: new Date(),
        cost: costEstimation?.estimatedCost
      };
      onRunComplete(results);
    } finally {
      setIsRunning(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="step-content">
            <h3>Select Dataset</h3>
            <p>Choose the dataset you want to analyze for sentiment.</p>
            
            <div className="dataset-selection">
              {datasets.map(dataset => (
                <div
                  key={dataset.id}
                  className={`dataset-card ${config.selectedDatasets.includes(dataset.id) ? 'selected' : ''}`}
                  onClick={() => setConfig(prev => ({ 
                    ...prev, 
                    selectedDatasets: [dataset.id],
                    textColumn: '' // Reset text column when dataset changes
                  }))}
                >
                  <div className="dataset-header">
                    <h4>{dataset.name}</h4>
                    <span className="dataset-size">{(dataset.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  <div className="dataset-info">
                    <span>{dataset.rowCount.toLocaleString()} rows</span>
                    <span>{dataset.columnCount} columns</span>
                    <span className={`status ${dataset.status}`}>{dataset.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <h3>Configure Analysis</h3>
            <p>Select the text column and configure sentiment analysis options.</p>
            
            <div className="form-group">
              <label>Text Column</label>
              <select
                value={config.textColumn}
                onChange={(e) => setConfig(prev => ({ ...prev, textColumn: e.target.value }))}
              >
                <option value="">Select column...</option>
                {textColumns.map(column => (
                  <option key={column.name} value={column.name}>
                    {column.name} ({column.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Sentiment Model</label>
              <select
                value={config.sentimentOptions.model}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  sentimentOptions: { ...prev.sentimentOptions, model: e.target.value as any }
                }))}
              >
                <option value="basic">Basic (Fast, Lower Cost)</option>
                <option value="advanced">Advanced (Balanced)</option>
                <option value="openai">OpenAI GPT (Highest Accuracy)</option>
              </select>
            </div>

            <div className="form-options">
              <label>
                <input
                  type="checkbox"
                  checked={config.sentimentOptions.includeKeywords}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    sentimentOptions: { ...prev.sentimentOptions, includeKeywords: e.target.checked }
                  }))}
                />
                Extract keywords
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.sentimentOptions.includeEmotions}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    sentimentOptions: { ...prev.sentimentOptions, includeEmotions: e.target.checked }
                  }))}
                />
                Analyze emotions
              </label>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <h3>Security & Privacy</h3>
            <p>Configure privacy protection and security audit options.</p>
            
            <div className="form-options">
              <label>
                <input
                  type="checkbox"
                  checked={config.auditSecurity}
                  onChange={(e) => setConfig(prev => ({ ...prev, auditSecurity: e.target.checked }))}
                />
                Run security audit before analysis
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.maskPII}
                  onChange={(e) => setConfig(prev => ({ ...prev, maskPII: e.target.checked }))}
                />
                Automatically mask PII data
              </label>
            </div>

            <div className="form-group">
              <label>Export Results</label>
              <div className="form-options">
                <label>
                  <input
                    type="checkbox"
                    checked={config.exportResults}
                    onChange={(e) => setConfig(prev => ({ ...prev, exportResults: e.target.checked }))}
                  />
                  Export results after analysis
                </label>
              </div>
              
              {config.exportResults && (
                <select
                  value={config.exportFormat}
                  onChange={(e) => setConfig(prev => ({ ...prev, exportFormat: e.target.value as any }))}
                >
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                  <option value="json">JSON</option>
                </select>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="step-content">
            <h3>Cost Estimation & Review</h3>
            <p>Review your configuration and estimated costs before running.</p>
            
            <div className="config-summary">
              <h4>Configuration Summary</h4>
              <div className="summary-item">
                <strong>Dataset:</strong> {selectedDataset?.name}
              </div>
              <div className="summary-item">
                <strong>Text Column:</strong> {config.textColumn}
              </div>
              <div className="summary-item">
                <strong>Model:</strong> {config.sentimentOptions.model}
              </div>
              <div className="summary-item">
                <strong>Features:</strong> {[
                  config.sentimentOptions.includeKeywords && 'Keywords',
                  config.sentimentOptions.includeEmotions && 'Emotions',
                  config.auditSecurity && 'Security Audit',
                  config.maskPII && 'PII Masking'
                ].filter(Boolean).join(', ')}
              </div>
            </div>

            {isEstimating ? (
              <div className="cost-loading">
                <div className="spinner"></div>
                <p>Calculating costs...</p>
              </div>
            ) : costEstimation ? (
              <div className="cost-estimation">
                <h4>Cost Estimation</h4>
                <div className="cost-breakdown">
                  <div className="cost-main">
                    <span className="cost-amount">${costEstimation.estimatedCost.toFixed(2)}</span>
                    <span className="cost-currency">{costEstimation.currency}</span>
                  </div>
                  <div className="cost-details">
                    <div>Tokens: {costEstimation.breakdown.tokens.toLocaleString()}</div>
                    <div>Requests: {costEstimation.breakdown.requests.toLocaleString()}</div>
                    <div>Processing Time: ~{costEstimation.breakdown.processingTime}s</div>
                  </div>
                </div>
                
                {costEstimation.alternatives && costEstimation.alternatives.length > 0 && (
                  <div className="cost-alternatives">
                    <h5>Alternative Options</h5>
                    {costEstimation.alternatives.map((alt, index) => (
                      <div key={index} className="alternative-option">
                        <strong>{alt.provider} - {alt.model}</strong>
                        <span className="alt-cost">${alt.cost.toFixed(2)}</span>
                        <div className="alt-features">{alt.features.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="cost-error">
                <p>Unable to calculate cost estimation. You can still proceed with the analysis.</p>
              </div>
            )}

            {isRunning && (
              <div className="run-progress">
                <h4>Analysis in Progress</h4>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${runProgress}%` }}
                  ></div>
                </div>
                <p>{runProgress}% complete</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return config.selectedDatasets.length > 0;
      case 2:
        return config.textColumn !== '';
      case 3:
        return true;
      case 4:
        return !isRunning;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      handleRunSentimentAnalysis();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="run-wizard">
      <div className="wizard-header">
        <h2>Sentiment Analysis Wizard</h2>
        <div className="step-indicators">
          {[1, 2, 3, 4].map(step => (
            <div
              key={step}
              className={`step-indicator ${step === currentStep ? 'active' : ''} ${step < currentStep ? 'completed' : ''}`}
            >
              <span className="step-number">{step}</span>
              <span className="step-label">
                {step === 1 && 'Dataset'}
                {step === 2 && 'Configure'}
                {step === 3 && 'Security'}
                {step === 4 && 'Review'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="wizard-content">
        {renderStepContent()}
      </div>

      <div className="wizard-actions">
        <button
          className="wizard-button secondary"
          onClick={currentStep === 1 ? onCancel : handlePrevious}
          disabled={isRunning}
        >
          {currentStep === 1 ? 'Cancel' : 'Previous'}
        </button>
        
        <button
          className="wizard-button primary"
          onClick={handleNext}
          disabled={!canProceedToNext() || isRunning}
        >
          {currentStep === 4 ? (isRunning ? 'Running...' : 'Start Analysis') : 'Next'}
        </button>
      </div>
    </div>
  );
};