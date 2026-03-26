import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import './Auth.css';

const Register = () => {
  const [params] = useSearchParams();
  const isGoogleFlow = params.get('google') === '1';
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirmPassword: '', role: 'student' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const redirect = (role) => navigate(role === 'admin' ? '/admin' : role === 'tutor' ? '/tutor' : '/student', { replace: true });

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await updateProfile(user, { displayName: form.displayName });
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: form.email,
        displayName: form.displayName,
        role: form.role,
        photoURL: null,
        createdAt: serverTimestamp(),
      });
      redirect(form.role);
    } catch (err) {
      setError({ 'auth/email-already-in-use': 'This email is already registered.', 'auth/weak-password': 'Password is too weak.' }[err.code] || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    setError('');
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: user.uid, email: user.email, displayName: user.displayName,
          role: form.role, photoURL: user.photoURL, createdAt: serverTimestamp(),
        });
      }
      const data = (await getDoc(ref)).data();
      redirect(data.role);
    } catch (err) {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo"><span>🚀</span></div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join the LCC AGW Whiteboard Platform</p>
        </div>

        {error && <div className="auth-error"><span>⚠️</span> {error}</div>}

        <form onSubmit={handleRegister} className="auth-form">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" className="form-input" placeholder="Your full name" value={form.displayName} onChange={set('displayName')} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input type="email" className="form-input" placeholder="you@example.com" value={form.email} onChange={set('email')} required autoComplete="email" />
          </div>
          <div className="form-group">
            <label className="form-label">I am a…</label>
            <select className="form-input" value={form.role} onChange={set('role')}>
              <option value="student">🎓 Student</option>
              <option value="tutor">👨‍🏫 Tutor</option>
              <option value="admin">🛡️ Administrator</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" placeholder="At least 6 characters" value={form.password} onChange={set('password')} required autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input type="password" className="form-input" placeholder="Repeat password" value={form.confirmPassword} onChange={set('confirmPassword')} required />
          </div>

          <button type="submit" className="btn btn-primary btn-lg auth-btn" disabled={loading}>
            {loading ? <><div className="spinner-sm" style={{borderTopColor:'white',borderColor:'rgba(255,255,255,0.2)'}}/> Creating account…</> : '→ Create Account'}
          </button>
        </form>

        <div className="divider-text">or</div>

        <button className="btn btn-secondary btn-lg auth-btn auth-google-btn" onClick={handleGoogleRegister} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Sign up with Google
        </button>

        <p className="auth-footer">Already have an account? <Link to="/login">Sign in →</Link></p>
      </div>
    </div>
  );
};

export default Register;
