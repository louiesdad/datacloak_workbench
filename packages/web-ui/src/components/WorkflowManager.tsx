import React, { useCallback, useEffect } from 'react';
import { useAppContext, useAppActions, type AnalysisConfig } from '../context/AppContext';
import { 
  DataSourcePicker, 
  ProfilerUI,
  type FileProfile,
  type FieldProfile,
  MemoryMonitor,
  ElectronFeatureMonitor
} from './index';
import { 
  TransformDesigner,
  RunWizard,
  ResultExplorer,
  preloadHeavyComponents,
  preloadAnalysisComponents
} from './LazyComponents';
import { useWebWorker } from '../hooks/useWebWorker';
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
    setTransformPipeline,
    setAnalysisConfig,
    setAnalysisResults,
    setAnalysisRunning
  } = useAppActions();

  // Performance monitoring with Web Worker
  const performanceWorker = useWebWorker(() => new Worker(new URL('../workers/fileProcessor.worker.ts', import.meta.url)), {
    timeout: 30000,
    retries: 1
  });

  // Monitor performance and memory usage
  useEffect(() => {
    let performanceInterval: NodeJS.Timeout;
    
    const monitorPerformance = () => {
      if (performance.memory) {
        const memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
        
        // Warn if memory usage is high
        if (memoryUsage > 100) {
          console.warn(`High memory usage detected: ${memoryUsage.toFixed(1)}MB`);
          addNotification({
            type: 'warning',
            message: `High memory usage: ${memoryUsage.toFixed(1)}MB. Consider processing files in smaller batches.`,
            duration: 5000
          });
        }
      }
    };

    // Monitor performance every 30 seconds during active work
    if (state.isLoading || state.analysisRunning) {
      performanceInterval = setInterval(monitorPerformance, 30000);
    }

    return () => {
      if (performanceInterval) {
        clearInterval(performanceInterval);
      }
    };
  }, [state.isLoading, state.analysisRunning, addNotification]);

  // Mock data generator for development
  const createMockFileProfile = useCallback((file: FileInfo): FileProfile => {
    // Validate file format
    const extension = file.name.toLowerCase().split('.').pop();
    const validFormats = ['csv', 'xlsx', 'xls', 'tsv'];
    
    if (!validFormats.includes(extension || '')) {
      throw new Error(`Invalid file format: ${extension}. Supported formats: CSV, XLSX, XLS, TSV`);
    }
    
    // Check for malformed CSV (in production, this would parse the actual file)
    if (extension === 'csv' && file.name.includes('malformed')) {
      throw new Error('Invalid CSV format: Unable to parse file. Please check that your CSV file is properly formatted.');
    }
    
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

  // Convert FileProfile to Dataset for sentiment analysis
  const createDatasetFromProfile = useCallback((profile: FileProfile): Dataset => {
    return {
      id: `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: profile.file.name,
      filename: profile.file.name,
      size: profile.file.size,
      rowCount: profile.rowCount,
      columnCount: profile.fields.length,
      uploadedAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      fileType: getFileType(profile.file.name),
      status: 'ready' as const,
      metadata: {
        hasHeader: true,
        columns: profile.fields.map(field => ({
          name: field.name,
          type: field.type as any,
          confidence: field.piiDetection.confidence,
          nullable: field.nullCount > 0,
          unique: field.uniqueCount === field.totalCount,
          hasPII: field.piiDetection.isPII,
          piiTypes: field.piiDetection.piiType ? [field.piiDetection.piiType as any] : [],
          statistics: field.stats ? {
            nullCount: field.nullCount,
            uniqueCount: field.uniqueCount || 0,
            min: field.stats.min,
            max: field.stats.max,
            mean: field.stats.mean,
            median: field.stats.median
          } : undefined
        })),
        preview: [
          // Create preview data from field samples
          profile.fields.reduce((row, field) => {
            row[field.name] = field.samples[0] || null;
            return row;
          }, {} as Record<string, any>)
        ]
      }
    };
  }, []);

  const getFileType = useCallback((filename: string): 'csv' | 'excel' | 'xlsx' | 'txt' => {
    const extension = filename.toLowerCase().split('.').pop();
    switch (extension) {
      case 'csv': return 'csv';
      case 'xlsx': return 'xlsx';
      case 'xls': return 'excel';
      case 'txt': case 'tsv': return 'txt';
      default: return 'csv';
    }
  }, []);

  // Workflow step handlers
  const handleFilesSelected = useCallback(async (files: FileInfo[]) => {
    try {
      setLoading(true);
      setSelectedFiles(files);
      
      // Show immediate feedback that upload started
      addNotification({
        type: 'info',
        title: 'Processing Files',
        message: `Processing ${files.length} file(s)...`
      });

      // Simulate realistic file processing time based on file size
      // This ensures the progress bar is visible and then disappears properly
      const processingTime = Math.max(500, Math.min(3000, files.length * 200));
      await new Promise(resolve => setTimeout(resolve, processingTime));

      // In production, this would upload files and get real datasets
      // For now, create mock profiles and datasets
      const profiles = files.map(createMockFileProfile);
      setFileProfiles(profiles);

      // Create datasets from file profiles for sentiment analysis
      const datasets = profiles.map(profile => createDatasetFromProfile(profile));
      if (datasets.length > 0) {
        setSelectedDataset(datasets[0]); // Select the first dataset by default
      }

      completeStep('upload');
      setStep('profile');
      
      // Show success notification with more details
      addNotification({
        type: 'success',
        title: 'Upload Successful',
        message: `Successfully uploaded ${files.length} file(s) with ${profiles.reduce((sum, p) => sum + p.rowCount, 0).toLocaleString()} total rows.`
      });

    } catch (error) {
      console.error('File processing failed:', error);
      
      // Show error notification
      addNotification({
        type: 'error',
        title: 'Upload Failed',
        message: error instanceof Error ? error.message : 'Failed to process selected files. Please try again.'
      });
      
      setError('Failed to process selected files. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setSelectedFiles, setFileProfiles, completeStep, setStep, addNotification, setError, createMockFileProfile, createDatasetFromProfile, setSelectedDataset]);

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
    // Ensure we have a selected dataset before proceeding
    if (!state.selectedDataset && state.fileProfiles.length > 0) {
      // Create dataset from the first file profile if not already selected
      const dataset = createDatasetFromProfile(state.fileProfiles[0]);
      setSelectedDataset(dataset);
    }
    
    completeStep('transform');
    setStep('configure');
    
    // Preload analysis components
    preloadAnalysisComponents();
    
    addNotification({
      type: 'info',
      title: 'Transform Skipped',
      message: 'Proceeding to sentiment analysis configuration with original data.'
    });
  }, [completeStep, setStep, addNotification, state.selectedDataset, state.fileProfiles, createDatasetFromProfile, setSelectedDataset]);

  const handleStartTransform = useCallback((type?: 'filter' | 'sort' | 'rename' | 'select' | 'aggregate' | 'join' | 'deduplicate' | 'compute') => {
    // Create a new transform pipeline with an initial operation
    const initialPipeline = {
      id: `pipeline_${Date.now()}`,
      name: 'Data Transform Pipeline',
      operations: type ? [{
        id: `op_${Date.now()}`,
        type,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Operation`,
        enabled: true,
        config: getDefaultTransformConfig(type)
      }] : [],
      sourceTable: state.fileProfiles[0]?.file.name || 'data',
      created: new Date(),
      modified: new Date()
    };

    setTransformPipeline(initialPipeline);
  }, [state.fileProfiles]);

  const handleTransformPipelineChange = useCallback((pipeline: any) => {
    setTransformPipeline(pipeline);
  }, []);

  const handleTransformPreview = useCallback(async (pipeline: any) => {
    // Mock transform preview
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      originalData: [
        { id: 1, name: 'John Doe', email: 'john@example.com', review: 'Great product!' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', review: 'Not satisfied.' }
      ],
      transformedData: [
        { id: 1, name: 'John Doe', email: 'john@example.com', review: 'Great product!' }
      ],
      affectedRows: 1,
      totalRows: 2,
      executionTime: 0.025
    };
  }, []);

  const handleTransformValidation = useCallback(async (pipeline: any) => {
    // Mock validation
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      valid: true,
      errors: []
    };
  }, []);

  const createMockSchema = useCallback(() => {
    if (state.fileProfiles.length === 0) {
      return {
        name: 'data',
        fields: [
          { name: 'id', type: 'number', nullable: false, samples: [1, 2, 3] },
          { name: 'text', type: 'string', nullable: false, samples: ['Sample text', 'Another text'] }
        ],
        rowCount: 1000
      };
    }

    const profile = state.fileProfiles[0];
    return {
      name: profile.file.name,
      fields: profile.fields.map(field => ({
        name: field.name,
        type: field.type === 'unknown' ? 'string' : field.type,
        nullable: field.nullCount > 0,
        samples: field.samples
      })),
      rowCount: profile.rowCount
    };
  }, [state.fileProfiles]);

  const getDefaultTransformConfig = useCallback((type: string) => {
    switch (type) {
      case 'filter':
        return { field: '', operator: 'equals', value: '' };
      case 'sort':
        return { fields: [{ field: '', direction: 'asc' }] };
      case 'select':
        return { fields: [] };
      case 'rename':
        return { mappings: [{ oldName: '', newName: '' }] };
      case 'compute':
        return { newField: '', expression: '', dataType: 'string' };
      case 'aggregate':
        return { groupBy: [], aggregations: [{ field: '', function: 'count' }] };
      case 'join':
        return { rightTable: '', type: 'inner', conditions: [{ leftField: '', rightField: '' }] };
      case 'deduplicate':
        return { keepFirst: true };
      default:
        return {};
    }
  }, []);

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
    // Go back to profile step if no datasets, otherwise stay in configure
    if (!state.selectedDataset && state.fileProfiles.length === 0) {
      setStep('upload');
    } else if (!state.selectedDataset) {
      setStep('profile');
    } else {
      setStep('transform');
    }
    setAnalysisRunning(false);
  }, [setStep, setAnalysisRunning, state.selectedDataset, state.fileProfiles]);

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
                    className="secondary-button"
                    onClick={handleSkipTransform}
                  >
                    Skip to Sentiment Analysis
                  </button>
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
              <p>Transform your data before sentiment analysis. Apply filters, sorts, aggregations, and other operations.</p>
            </div>

            {state.transformPipeline ? (
              // Show TransformDesigner when transform pipeline exists
              <div className="transform-designer-container">
                <TransformDesigner
                  sourceSchema={createMockSchema()}
                  initialPipeline={state.transformPipeline}
                  onPipelineChange={handleTransformPipelineChange}
                  onPreviewRequested={handleTransformPreview}
                  onValidationRequested={handleTransformValidation}
                />
                <div className="step-actions">
                  <button 
                    className="secondary-button"
                    onClick={handleSkipTransform}
                  >
                    Skip Transform
                  </button>
                  <button 
                    className="primary-button"
                    onClick={handleTransformComplete}
                  >
                    Apply & Continue
                  </button>
                </div>
              </div>
            ) : (
              // Show transform options when no pipeline exists
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
                  <p>Apply filters, sorts, renames, aggregations, joins, and other transformations.</p>
                  <div className="transform-type-list">
                    <div className="transform-type-grid">
                      <div className="transform-type-item" onClick={() => handleStartTransform('filter')}>
                        <span className="transform-icon">🔽</span>
                        <span className="transform-name">Filter</span>
                      </div>
                      <div className="transform-type-item" onClick={() => handleStartTransform('sort')}>
                        <span className="transform-icon">🔃</span>
                        <span className="transform-name">Sort</span>
                      </div>
                      <div className="transform-type-item" onClick={() => handleStartTransform('rename')}>
                        <span className="transform-icon">📝</span>
                        <span className="transform-name">Rename</span>
                      </div>
                      <div className="transform-type-item" onClick={() => handleStartTransform('select')}>
                        <span className="transform-icon">☑️</span>
                        <span className="transform-name">Select</span>
                      </div>
                      <div className="transform-type-item" onClick={() => handleStartTransform('aggregate')}>
                        <span className="transform-icon">📊</span>
                        <span className="transform-name">Aggregate</span>
                      </div>
                      <div className="transform-type-item" onClick={() => handleStartTransform('join')}>
                        <span className="transform-icon">🔗</span>
                        <span className="transform-name">Join</span>
                      </div>
                      <div className="transform-type-item" onClick={() => handleStartTransform('deduplicate')}>
                        <span className="transform-icon">🧹</span>
                        <span className="transform-name">Dedupe</span>
                      </div>
                      <div className="transform-type-item" onClick={() => handleStartTransform('compute')}>
                        <span className="transform-icon">🧮</span>
                        <span className="transform-name">Compute</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    className="primary-button"
                    onClick={() => handleStartTransform('filter')}
                  >
                    Start Transforming
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 'configure':
        // Ensure we have datasets before rendering RunWizard
        const datasetsForWizard = state.selectedDataset 
          ? [state.selectedDataset] 
          : state.fileProfiles.length > 0 
            ? [createDatasetFromProfile(state.fileProfiles[0])]
            : [];
        
        // Show loading state if datasets are being prepared
        if (state.fileProfiles.length > 0 && datasetsForWizard.length === 0) {
          return (
            <div className="workflow-step-container">
              <div className="step-header">
                <h1>Configure Sentiment Analysis</h1>
                <p>Preparing your data for analysis...</p>
              </div>
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading dataset information...</p>
              </div>
            </div>
          );
        }
            
        return (
          <div className="workflow-step-container">
            <div className="step-header">
              <h1>Configure Sentiment Analysis</h1>
              <p>Set up your sentiment analysis run with cost estimation.</p>
            </div>

            <RunWizard
              datasets={datasetsForWizard}
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
      
      {/* Memory monitor for large dataset handling */}
      <MemoryMonitor
        compact={true}
        showHistory={true}
        showRecommendations={true}
        autoHide={false}
        position="bottom-left"
      />
      
      {/* Electron features monitor */}
      <ElectronFeatureMonitor />
    </div>
  );
};