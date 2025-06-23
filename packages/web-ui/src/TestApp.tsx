import React from 'react';

export default function TestApp() {
  const [count, setCount] = React.useState(0);
  const [logs, setLogs] = React.useState<string[]>([]);
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };
  
  React.useEffect(() => {
    addLog('TestApp mounted');
    
    // Test backend connection
    fetch('http://localhost:3001/api/v1/health')
      .then(res => {
        addLog(`Backend health check: ${res.status}`);
        return res.json();
      })
      .then(data => {
        addLog(`Backend response: ${JSON.stringify(data)}`);
      })
      .catch(err => {
        addLog(`Backend error: ${err.message}`);
      });
  }, []);
  
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Test App - Debugging Frontend</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>React Test</h2>
        <p>Count: {count}</p>
        <button onClick={() => setCount(count + 1)}>Increment</button>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Navigation Test</h2>
        <button onClick={() => addLog('Would navigate to Logs page')}>
          Go to Logs
        </button>
      </div>
      
      <div>
        <h2>Debug Logs</h2>
        <div style={{ 
          backgroundColor: '#f0f0f0', 
          padding: '10px', 
          borderRadius: '5px',
          maxHeight: '300px',
          overflow: 'auto'
        }}>
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}