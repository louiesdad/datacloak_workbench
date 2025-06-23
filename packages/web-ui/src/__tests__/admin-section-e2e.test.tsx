import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import FixedApp from '../FixedApp';

describe('E2E: Admin/Logs Section - User Experience', () => {
  beforeEach(() => {
    // Mock fetch
    global.fetch = vi.fn();
    
    // Default mock responses
    (global.fetch as any).mockImplementation((url: string) => {
      // Mock successful responses for all endpoints
      if (url.includes('/api/v1/openai/logs')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              {
                timestamp: new Date().toISOString(),
                type: 'request',
                model: 'gpt-3.5-turbo',
                responseTime: 250
              }
            ]
          })
        });
      }
      
      if (url.includes('/api/v1/openai/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              logs: { totalRequests: 100 },
              costs: { daily: { total: { tokens: 5000, cost: 0.15 } } },
              rateLimit: { tokensRemaining: 3, maxTokens: 3 }
            }
          })
        });
      }
      
      // Default response
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  it('User Flow: Navigate to Logs and see dashboard', async () => {
    const { container } = render(<FixedApp />);
    
    // Step 1: User sees the app with navigation
    expect(screen.getByText('Upload Data')).toBeInTheDocument();
    const logsButton = screen.getByText('Logs');
    expect(logsButton).toBeInTheDocument();
    
    // Step 2: User clicks on Logs
    fireEvent.click(logsButton);
    
    // Step 3: User should immediately see the dashboard (NO LOGIN!)
    await waitFor(() => {
      // Should see dashboard title
      expect(screen.getByText('DataCloak Admin Dashboard')).toBeInTheDocument();
    });
    
    // Step 4: User should see tabs
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Jobs')).toBeInTheDocument();
    expect(screen.getByText('Usage & Costs')).toBeInTheDocument();
    expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    
    // Step 5: Tabs should be clickable and styled
    const jobsTab = screen.getByText('Jobs');
    expect(jobsTab.tagName).toBe('BUTTON');
    expect(jobsTab).toHaveStyle({ cursor: 'pointer' });
    
    // Step 6: Click Jobs tab
    fireEvent.click(jobsTab);
    
    // Should see Jobs content
    await waitFor(() => {
      expect(screen.getByText('Job Queue Monitor')).toBeInTheDocument();
    });
    
    // Step 7: Click Usage tab
    const usageTab = screen.getByText('Usage & Costs');
    fireEvent.click(usageTab);
    
    await waitFor(() => {
      expect(screen.getByText('OpenAI Usage & Cost Tracking')).toBeInTheDocument();
    });
    
    // Step 8: NO LOGIN FORM SHOULD APPEAR
    expect(screen.queryByText('Password')).not.toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('password')).not.toBeInTheDocument();
  });

  it('Visual: Dashboard should be properly styled', () => {
    render(<FixedApp />);
    
    // Navigate to logs
    fireEvent.click(screen.getByText('Logs'));
    
    // Check for proper styling classes
    const dashboard = document.querySelector('.simplified-admin-dashboard');
    expect(dashboard).toBeInTheDocument();
    
    const tabs = document.querySelector('.dashboard-tabs');
    expect(tabs).toBeInTheDocument();
    
    // Buttons should have proper classes
    const buttons = tabs?.querySelectorAll('button');
    expect(buttons?.length).toBeGreaterThan(0);
  });

  it('Functionality: All tabs should work', async () => {
    render(<FixedApp />);
    
    // Navigate to logs
    fireEvent.click(screen.getByText('Logs'));
    
    // Test each tab
    const tabs = ['Overview', 'Jobs', 'Usage & Costs', 'Audit Trail'];
    
    for (const tabName of tabs) {
      const tab = screen.getByText(tabName);
      fireEvent.click(tab);
      
      // Tab should become active
      expect(tab.className).toContain('active');
      
      // Content should change based on tab
      if (tabName === 'Overview') {
        expect(screen.getByText('System Health')).toBeInTheDocument();
      } else if (tabName === 'Jobs') {
        expect(screen.getByText('Job Queue Monitor')).toBeInTheDocument();
      } else if (tabName === 'Usage & Costs') {
        expect(screen.getByText('OpenAI Usage & Cost Tracking')).toBeInTheDocument();
      } else if (tabName === 'Audit Trail') {
        expect(screen.getByText('Analysis Decision Audit Trail')).toBeInTheDocument();
      }
    }
  });
});