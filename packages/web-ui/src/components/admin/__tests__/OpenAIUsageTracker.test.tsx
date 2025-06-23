import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OpenAIUsageTracker } from '../OpenAIUsageTracker';

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
  subDays: vi.fn(() => new Date()),
  subWeeks: vi.fn(() => new Date()),
  subMonths: vi.fn(() => new Date()),
  startOfDay: vi.fn(() => new Date()),
  endOfDay: vi.fn(() => new Date())
}));

const mockUsageStats = {
  totalTokens: 150000,
  totalCost: 12.50,
  totalRequests: 125,
  averageTokensPerRequest: 1200,
  costPerToken: 0.0000833,
  dailyUsage: [
    { timestamp: '2024-01-01T10:00:00Z', tokens: 5000, cost: 0.42, requests: 4 },
    { timestamp: '2024-01-01T11:00:00Z', tokens: 7500, cost: 0.63, requests: 6 },
    { timestamp: '2024-01-01T12:00:00Z', tokens: 3000, cost: 0.25, requests: 2 }
  ],
  weeklyUsage: [],
  monthlyUsage: []
};

const mockRateLimits = {
  requestsPerMinute: 25,
  tokensPerMinute: 45000,
  currentRequestRate: 15,
  currentTokenRate: 28000,
  requestLimit: 3000,
  tokenLimit: 250000
};

const mockBudget = {
  dailyBudget: 50,
  weeklyBudget: 300,
  monthlyBudget: 1000,
  dailySpent: 12.50,
  weeklySpent: 45.75,
  monthlySpent: 187.25
};

describe('OpenAIUsageTracker', () => {
  beforeEach(() => {
    // Mock successful API responses
    (fetch as any).mockImplementation((url: string) => {
      if (url.includes('/usage')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsageStats)
        });
      }
      if (url.includes('/rate-limits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRateLimits)
        });
      }
      if (url.includes('/budget')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBudget)
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

  it('renders usage tracker with header and controls', async () => {
    render(<OpenAIUsageTracker />);
    
    expect(screen.getByRole('heading', { name: /openai usage tracker/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auto refresh/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('displays key metrics cards', async () => {
    render(<OpenAIUsageTracker />);
    
    await waitFor(() => {
      expect(screen.getByText('Total Tokens Used')).toBeInTheDocument();
      expect(screen.getByText('150.0K')).toBeInTheDocument();
      
      expect(screen.getByText('Total Cost')).toBeInTheDocument();
      expect(screen.getByText('$12.5000')).toBeInTheDocument();
      
      expect(screen.getByText('Total Requests')).toBeInTheDocument();
      expect(screen.getByText('125')).toBeInTheDocument();
    });
  });

  it('displays budget progress correctly', async () => {
    render(<OpenAIUsageTracker />);
    
    await waitFor(() => {
      expect(screen.getByText('Budget Progress')).toBeInTheDocument();
      expect(screen.getByText('Daily Budget')).toBeInTheDocument();
      expect(screen.getByText('Weekly Budget')).toBeInTheDocument();
      expect(screen.getByText('Monthly Budget')).toBeInTheDocument();
      
      // Check budget percentages (12.50/50 = 25%)
      expect(screen.getByText('25.0%')).toBeInTheDocument();
      // Check budget amounts
      expect(screen.getByText('$12.5000')).toBeInTheDocument();
      expect(screen.getByText('/ $50.0000')).toBeInTheDocument();
    });
  });

  it('displays rate limits correctly', async () => {
    render(<OpenAIUsageTracker />);
    
    await waitFor(() => {
      expect(screen.getByText('Rate Limits')).toBeInTheDocument();
      expect(screen.getByText('Requests per Minute')).toBeInTheDocument();
      expect(screen.getByText('Tokens per Minute')).toBeInTheDocument();
      
      // Check rate limit values
      expect(screen.getByText('15')).toBeInTheDocument(); // current request rate
      expect(screen.getByText('/ 3000')).toBeInTheDocument(); // request limit
      expect(screen.getByText('28.0K')).toBeInTheDocument(); // current token rate
      expect(screen.getByText('/ 250.0K')).toBeInTheDocument(); // token limit
    });
  });

  it('switches between time ranges for charts', async () => {
    render(<OpenAIUsageTracker />);
    
    await waitFor(() => {
      expect(screen.getByText('Usage Trends')).toBeInTheDocument();
    });

    // Should start with Daily selected
    const dailyButton = screen.getByRole('button', { name: 'Daily' });
    const weeklyButton = screen.getByRole('button', { name: 'Weekly' });
    const monthlyButton = screen.getByRole('button', { name: 'Monthly' });

    expect(dailyButton).toHaveClass('text-white'); // Default variant for selected
    
    // Switch to weekly
    fireEvent.click(weeklyButton);
    expect(weeklyButton).toHaveClass('text-white');
    
    // Switch to monthly
    fireEvent.click(monthlyButton);
    expect(monthlyButton).toHaveClass('text-white');
  });

  it('renders charts when usage data is available', async () => {
    render(<OpenAIUsageTracker />);
    
    await waitFor(() => {
      expect(screen.getByText('Cost Over Time')).toBeInTheDocument();
      expect(screen.getByText('Token Usage')).toBeInTheDocument();
      expect(screen.getByText('Request Volume')).toBeInTheDocument();
      
      // Check that chart components are rendered
      expect(screen.getAllByTestId('responsive-container')).toHaveLength(3);
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  it('shows empty state when no usage data', async () => {
    // Mock empty usage data
    (fetch as any).mockImplementation((url: string) => {
      if (url.includes('/usage')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ...mockUsageStats,
            dailyUsage: [],
            weeklyUsage: [],
            monthlyUsage: []
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRateLimits)
      });
    });

    render(<OpenAIUsageTracker />);
    
    await waitFor(() => {
      expect(screen.getByText('No usage data available for the selected time range.')).toBeInTheDocument();
    });
  });

  it('handles auto refresh toggle', async () => {
    render(<OpenAIUsageTracker />);
    
    const autoRefreshButton = screen.getByRole('button', { name: /auto refresh/i });
    
    // Should start enabled (green text)
    expect(autoRefreshButton).toHaveClass('text-green-600');
    
    fireEvent.click(autoRefreshButton);
    
    // Should be disabled after click
    expect(autoRefreshButton).not.toHaveClass('text-green-600');
  });

  it('handles manual refresh', async () => {
    render(<OpenAIUsageTracker />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);
    
    // Should trigger additional fetch calls
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(6); // 3 initial + 3 manual refresh
    });
  });

  it('formats currency correctly', async () => {
    render(<OpenAIUsageTracker />);
    
    await waitFor(() => {
      // Should display currency with 4 decimal places for small amounts
      expect(screen.getByText('$12.5000')).toBeInTheDocument();
      expect(screen.getByText('$0.0001')).toBeInTheDocument(); // cost per token
    });
  });

  it('formats large numbers correctly', async () => {
    render(<OpenAIUsageTracker />);
    
    await waitFor(() => {
      expect(screen.getByText('150.0K')).toBeInTheDocument(); // 150,000 tokens
      expect(screen.getByText('1.2K')).toBeInTheDocument(); // 1,200 avg tokens per request
    });
  });

  it('shows correct budget alert statuses', async () => {
    // Mock high budget usage
    const highBudgetUsage = {
      ...mockBudget,
      dailySpent: 47.5, // 95% of daily budget
      weeklySpent: 240, // 80% of weekly budget
      monthlySpent: 750 // 75% of monthly budget
    };

    (fetch as any).mockImplementation((url: string) => {
      if (url.includes('/budget')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(highBudgetUsage)
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(url.includes('/usage') ? mockUsageStats : mockRateLimits)
      });
    });

    render(<OpenAIUsageTracker />);
    
    await waitFor(() => {
      // Should show high percentage for daily budget
      expect(screen.getByText('95.0%')).toBeInTheDocument();
      expect(screen.getByText('80.0%')).toBeInTheDocument();
      expect(screen.getByText('75.0%')).toBeInTheDocument();
    });
  });

  it('shows correct rate limit alert statuses', async () => {
    // Mock high rate limit usage
    const highRateLimits = {
      ...mockRateLimits,
      currentRequestRate: 2400, // 80% of request limit
      currentTokenRate: 200000 // 80% of token limit
    };

    (fetch as any).mockImplementation((url: string) => {
      if (url.includes('/rate-limits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(highRateLimits)
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(url.includes('/usage') ? mockUsageStats : mockBudget)
      });
    });

    render(<OpenAIUsageTracker />);
    
    await waitFor(() => {
      // Should show high percentages for rate limits
      expect(screen.getByText('80.0%')).toBeInTheDocument();
      expect(screen.getByText('200.0K')).toBeInTheDocument(); // formatted current token rate
    });
  });

  it('handles WebSocket messages', async () => {
    const mockWebSocket = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any;

    render(<OpenAIUsageTracker websocket={mockWebSocket} />);
    
    expect(mockWebSocket.addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
  });

  it('handles API errors gracefully', async () => {
    (fetch as any).mockRejectedValue(new Error('API Error'));
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<OpenAIUsageTracker />);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch OpenAI usage data:',
        expect.any(Error)
      );
    });
    
    consoleSpy.mockRestore();
  });

  it('displays last updated timestamp', async () => {
    render(<OpenAIUsageTracker />);
    
    await waitFor(() => {
      expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
      expect(screen.getByText('Jan 01, 2024 10:30:00')).toBeInTheDocument();
    });
  });

  it('calculates averages correctly in metrics display', async () => {
    render(<OpenAIUsageTracker />);
    
    await waitFor(() => {
      expect(screen.getByText('Avg: 1.2K per request')).toBeInTheDocument();
      expect(screen.getByText('$0.0001 per token')).toBeInTheDocument();
    });
  });
});