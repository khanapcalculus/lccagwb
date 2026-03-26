import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Authenticating…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && userProfile && !allowedRoles.includes(userProfile.role)) {
    const redirectMap = { admin: '/admin', tutor: '/tutor', student: '/student' };
    return <Navigate to={redirectMap[userProfile.role] || '/login'} replace />;
  }

  return children;
};

export default ProtectedRoute;
