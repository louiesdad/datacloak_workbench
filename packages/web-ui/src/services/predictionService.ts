const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';

export interface PredictionPoint {
  daysAhead: number;
  predictedSentiment: number;
  confidenceLower: number;
  confidenceUpper: number;
  predictedDate: string;
}

export interface CustomerPrediction {
  customerId: string;
  predictions: PredictionPoint[];
  trajectory?: {
    classification: 'declining' | 'stable' | 'improving' | 'volatile';
    severity: 'high' | 'medium' | 'low' | 'positive';
    volatility?: number;
  };
  trend?: {
    slope: number;
    intercept: number;
    rSquared: number;
  };
  riskAssessment?: {
    isHighRisk: boolean;
    daysUntilThreshold: number;
    currentSentiment: number;
  };
  historicalAccuracy?: {
    mae: number;
    rmse: number;
    accuracy: number;
  };
  generatedAt?: string;
}

export interface HighRiskCustomer {
  customerId: string;
  currentSentiment: number;
  daysUntilThreshold: number;
  riskLevel: 'high' | 'critical';
  lastAnalysisDate: string;
}

export interface RiskAssessmentResult {
  highRiskCustomers: HighRiskCustomer[];
  totalAssessed: number;
  assessedAt: string;
}

export async function getCustomerPredictions(customerId: string): Promise<CustomerPrediction> {
  const response = await fetch(`${API_BASE_URL}/predictions/customer/${customerId}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch predictions');
  }

  return response.json();
}

export async function getHighRiskCustomers(threshold: number = 40): Promise<RiskAssessmentResult> {
  const response = await fetch(`${API_BASE_URL}/predictions/high-risk?threshold=${threshold}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch high-risk customers');
  }

  return response.json();
}

export async function generatePredictions(customerId: string): Promise<CustomerPrediction> {
  const response = await fetch(`${API_BASE_URL}/predictions/generate/${customerId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to generate predictions');
  }

  return response.json();
}

export async function exportPredictions(
  customerId: string, 
  format: 'csv' | 'json' = 'csv'
): Promise<{ url: string }> {
  const response = await fetch(
    `${API_BASE_URL}/predictions/export/${customerId}?format=${format}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to export predictions');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  
  return { url };
}

export async function batchProcessPredictions(): Promise<{
  processed: number;
  successful: number;
  failed: number;
}> {
  const response = await fetch(`${API_BASE_URL}/predictions/batch-process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to process batch predictions');
  }

  return response.json();
}