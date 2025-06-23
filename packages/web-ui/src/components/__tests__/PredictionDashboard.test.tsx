import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PredictionDashboard } from '../PredictionDashboard';
import * as api from '../../services/predictionService';

// Mock the API service
jest.mock('../../services/predictionService');

// Mock recharts to avoid render issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Area: () => null,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
}));

describe('PredictionDashboard', () => {
  const mockCustomerId = 'cust-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Loading', () => {
    test('should show loading spinner while fetching data', () => {
      // Mock API to never resolve
      (api.getCustomerPredictions as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(<PredictionDashboard customerId={mockCustomerId} />);

      expect(screen.getByText(/loading predictions/i)).toBeInTheDocument();
    });

    test('should handle API errors gracefully', async () => {
      // Mock API error
      (api.getCustomerPredictions as jest.Mock).mockRejectedValue(
        new Error('Failed to fetch predictions')
      );

      render(<PredictionDashboard customerId={mockCustomerId} />);

      await waitFor(() => {
        expect(screen.getByText(/error loading predictions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Prediction Display', () => {
    const mockPredictionData = {
      customerId: 'cust-123',
      predictions: [
        {
          daysAhead: 30,
          predictedSentiment: 65,
          confidenceLower: 55,
          confidenceUpper: 75,
          predictedDate: '2024-02-15',
        },
        {
          daysAhead: 60,
          predictedSentiment: 60,
          confidenceLower: 45,
          confidenceUpper: 75,
          predictedDate: '2024-03-15',
        },
        {
          daysAhead: 90,
          predictedSentiment: 55,
          confidenceLower: 35,
          confidenceUpper: 75,
          predictedDate: '2024-04-15',
        },
      ],
      trajectory: {
        classification: 'declining',
        severity: 'high',
        volatility: 0.1,
      },
      trend: {
        slope: -5,
        intercept: 80,
        rSquared: 0.92,
      },
      generatedAt: '2024-01-15T10:00:00Z',
    };

    test('should display trajectory chart', async () => {
      (api.getCustomerPredictions as jest.Mock).mockResolvedValue(mockPredictionData);

      render(<PredictionDashboard customerId={mockCustomerId} />);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });

    test('should display confidence intervals', async () => {
      (api.getCustomerPredictions as jest.Mock).mockResolvedValue(mockPredictionData);

      render(<PredictionDashboard customerId={mockCustomerId} />);

      await waitFor(() => {
        expect(screen.getByText(/confidence interval/i)).toBeInTheDocument();
      });
    });

    test('should highlight high-risk trajectory', async () => {
      (api.getCustomerPredictions as jest.Mock).mockResolvedValue(mockPredictionData);

      render(<PredictionDashboard customerId={mockCustomerId} />);

      await waitFor(() => {
        expect(screen.getByText(/declining/i)).toBeInTheDocument();
        expect(screen.getByText(/high risk/i)).toBeInTheDocument();
      });
    });

    test('should explain prediction reasoning', async () => {
      (api.getCustomerPredictions as jest.Mock).mockResolvedValue(mockPredictionData);

      render(<PredictionDashboard customerId={mockCustomerId} />);

      await waitFor(() => {
        expect(screen.getByText(/sentiment declining 5% per week/i)).toBeInTheDocument();
        expect(screen.getByText(/92% correlation/i)).toBeInTheDocument();
      });
    });
  });

  describe('Interactive Features', () => {
    const mockPredictionData = {
      customerId: 'cust-123',
      predictions: [
        {
          daysAhead: 30,
          predictedSentiment: 65,
          confidenceLower: 55,
          confidenceUpper: 75,
          predictedDate: '2024-02-15',
        },
      ],
      trajectory: {
        classification: 'stable',
        severity: 'low',
      },
    };

    test('should allow toggling confidence interval display', async () => {
      (api.getCustomerPredictions as jest.Mock).mockResolvedValue(mockPredictionData);

      render(<PredictionDashboard customerId={mockCustomerId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/show confidence intervals/i)).toBeInTheDocument();
      });

      const toggle = screen.getByLabelText(/show confidence intervals/i);
      fireEvent.click(toggle);

      // Verify toggle state changes
      expect(toggle).toBeChecked();
    });

    test('should allow refreshing predictions', async () => {
      (api.getCustomerPredictions as jest.Mock).mockResolvedValue(mockPredictionData);

      render(<PredictionDashboard customerId={mockCustomerId} />);

      await waitFor(() => {
        expect(screen.getByText(/refresh predictions/i)).toBeInTheDocument();
      });

      const refreshButton = screen.getByText(/refresh predictions/i);
      fireEvent.click(refreshButton);

      // Verify API is called again
      expect(api.getCustomerPredictions).toHaveBeenCalledTimes(2);
    });

    test('should show last updated timestamp', async () => {
      (api.getCustomerPredictions as jest.Mock).mockResolvedValue({
        ...mockPredictionData,
        generatedAt: '2024-01-15T10:00:00Z',
      });

      render(<PredictionDashboard customerId={mockCustomerId} />);

      await waitFor(() => {
        expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
        // Should show formatted date
        expect(screen.getByText(/january 15, 2024/i)).toBeInTheDocument();
      });
    });
  });

  describe('Historical Comparison', () => {
    test('should show historical accuracy when available', async () => {
      const mockDataWithHistory = {
        customerId: 'cust-123',
        predictions: [],
        historicalAccuracy: {
          mae: 5.2,
          rmse: 7.1,
          accuracy: 85.3,
        },
      };

      (api.getCustomerPredictions as jest.Mock).mockResolvedValue(mockDataWithHistory);

      render(<PredictionDashboard customerId={mockCustomerId} />);

      await waitFor(() => {
        expect(screen.getByText(/historical accuracy: 85.3%/i)).toBeInTheDocument();
      });
    });
  });

  describe('Risk Alerts', () => {
    test('should show alert for critical risk customers', async () => {
      const criticalRiskData = {
        customerId: 'cust-123',
        predictions: [
          {
            daysAhead: 30,
            predictedSentiment: 25,
            confidenceLower: 15,
            confidenceUpper: 35,
            predictedDate: '2024-02-15',
          },
        ],
        trajectory: {
          classification: 'declining',
          severity: 'high',
        },
        riskAssessment: {
          isHighRisk: true,
          daysUntilThreshold: 7,
          currentSentiment: 35,
        },
      };

      (api.getCustomerPredictions as jest.Mock).mockResolvedValue(criticalRiskData);

      render(<PredictionDashboard customerId={mockCustomerId} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/urgent attention required/i)).toBeInTheDocument();
        expect(screen.getByText(/7 days until critical threshold/i)).toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality', () => {
    test('should allow exporting prediction data', async () => {
      const mockData = {
        customerId: 'cust-123',
        predictions: [
          {
            daysAhead: 30,
            predictedSentiment: 65,
            confidenceLower: 55,
            confidenceUpper: 75,
            predictedDate: '2024-02-15',
          },
        ],
      };

      (api.getCustomerPredictions as jest.Mock).mockResolvedValue(mockData);
      (api.exportPredictions as jest.Mock).mockResolvedValue({
        url: 'blob:http://localhost/predictions.csv',
      });

      render(<PredictionDashboard customerId={mockCustomerId} />);

      await waitFor(() => {
        expect(screen.getByText(/export predictions/i)).toBeInTheDocument();
      });

      const exportButton = screen.getByText(/export predictions/i);
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(api.exportPredictions).toHaveBeenCalledWith('cust-123', 'csv');
      });
    });
  });
});