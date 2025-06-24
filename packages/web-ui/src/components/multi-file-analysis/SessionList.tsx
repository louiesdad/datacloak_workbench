import React, { useState, useEffect, useMemo } from 'react';
import { multiFileAnalysisApi } from '../../services/api';
import type { Session } from '../../services/api/multiFileAnalysisApi';

interface SessionListProps {
  onSelect?: (session: Session) => void;
  onDelete?: (sessionId: string) => void;
}

export const SessionList: React.FC<SessionListProps> = ({ onSelect, onDelete }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await multiFileAnalysisApi.getSessions();
      setSessions(data);
    } catch (err) {
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const filteredSessions = useMemo(() => {
    if (!searchTerm) return sessions;
    
    const term = searchTerm.toLowerCase();
    return sessions.filter(session => 
      session.name.toLowerCase().includes(term) ||
      session.description.toLowerCase().includes(term)
    );
  }, [sessions, searchTerm]);

  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [filteredSessions]);

  const handleDelete = async (sessionId: string) => {
    try {
      await multiFileAnalysisApi.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      onDelete?.(sessionId);
      setDeleteConfirm(null);
    } catch (err) {
      // Handle error
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return <div className="loading">Loading sessions...</div>;
  }

  if (error) {
    return (
      <div className="error-state">
        <p>{error}</p>
        <button onClick={fetchSessions}>Retry</button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="empty-state">
        <p>No analysis sessions yet</p>
        <p className="subtitle">Create your first session to get started</p>
      </div>
    );
  }

  return (
    <div className="session-list">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search sessions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button className="sort-button" aria-label="sort">
          Sort
        </button>
      </div>

      <div className="sessions">
        {sortedSessions.map((session) => (
          <div
            key={session.sessionId}
            className="session-item"
            onClick={() => onSelect?.(session)}
          >
            <div className="session-header">
              <h3 data-testid="session-name">{session.name}</h3>
              <span className={`status status-${session.status}`}>
                {session.status}
              </span>
            </div>
            
            {session.description && (
              <p className="session-description">{session.description}</p>
            )}
            
            <div className="session-meta">
              <span>{session.fileCount} files</span>
              <span>{formatDate(session.createdAt)}</span>
            </div>

            <button
              className="delete-button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirm(session.sessionId);
              }}
              aria-label={`delete ${session.name}`}
            >
              Delete
            </button>

            {deleteConfirm === session.sessionId && (
              <div className="delete-confirm" onClick={(e) => e.stopPropagation()}>
                <p>Are you sure?</p>
                <button
                  onClick={() => handleDelete(session.sessionId)}
                >
                  Confirm
                </button>
                <button onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};