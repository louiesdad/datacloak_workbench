import React, { useState, useEffect } from 'react';
import { AdminLogin } from './AdminLogin';
import { ConfigurationPanel } from './ConfigurationPanel';
import './AdminDashboard.css';

export const AdminDashboard: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const storedToken = localStorage.getItem('adminToken');
    if (storedToken) {
      verifyToken(storedToken);
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: tokenToVerify }),
      });

      const data = await response.json();
      
      if (response.ok && data.valid) {
        setToken(tokenToVerify);
      } else {
        localStorage.removeItem('adminToken');
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('adminToken');
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = (newToken: string) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
  };

  if (isCheckingAuth) {
    return (
      <div className="admin-dashboard-loading">
        <div className="spinner"></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {token ? (
        <ConfigurationPanel token={token} onLogout={handleLogout} />
      ) : (
        <AdminLogin onLogin={handleLogin} />
      )}
    </div>
  );
};