import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, MessageCircle, Sparkles, Copy, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { clsx } from 'clsx';

interface QuestionDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  decision: {
    id: string;
    component: string;
    reasoning: string;
    confidence: number;
    timestamp: string;
    input?: any;
    output?: any;
  } | null;
  onSubmitQuestion: (decisionId: string, question: string) => Promise<{
    explanation: string;
    additionalContext?: any;
  }>;
}

interface QuestionSuggestion {
  text: string;
  icon: React.ReactNode;
}

export const QuestionDecisionModal: React.FC<QuestionDecisionModalProps> = ({
  isOpen,
  onClose,
  decision,
  onSubmitQuestion
}) => {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [conversation, setConversation] = useState<Array<{
    type: 'question' | 'answer';
    text: string;
    timestamp: Date;
  }>>([]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setQuestion('');
      setResponse('');
      setError('');
      setConversation([]);
    }
  }, [isOpen]);

  if (!isOpen || !decision) return null;

  const suggestions: QuestionSuggestion[] = [
    {
      text: "Why was this confidence level assigned?",
      icon: <BarChart3 className="w-4 h-4" />
    },
    {
      text: "What factors influenced this decision?",
      icon: <Sparkles className="w-4 h-4" />
    },
    {
      text: "How can I improve the accuracy?",
      icon: <Target className="w-4 h-4" />
    },
    {
      text: "What alternatives were considered?",
      icon: <GitBranch className="w-4 h-4" />
    }
  ];

  const handleSubmit = async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setError('');
    
    try {
      // Add question to conversation
      const newQuestion = {
        type: 'question' as const,
        text: question,
        timestamp: new Date()
      };
      setConversation(prev => [...prev, newQuestion]);
      
      const result = await onSubmitQuestion(decision.id, question);
      
      // Add answer to conversation
      const newAnswer = {
        type: 'answer' as const,
        text: result.explanation,
        timestamp: new Date()
      };
      setConversation(prev => [...prev, newAnswer]);
      
      setResponse(result.explanation);
      setQuestion(''); // Clear input for next question
    } catch (err) {
      setError('Failed to get explanation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuestion(suggestion);
  };

  const getComponentColor = (component: string) => {
    const colors: Record<string, string> = {
      field_detection: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      pii_masking: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      sentiment_analysis: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      confidence_tracking: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    };
    return colors[component] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <Card className="relative w-full max-w-2xl bg-white dark:bg-gray-800 shadow-xl">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Question This Decision
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  <Badge className={getComponentColor(decision.component)}>
                    {decision.component.replace('_', ' ')}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    {new Date(decision.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Decision Context */}
          <div className="border-b border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900">
            <h4 className="font-medium mb-2">Decision Context</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">{decision.reasoning}</p>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <div>
                <span className="text-gray-500">Confidence:</span>
                <span className={clsx(
                  'ml-2 font-medium',
                  decision.confidence >= 0.9 ? 'text-green-600' :
                  decision.confidence >= 0.7 ? 'text-yellow-600' : 'text-red-600'
                )}>
                  {(decision.confidence * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Conversation History */}
          {conversation.length > 0 && (
            <div className="max-h-64 overflow-y-auto p-6 space-y-4 border-b border-gray-200 dark:border-gray-700">
              {conversation.map((item, index) => (
                <div
                  key={index}
                  className={clsx(
                    'flex gap-3',
                    item.type === 'question' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div className={clsx(
                    'max-w-[80%] rounded-lg p-3',
                    item.type === 'question' 
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                      : 'bg-gray-100 dark:bg-gray-700'
                  )}>
                    <p className="text-sm">{item.text}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {item.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {response && (
                <div className="flex justify-end mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyResponse}
                    className="text-xs"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Answer
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Question Suggestions */}
          {conversation.length === 0 && (
            <div className="p-6">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Suggested Questions
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion.text)}
                    className="flex items-center gap-2 p-3 text-left text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {suggestion.icon}
                    <span>{suggestion.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="Ask a question about this decision..."
                  className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700"
                  disabled={isLoading}
                />
                <MessageCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!question.trim() || isLoading}
                className="min-w-[100px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Ask
                  </>
                )}
              </Button>
            </div>
            
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Ask questions to understand why this decision was made and how to improve results.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

// Missing imports - add these at the top
import { BarChart3, Target, GitBranch } from 'lucide-react';