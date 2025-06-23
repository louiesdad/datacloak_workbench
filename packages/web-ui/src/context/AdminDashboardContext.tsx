import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// Types
interface DashboardState {
  websocket: WebSocket | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  autoRefresh: boolean;
  refreshInterval: number;
  notifications: Notification[];
  metrics: {
    jobs: JobMetrics;
    usage: UsageMetrics;
    system: SystemMetrics;
  };
  lastUpdated: {
    jobs: Date | null;
    usage: Date | null;
    system: Date | null;
  };
  errors: {
    jobs: string | null;
    usage: string | null;
    system: string | null;
    websocket: string | null;
  };
}

interface JobMetrics {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

interface UsageMetrics {
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  dailyBudget: number;
  weeklyBudget: number;
  monthlyBudget: number;
  dailySpent: number;
  weeklySpent: number;
  monthlySpent: number;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  persistent?: boolean;
}

// Actions
type DashboardAction =
  | { type: 'SET_WEBSOCKET'; payload: WebSocket | null }
  | { type: 'SET_CONNECTION_STATUS'; payload: DashboardState['connectionStatus'] }
  | { type: 'SET_AUTO_REFRESH'; payload: boolean }
  | { type: 'SET_REFRESH_INTERVAL'; payload: number }
  | { type: 'ADD_NOTIFICATION'; payload: Omit<Notification, 'id' | 'timestamp'> }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'UPDATE_JOB_METRICS'; payload: JobMetrics }
  | { type: 'UPDATE_USAGE_METRICS'; payload: UsageMetrics }
  | { type: 'UPDATE_SYSTEM_METRICS'; payload: SystemMetrics }
  | { type: 'SET_ERROR'; payload: { type: keyof DashboardState['errors']; error: string | null } }
  | { type: 'CLEAR_ERRORS' };

// Initial state
const initialState: DashboardState = {
  websocket: null,
  connectionStatus: 'disconnected',
  autoRefresh: true,
  refreshInterval: 30000, // 30 seconds
  notifications: [],
  metrics: {
    jobs: {
      total: 0,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    },
    usage: {
      totalTokens: 0,
      totalCost: 0,
      totalRequests: 0,
      dailyBudget: 50,
      weeklyBudget: 300,
      monthlyBudget: 1000,
      dailySpent: 0,
      weeklySpent: 0,
      monthlySpent: 0
    },
    system: {
      cpu: 0,
      memory: 0,
      disk: 0,
      uptime: 0,
      status: 'healthy'
    }
  },
  lastUpdated: {
    jobs: null,
    usage: null,
    system: null
  },
  errors: {
    jobs: null,
    usage: null,
    system: null,
    websocket: null
  }
};

// Reducer
const dashboardReducer = (state: DashboardState, action: DashboardAction): DashboardState => {
  switch (action.type) {
    case 'SET_WEBSOCKET':
      return { ...state, websocket: action.payload };
    
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    
    case 'SET_AUTO_REFRESH':
      return { ...state, autoRefresh: action.payload };
    
    case 'SET_REFRESH_INTERVAL':
      return { ...state, refreshInterval: action.payload };
    
    case 'ADD_NOTIFICATION':
      const newNotification: Notification = {
        ...action.payload,
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        read: false
      };
      return {
        ...state,
        notifications: [newNotification, ...state.notifications]
      };
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };
    
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload ? { ...n, read: true } : n
        )
      };
    
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] };
    
    case 'UPDATE_JOB_METRICS':
      return {
        ...state,
        metrics: { ...state.metrics, jobs: action.payload },
        lastUpdated: { ...state.lastUpdated, jobs: new Date() },
        errors: { ...state.errors, jobs: null }
      };
    
    case 'UPDATE_USAGE_METRICS':
      return {
        ...state,
        metrics: { ...state.metrics, usage: action.payload },
        lastUpdated: { ...state.lastUpdated, usage: new Date() },
        errors: { ...state.errors, usage: null }
      };
    
    case 'UPDATE_SYSTEM_METRICS':
      return {
        ...state,
        metrics: { ...state.metrics, system: action.payload },
        lastUpdated: { ...state.lastUpdated, system: new Date() },
        errors: { ...state.errors, system: null }
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.payload.type]: action.payload.error }
      };
    
    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: {
          jobs: null,
          usage: null,
          system: null,
          websocket: null
        }
      };
    
    default:
      return state;
  }
};

// Context
const DashboardContext = createContext<{
  state: DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
  actions: {
    connectWebSocket: (token: string) => void;
    disconnectWebSocket: () => void;
    fetchJobMetrics: () => Promise<void>;
    fetchUsageMetrics: () => Promise<void>;
    fetchSystemMetrics: () => Promise<void>;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
    clearOldNotifications: () => void;
  };
} | null>(null);

// Provider Props
interface AdminDashboardProviderProps {
  children: ReactNode;
  token?: string;
}

// Provider Component
export const AdminDashboardProvider: React.FC<AdminDashboardProviderProps> = ({ 
  children, 
  token 
}) => {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  // WebSocket connection management
  const connectWebSocket = (authToken: string) => {
    if (state.websocket?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connecting' });
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Dashboard WebSocket connected');
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' });
        dispatch({ type: 'SET_ERROR', payload: { type: 'websocket', error: null } });
        
        // Send authentication
        ws.send(JSON.stringify({
          type: 'auth',
          token: authToken
        }));

        // Subscribe to admin events
        ws.send(JSON.stringify({
          type: 'subscribe',
          topics: ['admin', 'jobs', 'system', 'usage']
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Dashboard WebSocket error:', error);
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'error' });
        dispatch({ 
          type: 'SET_ERROR', 
          payload: { type: 'websocket', error: 'WebSocket connection error' } 
        });
      };

      ws.onclose = (event) => {
        console.log('Dashboard WebSocket disconnected:', event.code, event.reason);
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
        dispatch({ type: 'SET_WEBSOCKET', payload: null });
        
        // Attempt to reconnect after delay if not a clean close
        if (event.code !== 1000 && authToken) {
          setTimeout(() => {
            connectWebSocket(authToken);
          }, 5000);
        }
      };

      dispatch({ type: 'SET_WEBSOCKET', payload: ws });
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'error' });
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { type: 'websocket', error: 'Failed to create WebSocket connection' } 
      });
    }
  };

  const disconnectWebSocket = () => {
    if (state.websocket) {
      state.websocket.close(1000, 'User disconnected');
      dispatch({ type: 'SET_WEBSOCKET', payload: null });
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
    }
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'job:update':
      case 'job:metrics':
        if (message.data) {
          dispatch({ type: 'UPDATE_JOB_METRICS', payload: message.data });
        }
        break;
      
      case 'usage:update':
      case 'usage:metrics':
        if (message.data) {
          dispatch({ type: 'UPDATE_USAGE_METRICS', payload: message.data });
        }
        break;
      
      case 'system:update':
      case 'system:metrics':
        if (message.data) {
          dispatch({ type: 'UPDATE_SYSTEM_METRICS', payload: message.data });
        }
        break;
      
      case 'notification':
        if (message.data) {
          dispatch({ type: 'ADD_NOTIFICATION', payload: message.data });
        }
        break;
      
      case 'alert':
        if (message.data) {
          dispatch({ 
            type: 'ADD_NOTIFICATION', 
            payload: {
              type: 'warning',
              title: 'System Alert',
              message: message.data.message || 'System alert triggered',
              persistent: true
            }
          });
        }
        break;
    }
  };

  // API fetch functions
  const fetchJobMetrics = async () => {
    try {
      const response = await fetch('/api/admin/jobs/metrics', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (response.ok) {
        const data = await response.json();
        dispatch({ type: 'UPDATE_JOB_METRICS', payload: data });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to fetch job metrics:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { type: 'jobs', error: error instanceof Error ? error.message : 'Unknown error' } 
      });
    }
  };

  const fetchUsageMetrics = async () => {
    try {
      const response = await fetch('/api/admin/openai/metrics', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (response.ok) {
        const data = await response.json();
        dispatch({ type: 'UPDATE_USAGE_METRICS', payload: data });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to fetch usage metrics:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { type: 'usage', error: error instanceof Error ? error.message : 'Unknown error' } 
      });
    }
  };

  const fetchSystemMetrics = async () => {
    try {
      const response = await fetch('/api/admin/system/metrics', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (response.ok) {
        const data = await response.json();
        dispatch({ type: 'UPDATE_SYSTEM_METRICS', payload: data });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { type: 'system', error: error instanceof Error ? error.message : 'Unknown error' } 
      });
    }
  };

  // Notification management
  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
  };

  const clearOldNotifications = () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const filteredNotifications = state.notifications.filter(
      n => n.persistent || n.timestamp > cutoff
    );
    
    if (filteredNotifications.length !== state.notifications.length) {
      dispatch({ type: 'CLEAR_NOTIFICATIONS' });
      filteredNotifications.forEach(n => {
        dispatch({ type: 'ADD_NOTIFICATION', payload: n });
      });
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!state.autoRefresh || !token) return;

    const fetchAllMetrics = async () => {
      await Promise.all([
        fetchJobMetrics(),
        fetchUsageMetrics(),
        fetchSystemMetrics()
      ]);
    };

    // Initial fetch
    fetchAllMetrics();

    // Set up interval
    const interval = setInterval(fetchAllMetrics, state.refreshInterval);
    
    return () => clearInterval(interval);
  }, [state.autoRefresh, state.refreshInterval, token]);

  // WebSocket connection effect
  useEffect(() => {
    if (token && state.connectionStatus === 'disconnected') {
      connectWebSocket(token);
    }
    
    return () => {
      if (state.websocket) {
        disconnectWebSocket();
      }
    };
  }, [token]);

  // Cleanup old notifications effect
  useEffect(() => {
    const interval = setInterval(clearOldNotifications, 60000); // Every minute
    return () => clearInterval(interval);
  }, [state.notifications]);

  const contextValue = {
    state,
    dispatch,
    actions: {
      connectWebSocket,
      disconnectWebSocket,
      fetchJobMetrics,
      fetchUsageMetrics,
      fetchSystemMetrics,
      addNotification,
      clearOldNotifications
    }
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
};

// Hook to use the dashboard context
export const useAdminDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useAdminDashboard must be used within an AdminDashboardProvider');
  }
  return context;
};

// Export types for external use
export type { 
  DashboardState, 
  JobMetrics, 
  UsageMetrics, 
  SystemMetrics, 
  Notification,
  DashboardAction 
};