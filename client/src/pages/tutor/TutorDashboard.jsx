import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import SessionCard from '../../components/SessionCard';
import { v4 as uuidv4 } from 'uuid';
import '../Dashboard.css';

const TutorDashboard = () => {
  const { user, userProfile } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', studentId: '', studentName: '',
    scheduledAt: '', durationMinutes: 60,
  });

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(collection(db, 'sessions'), where('tutorId', '==', user.uid), orderBy('scheduledAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const qStudents = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubStudents = onSnapshot(qStudents, snap => {
      // Filter locally to avoid needing a complex composite index for role+assignedTutorId right now
      const myStudents = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.assignedTutorId === user.uid);
      setStudents(myStudents);
    });

    return () => { unsub(); unsubStudents(); };
  }, [user]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const roomId = uuidv4();
      await addDoc(collection(db, 'sessions'), {
        tutorId: user.uid,
        tutorName: userProfile?.displayName || user.email,
        studentId: form.studentId,
        studentName: form.studentName,
        title: form.title,
        description: form.description,
        scheduledAt: form.scheduledAt,
        durationMinutes: parseInt(form.durationMinutes),
        status: 'scheduled',
        whiteboardRoomId: roomId,
        whiteboardUrl: `/whiteboard/${roomId}`,
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'whiteboards'), {
        roomId, tutorId: user.uid, studentId: form.studentId,
        canvasData: null, participants: [], createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'activities'), {
        type: 'session_created', userId: user.uid,
        metadata: { title: form.title }, timestamp: new Date().toISOString(), createdAt: serverTimestamp(),
      });
      setShowModal(false);
      setForm({ title: '', description: '', studentId: '', studentName: '', scheduledAt: '', durationMinutes: 60 });
      showToast('Session created successfully!');
    } catch (err) {
      showToast('Failed to create session: ' + err.message, 'error');
    }
  };

  const handleComplete = async (id) => {
    await updateDoc(doc(db, 'sessions', id), { status: 'completed' });
    showToast('Session marked as complete!');
  };

  const handleCancel = async (id) => {
    await updateDoc(doc(db, 'sessions', id), { status: 'cancelled' });
    showToast('Session cancelled.', 'error');
  };

  const upcoming = sessions.filter(s => s.status === 'scheduled');
  const completed = sessions.filter(s => s.status === 'completed');
  const cancelled = sessions.filter(s => s.status === 'cancelled');

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="page-container animate-fade">
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Tutor Dashboard</h1>
          <p>Welcome back, <strong style={{ color: 'var(--cyan)' }}>{userProfile?.displayName}</strong> 👋</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          ➕ Schedule Session
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {[
          { icon: '📅', label: 'Upcoming', value: upcoming.length, color: 'cyan' },
          { icon: '✅', label: 'Completed', value: completed.length, color: 'green' },
          { icon: '❌', label: 'Cancelled', value: cancelled.length, color: 'red' },
          { icon: '🎓', label: 'Students', value: students.length, color: 'purple' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        {[['upcoming', `Upcoming (${upcoming.length})`], ['completed', `Completed (${completed.length})`], ['cancelled', `Cancelled (${cancelled.length})`], ['students', `Students (${students.length})`]].map(([key, label]) => (
          <button key={key} className={`dashboard-tab ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>{label}</button>
        ))}
      </div>

      {/* Sessions */}
      {activeTab !== 'students' && (
        <div className="sessions-grid">
          {(activeTab === 'upcoming' ? upcoming : activeTab === 'completed' ? completed : cancelled).map(s => (
            <SessionCard
              key={s.id}
              session={s}
              onComplete={activeTab === 'upcoming' ? handleComplete : null}
              onCancel={activeTab === 'upcoming' ? handleCancel : null}
            />
          ))}
          {(activeTab === 'upcoming' ? upcoming : activeTab === 'completed' ? completed : cancelled).length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">No {activeTab} sessions</div>
              {activeTab === 'upcoming' && <button className="btn btn-primary" onClick={() => setShowModal(true)}>Schedule Your First Session</button>}
            </div>
          )}
        </div>
      )}

      {/* Students List */}
      {activeTab === 'students' && (
        <div className="card">
          <div className="section-header"><div className="section-title">All Students</div></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Action</th></tr></thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td><strong style={{ color: 'var(--text-primary)' }}>{s.displayName}</strong></td>
                    <td>{s.email}</td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => {
                        setForm(prev => ({ ...prev, studentId: s.id, studentName: s.displayName }));
                        setShowModal(true);
                      }}>➕ Schedule</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📅 Schedule New Session</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Session Title *</label>
                  <input className="form-input" placeholder="e.g. Calculus Review" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Student *</label>
                  <select className="form-input" value={form.studentId} onChange={e => {
                    const s = students.find(s => s.id === e.target.value);
                    setForm(p => ({ ...p, studentId: e.target.value, studentName: s?.displayName || '' }));
                  }} required>
                    <option value="">Select a student…</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.displayName} ({s.email})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date & Time *</label>
                  <input className="form-input" type="datetime-local" value={form.scheduledAt} onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (minutes)</label>
                  <select className="form-input" value={form.durationMinutes} onChange={e => setForm(p => ({ ...p, durationMinutes: e.target.value }))}>
                    {[30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description (optional)</label>
                  <textarea className="form-input" placeholder="Topics to cover…" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Session & Whiteboard</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorDashboard;
