import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RealTimeSentimentFeed } from '../RealTimeSentimentFeed';

// Mock date-fns to have consistent time displays
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '2 minutes ago')
}));

describe('RealTimeSentimentFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any existing event listeners
    window.removeEventListener('websocket:message', jest.fn());
  });

  describe('rendering', () => {
    it('should render empty state initially', () => {
      render(<RealTimeSentimentFeed />);
      
      expect(screen.getByTestId('realtime-sentiment-feed')).toBeInTheDocument();
      expect(screen.getByText('Real-time Sentiment Analysis')).toBeInTheDocument();
      expect(screen.getByText('Waiting for sentiment analysis events...')).toBeInTheDocument();
    });

    it('should render with custom props', () => {
      render(
        <RealTimeSentimentFeed 
          maxItems={10}
          autoScroll={false}
          showDetails={false}
          filterSentiment="positive"
        />
      );
      
      expect(screen.getByTestId('realtime-sentiment-feed')).toBeInTheDocument();
    });

    it('should render filter buttons', () => {
      render(<RealTimeSentimentFeed />);
      
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Positive')).toBeInTheDocument();
      expect(screen.getByText('Neutral')).toBeInTheDocument();
      expect(screen.getByText('Negative')).toBeInTheDocument();
    });

    it('should show offline status by default', () => {
      render(<RealTimeSentimentFeed />);
      
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  describe('WebSocket message handling', () => {
    it('should add sentiment events from WebSocket messages', async () => {
      render(<RealTimeSentimentFeed />);
      
      // Simulate WebSocket message
      const sentimentEvent = {
        type: 'sentiment_complete',
        data: {
          result: {
            id: 'test-1',
            text: 'This is a great product!',
            sentiment: 'positive',
            score: 0.8,
            confidence: 0.95,
            timestamp: new Date().toISOString()
          }
        }
      };
      
      window.dispatchEvent(new CustomEvent('websocket:message', { detail: sentimentEvent }));
      
      await waitFor(() => {
        expect(screen.getByText('This is a great product!')).toBeInTheDocument();
        expect(screen.getByText('POSITIVE')).toBeInTheDocument();
        expect(screen.getByText('+0.80')).toBeInTheDocument();
        expect(screen.getByText('95%')).toBeInTheDocument();
      });
    });

    it('should handle sentiment progress events', async () => {
      render(<RealTimeSentimentFeed />);
      
      const progressEvent = {
        type: 'sentiment_progress',
        data: {
          result: {
            text: 'Processing text...',
            sentiment: 'neutral',
            score: 0,
            confidence: 0.5
          }
        }
      };
      
      window.dispatchEvent(new CustomEvent('websocket:message', { detail: progressEvent }));
      
      await waitFor(() => {
        expect(screen.getByText('Processing text...')).toBeInTheDocument();
      });
    });

    it('should limit items to maxItems prop', async () => {
      render(<RealTimeSentimentFeed maxItems={3} />);
      
      // Add 5 items
      for (let i = 1; i <= 5; i++) {
        const event = {
          type: 'sentiment_complete',
          data: {
            result: {
              id: `test-${i}`,
              text: `Text ${i}`,
              sentiment: 'positive',
              score: 0.5,
              confidence: 0.8
            }
          }
        };
        
        window.dispatchEvent(new CustomEvent('websocket:message', { detail: event }));
      }
      
      await waitFor(() => {
        const items = screen.getAllByTestId('sentiment-item');
        expect(items).toHaveLength(3);
        // Should show most recent items
        expect(screen.getByText('Text 5')).toBeInTheDocument();
        expect(screen.getByText('Text 4')).toBeInTheDocument();
        expect(screen.getByText('Text 3')).toBeInTheDocument();
        expect(screen.queryByText('Text 1')).not.toBeInTheDocument();
      });
    });
  });

  describe('filtering', () => {
    beforeEach(async () => {
      render(<RealTimeSentimentFeed />);
      
      // Add items with different sentiments
      const sentiments = ['positive', 'negative', 'neutral', 'positive', 'negative'];
      for (let i = 0; i < sentiments.length; i++) {
        const event = {
          type: 'sentiment_complete',
          data: {
            result: {
              id: `test-${i}`,
              text: `${sentiments[i]} text ${i}`,
              sentiment: sentiments[i],
              score: i * 0.2,
              confidence: 0.8
            }
          }
        };
        
        window.dispatchEvent(new CustomEvent('websocket:message', { detail: event }));
      }
      
      await waitFor(() => {
        expect(screen.getAllByTestId('sentiment-item')).toHaveLength(5);
      });
    });

    it('should filter by positive sentiment', async () => {
      fireEvent.click(screen.getByText('Positive'));
      
      await waitFor(() => {
        const items = screen.getAllByTestId('sentiment-item');
        expect(items).toHaveLength(2);
        expect(screen.getByText('positive text 0')).toBeInTheDocument();
        expect(screen.getByText('positive text 3')).toBeInTheDocument();
      });
    });

    it('should filter by negative sentiment', async () => {
      fireEvent.click(screen.getByText('Negative'));
      
      await waitFor(() => {
        const items = screen.getAllByTestId('sentiment-item');
        expect(items).toHaveLength(2);
        expect(screen.getByText('negative text 1')).toBeInTheDocument();
        expect(screen.getByText('negative text 4')).toBeInTheDocument();
      });
    });

    it('should filter by neutral sentiment', async () => {
      fireEvent.click(screen.getByText('Neutral'));
      
      await waitFor(() => {
        const items = screen.getAllByTestId('sentiment-item');
        expect(items).toHaveLength(1);
        expect(screen.getByText('neutral text 2')).toBeInTheDocument();
      });
    });

    it('should show all items when All filter is selected', async () => {
      fireEvent.click(screen.getByText('Positive'));
      await waitFor(() => {
        expect(screen.getAllByTestId('sentiment-item')).toHaveLength(2);
      });
      
      fireEvent.click(screen.getByText('All'));
      await waitFor(() => {
        expect(screen.getAllByTestId('sentiment-item')).toHaveLength(5);
      });
    });
  });

  describe('statistics', () => {
    it('should calculate and display statistics correctly', async () => {
      render(<RealTimeSentimentFeed />);
      
      // Add items with known distribution
      const items = [
        { sentiment: 'positive', confidence: 0.9 },
        { sentiment: 'positive', confidence: 0.8 },
        { sentiment: 'negative', confidence: 0.7 },
        { sentiment: 'neutral', confidence: 0.6 },
        { sentiment: 'neutral', confidence: 0.5 }
      ];
      
      for (let i = 0; i < items.length; i++) {
        const event = {
          type: 'sentiment_complete',
          data: {
            result: {
              id: `test-${i}`,
              text: `Text ${i}`,
              sentiment: items[i].sentiment,
              score: 0.5,
              confidence: items[i].confidence
            }
          }
        };
        
        window.dispatchEvent(new CustomEvent('websocket:message', { detail: event }));
      }
      
      await waitFor(() => {
        // Check sentiment counts
        expect(screen.getByText('2')).toBeInTheDocument(); // positive count
        
        // Check average confidence
        const avgConfidence = (0.9 + 0.8 + 0.7 + 0.6 + 0.5) / 5;
        expect(screen.getByText(`${Math.round(avgConfidence * 100)}%`)).toBeInTheDocument();
      });
    });

    it('should show PII warning in statistics', async () => {
      render(<RealTimeSentimentFeed />);
      
      const event = {
        type: 'sentiment_complete',
        data: {
          result: {
            id: 'test-pii',
            text: 'Text with PII',
            sentiment: 'positive',
            score: 0.5,
            confidence: 0.8,
            piiDetected: true
          }
        }
      };
      
      window.dispatchEvent(new CustomEvent('websocket:message', { detail: event }));
      
      await waitFor(() => {
        expect(screen.getByText('PII:')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });
  });

  describe('item display', () => {
    it('should truncate long text', async () => {
      render(<RealTimeSentimentFeed />);
      
      const longText = 'A'.repeat(200);
      const event = {
        type: 'sentiment_complete',
        data: {
          result: {
            id: 'test-long',
            text: longText,
            sentiment: 'neutral',
            score: 0,
            confidence: 0.5
          }
        }
      };
      
      window.dispatchEvent(new CustomEvent('websocket:message', { detail: event }));
      
      await waitFor(() => {
        const displayedText = screen.getByText(/^A+\.\.\.$/);
        expect(displayedText.textContent?.length).toBeLessThan(longText.length);
        expect(displayedText.textContent).toMatch(/\.\.\.$/);
      });
    });

    it('should show details when showDetails is true', async () => {
      render(<RealTimeSentimentFeed showDetails={true} />);
      
      const event = {
        type: 'sentiment_complete',
        data: {
          result: {
            id: 'test-details',
            text: 'Test text',
            sentiment: 'positive',
            score: 0.75,
            confidence: 0.9,
            model: 'gpt-3.5-turbo',
            piiDetected: true
          }
        }
      };
      
      window.dispatchEvent(new CustomEvent('websocket:message', { detail: event }));
      
      await waitFor(() => {
        expect(screen.getByText('Score:')).toBeInTheDocument();
        expect(screen.getByText('+0.75')).toBeInTheDocument();
        expect(screen.getByText('Confidence:')).toBeInTheDocument();
        expect(screen.getByText('90%')).toBeInTheDocument();
        expect(screen.getByText('Model:')).toBeInTheDocument();
        expect(screen.getByText('gpt-3.5-turbo')).toBeInTheDocument();
        expect(screen.getByText('⚠️ PII Detected')).toBeInTheDocument();
      });
    });

    it('should not show details when showDetails is false', async () => {
      render(<RealTimeSentimentFeed showDetails={false} />);
      
      const event = {
        type: 'sentiment_complete',
        data: {
          result: {
            id: 'test-no-details',
            text: 'Test text',
            sentiment: 'positive',
            score: 0.75,
            confidence: 0.9
          }
        }
      };
      
      window.dispatchEvent(new CustomEvent('websocket:message', { detail: event }));
      
      await waitFor(() => {
        expect(screen.getByText('Test text')).toBeInTheDocument();
        expect(screen.queryByText('Score:')).not.toBeInTheDocument();
        expect(screen.queryByText('Confidence:')).not.toBeInTheDocument();
      });
    });
  });

  describe('interactions', () => {
    it('should call onItemClick when item is clicked', async () => {
      const onItemClick = jest.fn();
      render(<RealTimeSentimentFeed onItemClick={onItemClick} />);
      
      const event = {
        type: 'sentiment_complete',
        data: {
          result: {
            id: 'test-click',
            text: 'Clickable text',
            sentiment: 'positive',
            score: 0.5,
            confidence: 0.8
          }
        }
      };
      
      window.dispatchEvent(new CustomEvent('websocket:message', { detail: event }));
      
      await waitFor(() => {
        expect(screen.getByText('Clickable text')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('sentiment-item'));
      
      expect(onItemClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-click',
          text: 'Clickable text',
          sentiment: 'positive'
        })
      );
    });
  });

  describe('sentiment display', () => {
    it('should show correct emoji and color for positive sentiment', async () => {
      render(<RealTimeSentimentFeed />);
      
      const event = {
        type: 'sentiment_complete',
        data: {
          result: {
            text: 'Positive text',
            sentiment: 'positive',
            score: 0.8,
            confidence: 0.9
          }
        }
      };
      
      window.dispatchEvent(new CustomEvent('websocket:message', { detail: event }));
      
      await waitFor(() => {
        expect(screen.getByText('😊')).toBeInTheDocument();
        expect(screen.getByText('POSITIVE')).toBeInTheDocument();
      });
    });

    it('should show correct emoji for negative sentiment', async () => {
      render(<RealTimeSentimentFeed />);
      
      const event = {
        type: 'sentiment_complete',
        data: {
          result: {
            text: 'Negative text',
            sentiment: 'negative',
            score: -0.8,
            confidence: 0.9
          }
        }
      };
      
      window.dispatchEvent(new CustomEvent('websocket:message', { detail: event }));
      
      await waitFor(() => {
        expect(screen.getByText('😞')).toBeInTheDocument();
        expect(screen.getByText('NEGATIVE')).toBeInTheDocument();
      });
    });

    it('should show correct emoji for neutral sentiment', async () => {
      render(<RealTimeSentimentFeed />);
      
      const event = {
        type: 'sentiment_complete',
        data: {
          result: {
            text: 'Neutral text',
            sentiment: 'neutral',
            score: 0.1,
            confidence: 0.5
          }
        }
      };
      
      window.dispatchEvent(new CustomEvent('websocket:message', { detail: event }));
      
      await waitFor(() => {
        expect(screen.getByText('😐')).toBeInTheDocument();
        expect(screen.getByText('NEUTRAL')).toBeInTheDocument();
      });
    });
  });
});