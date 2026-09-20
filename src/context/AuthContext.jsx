import { createContext, useState, useEffect } from 'react';
import AuthService from '../services/authservice';
import supabase from '../config/supabaseclient';

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  logout: () => {},
  isAuthLoading: true,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const authService = new AuthService();

  useEffect(() => {
    let isMounted = true;
    let initRequest = 0;

    const initAuth = async () => {
      const requestId = ++initRequest;
      try {
        // Clear any stale cached user
        authService.clearUser();
        
        // Only try to load user if there's an active Supabase session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          // No valid session - don't auto-restore user
          if (isMounted && requestId === initRequest) {
            setUser(null);
            console.log('AuthContext: No active session, user not loaded');
          }
        } else {
          const expectedGoogleEmail = localStorage.getItem('dasmom_google_email');
          const sessionEmail = session.user.email?.trim().toLowerCase();
          if (expectedGoogleEmail && sessionEmail !== expectedGoogleEmail) {
            localStorage.removeItem('dasmom_google_email');
            await supabase.auth.signOut();
            throw new Error('Use Google with the same email registered for your DasMom account.');
          }

          // Valid session exists - load full user data
          const current = await authService.getAuthUser();
          localStorage.removeItem('dasmom_google_email');
          if (isMounted && requestId === initRequest) {
            if (!current) {
              await supabase.functions.invoke('google-account-check', { body: { action: 'cleanup' } });
              await supabase.auth.signOut();
            }
            setUser(current);
            console.log('AuthContext: User loaded from active session', current);
          }
        }
      } catch (err) {
        console.error('AuthContext: Error during auth init', err);
        if (isMounted && requestId === initRequest) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        initRequest += 1;
        setUser(null);
        setIsAuthLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          initAuth();
        } else {
          initRequest += 1;
          setUser(null);
          setIsAuthLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isAuthLoading }}>
      {children}
    </AuthContext.Provider>
  );
};