import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

const Navbar = ({ onMenuClick }) => {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleColors = { admin: 'var(--red)', tutor: 'var(--purple-light)', student: 'var(--green)' };
  const roleColor = roleColors[userProfile?.role] || 'var(--cyan)';

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="navbar-menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
        <div className="navbar-breadcrumb">
          <span className="navbar-platform">LCC AGW</span>
          <span className="navbar-sep">›</span>
          <span className="navbar-role" style={{ color: roleColor }}>
            {userProfile?.role?.charAt(0).toUpperCase() + userProfile?.role?.slice(1) || 'Dashboard'}
          </span>
        </div>
      </div>

      <div className="navbar-right">
        <div className="navbar-status">
          <span className="status-dot" />
          <span>Live</span>
        </div>

        <div className="navbar-user" onClick={() => setDropdownOpen(!dropdownOpen)}>
          <div className="navbar-avatar">
            {userProfile?.photoURL
              ? <img src={userProfile.photoURL} alt="avatar" />
              : <span>{(userProfile?.displayName || user?.email || '?')[0].toUpperCase()}</span>
            }
          </div>
          <div className="navbar-user-info">
            <span className="navbar-user-name">{userProfile?.displayName || 'User'}</span>
            <span className="navbar-user-role" style={{ color: roleColor }}>{userProfile?.role}</span>
          </div>
          <span className="navbar-chevron">▾</span>

          {dropdownOpen && (
            <div className="navbar-dropdown" onClick={e => e.stopPropagation()}>
              <div className="navbar-dropdown-header">
                <div className="navbar-dropdown-name">{userProfile?.displayName}</div>
                <div className="navbar-dropdown-email">{user?.email}</div>
              </div>
              <div className="navbar-dropdown-divider" />
              <button className="navbar-dropdown-item" onClick={handleLogout}>
                🚪 Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
