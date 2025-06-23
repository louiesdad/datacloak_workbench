import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnhancedAdminDashboard } from '../EnhancedAdminDashboard';

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

const mockToken = 'test-token-123';
const mockOnLogout = vi.fn();

describe('EnhancedAdminDashboard', () => {
  beforeEach(() => {
    // Mock successful API responses
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    });

    // Mock WebSocket
    global.WebSocket = vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard with header and navigation', async () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jobs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /usage/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /config/i })).toBeInTheDocument();
  });

  it('shows mobile menu toggle on small screens', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    const mobileMenuButton = screen.getByLabelText('Toggle mobile menu');
    expect(mobileMenuButton).toBeInTheDocument();
  });

  it('displays theme toggle button', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    const themeButton = screen.getByLabelText('Toggle theme');
    expect(themeButton).toBeInTheDocument();
  });

  it('displays logout button', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    expect(logoutButton).toBeInTheDocument();
  });

  it('calls onLogout when logout button is clicked', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutButton);
    
    expect(mockOnLogout).toHaveBeenCalledTimes(1);
  });

  it('switches between dashboard views when navigation buttons are clicked', async () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    // Initially should show Overview
    expect(screen.getByText('System Overview')).toBeInTheDocument();
    
    // Click on Jobs view
    const jobsButton = screen.getByRole('button', { name: /jobs/i });
    fireEvent.click(jobsButton);
    
    await waitFor(() => {
      expect(screen.getByText('Job Monitor')).toBeInTheDocument();
    });
    
    // Click on Usage view
    const usageButton = screen.getByRole('button', { name: /usage/i });
    fireEvent.click(usageButton);
    
    await waitFor(() => {
      expect(screen.getByText('OpenAI Usage Tracker')).toBeInTheDocument();
    });
    
    // Click on System view
    const systemButton = screen.getByRole('button', { name: /system/i });
    fireEvent.click(systemButton);
    
    await waitFor(() => {
      expect(screen.getByText('System Health Monitor')).toBeInTheDocument();
    });
    
    // Click on Config view
    const configButton = screen.getByRole('button', { name: /config/i });
    fireEvent.click(configButton);
    
    await waitFor(() => {
      expect(screen.getByText('Configuration Panel')).toBeInTheDocument();
    });
  });

  it('toggles mobile sidebar when menu button is clicked', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    const mobileMenuButton = screen.getByLabelText('Toggle mobile menu');
    
    // Initially, sidebar should be hidden on mobile (we can check for classes)
    const sidebar = screen.getByRole('navigation');
    expect(sidebar).toHaveClass('-translate-x-full'); // Hidden on mobile
    
    // Click to show sidebar
    fireEvent.click(mobileMenuButton);
    expect(sidebar).not.toHaveClass('-translate-x-full'); // Shown on mobile
    
    // Click again to hide sidebar
    fireEvent.click(mobileMenuButton);
    expect(sidebar).toHaveClass('-translate-x-full'); // Hidden again
  });

  it('cycles through theme options when theme button is clicked', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    const themeButton = screen.getByLabelText('Toggle theme');
    
    // Should start with system theme (showing monitor icon)
    expect(screen.getByTestId('monitor-icon')).toBeInTheDocument();
    
    // Click to switch to light theme
    fireEvent.click(themeButton);
    expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
    
    // Click to switch to dark theme
    fireEvent.click(themeButton);
    expect(screen.getByTestId('moon-icon')).toBeInTheDocument();
    
    // Click to switch back to system theme
    fireEvent.click(themeButton);
    expect(screen.getByTestId('monitor-icon')).toBeInTheDocument();
  });

  it('applies dark theme class when dark theme is selected', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    const themeButton = screen.getByLabelText('Toggle theme');
    
    // Click twice to get to dark theme
    fireEvent.click(themeButton); // light
    fireEvent.click(themeButton); // dark
    
    // Check that dark class is applied to document element
    expect(document.documentElement).toHaveClass('dark');
  });

  it('removes dark theme class when light theme is selected', () => {
    // Start with dark theme
    document.documentElement.classList.add('dark');
    
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    const themeButton = screen.getByLabelText('Toggle theme');
    
    // Click to get to light theme
    fireEvent.click(themeButton);
    
    // Check that dark class is removed
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('shows connection status indicator', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    // Should show connection status (connected or connecting)
    const connectionStatus = screen.getByText(/connected|connecting|disconnected/i);
    expect(connectionStatus).toBeInTheDocument();
  });

  it('shows notification bell icon', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    const notificationBell = screen.getByTestId('bell-icon');
    expect(notificationBell).toBeInTheDocument();
  });

  it('highlights active navigation item', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    // Overview should be active by default
    const overviewButton = screen.getByRole('button', { name: /overview/i });
    expect(overviewButton).toHaveClass('bg-blue-100'); // Active state
    
    // Click on Jobs and check it becomes active
    const jobsButton = screen.getByRole('button', { name: /jobs/i });
    fireEvent.click(jobsButton);
    
    expect(jobsButton).toHaveClass('bg-blue-100'); // Now active
    expect(overviewButton).not.toHaveClass('bg-blue-100'); // No longer active
  });

  it('displays user information in header', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    // Should show admin user info
    expect(screen.getByText('Administrator')).toBeInTheDocument();
  });

  it('shows responsive layout classes', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    const mainContent = screen.getByRole('main');
    expect(mainContent).toHaveClass('lg:ml-64'); // Responsive margin for large screens
    
    const sidebar = screen.getByRole('navigation');
    expect(sidebar).toHaveClass('lg:translate-x-0'); // Always visible on large screens
  });

  it('handles missing token gracefully', () => {
    render(<EnhancedAdminDashboard onLogout={mockOnLogout} />);
    
    // Should still render the basic layout
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });

  it('manages document title', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    // Should set document title
    expect(document.title).toContain('Admin Dashboard');
  });

  it('handles window resize events for mobile menu', () => {
    render(<EnhancedAdminDashboard token={mockToken} onLogout={mockOnLogout} />);
    
    const mobileMenuButton = screen.getByLabelText('Toggle mobile menu');
    const sidebar = screen.getByRole('navigation');
    
    // Open mobile menu
    fireEvent.click(mobileMenuButton);
    expect(sidebar).not.toHaveClass('-translate-x-full');
    
    // Simulate window resize to large screen
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    });
    
    fireEvent(window, new Event('resize'));
    
    // Mobile menu should close on large screens
    expect(sidebar).toHaveClass('lg:translate-x-0');
  });
});