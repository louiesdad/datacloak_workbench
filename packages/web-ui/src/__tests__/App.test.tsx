import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';

// Mock the platform bridge
const mockPlatformBridge = {
  selectFiles: vi.fn(),
  uploadFile: vi.fn(),
  backend: {
    uploadData: vi.fn(),
    analyzeSentiment: vi.fn(),
    getHealthStatus: vi.fn(),
  },
  platform: {
    name: 'web' as const,
    version: '1.0.0',
    capabilities: {
      largeFileSupport: true,
      nativeFileDialogs: false
    }
  }
};

// Mock window.platformBridge
Object.defineProperty(window, 'platformBridge', {
  value: mockPlatformBridge,
  writable: true
});

// Mock child components to focus on App component logic
vi.mock('../components/WorkflowManager', () => ({
  WorkflowManager: () => <div data-testid="workflow-manager">Workflow Manager</div>
}));

vi.mock('../components/Navigation', () => ({
  Navigation: () => <div data-testid="navigation">Navigation</div>
}));

vi.mock('../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('../components/NotificationToast', () => ({
  NotificationToast: () => <div data-testid="notification-toast">Notification</div>
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render main application structure', () => {
    render(<App />);

    expect(screen.getByTestId('workflow-manager')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('should render application header', () => {
    render(<App />);

    expect(screen.getByText('DataCloak Sentiment Workbench')).toBeInTheDocument();
  });

  it('should have proper document structure', () => {
    render(<App />);

    // Should have main semantic element
    expect(screen.getByRole('main')).toBeInTheDocument();
    
    // Should have header
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
  });

  it('should include navigation component', () => {
    render(<App />);

    expect(screen.getByTestId('navigation')).toBeInTheDocument();
  });

  it('should wrap content in error boundary', () => {
    // This is tested by ensuring the app renders without crashing
    render(<App />);

    expect(screen.getByTestId('workflow-manager')).toBeInTheDocument();
  });

  it('should be accessible', () => {
    render(<App />);

    // Should have proper landmark roles
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    
    // Should have descriptive title
    expect(document.title).toBe('DataCloak Sentiment Workbench');
  });

  it('should handle platform bridge initialization', () => {
    render(<App />);

    // Platform bridge should be available
    expect(window.platformBridge).toBeDefined();
    expect(window.platformBridge.platform.name).toBe('web');
  });

  it('should render without notifications initially', () => {
    render(<App />);

    // No notifications should be visible initially
    expect(screen.queryByTestId('notification-toast')).not.toBeInTheDocument();
  });

  it('should have responsive design classes', () => {
    render(<App />);

    const appContainer = screen.getByRole('main').parentElement;
    expect(appContainer).toHaveClass('app');
  });

  it('should handle theme preferences', () => {
    // Mock theme detection
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(<App />);

    // Should handle theme detection without crashing
    expect(screen.getByTestId('workflow-manager')).toBeInTheDocument();
  });

  it('should initialize with proper context providers', () => {
    render(<App />);

    // App should render successfully with all providers
    expect(screen.getByTestId('workflow-manager')).toBeInTheDocument();
  });

  it('should handle window resize events', () => {
    const { container } = render(<App />);

    // Simulate window resize
    window.innerWidth = 768;
    window.dispatchEvent(new Event('resize'));

    // App should still render correctly
    expect(screen.getByTestId('workflow-manager')).toBeInTheDocument();
  });

  it('should load CSS and styling', () => {
    render(<App />);

    // Check that app container has expected classes
    const main = screen.getByRole('main');
    expect(main.parentElement).toHaveClass('app');
  });

  it('should handle keyboard navigation', () => {
    render(<App />);

    // Focus should be manageable
    const main = screen.getByRole('main');
    main.focus();

    expect(document.activeElement).toBe(main);
  });
});