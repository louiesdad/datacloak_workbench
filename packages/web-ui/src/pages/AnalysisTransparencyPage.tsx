import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AnalysisAuditBrowser } from '../components/AnalysisAuditBrowser';
import { analysisAuditService } from '../services/analysisAuditService';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';

interface AnalysisTransparencyPageProps {
  sessionId?: string;
  onBack?: () => void;
}

export const AnalysisTransparencyPage: React.FC<AnalysisTransparencyPageProps> = ({
  sessionId,
  onBack
}) => {
  const [processingQuestion, setProcessingQuestion] = useState(false);
  const [questionResponse, setQuestionResponse] = useState<{
    decisionId: string;
    question: string;
    explanation: string;
  } | null>(null);
  
  const { handleApiError } = useApiErrorHandler();

  const handleQuestionDecision = async (decisionId: string, question: string) => {
    try {
      setProcessingQuestion(true);
      const response = await analysisAuditService.questionDecision(decisionId, question);
      setQuestionResponse(response);
      
      // The response is now handled by the QuestionDecisionModal
      return response;
    } catch (error) {
      handleApiError(error, {
        operation: 'questioning decision',
        component: 'AnalysisTransparencyPage'
      });
      throw error;
    } finally {
      setProcessingQuestion(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Analysis Transparency
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Explore and understand how analysis decisions were made
          </p>
        </div>

        {/* Analysis Audit Browser */}
        <AnalysisAuditBrowser
          sessionId={sessionId}
          onQuestionDecision={handleQuestionDecision}
        />

        {/* Question Response Modal (could be improved with a proper modal component) */}
        {processingQuestion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-lg">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <p className="text-center mt-4">Processing your question...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Example usage in a parent component:
/*
import { AnalysisTransparencyPage } from './pages/AnalysisTransparencyPage';

function App() {
  const [currentSessionId] = useState('session-123');
  const [showTransparency, setShowTransparency] = useState(false);

  return (
    <div>
      {showTransparency ? (
        <AnalysisTransparencyPage
          sessionId={currentSessionId}
          onBack={() => setShowTransparency(false)}
        />
      ) : (
        <div>
          <button onClick={() => setShowTransparency(true)}>
            View Analysis Decisions
          </button>
          {/* Your main app content }
        </div>
      )}
    </div>
  );
}
*/

export default AnalysisTransparencyPage;