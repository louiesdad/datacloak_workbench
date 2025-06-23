import React, { useState, useEffect } from 'react';
import { JobMonitor } from './JobMonitor';
import { OpenAIUsageTracker } from './OpenAIUsageTracker';
import { SystemHealthWidget } from './SystemHealthWidget';
import { AnalysisAuditBrowser } from '../AnalysisAuditBrowser';
import './SimplifiedAdminDashboard.css';

export const SimplifiedAdminDashboard: React.FC = () => {
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'usage' | 'audit'>('overview');

  // Initialize WebSocket connection to backend
  useEffect(() => {
    const wsUrl = `ws://localhost:3001/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected to backend');
        setWebsocket(ws);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket closed');
        setWebsocket(null);
      };
      
      return () => {
        ws.close();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, []);

  return (
    <div className="simplified-admin-dashboard">
      <div className="dashboard-header">
        <h2>DataCloak Admin Dashboard</h2>
        <div className="dashboard-tabs">
          <button 
            className={activeTab === 'overview' ? 'active' : ''} 
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={activeTab === 'jobs' ? 'active' : ''} 
            onClick={() => setActiveTab('jobs')}
          >
            Jobs
          </button>
          <button 
            className={activeTab === 'usage' ? 'active' : ''} 
            onClick={() => setActiveTab('usage')}
          >
            Usage & Costs
          </button>
          <button 
            className={activeTab === 'audit' ? 'active' : ''} 
            onClick={() => setActiveTab('audit')}
          >
            Audit Trail
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="overview-grid">
            <div className="overview-section">
              <h3>System Health</h3>
              <SystemHealthWidget />
            </div>
            <div className="overview-section">
              <h3>Quick Stats</h3>
              <div className="quick-stats">
                <p>View the Jobs and Usage tabs for detailed metrics.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="jobs-section">
            <h3>Job Queue Monitor</h3>
            <JobMonitor websocket={websocket} />
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="usage-section">
            <h3>OpenAI Usage & Cost Tracking</h3>
            <OpenAIUsageTracker websocket={websocket} />
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="audit-section">
            <h3>Analysis Decision Audit Trail</h3>
            <AnalysisAuditBrowser />
          </div>
        )}
      </div>
    </div>
  );
};