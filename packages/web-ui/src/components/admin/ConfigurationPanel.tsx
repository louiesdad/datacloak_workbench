import React, { useState, useEffect } from 'react';
import './ConfigurationPanel.css';

interface ConfigData {
  PORT: number;
  NODE_ENV: string;
  LOG_LEVEL: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL: string;
  OPENAI_MAX_TOKENS: number;
  OPENAI_TEMPERATURE: number;
  OPENAI_TIMEOUT: number;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  ENABLE_HOT_RELOAD: boolean;
  ENABLE_CONFIG_API: boolean;
}

interface ConfigurationPanelProps {
  token: string;
  onLogout: () => void;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ token, onLogout }) => {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [openAIKey, setOpenAIKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'openai' | 'security'>('general');

  useEffect(() => {
    fetchConfiguration();
  }, [token]);

  const fetchConfiguration = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/config', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch configuration');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setConfig(data.data as ConfigData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<ConfigData>) => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/config/batch', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update configuration');
      }

      setSuccess('Configuration updated successfully');
      await fetchConfiguration();
    } catch (err: any) {
      setError(err.message || 'Failed to update configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const updateOpenAIKey = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/config/openai-key', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: openAIKey }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update OpenAI API key');
      }

      setSuccess('OpenAI API key updated successfully');
      setOpenAIKey('');
      await fetchConfiguration();
    } catch (err: any) {
      setError(err.message || 'Failed to update OpenAI API key');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="config-panel-loading">
        <div className="spinner"></div>
        <p>Loading configuration...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="config-panel-error">
        <p>Failed to load configuration</p>
        <button onClick={() => fetchConfiguration()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="configuration-panel">
      <div className="config-header">
        <h1>Configuration Management</h1>
        <button className="logout-button" onClick={onLogout}>
          Logout
        </button>
      </div>

      {error && (
        <div className="config-alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="config-alert success">
          {success}
        </div>
      )}

      <div className="config-tabs">
        <button
          className={`tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={`tab ${activeTab === 'openai' ? 'active' : ''}`}
          onClick={() => setActiveTab('openai')}
        >
          OpenAI
        </button>
        <button
          className={`tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Security & Features
        </button>
      </div>

      <div className="config-content">
        {activeTab === 'general' && (
          <div className="config-section">
            <h2>General Settings</h2>
            
            <div className="config-group">
              <label>Port</label>
              <input
                type="number"
                value={config.PORT}
                onChange={(e) => setConfig({ ...config, PORT: parseInt(e.target.value, 10) })}
                min="1"
                max="65535"
              />
            </div>

            <div className="config-group">
              <label>Environment</label>
              <select
                value={config.NODE_ENV}
                onChange={(e) => setConfig({ ...config, NODE_ENV: e.target.value })}
              >
                <option value="development">Development</option>
                <option value="production">Production</option>
                <option value="test">Test</option>
              </select>
            </div>

            <div className="config-group">
              <label>Log Level</label>
              <select
                value={config.LOG_LEVEL}
                onChange={(e) => setConfig({ ...config, LOG_LEVEL: e.target.value })}
              >
                <option value="error">Error</option>
                <option value="warn">Warn</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>

            <button
              className="save-button"
              onClick={() => updateConfig({
                PORT: config.PORT,
                NODE_ENV: config.NODE_ENV,
                LOG_LEVEL: config.LOG_LEVEL,
              })}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save General Settings'}
            </button>
          </div>
        )}

        {activeTab === 'openai' && (
          <div className="config-section">
            <h2>OpenAI Configuration</h2>
            
            <div className="config-group">
              <label>API Key Status</label>
              <div className="api-key-status">
                {config.OPENAI_API_KEY ? (
                  <span className="status-configured">✓ Configured ({config.OPENAI_API_KEY})</span>
                ) : (
                  <span className="status-not-configured">✗ Not configured</span>
                )}
              </div>
            </div>

            <div className="config-group">
              <label>New API Key</label>
              <input
                type="password"
                value={openAIKey}
                onChange={(e) => setOpenAIKey(e.target.value)}
                placeholder="sk-..."
              />
              <button
                className="update-key-button"
                onClick={updateOpenAIKey}
                disabled={!openAIKey || isSaving}
              >
                Update API Key
              </button>
            </div>

            <div className="config-group">
              <label>Model</label>
              <select
                value={config.OPENAI_MODEL}
                onChange={(e) => setConfig({ ...config, OPENAI_MODEL: e.target.value })}
              >
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>

            <div className="config-group">
              <label>Max Tokens</label>
              <input
                type="number"
                value={config.OPENAI_MAX_TOKENS}
                onChange={(e) => setConfig({ ...config, OPENAI_MAX_TOKENS: parseInt(e.target.value, 10) })}
                min="1"
                max="4096"
              />
            </div>

            <div className="config-group">
              <label>Temperature</label>
              <input
                type="number"
                value={config.OPENAI_TEMPERATURE}
                onChange={(e) => setConfig({ ...config, OPENAI_TEMPERATURE: parseFloat(e.target.value) })}
                min="0"
                max="2"
                step="0.1"
              />
            </div>

            <div className="config-group">
              <label>Timeout (ms)</label>
              <input
                type="number"
                value={config.OPENAI_TIMEOUT}
                onChange={(e) => setConfig({ ...config, OPENAI_TIMEOUT: parseInt(e.target.value, 10) })}
                min="5000"
                max="120000"
                step="1000"
              />
            </div>

            <button
              className="save-button"
              onClick={() => updateConfig({
                OPENAI_MODEL: config.OPENAI_MODEL,
                OPENAI_MAX_TOKENS: config.OPENAI_MAX_TOKENS,
                OPENAI_TEMPERATURE: config.OPENAI_TEMPERATURE,
                OPENAI_TIMEOUT: config.OPENAI_TIMEOUT,
              })}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save OpenAI Settings'}
            </button>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="config-section">
            <h2>Security & Features</h2>
            
            <div className="config-group">
              <label>Rate Limit Window (ms)</label>
              <input
                type="number"
                value={config.RATE_LIMIT_WINDOW_MS}
                onChange={(e) => setConfig({ ...config, RATE_LIMIT_WINDOW_MS: parseInt(e.target.value, 10) })}
                min="1000"
                max="3600000"
                step="1000"
              />
            </div>

            <div className="config-group">
              <label>Max Requests per Window</label>
              <input
                type="number"
                value={config.RATE_LIMIT_MAX_REQUESTS}
                onChange={(e) => setConfig({ ...config, RATE_LIMIT_MAX_REQUESTS: parseInt(e.target.value, 10) })}
                min="1"
                max="1000"
              />
            </div>

            <div className="config-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.ENABLE_HOT_RELOAD}
                  onChange={(e) => setConfig({ ...config, ENABLE_HOT_RELOAD: e.target.checked })}
                />
                Enable Hot Reload
              </label>
            </div>

            <div className="config-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.ENABLE_CONFIG_API}
                  onChange={(e) => setConfig({ ...config, ENABLE_CONFIG_API: e.target.checked })}
                />
                Enable Configuration API
              </label>
            </div>

            <button
              className="save-button"
              onClick={() => updateConfig({
                RATE_LIMIT_WINDOW_MS: config.RATE_LIMIT_WINDOW_MS,
                RATE_LIMIT_MAX_REQUESTS: config.RATE_LIMIT_MAX_REQUESTS,
                ENABLE_HOT_RELOAD: config.ENABLE_HOT_RELOAD,
                ENABLE_CONFIG_API: config.ENABLE_CONFIG_API,
              })}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Security Settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};