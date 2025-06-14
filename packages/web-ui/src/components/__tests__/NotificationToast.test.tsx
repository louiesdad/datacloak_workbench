import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationToast } from '../NotificationToast';
import type { Notification } from '../../context/AppContext';

describe('NotificationToast', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockNotification: Notification = {
    id: '1',
    type: 'success',
    title: 'Success!',
    message: 'Operation completed successfully'
  };

  it('should render notification with title and message', () => {
    render(
      <NotificationToast
        notification={mockNotification}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Operation completed successfully')).toBeInTheDocument();
  });

  it('should render different notification types', () => {
    const types: Array<Notification['type']> = ['success', 'error', 'warning', 'info'];

    types.forEach((type) => {
      const notification = { ...mockNotification, type };
      
      const { unmount } = render(
        <NotificationToast
          notification={notification}
          onClose={vi.fn()}
        />
      );

      const toastElement = screen.getByRole('alert');
      expect(toastElement).toHaveClass(type);

      unmount();
    });
  });

  it('should show close button', () => {
    render(
      <NotificationToast
        notification={mockNotification}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', async () => {
    const onClose = vi.fn();

    render(
      <NotificationToast
        notification={mockNotification}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledWith('1');
  });

  it('should auto-close after timeout', async () => {
    const onClose = vi.fn();

    render(
      <NotificationToast
        notification={mockNotification}
        onClose={onClose}
        autoClose={true}
        autoCloseDelay={3000}
      />
    );

    // Fast-forward time
    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('1');
    });
  });

  it('should not auto-close when autoClose is false', async () => {
    const onClose = vi.fn();

    render(
      <NotificationToast
        notification={mockNotification}
        onClose={onClose}
        autoClose={false}
      />
    );

    // Fast-forward time
    vi.advanceTimersByTime(5000);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should pause auto-close on hover', async () => {
    const onClose = vi.fn();

    render(
      <NotificationToast
        notification={mockNotification}
        onClose={onClose}
        autoClose={true}
        autoCloseDelay={3000}
      />
    );

    const toast = screen.getByRole('alert');

    // Hover over toast
    await user.hover(toast);

    // Fast-forward time while hovering
    vi.advanceTimersByTime(3000);

    expect(onClose).not.toHaveBeenCalled();

    // Unhover
    await user.unhover(toast);

    // Complete the remaining time
    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('1');
    });
  });

  it('should render notification without message', () => {
    const notificationWithoutMessage = {
      ...mockNotification,
      message: undefined
    };

    render(
      <NotificationToast
        notification={notificationWithoutMessage}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.queryByText('Operation completed successfully')).not.toBeInTheDocument();
  });

  it('should handle action button', async () => {
    const onAction = vi.fn();
    const notificationWithAction = {
      ...mockNotification,
      action: {
        label: 'Undo',
        onClick: onAction
      }
    };

    render(
      <NotificationToast
        notification={notificationWithAction}
        onClose={vi.fn()}
      />
    );

    const actionButton = screen.getByRole('button', { name: 'Undo' });
    await user.click(actionButton);

    expect(onAction).toHaveBeenCalled();
  });

  it('should have proper accessibility attributes', () => {
    render(
      <NotificationToast
        notification={mockNotification}
        onClose={vi.fn()}
      />
    );

    const toast = screen.getByRole('alert');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveAttribute('aria-atomic', 'true');
  });

  it('should show progress bar for auto-close', () => {
    render(
      <NotificationToast
        notification={mockNotification}
        onClose={vi.fn()}
        autoClose={true}
        autoCloseDelay={3000}
        showProgress={true}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('should update progress bar during auto-close', async () => {
    render(
      <NotificationToast
        notification={mockNotification}
        onClose={vi.fn()}
        autoClose={true}
        autoCloseDelay={3000}
        showProgress={true}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    
    // Initial progress should be 100%
    expect(progressBar).toHaveStyle({ width: '100%' });

    // Advance time partially
    vi.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(progressBar).toHaveStyle({ width: '50%' });
    });
  });

  it('should handle keyboard interactions', async () => {
    const onClose = vi.fn();

    render(
      <NotificationToast
        notification={mockNotification}
        onClose={onClose}
      />
    );

    const toast = screen.getByRole('alert');
    
    // Focus the toast
    toast.focus();

    // Press Escape key
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledWith('1');
  });

  it('should render notification icon based on type', () => {
    const successNotification = { ...mockNotification, type: 'success' as const };

    render(
      <NotificationToast
        notification={successNotification}
        onClose={vi.fn()}
      />
    );

    const icon = screen.getByTestId('notification-icon');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('success-icon');
  });

  it('should handle long messages with truncation', () => {
    const longMessage = 'This is a very long notification message that should be truncated or handled appropriately in the UI to maintain good user experience and layout consistency.';
    
    const notificationWithLongMessage = {
      ...mockNotification,
      message: longMessage
    };

    render(
      <NotificationToast
        notification={notificationWithLongMessage}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });
});