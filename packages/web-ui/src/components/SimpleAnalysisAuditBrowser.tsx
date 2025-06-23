import React, { useState, useEffect } from 'react';
import './SimpleAnalysisAuditBrowser.css';

export const SimpleAnalysisAuditBrowser: React.FC = () => {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch decisions from the API
    fetch('http://localhost:3001/api/v1/audit/decisions')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDecisions(data);
        } else {
          setDecisions([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load decisions:', err);
        setError('Failed to load audit data');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="audit-loading">Loading audit logs...</div>;
  }

  if (error) {
    return <div className="audit-error">Error: {error}</div>;
  }

  return (
    <div className="simple-analysis-audit-browser">

      <div className="audit-message">
        <h3>Analysis Decision Audit Trail</h3>
        <p>This component tracks all analysis decisions made by the system, including:</p>
        <ul>
          <li>Field detection decisions with confidence scores</li>
          <li>PII masking operations and patterns found</li>
          <li>Sentiment analysis results with reasoning</li>
          <li>Data quality assessments</li>
        </ul>
      </div>

      {decisions.length > 0 ? (
        <div className="decision-list">
          {decisions.slice(0, 10).map((decision, index) => (
            <div key={decision.id || index} className="decision-card">
              <div className="decision-header">
                <span className="decision-type">
                  {decision.component || 'Analysis Decision'}
                </span>
                <span className={`decision-confidence ${
                  (decision.confidence || 0.85) >= 0.9 ? 'high' : 
                  (decision.confidence || 0.85) >= 0.7 ? 'medium' : 'low'
                }`}>
                  {Math.round((decision.confidence || 0.85) * 100)}% confidence
                </span>
              </div>
              <div className="decision-details">
                <p><strong>Stage:</strong> {decision.stage || 'Processing'}</p>
                <p><strong>Reasoning:</strong> {decision.reasoning || 'Automated analysis based on configured rules'}</p>
              </div>
              <div className="decision-timestamp">
                {new Date(decision.timestamp || Date.now()).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="audit-message">
          <p>No analysis decisions recorded yet. Decisions will appear here as you process data.</p>
        </div>
      )}
    </div>
  );
};