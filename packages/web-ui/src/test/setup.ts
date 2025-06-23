import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Mock lucide-react globally to avoid React import issues
vi.mock('lucide-react', () => ({
  Activity: () => React.createElement('div', { 'data-testid': 'activity-icon' }),
  AlertCircle: () => React.createElement('div', { 'data-testid': 'alert-circle-icon' }),
  AlertTriangle: () => React.createElement('div', { 'data-testid': 'alert-triangle-icon' }),
  BarChart3: () => React.createElement('div', { 'data-testid': 'bar-chart-3-icon' }),
  Bell: () => React.createElement('div', { 'data-testid': 'bell-icon' }),
  Calendar: () => React.createElement('div', { 'data-testid': 'calendar-icon' }),
  CheckCircle: () => React.createElement('div', { 'data-testid': 'check-circle-icon' }),
  ChevronDown: () => React.createElement('div', { 'data-testid': 'chevron-down-icon' }),
  ChevronUp: () => React.createElement('div', { 'data-testid': 'chevron-up-icon' }),
  Clock: () => React.createElement('div', { 'data-testid': 'clock-icon' }),
  Cpu: () => React.createElement('div', { 'data-testid': 'cpu-icon' }),
  Database: () => React.createElement('div', { 'data-testid': 'database-icon' }),
  DollarSign: () => React.createElement('div', { 'data-testid': 'dollar-sign-icon' }),
  FileText: () => React.createElement('div', { 'data-testid': 'file-text-icon' }),
  Filter: () => React.createElement('div', { 'data-testid': 'filter-icon' }),
  HardDrive: () => React.createElement('div', { 'data-testid': 'hard-drive-icon' }),
  Info: () => React.createElement('div', { 'data-testid': 'info-icon' }),
  LayoutDashboard: () => React.createElement('div', { 'data-testid': 'layout-dashboard-icon' }),
  LogOut: () => React.createElement('div', { 'data-testid': 'logout-icon' }),
  Menu: () => React.createElement('div', { 'data-testid': 'menu-icon' }),
  Monitor: () => React.createElement('div', { 'data-testid': 'monitor-icon' }),
  Moon: () => React.createElement('div', { 'data-testid': 'moon-icon' }),
  Network: () => React.createElement('div', { 'data-testid': 'network-icon' }),
  Pause: () => React.createElement('div', { 'data-testid': 'pause-icon' }),
  Play: () => React.createElement('div', { 'data-testid': 'play-icon' }),
  RefreshCw: () => React.createElement('div', { 'data-testid': 'refresh-icon' }),
  RotateCcw: () => React.createElement('div', { 'data-testid': 'rotate-icon' }),
  Search: () => React.createElement('div', { 'data-testid': 'search-icon' }),
  Server: () => React.createElement('div', { 'data-testid': 'server-icon' }),
  Settings: () => React.createElement('div', { 'data-testid': 'settings-icon' }),
  Shield: () => React.createElement('div', { 'data-testid': 'shield-icon' }),
  Sun: () => React.createElement('div', { 'data-testid': 'sun-icon' }),
  Trash2: () => React.createElement('div', { 'data-testid': 'trash-icon' }),
  TrendingDown: () => React.createElement('div', { 'data-testid': 'trending-down-icon' }),
  TrendingUp: () => React.createElement('div', { 'data-testid': 'trending-up-icon' }),
  Users: () => React.createElement('div', { 'data-testid': 'users-icon' }),
  Wifi: () => React.createElement('div', { 'data-testid': 'wifi-icon' }),
  WifiOff: () => React.createElement('div', { 'data-testid': 'wifi-off-icon' }),
  X: () => React.createElement('div', { 'data-testid': 'x-icon' }),
  XCircle: () => React.createElement('div', { 'data-testid': 'x-circle-icon' }),
  Zap: () => React.createElement('div', { 'data-testid': 'zap-icon' })
}))

// Mock the platform bridge globally
const mockPlatformBridge = {
  capabilities: {
    hasFileSystemAccess: false,
    hasNotifications: false,
    hasSystemTray: false,
    hasMenuBar: false,
    canMinimizeToTray: false,
    platform: 'browser' as const
  },
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn()
}

// Mock window properties for tests
Object.defineProperty(globalThis, 'window', {
  value: {
    ...globalThis.window,
    platformBridge: mockPlatformBridge,
    location: {
      protocol: 'http:',
      host: 'localhost',
      hostname: 'localhost',
      port: '',
      pathname: '/',
      search: '',
      hash: ''
    },
    document: {
      documentElement: {
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn(),
          toggle: vi.fn()
        }
      },
      title: ''
    },
    matchMedia: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    innerWidth: 1024,
    innerHeight: 768
  },
  writable: true
})

// Mock global document for direct access
Object.defineProperty(globalThis, 'document', {
  value: {
    documentElement: {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(),
        toggle: vi.fn()
      }
    },
    title: ''
  },
  writable: true
})