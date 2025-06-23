import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AdminDashboardProvider, useAdminDashboard } from '../AdminDashboardContext';

// Mock fetch globally
global.fetch = vi.fn();

// Mock WebSocket
const mockWebSocket = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  onopen: null as any,
  onmessage: null as any,
  onerror: null as any,
  onclose: null as any
};

global.WebSocket = vi.fn().mockImplementation(() => mockWebSocket);

// Test component that uses the context
const TestComponent: React.FC = () => {
  const { state, actions } = useAdminDashboard();
  
  return (
    <div>
      <div data-testid="connection-status">{state.connectionStatus}</div>
      <div data-testid="auto-refresh">{state.autoRefresh.toString()}</div>
      <div data-testid="notifications-count">{state.notifications.length}</div>
      <div data-testid="job-metrics-total">{state.metrics.jobs.total}</div>
      <div data-testid="usage-metrics-total-cost">{state.metrics.usage.totalCost}</div>
      <div data-testid="system-metrics-cpu">{state.metrics.system.cpu}</div>
      <button onClick={() => actions.fetchJobMetrics()}>Fetch Jobs</button>
      <button onClick={() => actions.fetchUsageMetrics()}>Fetch Usage</button>
      <button onClick={() => actions.fetchSystemMetrics()}>Fetch System</button>
      <button onClick={() => actions.addNotification({ 
        type: 'info', 
        title: 'Test', 
        message: 'Test notification',
        read: false
      })}>Add Notification</button>
    </div>
  );
};

// Test component that should throw when used outside provider
const TestComponentOutsideProvider: React.FC = () => {
  try {
    useAdminDashboard();
    return <div>Should not render</div>;
  } catch (error) {
    return <div data-testid="error">Error: {(error as Error).message}</div>;
  }
};

const mockJobMetrics = {
  total: 25,
  pending: 5,
  running: 3,
  completed: 15,
  failed: 2,
  cancelled: 0
};

const mockUsageMetrics = {
  totalTokens: 150000,
  totalCost: 12.50,
  totalRequests: 125,
  dailyBudget: 50,
  weeklyBudget: 300,
  monthlyBudget: 1000,
  dailySpent: 12.50,
  weeklySpent: 45.75,
  monthlySpent: 187.25
};

const mockSystemMetrics = {
  cpu: 45.2,
  memory: 62.8,
  disk: 78.5,
  uptime: 86400,
  status: 'healthy' as const
};

describe('AdminDashboardContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API responses
    (fetch as any).mockImplementation((url: string) => {
      if (url.includes('/jobs/metrics')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockJobMetrics)
        });
      }
      if (url.includes('/openai/metrics')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsageMetrics)
        });
      }
      if (url.includes('/system/metrics')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSystemMetrics)
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('provides initial state correctly', () => {
    render(
      <AdminDashboardProvider>
        <TestComponent />
      </AdminDashboardProvider>
    );

    expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected');
    expect(screen.getByTestId('auto-refresh')).toHaveTextContent('true');
    expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
    expect(screen.getByTestId('job-metrics-total')).toHaveTextContent('0');
    expect(screen.getByTestId('usage-metrics-total-cost')).toHaveTextContent('0');
    expect(screen.getByTestId('system-metrics-cpu')).toHaveTextContent('0');
  });

  it('throws error when used outside provider', () => {
    render(<TestComponentOutsideProvider />);
    
    expect(screen.getByTestId('error')).toHaveTextContent(
      'useAdminDashboard must be used within an AdminDashboardProvider'
    );
  });

  it('creates WebSocket connection when token is provided', async () => {
    render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    // Should create WebSocket connection
    expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost/ws');
    
    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('connecting');
    });
  });

  it('automatically fetches metrics on mount with token', async () => {
    render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/jobs/metrics', {
        headers: { 'Authorization': 'Bearer test-token' }
      });
      expect(fetch).toHaveBeenCalledWith('/api/admin/openai/metrics', {
        headers: { 'Authorization': 'Bearer test-token' }
      });
      expect(fetch).toHaveBeenCalledWith('/api/admin/system/metrics', {
        headers: { 'Authorization': 'Bearer test-token' }
      });
    });
  });

  it('updates job metrics when fetchJobMetrics is called', async () => {
    render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    const fetchButton = screen.getByText('Fetch Jobs');
    
    await act(async () => {
      fetchButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('job-metrics-total')).toHaveTextContent('25');
    });
  });

  it('updates usage metrics when fetchUsageMetrics is called', async () => {
    render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    const fetchButton = screen.getByText('Fetch Usage');
    
    await act(async () => {
      fetchButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('usage-metrics-total-cost')).toHaveTextContent('12.5');
    });
  });

  it('updates system metrics when fetchSystemMetrics is called', async () => {
    render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    const fetchButton = screen.getByText('Fetch System');
    
    await act(async () => {
      fetchButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('system-metrics-cpu')).toHaveTextContent('45.2');
    });
  });

  it('adds notifications correctly', async () => {
    render(
      <AdminDashboardProvider>
        <TestComponent />
      </AdminDashboardProvider>
    );

    const addButton = screen.getByText('Add Notification');
    
    await act(async () => {
      addButton.click();
    });

    expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');
  });

  it('handles API errors gracefully', async () => {
    (fetch as any).mockRejectedValue(new Error('API Error'));
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch job metrics:',
        expect.any(Error)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch usage metrics:',
        expect.any(Error)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch system metrics:',
        expect.any(Error)
      );
    });
    
    consoleSpy.mockRestore();
  });

  it('handles WebSocket connection and messages', async () => {
    render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    // Simulate WebSocket open
    await act(async () => {
      mockWebSocket.onopen?.({} as Event);
    });

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('connected');
    });

    // Simulate receiving job metrics via WebSocket
    const jobUpdateMessage = {
      type: 'job:update',
      data: { ...mockJobMetrics, total: 30 }
    };

    await act(async () => {
      mockWebSocket.onmessage?.({
        data: JSON.stringify(jobUpdateMessage)
      } as MessageEvent);
    });

    await waitFor(() => {
      expect(screen.getByTestId('job-metrics-total')).toHaveTextContent('30');
    });
  });

  it('handles WebSocket error and reconnection', async () => {
    render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    // Simulate WebSocket error
    await act(async () => {
      mockWebSocket.onerror?.({} as Event);
    });

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('error');
    });
  });

  it('handles WebSocket close and reconnection', async () => {
    vi.useFakeTimers();
    
    render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    // Simulate WebSocket close (not clean close)
    await act(async () => {
      mockWebSocket.onclose?.({ code: 1006, reason: 'Connection lost' } as CloseEvent);
    });

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected');
    });

    // Fast-forward time to trigger reconnection
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Should attempt to reconnect
    expect(global.WebSocket).toHaveBeenCalledTimes(2);
    
    vi.useRealTimers();
  });

  it('sends authentication and subscription messages on WebSocket open', async () => {
    render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    // Simulate WebSocket open
    await act(async () => {
      mockWebSocket.onopen?.({} as Event);
    });

    expect(mockWebSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'auth',
        token: 'test-token'
      })
    );

    expect(mockWebSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'subscribe',
        topics: ['admin', 'jobs', 'system', 'usage']
      })
    );
  });

  it('handles notification WebSocket messages', async () => {
    render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    // Simulate receiving notification via WebSocket
    const notificationMessage = {
      type: 'notification',
      data: {
        type: 'warning',
        title: 'System Alert',
        message: 'High CPU usage detected',
        read: false
      }
    };

    await act(async () => {
      mockWebSocket.onmessage?.({
        data: JSON.stringify(notificationMessage)
      } as MessageEvent);
    });

    await waitFor(() => {
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');
    });
  });

  it('handles alert WebSocket messages', async () => {
    render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    // Simulate receiving alert via WebSocket
    const alertMessage = {
      type: 'alert',
      data: {
        message: 'Database connection lost'
      }
    };

    await act(async () => {
      mockWebSocket.onmessage?.({
        data: JSON.stringify(alertMessage)
      } as MessageEvent);
    });

    await waitFor(() => {
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');
    });
  });

  it('clears old notifications periodically', async () => {
    vi.useFakeTimers();
    
    const TestComponentWithOldNotification: React.FC = () => {
      const { state, dispatch } = useAdminDashboard();
      
      React.useEffect(() => {
        // Add an old notification (older than 24 hours)
        const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'info',
            title: 'Old Notification',
            message: 'This is old',
            read: false
          }
        });
        
        // Manually set the timestamp to old date (simulate old notification)
        state.notifications[0].timestamp = oldDate;
      }, [dispatch, state.notifications]);
      
      return <div data-testid="notifications-count">{state.notifications.length}</div>;
    };

    render(
      <AdminDashboardProvider>
        <TestComponentWithOldNotification />
      </AdminDashboardProvider>
    );

    // Initially should have 1 notification
    await waitFor(() => {
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');
    });

    // Fast-forward time to trigger cleanup
    await act(async () => {
      vi.advanceTimersByTime(60000); // 1 minute
    });

    // Old notification should be removed
    await waitFor(() => {
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
    });
    
    vi.useRealTimers();
  });

  it('makes API calls without Authorization header when no token provided', async () => {
    render(
      <AdminDashboardProvider>
        <TestComponent />
      </AdminDashboardProvider>
    );

    const fetchButton = screen.getByText('Fetch Jobs');
    
    await act(async () => {
      fetchButton.click();
    });

    expect(fetch).toHaveBeenCalledWith('/api/admin/jobs/metrics', {
      headers: {}
    });
  });

  it('handles invalid JSON in WebSocket messages gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    // Simulate receiving invalid JSON
    await act(async () => {
      mockWebSocket.onmessage?.({
        data: 'invalid json'
      } as MessageEvent);
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to parse WebSocket message:',
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });

  it('disconnects WebSocket on unmount', () => {
    const { unmount } = render(
      <AdminDashboardProvider token="test-token">
        <TestComponent />
      </AdminDashboardProvider>
    );

    unmount();

    expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'User disconnected');
  });
});