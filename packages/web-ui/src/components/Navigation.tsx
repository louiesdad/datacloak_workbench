import React from 'react';
import { useAppContext, useAppActions, type WorkflowStep } from '../context/AppContext';
import { CompactAppVersion } from './AppVersion';
import './Navigation.css';

interface NavigationProps {
  className?: string;
}

interface StepInfo {
  id: WorkflowStep;
  label: string;
  description: string;
  icon: string;
}

const steps: StepInfo[] = [
  {
    id: 'upload',
    label: 'Upload Data',
    description: 'Select and upload your data files',
    icon: '📁'
  },
  {
    id: 'profile',
    label: 'Data Profile',
    description: 'Review field types and PII detection',
    icon: '🔍'
  },
  {
    id: 'transform',
    label: 'Transform',
    description: 'Optional data transformation',
    icon: '⚙️'
  },
  {
    id: 'configure',
    label: 'Configure',
    description: 'Set up sentiment analysis',
    icon: '🛠️'
  },
  {
    id: 'execute',
    label: 'Execute',
    description: 'Run sentiment analysis',
    icon: '🚀'
  },
  {
    id: 'results',
    label: 'Results',
    description: 'View and export results',
    icon: '📊'
  }
];

export const Navigation: React.FC<NavigationProps> = ({ className }) => {
  const { state } = useAppContext();
  const { setStep } = useAppActions();
  const { currentStep, completedSteps } = state;

  const getStepStatus = (stepId: WorkflowStep) => {
    if (stepId === currentStep) return 'current';
    if (completedSteps.has(stepId)) return 'completed';
    return 'pending';
  };

  const canNavigateToStep = (stepId: WorkflowStep): boolean => {
    // Always allow navigation to completed steps and current step
    if (completedSteps.has(stepId) || stepId === currentStep) {
      return true;
    }

    // Define step dependencies
    const stepOrder = ['upload', 'profile', 'transform', 'configure', 'execute', 'results'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const targetIndex = stepOrder.indexOf(stepId);

    // Allow navigation to the next immediate step if current step conditions are met
    if (targetIndex === currentIndex + 1) {
      switch (currentStep) {
        case 'upload':
          return state.selectedFiles.length > 0 || state.datasets.length > 0;
        case 'profile':
          return state.fileProfiles.length > 0;
        case 'transform':
          return true; // Transform is optional
        case 'configure':
          return state.analysisConfig !== null;
        case 'execute':
          return state.analysisResults.length > 0;
        default:
          return false;
      }
    }
    
    // Also allow navigation forward if previous steps are completed
    if (targetIndex > currentIndex) {
      // Check if all steps between current and target are completed
      for (let i = 0; i < targetIndex; i++) {
        if (!completedSteps.has(stepOrder[i] as WorkflowStep)) {
          return false;
        }
      }
      return true;
    }

    return false;
  };

  const handleStepClick = (stepId: WorkflowStep) => {
    if (canNavigateToStep(stepId)) {
      setStep(stepId);
    }
  };

  const getStepIcon = (step: StepInfo, status: string) => {
    if (status === 'completed') return '✅';
    if (status === 'current') return '▶️';
    return step.icon;
  };

  return (
    <nav className={`navigation ${className || ''}`} data-testid="main-navigation">
      <div className="navigation-header">
        <h1 className="app-title">DataCloak Sentiment Workbench</h1>
        <p className="app-subtitle">Secure data processing with automatic PII detection</p>
      </div>

      <div className="workflow-steps">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const canNavigate = canNavigateToStep(step.id);
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="step-container">
              <button
                className={`workflow-step step ${status} ${status === 'current' ? 'active' : ''} ${!canNavigate ? 'disabled' : ''}`}
                onClick={() => handleStepClick(step.id)}
                disabled={!canNavigate}
                aria-current={status === 'current' ? 'step' : undefined}
                data-step={step.id}
                title={
                  !canNavigate 
                    ? `Complete ${steps[steps.findIndex(s => s.id === currentStep)]?.label || 'current step'} before proceeding`
                    : status === 'completed' 
                      ? `Return to ${step.label}`
                      : step.description
                }
                aria-label={`${step.label} - ${status} ${!canNavigate ? '(disabled)' : ''}`}
              >
                <div className="step-icon" aria-hidden="true">
                  {getStepIcon(step, status)}
                </div>
                <div className="step-content">
                  <div className="step-label">{step.label}</div>
                  <div className="step-description">{step.description}</div>
                </div>
                <div className="step-status">
                  {status === 'completed' && <span className="status-text">Complete</span>}
                  {status === 'current' && <span className="status-text">Active</span>}
                  {status === 'pending' && canNavigate && <span className="status-text">Ready</span>}
                  {status === 'pending' && !canNavigate && <span className="status-text">Pending</span>}
                </div>
              </button>

              {!isLast && (
                <div className={`step-connector ${completedSteps.has(step.id) ? 'completed' : ''}`}>
                  <div className="connector-line"></div>
                  <div className="connector-arrow">→</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress indicator */}
      <div className="progress-section">
        <div className="progress-label">
          Workflow Progress: {completedSteps.size} of {steps.length} steps completed
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(completedSteps.size / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="navigation-actions">
        {state.currentStep !== 'upload' && (
          <button
            className="nav-action secondary"
            onClick={() => setStep('upload')}
            data-testid="start-over-button"
          >
            ← Start Over
          </button>
        )}

        {state.analysisResults.length > 0 && (
          <button
            className="nav-action primary"
            onClick={() => setStep('results')}
            data-testid="view-results-button"
          >
            View Results →
          </button>
        )}
      </div>

      {/* Advanced Features */}
      <div className="advanced-features-section">
        <button
          className="nav-action advanced"
          onClick={() => window.dispatchEvent(new CustomEvent('show-advanced-features'))}
          data-testid="advanced-features-button"
          title="View real-time monitoring, progress tracking, and advanced features"
        >
          🎛️ Advanced Features
        </button>
        <button
          className="nav-action admin"
          onClick={() => window.dispatchEvent(new CustomEvent('show-admin-panel'))}
          data-testid="admin-panel-button"
          title="Admin configuration panel"
        >
          🔧 Admin Panel
        </button>
      </div>

      {/* App version */}
      <CompactAppVersion className="navigation-version" />
    </nav>
  );
};