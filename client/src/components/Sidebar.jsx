import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const navItems = {
  admin: [
    { to: '/admin', icon: '📊', label: 'Dashboard', end: true },
    { to: '/admin/users', icon: '👥', label: 'Users' },
    { to: '/admin/sessions', icon: '📅', label: 'All Sessions' },
    { to: '/admin/analytics', icon: '📈', label: 'Analytics' },
    { to: '/admin/activity', icon: '🔔', label: 'Activity Log' },
  ],
  tutor: [
    { to: '/tutor', icon: '🏠', label: 'Dashboard', end: true },
    { to: '/tutor/sessions', icon: '📅', label: 'My Sessions' },
    { to: '/tutor/schedule', icon: '➕', label: 'Schedule Session' },
    { to: '/tutor/students', icon: '🎓', label: 'My Students' },
    { to: '/tutor/whiteboards', icon: '🖊️', label: 'Whiteboards' },
  ],
  student: [
    { to: '/student', icon: '🏠', label: 'Dashboard', end: true },
    { to: '/student/sessions', icon: '📅', label: 'My Sessions' },
    { to: '/student/request', icon: '📝', label: 'Request Session' },
  ],
};

const roleMeta = {
  admin: { label: 'Administrator', color: 'var(--red)', icon: '🛡️' },
  tutor: { label: 'Tutor', color: 'var(--purple-light)', icon: '👨‍🏫' },
  student: { label: 'Student', color: 'var(--green)', icon: '🎓' },
};

const Sidebar = ({ mobileOpen, onClose }) => {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const role = userProfile?.role || 'student';
  const items = navItems[role] || [];
  const meta = roleMeta[role] || roleMeta.student;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <span>🖊️</span>
          </div>
          <div>
            <div className="sidebar-logo-title">LCC AGW</div>
            <div className="sidebar-logo-sub">Whiteboard Platform</div>
          </div>
        </div>

        {/* Role Badge */}
        <div className="sidebar-role">
          <span className="sidebar-role-icon">{meta.icon}</span>
          <div>
            <div className="sidebar-role-name">{userProfile?.displayName || user?.email}</div>
            <div className="sidebar-role-label" style={{ color: meta.color }}>{meta.label}</div>
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* Navigation */}
        <nav className="sidebar-nav">
          {items.map(({ to, icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
              onClick={onClose}
            >
              <span className="sidebar-link-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={handleLogout}>
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
