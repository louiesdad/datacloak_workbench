import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { JobMonitor } from './JobMonitor';
import { OpenAIUsageTracker } from './OpenAIUsageTracker';
import { SystemHealthMonitor } from './SystemHealthMonitor';
import { SystemHealthWidget } from './SystemHealthWidget';
import { AdminLogin } from './AdminLogin';
import { 
  LayoutDashboard, 
  Activity, 
  DollarSign, 
  Settings, 
  Users, 
  FileText, 
  BarChart3,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
  Bell,
  Shield
} from 'lucide-react';
import './EnhancedAdminDashboard.css';

type DashboardView = 'overview' | 'jobs' | 'usage' | 'health' | 'settings';
type Theme = 'light' | 'dark' | 'system';

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  failedJobs: number;
  totalCost: number;
  systemStatus: 'healthy' | 'warning' | 'critical';
  alertCount: number;
}

interface EnhancedAdminDashboardProps {
  token?: string;
  onLogout?: () => void;
}

export const EnhancedAdminDashboard: React.FC<EnhancedAdminDashboardProps> = ({ 
  token: initialToken, 
  onLogout 
}) => {
  const [token, setToken] = useState<string | null>(initialToken || null);
  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [theme, setTheme] = useState<Theme>('system');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    failedJobs: 0,
    totalCost: 0,
    systemStatus: 'healthy',
    alertCount: 0
  });
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('adminToken');
    if (storedToken && !token) {
      verifyToken(storedToken);
    } else if (token) {
      setIsCheckingAuth(false);
    } else {
      setIsCheckingAuth(false);
    }
  }, [token]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setWebsocket(ws);
        
        // Send authentication
        ws.send(JSON.stringify({
          type: 'auth',
          token: token
        }));
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWebsocket(null);
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (token) {
            // Re-run this effect
          }
        }, 5000);
      };
      
      return () => {
        ws.close();
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  }, [token]);

  // Fetch dashboard stats
  const fetchDashboardStats = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/admin/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const stats = await response.json();
        setDashboardStats(stats);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  };

  // Initial stats fetch and periodic updates
  useEffect(() => {
    if (token) {
      fetchDashboardStats();
      const interval = setInterval(fetchDashboardStats, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [token]);

  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem('admin-theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    localStorage.setItem('admin-theme', theme);
  }, [theme]);

  // Token verification
  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: tokenToVerify }),
      });

      const data = await response.json();
      
      if (response.ok && data.valid) {
        setToken(tokenToVerify);
        localStorage.setItem('adminToken', tokenToVerify);
      } else {
        localStorage.removeItem('adminToken');
        setToken(null);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('adminToken');
      setToken(null);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Handle login
  const handleLogin = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('adminToken', newToken);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    if (websocket) {
      websocket.close();
    }
    if (onLogout) {
      onLogout();
    }
  };

  // Toggle theme
  const toggleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  // Navigation items
  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'jobs', label: 'Job Monitor', icon: Activity },
    { id: 'usage', label: 'Usage Tracker', icon: DollarSign },
    { id: 'health', label: 'System Health', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  // Render current view
  const renderCurrentView = () => {
    switch (currentView) {
      case 'overview':
        return <DashboardOverview stats={dashboardStats} websocket={websocket} />;
      case 'jobs':
        return <JobMonitor websocket={websocket || undefined} />;
      case 'usage':
        return <OpenAIUsageTracker websocket={websocket || undefined} />;
      case 'health':
        return <SystemHealthMonitor websocket={websocket || undefined} />;
      case 'settings':
        return <DashboardSettings theme={theme} onThemeChange={setTheme} />;
      default:
        return <DashboardOverview stats={dashboardStats} websocket={websocket} />;
    }
  };

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="admin-dashboard-loading">
        <div className="spinner"></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  // Login form
  if (!token) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="enhanced-admin-dashboard">
      {/* Mobile header */}
      <div className="mobile-header">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        
        <h1 className="text-lg font-semibold">Admin Dashboard</h1>
        
        <div className="mobile-actions">
          {dashboardStats.alertCount > 0 && (
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                {dashboardStats.alertCount}
              </Badge>
            </Button>
          )}
          
          <Button variant="ghost" size="sm" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="logo-text">DataCloak Admin</span>
          </div>
          
          <div className="desktop-actions">
            {dashboardStats.alertCount > 0 && (
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                  {dashboardStats.alertCount}
                </Badge>
              </Button>
            )}
            
            <Button variant="ghost" size="sm" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id as DashboardView);
                setSidebarOpen(false);
              }}
              className={`nav-item ${currentView === item.id ? 'nav-item-active' : ''}`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Button
            variant="ghost"
            className="logout-button"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <div className="content-container">
          {renderCurrentView()}
        </div>
      </main>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

// Dashboard Overview Component
const DashboardOverview: React.FC<{ stats: DashboardStats; websocket?: WebSocket | null }> = ({ stats, websocket }) => {
  return (
    <div className="dashboard-overview">
      <div className="overview-header">
        <h2 className="text-2xl font-bold">Dashboard Overview</h2>
        <p className="text-gray-600 dark:text-gray-400">
          System status and key metrics at a glance
        </p>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="stat-display">
              <span className="text-3xl font-bold">{stats.totalJobs}</span>
              <Activity className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Active Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="stat-display">
              <span className="text-3xl font-bold">{stats.activeJobs}</span>
              <BarChart3 className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Failed Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="stat-display">
              <span className="text-3xl font-bold">{stats.failedJobs}</span>
              <FileText className="h-6 w-6 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="stat-display">
              <span className="text-3xl font-bold">
                ${stats.totalCost.toFixed(2)}
              </span>
              <DollarSign className="h-6 w-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health Widget */}
      <SystemHealthWidget compact className="mt-6" websocket={websocket || undefined} />
    </div>
  );
};

// Dashboard Settings Component
const DashboardSettings: React.FC<{ 
  theme: Theme; 
  onThemeChange: (theme: Theme) => void; 
}> = ({ theme, onThemeChange }) => {
  return (
    <div className="dashboard-settings">
      <div className="settings-header">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure your dashboard preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="setting-group">
            <label className="setting-label">Theme</label>
            <div className="theme-options">
              {(['light', 'dark', 'system'] as Theme[]).map((themeOption) => (
                <Button
                  key={themeOption}
                  variant={theme === themeOption ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onThemeChange(themeOption)}
                  className="capitalize"
                >
                  {themeOption}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};