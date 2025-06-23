import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { analysisAuditService } from '../services/analysisAuditService';
import './CausalAnalysisDashboard.css';

interface EventImpact {
  eventId: string;
  eventType: string;
  eventDate: string;
  description: string;
  impact: number;
  percentageChange: number;
  isSignificant: boolean;
  confidence: number;
  customersAffected: number;
}

interface CausalAnalysisDashboardProps {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export const CausalAnalysisDashboard: React.FC<CausalAnalysisDashboardProps> = ({ 
  dateRange 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventImpacts, setEventImpacts] = useState<EventImpact[]>([]);
  const [filteredImpacts, setFilteredImpacts] = useState<EventImpact[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventImpact | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'impact'>('impact');
  const [startDate, setStartDate] = useState(
    dateRange?.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    dateRange?.endDate || new Date().toISOString().split('T')[0]
  );

  const fetchEventImpacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await analysisAuditService.getEventImpacts(startDate, endDate);
      setEventImpacts(data);
      setFilteredImpacts(data);
    } catch (err) {
      setError('Error loading event impacts');
      console.error('Failed to fetch event impacts:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchEventImpacts();
  }, [fetchEventImpacts]);

  useEffect(() => {
    let filtered = eventImpacts;

    // Filter by event type
    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(event => event.eventType === eventTypeFilter);
    }

    // Sort events
    if (sortBy === 'impact') {
      filtered = filtered.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    } else if (sortBy === 'date') {
      filtered = filtered.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
    }

    setFilteredImpacts(filtered);
  }, [eventImpacts, eventTypeFilter, sortBy]);

  const getEventTypes = () => {
    const types = [...new Set(eventImpacts.map(event => event.eventType))];
    return types;
  };

  const getImpactColor = (impact: number) => {
    if (impact > 0) return '#10B981'; // Green for positive impact
    return '#EF4444'; // Red for negative impact
  };

  const handleExportReport = () => {
    const csvContent = [
      ['Event Type', 'Description', 'Date', 'Impact %', 'Customers Affected', 'Significance', 'Confidence'],
      ...filteredImpacts.map(event => [
        event.eventType,
        event.description,
        event.eventDate,
        event.impact.toFixed(1),
        event.customersAffected.toString(),
        event.isSignificant ? 'Yes' : 'No',
        `${Math.round(event.confidence * 100)}%`
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `causal-analysis-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="causal-analysis-dashboard">
        <div className="loading-spinner">
          <div>Loading event impacts...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="causal-analysis-dashboard">
        <div className="error-message">
          <p>{error}</p>
          <Button onClick={fetchEventImpacts}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="causal-analysis-dashboard">
      <div className="dashboard-header">
        <h2>What Impacted Customer Sentiment?</h2>
        <div className="dashboard-controls">
          <Button onClick={fetchEventImpacts}>Refresh Data</Button>
          <Button onClick={handleExportReport}>Export Report</Button>
        </div>
      </div>

      <div className="filters-section">
        <div className="date-filters">
          <label>
            Start Date:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            End Date:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>

        <div className="event-filters">
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
          >
            <option value="all">All Event Types</option>
            {getEventTypes().map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <Button
            onClick={() => setSortBy(sortBy === 'impact' ? 'date' : 'impact')}
          >
            Sort by {sortBy === 'impact' ? 'Date' : 'Impact'}
          </Button>
        </div>
      </div>

      <div className="impact-chart-section">
        <Card>
          <h3>Event Impact Overview</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={filteredImpacts.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="description" 
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
              />
              <YAxis label={{ value: 'Impact %', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Impact']}
                labelFormatter={(label) => `Event: ${label}`}
              />
              <Bar dataKey="impact">
                {filteredImpacts.slice(0, 10).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getImpactColor(entry.impact)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="events-list">
        {filteredImpacts.map((event) => (
          <Card 
            key={event.eventId} 
            className="event-card"
            onClick={() => setSelectedEvent(event)}
          >
            <div className="event-header">
              <div className="event-info">
                <h4 data-testid="event-description">{event.description}</h4>
                <div className="event-meta">
                  <Badge variant={event.eventType === 'outage' ? 'danger' : 'primary'}>
                    {event.eventType}
                  </Badge>
                  <span className="event-date">{event.eventDate}</span>
                </div>
              </div>
              <div className="impact-indicator">
                <span className={`impact-value ${event.impact > 0 ? 'positive' : 'negative'}`}>
                  {event.impact > 0 ? '+' : ''}{event.impact.toFixed(1)}%
                </span>
                {event.isSignificant && (
                  <Badge variant="success">Statistically Significant</Badge>
                )}
              </div>
            </div>
            
            <div className="event-details">
              <p>{event.customersAffected} customers affected</p>
              <p>{Math.round(event.confidence * 100)}% confidence</p>
            </div>
          </Card>
        ))}
      </div>

      {selectedEvent && (
        <div className="event-details-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Event Details</h3>
              <Button onClick={() => setSelectedEvent(null)}>Close</Button>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
                <h4>{selectedEvent.description}</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Event Type:</label>
                    <span>{selectedEvent.eventType}</span>
                  </div>
                  <div className="detail-item">
                    <label>Date:</label>
                    <span>{selectedEvent.eventDate}</span>
                  </div>
                  <div className="detail-item">
                    <label>Impact:</label>
                    <span className={selectedEvent.impact > 0 ? 'positive' : 'negative'}>
                      {selectedEvent.impact > 0 ? '+' : ''}{selectedEvent.impact.toFixed(1)}%
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Percentage Change:</label>
                    <span>{Math.abs(selectedEvent.percentageChange).toFixed(2)}% {selectedEvent.percentageChange > 0 ? 'increase' : 'decrease'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Customers Affected:</label>
                    <span>{selectedEvent.customersAffected} customers affected</span>
                  </div>
                  <div className="detail-item">
                    <label>Statistical Significance:</label>
                    <span>{selectedEvent.isSignificant ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Confidence:</label>
                    <span>{Math.round(selectedEvent.confidence * 100)}% confidence</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-overlay" onClick={() => setSelectedEvent(null)} />
        </div>
      )}
    </div>
  );
};