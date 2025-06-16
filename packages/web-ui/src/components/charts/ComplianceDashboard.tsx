import React, { useState, useEffect } from 'react';
import {
  RadialBarChart,
  RadialBar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { Shield, AlertTriangle, CheckCircle, Clock, Download } from 'lucide-react';

interface ComplianceFramework {
  framework: string;
  score: number;
  status: 'compliant' | 'non_compliant' | 'partially_compliant';
  lastAssessed: string | null;
  criticalFindings: number;
  requirements: {
    total: number;
    compliant: number;
    nonCompliant: number;
  };
}

interface ComplianceOverview {
  totalFrameworks: number;
  activeFrameworks: number;
  overallComplianceScore: number;
  criticalFindings: number;
  lastAuditDate: string | null;
  nextAuditDate: string | null;
}

interface ComplianceDashboardData {
  overview: ComplianceOverview;
  frameworks: ComplianceFramework[];
  recentViolations: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    framework: string;
    date: string;
  }>;
  trends: Array<{
    date: string;
    score: number;
    framework: string;
  }>;
}

interface ComplianceDashboardProps {
  refreshInterval?: number;
  className?: string;
}

const COLORS = {
  compliant: '#10b981',
  partially_compliant: '#f59e0b',
  non_compliant: '#ef4444',
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#65a30d',
  primary: '#3b82f6'
};

const STATUS_COLORS = {
  compliant: '#10b981',
  'partially_compliant': '#f59e0b',
  'non_compliant': '#ef4444'
};

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({
  refreshInterval = 30000,
  className = ''
}) => {
  const [complianceData, setComplianceData] = useState<ComplianceDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);

  useEffect(() => {
    const fetchComplianceData = async () => {
      try {
        setError(null);
        const response = await fetch('/api/v1/compliance/dashboard');
        
        if (!response.ok) {
          throw new Error('Failed to fetch compliance data');
        }
        
        const result = await response.json();
        
        if (result.success) {
          setComplianceData(result.data);
        } else {
          throw new Error(result.message || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load compliance data');
        console.error('Compliance data fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComplianceData();
    const interval = setInterval(fetchComplianceData, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleExportReport = async () => {
    try {
      const response = await fetch('/api/v1/compliance/audit/report?download=true');
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `compliance-audit-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={`compliance-dashboard loading ${className}`}>
        <div className="dashboard-header">
          <h2>🛡️ Compliance Dashboard</h2>
        </div>
        <div className="loading-content">
          <div className="loading-spinner" />
          <p>Loading compliance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`compliance-dashboard error ${className}`}>
        <div className="dashboard-header">
          <h2>🛡️ Compliance Dashboard</h2>
        </div>
        <div className="error-content">
          <AlertTriangle className="error-icon" />
          <h3>Error Loading Compliance Data</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!complianceData) {
    return <div>No compliance data available</div>;
  }

  // Prepare data for radial chart
  const radialData = complianceData.frameworks.map(framework => ({
    name: framework.framework,
    score: framework.score,
    fill: STATUS_COLORS[framework.status]
  }));

  // Prepare violations by severity
  const violationsBySeverity = ['critical', 'high', 'medium', 'low'].map(severity => ({
    severity,
    count: complianceData.recentViolations.filter(v => v.severity === severity).length,
    color: COLORS[severity as keyof typeof COLORS]
  }));

  // Framework compliance breakdown
  const frameworkBreakdown = complianceData.frameworks.map(f => ({
    name: f.framework,
    compliant: f.requirements.compliant,
    nonCompliant: f.requirements.nonCompliant,
    total: f.requirements.total
  }));

  return (
    <div className={`compliance-dashboard ${className}`}>
      <div className="dashboard-header">
        <div className="header-left">
          <h2>🛡️ Compliance Dashboard</h2>
          <div className="compliance-summary">
            Overall Score: <span className="score">{complianceData.overview.overallComplianceScore}%</span>
            {complianceData.overview.lastAuditDate && (
              <span className="last-audit">
                Last audit: {new Date(complianceData.overview.lastAuditDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        
        <button onClick={handleExportReport} className="export-btn">
          <Download className="icon" />
          Export Report
        </button>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">
            <Shield className="icon" />
          </div>
          <div className="metric-content">
            <div className="metric-value">{complianceData.overview.activeFrameworks}/{complianceData.overview.totalFrameworks}</div>
            <div className="metric-label">Active Frameworks</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon critical">
            <AlertTriangle className="icon" />
          </div>
          <div className="metric-content">
            <div className="metric-value">{complianceData.overview.criticalFindings}</div>
            <div className="metric-label">Critical Findings</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <CheckCircle className="icon" />
          </div>
          <div className="metric-content">
            <div className="metric-value">{complianceData.overview.overallComplianceScore}%</div>
            <div className="metric-label">Compliance Score</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <Clock className="icon" />
          </div>
          <div className="metric-content">
            <div className="metric-value">
              {complianceData.overview.nextAuditDate 
                ? Math.ceil((new Date(complianceData.overview.nextAuditDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : 'N/A'
              }
            </div>
            <div className="metric-label">Days to Next Audit</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-section">
          <h3>Framework Compliance Scores</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={radialData}>
              <RadialBar
                minAngle={15}
                label={{ position: 'insideStart', fill: '#fff' }}
                background
                clockWise
                dataKey="score"
              />
              <Legend 
                iconSize={18} 
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value, entry) => (
                  <span style={{ color: entry.color }}>
                    {value}: {entry.payload?.score}%
                  </span>
                )}
              />
              <Tooltip formatter={(value: number) => [`${value}%`, 'Score']} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-section">
          <h3>Violations by Severity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={violationsBySeverity}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ severity, count }) => count > 0 ? `${severity}: ${count}` : ''}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {violationsBySeverity.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [value, 'Count']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-section">
          <h3>Framework Requirements Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={frameworkBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  value,
                  name === 'compliant' ? 'Compliant' : 'Non-Compliant'
                ]}
              />
              <Legend />
              <Bar 
                dataKey="compliant" 
                stackId="a" 
                fill={COLORS.compliant}
                name="Compliant"
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="nonCompliant" 
                stackId="a" 
                fill={COLORS.non_compliant}
                name="Non-Compliant"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-section">
          <h3>Recent Compliance Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={complianceData.trends.slice(-20)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
                tick={{ fontSize: 12 }}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value: number, name: string) => [`${value}%`, 'Score']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="score"
                stroke={COLORS.primary}
                strokeWidth={2}
                dot={{ fill: COLORS.primary, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="frameworks-overview">
        <h3>Framework Details</h3>
        <div className="frameworks-grid">
          {complianceData.frameworks.map((framework) => (
            <div
              key={framework.framework}
              className={`framework-card ${framework.status}`}
              onClick={() => setSelectedFramework(
                selectedFramework === framework.framework ? null : framework.framework
              )}
            >
              <div className="framework-header">
                <h4>{framework.framework}</h4>
                <div className={`status-badge ${framework.status}`}>
                  {framework.status.replace('_', ' ')}
                </div>
              </div>
              
              <div className="framework-score">
                <div className="score-circle">
                  <div className="score-text">{framework.score}%</div>
                </div>
              </div>
              
              <div className="framework-stats">
                <div className="stat">
                  <span className="label">Compliant:</span>
                  <span className="value">{framework.requirements.compliant}/{framework.requirements.total}</span>
                </div>
                <div className="stat">
                  <span className="label">Critical Issues:</span>
                  <span className="value critical">{framework.criticalFindings}</span>
                </div>
                {framework.lastAssessed && (
                  <div className="stat">
                    <span className="label">Last Assessed:</span>
                    <span className="value">{new Date(framework.lastAssessed).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {complianceData.recentViolations.length > 0 && (
        <div className="recent-violations">
          <h3>Recent Violations</h3>
          <div className="violations-list">
            {complianceData.recentViolations.slice(0, 10).map((violation) => (
              <div key={violation.id} className={`violation-item ${violation.severity}`}>
                <div className="violation-header">
                  <div className={`severity-badge ${violation.severity}`}>
                    {violation.severity.toUpperCase()}
                  </div>
                  <span className="framework">{violation.framework}</span>
                  <span className="date">{new Date(violation.date).toLocaleDateString()}</span>
                </div>
                <div className="violation-title">{violation.title}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};