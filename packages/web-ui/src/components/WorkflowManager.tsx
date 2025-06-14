import React, { useCallback } from 'react';
import { useAppContext, useAppActions, type AnalysisConfig } from '../context/AppContext';
import { 
  DataSourcePicker, 
  ProfilerUI,
  type FileProfile,
  type FieldProfile
} from './index';
import { 
  TransformDesigner,
  RunWizard,
  ResultExplorer,
  preloadHeavyComponents,
  preloadAnalysisComponents
} from './LazyComponents';
import type { FileInfo } from '../platform-bridge';
import type { Dataset, SentimentResult } from '../../../../shared/contracts/api';
import './WorkflowManager.css';

interface SentimentRunResults {
  id: string;
  datasetId: string;
  status: 'running' | 'completed' | 'failed';
  results?: SentimentResult[];
  error?: string;
  startTime: Date;
  endTime?: Date;
  cost?: number;
}

export const WorkflowManager: React.FC = () => {
  const { state } = useAppContext();
  const {
    setStep,
    completeStep,
    setLoading,
    setError,
    addNotification,
    setSelectedFiles,
    setFileProfiles,
    setSelectedDataset,
    setAnalysisConfig,
    setAnalysisResults,
    setAnalysisRunning
  } = useAppActions();

  // Mock data generator for development
  const createMockFileProfile = useCallback((file: FileInfo): FileProfile => {
    const mockFields: FieldProfile[] = [
      {
        name: 'customer_id',
        type: 'number',
        samples: ['12345', '67890', '11111'],
        nullCount: 0,
        totalCount: 1000,
        uniqueCount: 1000,
        piiDetection: { isPII: false, confidence: 0.1 }
      },
      {
        name: 'review_text',
        type: 'string',
        samples: ['Great product, highly recommend!', 'Poor quality, disappointed', 'Average experience'],
        nullCount: 5,
        totalCount: 1000,
        uniqueCount: 995,
        piiDetection: { isPII: false, confidence: 0.15 }
      },
      {
        name: 'email',
        type: 'string',
        samples: ['john.doe@example.com', 'jane.smith@company.com', 'user@domain.org'],
        nullCount: 5,
        totalCount: 1000,
        uniqueCount: 995,
        piiDetection: { isPII: true, piiType: 'email', confidence: 0.95 }
      },
      {
        name: 'phone_number',
        type: 'string',
        samples: ['(555) 123-4567', '555-987-6543', '+1-555-555-5555'],
        nullCount: 50,
        totalCount: 1000,
        uniqueCount: 950,
        piiDetection: { isPII: true, piiType: 'phone', confidence: 0.88 }
      },
      {
        name: 'rating',
        type: 'number',
        samples: ['5', '3', '4'],
        nullCount: 0,
        totalCount: 1000,
        uniqueCount: 5,
        piiDetection: { isPII: false, confidence: 0.05 }
      }
    ];

    return {
      file,
      fields: mockFields,
      rowCount: 1000,
      processingTime: 2.5,
      errors: []
    };
  }, []);

  // Workflow step handlers
  const handleFilesSelected = useCallback(async (files: FileInfo[]) => {
    try {
      setLoading(true);
      setSelectedFiles(files);

      // In production, this would upload files and get real datasets
      // For now, create mock profiles
      const profiles = files.map(createMockFileProfile);
      setFileProfiles(profiles);

      completeStep('upload');
      setStep('profile');
      
      addNotification({
        type: 'success',
        title: 'Files Processed',
        message: `Successfully processed ${files.length} file(s) and detected field types.`
      });

    } catch (error) {
      console.error('File processing failed:', error);
      setError('Failed to process selected files. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setSelectedFiles, setFileProfiles, completeStep, setStep, addNotification, setError, createMockFileProfile]);

  const handleProfileComplete = useCallback(() => {
    completeStep('profile');
    setStep('transform');
    
    // Preload heavy components for next steps
    preloadHeavyComponents();
    
    addNotification({
      type: 'info',
      title: 'Profile Complete',
      message: 'Data profiling completed. You can now optionally transform your data or proceed to sentiment analysis.'
    });
  }, [completeStep, setStep, addNotification]);

  const handleTransformComplete = useCallback(() => {
    completeStep('transform');
    setStep('configure');
  }, [completeStep, setStep]);

  const handleSkipTransform = useCallback(() => {
    completeStep('transform');
    setStep('configure');
    
    // Preload analysis components
    preloadAnalysisComponents();
    
    addNotification({
      type: 'info',
      title: 'Transform Skipped',
      message: 'Proceeding to sentiment analysis configuration with original data.'
    });
  }, [completeStep, setStep, addNotification]);

  const handleAnalysisConfigured = useCallback((config: AnalysisConfig) => {
    setAnalysisConfig(config);
    completeStep('configure');
    setStep('execute');
  }, [setAnalysisConfig, completeStep, setStep]);

  const handleRunComplete = useCallback((results: SentimentRunResults) => {
    if (results.status === 'completed' && results.results) {
      setAnalysisResults(results.results);
      completeStep('execute');
      setStep('results');
      
      addNotification({
        type: 'success',
        title: 'Analysis Complete',
        message: `Sentiment analysis completed successfully. Processed ${results.results.length} items.`
      });
    } else if (results.status === 'failed') {
      setError(results.error || 'Sentiment analysis failed');
      
      addNotification({
        type: 'error',
        title: 'Analysis Failed',
        message: results.error || 'An error occurred during sentiment analysis.'
      });
    }
    
    setAnalysisRunning(false);
  }, [setAnalysisResults, completeStep, setStep, addNotification, setError, setAnalysisRunning]);

  const handleRunCancel = useCallback(() => {
    setStep('configure');
    setAnalysisRunning(false);
  }, [setStep, setAnalysisRunning]);

  const handleExportResults = useCallback(async (format: 'csv' | 'excel' | 'json') => {
    try {
      setLoading(true);
      
      // In production, this would use the backend export API
      // For now, simulate export
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addNotification({
        type: 'success',
        title: 'Export Complete',
        message: `Results exported successfully as ${format.toUpperCase()}.`
      });
      
    } catch (error) {
      console.error('Export failed:', error);
      addNotification({
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to export results. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  }, [setLoading, addNotification]);

  const handleResultsClose = useCallback(() => {
    // Allow user to go back to any previous step
    // Results can always be accessed again
  }, []);

  // Render the current workflow step
  const renderCurrentStep = () => {
    switch (state.currentStep) {
      case 'upload':
        return (
          <div className="workflow-step-container">
            <div className="step-header">
              <h1>Upload Data Files</h1>
              <p>Select your data files for sentiment analysis. Supports CSV, Excel, and TSV formats up to 50GB.</p>
            </div>
            
            <DataSourcePicker
              onFilesSelected={handleFilesSelected}
              maxSizeGB={50}
              acceptedFormats={['.csv', '.xlsx', '.xls', '.tsv']}
            />
            
            {state.datasets.length > 0 && (
              <div className="existing-datasets">
                <h3>Previously Uploaded Datasets</h3>
                <div className="dataset-list">
                  {state.datasets.map(dataset => (
                    <div 
                      key={dataset.id} 
                      className="dataset-item"
                      onClick={() => {
                        setSelectedDataset(dataset);
                        completeStep('upload');
                        setStep('profile');
                      }}
                    >
                      <div className="dataset-name">{dataset.name}</div>
                      <div className="dataset-info">
                        {dataset.rowCount.toLocaleString()} rows • {dataset.columnCount} columns
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'profile':
        return (
          <div className="workflow-step-container">
            <div className="step-header">
              <h1>Data Profile & PII Detection</h1>
              <p>Review the automatically detected field types and PII information.</p>
            </div>

            {state.fileProfiles.length > 0 ? (
              <>
                <ProfilerUI fileProfiles={state.fileProfiles} />
                
                <div className="step-actions">
                  <button 
                    className="primary-button"
                    onClick={handleProfileComplete}
                  >
                    Continue to Transform
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>No data profiles available. Please upload files first.</p>
                <button onClick={() => setStep('upload')}>
                  Go Back to Upload
                </button>
              </div>
            )}
          </div>
        );

      case 'transform':
        return (
          <div className="workflow-step-container">
            <div className="step-header">
              <h1>Data Transformation (Optional)</h1>
              <p>Transform your data before sentiment analysis. This step is optional.</p>
            </div>

            <div className="transform-options">
              <div className="option-card">
                <h3>Use Data As-Is</h3>
                <p>Proceed with the original data without any transformations.</p>
                <button 
                  className="secondary-button"
                  onClick={handleSkipTransform}
                >
                  Skip Transform
                </button>
              </div>

              <div className="option-card">
                <h3>Transform Data</h3>
                <p>Apply filters, joins, aggregations, or other transformations.</p>
                <button 
                  className="primary-button"
                  onClick={() => {
                    // For now, skip to next step
                    // In production, this would open the TransformDesigner
                    handleTransformComplete();
                  }}
                >
                  Configure Transforms
                </button>
              </div>
            </div>
          </div>
        );

      case 'configure':
        return (
          <div className="workflow-step-container">
            <div className="step-header">
              <h1>Configure Sentiment Analysis</h1>
              <p>Set up your sentiment analysis run with cost estimation.</p>
            </div>

            <RunWizard
              datasets={state.selectedDataset ? [state.selectedDataset] : []}
              onRunComplete={handleRunComplete}
              onCancel={handleRunCancel}
            />
          </div>
        );

      case 'execute':
        return (
          <div className="workflow-step-container">
            <div className="step-header">
              <h1>Running Sentiment Analysis</h1>
              <p>Your sentiment analysis is currently running. Please wait...</p>
            </div>

            <div className="execution-status">
              <div className="spinner-large"></div>
              <p>Processing your data for sentiment analysis...</p>
              
              {state.isAnalysisRunning && (
                <button 
                  className="secondary-button"
                  onClick={handleRunCancel}
                >
                  Cancel Analysis
                </button>
              )}
            </div>
          </div>
        );

      case 'results':
        return (
          <div className="workflow-step-container full-height">
            <ResultExplorer
              results={state.analysisResults}
              onExport={handleExportResults}
              onClose={handleResultsClose}
            />
          </div>
        );

      default:
        return (
          <div className="workflow-step-container">
            <div className="error-state">
              <h1>Unknown Step</h1>
              <p>The current workflow step is not recognized.</p>
              <button onClick={() => setStep('upload')}>
                Return to Start
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="workflow-manager">
      {renderCurrentStep()}
    </div>
  );
};