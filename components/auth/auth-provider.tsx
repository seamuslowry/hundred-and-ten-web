
import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { putPlayer } from "@/lib/api/players";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  getToken: async () => null,
});

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      // Defer to avoid synchronous setState in effect body
      const t = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(t);
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    const result = await signInWithPopup(auth, googleProvider);
    // Register/refresh player in backend after sign-in
    await putPlayer(result.user.uid);
  }, []);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await firebaseSignOut(auth);
  }, []);

  const getToken = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  return (
    <AuthContext value={{ user, loading, signIn, signOut, getToken }}>
      {children}
    </AuthContext>
  );
}
