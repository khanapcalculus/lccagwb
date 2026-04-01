import React from 'react';
import { useNavigate } from 'react-router-dom';
import './SessionCard.css';
import { format } from 'date-fns';

const statusIcon = { scheduled: '🕐', completed: '✅', cancelled: '❌' };
const statusColors = {
  scheduled: 'badge-scheduled',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
};

const SessionCard = ({ session, onJoin, onComplete, onCancel, showActions = true }) => {
  const navigate = useNavigate();
  const { id, title, description, tutorName, studentName, scheduledAt, durationMinutes, status, whiteboardRoomId } = session;

  const formattedDate = scheduledAt
    ? format(new Date(scheduledAt), 'MMM d, yyyy')
    : '—';
  const formattedTime = scheduledAt
    ? format(new Date(scheduledAt), 'h:mm a')
    : '—';

  const handleJoinWhiteboard = () => {
    if (whiteboardRoomId) navigate(`/whiteboard/${whiteboardRoomId}`);
  };

  return (
    <div className="session-card card animate-fade">
      <div className="session-card-header">
        <div className="session-card-title-row">
          <h4 className="session-card-title">{title}</h4>
          <span className={`badge ${statusColors[status] || 'badge-scheduled'}`}>
            {statusIcon[status]} {status}
          </span>
        </div>
        {description && <p className="session-card-description">{description}</p>}
      </div>

      <div className="session-card-meta">
        <div className="session-meta-item">
          <span className="meta-icon">📅</span>
          <span>{formattedDate}</span>
        </div>
        <div className="session-meta-item">
          <span className="meta-icon">🕐</span>
          <span>{formattedTime}</span>
        </div>
        <div className="session-meta-item">
          <span className="meta-icon">⏱️</span>
          <span>{durationMinutes || 60} min</span>
        </div>
      </div>

      <div className="session-card-people">
        {tutorName && (
          <div className="session-person tutor">
            <span>👨‍🏫</span>
            <span>{tutorName}</span>
          </div>
        )}
        {studentName && (
          <div className="session-person student">
            <span>🎓</span>
            <span>{studentName}</span>
          </div>
        )}
      </div>

      {showActions && (
        <div className="session-card-actions">
          {status !== 'cancelled' && whiteboardRoomId && (
            <button className="btn btn-primary btn-sm" onClick={handleJoinWhiteboard}>
              {status === 'completed' ? '📚 Review Whiteboard' : '🖊️ Open Whiteboard'}
            </button>
          )}
          {onComplete && status === 'scheduled' && (
            <button className="btn btn-success btn-sm" onClick={() => onComplete(id)}>
              ✅ Complete
            </button>
          )}
          {onCancel && status === 'scheduled' && (
            <button className="btn btn-danger btn-sm" onClick={() => onCancel(id)}>
              ✕ Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SessionCard;
