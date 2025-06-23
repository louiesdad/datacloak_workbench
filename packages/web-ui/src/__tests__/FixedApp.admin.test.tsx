import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import FixedApp from '../FixedApp';

// Mock fetch
global.fetch = jest.fn();

describe('FixedApp Admin Panel', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Admin Navigation', () => {
    it('should display admin menu item', () => {
      render(<FixedApp />);
      
      const adminMenuItem = screen.getByText('Admin');
      expect(adminMenuItem).toBeInTheDocument();
      
      const adminIcon = screen.getByText('🔐');
      expect(adminIcon).toBeInTheDocument();
    });

    it('should allow navigation to admin panel without uploading data', () => {
      render(<FixedApp />);
      
      const adminMenuItem = screen.getByText('Admin').closest('.step-item');
      fireEvent.click(adminMenuItem!);
      
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Please enter admin password to access logs and configuration.')).toBeInTheDocument();
    });
  });

  describe('Admin Login', () => {
    it('should display login form with password hint', () => {
      render(<FixedApp />);
      
      // Navigate to admin
      const adminMenuItem = screen.getByText('Admin').closest('.step-item');
      fireEvent.click(adminMenuItem!);
      
      expect(screen.getByPlaceholderText('Admin password')).toBeInTheDocument();
      expect(screen.getByText('Password: testpassword123')).toBeInTheDocument();
      expect(screen.getByText('Login')).toBeInTheDocument();
    });

    it('should show error when password is empty', async () => {
      render(<FixedApp />);
      
      // Navigate to admin
      const adminMenuItem = screen.getByText('Admin').closest('.step-item');
      fireEvent.click(adminMenuItem!);
      
      // Click login without entering password
      const loginButton = screen.getByText('Login');
      fireEvent.click(loginButton);
      
      await waitFor(() => {
        expect(screen.getByText('❌ Please enter admin password')).toBeInTheDocument();
      });
    });

    it('should attempt login with correct endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'test-token', expiresIn: 3600 })
      });

      render(<FixedApp />);
      
      // Navigate to admin
      const adminMenuItem = screen.getByText('Admin').closest('.step-item');
      fireEvent.click(adminMenuItem!);
      
      // Enter password
      const passwordInput = screen.getByPlaceholderText('Admin password');
      await userEvent.type(passwordInput, 'testpassword123');
      
      // Click login
      const loginButton = screen.getByText('Login');
      fireEvent.click(loginButton);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3001/api/auth/login',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'admin',
              password: 'testpassword123'
            })
          }
        );
      });
    });

    it('should handle login failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      render(<FixedApp />);
      
      // Navigate to admin
      const adminMenuItem = screen.getByText('Admin').closest('.step-item');
      fireEvent.click(adminMenuItem!);
      
      // Enter password and login
      const passwordInput = screen.getByPlaceholderText('Admin password');
      await userEvent.type(passwordInput, 'wrongpassword');
      
      const loginButton = screen.getByText('Login');
      fireEvent.click(loginButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Admin login failed: Invalid password/)).toBeInTheDocument();
      });
    });

    it('should support login via Enter key', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'test-token' })
      });

      render(<FixedApp />);
      
      // Navigate to admin
      const adminMenuItem = screen.getByText('Admin').closest('.step-item');
      fireEvent.click(adminMenuItem!);
      
      // Enter password and press Enter
      const passwordInput = screen.getByPlaceholderText('Admin password');
      await userEvent.type(passwordInput, 'testpassword123');
      fireEvent.keyPress(passwordInput, { key: 'Enter', code: 'Enter' });
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3001/api/auth/login',
          expect.any(Object)
        );
      });
    });
  });

  describe('Admin Dashboard', () => {
    beforeEach(async () => {
      // Mock successful login
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'test-token' })
        })
        // Mock logs response
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                timestamp: new Date().toISOString(),
                type: 'request',
                model: 'gpt-3.5-turbo',
                responseTime: 1234,
                tokenUsage: { totalTokens: 150, estimatedCost: 0.0003 }
              },
              {
                timestamp: new Date().toISOString(),
                type: 'error',
                model: 'gpt-4',
                error: 'Rate limit exceeded'
              }
            ]
          })
        })
        // Mock stats response
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              logs: { totalRequests: 42 },
              costs: {
                daily: {
                  total: { tokens: 5000, cost: 0.015 }
                }
              },
              rateLimit: {
                tokensRemaining: 2,
                maxTokens: 3
              }
            }
          })
        });
    });

    it('should display admin panel after successful login', async () => {
      render(<FixedApp />);
      
      // Navigate to admin
      const adminMenuItem = screen.getByText('Admin').closest('.step-item');
      fireEvent.click(adminMenuItem!);
      
      // Login
      const passwordInput = screen.getByPlaceholderText('Admin password');
      await userEvent.type(passwordInput, 'testpassword123');
      fireEvent.click(screen.getByText('Login'));
      
      await waitFor(() => {
        expect(screen.getByText('OpenAI Usage Statistics')).toBeInTheDocument();
        expect(screen.getByText('Recent API Logs')).toBeInTheDocument();
      });
    });

    it('should display usage statistics', async () => {
      render(<FixedApp />);
      
      // Navigate and login
      fireEvent.click(screen.getByText('Admin').closest('.step-item')!);
      const passwordInput = screen.getByPlaceholderText('Admin password');
      await userEvent.type(passwordInput, 'testpassword123');
      fireEvent.click(screen.getByText('Login'));
      
      await waitFor(() => {
        expect(screen.getByText('Total Requests')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
        
        expect(screen.getByText('Total Tokens')).toBeInTheDocument();
        expect(screen.getByText('5000')).toBeInTheDocument();
        
        expect(screen.getByText('Daily Cost')).toBeInTheDocument();
        expect(screen.getByText('$0.0150')).toBeInTheDocument();
        
        expect(screen.getByText('Rate Limit')).toBeInTheDocument();
        expect(screen.getByText('2 / 3')).toBeInTheDocument();
      });
    });

    it('should display API logs', async () => {
      render(<FixedApp />);
      
      // Navigate and login
      fireEvent.click(screen.getByText('Admin').closest('.step-item')!);
      const passwordInput = screen.getByPlaceholderText('Admin password');
      await userEvent.type(passwordInput, 'testpassword123');
      fireEvent.click(screen.getByText('Login'));
      
      await waitFor(() => {
        // Check for log entries
        expect(screen.getByText('request')).toBeInTheDocument();
        expect(screen.getByText('gpt-3.5-turbo')).toBeInTheDocument();
        expect(screen.getByText(/Response time: 1234ms/)).toBeInTheDocument();
        
        expect(screen.getByText('error')).toBeInTheDocument();
        expect(screen.getByText('gpt-4')).toBeInTheDocument();
        expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
      });
    });

    it('should handle refresh data', async () => {
      render(<FixedApp />);
      
      // Navigate and login
      fireEvent.click(screen.getByText('Admin').closest('.step-item')!);
      const passwordInput = screen.getByPlaceholderText('Admin password');
      await userEvent.type(passwordInput, 'testpassword123');
      fireEvent.click(screen.getByText('Login'));
      
      await waitFor(() => {
        expect(screen.getByText('Refresh Data')).toBeInTheDocument();
      });
      
      // Mock refresh responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: {} })
        });
      
      // Click refresh
      fireEvent.click(screen.getByText('Refresh Data'));
      
      await waitFor(() => {
        // Should have made 2 additional calls (logs + stats)
        expect(global.fetch).toHaveBeenCalledTimes(5); // 1 login + 2 initial + 2 refresh
      });
    });

    it('should handle logout', async () => {
      render(<FixedApp />);
      
      // Navigate and login
      fireEvent.click(screen.getByText('Admin').closest('.step-item')!);
      const passwordInput = screen.getByPlaceholderText('Admin password');
      await userEvent.type(passwordInput, 'testpassword123');
      fireEvent.click(screen.getByText('Login'));
      
      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });
      
      // Click logout
      fireEvent.click(screen.getByText('Logout'));
      
      // Should return to login form
      expect(screen.getByPlaceholderText('Admin password')).toBeInTheDocument();
      expect(screen.queryByText('OpenAI Usage Statistics')).not.toBeInTheDocument();
    });

    it('should handle empty logs gracefully', async () => {
      // Override mock for empty logs
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'test-token' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: {} })
        });

      render(<FixedApp />);
      
      // Navigate and login
      fireEvent.click(screen.getByText('Admin').closest('.step-item')!);
      const passwordInput = screen.getByPlaceholderText('Admin password');
      await userEvent.type(passwordInput, 'testpassword123');
      fireEvent.click(screen.getByText('Login'));
      
      await waitFor(() => {
        expect(screen.getByText('No logs available')).toBeInTheDocument();
      });
    });
  });

  describe('Admin Console Logging', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    afterEach(() => {
      consoleSpy.mockClear();
      consoleErrorSpy.mockClear();
    });

    afterAll(() => {
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should log API responses to console', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'test-token' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: {} })
        });

      render(<FixedApp />);
      
      // Navigate and login
      fireEvent.click(screen.getByText('Admin').closest('.step-item')!);
      const passwordInput = screen.getByPlaceholderText('Admin password');
      await userEvent.type(passwordInput, 'testpassword123');
      fireEvent.click(screen.getByText('Login'));
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Fetching logs with token:', 'test-token');
        expect(consoleSpy).toHaveBeenCalledWith('Logs response status:', 200);
        expect(consoleSpy).toHaveBeenCalledWith('Logs result:', { data: [] });
        expect(consoleSpy).toHaveBeenCalledWith('Stats response status:', 200);
        expect(consoleSpy).toHaveBeenCalledWith('Stats result:', { data: {} });
      });
    });

    it('should log errors when API calls fail', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'test-token' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({ error: 'Forbidden' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' })
        });

      render(<FixedApp />);
      
      // Navigate and login
      fireEvent.click(screen.getByText('Admin').closest('.step-item')!);
      const passwordInput = screen.getByPlaceholderText('Admin password');
      await userEvent.type(passwordInput, 'testpassword123');
      fireEvent.click(screen.getByText('Login'));
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Logs fetch failed:', { error: 'Forbidden' });
        expect(consoleErrorSpy).toHaveBeenCalledWith('Stats fetch failed:', { error: 'Server error' });
      });
    });
  });
});