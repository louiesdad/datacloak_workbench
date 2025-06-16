import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { WebSocketStatus } from '../WebSocketStatus';
import { useNotifications } from '../NotificationToast';

// Mock the notifications hook
jest.mock('../NotificationToast', () => ({
  useNotifications: jest.fn()
}));

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  
  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    
    // Simulate connection after a delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen({});
      }
    }, 10);
  }

  send(data: string | ArrayBuffer | Blob): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose({ code: code || 1000, reason });
      }
    }, 10);
  }

  ping(): void {
    // Mock ping
  }

  // Test helper methods
  simulateMessage(data: any): void {
    if (this.onmessage) {
      this.onmessage({
        data: typeof data === 'string' ? data : JSON.stringify(data)
      });
    }
  }

  simulateError(error: Error): void {
    if (this.onerror) {
      this.onerror(error);
    }
  }

  simulateClose(code: number = 1000, reason: string = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }
}

// Replace global WebSocket with mock
(global as any).WebSocket = MockWebSocket;

describe('WebSocketStatus', () => {
  let mockAddNotification: jest.Mock;
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAddNotification = jest.fn();
    (useNotifications as jest.Mock).mockReturnValue({
      addNotification: mockAddNotification
    });

    // Capture WebSocket instance when created
    const OriginalWebSocket = (global as any).WebSocket;
    (global as any).WebSocket = class extends OriginalWebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols);
        mockWebSocket = this;
      }
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('rendering', () => {
    it('should render in compact mode', () => {
      render(<WebSocketStatus url="ws://localhost:8000/ws" compact={true} />);
      
      expect(screen.getByTestId('websocket-status-compact')).toBeInTheDocument();
      expect(screen.getByText('WS DISCONNECTED')).toBeInTheDocument();
    });

    it('should render in full mode', () => {
      render(<WebSocketStatus url="ws://localhost:8000/ws" compact={false} />);
      
      expect(screen.getByTestId('websocket-status-panel')).toBeInTheDocument();
      expect(screen.getByText('WebSocket Connection')).toBeInTheDocument();
    });

    it('should expand from compact to full view on click', () => {
      render(<WebSocketStatus url="ws://localhost:8000/ws" compact={true} />);
      
      fireEvent.click(screen.getByTestId('websocket-status-compact'));
      
      expect(screen.getByTestId('websocket-status-panel')).toBeInTheDocument();
    });
  });

  describe('connection management', () => {
    it('should auto-connect when autoConnect is true', async () => {
      render(<WebSocketStatus url="ws://localhost:8000/ws" autoConnect={true} />);
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      await waitFor(() => {
        expect(screen.getByText('CONNECTED')).toBeInTheDocument();
      });

      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'success',
        message: 'WebSocket connection established',
        duration: 3000
      });
    });

    it('should not auto-connect when autoConnect is false', async () => {
      render(<WebSocketStatus url="ws://localhost:8000/ws" autoConnect={false} />);
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      expect(screen.getByText('DISCONNECTED')).toBeInTheDocument();
      expect(mockAddNotification).not.toHaveBeenCalled();
    });

    it('should connect manually when clicking connect button', async () => {
      render(<WebSocketStatus url="ws://localhost:8000/ws" autoConnect={false} />);
      
      fireEvent.click(screen.getByTestId('connect-websocket'));
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      await waitFor(() => {
        expect(screen.getByText('CONNECTED')).toBeInTheDocument();
      });
    });

    it('should disconnect when clicking disconnect button', async () => {
      render(<WebSocketStatus url="ws://localhost:8000/ws" autoConnect={true} />);
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      await waitFor(() => {
        expect(screen.getByText('CONNECTED')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('disconnect-websocket'));
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      await waitFor(() => {
        expect(screen.getByText('DISCONNECTED')).toBeInTheDocument();
      });
    });
  });

  describe('message handling', () => {
    it('should handle incoming messages and emit custom events', async () => {
      const onMessage = jest.fn();
      const customEventListener = jest.fn();
      
      window.addEventListener('websocket:message', customEventListener);
      
      render(
        <WebSocketStatus 
          url="ws://localhost:8000/ws" 
          autoConnect={true}
          onMessage={onMessage}
        />
      );
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      const testMessage = { type: 'test', data: { value: 123 } };
      
      act(() => {
        mockWebSocket.simulateMessage(testMessage);
      });

      await waitFor(() => {
        expect(onMessage).toHaveBeenCalledWith(testMessage);
        expect(customEventListener).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: testMessage
          })
        );
      });

      window.removeEventListener('websocket:message', customEventListener);
    });

    it('should handle heartbeat messages and update latency', async () => {
      render(<WebSocketStatus url="ws://localhost:8000/ws" autoConnect={true} />);
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      const timestamp = Date.now() - 50; // 50ms ago
      
      act(() => {
        mockWebSocket.simulateMessage({
          type: 'heartbeat_response',
          timestamp
        });
      });

      await waitFor(() => {
        // Latency should be displayed (approximately 50ms)
        expect(screen.getByText(/\d+ms/)).toBeInTheDocument();
      });
    });

    it('should track message count', async () => {
      render(<WebSocketStatus url="ws://localhost:8000/ws" autoConnect={true} />);
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      // Send multiple messages
      for (let i = 0; i < 5; i++) {
        act(() => {
          mockWebSocket.simulateMessage({ type: 'test', index: i });
        });
      }

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument(); // Messages Received count
      });
    });
  });

  describe('reconnection', () => {
    it('should attempt reconnection on unexpected disconnect', async () => {
      render(
        <WebSocketStatus 
          url="ws://localhost:8000/ws" 
          autoConnect={true}
          reconnectAttempts={3}
          reconnectInterval={100}
        />
      );
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      await waitFor(() => {
        expect(screen.getByText('CONNECTED')).toBeInTheDocument();
      });

      // Simulate unexpected disconnect
      act(() => {
        mockWebSocket.simulateClose(1006, 'Connection lost');
      });

      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith({
          type: 'warning',
          message: expect.stringContaining('Connection lost. Reconnecting... (1/3)'),
          duration: 3000
        });
      });
    });

    it('should stop reconnecting after max attempts', async () => {
      render(
        <WebSocketStatus 
          url="ws://localhost:8000/ws" 
          autoConnect={true}
          reconnectAttempts={2}
          reconnectInterval={50}
        />
      );
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      // Simulate multiple connection failures
      for (let i = 0; i < 3; i++) {
        act(() => {
          mockWebSocket.simulateClose(1006, 'Connection lost');
        });
        
        await act(async () => {
          jest.advanceTimersByTime(100);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('ERROR')).toBeInTheDocument();
        expect(mockAddNotification).toHaveBeenCalledWith({
          type: 'error',
          message: 'WebSocket connection failed permanently',
          duration: 5000
        });
      });
    });
  });

  describe('metrics and status', () => {
    it('should display connection metrics', async () => {
      render(<WebSocketStatus url="ws://localhost:8000/ws" autoConnect={true} />);
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      expect(screen.getByTestId('connection-metrics')).toBeInTheDocument();
      expect(screen.getByText('Messages Sent:')).toBeInTheDocument();
      expect(screen.getByText('Messages Received:')).toBeInTheDocument();
      expect(screen.getByText('Reconnects:')).toBeInTheDocument();
    });

    it('should update uptime', async () => {
      render(<WebSocketStatus url="ws://localhost:8000/ws" autoConnect={true} />);
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      await waitFor(() => {
        expect(screen.getByText('CONNECTED')).toBeInTheDocument();
      });

      // Advance time to update uptime
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByText(/Uptime: \d+s/)).toBeInTheDocument();
      });
    });

    it('should display message history', async () => {
      render(<WebSocketStatus url="ws://localhost:8000/ws" autoConnect={true} />);
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      // Send a message
      const sendMessage = { type: 'test', data: 'outgoing' };
      act(() => {
        const messageData = JSON.stringify(sendMessage);
        mockWebSocket.send(messageData);
      });

      // Receive a message
      act(() => {
        mockWebSocket.simulateMessage({ type: 'response', data: 'incoming' });
      });

      await waitFor(() => {
        expect(screen.getByTestId('message-history')).toBeInTheDocument();
        expect(screen.getByText(/Recent Messages/)).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should display connection errors', async () => {
      render(<WebSocketStatus url="ws://localhost:8000/ws" autoConnect={true} />);
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      const onError = jest.fn();
      render(<WebSocketStatus url="ws://localhost:8000/ws" onError={onError} />);
      
      const error = new Error('Connection failed');
      act(() => {
        mockWebSocket.simulateError(error);
      });

      await waitFor(() => {
        expect(screen.getByText('ERROR')).toBeInTheDocument();
      });
    });

    it('should handle invalid WebSocket URL', () => {
      // Temporarily mock console.error to avoid test noise
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      render(<WebSocketStatus url="invalid-url" autoConnect={true} />);
      
      expect(screen.getByText('ERROR')).toBeInTheDocument();
      
      consoleError.mockRestore();
    });
  });

  describe('heartbeat functionality', () => {
    it('should send heartbeat messages periodically', async () => {
      const sendSpy = jest.spyOn(MockWebSocket.prototype, 'send');
      
      render(
        <WebSocketStatus 
          url="ws://localhost:8000/ws" 
          autoConnect={true}
          heartbeatInterval={1000}
        />
      );
      
      await act(async () => {
        jest.advanceTimersByTime(20);
      });

      await waitFor(() => {
        expect(screen.getByText('CONNECTED')).toBeInTheDocument();
      });

      // Advance timer to trigger heartbeat
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(sendSpy).toHaveBeenCalledWith(
        expect.stringContaining('"type":"heartbeat"')
      );

      sendSpy.mockRestore();
    });
  });

  describe('position variants', () => {
    it.each(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'inline'] as const)(
      'should render in %s position',
      (position) => {
        render(
          <WebSocketStatus 
            url="ws://localhost:8000/ws" 
            position={position}
          />
        );
        
        const container = screen.getByTestId('websocket-status');
        expect(container).toHaveClass(position);
      }
    );
  });
});