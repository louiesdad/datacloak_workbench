import React, { useState } from 'react';
import './App.css';

function SimpleApp() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyzeSentiment = async () => {
    if (!text.trim()) {
      setError('Please enter some text');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('http://localhost:3001/api/v1/sentiment/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error.message);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError('Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const detectPII = async () => {
    if (!text.trim()) {
      setError('Please enter some text');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('http://localhost:3001/api/v1/security/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error.message);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError('Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="simple-app" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>DataCloak Sentiment Workbench</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Enter Text for Analysis</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text here... (include emails or phone numbers to see PII protection)"
          style={{
            width: '100%',
            minHeight: '150px',
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={analyzeSentiment}
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? 'Analyzing...' : 'Analyze Sentiment'}
        </button>
        
        <button
          onClick={detectPII}
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? 'Detecting...' : 'Detect PII'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#f44336',
          color: 'white',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{
          padding: '20px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          <h3>Result:</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
        <h3>About DataCloak Sentiment Workbench</h3>
        <p>This application demonstrates the integration of sentiment analysis with PII (Personally Identifiable Information) protection.</p>
        <ul>
          <li><strong>Sentiment Analysis:</strong> Analyzes the emotional tone of your text</li>
          <li><strong>PII Protection:</strong> Automatically detects and masks sensitive information like emails, phone numbers, SSNs, etc.</li>
          <li><strong>Real DataCloak Library:</strong> Using the actual DataCloak Rust library via FFI for enterprise-grade protection</li>
        </ul>
        <p>Try entering text with emails (user@example.com) or phone numbers (555-123-4567) to see the PII masking in action!</p>
      </div>
    </div>
  );
}

export default SimpleApp;