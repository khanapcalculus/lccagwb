import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid) => {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      setUserProfile(snap.data());
      return snap.data();
    }
    return null;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const register = async (email, password, displayName, role = 'student') => {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(newUser, { displayName });
    const profile = {
      uid: newUser.uid,
      email,
      displayName,
      role,
      photoURL: newUser.photoURL || null,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', newUser.uid), profile);
    setUserProfile(profile);
    return newUser;
  };

  const login = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await fetchProfile(result.user.uid);
    return result.user;
  };

  const loginWithGoogle = async (role = 'student') => {
    const result = await signInWithPopup(auth, googleProvider);
    const ref = doc(db, 'users', result.user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const profile = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        role,
        photoURL: result.user.photoURL,
        createdAt: serverTimestamp(),
      };
      await setDoc(ref, profile);
      setUserProfile(profile);
    } else {
      await fetchProfile(result.user.uid);
    }
    return result.user;
  };

  const logout = () => {
    setUserProfile(null);
    return signOut(auth);
  };

  const getIdToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  const value = {
    user,
    userProfile,
    loading,
    register,
    login,
    loginWithGoogle,
    logout,
    getIdToken,
    role: userProfile?.role || null,
    isAdmin: userProfile?.role === 'admin',
    isTutor: userProfile?.role === 'tutor',
    isStudent: userProfile?.role === 'student',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
