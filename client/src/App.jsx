import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/AdminDashboard';
import TutorDashboard from './pages/tutor/TutorDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import WhiteboardPage from './pages/whiteboard/WhiteboardPage';

// App shell (with sidebar + navbar)
const AppShell = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="app-layout">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="main-content">
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <div className="page-container">{children}</div>
      </div>
    </div>
  );
};

// Role-based default redirect
const RoleRedirect = () => {
  const { userProfile, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!userProfile) return <Navigate to="/login" replace />;
  if (userProfile.role === 'admin') return <Navigate to="/admin" replace />;
  if (userProfile.role === 'tutor') return <Navigate to="/tutor" replace />;
  return <Navigate to="/student" replace />;
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Whiteboard — full screen, no shell */}
        <Route
          path="/whiteboard/:roomId"
          element={
            <ProtectedRoute>
              <WhiteboardPage />
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppShell><AdminDashboard /></AppShell>
            </ProtectedRoute>
          }
        />

        {/* Tutor */}
        <Route
          path="/tutor"
          element={
            <ProtectedRoute allowedRoles={['tutor', 'admin']}>
              <AppShell><TutorDashboard /></AppShell>
            </ProtectedRoute>
          }
        />

        {/* Student */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <AppShell><StudentDashboard /></AppShell>
            </ProtectedRoute>
          }
        />

        {/* Default */}
        <Route path="/" element={<RoleRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
