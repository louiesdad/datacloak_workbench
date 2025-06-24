import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateSessionForm } from '../CreateSessionForm';
import { vi } from 'vitest';

// Mock API client - must be hoisted
vi.mock('../../../services/api', () => ({
  multiFileAnalysisApi: {
    createSession: vi.fn()
  }
}));

// Import the mocked API to get access to the mock
import { multiFileAnalysisApi } from '../../../services/api';
const mockCreateSession = vi.mocked(multiFileAnalysisApi.createSession);

describe('CreateSessionForm', () => {
  beforeEach(() => {
    mockCreateSession.mockClear();
  });

  // RED TEST 1: Component should render with required form elements
  test('should display session creation form', () => {
    render(<CreateSessionForm />);
    
    expect(screen.getByLabelText('Session Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Session' })).toBeInTheDocument();
  });

  // RED TEST 2: Form validation - name is required
  test('should validate form inputs', async () => {
    render(<CreateSessionForm />);
    
    const submitButton = screen.getByRole('button', { name: 'Create Session' });
    
    // Try to submit empty form
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Session name is required')).toBeInTheDocument();
    });
  });

  // RED TEST 3: Successful form submission
  test('should create session on valid form submission', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    
    mockCreateSession.mockResolvedValueOnce({
      sessionId: 'test-session-123',
      createdAt: new Date().toISOString()
    });
    
    render(<CreateSessionForm onSuccess={onSuccess} />);
    
    // Fill in form
    await user.type(screen.getByLabelText('Session Name'), 'Customer Churn Analysis');
    await user.type(screen.getByLabelText('Description'), 'Analyzing customer behavior patterns');
    
    // Submit form
    await user.click(screen.getByRole('button', { name: 'Create Session' }));
    
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith({
        name: 'Customer Churn Analysis',
        description: 'Analyzing customer behavior patterns'
      });
      expect(onSuccess).toHaveBeenCalledWith({
        sessionId: 'test-session-123',
        createdAt: expect.any(String)
      });
    });
  });

  // RED TEST 4: Loading state during submission
  test('should show loading state during submission', async () => {
    const user = userEvent.setup();
    
    // Mock a delayed response
    mockCreateSession.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );
    
    render(<CreateSessionForm />);
    
    await user.type(screen.getByLabelText('Session Name'), 'Test Session');
    await user.click(screen.getByRole('button', { name: 'Create Session' }));
    
    expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled();
  });

  // RED TEST 5: Error handling
  test('should display error message on API failure', async () => {
    const user = userEvent.setup();
    
    mockCreateSession.mockRejectedValueOnce(new Error('Network error'));
    
    render(<CreateSessionForm />);
    
    await user.type(screen.getByLabelText('Session Name'), 'Test Session');
    await user.click(screen.getByRole('button', { name: 'Create Session' }));
    
    await waitFor(() => {
      expect(screen.getByText('Failed to create session. Please try again.')).toBeInTheDocument();
    });
  });

  // RED TEST 6: Form reset after successful submission
  test('should reset form after successful submission', async () => {
    const user = userEvent.setup();
    
    mockCreateSession.mockResolvedValueOnce({
      sessionId: 'test-123',
      createdAt: new Date().toISOString()
    });
    
    render(<CreateSessionForm />);
    
    const nameInput = screen.getByLabelText('Session Name');
    const descInput = screen.getByLabelText('Description');
    
    await user.type(nameInput, 'Test Session');
    await user.type(descInput, 'Test Description');
    await user.click(screen.getByRole('button', { name: 'Create Session' }));
    
    await waitFor(() => {
      expect(nameInput).toHaveValue('');
      expect(descInput).toHaveValue('');
    });
  });

  // RED TEST 7: Character limits
  test('should enforce character limits on inputs', async () => {
    const user = userEvent.setup();
    render(<CreateSessionForm />);
    
    const nameInput = screen.getByLabelText('Session Name');
    const longName = 'a'.repeat(256);
    
    await user.type(nameInput, longName);
    
    // Should show character limit warning
    expect(screen.getByText('Session name must be less than 255 characters')).toBeInTheDocument();
  });

  // RED TEST 8: Trimming whitespace
  test('should trim whitespace from inputs', async () => {
    const user = userEvent.setup();
    
    mockCreateSession.mockResolvedValueOnce({
      sessionId: 'test-123',
      createdAt: new Date().toISOString()
    });
    
    render(<CreateSessionForm />);
    
    await user.type(screen.getByLabelText('Session Name'), '  Test Session  ');
    await user.type(screen.getByLabelText('Description'), '  Test Description  ');
    await user.click(screen.getByRole('button', { name: 'Create Session' }));
    
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith({
        name: 'Test Session',
        description: 'Test Description'
      });
    });
  });
});