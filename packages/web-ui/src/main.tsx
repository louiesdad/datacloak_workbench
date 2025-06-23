import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import FixedApp from './FixedApp.tsx'
// import TestApp from './TestApp.tsx'

// Add error boundary
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: red; color: white; padding: 20px; z-index: 9999;';
  errorDiv.textContent = `Error: ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`;
  document.body.appendChild(errorDiv);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FixedApp />
  </StrictMode>,
)
