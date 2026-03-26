import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyBDNbwqs4kNScWE4hMsZkX3weUNWR3neoE",
  authDomain: "lccagwb.firebaseapp.com",
  projectId: "lccagwb",
  storageBucket: "lccagwb.firebasestorage.app",
  messagingSenderId: "478272248216",
  appId: "1:478272248216:web:0f1b0d026ed87c4f63f3ed",
  measurementId: "G-WXBKSMJV23"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export default app;
