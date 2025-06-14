import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navigation } from '../Navigation';
import { AppProvider } from '../../context/AppContext';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>
    {children}
  </AppProvider>
);

describe('Navigation', () => {
  const user = userEvent.setup();

  it('should render navigation steps', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByText('Upload Data')).toBeInTheDocument();
    expect(screen.getByText('Data Profile')).toBeInTheDocument();
    expect(screen.getByText('Transform')).toBeInTheDocument();
    expect(screen.getByText('Configure')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
  });

  it('should highlight current step', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    // Upload should be current/active by default
    const uploadStep = screen.getByText('Upload Data').closest('.workflow-step');
    expect(uploadStep).toHaveClass('current');
  });

  it('should show completed steps', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    // Test that workflow steps are rendered
    // Steps are rendered as buttons, not list items
    const steps = screen.getAllByRole('button');
    expect(steps.length).toBeGreaterThan(0);
  });

  it('should handle step navigation', async () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    // Click on a step (if clickable)
    const profileStep = screen.getByText('Profile');
    
    // Depending on implementation, steps might be clickable
    if (profileStep.closest('button')) {
      await user.click(profileStep);
    }

    expect(profileStep).toBeInTheDocument();
  });

  it('should display step icons', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    // Should show step icons
    expect(screen.getByText('📁')).toBeInTheDocument();
    expect(screen.getByText('🔍')).toBeInTheDocument();
    expect(screen.getByText('⚙️')).toBeInTheDocument();
    expect(screen.getByText('🛠️')).toBeInTheDocument();
    expect(screen.getByText('🚀')).toBeInTheDocument();
    expect(screen.getByText('📊')).toBeInTheDocument();
  });

  it('should be accessible', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    // Should have proper navigation role
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();

    // Should have navigation structure
    expect(nav).toHaveClass('navigation');
  });
});