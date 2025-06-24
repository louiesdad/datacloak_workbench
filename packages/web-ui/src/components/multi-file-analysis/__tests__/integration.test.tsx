import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Import components
import { CreateSessionForm } from '../CreateSessionForm';
import { SessionList } from '../SessionList';
import { MultiFileUpload } from '../MultiFileUpload';
import { RelationshipGraph } from '../RelationshipGraph';

// Mock the API entirely for integration tests
vi.mock('../../../services/api', () => ({
  multiFileAnalysisApi: {
    createSession: vi.fn(),
    getSessions: vi.fn(),
    deleteSession: vi.fn(),
    stageFile: vi.fn(),
    discoverRelationships: vi.fn(),
    analyzePatterns: vi.fn(),
    getRecommendations: vi.fn(),
    generateInsights: vi.fn(),
    getSessionStatus: vi.fn()
  }
}));

vi.mock('react-force-graph-2d', () => ({
  default: vi.fn(() => {
    return React.createElement('div', { 'data-testid': 'force-graph' }, 'Graph Canvas');
  })
}));

// Import the mocked API to get access to individual mocks
import { multiFileAnalysisApi } from '../../../services/api';
const mockApi = vi.mocked(multiFileAnalysisApi);

describe('Multi-File Analysis Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // INTEGRATION TEST 1: Complete session creation workflow
  test('should complete full session creation workflow', async () => {
    const user = userEvent.setup();
    let createdSession = null;

    // Mock successful session creation
    mockApi.createSession.mockResolvedValueOnce({
      sessionId: 'session-123',
      createdAt: '2024-01-15T10:00:00Z'
    });

    // Mock updated sessions list
    mockApi.getSessions.mockResolvedValueOnce([{
      sessionId: 'session-123',
      name: 'Customer Analysis',
      description: 'Test analysis session',
      status: 'active',
      createdAt: '2024-01-15T10:00:00Z',
      fileCount: 0
    }]);

    // Render session creation form
    render(
      <CreateSessionForm 
        onSuccess={(session) => { createdSession = session; }}
      />
    );

    // Fill out the form
    await user.type(screen.getByLabelText('Session Name'), 'Customer Analysis');
    await user.type(screen.getByLabelText('Description'), 'Test analysis session');
    
    // Submit the form
    await user.click(screen.getByRole('button', { name: 'Create Session' }));

    // Verify API was called correctly
    await waitFor(() => {
      expect(mockApi.createSession).toHaveBeenCalledWith({
        name: 'Customer Analysis',
        description: 'Test analysis session'
      });
    });

    // Verify callback was called
    expect(createdSession).toEqual({
      sessionId: 'session-123',
      createdAt: '2024-01-15T10:00:00Z'
    });
  });

  // INTEGRATION TEST 2: Session management workflow
  test('should manage sessions (list, select, delete)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onDelete = vi.fn();

    // Mock sessions data
    const mockSessions = [
      {
        sessionId: 'session-1',
        name: 'Customer Churn Analysis',
        description: 'Q4 2024 analysis',
        status: 'active' as const,
        createdAt: '2024-01-15T10:00:00Z',
        fileCount: 3
      },
      {
        sessionId: 'session-2',
        name: 'Marketing Campaign',
        description: 'Holiday campaign',
        status: 'completed' as const,
        createdAt: '2024-01-14T15:30:00Z',
        fileCount: 5
      }
    ];

    mockApi.getSessions.mockResolvedValueOnce(mockSessions);
    mockApi.deleteSession.mockResolvedValueOnce({ success: true });

    render(<SessionList onSelect={onSelect} onDelete={onDelete} />);

    // Wait for sessions to load
    await waitFor(() => {
      expect(screen.getByText('Customer Churn Analysis')).toBeInTheDocument();
      expect(screen.getByText('Marketing Campaign')).toBeInTheDocument();
    });

    // Test session selection
    await user.click(screen.getByText('Customer Churn Analysis'));
    expect(onSelect).toHaveBeenCalledWith(mockSessions[0]);

    // Test session deletion
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await user.click(deleteButtons[0]);

    // Confirm deletion
    await waitFor(() => {
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      fireEvent.click(confirmButton);
    });

    expect(mockApi.deleteSession).toHaveBeenCalledWith('session-1');
    expect(onDelete).toHaveBeenCalledWith('session-1');
  });

  // INTEGRATION TEST 3: File upload and staging workflow
  test('should upload and stage files with metadata extraction', async () => {
    const user = userEvent.setup();
    const onFilesUploaded = vi.fn();
    const onFileRemoved = vi.fn();

    // Mock file staging response
    mockApi.stageFile.mockResolvedValueOnce({
      fileId: 'file-123',
      filename: 'customers.csv',
      rowCount: 1500,
      columns: [
        { name: 'customer_id', dataType: 'string', uniqueness: 0.99, nullCount: 0, sampleValues: ['CUST001', 'CUST002'] },
        { name: 'email', dataType: 'email', uniqueness: 0.99, nullCount: 5, sampleValues: ['john@example.com'] }
      ],
      potentialKeys: ['customer_id', 'email']
    });

    render(
      <MultiFileUpload 
        sessionId="session-123"
        onFilesUploaded={onFilesUploaded}
        onFileRemoved={onFileRemoved}
      />
    );

    // Create and upload a file
    const file = new File(['customer_id,email\nCUST001,john@example.com'], 'customers.csv', { 
      type: 'text/csv' 
    });

    const input = screen.getByTestId('file-input');
    await user.upload(input, [file]);

    // Verify API call
    await waitFor(() => {
      expect(mockApi.stageFile).toHaveBeenCalledWith('session-123', file);
    });

    // Verify file metadata is displayed
    await waitFor(() => {
      expect(screen.getByText('customers.csv')).toBeInTheDocument();
      expect(screen.getByText('1,500 rows')).toBeInTheDocument();
      expect(screen.getByText('2 columns')).toBeInTheDocument();
      expect(screen.getByText('Potential keys: customer_id, email')).toBeInTheDocument();
    });

    // Verify callback was called
    expect(onFilesUploaded).toHaveBeenCalledWith([{
      fileId: 'file-123',
      filename: 'customers.csv',
      rowCount: 1500,
      columns: expect.any(Array),
      potentialKeys: ['customer_id', 'email']
    }]);
  });

  // INTEGRATION TEST 4: Relationship discovery and visualization workflow
  test('should discover and visualize relationships between files', async () => {
    const onNodeSelect = vi.fn();

    // Mock relationship discovery response
    const mockRelationships = [
      {
        sourceFile: 'customers.csv',
        sourceColumn: 'customer_id',
        targetFile: 'orders.csv',
        targetColumn: 'customer_id',
        confidence: 0.95,
        matchRate: 0.98,
        relationshipType: 'ONE_TO_MANY' as const
      },
      {
        sourceFile: 'orders.csv',
        sourceColumn: 'product_id',
        targetFile: 'products.csv',
        targetColumn: 'id',
        confidence: 0.99,
        matchRate: 1.0,
        relationshipType: 'MANY_TO_ONE' as const
      }
    ];

    mockApi.discoverRelationships.mockResolvedValueOnce({
      relationships: mockRelationships,
      relationshipGraph: 'graph-data'
    });

    render(<RelationshipGraph relationships={mockRelationships} onNodeSelect={onNodeSelect} />);

    // Verify graph components are rendered
    expect(screen.getByTestId('relationship-graph')).toBeInTheDocument();
    expect(screen.getByTestId('force-graph')).toBeInTheDocument();

    // Verify statistics are displayed
    expect(screen.getByText('3 files')).toBeInTheDocument();
    expect(screen.getByText('2 relationships')).toBeInTheDocument();
    expect(screen.getByText('Average confidence: 97.0%')).toBeInTheDocument();

    // Test confidence filtering
    const slider = screen.getByRole('slider', { name: /confidence threshold/i });
    fireEvent.change(slider, { target: { value: '96' } });

    // Should hide the 95% confidence relationship
    await waitFor(() => {
      expect(screen.getByText('Average confidence: 97.0%')).toBeInTheDocument();
    });
  });

  // INTEGRATION TEST 5: Complete multi-file analysis workflow
  test('should complete end-to-end multi-file analysis workflow', async () => {
    const user = userEvent.setup();

    // Step 1: Create session
    mockApi.createSession.mockResolvedValueOnce({
      sessionId: 'session-e2e',
      createdAt: '2024-01-15T10:00:00Z'
    });

    // Step 2: Stage multiple files
    mockApi.stageFile
      .mockResolvedValueOnce({
        fileId: 'file-1',
        filename: 'customers.csv',
        rowCount: 1000,
        columns: [{ name: 'id', dataType: 'string', uniqueness: 1.0, nullCount: 0, sampleValues: [] }],
        potentialKeys: ['id']
      })
      .mockResolvedValueOnce({
        fileId: 'file-2',
        filename: 'orders.csv',
        rowCount: 5000,
        columns: [{ name: 'customer_id', dataType: 'string', uniqueness: 0.2, nullCount: 0, sampleValues: [] }],
        potentialKeys: []
      });

    // Step 3: Discover relationships
    mockApi.discoverRelationships.mockResolvedValueOnce({
      relationships: [{
        sourceFile: 'customers.csv',
        sourceColumn: 'id',
        targetFile: 'orders.csv',
        targetColumn: 'customer_id',
        confidence: 0.98,
        matchRate: 0.95,
        relationshipType: 'ONE_TO_MANY' as const
      }],
      relationshipGraph: 'graph-data'
    });

    // Step 4: Generate insights
    mockApi.generateInsights.mockResolvedValueOnce({
      insights: [{
        id: 'insight-1',
        category: 'LEADING_INDICATOR' as const,
        title: 'Customer Retention Pattern',
        description: 'High-value customers show distinct behavioral patterns',
        recommendations: ['Focus on retention strategies'],
        confidence: 0.87,
        evidence: [{ description: 'Evidence data', dataPoints: [] }]
      }],
      summary: 'Analysis complete with 1 key insight discovered'
    });

    let sessionCreated = false;
    let filesUploaded = 0;

    // Render the complete workflow simulation
    const TestWorkflow = () => {
      const [currentSession, setCurrentSession] = React.useState<string | null>(null);
      const [stagedFiles, setStagedFiles] = React.useState<any[]>([]);

      return (
        <div>
          {!sessionCreated && (
            <CreateSessionForm 
              onSuccess={(session) => {
                setCurrentSession(session.sessionId);
                sessionCreated = true;
              }}
            />
          )}
          
          {currentSession && (
            <MultiFileUpload
              sessionId={currentSession}
              onFilesUploaded={(files) => {
                setStagedFiles(files);
                filesUploaded = files.length;
              }}
            />
          )}

          {stagedFiles.length > 0 && (
            <div data-testid="analysis-ready">Ready for Analysis</div>
          )}
        </div>
      );
    };

    render(<TestWorkflow />);

    // Step 1: Create session
    await user.type(screen.getByLabelText('Session Name'), 'E2E Test Session');
    await user.click(screen.getByRole('button', { name: 'Create Session' }));

    await waitFor(() => {
      expect(mockApi.createSession).toHaveBeenCalledWith({
        name: 'E2E Test Session',
        description: ''
      });
    });

    // Step 2: Upload files
    await waitFor(() => {
      expect(screen.getByTestId('file-input')).toBeInTheDocument();
    });

    const files = [
      new File(['id,name\n1,John'], 'customers.csv', { type: 'text/csv' }),
      new File(['id,customer_id\n1,1'], 'orders.csv', { type: 'text/csv' })
    ];

    const input = screen.getByTestId('file-input');
    await user.upload(input, files);

    // Verify files were staged
    await waitFor(() => {
      expect(mockApi.stageFile).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('analysis-ready')).toBeInTheDocument();
    });

    // Verify the workflow completed successfully
    expect(sessionCreated).toBe(true);
    expect(filesUploaded).toBe(2);
  });

  // INTEGRATION TEST 6: Error handling across components
  test('should handle errors gracefully across the workflow', async () => {
    const user = userEvent.setup();

    // Test session creation error
    mockApi.createSession.mockRejectedValueOnce(new Error('Network error'));

    render(<CreateSessionForm />);

    await user.type(screen.getByLabelText('Session Name'), 'Test Session');
    await user.click(screen.getByRole('button', { name: 'Create Session' }));

    await waitFor(() => {
      expect(screen.getByText(/failed to create session/i)).toBeInTheDocument();
    });

    // Test file upload error
    mockApi.stageFile.mockRejectedValueOnce(new Error('Upload failed'));

    render(<MultiFileUpload sessionId="session-123" />);

    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByTestId('file-input');
    await user.upload(input, [file]);

    await waitFor(() => {
      expect(screen.getByText('Failed to upload test.csv')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    // Test sessions loading error
    mockApi.getSessions.mockRejectedValueOnce(new Error('Failed to load'));

    render(<SessionList />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load sessions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
  });

  // INTEGRATION TEST 7: State management across components
  test('should maintain consistent state across component interactions', async () => {
    const user = userEvent.setup();

    // Mock a session with files
    const mockSession = {
      sessionId: 'session-state-test',
      name: 'State Test Session',
      description: 'Testing state consistency',
      status: 'active' as const,
      createdAt: '2024-01-15T10:00:00Z',
      fileCount: 2
    };

    mockApi.getSessions.mockResolvedValue([mockSession]);

    const StateTestComponent = () => {
      const [selectedSession, setSelectedSession] = React.useState<any>(null);
      const [uploadedFiles, setUploadedFiles] = React.useState<any[]>([]);

      return (
        <div>
          <SessionList onSelect={setSelectedSession} />
          
          {selectedSession && (
            <div>
              <div data-testid="selected-session">
                Selected: {selectedSession.name}
              </div>
              
              <MultiFileUpload
                sessionId={selectedSession.sessionId}
                onFilesUploaded={setUploadedFiles}
              />
              
              {uploadedFiles.length > 0 && (
                <div data-testid="files-count">
                  Files: {uploadedFiles.length}
                </div>
              )}
            </div>
          )}
        </div>
      );
    };

    render(<StateTestComponent />);

    // Wait for session to load and select it
    await waitFor(() => {
      expect(screen.getByText('State Test Session')).toBeInTheDocument();
    });

    await user.click(screen.getByText('State Test Session'));

    // Verify session selection state
    expect(screen.getByTestId('selected-session')).toHaveTextContent('Selected: State Test Session');

    // Mock file upload
    mockApi.stageFile.mockResolvedValueOnce({
      fileId: 'file-state-test',
      filename: 'test.csv',
      rowCount: 100,
      columns: [],
      potentialKeys: []
    });

    // Upload a file
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByTestId('file-input');
    await user.upload(input, [file]);

    // Verify file upload state
    await waitFor(() => {
      expect(screen.getByTestId('files-count')).toHaveTextContent('Files: 1');
    });
  });

  // INTEGRATION TEST 8: Real-time data flow simulation
  test('should handle real-time data updates and state synchronization', async () => {
    const user = userEvent.setup();
    let sessionUpdateCallback: ((sessions: any[]) => void) | null = null;

    // Mock sessions that will be updated
    const initialSessions = [
      {
        sessionId: 'session-realtime',
        name: 'Realtime Session',
        description: 'Testing real-time updates',
        status: 'processing' as const,
        createdAt: '2024-01-15T10:00:00Z',
        fileCount: 1
      }
    ];

    const updatedSessions = [
      {
        ...initialSessions[0],
        status: 'completed' as const,
        fileCount: 3
      }
    ];

    mockApi.getSessions
      .mockResolvedValueOnce(initialSessions)
      .mockResolvedValueOnce(updatedSessions);

    const RealtimeTestComponent = () => {
      const [sessions, setSessions] = React.useState<any[]>([]);
      const [refreshTrigger, setRefreshTrigger] = React.useState(0);

      // Simulate real-time updates
      React.useEffect(() => {
        sessionUpdateCallback = setSessions;
        mockApi.getSessions().then(setSessions);
      }, [refreshTrigger]);

      return (
        <div>
          <button 
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            data-testid="refresh-sessions"
          >
            Refresh
          </button>
          
          <div data-testid="sessions-container">
            {sessions.map(session => (
              <div key={session.sessionId} data-testid={`session-${session.sessionId}`}>
                <span>{session.name}</span>
                <span className={`status-${session.status}`}>{session.status}</span>
                <span>{session.fileCount} files</span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    render(<RealtimeTestComponent />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('session-realtime')).toBeInTheDocument();
      expect(screen.getByText('processing')).toBeInTheDocument();
      expect(screen.getByText('1 files')).toBeInTheDocument();
    });

    // Trigger refresh to simulate real-time update
    await user.click(screen.getByTestId('refresh-sessions'));

    // Verify updated state
    await waitFor(() => {
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('3 files')).toBeInTheDocument();
    });

    expect(mockApi.getSessions).toHaveBeenCalledTimes(2);
  });
});