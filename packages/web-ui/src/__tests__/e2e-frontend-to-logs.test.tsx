import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import FixedApp from '../FixedApp';

// Mock fetch globally
global.fetch = vi.fn();

describe('E2E: Frontend to Logs Navigation', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock successful API responses
    (global.fetch as any).mockImplementation((url: string) => {
      console.log('Fetching:', url);
      
      // Mock OpenAI logs endpoint
      if (url.includes('/api/v1/openai/logs')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                timestamp: new Date().toISOString(),
                type: 'request',
                model: 'gpt-3.5-turbo',
                responseTime: 250,
                tokenUsage: {
                  totalTokens: 150,
                  estimatedCost: 0.0003
                }
              }
            ]
          })
        });
      }
      
      // Mock OpenAI stats endpoint
      if (url.includes('/api/v1/openai/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            logs: { totalRequests: 42 },
            costs: {
              daily: {
                total: {
                  tokens: 1500,
                  cost: 0.003
                }
              }
            },
            rateLimit: {
              tokensRemaining: 3,
              maxTokens: 3
            }
          })
        });
      }
      
      // Mock analysis audit endpoints
      if (url.includes('/api/v1/audit/decisions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'decision-1',
              component: 'field_detection',
              stage: 'initial',
              confidence: 0.95,
              reasoning: 'Detected PII in email field',
              timestamp: new Date().toISOString()
            }
          ])
        });
      }
      
      if (url.includes('/api/v1/audit/session-summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            totalDecisions: 10,
            averageConfidence: 0.87,
            duration: 5000
          })
        });
      }
      
      // Default response
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  it('Step 1: Should render the main app with navigation sidebar', () => {
    const { container } = render(<FixedApp />);
    
    // Check app structure
    expect(container.querySelector('.app')).toBeInTheDocument();
    expect(container.querySelector('.app-sidebar')).toBeInTheDocument();
    expect(container.querySelector('.app-main')).toBeInTheDocument();
  });

  it('Step 2: Should display navigation steps in sidebar', () => {
    render(<FixedApp />);
    
    // Check all navigation items are present
    expect(screen.getByText('Upload Data')).toBeInTheDocument();
    expect(screen.getByText('Data Profile')).toBeInTheDocument();
    expect(screen.getByText('Select Columns')).toBeInTheDocument();
    expect(screen.getByText('Configure')).toBeInTheDocument();
    expect(screen.getByText('Analyze')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('Step 3: Should show upload step by default', () => {
    render(<FixedApp />);
    
    // Check upload content is visible
    expect(screen.getByText('Upload Your Data File')).toBeInTheDocument();
    expect(screen.getByText(/Select a CSV or Excel file/)).toBeInTheDocument();
  });

  it('Step 4: Should navigate to Logs when clicking Logs button', async () => {
    render(<FixedApp />);
    
    // Find and click the Logs navigation item
    const logsButton = screen.getByText('Logs');
    fireEvent.click(logsButton);
    
    // Wait for navigation to complete
    await waitFor(() => {
      expect(screen.getByText('Analysis Logs & Decision Transparency')).toBeInTheDocument();
    });
  });

  it('Step 5: Should load and display OpenAI stats when on Logs page', async () => {
    render(<FixedApp />);
    
    // Navigate to logs
    const logsButton = screen.getByText('Logs');
    fireEvent.click(logsButton);
    
    // Wait for API calls to complete
    await waitFor(() => {
      expect(screen.getByText('OpenAI Usage Statistics')).toBeInTheDocument();
    });
    
    // Check stats are displayed
    await waitFor(() => {
      expect(screen.getByText('Total Requests')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument(); // Total requests value
      expect(screen.getByText('Total Tokens')).toBeInTheDocument();
      expect(screen.getByText('1500')).toBeInTheDocument(); // Total tokens value
    });
  });

  it('Step 6: Should display Analysis Audit Browser component', async () => {
    render(<FixedApp />);
    
    // Navigate to logs
    const logsButton = screen.getByText('Logs');
    fireEvent.click(logsButton);
    
    // Check for Analysis Audit Browser section
    await waitFor(() => {
      expect(screen.getByText('Analysis Decision Audit Trail')).toBeInTheDocument();
    });
  });

  it('Step 7: Should handle API errors gracefully', async () => {
    // Mock API failure
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
    
    render(<FixedApp />);
    
    // Navigate to logs
    const logsButton = screen.getByText('Logs');
    fireEvent.click(logsButton);
    
    // Should still show the page structure
    await waitFor(() => {
      expect(screen.getByText('Analysis Logs & Decision Transparency')).toBeInTheDocument();
    });
  });

  it('Step 8: Should allow refreshing stats', async () => {
    render(<FixedApp />);
    
    // Navigate to logs
    const logsButton = screen.getByText('Logs');
    fireEvent.click(logsButton);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Refresh Stats')).toBeInTheDocument();
    });
    
    // Click refresh
    const refreshButton = screen.getByText('Refresh Stats');
    fireEvent.click(refreshButton);
    
    // Verify fetch was called again
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/openai/logs'),
      expect.any(Object)
    );
  });

  it('Full E2E: Navigate through all steps to Logs', async () => {
    const { container } = render(<FixedApp />);
    
    // Step 1: Verify initial state
    expect(screen.getByText('Upload Your Data File')).toBeInTheDocument();
    
    // Step 2: Check navigation is visible
    const navSteps = container.querySelectorAll('.nav-step');
    expect(navSteps.length).toBe(7); // All 7 navigation steps
    
    // Step 3: Find Logs button
    const logsNav = Array.from(navSteps).find(step => 
      step.textContent?.includes('Logs')
    );
    expect(logsNav).toBeTruthy();
    
    // Step 4: Click on Logs
    if (logsNav) {
      fireEvent.click(logsNav);
    }
    
    // Step 5: Verify navigation happened
    await waitFor(() => {
      const currentStep = container.querySelector('.nav-step.active');
      expect(currentStep?.textContent).toContain('Logs');
    });
    
    // Step 6: Verify content loaded
    await waitFor(() => {
      expect(screen.getByText('Analysis Logs & Decision Transparency')).toBeInTheDocument();
      expect(screen.getByText('Analysis Decision Audit Trail')).toBeInTheDocument();
      expect(screen.getByText('OpenAI Usage Statistics')).toBeInTheDocument();
    });
    
    // Step 7: Verify API calls were made
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/openai/logs'),
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/openai/stats'),
      expect.any(Object)
    );
  });
});