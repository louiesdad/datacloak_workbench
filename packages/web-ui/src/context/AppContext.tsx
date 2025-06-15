import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { FileInfo } from '../platform-bridge';
import type { 
  FileProfile, 
  TransformPipeline,
  TransformPreview,
  TransformValidation 
} from '../components';
import type { 
  Dataset, 
  SentimentResult,
  CostEstimation 
} from '../../../../shared/contracts/api';

// Application workflow steps
export type WorkflowStep = 
  | 'upload'           // Data source selection
  | 'profile'          // Data profiling and PII detection
  | 'transform'        // Data transformation (optional)
  | 'configure'        // Sentiment analysis configuration
  | 'execute'          // Run sentiment analysis
  | 'results';         // View and export results

// Global application state
export interface AppState {
  // Workflow state
  currentStep: WorkflowStep;
  completedSteps: Set<WorkflowStep>;
  
  // Data state
  selectedFiles: FileInfo[];
  datasets: Dataset[];
  selectedDataset: Dataset | null;
  fileProfiles: FileProfile[];
  
  // Transform state
  transformPipeline: TransformPipeline | null;
  transformPreview: TransformPreview | null;
  transformValidation: TransformValidation | null;
  
  // Analysis state
  analysisConfig: AnalysisConfig | null;
  costEstimation: CostEstimation | null;
  analysisResults: SentimentResult[];
  isAnalysisRunning: boolean;
  
  // UI state
  loading: boolean;
  error: string | null;
  notifications: Notification[];
}

export interface AnalysisConfig {
  textColumn: string;
  sentimentOptions: {
    includeKeywords: boolean;
    includeEmotions: boolean;
    language: string;
    model: 'basic' | 'advanced' | 'openai';
  };
  auditSecurity: boolean;
  maskPII: boolean;
  exportResults: boolean;
  exportFormat: 'csv' | 'excel' | 'json';
}

export interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  dismissed?: boolean;
}

// Action types
export type AppAction =
  | { type: 'SET_STEP'; payload: WorkflowStep }
  | { type: 'COMPLETE_STEP'; payload: WorkflowStep }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'DISMISS_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  
  // Data actions
  | { type: 'SET_SELECTED_FILES'; payload: FileInfo[] }
  | { type: 'SET_DATASETS'; payload: Dataset[] }
  | { type: 'SET_SELECTED_DATASET'; payload: Dataset | null }
  | { type: 'SET_FILE_PROFILES'; payload: FileProfile[] }
  
  // Transform actions
  | { type: 'SET_TRANSFORM_PIPELINE'; payload: TransformPipeline | null }
  | { type: 'SET_TRANSFORM_PREVIEW'; payload: TransformPreview | null }
  | { type: 'SET_TRANSFORM_VALIDATION'; payload: TransformValidation | null }
  
  // Analysis actions
  | { type: 'SET_ANALYSIS_CONFIG'; payload: AnalysisConfig | null }
  | { type: 'SET_COST_ESTIMATION'; payload: CostEstimation | null }
  | { type: 'SET_ANALYSIS_RESULTS'; payload: SentimentResult[] }
  | { type: 'SET_ANALYSIS_RUNNING'; payload: boolean }
  
  // Reset actions
  | { type: 'RESET_WORKFLOW' }
  | { type: 'RESET_ALL' };

// Initial state
const initialState: AppState = {
  currentStep: 'upload',
  completedSteps: new Set(),
  
  selectedFiles: [],
  datasets: [],
  selectedDataset: null,
  fileProfiles: [],
  
  transformPipeline: null,
  transformPreview: null,
  transformValidation: null,
  
  analysisConfig: null,
  costEstimation: null,
  analysisResults: [],
  isAnalysisRunning: false,
  
  loading: false,
  error: null,
  notifications: []
};

// Reducer function
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return { 
        ...state, 
        currentStep: action.payload,
        error: null // Clear errors when navigating
      };
      
    case 'COMPLETE_STEP':
      return { 
        ...state, 
        completedSteps: new Set([...state.completedSteps, action.payload])
      };
      
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
      
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
      
    case 'ADD_NOTIFICATION':
      return { 
        ...state, 
        notifications: [...state.notifications, action.payload]
      };
      
    case 'DISMISS_NOTIFICATION':
      return { 
        ...state, 
        notifications: state.notifications.map(n => 
          n.id === action.payload ? { ...n, dismissed: true } : n
        )
      };
      
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] };
      
    // Data actions
    case 'SET_SELECTED_FILES':
      return { ...state, selectedFiles: action.payload };
      
    case 'SET_DATASETS':
      return { ...state, datasets: action.payload };
      
    case 'SET_SELECTED_DATASET':
      return { ...state, selectedDataset: action.payload };
      
    case 'SET_FILE_PROFILES':
      return { ...state, fileProfiles: action.payload };
      
    // Transform actions
    case 'SET_TRANSFORM_PIPELINE':
      return { ...state, transformPipeline: action.payload };
      
    case 'SET_TRANSFORM_PREVIEW':
      return { ...state, transformPreview: action.payload };
      
    case 'SET_TRANSFORM_VALIDATION':
      return { ...state, transformValidation: action.payload };
      
    // Analysis actions
    case 'SET_ANALYSIS_CONFIG':
      return { ...state, analysisConfig: action.payload };
      
    case 'SET_COST_ESTIMATION':
      return { ...state, costEstimation: action.payload };
      
    case 'SET_ANALYSIS_RESULTS':
      return { ...state, analysisResults: action.payload };
      
    case 'SET_ANALYSIS_RUNNING':
      return { ...state, isAnalysisRunning: action.payload };
      
    // Reset actions
    case 'RESET_WORKFLOW':
      return { 
        ...initialState,
        datasets: state.datasets, // Preserve datasets
        notifications: state.notifications // Preserve notifications
      };
      
    case 'RESET_ALL':
      return initialState;
      
    default:
      return state;
  }
}

// Context
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider component
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

// Helper functions for common actions
export const useAppActions = () => {
  const { dispatch } = useAppContext();
  
  return React.useMemo(() => ({
    // Navigation
    setStep: (step: WorkflowStep) => dispatch({ type: 'SET_STEP', payload: step }),
    completeStep: (step: WorkflowStep) => dispatch({ type: 'COMPLETE_STEP', payload: step }),
    
    // UI state
    setLoading: (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),
    setError: (error: string | null) => dispatch({ type: 'SET_ERROR', payload: error }),
    
    // Notifications
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => {
      const fullNotification: Notification = {
        ...notification,
        id: `notification-${Date.now()}-${Math.random()}`,
        timestamp: new Date()
      };
      dispatch({ type: 'ADD_NOTIFICATION', payload: fullNotification });
    },
    dismissNotification: (id: string) => dispatch({ type: 'DISMISS_NOTIFICATION', payload: id }),
    clearNotifications: () => dispatch({ type: 'CLEAR_NOTIFICATIONS' }),
    
    // Data
    setSelectedFiles: (files: FileInfo[]) => dispatch({ type: 'SET_SELECTED_FILES', payload: files }),
    setDatasets: (datasets: Dataset[]) => dispatch({ type: 'SET_DATASETS', payload: datasets }),
    setSelectedDataset: (dataset: Dataset | null) => dispatch({ type: 'SET_SELECTED_DATASET', payload: dataset }),
    setFileProfiles: (profiles: FileProfile[]) => dispatch({ type: 'SET_FILE_PROFILES', payload: profiles }),
    
    // Transform
    setTransformPipeline: (pipeline: TransformPipeline | null) => dispatch({ type: 'SET_TRANSFORM_PIPELINE', payload: pipeline }),
    setTransformPreview: (preview: TransformPreview | null) => dispatch({ type: 'SET_TRANSFORM_PREVIEW', payload: preview }),
    setTransformValidation: (validation: TransformValidation | null) => dispatch({ type: 'SET_TRANSFORM_VALIDATION', payload: validation }),
    
    // Analysis
    setAnalysisConfig: (config: AnalysisConfig | null) => dispatch({ type: 'SET_ANALYSIS_CONFIG', payload: config }),
    setCostEstimation: (estimation: CostEstimation | null) => dispatch({ type: 'SET_COST_ESTIMATION', payload: estimation }),
    setAnalysisResults: (results: SentimentResult[]) => dispatch({ type: 'SET_ANALYSIS_RESULTS', payload: results }),
    setAnalysisRunning: (running: boolean) => dispatch({ type: 'SET_ANALYSIS_RUNNING', payload: running }),
    
    // Reset
    resetWorkflow: () => dispatch({ type: 'RESET_WORKFLOW' }),
    resetAll: () => dispatch({ type: 'RESET_ALL' })
  }), [dispatch]);
};