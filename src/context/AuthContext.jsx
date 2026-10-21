/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useRef, useMemo } from 'react';
import AuthService from '../services/authservice';
import supabase from '../config/supabaseclient';
import visitNotificationService from '../services/visitNotificationService';
import { isAndroidApp } from '../services/secureStorage';

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  logout: () => {},
  isAuthLoading: true,
  visitNotificationStatus: null,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [visitNotificationStatus, setVisitNotificationStatus] = useState(null);
  const userRef = useRef(null);
  userRef.current = user;
  const authService = useMemo(() => new AuthService(), []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    const role = String(user?.role || '').toLowerCase();
    if (isAuthLoading || !user?.id || !['mother', 'patient'].includes(role)) {
      setVisitNotificationStatus(null);
      return undefined;
    }

    let cancelled = false;
    let stopNotifications;
    setVisitNotificationStatus({ state: 'initializing', pendingCount: 0, message: '' });
    visitNotificationService.start(user.id, setVisitNotificationStatus)
      .then(stop => {
        if (cancelled) stop();
        else stopNotifications = stop;
      })
      .catch(error => {
        console.error('Failed to initialize mother visit reminders:', error);
        if (!cancelled) {
          setVisitNotificationStatus({
            state: 'failed',
            pendingCount: 0,
            message: 'Visit reminders could not be set up on this device. Please reopen DasMom to try again.'
          });
        }
      });

    return () => {
      cancelled = true;
      stopNotifications?.();
    };
  }, [user, isAuthLoading]);

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
        } else {
          // If token refreshed and user is already loaded with matching ID, no reload needed
          if (isTokenRefresh && userRef.current?.id === session.user.id) {
            return;
          }
          const current = await authService.getAuthUser();
          if (isAndroidApp() && current && !['mother', 'patient'].includes(String(current.role || '').toLowerCase())) {
            if (session.user.app_metadata?.provider === 'google') {
              sessionStorage.setItem(
                'dasmom_google_login_error',
                'This Google account is not registered as a mother account.'
              );
            }
            await supabase.auth.signOut({ scope: 'local' });
            authService.clearUser();
            setUser(null);
            return;
          }
          if (isMounted && requestId === initRequest) {

            if (!current) {
              await visitNotificationService.cancelAndClearMother(session.user.id);
              if (session.user.app_metadata?.provider === 'google') {
                sessionStorage.setItem(
                  'dasmom_google_login_error',
                  'This Google account is not linked to a registered DasMom account.'
                );
                const { error: cleanupError } = await supabase.functions.invoke('google-account-check', {
                  body: { action: 'cleanup' },
                });
                if (cleanupError) console.error('Unable to clean up unregistered Google account:', cleanupError);
              }
              if (isAndroidApp()) await supabase.auth.signOut({ scope: 'local' });
              else await supabase.auth.signOut();
            }
            setUser(current);
          }
        }
      }
      catch (err) {
        console.error('AuthContext: Error during auth init', err);
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user?.id) {
            return visitNotificationService.reconcilePersistedSchedulesForSession(session.user.id);
          }
          return undefined;
        }).catch(notificationError => {
          console.error('Failed to reconcile saved reminders during auth recovery:', notificationError);
        });
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
        const previousUser = userRef.current;
        if (previousUser?.id && ['mother', 'patient'].includes(String(previousUser.role || '').toLowerCase())) {
          visitNotificationService.cancelAndClearMother(previousUser.id).catch(error => {
            console.error('Failed to cancel mother reminders on sign out:', error);
          });
          authService.clearOfflineMotherData(previousUser.id).catch(error => {
            console.error('Failed to clear saved mother records on sign out:', error);
          });
        }
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

    const handleReconnect = () => {
      initAuth();
      if (userRef.current?.id) visitNotificationService.requestSync();
    };
    if (isAndroidApp()) window.addEventListener('online', handleReconnect);

    return () => {
      isMounted = false;
      if (isAndroidApp()) window.removeEventListener('online', handleReconnect);
      if (signInInitTimer !== null) window.clearTimeout(signInInitTimer);
      subscription.unsubscribe();
    };
  }, [authService]);

  const logout = async () => {
    const currentUser = userRef.current;
    if (currentUser?.id && ['mother', 'patient'].includes(String(currentUser.role || '').toLowerCase())) {
      try {
        await visitNotificationService.cancelAndClearMother(currentUser.id);
      } catch (error) {
        setVisitNotificationStatus({
          state: 'failed',
          pendingCount: 0,
          message: 'Could not safely cancel this account’s reminders. Keep this account signed in and retry logout.'
        });
        throw error;
      }
    }
    await authService.logout();
    setUser(null);
    setIsAuthLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isAuthLoading, visitNotificationStatus }}>
      {children}
    </AuthContext.Provider>
  );
};