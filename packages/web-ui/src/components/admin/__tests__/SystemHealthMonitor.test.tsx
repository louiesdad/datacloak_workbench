import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SystemHealthMonitor } from '../SystemHealthMonitor';

// Mock fetch globally
global.fetch = vi.fn();

// Mock recharts
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  Area: () => <div data-testid="area" />,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date, formatStr) => {
    if (formatStr.includes('HH:mm')) return '10:30';
    if (formatStr.includes('MMM dd')) return 'Jan 01';
    return 'Jan 01, 2024 10:30:00';
  }),
  subMinutes: vi.fn(() => new Date()),
  subHours: vi.fn(() => new Date()),
  subDays: vi.fn(() => new Date())
}));

const mockSystemMetrics = {
  cpu: 45.2,
  memory: 62.8,
  disk: 78.5,
  uptime: 86400, // 24 hours in seconds
  connections: {
    active: 25,
    total: 100,
    websocket: 12
  },
  database: {
    connections: 8,
    queries: 1250,
    avgResponseTime: 45.6
  },
  queue: {
    depth: 15,
    processing: 3,
    failed: 2
  },
  network: {
    bytesIn: 1024000,
    bytesOut: 2048000,
    packetsIn: 5000,
    packetsOut: 7500
  },
  alerts: [
    {
      id: 'cpu-high',
      type: 'warning' as const,
      message: 'CPU usage is high',
      timestamp: '2024-01-01T10:00:00Z'
    }
  ],
  historicalData: [
    {
      timestamp: '2024-01-01T10:00:00Z',
      cpu: 40.0,
      memory: 60.0,
      disk: 75.0,
      connections: 20,
      queueDepth: 10
    },
    {
      timestamp: '2024-01-01T10:05:00Z',
      cpu: 45.2,
      memory: 62.8,
      disk: 78.5,
      connections: 25,
      queueDepth: 15
    }
  ]
};

describe('SystemHealthMonitor', () => {
  beforeEach(() => {
    // Mock successful API response
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSystemMetrics)
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders system health monitor with header and controls', async () => {
    render(<SystemHealthMonitor />);
    
    expect(screen.getByRole('heading', { name: /system health monitor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auto refresh/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('displays system metrics cards', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('CPU Usage')).toBeInTheDocument();
      expect(screen.getByText('45.2%')).toBeInTheDocument();
      
      expect(screen.getByText('Memory Usage')).toBeInTheDocument();
      expect(screen.getByText('62.8%')).toBeInTheDocument();
      
      expect(screen.getByText('Disk Usage')).toBeInTheDocument();
      expect(screen.getByText('78.5%')).toBeInTheDocument();
    });
  });

  it('displays system uptime correctly', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('System Uptime')).toBeInTheDocument();
      expect(screen.getByText('1d 0h 0m')).toBeInTheDocument(); // 86400 seconds = 24 hours
    });
  });

  it('shows connection metrics', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('Active Connections')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('/ 100')).toBeInTheDocument();
      
      expect(screen.getByText('WebSocket Connections')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });
  });

  it('displays database metrics', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('Database Connections')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      
      expect(screen.getByText('Database Queries')).toBeInTheDocument();
      expect(screen.getByText('1,250')).toBeInTheDocument();
      
      expect(screen.getByText('Avg Response Time')).toBeInTheDocument();
      expect(screen.getByText('45.6ms')).toBeInTheDocument();
    });
  });

  it('shows queue metrics', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('Queue Depth')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      
      expect(screen.getByText('Processing Jobs')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      
      expect(screen.getByText('Failed Jobs')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('displays network metrics', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('Network In')).toBeInTheDocument();
      expect(screen.getByText('1.0 MB')).toBeInTheDocument(); // 1024000 bytes
      
      expect(screen.getByText('Network Out')).toBeInTheDocument();
      expect(screen.getByText('2.0 MB')).toBeInTheDocument(); // 2048000 bytes
    });
  });

  it('shows system health status with correct colors', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      // Should show warning status due to high CPU (>80% would be critical)
      const healthStatus = screen.getByText(/system status/i);
      expect(healthStatus).toBeInTheDocument();
    });
  });

  it('displays system alerts', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('System Alerts')).toBeInTheDocument();
      expect(screen.getByText('CPU usage is high')).toBeInTheDocument();
    });
  });

  it('renders performance charts when historical data is available', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('Performance Trends')).toBeInTheDocument();
      expect(screen.getByText('CPU & Memory Usage')).toBeInTheDocument();
      expect(screen.getByText('Connections & Queue')).toBeInTheDocument();
      
      // Check that chart components are rendered
      expect(screen.getAllByTestId('responsive-container')).toHaveLength(2);
      expect(screen.getAllByTestId('area-chart')).toHaveLength(2);
    });
  });

  it('shows correct health status badge colors', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      // Should show healthy status (green) for moderate usage
      const healthBadge = screen.getByText('Healthy');
      expect(healthBadge).toHaveClass('bg-green-100', 'text-green-800');
    });
  });

  it('displays warning status for high resource usage', async () => {
    // Mock high resource usage
    const highUsageMetrics = {
      ...mockSystemMetrics,
      cpu: 85.0,
      memory: 88.0,
      disk: 92.0
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(highUsageMetrics)
    });

    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('85.0%')).toBeInTheDocument(); // CPU
      expect(screen.getByText('88.0%')).toBeInTheDocument(); // Memory
      expect(screen.getByText('92.0%')).toBeInTheDocument(); // Disk
    });
  });

  it('handles auto refresh toggle', async () => {
    render(<SystemHealthMonitor />);
    
    const autoRefreshButton = screen.getByRole('button', { name: /auto refresh/i });
    
    // Should start enabled (green text)
    expect(autoRefreshButton).toHaveClass('text-green-600');
    
    fireEvent.click(autoRefreshButton);
    
    // Should be disabled after click
    expect(autoRefreshButton).not.toHaveClass('text-green-600');
  });

  it('handles manual refresh', async () => {
    render(<SystemHealthMonitor />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);
    
    // Should trigger additional fetch call
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2); // Initial + manual refresh
    });
  });

  it('formats bytes correctly', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('1.0 MB')).toBeInTheDocument(); // 1024000 bytes
      expect(screen.getByText('2.0 MB')).toBeInTheDocument(); // 2048000 bytes
    });
  });

  it('formats uptime correctly', async () => {
    // Test different uptime values
    const uptimeMetrics = {
      ...mockSystemMetrics,
      uptime: 3661 // 1 hour, 1 minute, 1 second
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(uptimeMetrics)
    });

    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('1h 1m')).toBeInTheDocument();
    });
  });

  it('shows empty state when no historical data', async () => {
    const noHistoryMetrics = {
      ...mockSystemMetrics,
      historicalData: []
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(noHistoryMetrics)
    });

    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('No historical data available.')).toBeInTheDocument();
    });
  });

  it('shows empty state when no alerts', async () => {
    const noAlertsMetrics = {
      ...mockSystemMetrics,
      alerts: []
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(noAlertsMetrics)
    });

    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('No active alerts.')).toBeInTheDocument();
    });
  });

  it('handles WebSocket messages', async () => {
    const mockWebSocket = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any;

    render(<SystemHealthMonitor websocket={mockWebSocket} />);
    
    expect(mockWebSocket.addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
  });

  it('handles API errors gracefully', async () => {
    (fetch as any).mockRejectedValue(new Error('API Error'));
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch system metrics:',
        expect.any(Error)
      );
    });
    
    consoleSpy.mockRestore();
  });

  it('displays last updated timestamp', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
      expect(screen.getByText('Jan 01, 2024 10:30:00')).toBeInTheDocument();
    });
  });

  it('calculates system health status correctly', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      // With moderate usage (CPU: 45.2%, Memory: 62.8%, Disk: 78.5%)
      // Should be "Healthy" status
      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });
  });

  it('shows progress bars for resource usage', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      // Should show progress bars for CPU, Memory, Disk usage
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(3); // CPU, Memory, Disk
    });
  });

  it('displays time range selector for charts', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1H' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '6H' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '24H' })).toBeInTheDocument();
    });
  });

  it('switches between time ranges for charts', async () => {
    render(<SystemHealthMonitor />);
    
    await waitFor(() => {
      expect(screen.getByText('Performance Trends')).toBeInTheDocument();
    });

    // Should start with 1H selected
    const oneHourButton = screen.getByRole('button', { name: '1H' });
    const sixHourButton = screen.getByRole('button', { name: '6H' });
    const twentyFourHourButton = screen.getByRole('button', { name: '24H' });

    expect(oneHourButton).toHaveClass('text-white'); // Default variant for selected
    
    // Switch to 6H
    fireEvent.click(sixHourButton);
    expect(sixHourButton).toHaveClass('text-white');
    
    // Switch to 24H
    fireEvent.click(twentyFourHourButton);
    expect(twentyFourHourButton).toHaveClass('text-white');
  });
});