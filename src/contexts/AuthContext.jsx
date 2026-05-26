import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { toId } from '../lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    user: null,
    profile: null
  });

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setState({ loading: false, user: null, profile: null });
      return undefined;
    }

    let unsubscribeProfile = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile?.();

      if (!user) {
        setState({ loading: false, user: null, profile: null });
        return;
      }

      setState((current) => ({ ...current, loading: true, user }));
      unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
        const profile = snapshot.exists()
          ? { uid: user.uid, ...snapshot.data() }
          : { uid: user.uid, id: toId(user.email), role: null, displayName: toId(user.email) };
        setState({ loading: false, user, profile });
      });
    });

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      role: state.profile?.role || null,
      displayId: state.profile?.id || (state.user?.email ? toId(state.user.email) : null)
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
