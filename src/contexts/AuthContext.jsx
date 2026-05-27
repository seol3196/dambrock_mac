import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authUserFromProfile, getCurrentProfile, toId } from '../lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    user: null,
    profile: null
  });

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setState((current) => ({ ...current, loading: true }));
      try {
        const profile = await getCurrentProfile();
        if (!active) return;
        setState({
          loading: false,
          user: authUserFromProfile(profile),
          profile
        });
      } catch {
        if (!active) return;
        window.localStorage.removeItem('dambrock.session');
        setState({ loading: false, user: null, profile: null });
      }
    }

    window.addEventListener('auth-changed', loadProfile);
    loadProfile();

    return () => {
      active = false;
      window.removeEventListener('auth-changed', loadProfile);
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
