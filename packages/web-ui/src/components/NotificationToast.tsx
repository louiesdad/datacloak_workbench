import React, { useEffect } from 'react';
import { useAppContext, useAppActions, type Notification } from '../context/AppContext';
import './NotificationToast.css';

interface NotificationItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onDismiss }) => {
  useEffect(() => {
    // Auto-dismiss notifications after 5 seconds (except errors)
    if (notification.type !== 'error') {
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notification.id, notification.type, onDismiss]);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return timestamp.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  return (
    <div 
      className={`notification-item ${notification.type} ${notification.dismissed ? 'dismissed' : ''}`}
      role="alert"
      aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="notification-icon">
        {getIcon(notification.type)}
      </div>
      
      <div className="notification-content">
        <div className="notification-header">
          <h4 className="notification-title">{notification.title}</h4>
          <span className="notification-timestamp">
            {formatTimestamp(notification.timestamp)}
          </span>
        </div>
        
        <p className="notification-message">{notification.message}</p>
      </div>
      
      <button
        className="notification-dismiss"
        onClick={() => onDismiss(notification.id)}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
};

export const NotificationToast: React.FC = () => {
  const { state } = useAppContext();
  const { dismissNotification, clearNotifications } = useAppActions();

  const activeNotifications = state.notifications.filter(n => !n.dismissed);

  if (activeNotifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-container">
      <div className="notification-header-actions">
        {activeNotifications.length > 1 && (
          <button
            className="clear-all-button"
            onClick={clearNotifications}
          >
            Clear All ({activeNotifications.length})
          </button>
        )}
      </div>

      <div className="notification-list">
        {activeNotifications.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={dismissNotification}
          />
        ))}
      </div>
    </div>
  );
};

// Hook for easy notification usage in components
export const useNotifications = () => {
  const { addNotification } = useAppActions();

  return {
    showSuccess: (title: string, message: string) => 
      addNotification({ type: 'success', title, message }),
    
    showError: (title: string, message: string) => 
      addNotification({ type: 'error', title, message }),
    
    showWarning: (title: string, message: string) => 
      addNotification({ type: 'warning', title, message }),
    
    showInfo: (title: string, message: string) => 
      addNotification({ type: 'info', title, message }),
    
    show: (notification: Omit<Notification, 'id' | 'timestamp'>) => 
      addNotification(notification)
  };
};