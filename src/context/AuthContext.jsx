import { createContext, useState, useEffect, useRef } from 'react';
import AuthService from '../services/authservice';
import supabase from '../config/supabaseclient';
import visitNotificationService from '../services/visitNotificationService';
import { isAndroidApp, secureStorage } from '../services/secureStorage';

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
  const authService = new AuthService();

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
          const expectedGoogleEmail = isAndroidApp()
            ? await secureStorage.get('dasmom.google_email')
            : localStorage.getItem('dasmom_google_email');
          const sessionEmail = session.user.email?.trim().toLowerCase();
          if (expectedGoogleEmail && sessionEmail !== expectedGoogleEmail) {
            if (isAndroidApp()) await secureStorage.remove('dasmom.google_email');
            else localStorage.removeItem('dasmom_google_email');
            await visitNotificationService.cancelAndClearMother(session.user.id);
            await authService.clearOfflineMotherData(session.user.id);
            if (isAndroidApp()) await supabase.auth.signOut({ scope: 'local' });
            else await supabase.auth.signOut();
            throw new Error('Use Google with the same email registered for your DasMom account.');
          }

          // Valid session exists - load full user data
          const current = await authService.getAuthUser();
          if (isAndroidApp()) await secureStorage.remove('dasmom.google_email');
          else localStorage.removeItem('dasmom_google_email');
          if (isAndroidApp() && current && !['mother', 'patient'].includes(String(current.role || '').toLowerCase())) {
            await supabase.auth.signOut({ scope: 'local' });
            authService.clearUser();
            setUser(null);
            return;
          }
          if (isMounted && requestId === initRequest) {
            if (!current) {
              await visitNotificationService.cancelAndClearMother(session.user.id);
              await supabase.functions.invoke('google-account-check', { body: { action: 'cleanup' } });
              await supabase.auth.signOut();
            }
            setUser(current);
          }
        }
      } catch (err) {
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
      } finally {
        if (isMounted && requestId === initRequest) {
          setIsAuthLoading(false);
        }
      }
    };

    initAuth();

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
        setUser(null);
        setIsAuthLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          initAuth();
        } else {
          initRequest += 1;
          setUser(null);
          setIsAuthLoading(false);
        }
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
      subscription.unsubscribe();
    };
  }, []);

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