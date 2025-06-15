import React, { useState, useCallback } from 'react';
import type { SentimentOptions } from '../../../../shared/contracts/api';
import { ProgressIndicator } from './ProgressIndicator';
import { ApiErrorDisplay } from './ApiErrorDisplay';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import './SentimentAnalysisControl.css';

interface SentimentModel {
  id: string;
  name: string;
  description: string;
  accuracy: number;
  speed: 'fast' | 'medium' | 'slow';
  supportedLanguages: string[];
  features: {
    emotions: boolean;
    keywords: boolean;
    confidence: boolean;
    multiclass: boolean;
  };
  cost: {
    perRequest: number;
    currency: 'USD';
  };
}

interface SentimentAnalysisControlProps {
  onAnalysisStart: (config: SentimentAnalysisConfig) => Promise<void>;
  onModelSelection?: (model: SentimentModel) => void;
  availableModels?: SentimentModel[];
  disabled?: boolean;
  isAnalyzing?: boolean;
  progress?: number;
  className?: string;
}

interface SentimentAnalysisConfig {
  model: string;
  options: SentimentOptions;
  batchSize: number;
  priority: 'low' | 'normal' | 'high';
  realTimeUpdates: boolean;
}

const DEFAULT_MODELS: SentimentModel[] = [
  {
    id: 'basic',
    name: 'Basic Sentiment Model',
    description: 'Fast and efficient for simple positive/negative/neutral classification',
    accuracy: 0.85,
    speed: 'fast',
    supportedLanguages: ['en', 'es', 'fr', 'de'],
    features: {
      emotions: false,
      keywords: true,
      confidence: true,
      multiclass: false
    },
    cost: {
      perRequest: 0.001,
      currency: 'USD'
    }
  },
  {
    id: 'advanced',
    name: 'Advanced Sentiment Model',
    description: 'High accuracy with emotion detection and detailed analysis',
    accuracy: 0.92,
    speed: 'medium',
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt'],
    features: {
      emotions: true,
      keywords: true,
      confidence: true,
      multiclass: true
    },
    cost: {
      perRequest: 0.005,
      currency: 'USD'
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise Model',
    description: 'Premium model with industry-specific training and custom emotions',
    accuracy: 0.96,
    speed: 'slow',
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl'],
    features: {
      emotions: true,
      keywords: true,
      confidence: true,
      multiclass: true
    },
    cost: {
      perRequest: 0.02,
      currency: 'USD'
    }
  }
];

export const SentimentAnalysisControl: React.FC<SentimentAnalysisControlProps> = ({
  onAnalysisStart,
  onModelSelection,
  availableModels = DEFAULT_MODELS,
  disabled = false,
  isAnalyzing = false,
  progress = 0,
  className = ''
}) => {
  const [selectedModel, setSelectedModel] = useState<SentimentModel>(availableModels[0]);
  const [config, setConfig] = useState<SentimentAnalysisConfig>({
    model: availableModels[0].id,
    options: {
      includeKeywords: true,
      includeEmotions: selectedModel.features.emotions,
      language: 'en',
      model: availableModels[0].id
    },
    batchSize: 100,
    priority: 'normal',
    realTimeUpdates: true
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [apiError, setApiError] = useState<any>(null);
  const { handleApiError } = useApiErrorHandler();

  const handleModelChange = useCallback((modelId: string) => {
    const model = availableModels.find(m => m.id === modelId);
    if (!model) return;

    setSelectedModel(model);
    setConfig(prev => ({
      ...prev,
      model: modelId,
      options: {
        ...prev.options,
        model: modelId,
        includeEmotions: model.features.emotions && prev.options.includeEmotions
      }
    }));
    
    onModelSelection?.(model);
  }, [availableModels, onModelSelection]);

  const handleOptionsChange = useCallback((updates: Partial<SentimentOptions>) => {
    setConfig(prev => ({
      ...prev,
      options: {
        ...prev.options,
        ...updates
      }
    }));
  }, []);

  const handleConfigChange = useCallback((updates: Partial<SentimentAnalysisConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  const handleStartAnalysis = useCallback(async () => {
    setApiError(null);
    
    try {
      await onAnalysisStart(config);
    } catch (error) {
      const apiError = handleApiError(error, {
        operation: 'start sentiment analysis',
        component: 'SentimentAnalysisControl'
      });
      setApiError(apiError);
    }
  }, [config, onAnalysisStart, handleApiError]);

  const formatAccuracy = (accuracy: number) => `${(accuracy * 100).toFixed(1)}%`;
  const formatCost = (cost: number) => `$${cost.toFixed(4)}`;

  const estimatedCost = (config.batchSize * selectedModel.cost.perRequest).toFixed(4);

  return (
    <div className={`sentiment-analysis-control ${className}`} data-testid="sentiment-analysis-control">
      <div className="control-header">
        <h3>Sentiment Analysis Configuration</h3>
        <div className="header-actions">
          <button
            className="toggle-advanced"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            data-testid="toggle-advanced-options"
          >
            {showAdvancedOptions ? '▼ Hide' : '▶ Show'} Advanced Options
          </button>
        </div>
      </div>

      {/* Model Selection */}
      <div className="config-section">
        <h4>Model Selection</h4>
        <div className="model-grid" data-testid="model-selection">
          {availableModels.map(model => (
            <div
              key={model.id}
              className={`model-card ${selectedModel.id === model.id ? 'selected' : ''}`}
              onClick={() => handleModelChange(model.id)}
              data-testid={`model-${model.id}`}
            >
              <div className="model-header">
                <div className="model-name">{model.name}</div>
                <div className="model-accuracy">{formatAccuracy(model.accuracy)}</div>
              </div>
              <div className="model-description">{model.description}</div>
              <div className="model-features">
                <div className="feature-tags">
                  <span className={`feature-tag speed-${model.speed}`}>{model.speed}</span>
                  {model.features.emotions && <span className="feature-tag">emotions</span>}
                  {model.features.keywords && <span className="feature-tag">keywords</span>}
                  {model.features.multiclass && <span className="feature-tag">multiclass</span>}
                </div>
                <div className="model-cost">
                  {formatCost(model.cost.perRequest)}/req
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis Options */}
      <div className="config-section">
        <h4>Analysis Options</h4>
        <div className="options-grid">
          <div className="option-group">
            <label>Language</label>
            <select
              value={config.options.language}
              onChange={(e) => handleOptionsChange({ language: e.target.value })}
              data-testid="language-select"
            >
              {selectedModel.supportedLanguages.map(lang => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="option-group">
            <label>
              <input
                type="checkbox"
                checked={config.options.includeKeywords}
                onChange={(e) => handleOptionsChange({ includeKeywords: e.target.checked })}
                data-testid="include-keywords-checkbox"
              />
              Include Keywords
            </label>
          </div>

          {selectedModel.features.emotions && (
            <div className="option-group">
              <label>
                <input
                  type="checkbox"
                  checked={config.options.includeEmotions}
                  onChange={(e) => handleOptionsChange({ includeEmotions: e.target.checked })}
                  data-testid="include-emotions-checkbox"
                />
                Include Emotions
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Options */}
      {showAdvancedOptions && (
        <div className="config-section advanced-options" data-testid="advanced-options">
          <h4>Advanced Configuration</h4>
          <div className="options-grid">
            <div className="option-group">
              <label>Batch Size</label>
              <input
                type="number"
                min="1"
                max="1000"
                value={config.batchSize}
                onChange={(e) => handleConfigChange({ batchSize: parseInt(e.target.value) || 100 })}
                data-testid="batch-size-input"
              />
              <span className="help-text">Number of records processed per batch</span>
            </div>

            <div className="option-group">
              <label>Priority</label>
              <select
                value={config.priority}
                onChange={(e) => handleConfigChange({ priority: e.target.value as any })}
                data-testid="priority-select"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="option-group">
              <label>
                <input
                  type="checkbox"
                  checked={config.realTimeUpdates}
                  onChange={(e) => handleConfigChange({ realTimeUpdates: e.target.checked })}
                  data-testid="real-time-updates-checkbox"
                />
                Real-time Progress Updates
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Cost Estimation */}
      <div className="config-section">
        <h4>Cost Estimation</h4>
        <div className="cost-breakdown" data-testid="cost-estimation">
          <div className="cost-item">
            <span>Model Cost:</span>
            <span>{formatCost(selectedModel.cost.perRequest)} per request</span>
          </div>
          <div className="cost-item">
            <span>Batch Size:</span>
            <span>{config.batchSize} records</span>
          </div>
          <div className="cost-item total">
            <span>Estimated Cost:</span>
            <span>${estimatedCost}</span>
          </div>
        </div>
      </div>

      {/* Progress Display */}
      {isAnalyzing && (
        <div className="analysis-progress" data-testid="analysis-progress">
          <div className="progress-header">
            <h4>Analysis in Progress</h4>
            <span className="progress-percentage">{progress.toFixed(1)}%</span>
          </div>
          <ProgressIndicator
            value={progress}
            size="large"
            showPercentage={false}
            className="analysis-progress-bar"
          />
          <div className="progress-details">
            <span>Using {selectedModel.name}</span>
            <span>•</span>
            <span>Batch size: {config.batchSize}</span>
            <span>•</span>
            <span>Priority: {config.priority}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="control-actions">
        <button
          className="action-button primary large"
          onClick={handleStartAnalysis}
          disabled={disabled || isAnalyzing}
          data-testid="start-analysis-button"
        >
          {isAnalyzing ? (
            <>
              <ProgressIndicator size="small" indeterminate />
              Analyzing...
            </>
          ) : (
            '🚀 Start Sentiment Analysis'
          )}
        </button>

        {isAnalyzing && (
          <button
            className="action-button secondary"
            onClick={() => {/* TODO: Implement cancel */}}
            data-testid="cancel-analysis-button"
          >
            Cancel Analysis
          </button>
        )}
      </div>

      {/* Error Display */}
      <ApiErrorDisplay
        error={apiError}
        context="Sentiment Analysis"
        onDismiss={() => setApiError(null)}
      />
    </div>
  );
};

export default SentimentAnalysisControl;