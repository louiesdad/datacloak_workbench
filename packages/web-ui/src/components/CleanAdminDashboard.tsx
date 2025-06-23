import React, { useState, useEffect } from 'react';
import { JobMonitor } from './admin/JobMonitor';
import { OpenAIUsageTracker } from './admin/OpenAIUsageTracker';
import { SimpleAnalysisAuditBrowser } from './SimpleAnalysisAuditBrowser';
import './CleanAdminDashboard.css';

// Clean admin dashboard with NO authentication
export const CleanAdminDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<'overview' | 'jobs' | 'usage' | 'audit'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);

  // Load basic stats
  useEffect(() => {
    fetch('http://localhost:3001/api/v1/openai/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats(data.data);
        }
      })
      .catch(err => console.error('Stats error:', err));
  }, []);

  // Setup WebSocket connection
  useEffect(() => {
    try {
      const ws = new WebSocket('ws://localhost:3001/ws');
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setWebsocket(ws);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWebsocket(null);
      };
      
      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, []);

  return (
    <div className="clean-admin-dashboard">

      <div className="admin-header">
        <h2>Enhanced Logging Dashboard</h2>
      </div>
      
      <div className="admin-tabs">
        <div className="tabs-header">
          <button 
            type="button"
            className={`tab-item ${activeView === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveView('overview')}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-label">Overview</span>
          </button>
          <button 
            type="button"
            className={`tab-item ${activeView === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveView('jobs')}
          >
            <span className="tab-icon">⚙️</span>
            <span className="tab-label">Job Monitor</span>
          </button>
          <button 
            type="button"
            className={`tab-item ${activeView === 'usage' ? 'active' : ''}`}
            onClick={() => setActiveView('usage')}
          >
            <span className="tab-icon">💰</span>
            <span className="tab-label">Usage & Costs</span>
          </button>
          <button 
            type="button"
            className={`tab-item ${activeView === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveView('audit')}
          >
            <span className="tab-icon">📋</span>
            <span className="tab-label">Analysis Logs</span>
          </button>
        </div>
      </div>

      <div className="admin-content">
        {activeView === 'overview' && (
          <div className="content-section">
            
            {stats && (
              <div className="stats-overview">
                <div className="stat-card">
                  <span className="stat-label">Total API Requests</span>
                  <span className="stat-value">{stats.logs?.totalRequests || 0}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Total Tokens Used</span>
                  <span className="stat-value">{(stats.costs?.daily?.total?.tokens || 0).toLocaleString()}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Today's Cost</span>
                  <span className="stat-value">${(stats.costs?.daily?.total?.cost || 0).toFixed(2)}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">API Rate Limit</span>
                  <span className="stat-value">{stats.rateLimit?.tokensRemaining || 0}/{stats.rateLimit?.maxTokens || 0}</span>
                </div>
              </div>
            )}
            
            <div className="welcome-message">
              <h3>Welcome to Enhanced Logging Dashboard</h3>
              <p>This dashboard provides real-time monitoring of:</p>
              <ul>
                <li><strong>Job Monitor</strong> - Track processing jobs in real-time</li>
                <li><strong>Usage & Costs</strong> - Monitor OpenAI API usage and expenses</li>
                <li><strong>Analysis Logs</strong> - View detailed decision logs and audit trails</li>
              </ul>
            </div>
          </div>
        )}

        {activeView === 'jobs' && (
          <div className="content-section">
            <JobMonitor websocket={websocket} />
          </div>
        )}

        {activeView === 'usage' && (
          <div className="content-section">
            <OpenAIUsageTracker />
          </div>
        )}

        {activeView === 'audit' && (
          <div className="content-section">
            <SimpleAnalysisAuditBrowser />
          </div>
        )}
      </div>
    </div>
  );
};