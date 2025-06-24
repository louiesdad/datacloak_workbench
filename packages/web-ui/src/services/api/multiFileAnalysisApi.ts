// Multi-File Analysis API client

export interface CreateSessionRequest {
  name: string;
  description: string;
}

export interface SessionResponse {
  sessionId: string;
  createdAt: string;
}

export interface FileMetadata {
  fileId: string;
  filename: string;
  rowCount: number;
  columns: ColumnProfile[];
  potentialKeys: string[];
}

export interface ColumnProfile {
  name: string;
  dataType: string;
  uniqueness: number;
  nullCount: number;
  sampleValues: string[];
}

export interface Relationship {
  sourceFile: string;
  sourceColumn: string;
  targetFile: string;
  targetColumn: string;
  confidence: number;
  matchRate: number;
  relationshipType: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
}

export interface Pattern {
  id: string;
  description: string;
  sourceMetric: string;
  targetMetric: string;
  correlation: number;
  lagDays?: number;
  confidence: number;
}

export interface JoinRecommendation {
  files: string[];
  joinKeys: Array<{
    leftFile: string;
    leftColumn: string;
    rightFile: string;
    rightColumn: string;
  }>;
  expectedImprovement: number;
  sentimentCoverage: number;
  sampleQuery: string;
}

export interface Insight {
  id: string;
  category: 'LEADING_INDICATOR' | 'DATA_QUALITY' | 'HIDDEN_SEGMENT' | 'ANOMALY';
  title: string;
  description: string;
  recommendations: string[];
  confidence: number;
  evidence: Array<{
    description: string;
    dataPoints: any[];
  }>;
}

export interface Session {
  sessionId: string;
  name: string;
  description: string;
  status: 'active' | 'processing' | 'completed' | 'error';
  createdAt: string;
  fileCount: number;
}

class MultiFileAnalysisApi {
  private baseUrl = '/api/v3';

  async createSession(data: CreateSessionRequest): Promise<SessionResponse> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    return response.json();
  }

  async getSessions(): Promise<Session[]> {
    const response = await fetch(`${this.baseUrl}/sessions`);

    if (!response.ok) {
      throw new Error('Failed to fetch sessions');
    }

    return response.json();
  }

  async deleteSession(sessionId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete session');
    }

    return response.json();
  }

  async stageFile(sessionId: string, file: File): Promise<FileMetadata> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/files`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to stage file');
    }

    return response.json();
  }

  async discoverRelationships(
    sessionId: string,
    options?: { threshold?: number }
  ): Promise<{ relationships: Relationship[]; relationshipGraph: string }> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/discover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options || {}),
    });

    if (!response.ok) {
      throw new Error('Failed to discover relationships');
    }

    return response.json();
  }

  async analyzePatterns(sessionId: string): Promise<Pattern[]> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/analyze`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to analyze patterns');
    }

    return response.json();
  }

  async getRecommendations(sessionId: string): Promise<JoinRecommendation[]> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/recommendations`);

    if (!response.ok) {
      throw new Error('Failed to get recommendations');
    }

    return response.json();
  }

  async generateInsights(sessionId: string): Promise<{
    insights: Insight[];
    summary: string;
  }> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/insights`);

    if (!response.ok) {
      throw new Error('Failed to generate insights');
    }

    return response.json();
  }

  async getSessionStatus(sessionId: string): Promise<{
    status: 'active' | 'processing' | 'completed' | 'error';
    progress: number;
    currentStep: string;
  }> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/status`);

    if (!response.ok) {
      throw new Error('Failed to get session status');
    }

    return response.json();
  }
}

export const multiFileAnalysisApi = new MultiFileAnalysisApi();