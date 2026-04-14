import { createContext, useState, useEffect } from 'react';
import AuthService from '../services/authservice';

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const authService = new AuthService();

  useEffect(() => {
    // 1. Initial re-hydration
    const initAuth = async () => {
      try {
        const current = await authService.getAuthUser();
        if (current) {
          setUser(current);
          console.log('AuthContext: User re-hydrated', current);
        }
      } catch (err) {
        console.error('AuthContext: Re-hydration error', err);
      }
    };
    initAuth();

    // 2. Real-time auth state listener
    const { data: { subscription } } = authService.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`AuthContext: Auth event [${event}]`, session?.user?.id);
      
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // If we don't have the user object in state, fetch it
        if (!user) {
          const current = await authService.getAuthUser();
          setUser(current);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};