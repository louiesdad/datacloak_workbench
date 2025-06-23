// Debug script to check what's happening
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded');
  
  // Check if React app mounted
  const root = document.getElementById('root');
  console.log('Root element:', root);
  console.log('Root content:', root ? root.innerHTML : 'No root');
  
  // Check for any errors
  window.addEventListener('error', (e) => {
    console.error('Global error:', e);
  });
  
  // Add a visible test element
  if (root && !root.innerHTML) {
    root.innerHTML = '<div style="padding: 20px; background: yellow;">React app failed to mount. Check console for errors.</div>';
  }
});