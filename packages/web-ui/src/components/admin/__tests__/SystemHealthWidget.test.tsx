import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SystemHealthWidget } from '../SystemHealthWidget';

// Mock fetch globally
global.fetch = vi.fn();

const mockHealthData = {
  cpu: 45.2,
  memory: 62.8,
  disk: 78.5,
  queue: {
    depth: 15,
    processing: 3,
    failed: 2
  }
};

describe('SystemHealthWidget', () => {
  beforeEach(() => {
    // Mock successful API response
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHealthData)
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders system health widget with loading state initially', () => {
    render(<SystemHealthWidget />);
    
    // Should show loading spinner
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays system health metrics after loading', async () => {
    render(<SystemHealthWidget />);
    
    await waitFor(() => {
      expect(screen.getByText('System Health')).toBeInTheDocument();
      expect(screen.getByText('45.2%')).toBeInTheDocument(); // CPU
      expect(screen.getByText('62.8%')).toBeInTheDocument(); // Memory
      expect(screen.getByText('78.5%')).toBeInTheDocument(); // Disk
    });
  });

  it('shows healthy status for normal metrics', async () => {
    render(<SystemHealthWidget />);
    
    await waitFor(() => {
      expect(screen.getByText('Healthy')).toBeInTheDocument();
      const badge = screen.getByText('Healthy').closest('.bg-green-100');
      expect(badge).toBeInTheDocument();
    });
  });

  it('shows warning status for high resource usage', async () => {
    const warningData = {
      ...mockHealthData,
      cpu: 80.0, // Above warning threshold
      memory: 76.0
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(warningData)
    });

    render(<SystemHealthWidget />);
    
    await waitFor(() => {
      expect(screen.getByText('Warning')).toBeInTheDocument();
      const badge = screen.getByText('Warning').closest('.bg-yellow-100');
      expect(badge).toBeInTheDocument();
    });
  });

  it('shows critical status for very high resource usage', async () => {
    const criticalData = {
      ...mockHealthData,
      cpu: 92.0, // Above critical threshold
      memory: 91.0,
      queue: {
        depth: 15,
        processing: 3,
        failed: 12 // High failure count
      }
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(criticalData)
    });

    render(<SystemHealthWidget />);
    
    await waitFor(() => {
      expect(screen.getByText('Critical')).toBeInTheDocument();
      const badge = screen.getByText('Critical').closest('.bg-red-100');
      expect(badge).toBeInTheDocument();
    });
  });

  it('displays queue metrics correctly', async () => {
    render(<SystemHealthWidget />);
    
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument(); // Queue depth
      expect(screen.getByText('3')).toBeInTheDocument(); // Active jobs
      expect(screen.getByText('2')).toBeInTheDocument(); // Failed jobs
      expect(screen.getByText('Queue Depth')).toBeInTheDocument();
      expect(screen.getByText('Active Jobs')).toBeInTheDocument();
      expect(screen.getByText('Failed Jobs')).toBeInTheDocument();
    });
  });

  it('renders compact view when compact prop is true', async () => {
    render(<SystemHealthWidget compact />);
    
    await waitFor(() => {
      expect(screen.getByText('System Health')).toBeInTheDocument();
      expect(screen.getByText('CPU')).toBeInTheDocument();
      expect(screen.getByText('Memory')).toBeInTheDocument();
      expect(screen.getByText('Queue')).toBeInTheDocument();
      expect(screen.getByText('15 jobs')).toBeInTheDocument();
      expect(screen.getByText('3 active')).toBeInTheDocument();
    });
  });

  it('shows failed jobs indicator in compact view when there are failures', async () => {
    render(<SystemHealthWidget compact />);
    
    await waitFor(() => {
      expect(screen.getByText('• 2 failed')).toBeInTheDocument();
    });
  });

  it('hides failed jobs indicator when no failures', async () => {
    const noFailuresData = {
      ...mockHealthData,
      queue: {
        depth: 15,
        processing: 3,
        failed: 0
      }
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(noFailuresData)
    });

    render(<SystemHealthWidget compact />);
    
    await waitFor(() => {
      expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
    });
  });

  it('shows progress bars with correct colors', async () => {
    render(<SystemHealthWidget />);
    
    await waitFor(() => {
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(3); // CPU, Memory, Disk
      
      // CPU at 45.2% should be green
      expect(progressBars[0].querySelector('.bg-green-500')).toBeInTheDocument();
      
      // Memory at 62.8% should be green
      expect(progressBars[1].querySelector('.bg-green-500')).toBeInTheDocument();
      
      // Disk at 78.5% should be yellow (warning)
      expect(progressBars[2].querySelector('.bg-yellow-500')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    (fetch as any).mockRejectedValue(new Error('API Error'));
    
    render(<SystemHealthWidget />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load system health')).toBeInTheDocument();
      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    });
  });

  it('handles WebSocket messages', async () => {
    const mockWebSocket = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any;

    render(<SystemHealthWidget websocket={mockWebSocket} />);
    
    expect(mockWebSocket.addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
  });

  it('updates metrics when receiving WebSocket message', async () => {
    const mockWebSocket = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any;

    render(<SystemHealthWidget websocket={mockWebSocket} />);
    
    await waitFor(() => {
      expect(screen.getByText('45.2%')).toBeInTheDocument();
    });

    // Get the message handler
    const messageHandler = mockWebSocket.addEventListener.mock.calls[0][1];
    
    // Simulate WebSocket message with updated metrics
    const updatedData = {
      type: 'system:health',
      data: {
        cpu: 55.5,
        memory: 70.0,
        disk: 80.0,
        queue: {
          depth: 20,
          processing: 5,
          failed: 3
        }
      }
    };

    messageHandler({ data: JSON.stringify(updatedData) });

    await waitFor(() => {
      expect(screen.getByText('55.5%')).toBeInTheDocument(); // Updated CPU
      expect(screen.getByText('70.0%')).toBeInTheDocument(); // Updated Memory
      expect(screen.getByText('20')).toBeInTheDocument(); // Updated queue depth
    });
  });

  it('displays last updated timestamp', async () => {
    render(<SystemHealthWidget />);
    
    await waitFor(() => {
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });

  it('refreshes data periodically', async () => {
    vi.useFakeTimers();
    
    render(<SystemHealthWidget />);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    // Fast forward 30 seconds
    vi.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });

  it('cleans up interval on unmount', async () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    
    const { unmount } = render(<SystemHealthWidget />);
    
    await waitFor(() => {
      expect(screen.getByText('System Health')).toBeInTheDocument();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    
    clearIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it('handles missing queue data gracefully', async () => {
    const noQueueData = {
      cpu: 45.2,
      memory: 62.8,
      disk: 78.5
      // No queue data
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(noQueueData)
    });

    render(<SystemHealthWidget />);
    
    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument(); // Queue depth defaults to 0
      expect(screen.getByText('Healthy')).toBeInTheDocument(); // Should still calculate status
    });
  });

  it('handles API response with non-ok status', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden'
    });

    render(<SystemHealthWidget />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load system health')).toBeInTheDocument();
    });
  });

  it('handles invalid WebSocket messages gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockWebSocket = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any;

    render(<SystemHealthWidget websocket={mockWebSocket} />);
    
    const messageHandler = mockWebSocket.addEventListener.mock.calls[0][1];
    
    // Send invalid JSON
    messageHandler({ data: 'invalid json' });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to parse WebSocket message:',
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });
});