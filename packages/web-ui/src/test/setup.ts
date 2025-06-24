import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Canvas API mock for graph components
HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
  if (type === '2d') {
    return {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
      createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      measureText: vi.fn(() => ({ width: 0, height: 0 })),
      transform: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      font: '10px sans-serif',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      direction: 'ltr',
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      miterLimit: 10,
      lineDashOffset: 0,
      shadowBlur: 0,
      shadowColor: 'rgba(0, 0, 0, 0)',
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      imageSmoothingEnabled: true
    }
  }
  return null
})

// Canvas element mock
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock')
HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
  callback?.(new Blob(['mock'], { type: 'image/png' }))
})

// ResizeObserver mock
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// IntersectionObserver mock  
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(), 
  disconnect: vi.fn(),
}))

// MutationObserver mock
global.MutationObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
}))

// Range mock for text selection
global.Range = vi.fn().mockImplementation(() => ({
  selectNode: vi.fn(),
  selectNodeContents: vi.fn(),
  setStart: vi.fn(),
  setEnd: vi.fn(),
  deleteContents: vi.fn(),
  extractContents: vi.fn(),
  cloneContents: vi.fn(),
  insertNode: vi.fn(),
  surroundContents: vi.fn(),
  compareBoundaryPoints: vi.fn(),
  cloneRange: vi.fn(),
  detach: vi.fn(),
  toString: vi.fn(),
  getBoundingClientRect: vi.fn(() => ({
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0
  }))
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock URL.createObjectURL and revokeObjectURL
Object.defineProperty(window.URL, 'createObjectURL', {
  writable: true,
  configurable: true,
  value: vi.fn(() => 'blob:mock-url')
})

Object.defineProperty(window.URL, 'revokeObjectURL', {
  writable: true,
  configurable: true,
  value: vi.fn()
})

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  configurable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue('')
  }
})

// Mock requestAnimationFrame
Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  configurable: true,
  value: vi.fn((cb: Function) => {
    setTimeout(cb, 16)
    return 1
  })
})

Object.defineProperty(window, 'cancelAnimationFrame', {
  writable: true,
  configurable: true,
  value: vi.fn()
})

// Mock console for cleaner test output
const originalConsoleError = console.error
console.error = (...args: any[]) => {
  // Filter out React warnings during tests
  if (args[0]?.toString().includes('Warning:')) {
    return
  }
  originalConsoleError(...args)
}