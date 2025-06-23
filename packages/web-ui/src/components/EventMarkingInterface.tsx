import React, { useState, useEffect, useCallback } from 'react';
import { analysisAuditService, BusinessEvent } from '../services/analysisAuditService';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import './EventMarkingInterface.css';

interface EventFormData {
  eventType: string;
  eventDate: string;
  description: string;
  affectedCustomers: string;
  customEventType?: string;
  specificCustomers?: string;
}

interface ValidationErrors {
  eventType?: string;
  eventDate?: string;
  description?: string;
  affectedCustomers?: string;
  customEventType?: string;
}

export const EventMarkingInterface: React.FC = () => {
  const [formData, setFormData] = useState<EventFormData>({
    eventType: '',
    eventDate: '',
    description: '',
    affectedCustomers: 'all',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [existingEvents, setExistingEvents] = useState<BusinessEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<BusinessEvent | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const eventTypes = [
    'outage',
    'price_increase',
    'feature_launch',
    'promotion',
    'policy_change',
    'maintenance',
    'security_incident',
    'custom',
  ];

  const fetchExistingEvents = useCallback(async () => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90); // Last 90 days
      const endDate = new Date();
      
      const events = await analysisAuditService.getEventsByDateRange(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      setExistingEvents(events);
    } catch (error) {
      console.error('Failed to fetch existing events:', error);
    }
  }, []);

  useEffect(() => {
    fetchExistingEvents();
  }, [fetchExistingEvents]);

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.eventType) {
      errors.eventType = 'Event type is required';
    } else if (formData.eventType === 'custom' && !formData.customEventType) {
      errors.customEventType = 'Custom event type is required';
    }

    if (!formData.eventDate) {
      errors.eventDate = 'Event date is required';
    } else {
      const selectedDate = new Date(formData.eventDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      if (selectedDate > today) {
        errors.eventDate = 'Event date cannot be in the future';
      }
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }

    if (!formData.affectedCustomers) {
      errors.affectedCustomers = 'Affected customers selection is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      eventType: '',
      eventDate: '',
      description: '',
      affectedCustomers: 'all',
    });
    setValidationErrors({});
    setEditingEvent(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const eventData = {
        eventType: formData.eventType === 'custom' ? formData.customEventType! : formData.eventType,
        eventDate: formData.eventDate,
        description: formData.description.trim(),
        affectedCustomers: formData.affectedCustomers === 'specific' 
          ? formData.specificCustomers?.split(',').map(id => id.trim()).filter(Boolean) || []
          : formData.affectedCustomers as 'all',
      };

      if (editingEvent) {
        await analysisAuditService.updateBusinessEvent(editingEvent.id, eventData);
        setMessage({ type: 'success', text: 'Event updated successfully' });
      } else {
        await analysisAuditService.createBusinessEvent(eventData);
        setMessage({ type: 'success', text: 'Event created successfully' });
      }
      
      resetForm();
      await fetchExistingEvents();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: editingEvent ? 'Failed to update event' : 'Failed to create event' 
      });
      console.error('Error saving event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (event: BusinessEvent) => {
    setEditingEvent(event);
    setFormData({
      eventType: eventTypes.includes(event.eventType) ? event.eventType : 'custom',
      eventDate: event.eventDate,
      description: event.description,
      affectedCustomers: Array.isArray(event.affectedCustomers) ? 'specific' : event.affectedCustomers,
      customEventType: eventTypes.includes(event.eventType) ? undefined : event.eventType,
      specificCustomers: Array.isArray(event.affectedCustomers) ? event.affectedCustomers.join(', ') : undefined,
    });
    setValidationErrors({});
    setMessage(null);
  };

  const handleDelete = async (eventId: string) => {
    try {
      await analysisAuditService.deleteBusinessEvent(eventId);
      setMessage({ type: 'success', text: 'Event deleted successfully' });
      await fetchExistingEvents();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete event' });
      console.error('Error deleting event:', error);
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const formatCustomerDisplay = (customers: string[] | 'all'): string => {
    if (customers === 'all') return 'All customers';
    if (Array.isArray(customers)) {
      if (customers.length <= 3) return customers.join(', ');
      return `${customers.slice(0, 3).join(', ')} +${customers.length - 3} more`;
    }
    return 'Unknown';
  };

  return (
    <div className="event-marking-interface">
      <div className="interface-header">
        <h2>Mark Business Event</h2>
        <p>Record business events that may impact customer sentiment</p>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="interface-layout">
        <div className="event-form-section">
          <Card>
            <h3>{editingEvent ? 'Edit Event' : 'Create New Event'}</h3>
            <form onSubmit={handleSubmit} className="event-form">
              <div className="form-group">
                <label htmlFor="eventType">Event Type:</label>
                <select
                  id="eventType"
                  value={formData.eventType}
                  onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                  className={validationErrors.eventType ? 'error' : ''}
                >
                  <option value="">Select event type</option>
                  {eventTypes.map(type => (
                    <option key={type} value={type}>
                      {type === 'custom' ? 'Custom...' : type.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                {validationErrors.eventType && (
                  <span className="error-text">{validationErrors.eventType}</span>
                )}
              </div>

              {formData.eventType === 'custom' && (
                <div className="form-group">
                  <label htmlFor="customEventType">Custom Event Type:</label>
                  <input
                    id="customEventType"
                    type="text"
                    value={formData.customEventType || ''}
                    onChange={(e) => setFormData({ ...formData, customEventType: e.target.value })}
                    placeholder="Enter custom event type"
                    className={validationErrors.customEventType ? 'error' : ''}
                  />
                  {validationErrors.customEventType && (
                    <span className="error-text">{validationErrors.customEventType}</span>
                  )}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="eventDate">Event Date:</label>
                <input
                  id="eventDate"
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className={validationErrors.eventDate ? 'error' : ''}
                />
                {validationErrors.eventDate && (
                  <span className="error-text">{validationErrors.eventDate}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="description">Description:</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the business event and its potential impact"
                  rows={3}
                  className={validationErrors.description ? 'error' : ''}
                />
                {validationErrors.description && (
                  <span className="error-text">{validationErrors.description}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="affectedCustomers">Affected Customers:</label>
                <select
                  id="affectedCustomers"
                  value={formData.affectedCustomers}
                  onChange={(e) => setFormData({ ...formData, affectedCustomers: e.target.value })}
                  className={validationErrors.affectedCustomers ? 'error' : ''}
                >
                  <option value="all">All customers</option>
                  <option value="specific">Specific customers</option>
                </select>
                {validationErrors.affectedCustomers && (
                  <span className="error-text">{validationErrors.affectedCustomers}</span>
                )}
              </div>

              {formData.affectedCustomers === 'specific' && (
                <div className="form-group">
                  <label htmlFor="specificCustomers">Customer IDs:</label>
                  <input
                    id="specificCustomers"
                    type="text"
                    value={formData.specificCustomers || ''}
                    onChange={(e) => setFormData({ ...formData, specificCustomers: e.target.value })}
                    placeholder="Enter customer IDs separated by commas"
                  />
                  <small>Example: cust-1, cust-2, cust-3</small>
                </div>
              )}

              <div className="form-actions">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
                </Button>
                {editingEvent && (
                  <Button type="button" variant="secondary" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>

        <div className="events-list-section">
          <Card>
            <h3>Recent Events</h3>
            {existingEvents.length === 0 ? (
              <p className="no-events">No events recorded yet</p>
            ) : (
              <div className="events-list">
                {existingEvents.map((event) => (
                  <div key={event.id} className="event-item">
                    <div className="event-header">
                      <div className="event-info">
                        <h4>{event.description}</h4>
                        <div className="event-meta">
                          <Badge variant={event.eventType === 'outage' ? 'danger' : 'primary'}>
                            {event.eventType}
                          </Badge>
                          <span className="event-date">{event.eventDate}</span>
                        </div>
                      </div>
                      <div className="event-actions">
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => handleEdit(event)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant="danger"
                          onClick={() => setShowDeleteConfirm(event.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    <div className="event-details">
                      <p>{formatCustomerDisplay(event.affectedCustomers)}</p>
                      <p>Created: {new Date(event.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="delete-modal">
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)} />
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this event? This action cannot be undone.</p>
            <div className="modal-actions">
              <Button
                variant="danger"
                onClick={() => handleDelete(showDeleteConfirm)}
              >
                Confirm Delete
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};