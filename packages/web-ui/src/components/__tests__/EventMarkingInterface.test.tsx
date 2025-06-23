import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { EventMarkingInterface } from '../EventMarkingInterface';

// Mock the API calls
const mockCreateBusinessEvent = vi.fn();
const mockGetEventsByDateRange = vi.fn();
const mockUpdateBusinessEvent = vi.fn();
const mockDeleteBusinessEvent = vi.fn();

vi.mock('../../services/analysisAuditService', () => ({
  analysisAuditService: {
    createBusinessEvent: (...args: any[]) => mockCreateBusinessEvent(...args),
    getEventsByDateRange: (...args: any[]) => mockGetEventsByDateRange(...args),
    updateBusinessEvent: (...args: any[]) => mockUpdateBusinessEvent(...args),
    deleteBusinessEvent: (...args: any[]) => mockDeleteBusinessEvent(...args),
  },
}));

describe('EventMarkingInterface', () => {
  const mockExistingEvents = [
    {
      id: 'event-1',
      eventType: 'outage',
      eventDate: '2024-05-03',
      description: 'Website outage - 4 hours',
      affectedCustomers: ['cust-1', 'cust-2'],
      createdAt: '2024-05-03T10:00:00Z',
    },
    {
      id: 'event-2',
      eventType: 'price_increase',
      eventDate: '2024-06-01',
      description: 'Price increase - 10% across all products',
      affectedCustomers: 'all',
      createdAt: '2024-06-01T09:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEventsByDateRange.mockResolvedValue(mockExistingEvents);
  });

  describe('Event Creation Form', () => {
    test('should show form to create new business event', async () => {
      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('Mark Business Event')).toBeInTheDocument();
        expect(screen.getByLabelText(/event type/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/event date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/affected customers/i)).toBeInTheDocument();
      });
    });

    test('should validate required fields', async () => {
      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        const submitButton = screen.getByText('Create Event');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/event type is required/i)).toBeInTheDocument();
        expect(screen.getByText(/event date is required/i)).toBeInTheDocument();
        expect(screen.getByText(/description is required/i)).toBeInTheDocument();
      });
    });

    test('should not allow future dates', async () => {
      render(<EventMarkingInterface />);
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateString = futureDate.toISOString().split('T')[0];

      await waitFor(() => {
        const dateInput = screen.getByLabelText(/event date/i);
        fireEvent.change(dateInput, { target: { value: futureDateString } });
        
        const submitButton = screen.getByText('Create Event');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/event date cannot be in the future/i)).toBeInTheDocument();
      });
    });

    test('should create new event when form is valid', async () => {
      mockCreateBusinessEvent.mockResolvedValue({
        id: 'new-event-1',
        eventType: 'feature_launch',
        eventDate: '2024-05-01',
        description: 'New AI assistant feature',
        affectedCustomers: 'all',
        createdAt: '2024-05-01T10:00:00Z',
      });

      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        const typeSelect = screen.getByLabelText(/event type/i);
        const dateInput = screen.getByLabelText(/event date/i);
        const descriptionInput = screen.getByLabelText(/description/i);
        const customersSelect = screen.getByLabelText(/affected customers/i);

        fireEvent.change(typeSelect, { target: { value: 'feature_launch' } });
        fireEvent.change(dateInput, { target: { value: '2024-05-01' } });
        fireEvent.change(descriptionInput, { target: { value: 'New AI assistant feature' } });
        fireEvent.change(customersSelect, { target: { value: 'all' } });

        const submitButton = screen.getByText('Create Event');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockCreateBusinessEvent).toHaveBeenCalledWith({
          eventType: 'feature_launch',
          eventDate: '2024-05-01',
          description: 'New AI assistant feature',
          affectedCustomers: 'all',
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/event created successfully/i)).toBeInTheDocument();
      });
    });

    test('should handle API errors during creation', async () => {
      mockCreateBusinessEvent.mockRejectedValue(new Error('Failed to create event'));

      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        const typeSelect = screen.getByLabelText(/event type/i);
        const dateInput = screen.getByLabelText(/event date/i);
        const descriptionInput = screen.getByLabelText(/description/i);

        fireEvent.change(typeSelect, { target: { value: 'outage' } });
        fireEvent.change(dateInput, { target: { value: '2024-05-01' } });
        fireEvent.change(descriptionInput, { target: { value: 'Test outage' } });

        const submitButton = screen.getByText('Create Event');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/failed to create event/i)).toBeInTheDocument();
      });
    });
  });

  describe('Existing Events List', () => {
    test('should display list of existing events', async () => {
      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('Recent Events')).toBeInTheDocument();
        expect(screen.getByText('Website outage - 4 hours')).toBeInTheDocument();
        expect(screen.getByText('Price increase - 10% across all products')).toBeInTheDocument();
      });
    });

    test('should show event details including dates and types', async () => {
      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('2024-05-03')).toBeInTheDocument();
        expect(screen.getByText('outage')).toBeInTheDocument();
        expect(screen.getByText('price_increase')).toBeInTheDocument();
      });
    });

    test('should allow editing existing events', async () => {
      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        const editButtons = screen.getAllByText('Edit');
        fireEvent.click(editButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Website outage - 4 hours')).toBeInTheDocument();
        expect(screen.getByText('Update Event')).toBeInTheDocument();
      });
    });

    test('should update event when edit form is submitted', async () => {
      mockUpdateBusinessEvent.mockResolvedValue({
        ...mockExistingEvents[0],
        description: 'Updated outage description',
      });

      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        const editButtons = screen.getAllByText('Edit');
        fireEvent.click(editButtons[0]);
      });

      await waitFor(() => {
        const descriptionInput = screen.getByDisplayValue('Website outage - 4 hours');
        fireEvent.change(descriptionInput, { target: { value: 'Updated outage description' } });
        
        const updateButton = screen.getByText('Update Event');
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        expect(mockUpdateBusinessEvent).toHaveBeenCalledWith('event-1', {
          description: 'Updated outage description',
        });
      });
    });

    test('should allow deleting events', async () => {
      mockDeleteBusinessEvent.mockResolvedValue(undefined);

      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        const deleteButtons = screen.getAllByText('Delete');
        fireEvent.click(deleteButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to delete this event/i)).toBeInTheDocument();
        const confirmButton = screen.getByText('Confirm Delete');
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockDeleteBusinessEvent).toHaveBeenCalledWith('event-1');
      });
    });
  });

  describe('Event Type Options', () => {
    test('should provide predefined event types', async () => {
      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        const typeSelect = screen.getByLabelText(/event type/i);
        fireEvent.click(typeSelect);
      });

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'outage' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'price_increase' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'feature_launch' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'promotion' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'policy_change' })).toBeInTheDocument();
      });
    });

    test('should allow custom event type input', async () => {
      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        const typeSelect = screen.getByLabelText(/event type/i);
        fireEvent.change(typeSelect, { target: { value: 'custom' } });
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/custom event type/i)).toBeInTheDocument();
      });
    });
  });

  describe('Customer Segmentation', () => {
    test('should allow selecting all customers', async () => {
      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        const customersSelect = screen.getByLabelText(/affected customers/i);
        fireEvent.change(customersSelect, { target: { value: 'all' } });
      });

      expect(screen.getByDisplayValue('all')).toBeInTheDocument();
    });

    test('should allow entering specific customer IDs', async () => {
      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        const customersSelect = screen.getByLabelText(/affected customers/i);
        fireEvent.change(customersSelect, { target: { value: 'specific' } });
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/customer ids/i)).toBeInTheDocument();
        const customerIdsInput = screen.getByLabelText(/customer ids/i);
        fireEvent.change(customerIdsInput, { target: { value: 'cust-1,cust-2,cust-3' } });
      });

      expect(screen.getByDisplayValue('cust-1,cust-2,cust-3')).toBeInTheDocument();
    });
  });

  describe('Form Reset', () => {
    test('should reset form after successful creation', async () => {
      mockCreateBusinessEvent.mockResolvedValue({
        id: 'new-event-1',
        eventType: 'outage',
        eventDate: '2024-05-01',
        description: 'Test outage',
        affectedCustomers: 'all',
        createdAt: '2024-05-01T10:00:00Z',
      });

      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        const typeSelect = screen.getByLabelText(/event type/i);
        const dateInput = screen.getByLabelText(/event date/i);
        const descriptionInput = screen.getByLabelText(/description/i);

        fireEvent.change(typeSelect, { target: { value: 'outage' } });
        fireEvent.change(dateInput, { target: { value: '2024-05-01' } });
        fireEvent.change(descriptionInput, { target: { value: 'Test outage' } });

        const submitButton = screen.getByText('Create Event');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/event type/i)).toHaveValue('');
        expect(screen.getByLabelText(/event date/i)).toHaveValue('');
        expect(screen.getByLabelText(/description/i)).toHaveValue('');
      });
    });

    test('should provide cancel edit functionality', async () => {
      render(<EventMarkingInterface />);
      
      await waitFor(() => {
        const editButtons = screen.getAllByText('Edit');
        fireEvent.click(editButtons[0]);
      });

      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Create Event')).toBeInTheDocument();
        expect(screen.queryByText('Update Event')).not.toBeInTheDocument();
      });
    });
  });
});