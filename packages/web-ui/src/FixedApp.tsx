import React, { useState, useEffect } from 'react';
import './FixedApp.css';
import { CleanAdminDashboard } from './components/CleanAdminDashboard';

// Simple but complete DataCloak Workbench
export default function FixedApp() {
  const [currentStep, setCurrentStep] = useState('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedDataset, setUploadedDataset] = useState<any>(null);
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [analysisMode, setAnalysisMode] = useState<'existing' | 'generate'>('existing');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [analysisType, setAnalysisType] = useState<'preview' | 'full'>('preview');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState('');
  const [lastProgressUpdate, setLastProgressUpdate] = useState(Date.now());
  const [sentimentModel, setSentimentModel] = useState<'basic' | 'gpt-3.5-turbo' | 'gpt-4'>('gpt-3.5-turbo');
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);

  // Navigation items
  const steps = [
    { id: 'upload', label: 'Upload Data', icon: '📁', description: 'Select and upload your data files' },
    { id: 'profile', label: 'Data Profile', icon: '🔍', description: 'Review data and PII detection' },
    { id: 'columns', label: 'Select Columns', icon: '📝', description: 'Choose or create text columns' },
    { id: 'configure', label: 'Configure', icon: '⚙️', description: 'Set up sentiment analysis' },
    { id: 'analyze', label: 'Analyze', icon: '🚀', description: 'Run sentiment analysis' },
    { id: 'results', label: 'Results', icon: '📊', description: 'View and export results' },
    { id: 'admin', label: 'Logs', icon: '📋', description: 'System logs and metrics' }
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError('');
    setUploadProgress(0);
    setUploadStatus('Preparing upload...');

    try {
      const formData = new FormData();
      
      // Ensure CSV files have the correct MIME type
      let fileToUpload = selectedFile;
      if (selectedFile.name.endsWith('.csv') && selectedFile.type !== 'text/csv') {
        // Create a new file with the correct MIME type
        fileToUpload = new File([selectedFile], selectedFile.name, { type: 'text/csv' });
      }
      
      formData.append('file', fileToUpload);
      formData.append('datasetName', selectedFile.name.replace(/\.[^/.]+$/, '')); // Use filename without extension as dataset name

      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Create a promise to handle the async upload
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percentComplete);
            
            if (percentComplete < 100) {
              setUploadStatus(`Uploading... ${percentComplete}%`);
            } else {
              setUploadStatus('Processing file...');
            }
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch (e) {
              console.error('Failed to parse response:', xhr.responseText);
              reject(new Error('Invalid response format'));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              console.error('Upload failed:', errorResponse);
              reject(new Error(errorResponse.error?.message || `Upload failed with status ${xhr.status}`));
            } catch (e) {
              console.error('Upload failed with status:', xhr.status, 'Response:', xhr.responseText);
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', (event) => {
          console.error('Upload network error:', event);
          console.error('XHR readyState:', xhr.readyState);
          console.error('XHR status:', xhr.status);
          console.error('XHR statusText:', xhr.statusText);
          reject(new Error('Network error during upload. Check if backend is running on http://localhost:3001'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });
      });

      console.log('Uploading file:', fileToUpload.name, 'Size:', fileToUpload.size, 'Type:', fileToUpload.type);
      console.log('Original file type:', selectedFile.type);
      xhr.open('POST', 'http://localhost:3001/api/v1/data/upload');
      xhr.send(formData);

      const result = await uploadPromise;
      
      if (result.error) {
        setError(result.error.message);
        setUploadProgress(0);
        setUploadStatus('');
      } else {
        console.log('Upload response:', result);
        setUploadStatus('Upload complete!');
        // Store both dataset info and full data including fieldInfo
        setUploadedDataset(result.data.dataset || result.data);
        setUploadedData(result.data);
        
        // Small delay before moving to next step
        setTimeout(() => {
          setCurrentStep('profile');
          setUploadProgress(0);
          setUploadStatus('');
        }, 1000);
      }
    } catch (err) {
      setError('Failed to upload file: ' + (err as Error).message);
      setUploadProgress(0);
      setUploadStatus('');
    } finally {
      setLoading(false);
    }
  };

  // Auto-load admin data when visiting the logs page
  useEffect(() => {
    if (currentStep === 'admin') {
      // EnhancedAdminDashboard handles its own data fetching
      // fetchAdminDataWithoutAuth();
    }
  }, [currentStep]);

  // Monitor job progress via SSE
  useEffect(() => {
    if (!jobId) return;

    let eventSource: EventSource | null = null;
    let connectionTimeout: NodeJS.Timeout;
    let stuckJobTimeout: NodeJS.Timeout;
    let lastProgressUpdate = Date.now();

    const cleanup = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      clearTimeout(connectionTimeout);
      clearTimeout(stuckJobTimeout);
    };

    const handleJobError = (message: string) => {
      setError(message);
      setJobStatus('Failed');
      setLoading(false);
      setCurrentStep('config');
      cleanup();
    };

    try {
      eventSource = new EventSource(`http://localhost:3001/api/v1/jobs/${jobId}/progress`);
      
      // Set connection timeout
      connectionTimeout = setTimeout(() => {
        handleJobError('Failed to connect to job monitoring service. The backend may be unavailable.');
      }, 10000); // 10 second connection timeout

      // Set stuck job detection
      const checkStuckJob = () => {
        const timeSinceLastUpdate = Date.now() - lastProgressUpdate;
        if (timeSinceLastUpdate > 60000) { // 60 seconds without update
          handleJobError('Job appears to be stuck. This may be due to API rate limits or server issues. Please try again with a smaller dataset or contact support.');
        }
      };
      stuckJobTimeout = setInterval(checkStuckJob, 10000); // Check every 10 seconds

      eventSource.addEventListener('open', () => {
        clearTimeout(connectionTimeout);
        console.log('Connected to job progress monitoring');
      });
      
      eventSource.addEventListener('job:progress', (event) => {
        const data = JSON.parse(event.data);
        setJobProgress(data.progress);
        setJobStatus(data.status || 'Processing...');
        lastProgressUpdate = Date.now();
        setLastProgressUpdate(Date.now());
      });

      eventSource.addEventListener('job:completed', (event) => {
        const data = JSON.parse(event.data);
        setJobStatus('Analysis complete!');
        // Fetch full results
        fetchJobResults(jobId);
        cleanup();
      });

      eventSource.addEventListener('job:failed', (event) => {
        const data = JSON.parse(event.data);
        const errorMessage = data.error || 'Job failed';
        
        // Provide more specific error messages
        if (errorMessage.includes('Circuit breaker is OPEN')) {
          handleJobError('The OpenAI API is temporarily unavailable due to too many failed requests. Please wait a few minutes and try again with a smaller dataset.');
        } else if (errorMessage.includes('Failed to acquire connection')) {
          handleJobError('Database connection error. The server may be overloaded. Please try again in a few moments.');
        } else if (errorMessage.includes('Rate limit')) {
          handleJobError('OpenAI API rate limit exceeded. Please wait a few minutes before trying again.');
        } else {
          handleJobError(`Job failed: ${errorMessage}`);
        }
      });

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        // Don't immediately fail - SSE connections can reconnect
        // But if we haven't connected yet, this is a real error
        if (eventSource?.readyState === EventSource.CONNECTING && !lastProgressUpdate) {
          handleJobError('Unable to monitor job progress. Please check if the backend is running.');
        }
      };
    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      handleJobError('Failed to start job monitoring. Please check your connection.');
    }

    return cleanup;
  }, [jobId]);

  const fetchJobResults = async (jobId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/jobs/${jobId}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setAnalysisResults({
          mode: analysisMode,
          data: result.data.result?.results || [],
          totalAnalyzed: result.data.result?.totalProcessed || 0,
          totalRecords: uploadedDataset.recordCount,
          jobId: jobId,
          fullAnalysis: true
        });
        setCurrentStep('results');
      }
    } catch (err) {
      setError('Failed to fetch job results');
    } finally {
      setLoading(false);
      setJobId(null);
      setJobProgress(0);
      setJobStatus('');
    }
  };



  const fetchAdminDataWithoutAuth = async () => {
    try {
      // Fetch logs without authentication
      const logsResponse = await fetch('http://localhost:3001/api/v1/openai/logs?limit=50', {
        headers: { 
          'Content-Type': 'application/json'
        }
      });

      const logsResult = await logsResponse.json();
      
      if (logsResponse.ok) {
        setAdminLogs(logsResult.data || []);
      } else {
        console.error('Logs fetch failed:', logsResult);
        setAdminLogs([]);
      }

      // Fetch stats without authentication
      const statsResponse = await fetch('http://localhost:3001/api/v1/openai/stats', {
        headers: { 
          'Content-Type': 'application/json'
        }
      });

      const statsResult = await statsResponse.json();
      
      if (statsResponse.ok) {
        setAdminStats(statsResult.data || null);
      } else {
        console.error('Stats fetch failed:', statsResult);
        setAdminStats(null);
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
      setError('Failed to load logs and metrics');
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedDataset || !uploadedData) {
      setError('No dataset uploaded');
      return;
    }

    setLoading(true);
    setError('');
    setCurrentStep('analyze');

    try {
      // For full analysis, create a background job
      if (analysisType === 'full') {
        console.log('Starting full dataset analysis as background job...');
        
        const jobData = {
          datasetId: uploadedDataset.id,
          filePath: uploadedDataset.filepath || uploadedDataset.filename,
          selectedColumns: analysisMode === 'existing' ? selectedColumns : [],
          analysisMode: analysisMode,
          model: sentimentModel,
          options: {
            batchSize: 100,
            priority: 'medium'
          }
        };

        const response = await fetch('http://localhost:3001/api/v1/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'sentiment_analysis_batch',
            data: jobData
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to create job: ${response.status}`);
        }

        const result = await response.json();
        if (result.success && result.data) {
          setJobId(result.data.id);
          setJobStatus('Job created, starting analysis...');
          // The useEffect hook will monitor progress
        } else {
          throw new Error('Failed to create analysis job');
        }
        
        return; // Exit early for full analysis
      }
      
      // Preview analysis continues as before
      const previewData = uploadedData.previewData || [];
      
      if (analysisMode === 'generate') {
        // Generate synthetic sentiment data
        console.log('Generating synthetic sentiment data...');
        
        // Create mock sentiment results for all preview rows
        const generatedResults = previewData.map((row: any, index: number) => {
          const sentiments = ['positive', 'negative', 'neutral'];
          const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
          const confidence = 0.7 + Math.random() * 0.3; // 0.7 to 1.0
          
          return {
            originalRow: row,
            text: `Generated review for record ${index + 1}`,
            sentiment,
            confidence,
            pii_detected: Math.random() > 0.8 // 20% chance of PII
          };
        });
        
        setAnalysisResults({
          mode: 'generated',
          data: generatedResults,
          totalAnalyzed: generatedResults.length,
          totalRecords: uploadedDataset.recordCount,
          message: 'Synthetic sentiment data generated for demonstration'
        });
        setCurrentStep('results');
        
      } else {
        // Analyze existing columns
        if (selectedColumns.length === 0) {
          setError('No columns selected for analysis');
          setCurrentStep('columns');
          return;
        }
        
        // Extract texts from selected columns
        const texts: string[] = [];
        const rowsWithText: any[] = [];
        
        previewData.forEach((row: any) => {
          selectedColumns.forEach(column => {
            const text = row[column];
            if (text && typeof text === 'string' && text.trim()) {
              texts.push(text);
              rowsWithText.push({
                text,
                column,
                originalRow: row
              });
            }
          });
        });
        
        // Process all available texts (up to the preview limit from backend)
        const textsToAnalyze = texts;
        
        if (textsToAnalyze.length === 0) {
          setError('No text found in selected columns');
          setCurrentStep('columns');
          return;
        }
        
        console.log(`Analyzing ${textsToAnalyze.length} texts from columns: ${selectedColumns.join(', ')}`);
        console.log('Sample texts:', textsToAnalyze.slice(0, 3));
        console.log('Using model:', sentimentModel);

        // Process in batches of 100 for OpenAI models
        const batchSize = sentimentModel === 'basic' ? textsToAnalyze.length : 100;
        const allResults: any[] = [];
        const totalBatches = Math.ceil(textsToAnalyze.length / batchSize);
        
        // Update batch progress
        setBatchProgress({ current: 0, total: totalBatches });
        
        for (let i = 0; i < textsToAnalyze.length; i += batchSize) {
          const batch = textsToAnalyze.slice(i, Math.min(i + batchSize, textsToAnalyze.length));
          const currentBatch = Math.floor(i / batchSize) + 1;
          
          console.log(`Processing batch ${currentBatch} of ${totalBatches} (${batch.length} texts)`);
          
          // Update batch progress
          setBatchProgress({ current: currentBatch, total: totalBatches });
          
          // Add timeout for long-running analyses
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

          try {
            // Use batch analysis endpoint
            const response = await fetch('http://localhost:3001/api/v1/sentiment/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                texts: batch,
                model: sentimentModel // Use selected model
              }),
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            console.log('Batch response status:', response.status);
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('Batch analysis failed:', errorText);
              throw new Error(`Analysis failed: ${response.status}`);
            }

            const batchResult = await response.json();
            console.log('Batch result:', batchResult);
            
            if (batchResult.error) {
              setError(batchResult.error.message);
              return;
            } else if (batchResult.data && Array.isArray(batchResult.data)) {
              allResults.push(...batchResult.data);
            } else {
              console.error('Unexpected batch result format:', batchResult);
              setError('Unexpected response format from server');
              return;
            }
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
              throw new Error('Analysis timed out. Please try with fewer texts or use the basic model.');
            }
            throw fetchError;
          }
          
          // Add delay between batches to avoid overwhelming the backend
          if (i + batchSize < textsToAnalyze.length) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between batches
          }
        }
        
        console.log(`Analysis complete. Total results: ${allResults.length}`);
        setAnalysisResults({
          data: allResults,
          message: `Analyzed ${allResults.length} texts using ${sentimentModel}`,
          mode: 'existing',
          selectedColumns: selectedColumns,
          totalAnalyzed: allResults.length,
          totalRecords: uploadedDataset.recordCount
        });
        setCurrentStep('results');
      }
    } catch (err) {
      setError('Failed to analyze data: ' + (err as Error).message);
      setCurrentStep('columns');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <div className="step-content">
            <h2>Upload Your Data File</h2>
            <p>Select a CSV or Excel file containing text data for sentiment analysis.</p>
            
            <div className="upload-area">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                id="file-input"
                style={{ display: 'none' }}
              />
              <label htmlFor="file-input" className="upload-label">
                <div className="upload-icon">📁</div>
                <div className="upload-text">
                  {selectedFile ? selectedFile.name : 'Click to select file or drag & drop'}
                </div>
              </label>
            </div>

            {selectedFile && (
              <div className="file-info">
                <p>Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</p>
                
                {uploadProgress > 0 && (
                  <div className="upload-progress-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="progress-text">
                      {uploadStatus}
                    </div>
                  </div>
                )}
                
                <button onClick={handleUpload} disabled={loading} className="primary-button">
                  {loading ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            )}
          </div>
        );

      case 'profile':
        return (
          <div className="step-content">
            <h2>Data Profile</h2>
            <p>Your data has been uploaded and profiled.</p>
            
            {uploadedDataset && (
              <div className="profile-info">
                <h3>Dataset Information</h3>
                <ul>
                  <li>File: {uploadedDataset.originalFilename}</li>
                  <li>Records: {uploadedDataset.recordCount}</li>
                  <li>Size: {(uploadedDataset.size / 1024 / 1024).toFixed(2)} MB</li>
                  <li>Status: Ready</li>
                </ul>
                
                {uploadedData?.fieldInfo && (
                  <div className="field-info">
                    <h3>Fields Detected ({uploadedData.fieldInfo.length})</h3>
                    <div className="fields-grid">
                      {uploadedData.fieldInfo.map((field: any, index: number) => (
                        <div key={index} className={`field-card ${field.piiDetected ? 'pii-detected' : ''}`}>
                          <strong>{field.name}</strong>
                          <span className="field-type">{field.type}</span>
                          {field.piiDetected && (
                            <span className="pii-badge">🔒 {field.piiType}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {uploadedData?.securityScan && (
                  <div className="security-summary">
                    <h3>Security Analysis</h3>
                    <ul>
                      <li>PII Items Detected: {uploadedData.securityScan.piiItemsDetected}</li>
                      <li>Compliance Score: {uploadedData.securityScan.complianceScore}%</li>
                      <li>Risk Level: <span className={`risk-${uploadedData.securityScan.riskLevel}`}>
                        {uploadedData.securityScan.riskLevel.toUpperCase()}
                      </span></li>
                    </ul>
                  </div>
                )}
                
                <div className="pii-warning">
                  <strong>⚠️ PII Protection Active:</strong> DataCloak has detected personal information 
                  and will automatically mask it during analysis.
                </div>
                
                <button onClick={() => setCurrentStep('columns')} className="primary-button">
                  Continue to Column Selection
                </button>
              </div>
            )}
          </div>
        );

      case 'columns':
        return (
          <div className="step-content">
            <h2>Select Text Columns for Analysis</h2>
            <p>Choose how to handle text data for sentiment analysis.</p>
            
            <div className="column-selection">
              <div className="mode-selector">
                <label className={`mode-option ${analysisMode === 'existing' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="mode"
                    value="existing"
                    checked={analysisMode === 'existing'}
                    onChange={(e) => setAnalysisMode(e.target.value as 'existing' | 'generate')}
                  />
                  <span>Analyze Existing Columns</span>
                  <p>Select columns that contain text to analyze</p>
                </label>
                
                <label className={`mode-option ${analysisMode === 'generate' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="mode"
                    value="generate"
                    checked={analysisMode === 'generate'}
                    onChange={(e) => setAnalysisMode(e.target.value as 'existing' | 'generate')}
                  />
                  <span>Generate Sentiment Column</span>
                  <p>Add a new column with generated sentiment data</p>
                </label>
              </div>
              
              {analysisMode === 'existing' && uploadedData?.fieldInfo && (
                <div className="column-list">
                  <h3>Select columns containing text to analyze:</h3>
                  <div className="info-notice">
                    ℹ️ Note: Analysis will be performed on the first {uploadedData.previewData?.length || 100} records as a preview. 
                    For full dataset analysis, consider using the API directly or batch processing.
                  </div>
                  <div className="columns-grid">
                    {uploadedData.fieldInfo
                      .filter((field: any) => field.type === 'string')
                      .map((field: any, index: number) => {
                        const textColumns = ['review', 'comment', 'feedback', 'text', 'description', 'content', 'message'];
                        const isLikelyText = textColumns.some(tc => 
                          field.name.toLowerCase().includes(tc)
                        );
                        
                        return (
                          <label key={index} className={`column-option ${isLikelyText ? 'suggested' : ''}`}>
                            <input
                              type="checkbox"
                              value={field.name}
                              checked={selectedColumns.includes(field.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedColumns([...selectedColumns, field.name]);
                                } else {
                                  setSelectedColumns(selectedColumns.filter(c => c !== field.name));
                                }
                              }}
                            />
                            <span>{field.name}</span>
                            {isLikelyText && <span className="suggested-badge">Suggested</span>}
                          </label>
                        );
                      })}
                  </div>
                  
                  {selectedColumns.length === 0 && (
                    <div className="no-selection-warning">
                      ⚠️ Please select at least one column containing text to analyze
                    </div>
                  )}
                  
                  {selectedColumns.length > 0 && !selectedColumns.some(col => 
                    ['review', 'comment', 'feedback', 'text', 'description', 'content', 'message']
                      .some(tc => col.toLowerCase().includes(tc))
                  ) && (
                    <div className="column-selection-hint">
                      💡 Tip: The selected columns don't appear to contain review text. Look for columns with names like "review", "comment", "feedback", etc.
                    </div>
                  )}
                </div>
              )}
              
              {analysisMode === 'generate' && (
                <div className="generate-info">
                  <div className="info-card">
                    <h3>Generate Sentiment Data</h3>
                    <p>This option will add a new "sentiment_analysis" column to your dataset with:</p>
                    <ul>
                      <li>Randomly generated sentiment labels (positive, negative, neutral)</li>
                      <li>Confidence scores</li>
                      <li>Sample review text</li>
                    </ul>
                    <p>This is useful for testing the workflow when your data doesn't contain existing text columns.</p>
                  </div>
                </div>
              )}
              
              <button 
                onClick={() => setCurrentStep('configure')} 
                disabled={analysisMode === 'existing' && selectedColumns.length === 0}
                className="primary-button"
              >
                Continue to Configuration
              </button>
            </div>
          </div>
        );

      case 'configure':
        return (
          <div className="step-content">
            <h2>Configure Sentiment Analysis</h2>
            <p>Set up your sentiment analysis parameters.</p>
            
            <div className="config-form">
              <div className="selected-mode-info">
                <strong>Analysis Mode:</strong> {analysisMode === 'existing' ? 'Analyzing existing columns' : 'Generating sentiment data'}
                {analysisMode === 'existing' && selectedColumns.length > 0 && (
                  <div>
                    <strong>Selected Columns:</strong> {selectedColumns.join(', ')}
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label>Analysis Type</label>
                <div className="analysis-type-selector">
                  <label className={`type-option ${analysisType === 'preview' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="analysisType"
                      value="preview"
                      checked={analysisType === 'preview'}
                      onChange={(e) => setAnalysisType(e.target.value as 'preview' | 'full')}
                    />
                    <div className="type-content">
                      <strong>Preview Analysis</strong>
                      <p>Quick analysis of first {uploadedData.previewData?.length || 100} records</p>
                      <span className="type-badge">Recommended for testing</span>
                    </div>
                  </label>
                  
                  <label className={`type-option ${analysisType === 'full' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="analysisType"
                      value="full"
                      checked={analysisType === 'full'}
                      onChange={(e) => setAnalysisType(e.target.value as 'preview' | 'full')}
                    />
                    <div className="type-content">
                      <strong>Full Dataset Analysis</strong>
                      <p>Process all {uploadedDataset.recordCount} records in background</p>
                      <span className="type-badge">Best for production</span>
                    </div>
                  </label>
                </div>
              </div>
              
              <div className="form-group">
                <label>Sentiment Analysis Model</label>
                <select 
                  value={sentimentModel} 
                  onChange={(e) => setSentimentModel(e.target.value as 'basic' | 'gpt-3.5-turbo' | 'gpt-4')}
                >
                  <option value="basic">Basic (Fast, Free) - Keyword-based analysis</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Balanced) - AI-powered analysis</option>
                  <option value="gpt-4">GPT-4 (Most Accurate) - Advanced AI analysis</option>
                </select>
                <div className="model-info">
                  {sentimentModel === 'basic' && (
                    <p className="info-text">✓ Free, fast keyword-based analysis. Good for basic sentiment detection.</p>
                  )}
                  {sentimentModel === 'gpt-3.5-turbo' && (
                    <p className="info-text">⚡ Requires OpenAI API key. Fast and accurate AI-powered analysis.</p>
                  )}
                  {sentimentModel === 'gpt-4' && (
                    <p className="info-text">🚀 Requires OpenAI API key. Most advanced model for nuanced sentiment.</p>
                  )}
                </div>
              </div>
              
              <div className="form-group">
                <label>PII Protection</label>
                <input type="checkbox" checked disabled /> Enabled (Always On)
              </div>
              
              {analysisType === 'full' && (
                <div className="full-analysis-info">
                  <div className="info-card">
                    <strong>ℹ️ Full Dataset Analysis</strong>
                    <p>Your analysis will run as a background job. You'll see real-time progress updates and can continue using the application while processing.</p>
                  </div>
                </div>
              )}
              
              <button onClick={handleAnalyze} disabled={loading} className="primary-button">
                {loading ? 'Preparing...' : `Start ${analysisType === 'preview' ? 'Preview' : 'Full'} Analysis`}
              </button>
            </div>
          </div>
        );

      case 'analyze':
        return (
          <div className="step-content">
            <h2>Running Sentiment Analysis</h2>
            <div className="analyzing">
              {analysisType === 'full' && jobId ? (
                <>
                  <div className="job-progress-container">
                    <div className="progress-bar large">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${jobProgress}%` }}
                      />
                    </div>
                    <div className="progress-details">
                      <span className="progress-percentage">{jobProgress}%</span>
                      <span className="progress-status">{jobStatus}</span>
                    </div>
                  </div>
                  <div className="job-info">
                    <p>Processing {uploadedDataset.recordCount} records in background...</p>
                    <p>Job ID: {jobId}</p>
                  </div>
                  <div className="job-actions">
                    <button 
                      onClick={async () => {
                        setLoading(false);
                        setJobId(null);
                        setJobProgress(0);
                        setJobStatus('');
                        setCurrentStep('config');
                        setError('Analysis cancelled by user');
                        
                        // Attempt to cancel the job on the backend
                        try {
                          await fetch(`http://localhost:3001/api/v1/jobs/${jobId}`, { method: 'DELETE' });
                        } catch (err) {
                          console.error('Failed to cancel job:', err);
                        }
                      }}
                      className="cancel-button"
                    >
                      Cancel Analysis
                    </button>
                  </div>
                  
                  {/* Show warning if job appears stuck */}
                  {jobProgress > 0 && jobProgress < 100 && Date.now() - lastProgressUpdate > 30000 && (
                    <div className="warning-box">
                      <p>⚠️ Analysis appears to be taking longer than expected.</p>
                      <p>This could be due to:</p>
                      <ul>
                        <li>Large dataset size</li>
                        <li>API rate limits</li>
                        <li>Server processing delays</li>
                      </ul>
                      <p>You can cancel and try with a smaller dataset or different model.</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="spinner"></div>
                  <p>Analyzing your data with PII protection...</p>
                  <p>This may take a few moments.</p>
                  
                  {/* Show batch progress for OpenAI models */}
                  {batchProgress.total > 1 && (
                    <div className="batch-progress-container">
                      <div className="batch-info">
                        <p>Processing batch {batchProgress.current} of {batchProgress.total}</p>
                        <p className="batch-detail">
                          {sentimentModel !== 'basic' && 'OpenAI models process texts in batches of 100 for optimal performance'}
                        </p>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );

      case 'results':
        return (
          <div className="step-content">
            <h2>Analysis Results</h2>
            {analysisResults && (
              <div className="results-display">
                <div className="result-summary">
                  <h3>Analysis Summary</h3>
                  <div className="summary-stats">
                    <div className="stat-card">
                      <span className="stat-label">Total Records</span>
                      <span className="stat-value">{analysisResults.totalRecords}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Analyzed</span>
                      <span className="stat-value">{analysisResults.totalAnalyzed}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Analysis Type</span>
                      <span className="stat-value">{analysisResults.fullAnalysis ? 'Full Dataset' : 'Preview'}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Mode</span>
                      <span className="stat-value">{analysisResults.mode === 'generated' ? 'Generated' : 'Existing'}</span>
                    </div>
                    {analysisResults.selectedColumns && (
                      <div className="stat-card">
                        <span className="stat-label">Columns</span>
                        <span className="stat-value">{analysisResults.selectedColumns.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {analysisResults.data && Array.isArray(analysisResults.data) && (
                  <div className="sentiment-breakdown">
                    <h3>Sentiment Distribution</h3>
                    {(() => {
                      const sentimentCounts = analysisResults.data.reduce((acc: any, item: any) => {
                        const sentiment = item.sentiment || 'unknown';
                        acc[sentiment] = (acc[sentiment] || 0) + 1;
                        return acc;
                      }, {});
                      
                      return (
                        <div className="sentiment-stats">
                          {Object.entries(sentimentCounts).map(([sentiment, count]) => (
                            <div key={sentiment} className={`sentiment-stat ${sentiment}`}>
                              <span className="sentiment-label">{sentiment.toUpperCase()}</span>
                              <span className="sentiment-count">{count as number}</span>
                              <span className="sentiment-percent">
                                {((count as number / analysisResults.totalAnalyzed) * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="sample-results">
                  <h3>Sample Results (First 10)</h3>
                  <div className="results-table">
                    {analysisResults.data && analysisResults.data.slice(0, 10).map((item: any, index: number) => (
                      <div key={index} className="result-row">
                        <div className="result-text">{item.text}</div>
                        <div className={`result-sentiment ${item.sentiment}`}>
                          {item.sentiment} ({(item.confidence * 100).toFixed(1)}%)
                        </div>
                        {item.pii_detected && (
                          <div className="pii-indicator">🔒 PII Masked</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="actions">
                  <button className="secondary-button">Export Results</button>
                  <button onClick={() => {
                    setCurrentStep('upload');
                    setSelectedFile(null);
                    setUploadedDataset(null);
                    setUploadedData(null);
                    setAnalysisResults(null);
                    setSelectedColumns([]);
                    setAnalysisMode('existing');
                  }} className="primary-button">
                    New Analysis
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 'admin':
        return (
          <div className="step-content admin-dashboard-container">
            <CleanAdminDashboard />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app">
      {/* Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="app-header">
          <h1>🛡️ DataCloak</h1>
          <p>Sentiment Workbench</p>
        </div>
        
        <nav className="navigation">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`step-item ${currentStep === step.id ? 'active' : ''}`}
              onClick={() => {
                if (step.id === 'upload' || step.id === 'admin' || uploadedDataset) {
                  setCurrentStep(step.id);
                }
              }}
            >
              <span className="step-icon">{step.icon}</span>
              <div className="step-info">
                <h4>{step.label}</h4>
                <p>{step.description}</p>
              </div>
            </div>
          ))}
        </nav>
        
        <div className="sidebar-footer">
          <div className="connection-status">
            <span className="status-dot"></span>
            Backend Connected
          </div>
          <div className="version">v1.0.0</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="app-main">
        <div className="workflow-manager">
          <div className="workflow-step-container">
            {renderStepContent()}
            
            {error && (
              <div className="error-message">
                ❌ {error}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}