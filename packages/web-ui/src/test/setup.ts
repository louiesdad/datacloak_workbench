import '@testing-library/jest-dom'
import { vi } from 'vitest'

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

Object.defineProperty(globalThis, 'window', {
  value: {
    ...globalThis.window,
    platformBridge: mockPlatformBridge
  },
  writable: true
})