import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig.apiKey) return null;
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

let _auth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (_auth) return _auth;
  const app = getFirebaseApp();
  if (!app) return null;
  _auth = getAuth(app);
  return _auth;
}
