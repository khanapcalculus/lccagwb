import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import ActivityFeed from '../../components/ActivityFeed';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import '../Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#8b9cc8', font: { family: 'Inter' } } } },
  scales: { x: { ticks: { color: '#8b9cc8' }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { ticks: { color: '#8b9cc8' }, grid: { color: 'rgba(255,255,255,0.04)' } } },
};

const AdminDashboard = () => {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({ users: [], sessions: [], activities: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [savingId, setSavingId] = useState(null);
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      setStats(prev => ({ ...prev, users: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });
    const unsubSessions = onSnapshot(query(collection(db, 'sessions'), orderBy('createdAt', 'desc')), snap => {
      setStats(prev => ({ ...prev, sessions: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      setLoading(false);
    });
    const unsubActivities = onSnapshot(query(collection(db, 'activities'), orderBy('createdAt', 'desc')), snap => {
      setStats(prev => ({ ...prev, activities: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });
    return () => { unsubUsers(); unsubSessions(); unsubActivities(); };
  }, []);

  const { users, sessions, activities } = stats;
  const admins = users.filter(u => u.role?.toLowerCase() === 'admin').length;
  const tutors = users.filter(u => u.role?.toLowerCase() === 'tutor').length;
  const students = users.filter(u => u.role === 'student').length;
  const scheduled = sessions.filter(s => s.status === 'scheduled').length;
  const completed = sessions.filter(s => s.status === 'completed').length;
  const cancelled = sessions.filter(s => s.status === 'cancelled').length;

  const availableTutors = users.filter(u => u.role?.toLowerCase()?.trim() === 'tutor');

  const handleAssignTutor = async (studentId, tutorId) => {
    setSavingId(studentId);
    try {
      const tutor = availableTutors.find(t => t.id === tutorId);
      await updateDoc(doc(db, 'users', studentId), { 
        assignedTutorId: tutorId || null,
        assignedTutorName: tutor ? (tutor.displayName || tutor.email) : null
      });
      showToast('Tutor assigned successfully!');
    } catch (error) {
      console.error('Error assigning tutor:', error);
      showToast('Failed to assign tutor: ' + error.message, 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleRoleChange = async (userId, nextRole) => {
    setSavingRoleId(userId);
    try {
      const updates = { role: nextRole };
      if (nextRole !== 'student') {
        updates.assignedTutorId = null;
        updates.assignedTutorName = null;
      }
      await updateDoc(doc(db, 'users', userId), updates);
      showToast(`User role updated to ${nextRole}.`);
    } catch (error) {
      console.error('Error updating role:', error);
      showToast('Failed to update role: ' + error.message, 'error');
    } finally {
      setSavingRoleId(null);
    }
  };

  // Chart data
  const sessionStatusData = {
    labels: ['Scheduled', 'Completed', 'Cancelled'],
    datasets: [{
      data: [scheduled, completed, cancelled],
      backgroundColor: ['rgba(0,212,255,0.7)', 'rgba(16,185,129,0.7)', 'rgba(239,68,68,0.7)'],
      borderColor: ['#00d4ff', '#10b981', '#ef4444'],
      borderWidth: 2,
    }],
  };

  const userRoleData = {
    labels: ['Admins', 'Tutors', 'Students'],
    datasets: [{
      data: [admins, tutors, students],
      backgroundColor: ['rgba(239,68,68,0.7)', 'rgba(124,58,237,0.7)', 'rgba(16,185,129,0.7)'],
      borderColor: ['#ef4444', '#7c3aed', '#10b981'],
      borderWidth: 2,
    }],
  };

  // Sessions by day (last 14 days)
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split('T')[0];
  });
  const byDay = {};
  sessions.forEach(s => { const d = s.scheduledAt?.split('T')[0]; if (d) byDay[d] = (byDay[d] || 0) + 1; });
  const sessionTrendData = {
    labels: last14.map(d => d.slice(5)),
    datasets: [{
      label: 'Sessions',
      data: last14.map(d => byDay[d] || 0),
      borderColor: '#00d4ff',
      backgroundColor: 'rgba(0,212,255,0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#00d4ff',
      pointRadius: 4,
    }],
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <p style={{ color: 'var(--text-muted)' }}>Loading admin data…</p>
    </div>
  );

  const tabs = ['overview', 'users', 'sessions', 'activity'];

  return (
    <div className="page-container animate-fade">
      {/* Toast Notification */}
      {toast && (
        <div className="toast-container" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999 }}>
          <div className={`toast toast-${toast.type}`} style={{ background: toast.type === 'error' ? '#ef4444' : '#10b981', padding: '12px 24px', borderRadius: '8px', color: 'white', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Admin Dashboard <span className="gradient-text">↗</span></h1>
          <p>Full platform control & analytics — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {[
          { icon: '👥', label: 'Total Users', value: users.length, color: 'cyan' },
          { icon: '👨‍🏫', label: 'Tutors', value: tutors, color: 'purple' },
          { icon: '🎓', label: 'Students', value: students, color: 'green' },
          { icon: '📅', label: 'Total Sessions', value: sessions.length, color: 'cyan' },
          { icon: '✅', label: 'Completed', value: completed, color: 'green' },
          { icon: '🔔', label: 'Activities', value: activities.length, color: 'purple' },
        ].map((s, i) => (
          <div key={i} className="stat-card animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        {tabs.map(t => (
          <button key={t} className={`dashboard-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="dashboard-grid-2">
          <div className="card">
            <div className="section-header"><div className="section-title">Session Trend (14 days)</div></div>
            <div style={{ height: 220 }}><Line data={sessionTrendData} options={chartDefaults} /></div>
          </div>
          <div className="card">
            <div className="section-header"><div className="section-title">User Roles</div></div>
            <div style={{ height: 220 }}><Doughnut data={userRoleData} options={{ ...chartDefaults, scales: undefined }} /></div>
          </div>
          <div className="card">
            <div className="section-header"><div className="section-title">Session Status</div></div>
            <div style={{ height: 220 }}><Bar data={sessionStatusData} options={chartDefaults} /></div>
          </div>
          <div className="card">
            <div className="section-header"><div className="section-title">Recent Activity</div></div>
            <ActivityFeed activities={activities.slice(0, 8)} maxHeight="220px" />
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="section-header">
            <div className="section-title">All Users ({users.length}) | Tutors in state: {availableTutors.length}</div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Assigned Tutor</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><strong style={{ color: 'var(--text-primary)' }}>{u.displayName || '—'}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="form-input"
                        style={{
                          minWidth: '140px',
                          padding: '0.55rem 0.75rem',
                          fontSize: '0.85rem',
                          background: 'var(--bg-elevated)',
                        }}
                        value={u.role || 'student'}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={savingRoleId === u.id || u.id === userProfile?.uid}
                      >
                        <option value="student">Student</option>
                        <option value="tutor">Tutor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>{u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : '—'}</td>
                    <td>
                      {u.role?.toLowerCase() === 'student' ? (
                        <select
                          className="form-input"
                          style={{
                            minWidth: '220px',
                            padding: '0.55rem 0.75rem',
                            fontSize: '0.85rem',
                            background: 'var(--bg-elevated)',
                          }}
                          value={u.assignedTutorId || ''}
                          onChange={(e) => handleAssignTutor(u.id, e.target.value)}
                          disabled={savingId === u.id}
                        >
                          <option value="">Unassigned</option>
                          {availableTutors.map(tutor => (
                            <option key={tutor.id} value={tutor.id}>
                              {tutor.displayName || tutor.email || 'Unnamed Tutor'}
                            </option>
                          ))}
                        </select>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="card">
          <div className="section-header">
            <div className="section-title">All Sessions ({sessions.length})</div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>Title</th><th>Tutor</th><th>Student</th><th>Scheduled</th><th>Duration</th><th>Status</th><th>Whiteboard</th>
              </tr></thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td><strong style={{ color: 'var(--text-primary)' }}>{s.title}</strong></td>
                    <td>{s.tutorName}</td>
                    <td>{s.studentName}</td>
                    <td>{s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : '—'}</td>
                    <td>{s.durationMinutes}m</td>
                    <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                    <td>
                      {s.whiteboardRoomId && (
                        <a href={`/whiteboard/${s.whiteboardRoomId}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                          🖊️ Open
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div className="card">
          <div className="section-header">
            <div className="section-title">Activity Log ({activities.length})</div>
          </div>
          <ActivityFeed activities={activities} maxHeight="600px" />
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
