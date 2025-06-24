import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionList } from '../SessionList';
import { vi } from 'vitest';

// Mock API
const mockGetSessions = vi.fn();
const mockDeleteSession = vi.fn();

vi.mock('../../../services/api', () => ({
  multiFileAnalysisApi: {
    getSessions: mockGetSessions,
    deleteSession: mockDeleteSession
  }
}));

describe('SessionList', () => {
  const mockSessions = [
    {
      sessionId: 'session-1',
      name: 'Customer Churn Analysis',
      description: 'Q4 2024 analysis',
      status: 'active',
      createdAt: '2024-01-15T10:00:00Z',
      fileCount: 3
    },
    {
      sessionId: 'session-2',
      name: 'Marketing Campaign Impact',
      description: 'Holiday campaign effectiveness',
      status: 'completed',
      createdAt: '2024-01-14T15:30:00Z',
      fileCount: 5
    },
    {
      sessionId: 'session-3',
      name: 'Product Feedback Analysis',
      description: '',
      status: 'processing',
      createdAt: '2024-01-13T09:00:00Z',
      fileCount: 2
    }
  ];

  beforeEach(() => {
    mockGetSessions.mockClear();
    mockDeleteSession.mockClear();
  });

  // RED TEST 1: Display list of sessions
  test('should display list of analysis sessions', async () => {
    mockGetSessions.mockResolvedValueOnce(mockSessions);
    
    render(<SessionList />);
    
    await waitFor(() => {
      expect(screen.getByText('Customer Churn Analysis')).toBeInTheDocument();
      expect(screen.getByText('Marketing Campaign Impact')).toBeInTheDocument();
      expect(screen.getByText('Product Feedback Analysis')).toBeInTheDocument();
    });
  });

  // RED TEST 2: Display session details
  test('should display session details correctly', async () => {
    mockGetSessions.mockResolvedValueOnce([mockSessions[0]]);
    
    render(<SessionList />);
    
    await waitFor(() => {
      expect(screen.getByText('Q4 2024 analysis')).toBeInTheDocument();
      expect(screen.getByText('3 files')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    });
  });

  // RED TEST 3: Handle session selection
  test('should handle session selection', async () => {
    const onSelect = vi.fn();
    mockGetSessions.mockResolvedValueOnce(mockSessions);
    
    render(<SessionList onSelect={onSelect} />);
    
    await waitFor(() => {
      const session1 = screen.getByText('Customer Churn Analysis');
      fireEvent.click(session1);
    });
    
    expect(onSelect).toHaveBeenCalledWith(mockSessions[0]);
  });

  // RED TEST 4: Status badges styling
  test('should display appropriate status badges', async () => {
    mockGetSessions.mockResolvedValueOnce(mockSessions);
    
    render(<SessionList />);
    
    await waitFor(() => {
      const activeStatus = screen.getByText('active');
      const completedStatus = screen.getByText('completed');
      const processingStatus = screen.getByText('processing');
      
      expect(activeStatus).toHaveClass('status-active');
      expect(completedStatus).toHaveClass('status-completed');
      expect(processingStatus).toHaveClass('status-processing');
    });
  });

  // RED TEST 5: Empty state
  test('should display empty state when no sessions', async () => {
    mockGetSessions.mockResolvedValueOnce([]);
    
    render(<SessionList />);
    
    await waitFor(() => {
      expect(screen.getByText('No analysis sessions yet')).toBeInTheDocument();
      expect(screen.getByText('Create your first session to get started')).toBeInTheDocument();
    });
  });

  // RED TEST 6: Loading state
  test('should display loading state while fetching', () => {
    mockGetSessions.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );
    
    render(<SessionList />);
    
    expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
  });

  // RED TEST 7: Error state
  test('should display error state on fetch failure', async () => {
    mockGetSessions.mockRejectedValueOnce(new Error('Network error'));
    
    render(<SessionList />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load sessions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
  });

  // RED TEST 8: Delete session
  test('should handle session deletion', async () => {
    const onDelete = vi.fn();
    mockGetSessions.mockResolvedValueOnce(mockSessions);
    mockDeleteSession.mockResolvedValueOnce({ success: true });
    
    render(<SessionList onDelete={onDelete} />);
    
    await waitFor(() => {
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);
    });
    
    // Confirm deletion
    await waitFor(() => {
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      fireEvent.click(confirmButton);
    });
    
    expect(mockDeleteSession).toHaveBeenCalledWith('session-1');
    expect(onDelete).toHaveBeenCalledWith('session-1');
  });

  // RED TEST 9: Search/filter sessions
  test('should filter sessions by search term', async () => {
    mockGetSessions.mockResolvedValueOnce(mockSessions);
    
    render(<SessionList />);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search sessions...');
      fireEvent.change(searchInput, { target: { value: 'churn' } });
    });
    
    expect(screen.getByText('Customer Churn Analysis')).toBeInTheDocument();
    expect(screen.queryByText('Marketing Campaign Impact')).not.toBeInTheDocument();
  });

  // RED TEST 10: Sort sessions
  test('should sort sessions by date', async () => {
    mockGetSessions.mockResolvedValueOnce(mockSessions);
    
    render(<SessionList />);
    
    await waitFor(() => {
      const sortButton = screen.getByRole('button', { name: /sort/i });
      fireEvent.click(sortButton);
    });
    
    const sessionNames = screen.getAllByTestId('session-name')
      .map(el => el.textContent);
    
    expect(sessionNames[0]).toBe('Customer Churn Analysis'); // Most recent
    expect(sessionNames[2]).toBe('Product Feedback Analysis'); // Oldest
  });
});