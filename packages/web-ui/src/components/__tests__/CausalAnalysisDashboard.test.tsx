import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CausalAnalysisDashboard } from '../CausalAnalysisDashboard';

// Mock the API calls
const mockGetEventImpacts = jest.fn();
const mockGetEventsByDateRange = jest.fn();

jest.mock('../../services/analysisAuditService', () => ({
  analysisAuditService: {
    getEventImpacts: (...args: any[]) => mockGetEventImpacts(...args),
    getEventsByDateRange: (...args: any[]) => mockGetEventsByDateRange(...args),
  },
}));

// Mock recharts to avoid render issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
}));

describe('CausalAnalysisDashboard', () => {
  const mockEventImpacts = [
    {
      eventId: 'event-1',
      eventType: 'outage',
      eventDate: '2024-05-03',
      description: 'Website outage - 4 hours',
      impact: -15.5,
      percentageChange: -20.13,
      isSignificant: true,
      confidence: 0.99,
      customersAffected: 150,
    },
    {
      eventId: 'event-2',
      eventType: 'price_increase',
      eventDate: '2024-06-01',
      description: 'Price increase - 10% across all products',
      impact: -7.2,
      percentageChange: -9.6,
      isSignificant: true,
      confidence: 0.95,
      customersAffected: 500,
    },
    {
      eventId: 'event-3',
      eventType: 'feature_launch',
      eventDate: '2024-04-15',
      description: 'New AI assistant feature',
      impact: 8.3,
      percentageChange: 11.2,
      isSignificant: true,
      confidence: 0.92,
      customersAffected: 300,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Loading', () => {
    test('should show loading spinner while fetching data', () => {
      // Mock API to never resolve
      mockGetEventImpacts.mockImplementation(() => new Promise(() => {}));
      
      render(<CausalAnalysisDashboard />);
      
      expect(screen.getByText(/loading event impacts/i)).toBeInTheDocument();
    });

    test('should handle API errors gracefully', async () => {
      // Mock API error
      mockGetEventImpacts.mockRejectedValue(new Error('Failed to fetch event impacts'));
      
      render(<CausalAnalysisDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText(/error loading event impacts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Event Impact Visualization', () => {
    beforeEach(() => {
      mockGetEventImpacts.mockResolvedValue(mockEventImpacts);
    });

    test('should display event impacts when data loads', async () => {
      render(<CausalAnalysisDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Website outage - 4 hours')).toBeInTheDocument();
        expect(screen.getByText('Price increase - 10% across all products')).toBeInTheDocument();
        expect(screen.getByText('New AI assistant feature')).toBeInTheDocument();
      });
    });

    test('should render impact chart', async () => {
      render(<CausalAnalysisDashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });

    test('should show impact percentages', async () => {
      render(<CausalAnalysisDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('-15.5%')).toBeInTheDocument();
        expect(screen.getByText('-7.2%')).toBeInTheDocument();
        expect(screen.getByText('+8.3%')).toBeInTheDocument();
      });
    });

    test('should display significance indicators', async () => {
      render(<CausalAnalysisDashboard />);
      
      await waitFor(() => {
        const significantBadges = screen.getAllByText('Statistically Significant');
        expect(significantBadges).toHaveLength(3);
      });
    });

    test('should show confidence levels', async () => {
      render(<CausalAnalysisDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('99% confidence')).toBeInTheDocument();
        expect(screen.getByText('95% confidence')).toBeInTheDocument();
        expect(screen.getByText('92% confidence')).toBeInTheDocument();
      });
    });
  });

  describe('Event Filtering and Sorting', () => {
    beforeEach(() => {
      mockGetEventImpacts.mockResolvedValue(mockEventImpacts);
    });

    test('should allow filtering by event type', async () => {
      render(<CausalAnalysisDashboard />);
      
      await waitFor(() => {
        const filterSelect = screen.getByDisplayValue('All Event Types');
        fireEvent.change(filterSelect, { target: { value: 'outage' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Website outage - 4 hours')).toBeInTheDocument();
        expect(screen.queryByText('Price increase - 10% across all products')).not.toBeInTheDocument();
      });
    });

    test('should allow sorting by impact magnitude', async () => {
      render(<CausalAnalysisDashboard />);
      
      await waitFor(() => {
        const sortButton = screen.getByText('Sort by Impact');
        fireEvent.click(sortButton);
      });

      // Check that events are displayed in order of impact magnitude (largest first)
      await waitFor(() => {
        const eventDescriptions = screen.getAllByTestId('event-description');
        expect(eventDescriptions[0]).toHaveTextContent('Website outage - 4 hours'); // -15.5%
        expect(eventDescriptions[1]).toHaveTextContent('New AI assistant feature'); // +8.3%
        expect(eventDescriptions[2]).toHaveTextContent('Price increase - 10% across all products'); // -7.2%
      });
    });

    test('should allow date range filtering', async () => {
      render(<CausalAnalysisDashboard />);
      
      await waitFor(() => {
        const startDateInput = screen.getByLabelText(/start date/i);
        const endDateInput = screen.getByLabelText(/end date/i);
        
        fireEvent.change(startDateInput, { target: { value: '2024-05-01' } });
        fireEvent.change(endDateInput, { target: { value: '2024-06-30' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Website outage - 4 hours')).toBeInTheDocument();
        expect(screen.getByText('Price increase - 10% across all products')).toBeInTheDocument();
        expect(screen.queryByText('New AI assistant feature')).not.toBeInTheDocument();
      });
    });
  });

  describe('Detailed Event View', () => {
    beforeEach(() => {
      mockGetEventImpacts.mockResolvedValue(mockEventImpacts);
    });

    test('should show detailed view when event is clicked', async () => {
      render(<CausalAnalysisDashboard />);
      
      await waitFor(() => {
        const eventCard = screen.getByText('Website outage - 4 hours');
        fireEvent.click(eventCard);
      });

      await waitFor(() => {
        expect(screen.getByText('Event Details')).toBeInTheDocument();
        expect(screen.getByText('150 customers affected')).toBeInTheDocument();
        expect(screen.getByText('20.13% decrease')).toBeInTheDocument();
      });
    });

    test('should close detailed view when close button is clicked', async () => {
      render(<CausalAnalysisDashboard />);
      
      // Open detailed view
      await waitFor(() => {
        const eventCard = screen.getByText('Website outage - 4 hours');
        fireEvent.click(eventCard);
      });

      await waitFor(() => {
        expect(screen.getByText('Event Details')).toBeInTheDocument();
      });

      // Close detailed view
      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Event Details')).not.toBeInTheDocument();
      });
    });
  });

  describe('Data Refresh', () => {
    test('should refresh data when refresh button is clicked', async () => {
      mockGetEventImpacts.mockResolvedValue(mockEventImpacts);
      
      render(<CausalAnalysisDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Website outage - 4 hours')).toBeInTheDocument();
      });

      // Clear the mock and set new data
      mockGetEventImpacts.mockClear();
      mockGetEventImpacts.mockResolvedValue([
        {
          eventId: 'event-4',
          eventType: 'promotion',
          eventDate: '2024-07-01',
          description: 'Summer sale promotion',
          impact: 12.5,
          percentageChange: 16.7,
          isSignificant: true,
          confidence: 0.98,
          customersAffected: 800,
        },
      ]);

      const refreshButton = screen.getByText('Refresh Data');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Summer sale promotion')).toBeInTheDocument();
        expect(screen.queryByText('Website outage - 4 hours')).not.toBeInTheDocument();
      });

      expect(mockGetEventImpacts).toHaveBeenCalledTimes(1);
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      mockGetEventImpacts.mockResolvedValue(mockEventImpacts);
    });

    test('should show export button', async () => {
      render(<CausalAnalysisDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Export Report')).toBeInTheDocument();
      });
    });

    test('should handle export action', async () => {
      const mockDownload = jest.fn();
      global.URL.createObjectURL = jest.fn();
      global.URL.revokeObjectURL = jest.fn();
      
      // Mock link click
      const mockLink = {
        href: '',
        download: '',
        click: mockDownload,
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);

      render(<CausalAnalysisDashboard />);
      
      await waitFor(() => {
        const exportButton = screen.getByText('Export Report');
        fireEvent.click(exportButton);
      });

      expect(mockDownload).toHaveBeenCalled();
    });
  });
});