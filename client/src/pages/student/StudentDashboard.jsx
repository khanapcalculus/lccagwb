import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import './StudentDashboard.css';
import SessionCard from '../../components/SessionCard';
import { useNavigate } from 'react-router-dom';
import '../Dashboard.css';

const StudentDashboard = () => {
  const { user, userProfile } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'sessions'),
      where('studentId', '==', user.uid),
      orderBy('scheduledAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const upcoming = sessions.filter(s => s.status === 'scheduled');
  const completed = sessions.filter(s => s.status === 'completed');
  const now = new Date();
  const nextSession = upcoming.find(s => new Date(s.scheduledAt) > now);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="page-container animate-fade">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Student Dashboard</h1>
          <p>Hello, <strong style={{ color: 'var(--cyan)' }}>{userProfile?.displayName}</strong>! Ready to learn? 🚀</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {[
          { icon: '📅', label: 'Upcoming', value: upcoming.length, color: 'cyan' },
          { icon: '✅', label: 'Completed', value: completed.length, color: 'green' },
          { icon: '📚', label: 'Total Sessions', value: sessions.length, color: 'purple' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Next Session Banner */}
      {nextSession && (
        <div className="next-session-banner">
          <div className="next-session-info">
            <div className="next-session-label">⏰ Next Session</div>
            <div className="next-session-title">{nextSession.title}</div>
            <div className="next-session-meta">
              with {nextSession.tutorName} — {new Date(nextSession.scheduledAt).toLocaleString()}
            </div>
          </div>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate(`/whiteboard/${nextSession.whiteboardRoomId}`)}
          >
            🖊️ Open Whiteboard
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button className={`dashboard-tab ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => setActiveTab('upcoming')}>
          Upcoming ({upcoming.length})
        </button>
        <button className={`dashboard-tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
          Completed ({completed.length})
        </button>
      </div>

      {/* Sessions Grid */}
      <div className="sessions-grid">
        {(activeTab === 'upcoming' ? upcoming : completed).map(s => (
          <SessionCard key={s.id} session={s} showActions={activeTab === 'upcoming'} />
        ))}
        {(activeTab === 'upcoming' ? upcoming : completed).length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state-icon">{activeTab === 'upcoming' ? '📭' : '📂'}</div>
            <div className="empty-state-title">No {activeTab} sessions</div>
            <p style={{ fontSize: '0.85rem' }}>
              {activeTab === 'upcoming'
                ? 'Your tutor will schedule sessions for you. Stay tuned!'
                : 'Your completed sessions will appear here.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
