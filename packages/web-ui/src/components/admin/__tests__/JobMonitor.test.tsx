import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JobMonitor } from '../JobMonitor';

// Mock fetch globally
global.fetch = vi.fn();

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn((date) => '2 minutes ago')
}));

const mockJobs = [
  {
    id: 'job-1',
    type: 'sentiment_analysis_batch' as const,
    status: 'running' as const,
    priority: 'high' as const,
    data: { text: 'test data' },
    progress: 45,
    createdAt: '2024-01-01T10:00:00Z',
    startedAt: '2024-01-01T10:01:00Z'
  },
  {
    id: 'job-2',
    type: 'file_processing' as const,
    status: 'completed' as const,
    priority: 'medium' as const,
    data: { filename: 'test.csv' },
    progress: 100,
    createdAt: '2024-01-01T09:00:00Z',
    startedAt: '2024-01-01T09:01:00Z',
    completedAt: '2024-01-01T09:05:00Z'
  },
  {
    id: 'job-3',
    type: 'security_scan' as const,
    status: 'failed' as const,
    priority: 'critical' as const,
    data: { scanType: 'pii' },
    progress: 25,
    createdAt: '2024-01-01T08:00:00Z',
    startedAt: '2024-01-01T08:01:00Z',
    completedAt: '2024-01-01T08:02:00Z',
    error: 'Connection timeout'
  }
];

const mockStats = {
  total: 3,
  pending: 0,
  running: 1,
  completed: 1,
  failed: 1,
  cancelled: 0
};

describe('JobMonitor', () => {
  beforeEach(() => {
    // Mock successful API response
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        jobs: mockJobs,
        stats: mockStats
      })
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders job monitor with header and controls', async () => {
    render(<JobMonitor />);
    
    expect(screen.getByRole('heading', { name: /job monitor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auto refresh/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear completed/i })).toBeInTheDocument();
  });

  it('displays job statistics', async () => {
    render(<JobMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('Total:')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Running:')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Failed:')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('renders job table with jobs', async () => {
    render(<JobMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('Job History (3 jobs)')).toBeInTheDocument();
      expect(screen.getByText('Sentiment Analysis Batch')).toBeInTheDocument();
      expect(screen.getByText('File Processing')).toBeInTheDocument();
      expect(screen.getByText('Security Scan')).toBeInTheDocument();
    });
  });

  it('displays job progress correctly', async () => {
    render(<JobMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('45%')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
    });
  });

  it('shows job status badges', async () => {
    render(<JobMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('running')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('failed')).toBeInTheDocument();
    });
  });

  it('shows priority badges', async () => {
    render(<JobMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
      expect(screen.getByText('critical')).toBeInTheDocument();
    });
  });

  it('allows filtering by status', async () => {
    render(<JobMonitor />);
    
    await waitFor(() => {
      const statusFilter = screen.getByDisplayValue('all');
      fireEvent.change(statusFilter, { target: { value: 'running' } });
      
      // Should only show running job
      expect(screen.getByText('Job History (1 jobs)')).toBeInTheDocument();
    });
  });

  it('allows filtering by job type', async () => {
    render(<JobMonitor />);
    
    await waitFor(() => {
      const typeFilter = screen.getAllByDisplayValue('all')[1]; // Second select is type filter
      fireEvent.change(typeFilter, { target: { value: 'sentiment_analysis_batch' } });
      
      // Should only show sentiment analysis job
      expect(screen.getByText('Job History (1 jobs)')).toBeInTheDocument();
    });
  });

  it('handles job cancellation', async () => {
    // Add a pending job for testing cancellation
    const jobsWithPending = [
      ...mockJobs,
      {
        id: 'job-4',
        type: 'data_export' as const,
        status: 'pending' as const,
        priority: 'low' as const,
        data: { format: 'csv' },
        progress: 0,
        createdAt: '2024-01-01T11:00:00Z'
      }
    ];

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        jobs: jobsWithPending,
        stats: { ...mockStats, total: 4, pending: 1 }
      })
    });

    render(<JobMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('pending')).toBeInTheDocument();
    });

    // Mock cancel job API
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });

    // Find and click cancel button (X icon)
    const cancelButtons = screen.getAllByRole('button');
    const cancelButton = cancelButtons.find(btn => 
      btn.getAttribute('title') === 'Cancel job'
    );
    
    if (cancelButton) {
      fireEvent.click(cancelButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/admin/jobs/job-4/cancel',
          { method: 'POST' }
        );
      });
    }
  });

  it('handles job retry', async () => {
    render(<JobMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('failed')).toBeInTheDocument();
    });

    // Mock retry job API
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });

    // Find and click retry button
    const retryButtons = screen.getAllByRole('button');
    const retryButton = retryButtons.find(btn => 
      btn.getAttribute('title') === 'Retry job'
    );
    
    if (retryButton) {
      fireEvent.click(retryButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/admin/jobs/job-3/retry',
          { method: 'POST' }
        );
      });
    }
  });

  it('handles clear completed jobs', async () => {
    render(<JobMonitor />);
    
    // Mock clear completed API
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });

    const clearButton = screen.getByRole('button', { name: /clear completed/i });
    fireEvent.click(clearButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/jobs/clear-completed',
        { method: 'POST' }
      );
    });
  });

  it('toggles auto refresh', async () => {
    render(<JobMonitor />);
    
    const autoRefreshButton = screen.getByRole('button', { name: /auto refresh/i });
    
    // Should start enabled (green text)
    expect(autoRefreshButton).toHaveClass('text-green-600');
    
    fireEvent.click(autoRefreshButton);
    
    // Should be disabled after click
    expect(autoRefreshButton).not.toHaveClass('text-green-600');
  });

  it('handles manual refresh', async () => {
    render(<JobMonitor />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);
    
    // Should trigger additional fetch
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2); // Initial + manual refresh
    });
  });

  it('displays empty state when no jobs match filters', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        jobs: [],
        stats: {
          total: 0,
          pending: 0,
          running: 0,
          completed: 0,
          failed: 0,
          cancelled: 0
        }
      })
    });

    render(<JobMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('No jobs found matching the current filters.')).toBeInTheDocument();
    });
  });

  it('handles WebSocket messages', async () => {
    const mockWebSocket = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any;

    render(<JobMonitor websocket={mockWebSocket} />);
    
    expect(mockWebSocket.addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
  });

  it('handles API errors gracefully', async () => {
    (fetch as any).mockRejectedValue(new Error('API Error'));
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<JobMonitor />);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch jobs:',
        expect.any(Error)
      );
    });
    
    consoleSpy.mockRestore();
  });

  it('displays queue visualization correctly', async () => {
    render(<JobMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('Queue Status')).toBeInTheDocument();
      expect(screen.getByText('Queue Depth')).toBeInTheDocument();
      expect(screen.getByText('Active Jobs')).toBeInTheDocument();
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
      
      // Check queue depth calculation (pending + running)
      expect(screen.getByText('1')).toBeInTheDocument(); // running jobs = active jobs
      
      // Check success rate calculation
      expect(screen.getByText('50%')).toBeInTheDocument(); // 1 completed / (1 completed + 1 failed) = 50%
    });
  });
});