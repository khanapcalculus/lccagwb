import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  const getRoleRedirect = async (uid) => {
    const snap = await getDoc(doc(db, 'users', uid));
    const role = snap.exists() ? snap.data().role : 'student';
    return role === 'admin' ? '/admin' : role === 'tutor' ? '/tutor' : '/student';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const redirect = await getRoleRedirect(user.uid);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.exists()) {
        navigate('/register?google=1', { replace: true });
      } else {
        const redirect = await getRoleRedirect(user.uid);
        navigate(redirect, { replace: true });
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setGoogleLoading(false);
    }
  };

  const friendlyError = (code) => ({
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  }[code] || 'An error occurred. Please try again.');

  return (
    <div className="auth-container">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <span>🖊️</span>
          </div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to your LCC AGW account</p>
        </div>

        {error && (
          <div className="auth-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg auth-btn" disabled={loading}>
            {loading ? <><div className="spinner-sm" style={{borderTopColor:'white', borderColor:'rgba(255,255,255,0.2)'}} /> Signing in…</> : '→ Sign In'}
          </button>
        </form>

        <div className="divider-text">or continue with</div>

        <button className="btn btn-secondary btn-lg auth-btn auth-google-btn" onClick={handleGoogleLogin} disabled={googleLoading}>
          {googleLoading ? <div className="spinner-sm" /> : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </>
          )}
        </button>

        <p className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register">Create one free →</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
