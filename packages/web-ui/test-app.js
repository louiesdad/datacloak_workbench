const http = require('http');

// Test if the app is accessible
http.get('http://localhost:5173', (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response length:', data.length);
    console.log('First 500 chars:', data.substring(0, 500));
    
    // Check if it contains our app
    if (data.includes('DataCloak Sentiment Workbench')) {
      console.log('✓ App title found');
    }
    if (data.includes('root')) {
      console.log('✓ Root element found');
    }
    if (data.includes('index-MBFgwd8L.js')) {
      console.log('✓ JavaScript bundle found');
    }
    if (data.includes('full-mock-bridge.js')) {
      console.log('✓ Mock bridge script found');
    }
  });
}).on('error', (err) => {
  console.error('Error:', err);
});