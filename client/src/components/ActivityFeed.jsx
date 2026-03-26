import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import './ActivityFeed.css';

const activityIcons = {
  session_created: { icon: '📅', color: 'var(--cyan)' },
  session_updated: { icon: '✏️', color: 'var(--yellow)' },
  session_cancelled: { icon: '❌', color: 'var(--red)' },
  session_completed: { icon: '✅', color: 'var(--green)' },
  whiteboard_joined: { icon: '🖊️', color: 'var(--purple-light)' },
  user_registered: { icon: '👤', color: 'var(--green)' },
  default: { icon: '🔔', color: 'var(--text-muted)' },
};

const formatType = (type) =>
  type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Activity';

const ActivityFeed = ({ activities = [], maxHeight = '360px' }) => {
  if (!activities.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔕</div>
        <div className="empty-state-title">No recent activity</div>
        <p style={{ fontSize: '0.8rem' }}>Activity will appear here as users interact with the platform.</p>
      </div>
    );
  }

  return (
    <div className="activity-feed" style={{ maxHeight, overflowY: 'auto' }}>
      {activities.map((activity, idx) => {
        const meta = activityIcons[activity.type] || activityIcons.default;
        const timeAgo = activity.timestamp
          ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })
          : '';
        return (
          <div key={activity.id || idx} className="activity-item">
            <div className="activity-icon-wrap" style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40` }}>
              <span className="activity-icon">{meta.icon}</span>
            </div>
            <div className="activity-content">
              <div className="activity-type" style={{ color: meta.color }}>{formatType(activity.type)}</div>
              {activity.metadata?.title && (
                <div className="activity-detail">"{activity.metadata.title}"</div>
              )}
              {activity.metadata?.sessionId && (
                <div className="activity-detail">Session ID: {activity.metadata.sessionId.slice(0,8)}…</div>
              )}
              <div className="activity-time">{timeAgo}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActivityFeed;
