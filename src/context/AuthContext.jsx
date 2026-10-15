import React, { createContext, useState, useEffect, useRef } from 'react';
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
  const userRef = useRef(null);
  userRef.current = user;
  const authService = new AuthService();

  useEffect(() => {
    let isMounted = true;
    let initRequest = 0;
    let signInInitTimer = null;

    const initAuth = async (isTokenRefresh = false) => {
      const requestId = ++initRequest;
      try {
        if (!isTokenRefresh) {
          authService.clearUser();
        }
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          if (isMounted && requestId === initRequest) {
            setUser(null);
            console.log('AuthContext: No active session, user not loaded');
          }
        } 
        else {
          // If token refreshed and user is already loaded with matching ID, no reload needed
          if (isTokenRefresh && userRef.current?.id === session.user.id) {
            return;
          }

          const expectedGoogleEmail = localStorage.getItem('dasmom_google_email');
          const sessionEmail = session.user.email?.trim().toLowerCase();
          
          if (expectedGoogleEmail && sessionEmail !== expectedGoogleEmail) {
            localStorage.removeItem('dasmom_google_email');
            await supabase.auth.signOut();
            throw new Error('Use Google with the same email registered for your DasMom account.');
          }

          const current = await authService.getAuthUser();
          const googleEmail = localStorage.getItem('dasmom_google_email');
          if (googleEmail && current?.id) {
            authService.recordLoginEvent(current.id);
          }
          localStorage.removeItem('dasmom_google_email');
          if (isMounted && requestId === initRequest) {
            if (!current) {
              await supabase.functions.invoke('google-account-check', { body: { action: 'cleanup' } });
              await supabase.auth.signOut();
            }
            // Only update state if user changed to prevent re-render storms
            if (!userRef.current || userRef.current.id !== current?.id || userRef.current.role !== current?.role) {
              setUser(current);
            }
            console.log('AuthContext: User loaded from active session', current);
          }
        }
      }
      catch (err) {
        console.error('AuthContext: Error during auth init', err);
        if (isMounted && requestId === initRequest) {
          setUser(null);
        }
      } 
      finally {
        if (isMounted && requestId === initRequest) {
          setIsAuthLoading(false);
        }
      }
    };

    initAuth(false);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        initRequest += 1;
        authService.clearUser();
        setUser(null);
        setIsAuthLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          // Silent token refresh: if user is already loaded and matches, do not teardown state
          if (userRef.current?.id === session.user.id) {
            return;
          }
          initAuth(true);
        } else {
          initRequest += 1;
          setUser(null);
          setIsAuthLoading(false);
        }
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        if (userRef.current?.id === session.user.id) {
          return;
        }
        if (signInInitTimer !== null) window.clearTimeout(signInInitTimer);
        signInInitTimer = window.setTimeout(() => {
          signInInitTimer = null;
          initAuth(false);
        }, 0);
      }
    });

    return () => {
      isMounted = false;
      if (signInInitTimer !== null) window.clearTimeout(signInInitTimer);
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