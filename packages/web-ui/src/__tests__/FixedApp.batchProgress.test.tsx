import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import FixedApp from '../FixedApp';

// Mock fetch
global.fetch = jest.fn();

// Mock XMLHttpRequest for file upload
const mockXHR = {
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  upload: {
    addEventListener: jest.fn()
  },
  addEventListener: jest.fn(),
  status: 200,
  responseText: '',
  readyState: 4
};

global.XMLHttpRequest = jest.fn(() => mockXHR) as any;

describe('FixedApp Batch Progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    
    // Reset XMLHttpRequest mock
    mockXHR.open.mockClear();
    mockXHR.send.mockClear();
    mockXHR.upload.addEventListener.mockClear();
    mockXHR.addEventListener.mockClear();
  });

  const setupUploadedDataset = async () => {
    render(<FixedApp />);
    
    // Mock file upload
    const file = new File(['test,data\n1,2'], 'test.csv', { type: 'text/csv' });
    const fileInput = screen.getByLabelText(/Click to select file/);
    
    await userEvent.upload(fileInput, file);
    
    // Mock successful upload
    mockXHR.addEventListener.mockImplementation((event, callback) => {
      if (event === 'load') {
        mockXHR.responseText = JSON.stringify({
          data: {
            dataset: {
              id: 'test-dataset-id',
              originalFilename: 'test.csv',
              recordCount: 500,
              size: 1024
            },
            fieldInfo: [
              { name: 'review', type: 'string' },
              { name: 'rating', type: 'number' }
            ],
            previewData: Array(500).fill(null).map((_, i) => ({
              review: `Sample review text ${i}`,
              rating: Math.floor(Math.random() * 5) + 1
            }))
          }
        });
        setTimeout(callback, 0);
      }
    });
    
    fireEvent.click(screen.getByText('Upload File'));
    
    await waitFor(() => {
      expect(screen.getByText('Data Profile')).toBeInTheDocument();
    });
  };

  describe('Batch Progress UI', () => {
    it('should not show batch progress for basic model', async () => {
      await setupUploadedDataset();
      
      // Navigate through workflow
      fireEvent.click(screen.getByText('Continue to Column Selection'));
      
      await waitFor(() => {
        expect(screen.getByText('Select Text Columns for Analysis')).toBeInTheDocument();
      });
      
      // Select review column
      const reviewCheckbox = screen.getByLabelText('review');
      fireEvent.click(reviewCheckbox);
      
      fireEvent.click(screen.getByText('Continue to Configuration'));
      
      // Select basic model (default)
      const modelSelect = screen.getByRole('combobox');
      fireEvent.change(modelSelect, { target: { value: 'basic' } });
      
      // Mock batch analysis response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: Array(500).fill(null).map((_, i) => ({
            text: `Sample review text ${i}`,
            sentiment: 'positive',
            confidence: 0.9,
            score: 0.8
          }))
        })
      });
      
      fireEvent.click(screen.getByText('Start Preview Analysis'));
      
      await waitFor(() => {
        expect(screen.getByText('Analyzing your data with PII protection...')).toBeInTheDocument();
      });
      
      // Should NOT show batch progress for basic model
      expect(screen.queryByText(/Processing batch/)).not.toBeInTheDocument();
    });

    it('should show batch progress for OpenAI models', async () => {
      await setupUploadedDataset();
      
      // Navigate through workflow
      fireEvent.click(screen.getByText('Continue to Column Selection'));
      
      await waitFor(() => {
        expect(screen.getByText('Select Text Columns for Analysis')).toBeInTheDocument();
      });
      
      // Select review column
      const reviewCheckbox = screen.getByLabelText('review');
      fireEvent.click(reviewCheckbox);
      
      fireEvent.click(screen.getByText('Continue to Configuration'));
      
      // Select GPT-3.5 model
      const modelSelect = screen.getByRole('combobox');
      fireEvent.change(modelSelect, { target: { value: 'gpt-3.5-turbo' } });
      
      // Mock batch analysis responses (5 batches of 100)
      for (let i = 0; i < 5; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: Array(100).fill(null).map((_, j) => ({
              text: `Sample review text ${i * 100 + j}`,
              sentiment: 'positive',
              confidence: 0.9,
              score: 0.8
            }))
          })
        });
      }
      
      fireEvent.click(screen.getByText('Start Preview Analysis'));
      
      await waitFor(() => {
        expect(screen.getByText('Analyzing your data with PII protection...')).toBeInTheDocument();
      });
      
      // Should show batch progress
      expect(screen.getByText(/Processing batch \d of 5/)).toBeInTheDocument();
      expect(screen.getByText('OpenAI models process texts in batches of 100 for optimal performance')).toBeInTheDocument();
    });

    it('should update batch progress during processing', async () => {
      await setupUploadedDataset();
      
      // Navigate to analysis
      fireEvent.click(screen.getByText('Continue to Column Selection'));
      await waitFor(() => screen.getByText('Select Text Columns for Analysis'));
      
      fireEvent.click(screen.getByLabelText('review'));
      fireEvent.click(screen.getByText('Continue to Configuration'));
      
      // Select GPT-3.5
      const modelSelect = screen.getByRole('combobox');
      fireEvent.change(modelSelect, { target: { value: 'gpt-3.5-turbo' } });
      
      // Mock batch responses with delays
      let currentBatch = 0;
      (global.fetch as jest.Mock).mockImplementation(async (url) => {
        if (url.includes('/sentiment/batch')) {
          currentBatch++;
          await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time
          return {
            ok: true,
            json: async () => ({
              data: Array(100).fill(null).map(() => ({
                sentiment: 'positive',
                confidence: 0.9,
                score: 0.8
              }))
            })
          };
        }
        return { ok: true, json: async () => ({}) };
      });
      
      fireEvent.click(screen.getByText('Start Preview Analysis'));
      
      // Check initial batch
      await waitFor(() => {
        expect(screen.getByText('Processing batch 1 of 5')).toBeInTheDocument();
      });
      
      // Check progress bar exists
      const progressBar = screen.getByRole('progressbar', { hidden: true });
      expect(progressBar).toBeInTheDocument();
      
      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('Analysis Results')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Verify all batches were processed
      expect(currentBatch).toBe(5);
    });

    it('should show correct progress bar fill percentage', async () => {
      await setupUploadedDataset();
      
      // Navigate to analysis
      fireEvent.click(screen.getByText('Continue to Column Selection'));
      await waitFor(() => screen.getByText('Select Text Columns for Analysis'));
      
      fireEvent.click(screen.getByLabelText('review'));
      fireEvent.click(screen.getByText('Continue to Configuration'));
      
      // Select GPT-4
      const modelSelect = screen.getByRole('combobox');
      fireEvent.change(modelSelect, { target: { value: 'gpt-4' } });
      
      // Mock 200 texts (2 batches)
      const updatedDataset = {
        data: {
          dataset: { recordCount: 200 },
          previewData: Array(200).fill(null).map((_, i) => ({
            review: `Review ${i}`
          }))
        }
      };
      
      // Update preview data count
      mockXHR.responseText = JSON.stringify(updatedDataset);
      
      let fetchCallCount = 0;
      (global.fetch as jest.Mock).mockImplementation(async (url) => {
        if (url.includes('/sentiment/batch')) {
          fetchCallCount++;
          return {
            ok: true,
            json: async () => ({
              data: Array(100).fill(null).map(() => ({
                sentiment: 'neutral',
                confidence: 0.8
              }))
            })
          };
        }
        return { ok: true, json: async () => ({}) };
      });
      
      fireEvent.click(screen.getByText('Start Preview Analysis'));
      
      await waitFor(() => {
        const progressFill = document.querySelector('.progress-fill');
        expect(progressFill).toBeInTheDocument();
        
        // First batch (1 of 2) = 50%
        if (fetchCallCount === 1) {
          expect(progressFill).toHaveStyle({ width: '50%' });
        }
      });
    });
  });

  describe('Batch Processing with Delays', () => {
    it('should add delay between batches for OpenAI models', async () => {
      await setupUploadedDataset();
      
      // Navigate to analysis
      fireEvent.click(screen.getByText('Continue to Column Selection'));
      await waitFor(() => screen.getByText('Select Text Columns for Analysis'));
      
      fireEvent.click(screen.getByLabelText('review'));
      fireEvent.click(screen.getByText('Continue to Configuration'));
      
      // Select GPT-3.5
      const modelSelect = screen.getByRole('combobox');
      fireEvent.change(modelSelect, { target: { value: 'gpt-3.5-turbo' } });
      
      const fetchTimes: number[] = [];
      (global.fetch as jest.Mock).mockImplementation(async (url) => {
        if (url.includes('/sentiment/batch')) {
          fetchTimes.push(Date.now());
          return {
            ok: true,
            json: async () => ({
              data: Array(100).fill(null).map(() => ({
                sentiment: 'positive',
                confidence: 0.9
              }))
            })
          };
        }
        return { ok: true, json: async () => ({}) };
      });
      
      fireEvent.click(screen.getByText('Start Preview Analysis'));
      
      await waitFor(() => {
        expect(screen.getByText('Analysis Results')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      // Check delays between batches (should be ~500ms)
      for (let i = 1; i < fetchTimes.length; i++) {
        const delay = fetchTimes[i] - fetchTimes[i - 1];
        expect(delay).toBeGreaterThanOrEqual(400); // Allow some variance
        expect(delay).toBeLessThan(700);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle batch processing errors gracefully', async () => {
      await setupUploadedDataset();
      
      // Navigate to analysis
      fireEvent.click(screen.getByText('Continue to Column Selection'));
      await waitFor(() => screen.getByText('Select Text Columns for Analysis'));
      
      fireEvent.click(screen.getByLabelText('review'));
      fireEvent.click(screen.getByText('Continue to Configuration'));
      
      // Select GPT-3.5
      const modelSelect = screen.getByRole('combobox');
      fireEvent.change(modelSelect, { target: { value: 'gpt-3.5-turbo' } });
      
      // Mock first batch success, second batch failure
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: Array(100).fill(null).map(() => ({
              sentiment: 'positive',
              confidence: 0.9
            }))
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => '{"error":{"message":"Internal server error"}}'
        });
      
      fireEvent.click(screen.getByText('Start Preview Analysis'));
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to analyze data/)).toBeInTheDocument();
      });
    });

    it('should handle timeout errors', async () => {
      await setupUploadedDataset();
      
      // Navigate to analysis
      fireEvent.click(screen.getByText('Continue to Column Selection'));
      await waitFor(() => screen.getByText('Select Text Columns for Analysis'));
      
      fireEvent.click(screen.getByLabelText('review'));
      fireEvent.click(screen.getByText('Continue to Configuration'));
      
      // Select GPT-4
      const modelSelect = screen.getByRole('combobox');
      fireEvent.change(modelSelect, { target: { value: 'gpt-4' } });
      
      // Mock timeout error
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('AbortError'), { name: 'AbortError' })
      );
      
      fireEvent.click(screen.getByText('Start Preview Analysis'));
      
      await waitFor(() => {
        expect(screen.getByText(/Analysis timed out/)).toBeInTheDocument();
      });
    });
  });

  describe('Column Selection Warning', () => {
    it('should show hint when non-text columns are selected', async () => {
      await setupUploadedDataset();
      
      // Update field info to include non-text columns
      mockXHR.responseText = JSON.stringify({
        data: {
          dataset: { recordCount: 100 },
          fieldInfo: [
            { name: 'Last Name', type: 'string' },
            { name: 'Company', type: 'string' },
            { name: 'City', type: 'string' },
            { name: 'review_text', type: 'string' }
          ],
          previewData: []
        }
      });
      
      // Navigate to column selection
      fireEvent.click(screen.getByText('Continue to Column Selection'));
      
      await waitFor(() => {
        expect(screen.getByText('Select Text Columns for Analysis')).toBeInTheDocument();
      });
      
      // Select non-text columns
      fireEvent.click(screen.getByLabelText('Last Name'));
      fireEvent.click(screen.getByLabelText('Company'));
      fireEvent.click(screen.getByLabelText('City'));
      
      // Should show hint
      expect(screen.getByText(/The selected columns don't appear to contain review text/)).toBeInTheDocument();
      
      // Select review column
      fireEvent.click(screen.getByLabelText('review_text'));
      
      // Hint should disappear
      expect(screen.queryByText(/The selected columns don't appear to contain review text/)).not.toBeInTheDocument();
    });
  });
});